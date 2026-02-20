/**
 * API endpoint handlers for the Environment UI
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { sendJson } from './router.js';
import { getClaudeDir, getSettings, getClaudeMd, getEnvironmentOverview, getHooks, getHooksGroupedBySource, getSettingsWithSchema, getProjectPath, setProjectPath, getProjectSettings, updateProjectSettings, isClaudeProject, getProjectHooks, getProjectEnvVars, toggleUserHook, togglePluginHook, toggleProjectHook, updateProjectEnvVar, deleteEnvVar, deleteProjectEnvVar, bulkToggleHookGroup } from './config-reader.js';
import { getAgents, getSkills, getCommands, getRules } from './agent-parser.js';
import { getProjects, getProjectMemory, getMemoryStats, searchMemory } from './memory-reader.js';
import { getPlugins, getPluginCount } from './plugin-reader.js';
import { getMCPServers, getMCPStats } from './mcp-reader.js';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { spawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = getClaudeDir();

/**
 * GET /api/health
 */
export async function handleHealth(req, res) {
  sendJson(res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    claudeDir: CLAUDE_DIR
  });
}

/**
 * GET /api/overview
 */
export async function handleOverview(req, res) {
  try {
    const overview = await getEnvironmentOverview();
    sendJson(res, 200, { overview });
  } catch (error) {
    console.error('Error getting overview:', error);
    sendJson(res, 500, { error: 'Failed to get overview' });
  }
}

/**
 * GET /api/settings
 */
export async function handleGetSettings(req, res) {
  try {
    const { values, schema } = await getSettingsWithSchema();
    sendJson(res, 200, { settings: values, schema });
  } catch (error) {
    console.error('Error getting settings:', error);
    sendJson(res, 500, { error: 'Failed to get settings' });
  }
}

/**
 * PUT /api/settings
 */
export async function handleUpdateSettings(req, res) {
  try {
    const currentSettings = await getSettings();
    const newSettings = { ...currentSettings, ...req.body };

    await writeFile(
      join(CLAUDE_DIR, 'settings.json'),
      JSON.stringify(newSettings, null, 2),
      'utf-8'
    );

    sendJson(res, 200, { success: true, settings: newSettings });
  } catch (error) {
    console.error('Error updating settings:', error);
    sendJson(res, 500, { error: 'Failed to update settings' });
  }
}

/**
 * GET /api/claude-md
 */
export async function handleGetClaudeMd(req, res) {
  try {
    const claudeMd = await getClaudeMd();
    sendJson(res, 200, { claudeMd });
  } catch (error) {
    console.error('Error getting CLAUDE.md:', error);
    sendJson(res, 500, { error: 'Failed to get CLAUDE.md' });
  }
}

/**
 * GET /api/agents
 */
export async function handleGetAgents(req, res) {
  try {
    const agents = await getAgents();
    sendJson(res, 200, { agents });
  } catch (error) {
    console.error('Error getting agents:', error);
    sendJson(res, 500, { error: 'Failed to get agents' });
  }
}

/**
 * GET /api/agents/:id
 */
export async function handleGetAgent(req, res) {
  try {
    const agents = await getAgents();
    const agent = agents.find(a => a.id === req.params.id);

    if (!agent) {
      sendJson(res, 404, { error: 'Agent not found' });
      return;
    }

    sendJson(res, 200, { agent });
  } catch (error) {
    console.error('Error getting agent:', error);
    sendJson(res, 500, { error: 'Failed to get agent' });
  }
}

/**
 * GET /api/skills
 */
export async function handleGetSkills(req, res) {
  try {
    const skills = await getSkills();
    sendJson(res, 200, { skills });
  } catch (error) {
    console.error('Error getting skills:', error);
    sendJson(res, 500, { error: 'Failed to get skills' });
  }
}

/**
 * GET /api/skills/:id
 */
export async function handleGetSkill(req, res) {
  try {
    const skills = await getSkills();
    const skill = skills.find(s => s.id === req.params.id);

    if (!skill) {
      sendJson(res, 404, { error: 'Skill not found' });
      return;
    }

    sendJson(res, 200, { skill });
  } catch (error) {
    console.error('Error getting skill:', error);
    sendJson(res, 500, { error: 'Failed to get skill' });
  }
}

/**
 * GET /api/commands
 */
