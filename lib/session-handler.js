/**
 * Session Handler - CLI session state management and WebSocket broadcasting
 * For the claudemon session monitoring TUI
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { sendJson } from './router.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', '.session-state.json');

// In-memory state for active sessions
const activeSessions = new Map();

// WebSocket clients for session updates (separate from activity)
const sessionWsClients = new Set();

// Session timeout (5 minutes without heartbeat = stale)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

// Heartbeat check interval (every 30 seconds)
const HEARTBEAT_CHECK_INTERVAL = 30 * 1000;

/**
 * Session data model
 * @typedef {Object} Session
 * @property {string} sessionId - Unique per CLI instance
 * @property {number} pid - Process ID
 * @property {string} ttyPath - e.g., /dev/ttys003
 * @property {string} workingDirectory - CWD
 * @property {string} terminalApp - "iTerm.app", "Terminal.app"
 * @property {string} terminalWindowId - For focus switching
 * @property {string} status - "idle" | "thinking" | "executing" | "waiting"
 * @property {string} currentTask - Last user prompt
 * @property {Array} recentTools - Last 5 tools [{name, timestamp, summary}]
 * @property {string} registeredAt - ISO timestamp
 * @property {string} lastActivityAt - ISO timestamp
 * @property {string} label - User-assigned label
 */

/**
 * Save session state to file for persistence
 */
function saveState() {
  try {
    const state = {
      sessions: Array.from(activeSessions.values()),
      savedAt: new Date().toISOString()
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[session] Failed to save state:', err.message);
  }
}

/**
 * Load session state from file on startup
 */
function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const data = JSON.parse(readFileSync(STATE_FILE, 'utf8'));

      if (data.sessions && Array.isArray(data.sessions)) {
        const now = Date.now();
        for (const session of data.sessions) {
          // Only restore sessions that aren't too old (within timeout)
          const lastActivity = new Date(session.lastActivityAt).getTime();
          if (now - lastActivity < SESSION_TIMEOUT_MS) {
            // Verify process is still running
            if (isProcessAlive(session.pid)) {
              activeSessions.set(session.sessionId, session);
              console.log(`[session] Restored session: ${session.sessionId} (${session.workingDirectory})`);
            }
          }
        }
      }

      console.log(`[session] Loaded ${activeSessions.size} sessions from saved state`);
    }
  } catch (err) {
    console.error('[session] Failed to load state:', err.message);
  }
}

/**
 * Check if a process is still running and is a Claude CLI process
 * @param {number} pid - Process ID
 * @returns {boolean}
 */
function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    // Verify it's actually a claude CLI process (not claudemon, server.js, etc.)
    const comm = execSync(`ps -p ${pid} -o comm=`, {
      encoding: 'utf8',
      timeout: 1000
    }).trim();
    return comm === 'claude';
  } catch {
    return false;
  }
}

/**
 * Broadcast a message to all session WebSocket clients
 * @param {object} message - Message to broadcast
 */
function broadcastSession(message) {
  const data = JSON.stringify(message);
  sessionWsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(data);
      } catch (err) {
        console.error('[session] Failed to send to client:', err);
      }
    }
  });
}

/**
 * Add a WebSocket client for session updates
 * @param {WebSocket} ws - WebSocket client
 */
export function addSessionClient(ws) {
  sessionWsClients.add(ws);

  // Send current state
  ws.send(JSON.stringify({
    type: 'session_init',
    sessions: getActiveSessions()
  }));

  ws.on('close', () => {
    sessionWsClients.delete(ws);
  });

  ws.on('error', () => {
    sessionWsClients.delete(ws);
  });
}

/**
 * Register a new session
 * @param {object} data - Session registration data
 * @returns {object} Created session
 */
