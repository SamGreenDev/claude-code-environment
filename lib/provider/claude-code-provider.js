import { readFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { BaseProvider } from './base-provider.js';
import { registerProvider } from './provider-registry.js';
import { TEAMS_DIR, TASKS_DIR } from '../paths.js';
import { getAgents, getSkills } from '../agent-parser.js';
import { writeJsonAtomic } from '../mission-state.js';

const SUPPORTED_AGENT_TYPES = [
  'general-purpose',
  'Bash',
  'Explore',
  'Plan',
  'architect',
  'code-reviewer',
  'code-implementer',
  'security-reviewer',
  'refactor-cleaner',
];

// Cache for agent definitions — loaded once per server lifetime
let _agentDefsCache = null;
async function loadAgentDefs() {
  if (!_agentDefsCache) {
    try {
      _agentDefsCache = await getAgents();
    } catch {
      _agentDefsCache = [];
    }
  }
  return _agentDefsCache;
}

// Cache for skill definitions — loaded once per server lifetime
let _skillDefsCache = null;
async function loadSkillDefs() {
  if (!_skillDefsCache) {
    try {
      _skillDefsCache = await getSkills();
    } catch {
      _skillDefsCache = [];
    }
  }
  return _skillDefsCache;
}

/**
 * Phase 1 provider that integrates with Claude Code's team/task file system.
 * Simulates agent execution by writing team config and task files that
 * Claude Code's agent system can pick up and process.
 */
export class ClaudeCodeProvider extends BaseProvider {
  constructor() {
    super('claude-code');
    this._activeProcesses = new Map(); // agentId → ChildProcess
    this._lastActiveFormWrite = new Map(); // `${runId}/${nodeId}` → timestamp
  }

  /**
   * Initialize the team directory with a full config listing all mission nodes as members.
   * Must be called once at mission start, before any task files are written.
   * @param {string} runId - Unique run identifier
   * @param {Object} mission - Full mission definition (nodes, edges, name, etc.)
   */
  async initializeTeam(runId, mission) {
    this._writeTeamConfig(runId, mission.nodes || [], mission.name || mission.id || runId);
  }

  /**
   * Execute a mission node by spawning a `claude` CLI process.
   *
   * Includes spawn verification: after spawning, we wait up to 300ms for an
   * immediate error event (e.g. ENOENT — "command not found"). If the error
   * fires within that window we throw so the caller can retry or mark as failed.
   * This prevents silent spawn failures from becoming orphan nodes.
   *
   * @param {Object} node - Mission node (id, label, agentType, prompt, parents, children, siblings)
   * @param {Object} context - Variable context for prompt resolution
   * @param {string} runId - Unique run identifier (used as team/task directory name)
   * @returns {Promise<{ output: string, agentId: string }>}
   * @throws If the process fails to start or produces an immediate error
   */
  async executeNode(node, context, runId) {
    const resolvedPrompt = this._resolvePrompt(node.prompt ?? node.label, context);

    // Write task file for tracking/UI with pending status
    this._ensureTeamDir(runId);
    this._writeTaskFile(runId, node, resolvedPrompt);

    // Look up agent definition for this node's agentType
    const agentDefs = await loadAgentDefs();
    const agentDef = agentDefs.find(a => a.id === node.agentType);

    // Load skill definitions for this node's skills array
    const selectedSkillIds = node.skills || [];
    let resolvedSkills = [];
    if (selectedSkillIds.length > 0) {
      const allSkills = await loadSkillDefs();
      resolvedSkills = selectedSkillIds
        .map(id => allSkills.find(s => s.id === id))
        .filter(Boolean);
    }

    // Determine allowed tools — agent definition overrides default, then merge skill tools
    const defaultTools = ['Edit', 'Write', 'Read', 'Glob', 'Grep', 'Bash', 'NotebookEdit'];
    const baseTools = agentDef?.allowedTools?.length ? agentDef.allowedTools : defaultTools;
    const toolSet = new Set(baseTools);
    for (const skill of resolvedSkills) {
      if (skill.allowedTools?.length) {
        for (const tool of skill.allowedTools) toolSet.add(tool);
      }
    }
    const allowedTools = [...toolSet];

    // Build CLI args — --verbose is required for stream-json output
    const args = [
      '-p', resolvedPrompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence',
      '--allowedTools', ...allowedTools,
    ];

    // Model priority: node-level > agent definition > none (CLI default)
    if (node.model) {
      args.push('--model', node.model);
    } else if (agentDef?.model) {
      args.push('--model', agentDef.model);
    }

    // --strict-mcp-config isolates from user's global MCP config (avoids duplicate tool name errors).
    // If the node defines its own MCP servers, pass them explicitly.
    if (node.mcpServers?.length) {
      const mcpConfig = JSON.stringify({ mcpServers: Object.fromEntries(
        node.mcpServers.map(s => [s.name, { command: s.command, args: s.args || [] }])
      )});
      args.push('--mcp-config', mcpConfig, '--strict-mcp-config');
    } else {
      args.push('--strict-mcp-config');
    }

    // Build enriched system prompt with workdir, siblings, and parent context
    const systemParts = [
      `You are executing node "${node.label}" in a mission. Agent type: ${node.agentType || 'general-purpose'}.`,
    ];

    if (context.workdir) {
      systemParts.push(`WORKING DIRECTORY: ${context.workdir}`);
      systemParts.push('All files you create should be relative to this directory. You are already in this directory.');
    }

    if (node.siblings && node.siblings.length > 0) {
      const sibLabels = node.siblings.map(s => s.label || s.id).join(', ');
      systemParts.push(`SIBLING AGENTS (running in parallel with you): ${sibLabels}`);
      systemParts.push('IMPORTANT: Only create/modify files explicitly assigned to you. Do NOT touch files owned by sibling agents.');
    }

    if (node.parents && node.parents.length > 0) {
      const parentLabels = node.parents.map(p => p.label || p.id).join(', ');
      systemParts.push(`UPSTREAM AGENTS (completed before you): ${parentLabels}`);
    }

    // Inject agent definition instructions if available
    if (agentDef?.content) {
      systemParts.push(`\n## Agent Instructions\n${agentDef.content}`);
    }

    // Inject skill content for each selected skill
    for (const skill of resolvedSkills) {
      if (skill.content) {
        systemParts.push(`\n<skill name="${skill.id}">\n${skill.content}\n</skill>`);
      }
    }

    args.push('--append-system-prompt', systemParts.join('\n'));

    // Resolve cwd — prefer workdir from context, fall back to process.cwd()
    const spawnCwd = context.workdir && existsSync(context.workdir) ? context.workdir : process.cwd();

    // Spawn with CLAUDECODE deleted to allow nested execution.
    // Setting CLAUDECODE='' is NOT enough — Claude CLI checks for variable existence, not value.
    const spawnEnv = { ...process.env };
    delete spawnEnv.CLAUDECODE;

    const child = spawn('claude', args, {
      env: spawnEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: spawnCwd,
    });

    // Close stdin — non-interactive mode doesn't need it, and leaving it open can hang the process
    child.stdin.end();

    const agentId = `${runId}/${node.id}`;

    // ── Spawn verification ────────────────────────────────────────────────────
    // Race for 300ms: if the 'error' event fires (e.g. ENOENT — "command not found"),
    // throw immediately so the caller (scheduleNode) can retry or mark as failed.
    // Without this, ENOENT failures are silent and the node becomes an orphan.
    const spawnError = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.removeListener('error', onError);
        resolve(null);
      }, 300);

      const onError = (err) => {
        clearTimeout(timer);
        resolve(err);
      };

      child.once('error', onError);
    });

    if (spawnError) {
      const msg = `Failed to start agent for node "${node.label}": ${spawnError.message}`;
      console.error(`[claude-code-provider] ${msg}`);
      this._writeFailedTaskFile(runId, node.id, msg);
      throw new Error(msg);
    }

    // Process confirmed started — register it and begin streaming output
    this._activeProcesses.set(agentId, child);
    this._streamOutput(child, runId, node.id, agentId);

    return { output: `Agent spawned for ${node.label}`, agentId };
  }

  /**
   * Abort a running node by killing its process and marking the task as failed.
   * @param {string} nodeId - The node/task ID to abort
   * @param {string} runId - The run containing the node
   * @returns {Promise<void>}
   */
  async abortNode(nodeId, runId) {
    const agentId = `${runId}/${nodeId}`;
    const child = this._activeProcesses.get(agentId);
    if (child) {
      child.kill('SIGTERM');
      this._activeProcesses.delete(agentId);
    }

    const taskPath = this._taskPath(runId, nodeId);
    if (!existsSync(taskPath)) return;

    try {
      const task = JSON.parse(readFileSync(taskPath, 'utf8'));
      task.status = 'failed';
      task.error = 'Aborted by user';
      writeJsonAtomic(taskPath, task);
    } catch (err) {
      throw new Error(`Failed to abort node ${nodeId} in run ${runId}: ${err.message}`);
    }
  }

  /**
   * Clean up team and task directories for a completed/failed/aborted run.
   * Removing the team directory triggers team-watcher to complete all tracked agents.
   * @param {string} runId
   */
  cleanupRun(runId) {
    const teamDir = join(TEAMS_DIR, runId);
    const taskDir = join(TASKS_DIR, runId);

    for (const dir of [teamDir, taskDir]) {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch (err) {
          console.error(`[claude-code-provider] Failed to remove ${dir}:`, err.message);
        }
      }
    }
  }

  /**
   * Claude Code provider is always available.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return true;
  }

  /**
   * Check if a process is still actively running for the given agent.
   * @param {string} agentId - Format: `${runId}/${nodeId}`
   * @returns {boolean}
   */
  isProcessAlive(agentId) {
    return this._activeProcesses.has(agentId);
  }

  /**
   * Returns the 8 agent types supported by this provider.
   * @returns {string[]}
   */
  getSupportedAgentTypes() {
    return SUPPORTED_AGENT_TYPES;
  }

  /**
   * Provider display info for the Holonet Command Center UI.
   * @returns {{ name: string, displayName: string, faction: string, icon: string }}
   */
  getProviderInfo() {
    return {
      name: 'claude-code',
      displayName: 'Claude Code',
      faction: 'rebel-alliance',
      icon: 'rebel',
    };
  }

  // ---------------------------------------------------------------------------
  // Process streaming helpers
  // ---------------------------------------------------------------------------

  /**
   * Wire stdout/stderr/close/error handlers for a spawned child process.
   * Updates the task file with live progress and final status.
   *
   * Note: the 'error' event listener here handles errors that occur AFTER
   * the 300ms spawn-verification window in executeNode. A listener must
   * always be present to avoid unhandled-error crashes.
   */
  _streamOutput(child, runId, nodeId, agentId) {
    let fullOutput = '';
    let lastText = '';

    child.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text') {
                lastText = block.text.slice(-200);
                this._updateTaskActiveForm(runId, nodeId, lastText.slice(0, 100));
              }
            }
          }

          if (event.type === 'result') {
            fullOutput = event.result || lastText;
          }
        } catch { /* partial JSON line, skip */ }
      }
    });

    child.stderr.on('data', (chunk) => {
      const errText = chunk.toString().trim();
      if (errText) this._updateTaskActiveForm(runId, nodeId, `stderr: ${errText.slice(0, 80)}`);
    });

    // Handle errors that occur after the spawn-verification window (rare but must not crash)
    child.on('error', (err) => {
      this._activeProcesses.delete(agentId);
      const msg = `Process error for node ${nodeId}: ${err.message}`;
      console.error(`[claude-code-provider] ${msg}`);
      this._writeFailedTaskFile(runId, nodeId, msg);
    });

    child.on('close', (code) => {
      this._activeProcesses.delete(agentId);
      this._lastActiveFormWrite.delete(`${runId}/${nodeId}`);
      const taskPath = this._taskPath(runId, nodeId);
      try {
        const task = JSON.parse(readFileSync(taskPath, 'utf8'));
        if (code === 0) {
          task.status = 'completed';
          task.output = fullOutput || lastText || 'Completed';
        } else {
          task.status = 'failed';
          task.error = `Process exited with code ${code}`;
          console.error(`[claude-code-provider] Node ${nodeId} exited with code ${code} in run ${runId}`);
        }
        writeJsonAtomic(taskPath, task);
      } catch (err) {
        // If we can't update the existing task file, write a minimal one so the poller detects completion
        console.error(`[claude-code-provider] Failed to update task file on close for ${nodeId}:`, err.message);
        this._writeCompletionTaskFile(runId, nodeId, code, fullOutput || lastText);
      }
    });
  }

  /** Update the activeForm field in a task file for live progress display. Throttled to 500ms per node. */
  _updateTaskActiveForm(runId, nodeId, text) {
    const key = `${runId}/${nodeId}`;
    const now = Date.now();
    if (now - (this._lastActiveFormWrite.get(key) || 0) < 500) return;
    this._lastActiveFormWrite.set(key, now);

    const taskPath = this._taskPath(runId, nodeId);
    try {
      const task = JSON.parse(readFileSync(taskPath, 'utf8'));
      task.activeForm = text.slice(0, 100);
      task.status = 'in_progress';
      writeJsonAtomic(taskPath, task);
    } catch (err) {
      // Non-fatal: activeForm update failure doesn't affect correctness
      console.error(`[claude-code-provider] Failed to update activeForm for ${nodeId}: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Resolve {{variable}} placeholders in a prompt string. */
  _resolvePrompt(prompt, context) {
    if (!prompt || !context) return prompt ?? '';
    return prompt.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      Object.prototype.hasOwnProperty.call(context, key) ? String(context[key]) : `{{${key}}}`
    );
  }

  /** Ensure the team and task directories exist for a given runId. */
  _ensureTeamDir(runId) {
    const teamDir = join(TEAMS_DIR, runId);
    const taskDir = join(TASKS_DIR, runId);

    if (!existsSync(teamDir)) {
      mkdirSync(teamDir, { recursive: true });
    }
    if (!existsSync(taskDir)) {
      mkdirSync(taskDir, { recursive: true });
    }
  }

  /**
   * Write a full team config.json with all mission nodes listed as members.
   * Called once at mission start before any task files are written.
   */
  _writeTeamConfig(runId, missionNodes, missionName) {
    this._ensureTeamDir(runId);
    const configPath = join(TEAMS_DIR, runId, 'config.json');
    const config = {
      name: runId,
      description: `Mission: ${missionName}`,
      provider: 'claude-code',
      createdAt: new Date().toISOString(),
      members: (missionNodes || []).map(node => ({
        name: node.id,
        agentType: node.agentType || 'general-purpose',
        isActive: true,
        prompt: (node.prompt || node.label || '').slice(0, 200),
        mcpServers: node.mcpServers || [],
      })),
    };
    writeJsonAtomic(configPath, config);
  }

  /** Write a task file for the given node into the run's task directory. */
  _writeTaskFile(runId, node, resolvedPrompt) {
    const taskPath = this._taskPath(runId, node.id);
    const parents = node.parents || [];
    const children = node.children || [];
    const siblings = node.siblings || [];

    // Build peers map: sibling ID → label for easy discovery
    const peers = {};
    for (const sib of siblings) {
      peers[sib.id || sib] = sib.label || String(sib.id || sib);
    }

    const task = {
      id: String(node.id),
      subject: node.label,
      description: resolvedPrompt,
      status: 'pending',
      owner: String(node.id),
      blockedBy: parents.map(p => String(p.id || p)),
      blocks: children.map(c => String(c.id || c)),
      siblings: siblings.map(s => String(s.id || s)),
      peers,
      activeForm: `Working on ${node.label}...`,
      mcpServers: node.mcpServers || [],
      messages: [],
    };
    writeJsonAtomic(taskPath, task);
  }

  /**
   * Write a failed task file for a node.
   * Used when spawn fails or an unrecoverable error occurs before/during streaming.
   * @param {string} runId
   * @param {string} nodeId
   * @param {string} errorMessage
   */
  _writeFailedTaskFile(runId, nodeId, errorMessage) {
    const taskPath = this._taskPath(runId, nodeId);
    try {
      // Try to merge with existing task data to preserve id/subject
      let task;
      try {
        task = JSON.parse(readFileSync(taskPath, 'utf8'));
      } catch {
        task = { id: nodeId };
      }
      task.status = 'failed';
      task.error = errorMessage;
      writeJsonAtomic(taskPath, task);
    } catch (writeErr) {
      console.error(`[claude-code-provider] Failed to write failed task file for ${nodeId}: ${writeErr.message}`);
    }
  }

  /**
   * Write a minimal completion task file when the close handler can't update the existing file.
   * @param {string} runId
   * @param {string} nodeId
   * @param {number|null} exitCode
   * @param {string} output
   */
  _writeCompletionTaskFile(runId, nodeId, exitCode, output) {
    const taskPath = this._taskPath(runId, nodeId);
    try {
      const fallback = {
        id: nodeId,
        status: exitCode === 0 ? 'completed' : 'failed',
        output: exitCode === 0 ? (output || 'Completed') : null,
        error: exitCode !== 0 ? `Process exited with code ${exitCode}` : null,
      };
      writeJsonAtomic(taskPath, fallback);
    } catch (err2) {
      console.error(`[claude-code-provider] Fallback task file write also failed for ${nodeId}: ${err2.message}`);
    }
  }

  /** Resolve the file path for a task within a run. */
  _taskPath(runId, nodeId) {
    return join(TASKS_DIR, runId, `${nodeId}.json`);
  }
}

// Auto-register on import
const provider = new ClaudeCodeProvider();
registerProvider('claude-code', provider);
export { provider as claudeCodeProvider };
