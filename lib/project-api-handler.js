/**
 * Project Server Manager — REST API endpoint handlers
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { sendJson } from './router.js';
import {
  loadProjects,
  addProject,
  updateProject,
  removeProject,
  startProject,
  stopProject,
  getProjectStatuses,
  getProjectStatus,
  getProjectOutput,
} from './project-server-manager.js';

/**
 * Register all project API routes
 * @param {object} router
 */
export function registerProjectRoutes(router) {
  router.get('/api/projects', handleGetProjects);
  router.post('/api/projects', handleAddProject);
  router.put('/api/projects/:id', handleUpdateProject);
  router.delete('/api/projects/:id', handleDeleteProject);
  router.post('/api/projects/:id/start', handleStartProject);
  router.post('/api/projects/:id/stop', handleStopProject);
  router.get('/api/projects/:id/logs', handleGetLogs);
}

/**
 * GET /api/projects
 * List all projects with current runtime status
 */
async function handleGetProjects(req, res) {
  try {
    const projects = await loadProjects();
    const statuses = getProjectStatuses();
    const result = projects.map(p => ({
      ...p,
      status: statuses[p.id]?.status || 'stopped',
      pid: statuses[p.id]?.pid || null,
      startedAt: statuses[p.id]?.startedAt || null,
    }));
    sendJson(res, 200, result);
  } catch (err) {
    console.error('[projects] GET /api/projects error:', err);
    sendJson(res, 500, { error: 'Failed to load projects' });
  }
}

/**
 * POST /api/projects
 * Create a new project config
 * Body: { name, path, command, port?, url? }
 */
async function handleAddProject(req, res) {
  try {
    const { name, path, command, port, url, autoOpen } = req.body || {};

    if (!name || !path || !command) {
      return sendJson(res, 400, { error: 'name, path, and command are required' });
    }

    const project = await addProject({ name, path, command, port, url, autoOpen });
    sendJson(res, 201, project);
  } catch (err) {
    console.error('[projects] POST /api/projects error:', err);
    const status = err.message.includes('not exist') ? 400 : 500;
    sendJson(res, status, { error: err.message });
  }
}

/**
 * PUT /api/projects/:id
 * Update an existing project config (stops process if path/command changed while running)
 * Body: Partial project fields
 */
async function handleUpdateProject(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    // Don't allow id or createdAt to be overwritten
    delete updates.id;
    delete updates.createdAt;

    const project = await updateProject(id, updates);
    sendJson(res, 200, project);
  } catch (err) {
    console.error('[projects] PUT /api/projects/:id error:', err);
    const status = err.message === 'Project not found' ? 404 : 400;
    sendJson(res, status, { error: err.message });
  }
}

/**
 * DELETE /api/projects/:id
 * Remove a project config (stops process if running)
 */
async function handleDeleteProject(req, res) {
  try {
    const { id } = req.params;
    await removeProject(id);
    sendJson(res, 200, { success: true });
  } catch (err) {
    console.error('[projects] DELETE /api/projects/:id error:', err);
    sendJson(res, 500, { error: err.message });
  }
}

/**
 * POST /api/projects/:id/start
 * Spawn the project's server process
 */
async function handleStartProject(req, res) {
  try {
    const { id } = req.params;
    const result = await startProject(id);
    sendJson(res, 200, result);
  } catch (err) {
    console.error('[projects] POST /api/projects/:id/start error:', err);
    const status = err.message.includes('not found') ? 404 : 400;
    sendJson(res, status, { error: err.message });
  }
}

/**
 * POST /api/projects/:id/stop
 * Stop the running server process
 */
async function handleStopProject(req, res) {
  try {
    const { id } = req.params;
    const result = await stopProject(id);
    sendJson(res, 200, result);
  } catch (err) {
    console.error('[projects] POST /api/projects/:id/stop error:', err);
    const status = err.message.includes('not running') ? 400 : 500;
    sendJson(res, status, { error: err.message });
  }
}

/**
 * GET /api/projects/:id/logs
 * Return recent buffered output for a project
 * Query param: ?lines=N (default: all buffered)
 */
async function handleGetLogs(req, res) {
  try {
    const { id } = req.params;
    const lines = req.query?.lines ? parseInt(req.query.lines, 10) : undefined;
    const output = getProjectOutput(id, lines);
    const status = getProjectStatus(id);
    sendJson(res, 200, { output, ...status });
  } catch (err) {
    console.error('[projects] GET /api/projects/:id/logs error:', err);
    sendJson(res, 500, { error: err.message });
  }
}
