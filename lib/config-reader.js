/**
 * Configuration reader for Claude Code environment
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { getPluginCount } from './plugin-reader.js';
import { getMCPServerCount } from './mcp-reader.js';

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
    LESSONS_ENABLED: {
      type: 'boolean',
      label: 'Self-Learning Memory',
      description: 'Capture and surface lessons from mistakes'
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
      knowledge: 0,
      rules: 0,
      plugins: 0,
      mcpServers: 0,
      hooks: { count: 0, total: 0, active: 0, types: [] },
      memory: { hasQuickRef: false, quickRefSize: 0, issueCount: 0 },
      settings: {},
      claudeDirExists: false
    };
  }

  const overview = {
    agents: await countFiles(join(CLAUDE_DIR, 'agents'), '.md'),
    skills: await countSkills(),
    commands: await countFiles(join(CLAUDE_DIR, 'commands'), '.md'),
    knowledge: await countKnowledgeFiles(),
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
 * Count skills (directories with SKILL.md)
 */
async function countSkills() {
  try {
    const skillsDir = join(CLAUDE_DIR, 'skills');
    const entries = await readdir(skillsDir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          await stat(join(skillsDir, entry.name, 'SKILL.md'));
          count++;
        } catch {
          // Not a skill directory
        }
      }
    }

    return count;
  } catch {
    return 0;
  }
}

/**
 * Count knowledge base files
 */
async function countKnowledgeFiles() {
  const knowledgeDir = join(CLAUDE_DIR, 'knowledge');
  let count = 0;

  async function countRecursive(dir) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await countRecursive(join(dir, entry.name));
        } else if (entry.name.endsWith('.md')) {
          count++;
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  await countRecursive(knowledgeDir);
  return count;
}

/**
 * Get hooks information
 */
async function getHooksInfo() {
  const settings = await getSettings();
  const hooksObj = settings.hooks || {};

  // Flatten nested hook object into array
  const allHooks = [];
  for (const [hookType, hookList] of Object.entries(hooksObj)) {
    if (Array.isArray(hookList)) {
      hookList.forEach(hookConfig => {
        // Each hookConfig may have a nested 'hooks' array
        const commands = hookConfig.hooks || [];
        commands.forEach(hook => {
          allHooks.push({ ...hook, type: hookType, matcher: hookConfig.matcher });
        });
      });
    }
  }

  return {
    count: allHooks.length,
    total: allHooks.length,
    active: allHooks.filter(h => h.enabled !== false).length,
    types: Object.keys(hooksObj)
  };
}

/**
 * Get memory system statistics
 */
async function getMemoryStats() {
  const memoryDir = join(CLAUDE_DIR, 'memory');

  try {
    const files = await readdir(memoryDir);
    let issueCount = 0;

    // Count issue files
    if (files.includes('issues')) {
      const issuesDir = join(memoryDir, 'issues');
      const dateDirs = await readdir(issuesDir);

      for (const dateDir of dateDirs) {
        const dateIssues = await readdir(join(issuesDir, dateDir));
        issueCount += dateIssues.length;
      }
    }

    // Check for quick-ref
    let quickRefSize = 0;
    try {
      const quickRef = await stat(join(memoryDir, 'quick-ref.json'));
      quickRefSize = quickRef.size;
    } catch {
      // File doesn't exist
    }

    return {
      hasQuickRef: quickRefSize > 0,
      quickRefSize,
      issueCount
    };
  } catch {
    return {
      hasQuickRef: false,
      quickRefSize: 0,
      issueCount: 0
    };
  }
}

/**
 * Get list of hooks with their configuration
 */
export async function getHooks() {
  const settings = await getSettings();
  const hooksObj = settings.hooks || {};

  // Flatten nested hook object into array with type info and unique IDs
  const allHooks = [];
  for (const [hookType, hookList] of Object.entries(hooksObj)) {
    if (Array.isArray(hookList)) {
      hookList.forEach((hookConfig, configIndex) => {
        // Each hookConfig may have a nested 'hooks' array
        const commands = hookConfig.hooks || [];
        commands.forEach((hook, hookIndex) => {
          allHooks.push({
            id: `${hookType}.${configIndex}.${hookIndex}`,
            name: extractHookName(hook.command),
            type: hookType,
            matcher: hookConfig.matcher || '*',
            command: hook.command,
            enabled: hook.enabled !== false,
            commandType: hook.type || 'command'
          });
        });
      });
    }
  }

  return allHooks;
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
  currentProjectPath = path;
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
  if (!projectPath) return { env: {}, localEnv: {} };

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

  return { env, localEnv };
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

  let settings = {};
  try {
    const content = await readFile(filePath, 'utf-8');
    settings = JSON.parse(content);
  } catch {
    // File doesn't exist, create new settings
  }

  const hookConfig = settings.hooks?.[hookType]?.[configIdx];
  const hook = hookConfig?.hooks?.[hookIdx];

  if (!hook) {
    throw new Error('Hook not found');
  }

  // Toggle the enabled state
  hook.enabled = !(hook.enabled !== false);

  await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');

  return { success: true, enabled: hook.enabled };
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

export default {
  getClaudeDir,
  getSettings,
  getClaudeMd,
  getEnvironmentOverview,
  getHooks,
  getSettingsWithSchema,
  getProjectPath,
  setProjectPath,
  isClaudeProject,
  getProjectSettings,
  updateProjectSettings,
  getProjectHooks,
  getProjectEnvVars,
  toggleProjectHook,
  updateProjectEnvVar,
  SETTINGS_SCHEMA
};
