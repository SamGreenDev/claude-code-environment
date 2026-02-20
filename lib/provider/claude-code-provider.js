import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { BaseProvider } from './base-provider.js';
import { registerProvider } from './provider-registry.js';

const TEAMS_DIR = join(homedir(), '.claude', 'teams');
const TASKS_DIR = join(homedir(), '.claude', 'tasks');

const SUPPORTED_AGENT_TYPES = [
  'general-purpose',
  'Bash',
  'Explore',
  'Plan',
  'architect',
  'code-reviewer',
  'security-reviewer',
  'refactor-cleaner',
];

/**
 * Phase 1 provider that integrates with Claude Code's team/task file system.
 * Simulates agent execution by writing team config and task files that
 * Claude Code's agent system can pick up and process.
 */
export class ClaudeCodeProvider extends BaseProvider {
  constructor() {
    super('claude-code');
    this._activeProcesses = new Map(); // agentId → ChildProcess
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
   * Execute a mission node by writing task files into the Claude Code task system.
   * @param {Object} node - Mission node (must have id, label, agentType, prompt, parents, children, siblings)
   * @param {Object} context - Variable context for prompt resolution
   * @param {string} runId - Unique run identifier (used as team/task directory name)
   * @returns {Promise<{ output: string, agentId: string }>}
   */
  async executeNode(node, context, runId) {
    const resolvedPrompt = this._resolvePrompt(node.prompt ?? node.label, context);

    // Write task file for tracking/UI with in_progress status
    this._ensureTeamDir(runId);
    this._writeTaskFile(runId, node, resolvedPrompt);

    // Build CLI args — --verbose is required for stream-json output
    const args = [
      '-p', resolvedPrompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence',
    ];

    if (node.model) args.push('--model', node.model);

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

    const systemCtx = `You are executing node "${node.label}" in a mission. Agent type: ${node.agentType || 'general-purpose'}.`;
    args.push('--append-system-prompt', systemCtx);

    // Spawn with CLAUDECODE unset to allow nested execution
    const child = spawn('claude', args, {
      env: { ...process.env, CLAUDECODE: '' },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    // Close stdin — non-interactive mode doesn't need it, and leaving it open can hang the process
    child.stdin.end();

    const agentId = `${runId}/${node.id}`;
    this._activeProcesses.set(agentId, child);

    // Handle spawn errors (e.g., command not found)
    child.on('error', (err) => {
      this._activeProcesses.delete(agentId);
      const taskPath = this._taskPath(runId, node.id);
      try {
        const task = JSON.parse(readFileSync(taskPath, 'utf8'));
        task.status = 'failed';
        task.error = `Spawn error: ${err.message}`;
        writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');
      } catch { /* best effort */ }
    });

    // Collect output asynchronously — don't await
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
      writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');
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

  /** Parse stream-json output from child process, update task file with progress. */
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

    child.on('close', (code) => {
      this._activeProcesses.delete(agentId);
      const taskPath = this._taskPath(runId, nodeId);
      try {
        const task = JSON.parse(readFileSync(taskPath, 'utf8'));
        if (code === 0) {
          task.status = 'completed';
          task.output = fullOutput || lastText || 'Completed';
        } else {
          task.status = 'failed';
          task.error = `Process exited with code ${code}`;
        }
        writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');
      } catch { /* task file write failure is non-fatal */ }
    });
  }

  /** Update the activeForm field in a task file for live progress display. */
  _updateTaskActiveForm(runId, nodeId, text) {
    const taskPath = this._taskPath(runId, nodeId);
    try {
      const task = JSON.parse(readFileSync(taskPath, 'utf8'));
      task.activeForm = text.slice(0, 100);
      task.status = 'in_progress';
      writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');
    } catch { /* best effort */ }
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
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
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
    writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');
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
