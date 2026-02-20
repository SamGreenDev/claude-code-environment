import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

const MISSIONS_DIR = join(homedir(), '.claude', 'missions');
const DEFS_DIR = join(MISSIONS_DIR, 'defs');
const RUNS_DIR = join(MISSIONS_DIR, 'runs');
const TEMPLATES_DIR = join(MISSIONS_DIR, 'templates');

function ensureDirs() {
  for (const dir of [DEFS_DIR, RUNS_DIR, TEMPLATES_DIR]) {
    mkdirSync(dir, { recursive: true });
  }
}

function safeReadJson(filePath) {
  try { return JSON.parse(readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function listJsonFiles(dir) {
  ensureDirs();
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => safeReadJson(join(dir, f)))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Mission Definitions ─────────────────────────────────────────────────────

/** Migrate legacy droidClass → unitClass on node arrays */
function migrateNodes(nodes) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (node.droidClass && !node.unitClass) {
      node.unitClass = node.droidClass;
    }
  }
}

export function listMissions() {
  const missions = listJsonFiles(DEFS_DIR);
  for (const m of missions) migrateNodes(m.nodes);
  return missions;
}

export function getMission(id) {
  ensureDirs();
  const mission = safeReadJson(join(DEFS_DIR, `${id}.json`));
  if (mission) migrateNodes(mission.nodes);
  return mission;
}

export function createMission(data) {
  ensureDirs();
  const now = new Date().toISOString();
  const mission = {
    nodes: [],
    edges: [],
    context: {},
    description: '',
    ...data,
    id: `mission-${randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };
  writeJson(join(DEFS_DIR, `${mission.id}.json`), mission);
  return mission;
}

export function updateMission(id, data) {
  ensureDirs();
  const existing = getMission(id);
  if (!existing) return null;
  const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
  writeJson(join(DEFS_DIR, `${id}.json`), updated);
  return updated;
}

export function deleteMission(id) {
  ensureDirs();
  const filePath = join(DEFS_DIR, `${id}.json`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function listTemplates() {
  return listJsonFiles(TEMPLATES_DIR);
}

export function getTemplate(id) {
  ensureDirs();
  return safeReadJson(join(TEMPLATES_DIR, `${id}.json`));
}

export function saveAsTemplate(missionId, templateName) {
  ensureDirs();
  const mission = getMission(missionId);
  if (!mission) return null;
  const now = new Date().toISOString();
  const template = {
    ...mission,
    id: `template-${randomUUID()}`,
    name: templateName,
    isTemplate: true,
    createdAt: now,
    updatedAt: now,
  };
  writeJson(join(TEMPLATES_DIR, `${template.id}.json`), template);
  return template;
}

// ─── Run Records ──────────────────────────────────────────────────────────────

export function createRun(missionId) {
  ensureDirs();
  const mission = getMission(missionId);
  if (!mission) return null;
  const nodeStates = {};
  for (const node of (mission.nodes || [])) {
    nodeStates[node.id] = {
      status: 'pending',
      startedAt: null,
      completedAt: null,
      output: null,
      error: null,
      agentId: null,
      retryCount: 0,
      files: [],
    };
  }
  const run = {
    id: `run-${randomUUID()}`,
    missionId,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    workdir: null,
    summary: null,
    nodeStates,
    messages: [],
  };
  writeJson(join(RUNS_DIR, `${run.id}.json`), run);
  return run;
}

export function getRun(id) {
  ensureDirs();
  return safeReadJson(join(RUNS_DIR, `${id}.json`));
}

export function listRuns(missionId) {
  const runs = listJsonFiles(RUNS_DIR);
  if (!missionId) return runs;
  return runs.filter(r => r.missionId === missionId);
}

export function updateRun(id, data) {
  ensureDirs();
  const existing = getRun(id);
  if (!existing) return null;
  const updated = { ...existing, ...data, id };
  writeJson(join(RUNS_DIR, `${id}.json`), updated);
  return updated;
}

export function updateNodeState(runId, nodeId, stateUpdate) {
  ensureDirs();
  const run = getRun(runId);
  if (!run) return null;
  run.nodeStates[nodeId] = { ...(run.nodeStates[nodeId] || {}), ...stateUpdate };
  writeJson(join(RUNS_DIR, `${runId}.json`), run);
  return run;
}

export function addRunMessage(runId, message) {
  ensureDirs();
  const run = getRun(runId);
  if (!run) return null;
  run.messages.push({ timestamp: new Date().toISOString(), ...message });
  writeJson(join(RUNS_DIR, `${runId}.json`), run);
  return run;
}

export function getRunMessages(runId) {
  ensureDirs();
  const run = getRun(runId);
  if (!run) return [];
  return run.messages || [];
}

export function updateRunSummary(runId, summary) {
  ensureDirs();
  const run = getRun(runId);
  if (!run) return null;
  run.summary = summary;
  writeJson(join(RUNS_DIR, `${runId}.json`), run);
  return run;
}

export function deleteRun(id) {
  ensureDirs();
  const filePath = join(RUNS_DIR, `${id}.json`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}