export async function handleGetCommands(req, res) {
  try {
    const commands = await getCommands();
    sendJson(res, 200, { commands });
  } catch (error) {
    console.error('Error getting commands:', error);
    sendJson(res, 500, { error: 'Failed to get commands' });
  }
}

/**
 * GET /api/rules
 */
export async function handleGetRules(req, res) {
  try {
    const rules = await getRules();
    sendJson(res, 200, { rules });
  } catch (error) {
    console.error('Error getting rules:', error);
    sendJson(res, 500, { error: 'Failed to get rules' });
  }
}

/**
 * GET /api/hooks
 * Supports ?grouped=true to return hooks grouped by source
 */
export async function handleGetHooks(req, res) {
  try {
    if (req.query?.grouped === 'true') {
      const grouped = await getHooksGroupedBySource();
      sendJson(res, 200, grouped);
      return;
    }

    const hooks = await getHooks();
    sendJson(res, 200, { hooks });
  } catch (error) {
    console.error('Error getting hooks:', error);
    sendJson(res, 500, { error: 'Failed to get hooks' });
  }
}

/**
 * PUT /api/hooks/:id/toggle
 * Handles both user hooks (e.g., "PreToolUse.0.1") and plugin hooks (e.g., "plugin:environment:SessionStart.0.0")
 */
export async function handleToggleHook(req, res) {
  try {
    const { id } = req.params;

    // Route to appropriate toggle function based on hook ID prefix
    const result = id.startsWith('plugin:')
      ? await togglePluginHook(id)
      : await toggleUserHook(id);

    sendJson(res, 200, result);
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('format')) {
      sendJson(res, 400, { error: error.message });
    } else if (error.message.includes('not found')) {
      sendJson(res, 404, { error: error.message });
    } else {
      console.error('Error toggling hook:', error);
      sendJson(res, 500, { error: 'Failed to toggle hook' });
    }
  }
}

/**
 * PUT /api/settings/env/:key
 */
export async function handleUpdateEnvVar(req, res) {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      sendJson(res, 400, { error: 'Value is required' });
      return;
    }

    const settings = await getSettings();
    settings.env = settings.env || {};
    settings.env[key] = value;

    await writeFile(
      join(CLAUDE_DIR, 'settings.json'),
      JSON.stringify(settings, null, 2),
      'utf-8'
    );

    sendJson(res, 200, { success: true, key, value });
  } catch (error) {
    console.error('Error updating env var:', error);
    sendJson(res, 500, { error: 'Failed to update environment variable' });
  }
}

/**
 * GET /api/memory
 */
export async function handleGetMemory(req, res) {
  try {
    const [projects, stats] = await Promise.all([
      getProjects(),
      getMemoryStats()
    ]);
    sendJson(res, 200, { projects, stats });
  } catch (error) {
    console.error('Error getting memory:', error);
    sendJson(res, 500, { error: 'Failed to get memory' });
  }
}

/**
 * GET /api/memory/project/:id
 */
export async function handleGetProjectMemory(req, res) {
  try {
    const { id } = req.params;
    const files = await getProjectMemory(decodeURIComponent(id));
    sendJson(res, 200, { files });
  } catch (error) {
    console.error('Error getting project memory:', error);
    sendJson(res, 500, { error: 'Failed to get project memory' });
  }
}

/**
 * GET /api/memory/search
 */
export async function handleSearchMemory(req, res) {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      sendJson(res, 400, { error: 'Search query must be at least 2 characters' });
      return;
    }

    const results = await searchMemory(q);
    sendJson(res, 200, { results });
  } catch (error) {
    console.error('Error searching memory:', error);
    sendJson(res, 500, { error: 'Failed to search memory' });
  }
}

/**
 * GET /api/project
 */
export async function handleGetProject(req, res) {
  try {
    const projectPath = getProjectPath();
    const isProject = projectPath ? await isClaudeProject(projectPath) : false;

    sendJson(res, 200, {
      path: projectPath,
      isClaudeProject: isProject
    });
  } catch (error) {
    console.error('Error getting project:', error);
    sendJson(res, 500, { error: 'Failed to get project' });
  }
}

/**
 * PUT /api/project
 */
