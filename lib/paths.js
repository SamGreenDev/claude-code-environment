/**
 * Shared path constants and filesystem helpers for the environment plugin.
 * Centralizes the `join(homedir(), '.claude')` pattern used across 11+ files.
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFileSync } from 'fs';
import { stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

// Core directory constants
export const CLAUDE_DIR = join(homedir(), '.claude');
export const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
export const PLUGINS_DIR = join(CLAUDE_DIR, 'plugins');
export const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
export const MISSIONS_DIR = join(CLAUDE_DIR, 'missions');
export const TEAMS_DIR = join(CLAUDE_DIR, 'teams');
export const TASKS_DIR = join(CLAUDE_DIR, 'tasks');
export const RUNS_DIR = join(MISSIONS_DIR, 'runs');

/**
 * Check if a directory exists (async).
 * Identical implementation was in config-reader, plugin-reader, and mcp-reader.
 */
export async function directoryExists(dirPath) {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Safely parse a JSON file, returning null on any error.
 * Identical implementation was in mission-engine, mission-store, and team-watcher.
 */
export function safeReadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}