export function registerSession(data) {
  const {
    sessionId,
    pid,
    ttyPath,
    workingDirectory,
    terminalApp,
    terminalWindowId
  } = data;

  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  // If session already exists, just update lastActivityAt
  if (activeSessions.has(sessionId)) {
    const existing = activeSessions.get(sessionId);
    existing.lastActivityAt = new Date().toISOString();
    // Update fields that might have changed
    if (workingDirectory) existing.workingDirectory = workingDirectory;
    if (terminalWindowId) existing.terminalWindowId = terminalWindowId;
    if (ttyPath) existing.ttyPath = ttyPath;
    if (data.currentTask) existing.currentTask = data.currentTask;
    broadcastSession({ type: 'session_updated', session: existing });
    return existing;
  }

  // Deduplicate by PID or TTY: if another session shares the same PID or
  // TTY path, it's a stale entry from a previous session_id (e.g., after
  // resume/reconnect or process restart in the same terminal tab).
  const parsedPid = pid ? parseInt(pid, 10) : null;
  const staleIds = [];
  for (const [existingId, existing] of activeSessions) {
    if (existingId === sessionId) continue;
    const samePid = parsedPid && existing.pid === parsedPid;
    const sameTty = ttyPath && ttyPath !== '' && existing.ttyPath === ttyPath;
    if (samePid || sameTty) {
      console.log(`[session] Replacing stale session ${existingId} (pid:${existing.pid}, tty:${existing.ttyPath}) with ${sessionId} (pid:${pid}, tty:${ttyPath})`);
      // Preserve user-assigned label from the old session
      if (existing.label && !data._preservedLabel) {
        data._preservedLabel = existing.label;
      }
      staleIds.push(existingId);
    }
  }
  for (const id of staleIds) {
    deregisterSession(id);
  }

  const now = new Date().toISOString();

  const session = {
    sessionId,
    pid: pid ? parseInt(pid, 10) : null,
    ttyPath: ttyPath || '',
    workingDirectory: workingDirectory || process.cwd(),
    terminalApp: terminalApp || 'unknown',
    terminalWindowId: terminalWindowId || '',
    status: 'idle',
    currentTask: data.currentTask || '',
    recentTools: [],
    registeredAt: now,
    lastActivityAt: now,
    label: data._preservedLabel || ''
  };

  activeSessions.set(sessionId, session);
  saveState();

  broadcastSession({
    type: 'session_registered',
    session
  });

  console.log(`[session] Registered: ${sessionId} (pid: ${pid}, tty: ${ttyPath})`);
  return session;
}

/**
 * Update session activity (tool use, status change)
 * @param {string} sessionId - Session ID
 * @param {object} activity - Activity data
 * @returns {object|null} Updated session or null
 */
export function updateSessionActivity(sessionId, activity) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.log(`[session] Activity update for unknown session: ${sessionId}`);
    return null;
  }

  const now = new Date().toISOString();
  session.lastActivityAt = now;

  // Update status if provided
  if (activity.status) {
    session.status = activity.status;
  }

  // Update current task if provided
  if (activity.currentTask) {
    session.currentTask = activity.currentTask;
  }

  // Add tool to recent tools
  if (activity.tool) {
    session.recentTools.unshift({
      name: activity.tool.name,
      timestamp: now,
      summary: activity.tool.summary || ''
    });
    // Keep only last 5 tools
    session.recentTools = session.recentTools.slice(0, 5);
  }

  activeSessions.set(sessionId, session);
  saveState();

  broadcastSession({
    type: 'session_updated',
    session
  });

  return session;
}

/**
 * Update session heartbeat
 * @param {string} sessionId - Session ID
 * @param {object} data - Heartbeat data (status, etc.)
 * @returns {object|null} Updated session or null
 */
export function updateSessionHeartbeat(sessionId, data = {}) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return null;
  }

  session.lastActivityAt = new Date().toISOString();

  if (data.status) {
    session.status = data.status;
  }

  activeSessions.set(sessionId, session);
  // Don't save on every heartbeat to reduce disk I/O

  return session;
}

/**
 * Deregister a session
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if session was removed
 */
export function deregisterSession(sessionId) {
  if (!activeSessions.has(sessionId)) {
    return false;
  }

  activeSessions.delete(sessionId);
  saveState();

  broadcastSession({
    type: 'session_deregistered',
    sessionId
  });

  console.log(`[session] Deregistered: ${sessionId}`);
  return true;
}

/**
 * Set a label for a session
 * @param {string} sessionId - Session ID
 * @param {string} label - User-assigned label
 * @returns {object|null} Updated session or null
 */
export function setSessionLabel(sessionId, label) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return null;
  }

  session.label = label;
  activeSessions.set(sessionId, session);
  saveState();

  broadcastSession({
    type: 'session_updated',
    session
  });

  return session;
}

/**
 * Get all active sessions
 * @returns {Array} Array of session objects
 */
export function getActiveSessions() {
  return Array.from(activeSessions.values());
}

