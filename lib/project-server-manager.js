/**
 * Project Server Manager — process lifecycle, config persistence, and WebSocket broadcast
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const PROJECTS_FILE = join(homedir(), '.claude', 'projects.json');

// In-memory runtime state
// Map<projectId, { proc, status, outputBuffer, startedAt }>
const runningProcesses = new Map();

// WebSocket clients for /ws/projects
const wsClients = new Set();

// ============================================================
// Persistence
// ============================================================

/**
 * Load all project configs from disk
 * @returns {Promise<Array>} Array of project objects
 */
export async function loadProjects() {
  if (!existsSync(PROJECTS_FILE)) return [];
  try {
    const raw = await readFile(PROJECTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[projects] Failed to load projects.json:', err.message);
    return [];
  }
}

/**
 * Persist project configs to disk
 * @param {Array} projects
 */
async function saveProjects(projects) {
  await writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

// ============================================================
// CRUD
// ============================================================

/**
 * Add a new project config
 * @param {{ name, path, command, port, url }} opts
 * @returns {Promise<object>} Created project
 */
export async function addProject({ name, path: projectPath, command, port, url, autoOpen }) {
  if (!name || !projectPath || !command) {
    throw new Error('name, path, and command are required');
  }

  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  const projects = await loadProjects();
  const project = {
    id: randomUUID(),
    name: String(name).trim(),
    path: projectPath,
    command: String(command).trim(),
    port: port ? Number(port) : null,
    url: url || (port ? `http://localhost:${port}` : null),
    autoOpen: !!autoOpen,
    createdAt: new Date().toISOString(),
  };

  projects.push(project);
  await saveProjects(projects);
  console.log(`[projects] Added project: ${project.id} (${project.name})`);
  return project;
}

/**
 * Update an existing project config (non-destructive merge)
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object>} Updated project
 */
export async function updateProject(id, updates) {
  const projects = await loadProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Project not found');

  // Validate path exists if being changed
  if (updates.path && !existsSync(updates.path)) {
    throw new Error(`Project path does not exist: ${updates.path}`);
  }

  // Safe fields to update
  const allowed = ['name', 'path', 'command', 'port', 'url', 'autoOpen'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      projects[idx][key] = updates[key];
    }
  }

  // Sync port-derived URL if port changed but no explicit URL given
  if (updates.port !== undefined && updates.url === undefined) {
    projects[idx].url = updates.port
      ? `http://localhost:${updates.port}`
      : null;
  }

  await saveProjects(projects);
  console.log(`[projects] Updated project: ${id}`);
  return projects[idx];
}

/**
 * Remove a project config; stops the process first if running
 * @param {string} id
 */
export async function removeProject(id) {
  if (runningProcesses.has(id)) {
    try {
      await stopProject(id);
    } catch (err) {
      console.error(`[projects] Error stopping project before delete: ${err.message}`);
    }
  }

  const projects = await loadProjects();
  const filtered = projects.filter(p => p.id !== id);
  await saveProjects(filtered);
  console.log(`[projects] Removed project: ${id}`);
}

// ============================================================
// Process Management
// ============================================================

/**
 * Start a project's server process
 * @param {string} id
 * @returns {Promise<{ status: 'running', pid: number }>}
 */
export async function startProject(id) {
  if (runningProcesses.has(id)) {
    throw new Error('Project is already running');
  }

  const projects = await loadProjects();
  const project = projects.find(p => p.id === id);
  if (!project) throw new Error('Project not found');

  if (!existsSync(project.path)) {
    throw new Error(`Project path does not exist: ${project.path}`);
  }

  if (!project.command || !project.command.trim()) {
    throw new Error('Project has no start command configured');
  }

  // Spawn with shell:true so compound commands like "npm run dev" work.
  // detached:true creates a new process group — required for process.kill(-pid, ...)
  const proc = spawn(project.command, {
    cwd: project.path,
    shell: true,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });

  // Unref so the server's event loop isn't kept alive by the child process
  proc.unref();

  // Ring buffer: last 500 chunks (not lines — chunks are natural for streaming)
  const outputBuffer = [];
  const MAX_BUFFER = 500;

  const handleOutput = (stream, streamName) => {
    stream.on('data', chunk => {
      const text = chunk.toString();
      outputBuffer.push({ stream: streamName, text });
      if (outputBuffer.length > MAX_BUFFER) outputBuffer.shift();

      broadcast({
        type: 'project_output',
        projectId: id,
        data: text,
        stream: streamName,
      });
    });

    stream.on('error', err => {
      console.error(`[projects] ${id} ${streamName} stream error:`, err.message);
    });
  };

  handleOutput(proc.stdout, 'stdout');
  handleOutput(proc.stderr, 'stderr');

  proc.on('error', err => {
    console.error(`[projects] Process error for ${id}:`, err.message);
    runningProcesses.delete(id);
    broadcast({
      type: 'project_status',
      projectId: id,
      status: 'error',
      message: err.message,
    });
  });

  proc.on('close', code => {
    console.log(`[projects] Process exited for ${id} with code ${code}`);
    runningProcesses.delete(id);
    broadcast({
      type: 'project_status',
      projectId: id,
      status: 'stopped',
      exitCode: code,
    });
  });

  runningProcesses.set(id, {
    proc,
    status: 'running',
    outputBuffer,
    startedAt: Date.now(),
  });

  broadcast({
    type: 'project_status',
    projectId: id,
    status: 'running',
    pid: proc.pid,
  });

  console.log(`[projects] Started project: ${id} (pid ${proc.pid})`);
  return { status: 'running', pid: proc.pid };
}

/**
 * Stop a running project (SIGTERM → SIGKILL after 5s)
 * @param {string} id
 * @returns {Promise<{ status: 'stopped' }>}
 */
export async function stopProject(id) {
  const entry = runningProcesses.get(id);
  if (!entry) throw new Error('Project is not running');

  const { proc } = entry;

  return new Promise(resolve => {
    const forceKillTimer = setTimeout(() => {
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        try { proc.kill('SIGKILL'); } catch { /* already gone */ }
      }
    }, 5000);

    proc.once('close', () => {
      clearTimeout(forceKillTimer);
      // Map cleanup happens in the 'close' event handler above
      resolve({ status: 'stopped' });
    });

    // Kill the process group (catches shell children like node, webpack, etc.)
    try {
      process.kill(-proc.pid, 'SIGTERM');
    } catch {
      // Fallback: kill just the shell process
      try { proc.kill('SIGTERM'); } catch { /* already gone */ }
    }
  });
}

