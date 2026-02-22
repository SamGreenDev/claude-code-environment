/**
 * Mission state schema definitions, atomic write helpers, and progress query.
 *
 * Centralizes:
 *  - Node and run lifecycle status constants (single source of truth)
 *  - Atomic JSON writes (write-to-temp + rename) to prevent partial-write corruption
 *  - getProgress() — structured mission run summary for callers and API consumers
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';
import { RUNS_DIR } from './paths.js';
import { sanitizeId } from './router.js';

// ─── Status Enums ─────────────────────────────────────────────────────────────

/**
 * Node lifecycle statuses — ordered from initial to terminal.
 *
 *  PENDING   → SPAWNING  → RUNNING  → COMPLETED  (success path)
 *                                   → FAILED     (error path)
 *                                   → TIMEOUT    (timeout path)
 *           ↓ (on any failure)
 *           RETRYING → <restarts from SPAWNING>
 */
export const NODE_STATUS = Object.freeze({
  PENDING:   'pending',
  SPAWNING:  'spawning',
  RUNNING:   'running',
  RETRYING:  'retrying',
  COMPLETED: 'completed',
  FAILED:    'failed',
  TIMEOUT:   'timeout',
});

/** Run-level lifecycle statuses. */
export const RUN_STATUS = Object.freeze({
  RUNNING:   'running',
  COMPLETED: 'completed',
  FAILED:    'failed',
  ABORTED:   'aborted',
});

/** Terminal node statuses — no further transitions expected. */
export const TERMINAL_NODE_STATUSES = new Set([
  NODE_STATUS.COMPLETED,
  NODE_STATUS.FAILED,
  NODE_STATUS.TIMEOUT,
]);

/** Active node statuses — process is live or being spawned. */
export const ACTIVE_NODE_STATUSES = new Set([
  NODE_STATUS.SPAWNING,
  NODE_STATUS.RUNNING,
]);

// ─── Atomic Write ─────────────────────────────────────────────────────────────

/**
 * Write JSON to a file atomically using a temp-file-then-rename strategy.
 * Prevents partial writes from corrupting state files if the process crashes
 * mid-write. The rename() syscall is atomic on all POSIX filesystems.
 *
 * @param {string} filePath - Destination file path (created if it doesn't exist)
 * @param {unknown} data    - Value to serialize as JSON
 * @throws If writing the temp file or the rename fails
 */
export function writeJsonAtomic(filePath, data) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp-${randomBytes(4).toString('hex')}`;
  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tmpPath, filePath);
  } catch (err) {
    try { unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
    throw err;
  }
}

// ─── Progress Query ───────────────────────────────────────────────────────────

/**
 * Return a structured progress summary for a mission run.
 * Safe to call at any point during execution — reads directly from disk.
 *
 * @param {string} runId
 * @returns {{
 *   runId: string,
 *   missionId: string,
 *   status: string,
 *   startedAt: string|null,
 *   completedAt: string|null,
 *   error: string|null,
 *   workdir: string|null,
 *   progressPercent: number,
 *   counts: Record<string, number>,
 *   nodes: Array<{
 *     nodeId: string,
 *     status: string,
 *     startedAt: string|null,
 *     completedAt: string|null,
 *     durationMs: number|null,
 *     error: string|null,
 *     retryCount: number,
 *     hasOutput: boolean,
 *     fileCount: number,
 *   }>,
 * } | null} null if the run record does not exist
 */
export function getProgress(runId) {
  const filePath = join(RUNS_DIR, `${sanitizeId(runId)}.json`);
  let run;
  try {
    run = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }

  const nodeStates = run.nodeStates || {};
  const nodes = Object.entries(nodeStates).map(([nodeId, state]) => {
    const startMs = state.startedAt ? new Date(state.startedAt).getTime() : null;
    const endMs = state.completedAt ? new Date(state.completedAt).getTime() : null;
    return {
      nodeId,
      status: state.status || NODE_STATUS.PENDING,
      startedAt: state.startedAt || null,
      completedAt: state.completedAt || null,
      durationMs: (startMs && endMs) ? endMs - startMs : null,
      error: state.error || null,
      retryCount: state.retryCount || 0,
      hasOutput: Boolean(state.output),
      fileCount: Array.isArray(state.files) ? state.files.length : 0,
    };
  });

  // Build per-status counts
  const counts = Object.values(NODE_STATUS).reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {});
  for (const n of nodes) {
    if (n.status in counts) counts[n.status]++;
  }
  counts.total = nodes.length;

  const progressPercent = counts.total > 0
    ? Math.round((counts.completed / counts.total) * 100)
    : 0;

  return {
    runId: run.id,
    missionId: run.missionId,
    status: run.status,
    startedAt: run.startedAt || null,
    completedAt: run.completedAt || null,
    error: run.error || null,
    workdir: run.workdir || null,
    progressPercent,
    counts,
    nodes,
  };
}