/**
 * Get a specific session
 * @param {string} sessionId - Session ID
 * @returns {object|null} Session or null
 */
export function getSession(sessionId) {
  return activeSessions.get(sessionId) || null;
}

/**
 * Scan for Claude Code sessions via process inspection
 * @returns {Array} Array of discovered sessions
 */
export function scanForSessions() {
  const discovered = [];

  try {
    // Find Claude Code CLI processes (exact match to avoid claudemon, server.js, etc.)
    const psOutput = execSync('pgrep -x claude', {
      encoding: 'utf8',
      timeout: 5000
    }).trim();

    if (!psOutput) {
      return discovered;
    }

    const pids = psOutput.split('\n');
    for (const pidLine of pids) {
      const pid = parseInt(pidLine.trim(), 10);
      if (isNaN(pid)) continue;

      // Check if we already have this session
      const existingSession = Array.from(activeSessions.values())
        .find(s => s.pid === pid);

      if (!existingSession) {
        // Try to get TTY for this PID
        try {
          const ttyOutput = execSync(`ps -p ${pid} -o tty=`, {
            encoding: 'utf8',
            timeout: 1000
          }).trim();

          if (ttyOutput && ttyOutput !== '??' && ttyOutput !== '-') {
            const ttyPath = ttyOutput.startsWith('/') ? ttyOutput : `/dev/${ttyOutput}`;

            // Get working directory
            let cwd = '';
            try {
              cwd = execSync(`lsof -p ${pid} | grep cwd | awk '{print $9}'`, {
                encoding: 'utf8',
                timeout: 1000
              }).trim();
            } catch {
              // Ignore lsof errors
            }

            const sessionId = `scan-${pid}-${Date.now()}`;
            const session = registerSession({
              sessionId,
              pid,
              ttyPath,
              workingDirectory: cwd || '/unknown',
              terminalApp: process.env.TERM_PROGRAM || 'unknown'
            });

            discovered.push(session);
          }
        } catch {
          // Ignore individual process errors
        }
      }
    }
  } catch (err) {
    console.error('[session] Scan failed:', err.message);
  }

  return discovered;
}

/**
 * Remove stale sessions (no heartbeat within timeout)
 */
function cleanupStaleSessions() {
  const now = Date.now();
  const stale = [];

  for (const [id, session] of activeSessions) {
    const lastActivity = new Date(session.lastActivityAt).getTime();

    // Check if session has timed out
    if (now - lastActivity > SESSION_TIMEOUT_MS) {
      // Verify process is still running
      if (!isProcessAlive(session.pid)) {
        stale.push(id);
      }
    }
  }

  for (const id of stale) {
    console.log(`[session] Removing stale session: ${id}`);
    deregisterSession(id);
  }
}

// Start heartbeat check interval
let heartbeatCheckTimer = null;

// Periodic scan interval (every 30 seconds)
const PERIODIC_SCAN_INTERVAL = 30 * 1000;
let periodicScanTimer = null;

export function startHeartbeatChecker() {
  if (heartbeatCheckTimer) return;

  heartbeatCheckTimer = setInterval(cleanupStaleSessions, HEARTBEAT_CHECK_INTERVAL);
  console.log('[session] Heartbeat checker started');

  startPeriodicScan();
}

/**
 * Start periodic scanning for unregistered Claude sessions
 */
function startPeriodicScan() {
  if (periodicScanTimer) return;

  periodicScanTimer = setInterval(() => {
    try {
      const discovered = scanForSessions();
      if (discovered.length > 0) {
        console.log(`[session] Periodic scan discovered ${discovered.length} new session(s)`);
      }
    } catch (err) {
      console.error('[session] Periodic scan error:', err.message);
    }
  }, PERIODIC_SCAN_INTERVAL);
  console.log('[session] Periodic scan started');
}

export function stopHeartbeatChecker() {
  if (heartbeatCheckTimer) {
    clearInterval(heartbeatCheckTimer);
    heartbeatCheckTimer = null;
  }
  if (periodicScanTimer) {
    clearInterval(periodicScanTimer);
    periodicScanTimer = null;
  }
}

// ============================================================
// API Handlers
// ============================================================

/**
 * GET /api/sessions
 * Get all active sessions
 */
async function handleGetSessions(req, res) {
  try {
    sendJson(res, 200, { sessions: getActiveSessions() });
  } catch (error) {
    console.error('[session] Get sessions error:', error);
    sendJson(res, 500, { error: 'Failed to get sessions' });
  }
}