// ============================================================
// Status & Output
// ============================================================

/**
 * Get runtime status for all running projects
 * @returns {Object} Map of projectId → { status, pid, startedAt }
 */
export function getProjectStatuses() {
  const statuses = {};
  for (const [id, entry] of runningProcesses) {
    statuses[id] = {
      status: entry.status,
      pid: entry.proc.pid,
      startedAt: entry.startedAt,
    };
  }
  return statuses;
}

/**
 * Get status for a single project
 * @param {string} id
 * @returns {{ status: string, pid?: number, startedAt?: number }}
 */
export function getProjectStatus(id) {
  const entry = runningProcesses.get(id);
  if (!entry) return { status: 'stopped' };
  return {
    status: entry.status,
    pid: entry.proc.pid,
    startedAt: entry.startedAt,
  };
}

/**
 * Get buffered output for a project (for clients connecting after start)
 * @param {string} id
 * @param {number} [lines] Max number of chunks to return (default: all)
 * @returns {string} Concatenated output
 */
export function getProjectOutput(id, lines) {
  const entry = runningProcesses.get(id);
  if (!entry) return '';
  const buf = entry.outputBuffer;
  const slice = lines ? buf.slice(-lines) : buf;
  return slice.map(c => c.text).join('');
}

// ============================================================
// WebSocket
// ============================================================

/**
 * Register a new WebSocket client for project events
 * @param {WebSocket} ws
 */
export function addWsClient(ws) {
  wsClients.add(ws);

  // Send current runtime statuses so the UI is immediately accurate
  try {
    ws.send(JSON.stringify({
      type: 'init',
      statuses: getProjectStatuses(),
    }));
  } catch (err) {
    console.error('[projects] Failed to send init to WS client:', err.message);
  }

  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
}

/**
 * Broadcast a message to all connected project WebSocket clients
 * @param {object} message
 */
function broadcast(message) {
  const data = JSON.stringify(message);
  for (const ws of wsClients) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(data);
      } catch (err) {
        console.error('[projects] WS broadcast error:', err.message);
        wsClients.delete(ws);
      }
    }
  }
}

// ============================================================
// Shutdown
// ============================================================

/**
 * Gracefully terminate all managed child processes
 * Called on server SIGINT / process exit
 */
export function shutdownAll() {
  console.log(`[projects] Shutting down ${runningProcesses.size} running project(s)...`);
  for (const [id, entry] of runningProcesses) {
    try {
      process.kill(-entry.proc.pid, 'SIGTERM');
    } catch {
      try { entry.proc.kill('SIGTERM'); } catch { /* already gone */ }
    }
    console.log(`[projects] Sent SIGTERM to project: ${id}`);
  }
  runningProcesses.clear();
}
