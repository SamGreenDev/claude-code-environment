/**
 * MCP Server Reader
 * Reads and parses MCP server configurations from Claude Code's .mcp.json files
 *
 * MCP servers are configured in:
 * - ~/.claude/.mcp.json (user-level)
 * - [project]/.mcp.json (project-level)
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { CLAUDE_DIR, directoryExists } from './paths.js';

const HOME_DIR = homedir();

/**
 * Get MCP servers from .mcp.json files
 * @returns {Promise<Array>} Array of MCP server objects
 */
export async function getMCPServers() {
  const servers = [];

  // Read from ~/.claude/.mcp.json (user-level)
  // Only try if ~/.claude directory exists
  const claudeDirExists = await directoryExists(CLAUDE_DIR);

  if (claudeDirExists) {
    try {
      const userMcpPath = join(CLAUDE_DIR, '.mcp.json');
      const userContent = await readFile(userMcpPath, 'utf-8');
      const userMcp = JSON.parse(userContent);

      if (userMcp.mcpServers && typeof userMcp.mcpServers === 'object') {
        for (const [name, config] of Object.entries(userMcp.mcpServers)) {
          servers.push(parseMCPServer(name, config, 'user'));
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading user .mcp.json:', error.message);
      }
    }
  }

  // Also try reading from home directory root .mcp.json
  try {
    const homeMcpPath = join(HOME_DIR, '.mcp.json');
    const homeContent = await readFile(homeMcpPath, 'utf-8');
    const homeMcp = JSON.parse(homeContent);

    if (homeMcp.mcpServers && typeof homeMcp.mcpServers === 'object') {
      for (const [name, config] of Object.entries(homeMcp.mcpServers)) {
        // Check if server already exists
        const existingIndex = servers.findIndex(s => s.name === name);
        if (existingIndex === -1) {
          servers.push(parseMCPServer(name, config, 'home'));
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading home .mcp.json:', error.message);
    }
  }

  // Check for enabled/disabled MCP servers in settings.json
  // Only if ~/.claude exists
  if (claudeDirExists) {
    try {
      const settingsPath = join(CLAUDE_DIR, 'settings.json');
      const settingsContent = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent);

      // Mark servers as enabled/disabled based on settings
      if (settings.enabledMcpjsonServers) {
        servers.forEach(server => {
          if (settings.enabledMcpjsonServers.includes(server.name)) {
            server.enabled = true;
          }
        });
      }
      if (settings.disabledMcpjsonServers) {
        servers.forEach(server => {
          if (settings.disabledMcpjsonServers.includes(server.name)) {
            server.enabled = false;
          }
        });
      }
    } catch (error) {
      // Settings may not exist - this is fine
    }
  }

  return servers;
}

/**
 * Parse a single MCP server configuration
 * @param {string} name - Server name (key)
 * @param {object} config - Server configuration
 * @param {string} source - 'user', 'home', or 'project'
 * @returns {object} Parsed server object
 */
function parseMCPServer(name, config, source) {
  const server = {
    name,
    source,
    command: config.command || '',
    args: config.args || [],
    envCount: 0,
    envKeys: [],
    status: 'configured',
    enabled: true, // Default to enabled, may be overridden
  };

  // Handle URL-based servers
  if (config.url) {
    server.url = config.url;
    server.type = 'remote';
  }

  // Count env vars but don't expose values for security
  if (config.env && typeof config.env === 'object') {
    server.envKeys = Object.keys(config.env);
    server.envCount = server.envKeys.length;
  }

  // Determine server type based on command/args
  if (!server.type) {
    server.type = detectServerType(server);
  }

  return server;
}

/**
 * Detect the type of MCP server based on its configuration
 * @param {object} server - Parsed server object
 * @returns {string} Server type
 */
function detectServerType(server) {
  const command = (server.command || '').toLowerCase();
  const argsStr = (server.args || []).join(' ').toLowerCase();

  if (command.includes('npx') || command.includes('npm')) {
    return 'npm';
  }
  if (command.includes('uvx') || command.includes('uv') || command.includes('pip') || command.includes('python')) {
    return 'python';
  }
  if (command.includes('docker')) {
    return 'docker';
  }
  if (command.includes('node')) {
    return 'node';
  }
  if (argsStr.includes('filesystem')) {
    return 'filesystem';
  }
  if (argsStr.includes('github')) {
    return 'github';
  }
  if (argsStr.includes('postgres') || argsStr.includes('mysql') || argsStr.includes('sqlite')) {
    return 'database';
  }
  if (argsStr.includes('fetch') || argsStr.includes('http') || argsStr.includes('api')) {
    return 'api';
  }

  return 'custom';
}

/**
 * Get MCP server statistics
 * @returns {Promise<object>} Stats object
 */
export async function getMCPStats() {
  const servers = await getMCPServers();

  const stats = {
    total: servers.length,
    byType: {},
    bySource: {
      user: 0,
      home: 0,
      project: 0,
    },
    enabled: 0,
    disabled: 0,
  };

  for (const server of servers) {
    // Count by type
    stats.byType[server.type] = (stats.byType[server.type] || 0) + 1;

    // Count by source
    if (stats.bySource[server.source] !== undefined) {
      stats.bySource[server.source]++;
    }

    // Count by enabled status
    if (server.enabled !== false) {
      stats.enabled++;
    } else {
      stats.disabled++;
    }
  }

  return stats;
}

/**
 * Get the count of MCP servers (for overview)
 * @returns {Promise<number>} Number of configured MCP servers
 */
export async function getMCPServerCount() {
  const servers = await getMCPServers();
  return servers.length;
}

export default {
  getMCPServers,
  getMCPStats,
  getMCPServerCount,
};
