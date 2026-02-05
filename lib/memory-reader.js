/**
 * Memory system reader for Claude Code environment
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = join(homedir(), '.claude');
const MEMORY_DIR = join(CLAUDE_DIR, 'memory');

/**
 * Get quick reference data
 */
export async function getQuickRef() {
  try {
    const content = await readFile(join(MEMORY_DIR, 'quick-ref.json'), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading quick-ref.json:', error.message);
    }
    return { issues: [], patterns: [] };
  }
}

/**
 * Get session tracker data
 */
export async function getSessionTracker() {
  try {
    const content = await readFile(join(MEMORY_DIR, 'session-tracker.json'), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading session-tracker.json:', error.message);
    }
    return { sessions: [], currentSession: null };
  }
}

/**
 * Get all issues organized by date
 */
export async function getIssues() {
  const issuesDir = join(MEMORY_DIR, 'issues');
  const issues = [];

  try {
    const dateDirs = await readdir(issuesDir);

    for (const dateDir of dateDirs.sort().reverse()) {
      const datePath = join(issuesDir, dateDir);
      const stats = await stat(datePath);

      if (stats.isDirectory()) {
        const files = await readdir(datePath);

        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const content = await readFile(join(datePath, file), 'utf-8');
              const issue = JSON.parse(content);
              issues.push({
                ...issue,
                date: dateDir,
                file
              });
            } catch {
              // Skip invalid files
            }
          }
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading issues:', error);
    }
  }

  return issues;
}

/**
 * Get memory statistics
 */
export async function getMemoryStats() {
  const quickRef = await getQuickRef();
  const issues = await getIssues();

  // Count patterns
  const patterns = quickRef.patterns || [];
  const patternsByType = {};
  for (const pattern of patterns) {
    const type = pattern.type || 'unknown';
    patternsByType[type] = (patternsByType[type] || 0) + 1;
  }

  // Count issues by severity
  const issuesBySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  for (const issue of issues) {
    const severity = issue.severity || 'medium';
    issuesBySeverity[severity] = (issuesBySeverity[severity] || 0) + 1;
  }

  // Get recent issues (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentIssues = issues.filter(i => {
    const date = new Date(i.date);
    return date >= sevenDaysAgo;
  });

  return {
    totalPatterns: patterns.length,
    patternsByType,
    totalIssues: issues.length,
    issuesBySeverity,
    recentIssuesCount: recentIssues.length
  };
}

/**
 * Get timeline of memory activity
 */
export async function getMemoryTimeline() {
  const issues = await getIssues();

  // Group by date
  const byDate = {};
  for (const issue of issues) {
    const date = issue.date;
    if (!byDate[date]) {
      byDate[date] = [];
    }
    byDate[date].push(issue);
  }

  // Convert to timeline entries
  const timeline = Object.entries(byDate)
    .map(([date, dateIssues]) => ({
      date,
      count: dateIssues.length,
      issues: dateIssues.slice(0, 5) // Limit to 5 per day for display
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30); // Last 30 days

  return timeline;
}

/**
 * Search memory for patterns or issues
 */
export async function searchMemory(query) {
  const quickRef = await getQuickRef();
  const issues = await getIssues();
  const results = [];

  const queryLower = query.toLowerCase();

  // Search patterns
  for (const pattern of quickRef.patterns || []) {
    if (pattern.description?.toLowerCase().includes(queryLower) ||
        pattern.type?.toLowerCase().includes(queryLower)) {
      results.push({
        type: 'pattern',
        ...pattern
      });
    }
  }

  // Search issues
  for (const issue of issues) {
    if (issue.description?.toLowerCase().includes(queryLower) ||
        issue.file?.toLowerCase().includes(queryLower) ||
        issue.message?.toLowerCase().includes(queryLower)) {
      results.push({
        type: 'issue',
        ...issue
      });
    }
  }

  return results.slice(0, 50); // Limit results
}

export default {
  getQuickRef,
  getSessionTracker,
  getIssues,
  getMemoryStats,
  getMemoryTimeline,
  searchMemory
};
