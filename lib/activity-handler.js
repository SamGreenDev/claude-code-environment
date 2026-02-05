/**
 * Activity Handler - Agent state management and WebSocket broadcasting
 * For the Jedi Archives visualization dashboard
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { WebSocketServer } from 'ws';
import { sendJson } from './router.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', '.agent-state.json');

// In-memory state for active agents/Jedi
const activeAgents = new Map();

/**
 * Save current state to file for persistence across restarts
 */
function saveState() {
  try {
    const state = {
      agents: Array.from(activeAgents.values()),
      terminals: Array.from(terminalAssignments.entries()),
      savedAt: new Date().toISOString()
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[activity] Failed to save state:', err.message);
  }
}

/**
 * Load state from file on startup
 */
function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const data = JSON.parse(readFileSync(STATE_FILE, 'utf8'));

      // Restore agents that are still "working" (not completed)
      if (data.agents && Array.isArray(data.agents)) {
        for (const agent of data.agents) {
          // Only restore working/walking/spawning agents
          if (['working', 'walking', 'spawning'].includes(agent.status)) {
            activeAgents.set(agent.id, agent);
            console.log(`[activity] Restored agent: ${agent.id} (${agent.type})`);
          }
        }
      }

      // Restore terminal assignments
      if (data.terminals && Array.isArray(data.terminals)) {
        for (const [id, idx] of data.terminals) {
          if (activeAgents.has(id)) {
            terminalAssignments.set(id, idx);
          }
        }
      }

      console.log(`[activity] Loaded ${activeAgents.size} agents from saved state`);
    }
  } catch (err) {
    console.error('[activity] Failed to load state:', err.message);
  }
}

// WebSocket clients
const wsClients = new Set();

// Terminal assignment (0-11 for 12 terminals in 2x6 grid)
const terminalAssignments = new Map();
const MAX_TERMINALS = 12;

// Auto-expiration timeout for stale agents (10 minutes)
const AGENT_MAX_LIFETIME = 10 * 60 * 1000;

// Track agent expiration timers
const expirationTimers = new Map();

// Agent type to Jedi class mapping
const JEDI_CLASS_MAP = {
  'Explore': 'scholar',
  'Plan': 'council',
  'Bash': 'guardian',
  'general-purpose': 'padawan',
  'code-quality-agent': 'sentinel',
  'netsuite-specialist': 'consular',
  'deploy-agent': 'guardian',
  'documentation-agent': 'scholar',
  'bundling-agent': 'padawan',
  'apex-specialist': 'consular',
  'claude-code-guide': 'scholar',
  'statusline-setup': 'padawan',
  'default': 'padawan'
};

// Load persisted state on module initialization
loadState();

/**
 * Get the next available terminal index
 * @returns {number|null} Terminal index 0-11 or null if all occupied
 */
function getNextTerminal() {
  const usedTerminals = new Set(terminalAssignments.values());
  for (let i = 0; i < MAX_TERMINALS; i++) {
    if (!usedTerminals.has(i)) {
      return i;
    }
  }
  return null;
}

/**
 * Broadcast a message to all connected WebSocket clients
 * @param {object} message - Message to broadcast
 */
function broadcast(message) {
  const data = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(data);
      } catch (err) {
        console.error('[activity] Failed to send to client:', err);
      }
    }
  });
}

/**
 * Get Jedi class from agent type
 * @param {string} agentType - The agent type
 * @returns {string} Jedi class name
 */
function getJediClass(agentType) {
  return JEDI_CLASS_MAP[agentType] || JEDI_CLASS_MAP.default;
}

/**
 * Create a new agent/Jedi
 * @param {object} data - Agent data from hook
 * @returns {object} Created agent state
 */
