/**
 * Stats cache reader for token usage tracking
 * Reads and analyzes Claude API token usage from stats-cache.json
 */

import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

// Default plan tier limits
// Note: Free tier excluded - users must select Pro, Max 5, Max 20, or Custom
const PLAN_LIMITS = {
  pro: 3000000,      // 3M
  max5: 5000000,     // 5M
  max20: 20000000,   // 20M
  custom: null
};

let statsCache = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds

/**
 * Get current stats from cache file (with in-memory caching)
 * @returns {Promise<object>} Parsed stats object
 */
export async function getStats() {
  const now = Date.now();
  if (statsCache && (now - cacheTime) < CACHE_TTL) {
    return statsCache;
  }

  const statsPath = join(homedir(), '.claude', 'stats-cache.json');
  try {
    const content = await readFile(statsPath, 'utf-8');
    statsCache = JSON.parse(content);
  } catch {
    // File missing on new installs or non-Pro users — return empty default
    statsCache = { entries: [], dailyModelTokens: [], modelUsage: {} };
  }
  cacheTime = now;
  return statsCache;
}

/**
 * Get the configured weekly token limit
 * @returns {Promise<number>} Weekly token limit in tokens
 */
export async function getConfiguredWeeklyLimit() {
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    // Return configured limit, or default to Pro plan (3M)
    return settings.weeklyTokenLimit || PLAN_LIMITS.pro;
  } catch (error) {
    // If settings file doesn't exist or can't be read, use default
    return PLAN_LIMITS.pro;
  }
}

/**
 * Get weekly token usage with warning levels
 * @param {number} limit - Weekly token limit (auto-reads from settings if not provided)
 * @returns {Promise<{tokens: number, limit: number, percentage: number, warning: {level: string, message: ?string}}>}
 */
export async function getWeeklyUsage(limit = null) {
  // Auto-read limit from settings if not provided
  if (limit === null) {
    limit = await getConfiguredWeeklyLimit();
  }
  const stats = await getStats();

  // Determine cutoff date for weekly calculation
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  let cutoff = sevenDaysAgo.toISOString().split('T')[0];

  // Check if user has configured a weekly reset date
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    if (settings.weeklyResetDate) {
      const resetDate = settings.weeklyResetDate; // ISO format: "2026-01-24"

      // Use reset date if it's more recent than 7 days ago
      if (resetDate > cutoff) {
        cutoff = resetDate;
        console.log(`Using weekly reset date: ${resetDate} instead of 7-day cutoff`);
      }
    }
  } catch (error) {
    // Settings file not readable, continue with 7-day cutoff
    console.warn('Could not read weekly reset date from settings:', error.message);
  }

  const weeklyTotal = (stats.dailyModelTokens || [])
    .filter(day => day.date >= cutoff)
    .reduce((sum, day) => {
      return sum + Object.values(day.tokensByModel || {}).reduce((s, v) => s + v, 0);
    }, 0);

  const percentage = Math.round((weeklyTotal / limit) * 100);

  let warning = { level: 'ok', message: null };
  if (percentage >= 95) {
    warning = {
      level: 'critical',
      message: 'Approaching weekly limit - shift to single agent to preserve tokens'
    };
  } else if (percentage >= 80) {
    warning = {
      level: 'warning',
      message: `${percentage}% of weekly limit used`
    };
  }

  return { tokens: weeklyTotal, limit, percentage, warning };
}

/**
 * Get aggregated token usage across all models
 * @returns {Promise<{input: number, output: number, cacheRead: number, cacheCreation: number}>}
 */
export async function getAggregatedUsage() {
  const stats = await getStats();
  const totals = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };

  for (const model of Object.values(stats.modelUsage || {})) {
    totals.input += model.inputTokens || 0;
    totals.output += model.outputTokens || 0;
    totals.cacheRead += model.cacheReadInputTokens || 0;
    totals.cacheCreation += model.cacheCreationInputTokens || 0;
  }

  return totals;
}

/**
 * Clear the in-memory cache (useful for testing or manual refresh)
 */
export function clearCache() {
  statsCache = null;
  cacheTime = 0;
}

export default {
  getStats,
  getWeeklyUsage,
  getAggregatedUsage,
  clearCache,
  getConfiguredWeeklyLimit,
  PLAN_LIMITS
};
