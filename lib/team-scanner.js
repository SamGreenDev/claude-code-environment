/**
 * Team Scanner - Discovers tmux-based team agents from ~/.claude/teams/
 * Enables Jedi Archives to show teammates spawned in tmux panes.
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { homedir } from 'os';

const TEAMS_DIR = join(homedir(), '.claude', 'teams');
const PROMPT_MAX_LENGTH = 300;

/**
 * Scan all team config files under ~/.claude/teams/
 * @returns {Array} Parsed team config objects
 */
export function scanTeamConfigs() {
  if (!existsSync(TEAMS_DIR)) {
    return [];
  }

  const teams = [];

  try {
    const entries = readdirSync(TEAMS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const configPath = join(TEAMS_DIR, entry.name, 'config.json');
      if (!existsSync(configPath)) continue;

      try {
        const raw = readFileSync(configPath, 'utf8');
        const config = JSON.parse(raw);
        teams.push(config);
      } catch (err) {
        // Skip malformed configs
      }
    }
  } catch (err) {
    console.error('[team-scanner] Failed to scan teams directory:', err.message);
  }

  return teams;
}

/**
 * Check if a tmux pane is still alive
 * @param {string} paneId - Tmux pane ID (e.g., "%24")
 * @returns {boolean} True if the pane exists and is running
 */
export function isTmuxPaneAlive(paneId) {
  if (!paneId) return false;

  try {
    execSync(`tmux display-message -p -t '${paneId}' '#{pane_id}'`, {
      stdio: 'pipe',
      timeout: 3000
    });
    return true;
  } catch {
    // tmux not installed, server not running, or pane doesn't exist
    return false;
  }
}

/**
 * Extract live tmux teammates from a team config
 * @param {object} team - Parsed team config object
 * @returns {Array} Live teammate objects ready for Jedi creation
 */
export function extractTeamMembers(team) {
  if (!team || !Array.isArray(team.members)) return [];

  const teammates = [];

  for (const member of team.members) {
    // Only process tmux-backed members with a pane ID
    if (member.backendType !== 'tmux' || !member.tmuxPaneId) continue;

    // Skip teammates that have been marked inactive by Claude Code
    if (member.isActive === false) continue;

    // Check if the pane is still alive
    if (!isTmuxPaneAlive(member.tmuxPaneId)) continue;

    // Pass raw prompt text for sanitizeDescription() to clean up
    let taskDescription = member.prompt || 'Working on task...';
    if (taskDescription.length > PROMPT_MAX_LENGTH) {
      taskDescription = taskDescription.substring(0, PROMPT_MAX_LENGTH);
    }

    teammates.push({
      agentId: `tmux-${team.name}-${member.name}`,
      name: member.name,
      type: member.agentType || 'general-purpose',
      taskDescription,
      teamName: team.name,
      tmuxPaneId: member.tmuxPaneId
    });
  }

  return teammates;
}

/**
 * Get all live tmux teammates across all teams
 * @returns {Array} Flat array of all live teammate objects
 */
export function getAllLiveTeammates() {
  const teams = scanTeamConfigs();
  const allTeammates = [];

  for (const team of teams) {
    const members = extractTeamMembers(team);
    allTeammates.push(...members);
  }

  return allTeammates;
}