export function spawnAgent(data) {
  const { agentId, agentType, taskDescription, prompt, subagentType } = data;

  // Use provided agentId or generate one
  const id = agentId || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Determine actual agent type (prefer subagentType from Task tool)
  const type = subagentType || agentType || 'general-purpose';

  // Get terminal assignment
  const terminalIndex = getNextTerminal();

  const agent = {
    id,
    type,
    jediClass: getJediClass(type),
    taskDescription: taskDescription || prompt || 'Working on task...',
    status: 'spawning',
    terminalIndex,
    spawnedAt: new Date().toISOString(),
    completedAt: null,
    position: { x: 0, y: 0 } // Will be set by frontend based on terminal
  };

  activeAgents.set(id, agent);
  if (terminalIndex !== null) {
    terminalAssignments.set(id, terminalIndex);
  }

  // Persist state
  saveState();

  // Set auto-expiration timer for stale agents
  const timer = setTimeout(() => {
    if (activeAgents.has(id)) {
      const staleAgent = activeAgents.get(id);
      if (staleAgent.status === 'working' || staleAgent.status === 'spawning' || staleAgent.status === 'walking') {
        console.log(`[activity] Auto-expiring stale agent: ${id}`);
        completeAgent({ agentId: id, status: 'timeout' });
      }
    }
    expirationTimers.delete(id);
  }, AGENT_MAX_LIFETIME);
  expirationTimers.set(id, timer);

  // Broadcast spawn event
  broadcast({
    type: 'agent_spawned',
    agent
  });

  // Transition to walking after a brief delay
  setTimeout(() => {
    if (activeAgents.has(id)) {
      const a = activeAgents.get(id);
      a.status = 'walking';
      activeAgents.set(id, a);
      broadcast({ type: 'agent_updated', agent: a });

      // Transition to working after walk animation
      setTimeout(() => {
        if (activeAgents.has(id)) {
          const a2 = activeAgents.get(id);
          a2.status = 'working';
          activeAgents.set(id, a2);
          broadcast({ type: 'agent_updated', agent: a2 });
        }
      }, 2000); // Walk animation duration
    }
  }, 100);

  console.log(`[activity] Agent spawned: ${id} (${type}) at terminal ${terminalIndex}`);
  return agent;
}

/**
 * Update agent task description (from PreToolUse[Task] hook)
 * @param {object} data - Task data
 */
export function updateAgentTask(data) {
  const { agentId, taskDescription, prompt, description, subagentType } = data;

  if (agentId && activeAgents.has(agentId)) {
    const agent = activeAgents.get(agentId);
    agent.taskDescription = taskDescription || prompt || description || agent.taskDescription;
    if (subagentType) {
      agent.type = subagentType;
      agent.jediClass = getJediClass(subagentType);
    }
    activeAgents.set(agentId, agent);

    broadcast({
      type: 'agent_updated',
      agent
    });

    console.log(`[activity] Agent task updated: ${agentId}`);
  }
}

/**
 * Mark an agent as completed
 * @param {object} data - Completion data
 * @returns {object|null} Completed agent state
 */
export function completeAgent(data) {
  const { agentId, status } = data;

  if (!agentId || !activeAgents.has(agentId)) {
    console.log(`[activity] Agent not found for completion: ${agentId}`);
    return null;
  }

  // Clear expiration timer
  if (expirationTimers.has(agentId)) {
    clearTimeout(expirationTimers.get(agentId));
    expirationTimers.delete(agentId);
  }

  const agent = activeAgents.get(agentId);
  agent.status = 'completing';
  agent.completedAt = new Date().toISOString();
  agent.completionStatus = status || 'success';
  activeAgents.set(agentId, agent);

  broadcast({
    type: 'agent_completing',
    agent
  });

  // Persist state (agent marked as completing)
  saveState();

  // Transition to leaving after completion animation
  setTimeout(() => {
    if (activeAgents.has(agentId)) {
      const a = activeAgents.get(agentId);
      a.status = 'leaving';
      activeAgents.set(agentId, a);
      broadcast({ type: 'agent_updated', agent: a });

      // Remove after leave animation
      setTimeout(() => {
        activeAgents.delete(agentId);
        terminalAssignments.delete(agentId);
        saveState(); // Persist after removal
        broadcast({
          type: 'agent_removed',
          agentId
        });
        console.log(`[activity] Agent removed: ${agentId}`);
      }, 2000); // Leave animation duration
    }
  }, 1500); // Completion animation duration

  console.log(`[activity] Agent completing: ${agentId}`);
  return agent;
}

/**
 * Get all active agents
 * @returns {Array} Array of agent states
 */
export function getActiveAgents() {
  return Array.from(activeAgents.values());
}

/**
 * Get agent by ID
 * @param {string} agentId - Agent ID
 * @returns {object|null} Agent state or null
 */
export function getAgent(agentId) {
  return activeAgents.get(agentId) || null;
}

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server instance
 */
export function initWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    console.log('[activity] WebSocket client connected');
    wsClients.add(ws);

    // Send current state to new client
    ws.send(JSON.stringify({
      type: 'init',
      agents: getActiveAgents()
    }));

    ws.on('close', () => {
      console.log('[activity] WebSocket client disconnected');
      wsClients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[activity] WebSocket error:', err);
      wsClients.delete(ws);
    });
  });

  // Handle upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/ws/activity') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  console.log('[activity] WebSocket server initialized at /ws/activity');
  return wss;
}

