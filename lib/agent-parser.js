/**
 * Agent and skill parser for Claude Code environment
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = join(homedir(), '.claude');

/**
 * Get all agents (including from plugins)
 */
export async function getAgents() {
  const agentsDir = join(CLAUDE_DIR, 'agents');
  const agents = [];

  // Read core agents from ~/.claude/agents/
  try {
    const files = await readdir(agentsDir);

    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await readFile(join(agentsDir, file), 'utf-8');
        const agent = parseAgentFile(file, content);
        agents.push(agent);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading agents:', error);
    }
  }

  // Read plugin agents from ~/.claude/plugins/
  const pluginAgents = await getPluginAgents();
  agents.push(...pluginAgents);

  // Deduplicate agents by id (prefer first occurrence - user agents over plugin)
  const seen = new Set();
  const deduped = [];
  for (const agent of agents) {
    if (!seen.has(agent.id)) {
      seen.add(agent.id);
      deduped.push(agent);
    }
  }

  return deduped;
}

/**
 * Get agents from installed plugins
 */
async function getPluginAgents() {
  const agents = [];
  const pluginDirs = [
    join(CLAUDE_DIR, 'plugins', 'local'),
    join(CLAUDE_DIR, 'plugins', 'cache')
  ];

  for (const baseDir of pluginDirs) {
    try {
      const entries = await readdir(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

        let pluginPath = join(baseDir, entry.name);
        let pluginName = entry.name;

        // Handle cache directory structure (vendor/plugin-name/version/)
        if (baseDir.includes('cache')) {
          const vendorDir = pluginPath;
          try {
            const vendorEntries = await readdir(vendorDir, { withFileTypes: true });
            for (const pluginEntry of vendorEntries) {
              if (!pluginEntry.isDirectory() || pluginEntry.name.startsWith('.')) continue;
              const pluginSubDir = join(vendorDir, pluginEntry.name);
              const versionEntries = await readdir(pluginSubDir, { withFileTypes: true });
              for (const versionEntry of versionEntries) {
                if (!versionEntry.isDirectory()) continue;
                const versionPath = join(pluginSubDir, versionEntry.name);
                await loadPluginAgentsFromPath(versionPath, pluginEntry.name, agents);
              }
            }
          } catch {
            // Not a vendor directory
          }
          continue;
        }

        // Load agents from local plugin
        await loadPluginAgentsFromPath(pluginPath, pluginName, agents);
      }
    } catch {
      // Plugin directory doesn't exist
    }
  }

  return agents;
}

/**
 * Load agents from a specific plugin path
 */
async function loadPluginAgentsFromPath(pluginPath, pluginName, agents) {
  const agentsDir = join(pluginPath, 'agents');

  try {
    const files = await readdir(agentsDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const content = await readFile(join(agentsDir, file), 'utf-8');
      const agent = parseAgentFile(file, content, pluginName);
      agents.push(agent);
    }
  } catch {
    // No agents directory
  }
}

/**
 * Parse an agent markdown file
 * @param {string} filename - The agent filename (e.g., "architect.md")
 * @param {string} content - The agent file content
 * @param {string} [pluginName] - Optional plugin name for plugin agents
 */
