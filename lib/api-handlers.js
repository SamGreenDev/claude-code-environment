/**
 * API endpoint handlers for the Environment UI
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { sendJson } from './router.js';
import { getClaudeDir, getSettings, getClaudeMd, getEnvironmentOverview, getHooks, getSettingsWithSchema, getProjectPath, setProjectPath, getProjectSettings, updateProjectSettings, isClaudeProject, getProjectHooks, getProjectEnvVars, toggleProjectHook, updateProjectEnvVar } from './config-reader.js';
import { getAgents, getSkills, getCommands, getRules } from './agent-parser.js';
import { getQuickRef, getSessionTracker, getIssues, getMemoryStats, getMemoryTimeline, searchMemory } from './memory-reader.js';
import { getPlugins, getPluginCount } from './plugin-reader.js';
import { getMCPServers, getMCPStats } from './mcp-reader.js';
import { getLessons, getLessonById, getLessonsStats, deleteLesson, promoteLesson, searchLessons, incrementHits } from './lessons-reader.js';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

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
 * GET /api/knowledge
 */
export async function handleGetKnowledge(req, res) {
  try {
    const knowledgeDir = join(CLAUDE_DIR, 'knowledge');
    const structure = await buildKnowledgeTree(knowledgeDir);
    sendJson(res, 200, { structure });
  } catch (error) {
    console.error('Error getting knowledge:', error);
    sendJson(res, 500, { error: 'Failed to get knowledge' });
  }
}

/**
 * Build knowledge tree structure
 */
async function buildKnowledgeTree(dirPath, basePath = '') {
  const children = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subChildren = await buildKnowledgeTree(join(dirPath, entry.name), relativePath);
        children.push({
          name: entry.name,
          type: 'directory',
          path: relativePath,
          children: subChildren
        });
      } else if (entry.name.endsWith('.md')) {
        children.push({
          name: entry.name,
          type: 'file',
          path: relativePath
        });
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  return children;
}

/**
 * GET /api/knowledge/search
 */
export async function handleSearchKnowledge(req, res) {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      sendJson(res, 400, { error: 'Search query must be at least 2 characters' });
      return;
    }

    const knowledgeDir = join(CLAUDE_DIR, 'knowledge');
    const results = await searchKnowledgeFiles(knowledgeDir, q.toLowerCase());
    sendJson(res, 200, { results });
  } catch (error) {
    console.error('Error searching knowledge:', error);
    sendJson(res, 500, { error: 'Failed to search knowledge' });
  }
}

/**
 * Search knowledge files recursively
 */
async function searchKnowledgeFiles(dirPath, query, basePath = '', results = []) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await searchKnowledgeFiles(fullPath, query, relativePath, results);
      } else if (entry.name.endsWith('.md')) {
        // Search in filename
        const nameWithoutExt = entry.name.replace('.md', '');
        if (nameWithoutExt.toLowerCase().includes(query)) {
          const pathParts = relativePath.split('/');
          const category = pathParts.length > 1 ? pathParts[0] : '';
          results.push({
            path: relativePath,
            name: nameWithoutExt,
            match: highlightMatch(nameWithoutExt, query),
            category,
            matchType: 'filename'
          });
          continue; // Skip content search if filename matches
        }

        // Search in content
        try {
          const content = await readFile(fullPath, 'utf-8');
          if (content.toLowerCase().includes(query)) {
            const pathParts = relativePath.split('/');
            const category = pathParts.length > 1 ? pathParts[0] : '';
            results.push({
              path: relativePath,
              name: nameWithoutExt,
              match: highlightMatch(extractContext(content, query), query),
              category,
              matchType: 'content'
            });
          }
        } catch (readErr) {
          // Skip files that can't be read
        }
      }
    }
  } catch (err) {
    // Ignore directory read errors
  }

  // Sort: filename matches first, then alphabetically
  results.sort((a, b) => {
    if (a.matchType !== b.matchType) return a.matchType === 'filename' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, 20);
}

/**
 * Extract context around a match
 */
function extractContext(text, query) {
  const index = text.toLowerCase().indexOf(query);
  if (index === -1) return text.slice(0, 100);

  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 40);
  let context = text.slice(start, end);

  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.replace(/\n/g, ' ').trim();
}

/**
 * Highlight match in text
 */