export async function handleSetProject(req, res) {
  try {
    const { path } = req.body;

    // Empty path means "clear project"
    if (!path) {
      setProjectPath(null);
      sendJson(res, 200, { success: true, path: null });
      return;
    }

    // Expand tilde to home directory (Node.js fs doesn't do this)
    const resolvedPath = path.startsWith('~/') ? join(homedir(), path.slice(2))
      : path === '~' ? homedir()
      : path;

    // Verify path exists
    try {
      await stat(resolvedPath);
    } catch {
      sendJson(res, 400, { error: 'Path does not exist' });
      return;
    }

    setProjectPath(resolvedPath);
    const isProject = await isClaudeProject(resolvedPath);

    sendJson(res, 200, {
      success: true,
      path: resolvedPath,
      isClaudeProject: isProject
    });
  } catch (error) {
    console.error('Error setting project:', error);
    sendJson(res, 500, { error: 'Failed to set project' });
  }
}

/**
 * GET /api/project/settings
 */
export async function handleGetProjectSettings(req, res) {
  try {
    const projectPath = getProjectPath();
    const settings = await getProjectSettings(projectPath);
    sendJson(res, 200, settings);
  } catch (error) {
    console.error('Error getting project settings:', error);
    sendJson(res, 500, { error: 'Failed to get project settings' });
  }
}

/**
 * PUT /api/project/settings
 */
export async function handleUpdateProjectSettings(req, res) {
  try {
    const projectPath = getProjectPath();
    const { settings, isLocal } = req.body;

    if (!projectPath) {
      sendJson(res, 400, { error: 'No project path set' });
      return;
    }

    await updateProjectSettings(projectPath, settings, isLocal);
    sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('Error updating project settings:', error);
    sendJson(res, 500, { error: 'Failed to update project settings' });
  }
}

/**
 * GET /api/project/hooks
 */
export async function handleGetProjectHooks(req, res) {
  try {
    const projectPath = getProjectPath();
    if (!projectPath) {
      sendJson(res, 200, { hooks: [] });
      return;
    }

    const hooks = await getProjectHooks(projectPath);
    sendJson(res, 200, { hooks });
  } catch (error) {
    console.error('Error getting project hooks:', error);
    sendJson(res, 500, { error: 'Failed to get project hooks' });
  }
}

/**
 * PUT /api/project/hooks/:id/toggle
 */
export async function handleToggleProjectHook(req, res) {
  try {
    const projectPath = getProjectPath();
    if (!projectPath) {
      sendJson(res, 400, { error: 'No project path set' });
      return;
    }

    const { id } = req.params;
    const { isLocal } = req.body || {};

    const result = await toggleProjectHook(projectPath, id, isLocal);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Error toggling project hook:', error);
    sendJson(res, 500, { error: 'Failed to toggle project hook' });
  }
}

/**
 * GET /api/project/env
 */
export async function handleGetProjectEnvVars(req, res) {
  try {
    const projectPath = getProjectPath();
    if (!projectPath) {
      sendJson(res, 200, { env: {}, localEnv: {} });
      return;
    }

    const envVars = await getProjectEnvVars(projectPath);
    sendJson(res, 200, envVars);
  } catch (error) {
    console.error('Error getting project env vars:', error);
    sendJson(res, 500, { error: 'Failed to get project environment variables' });
  }
}

/**
 * PUT /api/project/env/:key
 */
export async function handleUpdateProjectEnvVar(req, res) {
  try {
    const projectPath = getProjectPath();
    if (!projectPath) {
      sendJson(res, 400, { error: 'No project path set' });
      return;
    }

    const { key } = req.params;
    const { value, isLocal } = req.body;

    if (value === undefined) {
      sendJson(res, 400, { error: 'Value is required' });
      return;
    }

    const result = await updateProjectEnvVar(projectPath, key, value, isLocal);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Error updating project env var:', error);
    sendJson(res, 500, { error: 'Failed to update project environment variable' });
  }
}

/**
 * GET /api/plugins
 */
export async function handleGetPlugins(req, res) {
  try {
    const plugins = await getPlugins();
    sendJson(res, 200, { plugins });
  } catch (error) {
    console.error('Error getting plugins:', error);
    sendJson(res, 500, { error: 'Failed to get plugins' });
  }
}

/**
 * GET /api/mcp-servers
 */