function parseAgentFile(filename, content, pluginName = null) {
  const name = filename.replace('.md', '');
  const lines = content.split('\n');

  // Extract title from first heading
  let title = name;
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Extract description (first paragraph after title)
  let description = '';
  const descMatch = content.match(/^#[^\n]+\n+([^#\n][^\n]+)/m);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  // Extract "When to Use" section
  let whenToUse = [];
  const whenMatch = content.match(/##\s*When to Use[^\n]*\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (whenMatch) {
    const bullets = whenMatch[1].match(/^[-*]\s+(.+)$/gm);
    if (bullets) {
      whenToUse = bullets.map(b => b.replace(/^[-*]\s+/, '').trim());
    }
  }

  // Extract capabilities/tools
  let capabilities = [];
  const capsMatch = content.match(/##\s*(Capabilities|Tools)[^\n]*\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (capsMatch) {
    const bullets = capsMatch[1].match(/^[-*]\s+(.+)$/gm);
    if (bullets) {
      capabilities = bullets.map(b => b.replace(/^[-*]\s+/, '').trim());
    }
  }

  // Determine path based on whether this is a plugin agent
  let agentPath;
  if (pluginName) {
    agentPath = join(CLAUDE_DIR, 'plugins', 'local', pluginName, 'agents', filename);
  } else {
    agentPath = join(CLAUDE_DIR, 'agents', filename);
  }

  return {
    id: pluginName ? `${pluginName}:${name}` : name,
    name,
    title,
    description,
    whenToUse,
    capabilities,
    path: agentPath,
    content,
    plugin: pluginName // null for user agents, plugin name for plugin agents
  };
}

/**
 * Get all skills (including from plugins)
 */
export async function getSkills() {
  const skillsDir = join(CLAUDE_DIR, 'skills');
  const skills = [];

  // Read core skills from ~/.claude/skills/
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = join(skillsDir, entry.name, 'SKILL.md');
        try {
          const content = await readFile(skillPath, 'utf-8');
          const skill = parseSkillFile(entry.name, content);
          skills.push(skill);
        } catch {
          // Not a valid skill directory
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading skills:', error);
    }
  }

  // Read plugin skills from ~/.claude/plugins/
  const pluginSkills = await getPluginSkills();
  skills.push(...pluginSkills);

  // Deduplicate skills by id (prefer first occurrence)
  const seen = new Set();
  const deduped = [];
  for (const skill of skills) {
    if (!seen.has(skill.id)) {
      seen.add(skill.id);
      deduped.push(skill);
    }
  }

  return deduped;
}

/**
 * Get skills from installed plugins
 */
async function getPluginSkills() {
  const skills = [];
  const pluginDirs = [
    join(CLAUDE_DIR, 'plugins', 'local'),
    join(CLAUDE_DIR, 'plugins', 'cache')
  ];

  for (const baseDir of pluginDirs) {
    try {
      const entries = await readdir(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

        // Handle different plugin structures
        let pluginPath = join(baseDir, entry.name);
        let pluginName = entry.name;

        // Check if this is a cache directory with vendor/name/version structure
        if (baseDir.includes('cache')) {
          // Cache structure: cache/vendor/plugin-name/version/
          const vendorDir = pluginPath;
          try {
            const vendorEntries = await readdir(vendorDir, { withFileTypes: true });
            for (const pluginEntry of vendorEntries) {
              if (!pluginEntry.isDirectory() || pluginEntry.name.startsWith('.')) continue;
              const pluginSubDir = join(vendorDir, pluginEntry.name);
              const versionEntries = await readdir(pluginSubDir, { withFileTypes: true });
              for (const versionEntry of versionEntries) {
                if (!versionEntry.isDirectory()) continue;
                const versionPath = join(pluginSubDir, versionEntry.name);
                await loadPluginSkillsFromPath(versionPath, pluginEntry.name, skills);
              }
            }
          } catch {
            // Not a vendor directory
          }
          continue;
        }

        // Load skills from local plugin
        await loadPluginSkillsFromPath(pluginPath, pluginName, skills);
      }
    } catch {
      // Plugin directory doesn't exist
    }
  }

  return skills;
}

/**
 * Load skills from a specific plugin path
 */
async function loadPluginSkillsFromPath(pluginPath, pluginName, skills) {
  const skillsDir = join(pluginPath, 'skills');

  try {
    const skillEntries = await readdir(skillsDir, { withFileTypes: true });

    for (const skillEntry of skillEntries) {
      if (!skillEntry.isDirectory() || skillEntry.name.startsWith('.')) continue;

      const skillPath = join(skillsDir, skillEntry.name, 'SKILL.md');
      try {
        const content = await readFile(skillPath, 'utf-8');
        // Use plugin:skill format for command
        const fullName = `${pluginName}:${skillEntry.name}`;
        const skill = parseSkillFile(fullName, content, pluginName);
        skills.push(skill);
      } catch {
        // Not a valid skill directory
      }
    }
  } catch {
    // No skills directory
  }
}

