/**
 * Configuration reader for Claude Code environment
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { getPluginCount, getPluginHooks } from './plugin-reader.js';
import { getMCPServerCount } from './mcp-reader.js';
import { getAgents, getSkills, getCommands } from './agent-parser.js';

const CLAUDE_DIR = join(homedir(), '.claude');

/**
 * Check if a directory exists
 */
async function directoryExists(path) {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// Store current project path (can be set via API)
let currentProjectPath = null;
const UI_STATE_FILE = join(CLAUDE_DIR, '.env-ui-state.json');

// Load persisted state on module init
async function loadPersistedState() {
  try {
    const content = await readFile(UI_STATE_FILE, 'utf-8');
    const state = JSON.parse(content);
    if (state.projectPath) {
      // Verify the path still exists before restoring
      const s = await stat(state.projectPath).catch(() => null);
      if (s?.isDirectory()) {
        currentProjectPath = state.projectPath;
      }
    }
  } catch {
    // No state file or invalid — that's fine
  }
}

async function persistState() {
  try {
    await writeFile(UI_STATE_FILE, JSON.stringify({ projectPath: currentProjectPath }, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist UI state:', error.message);
  }
}

// Fire and forget — don't block module loading
loadPersistedState();

// Simple write lock to prevent concurrent settings.json modifications
const writeLocks = new Map();

async function withWriteLock(filePath, fn) {
  while (writeLocks.get(filePath)) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  writeLocks.set(filePath, true);
  try {
    return await fn();
  } finally {
    writeLocks.delete(filePath);
  }
}

/**
 * Settings schema for dynamic UI rendering
 */
export const SETTINGS_SCHEMA = {
  env: {
    AUTO_DOCUMENT: {
      type: 'boolean',
      label: 'Auto Documentation',
      description: 'Generate docs on commit'
    },
    UPDATE_PRACTICES: {
      type: 'boolean',
      label: 'Update Knowledge Base',
      description: 'Add learnings to knowledge files'
    },
    ANALYSIS_LEVEL: {
      type: 'select',
      label: 'Analysis Level',
      description: 'Code analysis mode',
      options: ['bypass', 'code-review', 'issue-resolver']
    },
    CRITICAL_ISSUE_MODE: {
      type: 'select',
      label: 'Critical Issue Mode',
      description: 'How to handle critical issues',
      options: ['warn', 'block']
    }
  }
};

/**
 * Extract friendly hook name from command path
 */
function extractHookName(command) {
  if (!command) return 'unknown';
  // "\"$HOME\"/.claude/hooks/code-analyzer.sh" → "code-analyzer"
  const match = command.match(/([^\/\\]+)\.sh/);
  return match ? match[1] : 'unknown';
}

/**
 * Get Claude directory path
 */
export function getClaudeDir() {
  return CLAUDE_DIR;
}

/**
 * Read and parse settings.json
 */
export async function getSettings() {
  try {
    // Check if ~/.claude directory exists first
    if (!await directoryExists(CLAUDE_DIR)) {
      // Return empty settings if no .claude dir (don't try to create it)
      return {};
    }

    const content = await readFile(join(CLAUDE_DIR, 'settings.json'), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Return empty settings if file doesn't exist
      return {};
    }
    // For other errors, log and return empty settings instead of throwing
    console.error('Error reading settings:', error.message);
    return {};
  }
}

/**
 * Read CLAUDE.md file
 */
export async function getClaudeMd() {
  try {
    // Check if ~/.claude directory exists first
    if (!await directoryExists(CLAUDE_DIR)) {
      return null;
    }

    const content = await readFile(join(CLAUDE_DIR, 'CLAUDE.md'), 'utf-8');
    return {
      path: join(CLAUDE_DIR, 'CLAUDE.md'),
      content
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    // For other errors, log and return null instead of throwing
    console.error('Error reading CLAUDE.md:', error.message);
    return null;
  }
}

/**
 * Get environment overview with all components
 */
export async function getEnvironmentOverview() {
  // Check if ~/.claude directory exists first
  if (!await directoryExists(CLAUDE_DIR)) {
    // Return empty overview with defaults
    return {
      agents: 0,
      skills: 0,
      commands: 0,
      rules: 0,
      plugins: 0,
      mcpServers: 0,
      hooks: { count: 0, total: 0, active: 0, types: [] },
      memory: { totalProjects: 0, projectsWithMemory: 0 },
      settings: {},
      claudeDirExists: false
    };
  }

  const overview = {
    agents: (await getAgents()).length,
    skills: (await getSkills()).length,
    commands: (await getCommands()).length,
    rules: await countFiles(join(CLAUDE_DIR, 'rules'), '.md'),
    plugins: await getPluginCount(),
    mcpServers: await getMCPServerCount(),
    hooks: await getHooksInfo(),
    memory: await getMemoryStats(),
    settings: await getSettings(),
    claudeDirExists: true
  };

  return overview;
}

/**
 * Count files in a directory with optional extension filter
 */
async function countFiles(dirPath, extension = null) {
  try {
    const files = await readdir(dirPath);
    if (extension) {
      return files.filter(f => f.endsWith(extension)).length;
    }
    return files.length;
  } catch {
    return 0;
  }
}

/**
 * Get hooks information
 */
async function getHooksInfo() {
  const allHooks = await getHooks();

  const types = [...new Set(allHooks.map(h => h.type))];

  return {
    count: allHooks.length,
    total: allHooks.length,
    active: allHooks.filter(h => h.enabled !== false).length,
    types
  };
}

/**
 * Get memory system statistics for auto-memory projects
 */
async function getMemoryStats() {
  const projectsDir = join(CLAUDE_DIR, 'projects');
  let totalProjects = 0;
  let projectsWithMemory = 0;

  try {
    const dirs = await readdir(projectsDir);
    totalProjects = dirs.length;

    for (const dir of dirs) {
      const memoryDir = join(projectsDir, dir, 'memory');
      try {
        const files = await readdir(memoryDir);
        if (files.some(f => f.endsWith('.md'))) {
          projectsWithMemory++;
        }
      } catch {
        // No memory dir
      }
    }
  } catch {
    // No projects dir
  }

  return { totalProjects, projectsWithMemory };
}

/**
 * Get list of hooks with their configuration
 */
export async function getHooks() {
  const settings = await getSettings();
  const hooksObj = settings.hooks || {};

  // Flatten user hooks into array with type info and unique IDs
  const userHooks = [];
  for (const [hookType, hookList] of Object.entries(hooksObj)) {
    if (Array.isArray(hookList)) {
      hookList.forEach((hookConfig, configIndex) => {
        const commands = hookConfig.hooks || [];
        commands.forEach((hook, hookIndex) => {
          userHooks.push({
            id: `${hookType}.${configIndex}.${hookIndex}`,
            name: extractHookName(hook.command),
            type: hookType,
            matcher: hookConfig.matcher || '*',
            command: hook.command,
            enabled: hook.enabled !== false,
            commandType: hook.type || 'command',
            source: 'user',
            sourceType: 'user'
          });
        });
      });
    }
  }

  // Get plugin hooks, apply overrides from settings.json, and merge
  const pluginHooks = await getPluginHooks();
  const overrides = settings.pluginHookOverrides || {};

  for (const hook of pluginHooks) {
    const pluginOverrides = overrides[hook.source];
    if (pluginOverrides) {
      // Check for override by the hook's local ID (e.g., "SessionStart.0.0")
      const localId = hook.id.replace(`plugin:${hook.source}:`, '');
      if (localId in pluginOverrides) {
        hook.enabled = pluginOverrides[localId];
      }
    }
  }

  return [...userHooks, ...pluginHooks];
}

/**
 * Get settings with schema for dynamic UI rendering
 */
export async function getSettingsWithSchema() {
  const settings = await getSettings();
  return {
    values: settings,
    schema: SETTINGS_SCHEMA
  };
}

/**
 * Get current project path
 */
export function getProjectPath() {
  return currentProjectPath;
}

/**
 * Set current project path
 */
export function setProjectPath(path) {
  currentProjectPath = path || null;
  persistState();
}

/**
 * Check if a path has a .claude directory (is a Claude project)
 */
export async function isClaudeProject(projectPath) {
  if (!projectPath) return false;
  try {
    await stat(join(projectPath, '.claude'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get project-level settings
 */
export async function getProjectSettings(projectPath) {
  if (!projectPath) {
    return { exists: false, path: null, settings: null, claudeMd: null };
  }

  const projectClaudeDir = join(projectPath, '.claude');
  const result = {
    exists: false,
    path: projectPath,
    claudeDir: projectClaudeDir,
    settings: null,
    localSettings: null,
    claudeMd: null,
    hasSettings: false,
    hasLocalSettings: false,
    hasClaudeMd: false
  };

  // Check if .claude directory exists
  try {
    await stat(projectClaudeDir);
    result.exists = true;
  } catch {
    return result;
  }

  // Read settings.json
  try {
    const content = await readFile(join(projectClaudeDir, 'settings.json'), 'utf-8');
    result.settings = JSON.parse(content);
    result.hasSettings = true;
  } catch {
    // No settings.json
  }

  // Read settings.local.json
  try {
    const content = await readFile(join(projectClaudeDir, 'settings.local.json'), 'utf-8');
    result.localSettings = JSON.parse(content);
    result.hasLocalSettings = true;
  } catch {
    // No settings.local.json
  }

  // Read CLAUDE.md
  try {
    const content = await readFile(join(projectClaudeDir, 'CLAUDE.md'), 'utf-8');
    result.claudeMd = content;
    result.hasClaudeMd = true;
  } catch {
    // Try root level CLAUDE.md
    try {
      const content = await readFile(join(projectPath, 'CLAUDE.md'), 'utf-8');
      result.claudeMd = content;
      result.hasClaudeMd = true;
    } catch {
      // No CLAUDE.md
    }
  }

  return result;
}

/**
 * Update project-level settings
 */
export async function updateProjectSettings(projectPath, settings, isLocal = false) {
  if (!projectPath) {
    throw new Error('No project path specified');
  }

  const projectClaudeDir = join(projectPath, '.claude');
  const filename = isLocal ? 'settings.local.json' : 'settings.json';

  await writeFile(
    join(projectClaudeDir, filename),
    JSON.stringify(settings, null, 2),
    'utf-8'
  );

  return { success: true };
}

/**
 * Get project-level hooks
 */
export async function getProjectHooks(projectPath) {
  if (!projectPath) return [];

  const projectClaudeDir = join(projectPath, '.claude');
  let settings = {};

  // Try settings.json first
  try {
    const content = await readFile(join(projectClaudeDir, 'settings.json'), 'utf-8');
    settings = JSON.parse(content);
  } catch {
    // No settings.json
  }

  // Merge with settings.local.json (local takes precedence)
  try {
    const content = await readFile(join(projectClaudeDir, 'settings.local.json'), 'utf-8');
    const localSettings = JSON.parse(content);
    if (localSettings.hooks) {
      settings.hooks = { ...settings.hooks, ...localSettings.hooks };
    }
  } catch {
    // No settings.local.json
  }

  const hooksObj = settings.hooks || {};

  // Flatten nested hook object into array with type info and unique IDs
  const allHooks = [];
  for (const [hookType, hookList] of Object.entries(hooksObj)) {
    if (Array.isArray(hookList)) {
      hookList.forEach((hookConfig, configIndex) => {
        const commands = hookConfig.hooks || [];
        commands.forEach((hook, hookIndex) => {
          allHooks.push({
            id: `${hookType}.${configIndex}.${hookIndex}`,
            name: extractHookName(hook.command),
            type: hookType,
            matcher: hookConfig.matcher || '*',
            command: hook.command,
            enabled: hook.enabled !== false,
            commandType: hook.type || 'command',
            source: 'project'
          });
        });
      });
    }
  }

  return allHooks;
}

/**
 * Get project-level environment variables
 */
export async function getProjectEnvVars(projectPath) {
  if (!projectPath) return { env: {}, localEnv: {}, merged: {}, sources: {} };

  const projectClaudeDir = join(projectPath, '.claude');
  let env = {};
  let localEnv = {};

  // Read settings.json env vars
  try {
    const content = await readFile(join(projectClaudeDir, 'settings.json'), 'utf-8');
    const settings = JSON.parse(content);
    env = settings.env || {};
  } catch {
    // No settings.json
  }

  // Read settings.local.json env vars
  try {
    const content = await readFile(join(projectClaudeDir, 'settings.local.json'), 'utf-8');
    const settings = JSON.parse(content);
    localEnv = settings.env || {};
  } catch {
    // No settings.local.json
  }

  // Merge with local taking precedence, track sources
  const merged = { ...env, ...localEnv };
  const sources = {};
  for (const key of Object.keys(env)) {
    sources[key] = 'settings.json';
  }
  for (const key of Object.keys(localEnv)) {
    sources[key] = 'settings.local.json';
  }

  return { env, localEnv, merged, sources };
}

/**
 * Toggle a user-level hook
 */
export async function toggleUserHook(hookId) {
  const parts = hookId.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid hook ID format');
  }

  const [hookType, configIdxStr, hookIdxStr] = parts;
  const configIdx = parseInt(configIdxStr, 10);
  const hookIdx = parseInt(hookIdxStr, 10);

  const settingsPath = join(CLAUDE_DIR, 'settings.json');

  return withWriteLock(settingsPath, async () => {
    const settings = await getSettings();
    const hookConfig = settings.hooks?.[hookType]?.[configIdx];
    const hook = hookConfig?.hooks?.[hookIdx];

    if (!hook) {
      throw new Error('Hook not found');
    }

    hook.enabled = !(hook.enabled !== false);

    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    return { success: true, enabled: hook.enabled };
  });
}

/**
 * Toggle a project-level hook
 */
export async function toggleProjectHook(projectPath, hookId, isLocal = false) {
  if (!projectPath) {
    throw new Error('No project path specified');
  }

  const parts = hookId.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid hook ID format');
  }

  const [hookType, configIdxStr, hookIdxStr] = parts;
  const configIdx = parseInt(configIdxStr, 10);
  const hookIdx = parseInt(hookIdxStr, 10);

  const projectClaudeDir = join(projectPath, '.claude');
  const filename = isLocal ? 'settings.local.json' : 'settings.json';
  const filePath = join(projectClaudeDir, filename);

  return withWriteLock(filePath, async () => {
    let settings = {};
    try {
      const content = await readFile(filePath, 'utf-8');
      settings = JSON.parse(content);
    } catch {
      // File doesn't exist, try the other settings file
    }

    let hookConfig = settings.hooks?.[hookType]?.[configIdx];
    let hook = hookConfig?.hooks?.[hookIdx];

    // If not found in primary file, check the other one
    if (!hook && !isLocal) {
      try {
        const altPath = join(projectClaudeDir, 'settings.local.json');
        const altContent = await readFile(altPath, 'utf-8');
        const altSettings = JSON.parse(altContent);
        hookConfig = altSettings.hooks?.[hookType]?.[configIdx];
        hook = hookConfig?.hooks?.[hookIdx];
        if (hook) {
          // Found in local file - toggle there instead
          hook.enabled = !(hook.enabled !== false);
          await writeFile(altPath, JSON.stringify(altSettings, null, 2), 'utf-8');
          return { success: true, enabled: hook.enabled };
        }
      } catch {
        // No local settings file
      }
    }

    if (!hook) {
      throw new Error('Hook not found');
    }

    hook.enabled = !(hook.enabled !== false);
    await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');

    return { success: true, enabled: hook.enabled };
  });
}

/**
 * Update a project-level environment variable
 */
export async function updateProjectEnvVar(projectPath, key, value, isLocal = false) {
  if (!projectPath) {
    throw new Error('No project path specified');
  }

  const projectClaudeDir = join(projectPath, '.claude');
  const filename = isLocal ? 'settings.local.json' : 'settings.json';
  const filePath = join(projectClaudeDir, filename);

  // Ensure .claude directory exists
  try {
    await mkdir(projectClaudeDir, { recursive: true });
  } catch {
    // Directory already exists
  }

  let settings = {};
  try {
    const content = await readFile(filePath, 'utf-8');
    settings = JSON.parse(content);
  } catch {
    // File doesn't exist, create new settings
  }

  settings.env = settings.env || {};
  settings.env[key] = value;

  await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');

  return { success: true, key, value };
}

/**
 * Delete a user-level environment variable
 */
export async function deleteEnvVar(key) {
  const settings = await getSettings();
  if (!settings.env || !(key in settings.env)) {
    return { success: true, key, deleted: false };
  }

  delete settings.env[key];

  await writeFile(
    join(CLAUDE_DIR, 'settings.json'),
    JSON.stringify(settings, null, 2),
    'utf-8'
  );

  return { success: true, key, deleted: true };
}

/**
 * Delete a project-level environment variable
 */
export async function deleteProjectEnvVar(projectPath, key, isLocal = false) {
  if (!projectPath) {
    throw new Error('No project path specified');
  }

  const projectClaudeDir = join(projectPath, '.claude');
  const filename = isLocal ? 'settings.local.json' : 'settings.json';
  const filePath = join(projectClaudeDir, filename);

  let settings = {};
  try {
    const content = await readFile(filePath, 'utf-8');
    settings = JSON.parse(content);
  } catch {
    return { success: true, key, deleted: false };
  }

  if (!settings.env || !(key in settings.env)) {
    return { success: true, key, deleted: false };
  }

  delete settings.env[key];

  await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');

  return { success: true, key, deleted: true };
}

/**
 * Get hooks grouped by source (user vs per-plugin)
 */
export async function getHooksGroupedBySource() {
  const allHooks = await getHooks();

  const user = allHooks.filter(h => h.sourceType === 'user');
  const plugins = {};

  for (const hook of allHooks.filter(h => h.sourceType === 'plugin')) {
    if (!plugins[hook.source]) {
      plugins[hook.source] = [];
    }
    plugins[hook.source].push(hook);
  }

  return { user, plugins };
}

/**
 * Toggle a plugin hook via pluginHookOverrides in settings.json
 */
export async function togglePluginHook(hookId) {
  // hookId format: "plugin:pluginName:hookType.configIndex.hookIndex"
  const match = hookId.match(/^plugin:([^:]+):(.+)$/);
  if (!match) {
    throw new Error('Invalid plugin hook ID format');
  }

  const [, pluginName, localId] = match;
  const settingsPath = join(CLAUDE_DIR, 'settings.json');

  return withWriteLock(settingsPath, async () => {
    const settings = await getSettings();

    // Find current effective state from plugin hooks
    const pluginHooks = await getPluginHooks();
    const hook = pluginHooks.find(h => h.id === hookId);
    if (!hook) {
      throw new Error('Plugin hook not found');
    }

    // Apply existing override if any
    const currentOverride = settings.pluginHookOverrides?.[pluginName]?.[localId];
    const currentEnabled = currentOverride !== undefined ? currentOverride : hook.enabled;

    // Toggle
    if (!settings.pluginHookOverrides) {
      settings.pluginHookOverrides = {};
    }
    if (!settings.pluginHookOverrides[pluginName]) {
      settings.pluginHookOverrides[pluginName] = {};
    }
    settings.pluginHookOverrides[pluginName][localId] = !currentEnabled;

    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    return { success: true, enabled: !currentEnabled };
  });
}

/**
 * Bulk toggle all hooks in a group
 * @param {string} groupType - "user" or "plugin"
 * @param {string} groupId - plugin name (for plugin type), ignored for user
 * @param {boolean} enabled - target enabled state
 */
export async function bulkToggleHookGroup(groupType, groupId, enabled) {
  const settingsPath = join(CLAUDE_DIR, 'settings.json');

  return withWriteLock(settingsPath, async () => {
    const settings = await getSettings();

    if (groupType === 'user') {
      // Toggle all user hooks in settings.json
      const hooksObj = settings.hooks || {};
      let toggled = 0;

      for (const hookList of Object.values(hooksObj)) {
        if (!Array.isArray(hookList)) continue;
        for (const hookConfig of hookList) {
          for (const hook of (hookConfig.hooks || [])) {
            hook.enabled = enabled;
            toggled++;
          }
        }
      }

      await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      return { success: true, toggled, enabled };
    }

    if (groupType === 'plugin') {
      // Set overrides for all hooks in this plugin
      const pluginHooks = await getPluginHooks();
      const groupHooks = pluginHooks.filter(h => h.source === groupId);

      if (groupHooks.length === 0) {
        throw new Error('No hooks found for plugin: ' + groupId);
      }

      if (!settings.pluginHookOverrides) {
        settings.pluginHookOverrides = {};
      }
      settings.pluginHookOverrides[groupId] = {};

      for (const hook of groupHooks) {
        const localId = hook.id.replace(`plugin:${groupId}:`, '');
        settings.pluginHookOverrides[groupId][localId] = enabled;
      }

      await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      return { success: true, toggled: groupHooks.length, enabled };
    }

    throw new Error('Invalid group type: ' + groupType);
  });
}

export default {
  getClaudeDir,
  getSettings,
  getClaudeMd,
  getEnvironmentOverview,
  getHooks,
  getHooksGroupedBySource,
  getSettingsWithSchema,
  getProjectPath,
  setProjectPath,
  isClaudeProject,
  getProjectSettings,
  updateProjectSettings,
  getProjectHooks,
  getProjectEnvVars,
  toggleProjectHook,
  toggleUserHook,
  togglePluginHook,
  updateProjectEnvVar,
  deleteEnvVar,
  deleteProjectEnvVar,
  bulkToggleHookGroup,
  SETTINGS_SCHEMA
};
