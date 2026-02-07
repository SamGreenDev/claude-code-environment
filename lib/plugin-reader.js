/**
 * Plugin reader for the Environment UI
 * Reads installed plugins and their metadata
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile, readdir, stat, access } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';

const HOME_DIR = homedir();
const CLAUDE_DIR = join(HOME_DIR, '.claude');
const PLUGINS_DIR = join(CLAUDE_DIR, 'plugins');
const LOCAL_PLUGINS_DIR = join(PLUGINS_DIR, 'local');
const INSTALLED_FILE = join(PLUGINS_DIR, 'installed_plugins.json');

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

/**
 * Check if a file exists
 */
async function fileExists(path) {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve the actual plugin path, preferring local directory for @local plugins
 * This prevents stale cache paths from being used when a local version exists
 */
async function resolvePluginPath(registeredPath, pluginKey) {
  // Check if this is a local plugin (key ends with @local)
  if (pluginKey.endsWith('@local')) {
    // Extract plugin name from key (e.g., "learning@local" -> "learning")
    const pluginName = pluginKey.replace('@local', '');
    const localPath = join(LOCAL_PLUGINS_DIR, pluginName);

    // Check if local directory exists with valid plugin structure
    const hasPluginJson = await fileExists(join(localPath, '.claude-plugin', 'plugin.json'));

    if (hasPluginJson) {
      // Prefer local directory over registered/cached path
      return localPath;
    }
  }

  // Fall back to registered path
  return registeredPath;
}

/**
 * Get all installed plugins with their metadata
 */
export async function getPlugins() {
  const plugins = [];

  try {
    // First check if ~/.claude directory exists
    if (!await directoryExists(CLAUDE_DIR)) {
      return plugins; // Return empty array if no .claude dir
    }

    // Check if plugins directory exists
    if (!await directoryExists(PLUGINS_DIR)) {
      return plugins; // Return empty array if no plugins dir
    }

    // Read installed plugins registry
    const installedContent = await readFile(INSTALLED_FILE, 'utf-8');
    const installed = JSON.parse(installedContent);

    for (const [pluginKey, installations] of Object.entries(installed.plugins || {})) {
      for (const installation of installations) {
        // Resolve actual path (prefers local directory for @local plugins)
        const resolvedPath = await resolvePluginPath(installation.installPath, pluginKey);
        const pluginData = await loadPluginMetadata(resolvedPath, pluginKey);
        if (pluginData) {
          plugins.push({
            ...pluginData,
            installPath: resolvedPath,
            version: installation.version,
            installedAt: installation.installedAt,
            lastUpdated: installation.lastUpdated,
            scope: installation.scope
          });
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading plugins:', error);
    }
  }

  return plugins;
}

/**
 * Load plugin metadata from plugin.json
 */
async function loadPluginMetadata(installPath, pluginKey) {
  try {
    const pluginJsonPath = join(installPath, '.claude-plugin', 'plugin.json');
    const content = await readFile(pluginJsonPath, 'utf-8');
    const metadata = JSON.parse(content);

    // Get skills/commands/agents from plugin.json or fall back to directory listing
    let skills = [];
    let commands = [];
    let agents = [];

    // Get skills from plugin.json
    if (metadata.skills && Array.isArray(metadata.skills)) {
      skills = metadata.skills.map(s => typeof s === 'string' ? s : s.name);
    } else {
      // Fall back to directory listing
      const skillDirs = await listDirectory(join(installPath, 'skills'));
      skills = skillDirs.filter(s => s !== '.DS_Store');
    }

    // Get commands from plugin.json
    if (metadata.commands && Array.isArray(metadata.commands)) {
      commands = metadata.commands.map(c => typeof c === 'string' ? c : c.name);
    } else {
      // Fall back to directory listing
      const commandFiles = await listDirectory(join(installPath, 'commands'));
      commands = commandFiles.filter(c => c.endsWith('.md')).map(c => c.replace('.md', ''));
    }

    // Get agents from plugin.json
    if (metadata.agents && Array.isArray(metadata.agents)) {
      agents = metadata.agents.map(a => typeof a === 'string' ? a : a.name);
    } else {
      // Fall back to directory listing
      const agentFiles = await listDirectory(join(installPath, 'agents'));
      agents = agentFiles.filter(a => a.endsWith('.md')).map(a => a.replace('.md', ''));
    }

    return {
      id: pluginKey,
      name: metadata.name,
      description: metadata.description,
      author: metadata.author,
      homepage: metadata.homepage,
      repository: metadata.repository,
      license: metadata.license,
      keywords: metadata.keywords || [],
      skills,
      commands,
      agents
    };
  } catch (error) {
    console.error(`Error loading plugin metadata from ${installPath}:`, error.message);
    return null;
  }
}

/**
 * List directory contents, returns empty array if not exists
 */
async function listDirectory(dirPath) {
  try {
    return await readdir(dirPath);
  } catch {
    return [];
  }
}

/**
 * Get count of installed plugins
 */
export async function getPluginCount() {
  const plugins = await getPlugins();
  return plugins.length;
}

/**
 * Get hooks from all installed plugins
 * Reads hooks/hooks.json from each plugin directory
 * Returns flat array of hooks with source (plugin name) info
 */
export async function getPluginHooks() {
  const allPluginHooks = [];

  try {
    if (!await directoryExists(PLUGINS_DIR)) return allPluginHooks;

    const installedContent = await readFile(INSTALLED_FILE, 'utf-8');
    const installed = JSON.parse(installedContent);

    for (const [pluginKey, installations] of Object.entries(installed.plugins || {})) {
      for (const installation of installations) {
        const resolvedPath = await resolvePluginPath(installation.installPath, pluginKey);

        // Try to read hooks.json
        let hooksData;
        try {
          const hooksContent = await readFile(join(resolvedPath, 'hooks', 'hooks.json'), 'utf-8');
          hooksData = JSON.parse(hooksContent);
        } catch {
          continue; // No hooks.json for this plugin
        }

        const hooksObj = hooksData.hooks || {};
        const pluginName = pluginKey.split('@')[0]; // "environment@sam-green-marketplace" → "environment"

        for (const [hookType, hookList] of Object.entries(hooksObj)) {
          if (!Array.isArray(hookList)) continue;

          hookList.forEach((hookConfig, configIndex) => {
            const commands = hookConfig.hooks || [];
            commands.forEach((hook, hookIndex) => {
              // Extract friendly name from command
              const nameMatch = hook.command?.match(/([^\/\\]+)\.sh/);
              const name = nameMatch ? nameMatch[1] : 'unknown';

              allPluginHooks.push({
                id: `plugin:${pluginName}:${hookType}.${configIndex}.${hookIndex}`,
                name,
                type: hookType,
                matcher: hookConfig.matcher || '*',
                command: hook.command || '',
                enabled: hook.enabled !== false,
                commandType: hook.type || 'command',
                source: pluginName,
                sourceType: 'plugin'
              });
            });
          });
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading plugin hooks:', error);
    }
  }

  return allPluginHooks;
}

export default { getPlugins, getPluginCount, getPluginHooks };