export async function handleGetMCPServers(req, res) {
  try {
    const servers = await getMCPServers();
    const stats = await getMCPStats();
    sendJson(res, 200, { servers, stats });
  } catch (error) {
    console.error('Error getting MCP servers:', error);
    sendJson(res, 500, { error: 'Failed to get MCP servers' });
  }
}


/**
 * PUT /api/hooks/group/:type/:id/toggle
 * Bulk toggle all hooks in a group (user or plugin)
 */
export async function handleBulkToggleHookGroup(req, res) {
  try {
    const { type, id } = req.params;
    const { enabled } = req.body || {};

    if (typeof enabled !== 'boolean') {
      sendJson(res, 400, { error: 'enabled (boolean) is required in request body' });
      return;
    }

    if (type !== 'user' && type !== 'plugin') {
      sendJson(res, 400, { error: 'Group type must be "user" or "plugin"' });
      return;
    }

    const result = await bulkToggleHookGroup(type, id, enabled);
    sendJson(res, 200, result);
  } catch (error) {
    if (error.message.includes('No hooks found')) {
      sendJson(res, 404, { error: error.message });
    } else if (error.message.includes('Invalid group type')) {
      sendJson(res, 400, { error: error.message });
    } else {
      console.error('Error bulk toggling hooks:', error);
      sendJson(res, 500, { error: 'Failed to bulk toggle hooks' });
    }
  }
}

/**
 * DELETE /api/settings/env/:key
 */
export async function handleDeleteEnvVar(req, res) {
  try {
    const { key } = req.params;
    const result = await deleteEnvVar(key);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Error deleting env var:', error);
    sendJson(res, 500, { error: 'Failed to delete environment variable' });
  }
}

/**
 * DELETE /api/project/env/:key
 */
export async function handleDeleteProjectEnvVar(req, res) {
  try {
    const projectPath = getProjectPath();
    if (!projectPath) {
      sendJson(res, 400, { error: 'No project path set' });
      return;
    }

    const { key } = req.params;
    const result = await deleteProjectEnvVar(projectPath, key);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Error deleting project env var:', error);
    sendJson(res, 500, { error: 'Failed to delete project environment variable' });
  }
}

/**
 * Register all API routes
 */
export function registerApiRoutes(router) {
  // Health
  router.get('/api/health', handleHealth);

  // Overview
  router.get('/api/overview', handleOverview);

  // Settings
  router.get('/api/settings', handleGetSettings);
  router.put('/api/settings', handleUpdateSettings);

  // CLAUDE.md
  router.get('/api/claude-md', handleGetClaudeMd);

  // Agents
  router.get('/api/agents', handleGetAgents);
  router.get('/api/agents/:id', handleGetAgent);

  // Skills
  router.get('/api/skills', handleGetSkills);
  router.get('/api/skills/:id', handleGetSkill);

  // Commands
  router.get('/api/commands', handleGetCommands);

  // Rules
  router.get('/api/rules', handleGetRules);

  // Hooks
  router.get('/api/hooks', handleGetHooks);
  router.put('/api/hooks/group/:type/:id/toggle', handleBulkToggleHookGroup);
  router.put('/api/hooks/:id/toggle', handleToggleHook);

  // Environment variables
  router.put('/api/settings/env/:key', handleUpdateEnvVar);
  router.delete('/api/settings/env/:key', handleDeleteEnvVar);

  // Memory
  router.get('/api/memory', handleGetMemory);
  router.get('/api/memory/search', handleSearchMemory);
  router.get('/api/memory/project/:id', handleGetProjectMemory);

  // Project
  router.get('/api/project', handleGetProject);
  router.put('/api/project', handleSetProject);
  router.get('/api/project/settings', handleGetProjectSettings);
  router.put('/api/project/settings', handleUpdateProjectSettings);
  router.get('/api/project/hooks', handleGetProjectHooks);
  router.put('/api/project/hooks/:id/toggle', handleToggleProjectHook);
  router.get('/api/project/env', handleGetProjectEnvVars);
  router.put('/api/project/env/:key', handleUpdateProjectEnvVar);
  router.delete('/api/project/env/:key', handleDeleteProjectEnvVar);

  // Plugins
  router.get('/api/plugins', handleGetPlugins);

  // MCP Servers
  router.get('/api/mcp-servers', handleGetMCPServers);

}

export default { registerApiRoutes };