/**
 * GET /api/sessions/scan
 * Scan for Claude Code sessions via process inspection
 */
async function handleScanSessions(req, res) {
  try {
    const discovered = scanForSessions();
    sendJson(res, 200, { discovered, sessions: getActiveSessions() });
  } catch (error) {
    console.error('[session] Scan error:', error);
    sendJson(res, 500, { error: 'Failed to scan sessions' });
  }
}

/**
 * GET /api/sessions/:id
 * Get a specific session
 */
async function handleGetSession(req, res) {
  try {
    const session = getSession(req.params.id);
    if (session) {
      sendJson(res, 200, { session });
    } else {
      sendJson(res, 404, { error: 'Session not found' });
    }
  } catch (error) {
    console.error('[session] Get session error:', error);
    sendJson(res, 500, { error: 'Failed to get session' });
  }
}

/**
 * POST /api/sessions/register
 * Register a new session
 */
async function handleRegisterSession(req, res) {
  try {
    const session = registerSession(req.body);
    sendJson(res, 200, { success: true, session });
  } catch (error) {
    console.error('[session] Register error:', error);
    sendJson(res, 400, { error: error.message || 'Failed to register session' });
  }
}

/**
 * DELETE /api/sessions/:id
 * Deregister a session
 */
async function handleDeregisterSession(req, res) {
  try {
    const removed = deregisterSession(req.params.id);
    if (removed) {
      sendJson(res, 200, { success: true });
    } else {
      sendJson(res, 404, { error: 'Session not found' });
    }
  } catch (error) {
    console.error('[session] Deregister error:', error);
    sendJson(res, 500, { error: 'Failed to deregister session' });
  }
}

/**
 * POST /api/sessions/:id/heartbeat
 * Update session heartbeat
 */
async function handleSessionHeartbeat(req, res) {
  try {
    const session = updateSessionHeartbeat(req.params.id, req.body);
    if (session) {
      sendJson(res, 200, { success: true, session });
    } else {
      sendJson(res, 404, { error: 'Session not found' });
    }
  } catch (error) {
    console.error('[session] Heartbeat error:', error);
    sendJson(res, 500, { error: 'Failed to update heartbeat' });
  }
}

/**
 * POST /api/sessions/:id/activity
 * Update session activity
 */
async function handleSessionActivity(req, res) {
  try {
    const session = updateSessionActivity(req.params.id, req.body);
    if (session) {
      sendJson(res, 200, { success: true, session });
    } else {
      sendJson(res, 404, { error: 'Session not found' });
    }
  } catch (error) {
    console.error('[session] Activity update error:', error);
    sendJson(res, 500, { error: 'Failed to update activity' });
  }
}

/**
 * PUT /api/sessions/:id/label
 * Set a label for a session
 */
async function handleSetSessionLabel(req, res) {
  try {
    const label = req.body.label || '';
    const session = setSessionLabel(req.params.id, label);
    if (session) {
      sendJson(res, 200, { success: true, session });
    } else {
      sendJson(res, 404, { error: 'Session not found' });
    }
  } catch (error) {
    console.error('[session] Set label error:', error);
    sendJson(res, 500, { error: 'Failed to set label' });
  }
}

/**
 * Register session routes with the router
 * Route order matters — fixed paths before parameterized paths
 * @param {object} router - Router instance
 */
export function registerSessionRoutes(router) {
  router.get('/api/sessions/scan', handleScanSessions);
  router.get('/api/sessions', handleGetSessions);
  router.get('/api/sessions/:id', handleGetSession);
  router.post('/api/sessions/register', handleRegisterSession);
  router.post('/api/sessions/:id/heartbeat', handleSessionHeartbeat);
  router.post('/api/sessions/:id/activity', handleSessionActivity);
  router.put('/api/sessions/:id/label', handleSetSessionLabel);
  router.delete('/api/sessions/:id', handleDeregisterSession);
}

// Load persisted state on module initialization
loadState();

export default {
  registerSession,
  updateSessionActivity,
  updateSessionHeartbeat,
  deregisterSession,
  setSessionLabel,
  getActiveSessions,
  getSession,
  scanForSessions,
  addSessionClient,
  startHeartbeatChecker,
  stopHeartbeatChecker,
  registerSessionRoutes
};
