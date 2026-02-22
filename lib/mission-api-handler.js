import { WebSocketServer } from 'ws';
import { sendJson } from './router.js';
import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import {
  listMissions,
  getMission,
  createMission,
  updateMission,
  deleteMission,
  listTemplates,
  saveAsTemplate,
  createRun,
  getRun,
  listRuns,
  updateRun,
  deleteRun,
  getRunMessages,
} from './mission-store.js';
import { missionEngine } from './mission-engine.js';
import { getAvailableProviders } from './provider/provider-registry.js';
import { getActiveAgents, completeAgent } from './activity-handler.js';

// ─── REST Handlers ────────────────────────────────────────────────────────────

async function handleListMissions(req, res) {
  try {
    const data = listMissions();
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error listing missions:', error);
    sendJson(res, 500, { error: 'Failed to list missions' });
  }
}

async function handleCreateMission(req, res) {
  try {
    const data = createMission(req.body);
    sendJson(res, 201, { data });
  } catch (error) {
    console.error('[missions] Error creating mission:', error);
    sendJson(res, 500, { error: 'Failed to create mission' });
  }
}

async function handleListTemplates(req, res) {
  try {
    const data = listTemplates();
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error listing templates:', error);
    sendJson(res, 500, { error: 'Failed to list templates' });
  }
}

async function handleGetMission(req, res) {
  try {
    const data = getMission(req.params.id);
    if (!data) {
      sendJson(res, 404, { error: 'Mission not found' });
      return;
    }
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error getting mission:', error);
    sendJson(res, 500, { error: 'Failed to get mission' });
  }
}

async function handleUpdateMission(req, res) {
  try {
    const data = updateMission(req.params.id, req.body);
    if (!data) {
      sendJson(res, 404, { error: 'Mission not found' });
      return;
    }
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error updating mission:', error);
    sendJson(res, 500, { error: 'Failed to update mission' });
  }
}

async function handleDeleteMission(req, res) {
  try {
    const deleted = deleteMission(req.params.id);
    if (!deleted) {
      sendJson(res, 404, { error: 'Mission not found' });
      return;
    }
    sendJson(res, 200, { data: { deleted: true } });
  } catch (error) {
    console.error('[missions] Error deleting mission:', error);
    sendJson(res, 500, { error: 'Failed to delete mission' });
  }
}

async function handleRunMission(req, res) {
  try {
    const data = await missionEngine.startMission(req.params.id, req.body?.context);
    sendJson(res, 201, { data });
  } catch (error) {
    console.error('[missions] Error running mission:', error);
    sendJson(res, 500, { error: 'Failed to start mission run' });
  }
}

async function handleListRuns(req, res) {
  try {
    const data = listRuns(req.query?.missionId);
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error listing runs:', error);
    sendJson(res, 500, { error: 'Failed to list runs' });
  }
}

async function handleGetRun(req, res) {
  try {
    const data = getRun(req.params.id);
    if (!data) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error getting run:', error);
    sendJson(res, 500, { error: 'Failed to get run' });
  }
}

async function handleAbortRun(req, res) {
  try {
    const data = await missionEngine.abortMission(req.params.id);
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error aborting run:', error);
    sendJson(res, 500, { error: 'Failed to abort run' });
  }
}

async function handleRetryNode(req, res) {
  try {
    const data = await missionEngine.retryNode(req.params.id, req.params.nodeId);
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error retrying node:', error);
    sendJson(res, 500, { error: 'Failed to retry node' });
  }
}