/**
 * Parse a skill markdown file
 * @param {string} name - The skill name (may include plugin prefix like "learning:init")
 * @param {string} content - The SKILL.md file content
 * @param {string} [pluginName] - Optional plugin name for plugin skills
 */
function parseSkillFile(name, content, pluginName = null) {
  // Extract frontmatter if present
  let frontmatter = {};
  let contentWithoutFrontmatter = content;
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (fmMatch) {
    const lines = fmMatch[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    }
    // Remove frontmatter from content for display
    contentWithoutFrontmatter = content.slice(fmMatch[0].length);
  }

  // Extract title from first heading
  let title = '';
  const titleMatch = contentWithoutFrontmatter.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    let rawTitle = titleMatch[1];
    // Remove patterns like "/command:name - ", "/plugin:command - ", or "/command - " from start
    // Handles colons in plugin-prefixed commands (e.g., /learning:init - Title)
    rawTitle = rawTitle.replace(/^\/[\w:-]+\s*-\s*/, '');
    // Also remove leading slash command if still present
    rawTitle = rawTitle.replace(/^\/[\w:-]+\s*/, '');
    title = rawTitle.trim();
  }

  // Fall back to converting name to title case if no heading found or title is empty
  if (!title) {
    // For plugin skills, use just the skill part (after colon) for title generation
    const nameParts = name.split(':');
    const baseName = nameParts[nameParts.length - 1];
    title = baseName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Extract description
  let description = frontmatter.description || '';
  if (!description) {
    const descMatch = contentWithoutFrontmatter.match(/^#[^\n]+\n+([^#\n][^\n]+)/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }
  // Clean up description - remove surrounding quotes
  description = description.replace(/^["']|["']$/g, '').trim();

  // Check if user-invocable
  const isUserInvocable = content.includes('user_invocable: true') ||
    frontmatter.user_invocable === 'true';

  // Extract command (slash command)
  const command = frontmatter.command || `/${name}`;

  // Determine the path based on whether this is a plugin skill
  let skillPath;
  if (pluginName) {
    const skillName = name.split(':')[1] || name;
    skillPath = join(CLAUDE_DIR, 'plugins', 'local', pluginName, 'skills', skillName, 'SKILL.md');
  } else {
    skillPath = join(CLAUDE_DIR, 'skills', name, 'SKILL.md');
  }

  // Extract author from frontmatter
  const author = frontmatter.author || null;

  return {
    id: name,
    title,
    description,
    command,
    author,
    isUserInvocable,
    path: skillPath,
    content: contentWithoutFrontmatter
  };
}

/**
 * Get all commands (including from plugins)
 */
export async function getCommands() {
  const commandsDir = join(CLAUDE_DIR, 'commands');
  const commands = [];

  // Read core commands from ~/.claude/commands/
  try {
    const files = await readdir(commandsDir);

    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await readFile(join(commandsDir, file), 'utf-8');
        const command = parseCommandFile(file, content);
        commands.push(command);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading commands:', error);
    }
  }

  // Read plugin commands from ~/.claude/plugins/
  const pluginCommands = await getPluginCommands();
  commands.push(...pluginCommands);

  // Deduplicate commands by id (prefer first occurrence)
  const seen = new Set();
  const deduped = [];
  for (const command of commands) {
    if (!seen.has(command.id)) {
      seen.add(command.id);
      deduped.push(command);
    }
  }

  return deduped;
}

/**
 * Get commands from installed plugins
 */
async function getPluginCommands() {
  const commands = [];
  const pluginDirs = [
    join(CLAUDE_DIR, 'plugins', 'local'),
    join(CLAUDE_DIR, 'plugins', 'cache')
  ];

  for (const baseDir of pluginDirs) {
    try {
      const entries = await readdir(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

        let pluginPath = join(baseDir, entry.name);
        let pluginName = entry.name;

        // Handle cache directory structure
        if (baseDir.includes('cache')) {
          const vendorDir = pluginPath;
          try {
            const vendorEntries = await readdir(vendorDir, { withFileTypes: true });
            for (const pluginEntry of vendorEntries) {
              if (!pluginEntry.isDirectory() || pluginEntry.name.startsWith('.')) continue;
              const pluginSubDir = join(vendorDir, pluginEntry.name);
              const versionEntries = await readdir(pluginSubDir, { withFileTypes: true });
              for (const versionEntry of versionEntries) {
                if (!versionEntry.isDirectory()) continue;
                const versionPath = join(pluginSubDir, versionEntry.name);
                await loadPluginCommandsFromPath(versionPath, pluginEntry.name, commands);
              }
            }
          } catch {
            // Not a vendor directory
          }
          continue;
        }

        // Load commands from local plugin
        await loadPluginCommandsFromPath(pluginPath, pluginName, commands);
      }
    } catch {
      // Plugin directory doesn't exist
    }
  }

  return commands;
}

/**
 * Load commands from a specific plugin path
 */
async function loadPluginCommandsFromPath(pluginPath, pluginName, commands) {
  const commandsDir = join(pluginPath, 'commands');

  try {
    const files = await readdir(commandsDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const content = await readFile(join(commandsDir, file), 'utf-8');
      const command = parseCommandFile(file, content, pluginName);
      commands.push(command);
    }
  } catch {
    // No commands directory
  }
}

/**
 * Parse a command markdown file
 * @param {string} filename - The command filename (e.g., "commit.md" or "learning:init.md")
 * @param {string} content - The command file content
 * @param {string} [pluginName] - Optional plugin name for plugin commands
 */
function parseCommandFile(filename, content, pluginName = null) {
  const name = filename.replace('.md', '');

  // Extract frontmatter if present and remove it from display content
  let contentWithoutFrontmatter = content;
  let frontmatter = {};
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (fmMatch) {
    contentWithoutFrontmatter = content.slice(fmMatch[0].length);
    // Parse frontmatter
    const lines = fmMatch[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    }
  }

  // Extract title from heading or generate from name
  let title = '';
  const titleMatch = contentWithoutFrontmatter.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    let rawTitle = titleMatch[1];
    // Remove patterns like "/command:name - ", "/plugin:command - ", or "/command - " from start
    rawTitle = rawTitle.replace(/^\/[\w:-]+\s*-\s*/, '');
    rawTitle = rawTitle.replace(/^\/[\w:-]+\s*/, '');
    title = rawTitle.trim();
  }

  // Fall back to converting name to title case
  if (!title) {
    // Handle names with colons (plugin:command) - use the last part for readability
    const nameParts = name.split(':');
    const baseName = nameParts[nameParts.length - 1];
    title = baseName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Extract description from frontmatter or first paragraph
  let description = frontmatter.description || '';
  if (!description) {
    const descMatch = contentWithoutFrontmatter.match(/^#[^\n]+\n+([^#\n][^\n]+)/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }
  // Clean up description - remove surrounding quotes
  description = description.replace(/^["']|["']$/g, '').trim();

  // Determine path based on whether this is a plugin command
  let commandPath;
  if (pluginName) {
    commandPath = join(CLAUDE_DIR, 'plugins', 'local', pluginName, 'commands', filename);
  } else {
    commandPath = join(CLAUDE_DIR, 'commands', filename);
  }

  return {
    id: name,
    command: `/${name}`,
    title,
    description,
    path: commandPath,
    content: contentWithoutFrontmatter
  };
}

/**
 * Get all rules
 */
export async function getRules() {
  const rulesDir = join(CLAUDE_DIR, 'rules');
  const rules = [];

  try {
    const files = await readdir(rulesDir);

    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await readFile(join(rulesDir, file), 'utf-8');
        const rule = parseRuleFile(file, content);
        rules.push(rule);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading rules:', error);
    }
  }

  return rules;
}

/**
 * Parse a rule markdown file
 */
function parseRuleFile(filename, content) {
  const name = filename.replace('.md', '');

  // Extract title
  let title = name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1];
  }

  // Count sections
  const sections = (content.match(/^##\s+/gm) || []).length;

  return {
    id: name,
    title,
    sections,
    path: join(CLAUDE_DIR, 'rules', filename),
    content
  };
}

export default {
  getAgents,
  getSkills,
  getCommands,
  getRules
};
