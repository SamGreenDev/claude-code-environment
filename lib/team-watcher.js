/**
 * Team Watcher - Polls ~/.claude/teams/ for agent team members
 * Feeds discovered team agents into the activity-handler pipeline
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawnAgent, completeAgent, updateAgentTask } from './activity-handler.js';

const TEAMS_DIR = join(homedir(), '.claude', 'teams');
const TASKS_DIR = join(homedir(), '.claude', 'tasks');
const POLL_INTERVAL_MS = 2500;

// Tracked state: Map<teamName, Map<memberName, { agentId, lastTask }>>
const trackedTeams = new Map();

let pollTimer = null;

/**
 * Build deterministic agent ID for a team member
 * @param {string} teamName
 * @param {string} memberName
 * @returns {string}
 */
function teamAgentId(teamName, memberName) {
  return `team:${teamName}:${memberName}`;
}

/**
 * Safely parse JSON from a file path
 * @param {string} filePath
 * @returns {object|null}
 */
function safeReadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve the current task description for a team member
 * Reads task files from ~/.claude/tasks/{teamName}/*.json
 * @param {string} teamName
 * @param {string} memberName
 * @param {object} member - member object from config
 * @returns {string}
 */
function resolveTaskDescription(teamName, memberName, member) {
  const taskDir = join(TASKS_DIR, teamName);
  if (!existsSync(taskDir)) return 'Joining team...';

  try {
    const files = readdirSync(taskDir).filter(f => f.endsWith('.json'));
    let inProgressTask = null;
    let pendingTask = null;

    for (const file of files) {
      const task = safeReadJson(join(taskDir, file));
      if (!task || task.owner !== memberName) continue;

      if (task.status === 'in_progress') {
        inProgressTask = task;
        break; // Best match, stop looking
      }
      if (task.status === 'pending' && !pendingTask) {
        pendingTask = task;
      }
    }

    if (inProgressTask) {
      return inProgressTask.activeForm || inProgressTask.subject || 'Working on task...';
    }
    if (pendingTask) {
      return pendingTask.activeForm || pendingTask.subject || 'Pending task...';
    }
  } catch {
    // Task dir read failed, fall through
  }

  return 'Awaiting task...';
}

/**
 * Determine agent type from member data
 * @param {object} member
 * @returns {string}
 */
function resolveAgentType(member) {
  return member.agentType || 'general-purpose';
}

/**
 * Single poll cycle — read all team configs and diff against tracked state
 */
function pollTeams() {
  if (!existsSync(TEAMS_DIR)) return;

  let currentTeamNames;
  try {
    currentTeamNames = readdirSync(TEAMS_DIR).filter(name => {
      const configPath = join(TEAMS_DIR, name, 'config.json');
      return existsSync(configPath);
    });
  } catch {
    return;
  }

  const seenTeams = new Set(currentTeamNames);

  // Process each discovered team
  for (const teamName of currentTeamNames) {
    const configPath = join(TEAMS_DIR, teamName, 'config.json');
    const config = safeReadJson(configPath);
    if (!config || !Array.isArray(config.members)) continue;

    // Initialize tracking map for new teams
    if (!trackedTeams.has(teamName)) {
      trackedTeams.set(teamName, new Map());

      // Spawn synthetic team-lead agent only if not already in members[]
      const hasLeadMember = config.members.some(m => m.name === 'team-lead');
      if (!hasLeadMember) {
        const leadId = teamAgentId(teamName, 'team-lead');
        spawnAgent({
          agentId: leadId,
          agentType: 'team-lead',
          taskDescription: `Leading team: ${teamName}`,
          source: 'team',
          teamName,
          memberName: 'team-lead'
        });
      }
      console.log(`[team-watcher] New team discovered: ${teamName}`);
    }

    const tracked = trackedTeams.get(teamName);
    const currentMemberNames = new Set();

    // Process each member in config
    for (const member of config.members) {
      const memberName = member.name;
      if (!memberName) continue;
      currentMemberNames.add(memberName);

      const agentId = teamAgentId(teamName, memberName);
      const taskDesc = resolveTaskDescription(teamName, memberName, member);

      if (!tracked.has(memberName)) {
        // New member — spawn agent
        tracked.set(memberName, { agentId, lastTask: taskDesc });
        spawnAgent({
          agentId,
          agentType: resolveAgentType(member),
          taskDescription: taskDesc,
          source: 'team',
          teamName,
          memberName
        });
        console.log(`[team-watcher] Member joined: ${memberName} in ${teamName}`);
      } else {
        // Existing member — check for task description change
        const state = tracked.get(memberName);
        if (taskDesc !== state.lastTask) {
          state.lastTask = taskDesc;
          updateAgentTask({
            agentId,
            taskDescription: taskDesc
          });
        }
      }
    }

    // Check for removed members (member was tracked but no longer in config)
    for (const [memberName, state] of tracked) {
      if (!currentMemberNames.has(memberName)) {
        completeAgent({ agentId: state.agentId, status: 'success' });
        tracked.delete(memberName);
        console.log(`[team-watcher] Member left: ${memberName} from ${teamName}`);
      }
    }
  }

  // Check for removed teams (team was tracked but directory is gone)
  for (const [teamName, tracked] of trackedTeams) {
    if (!seenTeams.has(teamName)) {
      // Complete all tracked members
      for (const [memberName, state] of tracked) {
        completeAgent({ agentId: state.agentId, status: 'success' });
      }
      // Complete the synthetic team-lead (no-op if lead was in members[])
      const leadId = teamAgentId(teamName, 'team-lead');
      if (!tracked.has('team-lead')) {
        completeAgent({ agentId: leadId, status: 'success' });
      }

      trackedTeams.delete(teamName);
      console.log(`[team-watcher] Team removed: ${teamName}`);
    }
  }
}

/**
 * Start polling for team changes
 */
export function startTeamWatcher() {
  if (pollTimer) return; // Already running

  console.log('[team-watcher] Starting team watcher (polling every 2.5s)');

  // Initial poll
  pollTeams();

  // Set up recurring poll
  pollTimer = setInterval(pollTeams, POLL_INTERVAL_MS);
}

/**
 * Stop polling
 */
export function stopTeamWatcher() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[team-watcher] Stopped team watcher');
  }
}

export default { startTeamWatcher, stopTeamWatcher };