async function handleRelayMessage(req, res) {
  try {
    const { from, to, content } = req.body || {};
    if (!from || !to || !content) {
      sendJson(res, 400, { error: 'Missing required fields: from, to, content' });
      return;
    }
    const message = await missionEngine.relayMessage(req.params.id, from, to, content);
    sendJson(res, 201, { data: message });
  } catch (error) {
    console.error('[missions] Error relaying message:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    sendJson(res, status, { error: error.message || 'Failed to relay message' });
  }
}

async function handleGetRunSummary(req, res) {
  try {
    const run = getRun(req.params.id);
    if (!run) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    sendJson(res, 200, { data: run.summary || null });
  } catch (error) {
    console.error('[missions] Error getting run summary:', error);
    sendJson(res, 500, { error: 'Failed to get run summary' });
  }
}

async function handleGetRunProgress(req, res) {
  try {
    const progress = missionEngine.getProgress(req.params.id);
    if (!progress) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    sendJson(res, 200, { data: progress });
  } catch (error) {
    console.error('[missions] Error getting run progress:', error);
    sendJson(res, 500, { error: 'Failed to get run progress' });
  }
}

async function handleGetRunMessages(req, res) {
  try {
    const messages = getRunMessages(req.params.id);
    sendJson(res, 200, { data: messages });
  } catch (error) {
    console.error('[missions] Error getting run messages:', error);
    sendJson(res, 500, { error: 'Failed to get run messages' });
  }
}

async function handleGetProviders(req, res) {
  try {
    const data = getAvailableProviders();
    sendJson(res, 200, { data });
  } catch (error) {
    console.error('[missions] Error getting providers:', error);
    sendJson(res, 500, { error: 'Failed to get providers' });
  }
}

async function handleSaveAsTemplate(req, res) {
  try {
    const data = saveAsTemplate(req.params.id, req.body?.name);
    sendJson(res, 201, { data });
  } catch (error) {
    console.error('[missions] Error saving as template:', error);
    sendJson(res, 500, { error: 'Failed to save as template' });
  }
}

// ─── Open / Launch Handlers ──────────────────────────────────────────────────

async function handleOpen(req, res) {
  try {
    const { path: targetPath, runId } = req.body || {};
    if (!targetPath) {
      sendJson(res, 400, { error: 'Missing required field: path' });
      return;
    }

    // Must be absolute
    if (!targetPath.startsWith('/')) {
      sendJson(res, 400, { error: 'Path must be absolute' });
      return;
    }
    const resolved = resolve(targetPath);

    // Validate path exists
    if (!existsSync(resolved)) {
      sendJson(res, 404, { error: 'Path not found' });
      return;
    }

    // If runId provided, validate path is inside the run's workdir
    if (runId) {
      const run = getRun(runId);
      if (run && run.summary && run.summary.workdir) {
        const workdir = resolve(run.summary.workdir);
        if (!resolved.startsWith(workdir + '/') && resolved !== workdir) {
          sendJson(res, 403, { error: 'Path is outside the run workdir' });
          return;
        }
      }
    }

    spawn('open', [resolved], { detached: true, stdio: 'ignore' }).unref(); // macOS only
    sendJson(res, 200, { opened: true, path: resolved });
  } catch (error) {
    console.error('[missions] Error opening path:', error);
    sendJson(res, 500, { error: 'Failed to open path' });
  }
}

async function handleLaunchRun(req, res) {
  try {
    const run = getRun(req.params.id);
    if (!run) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }

    const summary = run.summary;
    if (!summary || !summary.setupHints || !summary.setupHints.length) {
      sendJson(res, 400, { error: 'No setup hints available for this run' });
      return;
    }

    const workdir = summary.workdir;
    if (!workdir || !existsSync(workdir)) {
      sendJson(res, 400, { error: 'Run workdir does not exist' });
      return;
    }

    const command = summary.setupHints.join(' && ');
    const child = spawn('sh', ['-c', command], {
      cwd: workdir,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    sendJson(res, 200, { launched: true, command, workdir });
  } catch (error) {
    console.error('[missions] Error launching run:', error);
    sendJson(res, 500, { error: 'Failed to launch run' });
  }
}

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerMissionRoutes(router) {
  // IMPORTANT: Specific routes MUST come before parameterized routes
  router.get('/api/missions/templates', handleListTemplates);
  router.get('/api/missions/runs', handleListRuns);
  router.get('/api/missions/runs/:id', handleGetRun);
  router.get('/api/missions/runs/:id/progress', handleGetRunProgress);
  router.get('/api/missions/runs/:id/summary', handleGetRunSummary);
  router.post('/api/missions/runs/:id/abort', handleAbortRun);
  router.post('/api/missions/runs/:id/messages', handleRelayMessage);
  router.get('/api/missions/runs/:id/messages', handleGetRunMessages);
  router.post('/api/missions/runs/:id/retry/:nodeId', handleRetryNode);
  router.post('/api/missions/runs/:id/launch', handleLaunchRun);

  router.post('/api/open', handleOpen);

  router.get('/api/missions', handleListMissions);
  router.post('/api/missions', handleCreateMission);
  router.get('/api/missions/:id', handleGetMission);
  router.put('/api/missions/:id', handleUpdateMission);
  router.delete('/api/missions/:id', handleDeleteMission);
  router.post('/api/missions/:id/run', handleRunMission);
  router.post('/api/missions/:id/template', handleSaveAsTemplate);

  router.get('/api/providers', handleGetProviders);
}

// ─── WebSocket Setup ──────────────────────────────────────────────────────────

const missionWsClients = new Set();

export function initMissionWebSocket() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    console.log('[missions] WebSocket client connected');
    missionWsClients.add(ws);

    // Send current active runs state
    const activeRuns = missionEngine.getActiveRuns();
    ws.send(JSON.stringify({ type: 'init', activeRuns: Array.from(activeRuns.keys()) }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'abort_run') {
          missionEngine.abortMission(msg.runId)
            .catch(err => console.error('[missions] WS op error:', err));
        } else if (msg.type === 'retry_node') {
          missionEngine.retryNode(msg.runId, msg.nodeId)
            .catch(err => console.error('[missions] WS op error:', err));
        } else if (msg.type === 'relay_message') {
          missionEngine.relayMessage(msg.runId, msg.from, msg.to, msg.content)
            .catch(err => console.error('[missions] WS relay_message error:', err));
        }
      } catch (e) {
        console.error('[missions] WS message error:', e);
      }
    });

    ws.on('close', () => {
      console.log('[missions] WebSocket client disconnected');
      missionWsClients.delete(ws);
    });

    ws.on('error', (err) => { console.error('[missions] WS client error:', err.message); missionWsClients.delete(ws); });
  });

  // Subscribe to engine events and broadcast
  const events = [
    'run_started',
    'node_scheduled',
    'node_started',
    'node_completed',
    'node_failed',
    'node_retrying',
    'run_completed',
    'run_failed',
    'run_aborted',
    'message_logged',
    'message_relayed',
  ];
  for (const event of events) {
    missionEngine.on(event, (data) => {
      broadcastMissionEvent({ type: event, ...data });
    });
  }

  // Clean up activity agents when a mission run ends
  for (const endEvent of ['run_completed', 'run_failed', 'run_aborted']) {
    missionEngine.on(endEvent, (data) => {
      const { runId } = data;
      if (!runId) return;
      const agents = getActiveAgents();
      for (const agent of agents) {
        if (agent.teamName === runId || (agent.id && (agent.id.startsWith(runId + '/') || agent.id.includes(':' + runId + ':')))) {
          completeAgent({ agentId: agent.id, status: endEvent.replace('run_', '') });
        }
      }
    });
  }

  return wss;
}

function broadcastMissionEvent(event) {
  const msg = JSON.stringify(event);
  for (const client of missionWsClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(msg);
    }
  }
}

let missionWss = null;

export function getMissionWss() {
  if (!missionWss) {
    missionWss = initMissionWebSocket();
  }
  return missionWss;
}

export function handleMissionUpgrade(request, socket, head) {
  const wss = getMissionWss();
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
}
