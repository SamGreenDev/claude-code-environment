import { EventEmitter } from 'events';
import { existsSync, readdirSync, mkdirSync, readFileSync } from 'fs';
import { join, resolve, relative } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import * as store from './mission-store.js';
import { getProvider } from './provider/provider-registry.js';
import './provider/claude-code-provider.js'; // Auto-registers 'claude-code' provider
import { TASKS_DIR, safeReadJson } from './paths.js';
import { NODE_STATUS, RUN_STATUS, ACTIVE_NODE_STATUSES, getProgress, writeJsonAtomic } from './mission-state.js';

const POLL_INTERVAL = 2000; // 2 seconds

class MissionEngine extends EventEmitter {
  constructor() {
    super();
    this.activePolls = new Map(); // runId → intervalId
    this._preSnapshots = new Map(); // `${runId}/${nodeId}` → Set<relativePath>
    this._polling = new Set(); // runIds currently inside pollRun — prevents tick overlap
  }

  /**
   * Start a mission run for the given missionId.
   * @param {string} missionId
   * @param {object} contextOverrides
   * @returns {object} run record
   */
  async startMission(missionId, contextOverrides = {}) {
    const mission = await store.getMission(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    // Merge context overrides
    const resolvedContext = { ...mission.context, ...contextOverrides };

    // Resolve workdir to absolute path
    if (resolvedContext.workdir) {
      let wd = resolvedContext.workdir;
      if (wd.startsWith('~')) wd = join(homedir(), wd.slice(1));
      wd = resolve(wd);
      resolvedContext.workdir = wd;
      try { mkdirSync(wd, { recursive: true }); } catch { /* best effort */ }
    }

    // Create run record
    const run = await store.createRun(missionId);
    const runId = run.id;

    // Store workdir on run record
    if (resolvedContext.workdir) {
      await store.updateRun(runId, { workdir: resolvedContext.workdir });
    }

    // Validate DAG — throws on cycle
    this.topologicalSort(mission.nodes, mission.edges);

    // Find root nodes (no incoming edges)
    const nodesWithIncoming = new Set((mission.edges || []).map(e => e.to));
    const rootNodes = mission.nodes.filter(n => !nodesWithIncoming.has(n.id));

    if (rootNodes.length === 0 && mission.nodes.length > 0) {
      throw new Error('Mission graph has no root nodes — possible cycle or disconnected graph');
    }

    // Initialize team config with all members before any task files are written
    const providerName = mission.nodes[0]?.provider || 'claude-code';
    try {
      const provider = getProvider(providerName);
      if (typeof provider.initializeTeam === 'function') {
        await provider.initializeTeam(runId, mission);
      }
    } catch {
      // Non-fatal — team config is a best-effort enhancement
    }

    // Start polling before scheduling so we don't miss fast completions
    this._startPolling(runId, mission);

    // Schedule all root nodes
    for (const node of rootNodes) {
      await this.scheduleNode(runId, node, mission, resolvedContext);
    }

    this.emit('run_started', { runId, missionId });

    return run;
  }

  /**
   * Kahn's algorithm topological sort.
   * @param {Array} nodes
   * @param {Array} edges
   * @returns {string[]} ordered node IDs
   */
  topologicalSort(nodes = [], edges = []) {
    const inDegree = new Map();
    const adjList = new Map();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }

    for (const edge of edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      if (!adjList.has(edge.from)) adjList.set(edge.from, []);
      adjList.get(edge.from).push(edge.to);
    }

    const queue = [];
    for (const [nodeId, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(nodeId);
    }

    const sorted = [];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      sorted.push(nodeId);
      for (const neighbor of (adjList.get(nodeId) || [])) {
        const newDeg = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Cycle detected in mission graph');
    }

    return sorted;
  }

  /**
   * Recursively walk a directory and return a Set of relative file paths.
   * Skips dotfiles/dirs and node_modules. Returns null if >10,000 files.
   */
  _snapshotDir(dir) {
    if (!dir || !existsSync(dir)) return new Set();
    const files = new Set();
    const LIMIT = 10000;

    const walk = (current) => {
      if (files.size > LIMIT) return;
      let entries;
      try { entries = readdirSync(current, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          files.add(relative(dir, fullPath));
        }
        if (files.size > LIMIT) return;
      }
    };

    walk(dir);
    return files.size > LIMIT ? null : files;
  }

  /**
   * Schedule a node for execution.
   *
   * State transitions performed here:
   *   PENDING → SPAWNING (provider.executeNode is called)
   *   SPAWNING → RUNNING (process confirmed started)
   *   SPAWNING/RUNNING → RETRYING → (restart)
   *   SPAWNING/RUNNING → FAILED (retries exhausted)
   */
  async scheduleNode(runId, node, mission, resolvedContext) {
    // Transition: PENDING → SPAWNING
    await store.updateNodeState(runId, node.id, { status: NODE_STATUS.SPAWNING });
    this.emit('node_scheduled', { runId, nodeId: node.id });

    // Take pre-snapshot of workdir for file tracking
    const workdir = resolvedContext.workdir;
    const preSnapshot = workdir ? this._snapshotDir(workdir) : null;

    // Get the current run record to resolve outputs from completed nodes
    const run = await store.getRun(runId);

    // Resolve template variables in prompt
    const resolvedPrompt = this.resolvePrompt(
      node.prompt || '',
      resolvedContext,
      run
    );

    const providerName = node.provider || 'claude-code';
    let provider;
    try {
      provider = getProvider(providerName);
    } catch (err) {
      const errMsg = `Provider not found: ${providerName}`;
      console.error(`[mission-engine] ${errMsg} for node ${node.id} in run ${runId}`);
      await store.updateNodeState(runId, node.id, {
        status: NODE_STATUS.FAILED,
        error: errMsg,
        completedAt: new Date().toISOString(),
      });
      this.emit('node_failed', { runId, nodeId: node.id, error: err });
      return;
    }

    // Record spawn start time — used for timeout detection
    await store.updateNodeState(runId, node.id, {
      startedAt: new Date().toISOString(),
    });

    // Compute DAG relationships for this node
    const rels = this._computeNodeRelationships(node.id, mission.nodes || [], mission.edges || []);

    let agentId;
    try {
      const result = await provider.executeNode(
        { ...node, prompt: resolvedPrompt, parents: rels.parents, children: rels.children, siblings: rels.siblings },
        resolvedContext,
        runId
      );
      agentId = result?.agentId;
    } catch (err) {
      // Spawn failed — record it explicitly (never silently swallow)
      console.error(`[mission-engine] Spawn error for node "${node.id}" in run ${runId}: ${err.message}`);

      const nodeConfig = node.config || {};
      const maxRetries = nodeConfig.retries ?? 1;
      const updatedRun = await store.getRun(runId);
      const nodeState = updatedRun?.nodeStates?.[node.id] || {};
      const retryCount = nodeState.retryCount || 0;

      if (retryCount < maxRetries) {
        await store.updateNodeState(runId, node.id, {
          status: NODE_STATUS.RETRYING,
          retryCount: retryCount + 1,
          error: err.message,
        });
        this.emit('node_retrying', { runId, nodeId: node.id, retryCount: retryCount + 1 });
        await this.scheduleNode(runId, node, mission, resolvedContext);
      } else {
        await store.updateNodeState(runId, node.id, {
          status: NODE_STATUS.FAILED,
          error: err.message,
          completedAt: new Date().toISOString(),
        });
        this.emit('node_failed', { runId, nodeId: node.id, error: err });
        await this.checkRunCompletion(runId, mission);
      }
      return;
    }

    // Transition: SPAWNING → RUNNING (process confirmed started)
    await store.updateNodeState(runId, node.id, {
      status: NODE_STATUS.RUNNING,
      agentId: agentId || null,
      provider: providerName,
    });

    // Store pre-snapshot for file diff on completion
    if (preSnapshot) {
      this._preSnapshots.set(`${runId}/${node.id}`, preSnapshot);
    }

    this.emit('node_started', { runId, nodeId: node.id, agentId });
  }

  /**
   * Poll a run — reads task files and processes state transitions.
   */
  async pollRun(runId, mission) {
    // Guard against concurrent invocations — if the previous tick is still
    // running (pollRun took >POLL_INTERVAL), skip this tick entirely to
    // prevent read-modify-write corruption.
    if (this._polling.has(runId)) return;
    this._polling.add(runId);

    try {
    let run;
    try {
      run = await store.getRun(runId);
    } catch {
      return;
    }

    if (!run || ['completed', 'failed', 'aborted'].includes(run.status)) {
      this._stopPolling(runId);
      return;
    }

    const nodeStates = run.nodeStates || {};
    const edges = mission.edges || [];
    const nodes = mission.nodes || [];

    for (const node of nodes) {
      const state = nodeStates[node.id];
      // Poll both RUNNING and SPAWNING states — SPAWNING orphans need timeout detection too
      if (!state || !ACTIVE_NODE_STATUSES.has(state.status)) continue;

      // Look for the task file for this node
      const taskFilePath = join(TASKS_DIR, runId, `${node.id}.json`);
      const taskData = safeReadJson(taskFilePath);

      if (!taskData) {
        // No task file — check if the process is still alive.
        // If not, the close handler failed to write the task file (orphan node).
        const agentId = state.agentId || `${runId}/${node.id}`;
        const providerName = node.provider || 'claude-code';
        try {
          const provider = getProvider(providerName);
          if (typeof provider.isProcessAlive === 'function' && !provider.isProcessAlive(agentId)) {
            // Process exited but task file was never written/updated
            const elapsed = state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0;
            if (elapsed > 30000) { // Only after 30s to avoid race with initial task file write
              console.error(`[mission-engine] Orphan detected: node ${node.id} has no task file and no active process after ${(elapsed / 1000).toFixed(0)}s`);
              this._preSnapshots.delete(`${runId}/${node.id}`);
              await store.updateNodeState(runId, node.id, {
                status: NODE_STATUS.FAILED,
                error: 'Agent process exited without updating task file (orphan)',
                completedAt: new Date().toISOString(),
              });
              this.emit('node_failed', { runId, nodeId: node.id, error: 'Orphan process' });
              await this.checkRunCompletion(runId, mission);
            }
          }
        } catch { /* provider lookup failure is non-fatal */ }
        continue;
      }

      const taskStatus = taskData.status;

      if (taskStatus === 'completed') {
        const output = taskData.output ?? taskData.result ?? null;

        // File change tracking: post-snapshot diff
        let newFiles = [];
        const snapshotKey = `${runId}/${node.id}`;
        const preSnap = this._preSnapshots.get(snapshotKey);
        if (preSnap) {
          const currentRun = await store.getRun(runId);
          const workdir = currentRun?.workdir;
          if (workdir) {
            const postSnap = this._snapshotDir(workdir);
            if (postSnap) {
              for (const f of postSnap) {
                if (!preSnap.has(f)) newFiles.push(f);
              }
            }
          }
          this._preSnapshots.delete(snapshotKey);
        }

        await store.updateNodeState(runId, node.id, {
          status: NODE_STATUS.COMPLETED,
          output,
          completedAt: new Date().toISOString(),
          files: newFiles,
        });

        if (taskData.message) {
          await store.addRunMessage(runId, {
            nodeId: node.id,
            role: 'assistant',
            content: taskData.message,
          });
          this.emit('message_logged', {
            runId,
            nodeId: node.id,
            level: 'OUTPUT',
            message: taskData.message,
          });
        }

        this.emit('node_completed', { runId, nodeId: node.id, output, files: newFiles });

        // Re-fetch run after update for fresh nodeStates
        const updatedRun = await store.getRun(runId);
        const updatedNodeStates = updatedRun?.nodeStates || {};

        // Check downstream nodes
        const downstreamIds = this.getDownstreamNodes(node.id, edges);
        for (const downstreamId of downstreamIds) {
          if (this.areAllInputsCompleted(downstreamId, edges, updatedNodeStates)) {
            const downstreamNode = nodes.find(n => n.id === downstreamId);
            if (downstreamNode && updatedNodeStates[downstreamId]?.status === NODE_STATUS.PENDING) {
              const resolvedContext = { ...mission.context };
              await this.scheduleNode(runId, downstreamNode, mission, resolvedContext);
            }
          }
        }

        await this.checkRunCompletion(runId, mission);

      } else if (taskStatus === 'failed' || taskStatus === 'error') {
        const nodeConfig = node.config || {};
        const maxRetries = nodeConfig.retries ?? 1;
        const retryCount = state.retryCount || 0;
        const errMsg = taskData.error || 'Task failed';
        console.error(`[mission-engine] Node "${node.id}" reported failure in run ${runId}: ${errMsg}`);

        if (retryCount < maxRetries) {
          await store.updateNodeState(runId, node.id, {
            status: NODE_STATUS.RETRYING,
            retryCount: retryCount + 1,
            error: errMsg,
          });
          this.emit('node_retrying', { runId, nodeId: node.id, retryCount: retryCount + 1 });

          const resolvedContext = { ...mission.context };
          await this.scheduleNode(runId, node, mission, resolvedContext);
        } else {
          this._preSnapshots.delete(`${runId}/${node.id}`);
          await store.updateNodeState(runId, node.id, {
            status: NODE_STATUS.FAILED,
            error: errMsg,
            completedAt: new Date().toISOString(),
          });
          this.emit('node_failed', { runId, nodeId: node.id, error: errMsg });
          await this.checkRunCompletion(runId, mission);
        }

      } else {
        // In-progress — surface UI updates and check for orphans/timeouts

        // Detect task file status transitions (e.g. pending → in_progress)
        const lastTaskStatus = state._lastTaskFileStatus;
        if (taskStatus && taskStatus !== lastTaskStatus) {
          await store.updateNodeState(runId, node.id, { _lastTaskFileStatus: taskStatus });
          if (taskStatus === 'in_progress') {
            this.emit('message_logged', {
              runId,
              nodeId: node.id,
              level: 'INFO',
              message: 'Agent picked up task',
            });
          }
        }

        // Surface activeForm progress updates
        if (taskData.activeForm && taskData.activeForm !== state._lastActiveForm) {
          await store.updateNodeState(runId, node.id, { _lastActiveForm: taskData.activeForm });
          this.emit('message_logged', {
            runId,
            nodeId: node.id,
            level: 'INFO',
            message: taskData.activeForm,
          });
        }

        // Surface new messages from the task file
        const messageCount = Array.isArray(taskData.messages) ? taskData.messages.length : 0;
        const lastMsgCount = state._lastMsgCount || 0;
        if (messageCount > lastMsgCount) {
          await store.updateNodeState(runId, node.id, { _lastMsgCount: messageCount });
          for (let i = lastMsgCount; i < messageCount; i++) {
            const m = taskData.messages[i];
            if (m && m.content) {
              this.emit('message_logged', {
                runId,
                nodeId: node.id,
                level: 'OUTPUT',
                message: String(m.content).slice(0, 200),
              });
            }
          }
        }

        // Check for orphaned process: task file still in_progress but process has exited
        const agentId = state.agentId || `${runId}/${node.id}`;
        const providerName = node.provider || 'claude-code';
        try {
          const provider = getProvider(providerName);
          if (typeof provider.isProcessAlive === 'function' && !provider.isProcessAlive(agentId)) {
            const elapsed = state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0;
            if (elapsed > 30000) { // Grace period for slow task file writes
              console.error(`[mission-engine] Orphan detected: node ${node.id} stuck at "${taskStatus}" but process is dead after ${(elapsed / 1000).toFixed(0)}s`);
              await store.updateNodeState(runId, node.id, {
                status: NODE_STATUS.FAILED,
                error: 'Agent process exited without completing (orphan detected)',
                completedAt: new Date().toISOString(),
              });
              this._preSnapshots.delete(`${runId}/${node.id}`);
              this.emit('node_failed', { runId, nodeId: node.id, error: 'Orphan process' });
              await this.checkRunCompletion(runId, mission);
              continue; // Skip timeout check — already handled
            }
          }
        } catch { /* provider lookup failure is non-fatal */ }

        // Timeout detection: mark as TIMEOUT (distinct from FAILED), kill the process first
        const nodeConfig = node.config || {};
        const timeoutSec = nodeConfig.timeout ?? null;
        if (timeoutSec && state.startedAt) {
          const elapsed = Date.now() - new Date(state.startedAt).getTime();
          if (elapsed > timeoutSec * 1000) {
            const maxRetries = nodeConfig.retries ?? 1;
            const retryCount = state.retryCount || 0;

            // Kill the process before transitioning — prevents the close handler from
            // racing with us and writing a completion to the task file
            try {
              const provider = getProvider(node.provider || 'claude-code');
              if (typeof provider.abortNode === 'function') {
                await provider.abortNode(node.id, runId);
              }
            } catch (killErr) {
              console.error(`[mission-engine] Failed to kill timed-out node ${node.id}: ${killErr.message}`);
            }

            console.error(`[mission-engine] Timeout: node "${node.id}" exceeded ${timeoutSec}s in run ${runId} (elapsed ${(elapsed / 1000).toFixed(1)}s)`);

            if (retryCount < maxRetries) {
              await store.updateNodeState(runId, node.id, {
                status: NODE_STATUS.RETRYING,
                retryCount: retryCount + 1,
                error: `Timed out after ${timeoutSec}s`,
              });
              this.emit('node_retrying', { runId, nodeId: node.id, retryCount: retryCount + 1 });

              const resolvedContext = { ...mission.context };
              await this.scheduleNode(runId, node, mission, resolvedContext);
            } else {
              await store.updateNodeState(runId, node.id, {
                status: NODE_STATUS.TIMEOUT,
                error: `Timed out after ${timeoutSec}s`,
                completedAt: new Date().toISOString(),
              });
              this._preSnapshots.delete(`${runId}/${node.id}`);
              this.emit('node_timeout', { runId, nodeId: node.id, timeoutSec });
              await this.checkRunCompletion(runId, mission);
            }
          }
        }
      }
    }
    } finally {
      this._polling.delete(runId);
    }
  }

  /**
   * Check whether the entire run is complete or failed.
   */
  async checkRunCompletion(runId, mission) {
    const run = await store.getRun(runId);
    if (!run || [RUN_STATUS.COMPLETED, RUN_STATUS.FAILED, RUN_STATUS.ABORTED].includes(run.status)) return;

    const nodeStates = run.nodeStates || {};
    const nodes = mission.nodes || [];
    const edges = mission.edges || [];

    const allCompleted = nodes.every(n => nodeStates[n.id]?.status === NODE_STATUS.COMPLETED);
    if (allCompleted) {
      const summary = this._generateRunSummary(run, mission);
      await store.updateRunSummary(runId, summary);
      await store.updateRun(runId, {
        status: RUN_STATUS.COMPLETED,
        completedAt: new Date().toISOString(),
      });
      this._stopPolling(runId);
      this.emit('run_completed', { runId, summary });
      this._cleanupRunDirs(runId);
      return;
    }

    // Check if any failed or timed-out node blocks all remaining paths
    const blockingStatuses = [NODE_STATUS.FAILED, NODE_STATUS.TIMEOUT];
    const blockingNodes = nodes.filter(n => blockingStatuses.includes(nodeStates[n.id]?.status));
    for (const failedNode of blockingNodes) {
      if (this._blocksRemainingNodes(failedNode.id, nodes, edges, nodeStates)) {
        const errMsg = `Node "${failedNode.label || failedNode.id}" ${nodeStates[failedNode.id]?.status} and blocks remaining execution`;
        await store.updateRun(runId, {
          status: RUN_STATUS.FAILED,
          completedAt: new Date().toISOString(),
          error: errMsg,
        });
        this._stopPolling(runId);
        this.emit('run_failed', { runId, failedNodeId: failedNode.id, error: errMsg });
        this._cleanupRunDirs(runId);
        return;
      }
    }
  }

  /**
   * Abort a running mission run.
   */
  async abortMission(runId) {
    const run = await store.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    const nodeStates = run.nodeStates || {};
    const runningNodes = Object.entries(nodeStates)
      .filter(([, state]) => ACTIVE_NODE_STATUSES.has(state.status))
      .map(([nodeId]) => nodeId);

    for (const nodeId of runningNodes) {
      const state = nodeStates[nodeId];
      const providerName = state.provider || 'claude-code';
      try {
        const provider = getProvider(providerName);
        if (typeof provider.abortNode === 'function') {
          await provider.abortNode(nodeId, runId);
        }
      } catch {
        // Best-effort abort; continue with others
      }
    }

    // Mark all non-completed nodes as failed
    const allNodeIds = Object.keys(nodeStates);
    for (const nodeId of allNodeIds) {
      const st = nodeStates[nodeId]?.status;
      if (st && st !== NODE_STATUS.COMPLETED) {
        await store.updateNodeState(runId, nodeId, {
          status: NODE_STATUS.FAILED,
          error: 'Run aborted',
          completedAt: new Date().toISOString(),
        });
      }
    }

    await store.updateRun(runId, {
      status: RUN_STATUS.ABORTED,
      completedAt: new Date().toISOString(),
    });

    this._stopPolling(runId);
    this.emit('run_aborted', { runId });
    this._cleanupRunDirs(runId);
  }

  /**
   * Retry a failed node in a run.
   */
  async retryNode(runId, nodeId) {
    const run = await store.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    // Look up mission definition from the run's missionId so callers
    // don't need to pass it — makes the function self-contained
    const mission = store.getMission(run.missionId);
    if (!mission) throw new Error(`Mission definition not found: ${run.missionId}`);

    const nodeState = run.nodeStates?.[nodeId];
    const retriableStatuses = [NODE_STATUS.FAILED, NODE_STATUS.TIMEOUT];
    if (!nodeState || !retriableStatuses.includes(nodeState.status)) {
      throw new Error(`Node ${nodeId} is not in a retriable state (must be 'failed' or 'timeout')`);
    }

    const node = mission.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node definition not found: ${nodeId}`);

    await store.updateNodeState(runId, nodeId, {
      status: NODE_STATUS.PENDING,
      retryCount: (nodeState.retryCount || 0) + 1,
      error: null,
      startedAt: null,
      completedAt: null,
      output: null,
    });

    // Reset downstream failed/timeout nodes to pending so they re-trigger when
    // this node completes — the poll loop only schedules 'pending' nodes
    const edges = mission.edges || [];
    const downstreamFailed = this._getReachableFailed(nodeId, edges, run.nodeStates || {});
    for (const dsId of downstreamFailed) {
      await store.updateNodeState(runId, dsId, {
        status: NODE_STATUS.PENDING,
        error: null,
        startedAt: null,
        completedAt: null,
        output: null,
      });
    }

    // Restart polling if run was failed or aborted
    const restartableStatuses = [RUN_STATUS.FAILED, RUN_STATUS.ABORTED];
    if (restartableStatuses.includes(run.status)) {
      await store.updateRun(runId, { status: RUN_STATUS.RUNNING, completedAt: null, error: null });
      this._startPolling(runId, mission);
    }

    const resolvedContext = { ...mission.context };
    await this.scheduleNode(runId, node, mission, resolvedContext);
  }

  /**
   * Get currently active (polling) run IDs.
   * @returns {Map}
   */
  getActiveRuns() {
    return new Map(this.activePolls);
  }

  /**
   * Return a structured progress summary for a mission run.
   * Delegates to mission-state.getProgress() — safe to call at any time.
   *
   * @param {string} runId
   * @returns {object|null} null if the run record does not exist
   */
  getProgress(runId) {
    return getProgress(runId);
  }

  /**
   * Relay a message between two nodes in a run.
   * Validates both nodes exist, writes to the target's task file, stores in run log, and emits event.
   * @param {string} runId
   * @param {string} from - Source node ID
   * @param {string} to - Target node ID
   * @param {string} content - Message content
   * @returns {Promise<Object>} The stored message object
   */
  async relayMessage(runId, from, to, content) {
    const run = await store.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    // Validate both nodes exist in the run
    if (!run.nodeStates[from]) throw new Error(`Source node not found in run: ${from}`);
    if (!run.nodeStates[to]) throw new Error(`Target node not found in run: ${to}`);

    const message = {
      id: `msg-${randomUUID()}`,
      from,
      to,
      content,
      timestamp: new Date().toISOString(),
    };

    // Append message to target's task file
    const taskFilePath = join(TASKS_DIR, runId, `${to}.json`);
    if (existsSync(taskFilePath)) {
      try {
        const taskData = JSON.parse(readFileSync(taskFilePath, 'utf8'));
        if (!Array.isArray(taskData.messages)) taskData.messages = [];
        taskData.messages.push(message);
        writeJsonAtomic(taskFilePath, taskData);
      } catch {
        // Best-effort — task file write is non-fatal
      }
    }

    // Store in run record
    await store.addRunMessage(runId, message);

    // Emit for WebSocket broadcast
    this.emit('message_relayed', { runId, message });

    return message;
  }

  /**
   * Compute parent, child, and sibling relationships for a node in the DAG.
   * @param {string} nodeId
   * @param {Array} nodes - All mission nodes
   * @param {Array} edges - All mission edges
   * @returns {{ parents: Array, children: Array, siblings: Array }}
   */
  _computeNodeRelationships(nodeId, nodes, edges) {
    const parentIds = edges.filter(e => e.to === nodeId).map(e => e.from);
    const childIds = edges.filter(e => e.from === nodeId).map(e => e.to);

    // Siblings: nodes sharing a parent with this node (excluding self, parents, children)
    const siblingIdSet = new Set();
    for (const parentId of parentIds) {
      for (const edge of edges) {
        if (edge.from === parentId && edge.to !== nodeId) {
          siblingIdSet.add(edge.to);
        }
      }
    }
    // Also: nodes sharing a child with this node
    for (const childId of childIds) {
      for (const edge of edges) {
        if (edge.to === childId && edge.from !== nodeId) {
          siblingIdSet.add(edge.from);
        }
      }
    }
    // Remove parents and children from siblings
    for (const id of parentIds) siblingIdSet.delete(id);
    for (const id of childIds) siblingIdSet.delete(id);

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const toRef = id => {
      const n = nodeMap.get(id);
      return n ? { id: n.id, label: n.label } : { id, label: id };
    };

    return {
      parents: parentIds.map(toRef),
      children: childIds.map(toRef),
      siblings: Array.from(siblingIdSet).map(toRef),
    };
  }

  // ─── Template Resolution ────────────────────────────────────────────────────

  resolvePrompt(template, context, runRecord) {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      if (key.startsWith('context.')) {
        const contextKey = key.slice(8);
        return context[contextKey] !== undefined ? String(context[contextKey]) : match;
      }

      const dotIdx = key.indexOf('.');
      if (dotIdx !== -1) {
        const nodeId = key.slice(0, dotIdx);
        const field = key.slice(dotIdx + 1);
        if (field === 'output' && runRecord?.nodeStates?.[nodeId]) {
          const output = runRecord.nodeStates[nodeId].output;
          return output !== undefined && output !== null ? String(output) : match;
        }
      }

      return match;
    });
  }

  // ─── Graph Utilities ────────────────────────────────────────────────────────

  getDownstreamNodes(nodeId, edges) {
    return edges.filter(e => e.from === nodeId).map(e => e.to);
  }

  /**
   * BFS from a node to find all downstream nodes that are in a terminal non-completed status.
   */
  _getReachableFailed(nodeId, edges, nodeStates) {
    const result = [];
    const visited = new Set();
    const queue = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge.from === current && !visited.has(edge.to)) {
          visited.add(edge.to);
          const status = nodeStates[edge.to]?.status;
          if (status === NODE_STATUS.FAILED || status === NODE_STATUS.TIMEOUT) {
            result.push(edge.to);
          }
          queue.push(edge.to);
        }
      }
    }

    return result;
  }

  areAllInputsCompleted(nodeId, edges, nodeStates) {
    const incomingEdges = edges.filter(e => e.to === nodeId);
    return incomingEdges.every(e => nodeStates[e.from]?.status === NODE_STATUS.COMPLETED);
  }

  /**
   * Generate a run summary aggregating all node files and setup hints.
   */
  _generateRunSummary(run, mission) {
    const nodeStates = run.nodeStates || {};
    const nodes = mission.nodes || [];
    const allFiles = [];
    const nodeFileMap = {};

    for (const node of nodes) {
      const state = nodeStates[node.id];
      const files = state?.files || [];
      if (files.length) {
        nodeFileMap[node.label || node.id] = files;
        allFiles.push(...files);
      }
    }

    // Detect setup hints
    const setupHints = [];
    if (allFiles.includes('package.json')) setupHints.push('npm install');
    if (allFiles.includes('requirements.txt')) setupHints.push('pip install -r requirements.txt');
    if (allFiles.includes('Gemfile')) setupHints.push('bundle install');
    if (allFiles.includes('go.mod')) setupHints.push('go mod download');
    if (allFiles.some(f => f === 'server.js' || f === 'index.js')) setupHints.push('node server.js');

    // Build file tree (simplified)
    const dirs = new Set();
    for (const f of allFiles) {
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/') + '/');
      }
    }

    return {
      totalFiles: allFiles.length,
      workdir: run.workdir || null,
      files: allFiles.slice(0, 100), // cap at 100
      nodeFileMap,
      setupHints,
      dirs: Array.from(dirs).sort(),
      completedAt: new Date().toISOString(),
      nodesCompleted: nodes.filter(n => nodeStates[n.id]?.status === 'completed').length,
      nodesTotal: nodes.length,
    };
  }

  /**
   * Determine if a failed node blocks any remaining (non-completed) nodes
   * by checking reachability through the DAG.
   */
  _blocksRemainingNodes(failedNodeId, nodes, edges, nodeStates) {
    const reachable = new Set();
    const queue = [failedNodeId];

    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge.from === current && !reachable.has(edge.to)) {
          reachable.add(edge.to);
          queue.push(edge.to);
        }
      }
    }

    for (const nodeId of reachable) {
      const st = nodeStates[nodeId]?.status;
      if (!st || !['completed', 'retrying', 'spawning', 'running'].includes(st)) {
        return true;
      }
    }

    return false;
  }

  // ─── Run Cleanup ───────────────────────────────────────────────────────────

  /**
   * Remove team/task directories for a finished run.
   * This triggers team-watcher to complete all tracked agents on its next poll.
   */
  _cleanupRunDirs(runId) {
    try {
      const provider = getProvider('claude-code');
      if (typeof provider.cleanupRun === 'function') {
        provider.cleanupRun(runId);
      }
    } catch {
      // Non-fatal — cleanup is best-effort
    }
  }

  // ─── Polling Lifecycle ──────────────────────────────────────────────────────

  _startPolling(runId, mission) {
    if (this.activePolls.has(runId)) return;

    const intervalId = setInterval(async () => {
      try {
        await this.pollRun(runId, mission);
      } catch (err) {
        this.emit('error', { runId, error: err });
      }
    }, POLL_INTERVAL);

    this.activePolls.set(runId, intervalId);
  }

  _stopPolling(runId) {
    const intervalId = this.activePolls.get(runId);
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      this.activePolls.delete(runId);
    }
    // Also clear any in-flight guard so a stopped run doesn't block future
    // polling if the same runId is ever restarted.
    this._polling.delete(runId);
  }

  /**
   * Resume polling for any runs that are still marked as 'running' in the store.
   * Called on server startup to recover from restarts — orphan detection will
   * catch any nodes whose processes died while the server was down.
   */
  resumeActiveRuns() {
    const runs = store.listRuns();
    let resumed = 0;
    for (const run of runs) {
      if (run.status !== 'running') continue;
      const mission = store.getMission(run.missionId);
      if (!mission) {
        console.error(`[mission-engine] Cannot resume run ${run.id}: mission ${run.missionId} not found`);
        continue;
      }
      if (!this.activePolls.has(run.id)) {
        console.log(`[mission-engine] Resuming polling for run ${run.id}`);
        this._startPolling(run.id, mission);
        resumed++;
        // Re-schedule any nodes stuck in RETRYING state after a server restart
        const nodeStates = run.nodeStates || {};
        for (const node of mission.nodes || []) {
          if (nodeStates[node.id]?.status === NODE_STATUS.RETRYING) {
            console.log(`[mission-engine] Re-scheduling retrying node ${node.id} in run ${run.id}`);
            const resolvedContext = { ...mission.context };
            this.scheduleNode(run.id, node, mission, resolvedContext).catch(err => {
              console.error(`[mission-engine] Failed to re-schedule retrying node ${node.id}: ${err.message}`);
            });
          }
        }
      }
    }
    if (resumed > 0) {
      console.log(`[mission-engine] Resumed ${resumed} active run(s)`);
    }
  }
}

export const missionEngine = new MissionEngine();