// ============================================================
// API Handlers
// ============================================================

/**
 * POST /api/activity/spawn
 * Called by SubagentStart hook
 */
export async function handleSpawn(req, res) {
  try {
    const agent = spawnAgent(req.body);
    sendJson(res, 200, { success: true, agent });
  } catch (error) {
    console.error('[activity] Spawn error:', error);
    sendJson(res, 500, { error: 'Failed to spawn agent' });
  }
}

/**
 * POST /api/activity/task
 * Called by PreToolUse[Task] hook to update task description
 */
export async function handleTask(req, res) {
  try {
    updateAgentTask(req.body);
    sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('[activity] Task update error:', error);
    sendJson(res, 500, { error: 'Failed to update task' });
  }
}

/**
 * POST /api/activity/complete
 * Called by SubagentStop hook
 */
export async function handleComplete(req, res) {
  try {
    const agent = completeAgent(req.body);
    if (agent) {
      sendJson(res, 200, { success: true, agent });
    } else {
      sendJson(res, 404, { error: 'Agent not found' });
    }
  } catch (error) {
    console.error('[activity] Complete error:', error);
    sendJson(res, 500, { error: 'Failed to complete agent' });
  }
}

/**
 * GET /api/activity/agents
 * Get all active agents
 */
export async function handleGetAgents(req, res) {
  try {
    const agents = getActiveAgents();
    sendJson(res, 200, { agents });
  } catch (error) {
    console.error('[activity] Get agents error:', error);
    sendJson(res, 500, { error: 'Failed to get agents' });
  }
}

/**
 * GET /api/activity/agents/:id
 * Get specific agent
 */
export async function handleGetAgent(req, res) {
  try {
    const agent = getAgent(req.params.id);
    if (agent) {
      sendJson(res, 200, { agent });
    } else {
      sendJson(res, 404, { error: 'Agent not found' });
    }
  } catch (error) {
    console.error('[activity] Get agent error:', error);
    sendJson(res, 500, { error: 'Failed to get agent' });
  }
}

/**
 * DELETE /api/activity/agents/:id
 * Remove specific agent
 */
export async function handleDeleteAgent(req, res) {
  try {
    const id = req.params.id;
    if (activeAgents.has(id)) {
      // Clear expiration timer
      if (expirationTimers.has(id)) {
        clearTimeout(expirationTimers.get(id));
        expirationTimers.delete(id);
      }

      activeAgents.delete(id);
      terminalAssignments.delete(id);
      broadcast({ type: 'agent_removed', agentId: id });
      console.log(`[activity] Agent deleted: ${id}`);
      sendJson(res, 200, { success: true });
    } else {
      sendJson(res, 404, { error: 'Agent not found' });
    }
  } catch (error) {
    console.error('[activity] Delete agent error:', error);
    sendJson(res, 500, { error: 'Failed to delete agent' });
  }
}

/**
 * DELETE /api/activity/agents
 * Clear all agents
 */
export async function handleClearAgents(req, res) {
  try {
    // Clear all expiration timers
    expirationTimers.forEach(timer => clearTimeout(timer));
    expirationTimers.clear();

    const count = activeAgents.size;
    activeAgents.clear();
    terminalAssignments.clear();
    saveState(); // Persist cleared state
    broadcast({ type: 'agents_cleared' });
    console.log(`[activity] Cleared ${count} agents`);
    sendJson(res, 200, { success: true, cleared: count });
  } catch (error) {
    console.error('[activity] Clear agents error:', error);
    sendJson(res, 500, { error: 'Failed to clear agents' });
  }
}

/**
 * Register activity routes with the router
 * @param {object} router - Router instance
 */
export function registerActivityRoutes(router) {
  router.post('/api/activity/spawn', handleSpawn);
  router.post('/api/activity/task', handleTask);
  router.post('/api/activity/complete', handleComplete);
  router.get('/api/activity/agents', handleGetAgents);
  router.get('/api/activity/agents/:id', handleGetAgent);
  router.delete('/api/activity/agents/:id', handleDeleteAgent);
  router.delete('/api/activity/agents', handleClearAgents);
}

export default {
  spawnAgent,
  updateAgentTask,
  completeAgent,
  getActiveAgents,
  getAgent,
  initWebSocket,
  registerActivityRoutes,
  handleDeleteAgent,
  handleClearAgents
};