function highlightMatch(text, query) {
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * GET /api/knowledge/file/*
 */
export async function handleGetKnowledgeFile(req, res) {
  try {
    const filePath = req.url.replace('/api/knowledge/file/', '');
    const fullPath = join(CLAUDE_DIR, 'knowledge', decodeURIComponent(filePath));

    // Security check
    if (!fullPath.startsWith(join(CLAUDE_DIR, 'knowledge'))) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    const content = await readFile(fullPath, 'utf-8');
    sendJson(res, 200, { content, path: filePath });
  } catch (error) {
    if (error.code === 'ENOENT') {
      sendJson(res, 404, { error: 'File not found' });
    } else {
      console.error('Error reading knowledge file:', error);
      sendJson(res, 500, { error: 'Failed to read file' });
    }
  }
}

/**
 * GET /api/hooks
 */
export async function handleGetHooks(req, res) {
  try {
    const hooks = await getHooks();
    sendJson(res, 200, { hooks });
  } catch (error) {
    console.error('Error getting hooks:', error);
    sendJson(res, 500, { error: 'Failed to get hooks' });
  }
}

/**
 * PUT /api/hooks/:id/toggle
 */
export async function handleToggleHook(req, res) {
  try {
    const { id } = req.params;
    // ID format: "hookType.configIndex.hookIndex" e.g., "PreToolUse.0.0"
    const parts = id.split('.');
    if (parts.length !== 3) {
      sendJson(res, 400, { error: 'Invalid hook ID format' });
      return;
    }

    const [hookType, configIdxStr, hookIdxStr] = parts;
    const configIdx = parseInt(configIdxStr, 10);
    const hookIdx = parseInt(hookIdxStr, 10);

    const settings = await getSettings();
    const hookConfig = settings.hooks?.[hookType]?.[configIdx];
    const hook = hookConfig?.hooks?.[hookIdx];

    if (!hook) {
      sendJson(res, 404, { error: 'Hook not found' });
      return;
    }

    // Toggle the enabled state
    hook.enabled = !(hook.enabled !== false);

    await writeFile(
      join(CLAUDE_DIR, 'settings.json'),
      JSON.stringify(settings, null, 2),
      'utf-8'
    );

    sendJson(res, 200, { success: true, enabled: hook.enabled });
  } catch (error) {
    console.error('Error toggling hook:', error);
    sendJson(res, 500, { error: 'Failed to toggle hook' });
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
    const stats = await getMemoryStats();
    sendJson(res, 200, { stats });
  } catch (error) {
    console.error('Error getting memory:', error);
    sendJson(res, 500, { error: 'Failed to get memory' });
  }
}

/**
 * GET /api/memory/timeline
 */
export async function handleGetMemoryTimeline(req, res) {
  try {
    const timeline = await getMemoryTimeline();
    sendJson(res, 200, { timeline });
  } catch (error) {
    console.error('Error getting memory timeline:', error);
    sendJson(res, 500, { error: 'Failed to get memory timeline' });
  }
}

/**
 * GET /api/memory/issues
 */
export async function handleGetMemoryIssues(req, res) {
  try {
    const issues = await getIssues();
    sendJson(res, 200, { issues });
  } catch (error) {
    console.error('Error getting issues:', error);
    sendJson(res, 500, { error: 'Failed to get issues' });
  }
}

/**
 * GET /api/memory/quick-ref
 */
export async function handleGetQuickRef(req, res) {
  try {
    const quickRef = await getQuickRef();
    sendJson(res, 200, { quickRef });
  } catch (error) {
    console.error('Error getting quick ref:', error);
    sendJson(res, 500, { error: 'Failed to get quick ref' });
  }
}

/**
 * GET /api/memory/search
 */
export async function handleSearchMemory(req, res) {
  try {
    const { q } = req.query;
    if (!q) {
      sendJson(res, 400, { error: 'Search query is required' });
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

    if (!path) {
      sendJson(res, 400, { error: 'Path is required' });
      return;
    }

    // Verify path exists
    try {
      await stat(path);
    } catch {
      sendJson(res, 400, { error: 'Path does not exist' });
      return;
    }

    setProjectPath(path);
    const isProject = await isClaudeProject(path);

    sendJson(res, 200, {
      success: true,
      path,
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
 * GET /api/lessons
 */
export async function handleGetLessons(req, res) {
  try {
    const { q } = req.query || {};
    let lessons;

    if (q) {
      lessons = await searchLessons(q);
    } else {
      lessons = await getLessons();
    }

    sendJson(res, 200, { lessons });
  } catch (error) {
    console.error('Error getting lessons:', error);
    sendJson(res, 500, { error: 'Failed to get lessons' });
  }
}

/**
 * GET /api/lessons/stats
 */
export async function handleGetLessonsStats(req, res) {
  try {
    const stats = await getLessonsStats();
    sendJson(res, 200, { stats });
  } catch (error) {
    console.error('Error getting lessons stats:', error);
    sendJson(res, 500, { error: 'Failed to get lessons stats' });
  }
}

/**
 * GET /api/lessons/:id
 */
export async function handleGetLesson(req, res) {
  try {
    const { id } = req.params;
    const lesson = await getLessonById(decodeURIComponent(id));

    if (!lesson) {
      sendJson(res, 404, { error: 'Lesson not found' });
      return;
    }

    sendJson(res, 200, { lesson });
  } catch (error) {
    console.error('Error getting lesson:', error);
    sendJson(res, 500, { error: 'Failed to get lesson' });
  }
}

/**
 * DELETE /api/lessons/:id
 */
export async function handleDeleteLesson(req, res) {
  try {
    const { id } = req.params;
    await deleteLesson(decodeURIComponent(id));
    sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    if (error.message === 'Lesson not found') {
      sendJson(res, 404, { error: 'Lesson not found' });
    } else {
      sendJson(res, 500, { error: 'Failed to delete lesson' });
    }
  }
}

/**
 * POST /api/lessons/:id/promote
 */
export async function handlePromoteLesson(req, res) {
  try {
    const { id } = req.params;
    const result = await promoteLesson(decodeURIComponent(id));
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Error promoting lesson:', error);
    if (error.message === 'Lesson not found') {
      sendJson(res, 404, { error: 'Lesson not found' });
    } else {
      sendJson(res, 500, { error: 'Failed to promote lesson' });
    }
  }
}

/**
 * POST /api/lessons/:id/hit
 */
export async function handleIncrementLessonHits(req, res) {
  try {
    const { id } = req.params;
    const result = await incrementHits(decodeURIComponent(id));
    sendJson(res, 200, result);
  } catch (error) {
    console.error('Error incrementing lesson hits:', error);
    sendJson(res, 500, { error: 'Failed to increment hits' });
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

  // Knowledge
  router.get('/api/knowledge', handleGetKnowledge);
  router.get('/api/knowledge/search', handleSearchKnowledge);
  router.get('/api/knowledge/file/*', handleGetKnowledgeFile);

  // Hooks
  router.get('/api/hooks', handleGetHooks);
  router.put('/api/hooks/:id/toggle', handleToggleHook);

  // Environment variables
  router.put('/api/settings/env/:key', handleUpdateEnvVar);

  // Memory
  router.get('/api/memory', handleGetMemory);
  router.get('/api/memory/timeline', handleGetMemoryTimeline);
  router.get('/api/memory/issues', handleGetMemoryIssues);
  router.get('/api/memory/quick-ref', handleGetQuickRef);
  router.get('/api/memory/search', handleSearchMemory);

  // Project
  router.get('/api/project', handleGetProject);
  router.put('/api/project', handleSetProject);
  router.get('/api/project/settings', handleGetProjectSettings);
  router.put('/api/project/settings', handleUpdateProjectSettings);
  router.get('/api/project/hooks', handleGetProjectHooks);
  router.put('/api/project/hooks/:id/toggle', handleToggleProjectHook);
  router.get('/api/project/env', handleGetProjectEnvVars);
  router.put('/api/project/env/:key', handleUpdateProjectEnvVar);

  // Plugins
  router.get('/api/plugins', handleGetPlugins);

  // MCP Servers
  router.get('/api/mcp-servers', handleGetMCPServers);

  // Lessons
  router.get('/api/lessons', handleGetLessons);
  router.get('/api/lessons/stats', handleGetLessonsStats);
  router.get('/api/lessons/:id', handleGetLesson);
  router.delete('/api/lessons/:id', handleDeleteLesson);
  router.post('/api/lessons/:id/promote', handlePromoteLesson);
  router.post('/api/lessons/:id/hit', handleIncrementLessonHits);
}

export default { registerApiRoutes };
