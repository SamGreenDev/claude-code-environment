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
    const hasMarketplaceJson = await fileExists(join(localPath, 'marketplace.json'));

    if (hasPluginJson || hasMarketplaceJson) {
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
 * Load plugin metadata from plugin.json and marketplace.json
 */
async function loadPluginMetadata(installPath, pluginKey) {
  try {
    const pluginJsonPath = join(installPath, '.claude-plugin', 'plugin.json');
    const content = await readFile(pluginJsonPath, 'utf-8');
    const metadata = JSON.parse(content);

    // Try to load marketplace.json for accurate skills/commands/agents
    let skills = [];
    let commands = [];
    let agents = [];

    const marketplacePath = join(installPath, 'marketplace.json');
    try {
      const marketplaceContent = await readFile(marketplacePath, 'utf-8');
      const marketplace = JSON.parse(marketplaceContent);

      // Get skills from marketplace.json
      if (marketplace.skills && Array.isArray(marketplace.skills)) {
        skills = marketplace.skills.map(s => typeof s === 'string' ? s : s.name);
      }

      // Get commands from marketplace.json
      if (marketplace.commands && Array.isArray(marketplace.commands)) {
        commands = marketplace.commands.map(c => typeof c === 'string' ? c : c.name);
      }

      // Get agents from marketplace.json
      if (marketplace.agents && Array.isArray(marketplace.agents)) {
        agents = marketplace.agents.map(a => typeof a === 'string' ? a : a.name);
      }
    } catch {
      // Fall back to directory listing if marketplace.json doesn't exist
      const skillDirs = await listDirectory(join(installPath, 'skills'));
      skills = skillDirs.filter(s => s !== '.DS_Store');

      const commandFiles = await listDirectory(join(installPath, 'commands'));
      commands = commandFiles.filter(c => c.endsWith('.md')).map(c => c.replace('.md', ''));

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

export default { getPlugins, getPluginCount };
