/**
 * Auto-memory scanner for Claude Code environment
 * Reads per-project MEMORY.md files from ~/.claude/projects/{name}/memory/
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { CLAUDE_DIR, PROJECTS_DIR } from './paths.js';

/**
 * Decode a dash-encoded directory name back to the original filesystem path.
 * Claude Code encodes paths like: /Users/samgreen/.claude -> -Users-samgreen--claude
 * Rules:
 * - Leading '-' = /
 * - '--' = /. (dot-prefixed directory)
 * - '-' between segments = / or literal dash (resolved via fs probing)
 */
async function decodeDirName(dirName) {
  let raw = dirName.startsWith('-') ? dirName.slice(1) : dirName;

  // Split on '--' for dot-prefixed segments
  const dotParts = raw.split('--');

  const allSegments = [];
  for (let i = 0; i < dotParts.length; i++) {
    const dashed = dotParts[i].split('-').filter(Boolean);
    if (i > 0 && dashed.length > 0) {
      dashed[0] = '.' + dashed[0];
    }
    allSegments.push(...dashed);
  }

  return greedyProbe('/', allSegments);
}

/**
 * Greedily resolve dash-separated segments into a real filesystem path.
 * At each level, tries the longest possible directory name first.
 */
async function greedyProbe(basePath, segments) {
  if (segments.length === 0) return basePath;

  for (let len = segments.length; len >= 1; len--) {
    const candidate = segments.slice(0, len).join('-');
    const testPath = join(basePath, candidate);
    try {
      const s = await stat(testPath);
      if (s.isDirectory()) {
        const remaining = segments.slice(len);
        if (remaining.length === 0) return testPath;
        return await greedyProbe(testPath, remaining);
      }
    } catch {
      // path doesn't exist, try shorter
    }
  }

  // Fallback: join all as separate path components
  return join(basePath, ...segments);
}

/**
 * Scan all projects that have auto-memory files.
 * Returns project list with decoded paths, file counts, last modified dates.
 */
export async function getProjects() {
  const projects = [];

  try {
    const dirs = await readdir(PROJECTS_DIR);

    for (const dir of dirs) {
      const memoryDir = join(PROJECTS_DIR, dir, 'memory');

      try {
        const memoryStat = await stat(memoryDir);
        if (!memoryStat.isDirectory()) continue;

        const files = await readdir(memoryDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        if (mdFiles.length === 0) continue;

        // Find most recent modification time across memory files
        let lastModified = memoryStat.mtime;
        for (const f of mdFiles) {
          try {
            const fStat = await stat(join(memoryDir, f));
            if (fStat.mtime > lastModified) lastModified = fStat.mtime;
          } catch { /* skip */ }
        }

        const decodedPath = await decodeDirName(dir);

        projects.push({
          id: dir,
          path: decodedPath,
          name: decodedPath.split('/').pop() || dir,
          fileCount: mdFiles.length,
          files: mdFiles,
          lastModified: lastModified.toISOString()
        });
      } catch {
        // No memory dir or can't read — skip
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error scanning projects:', error.message);
    }
  }

  projects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  return projects;
}

/**
 * Read all .md files from a specific project's memory directory.
 */
export async function getProjectMemory(projectId) {
  const memoryDir = join(PROJECTS_DIR, projectId, 'memory');
  const files = [];

  try {
    const entries = await readdir(memoryDir);

    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;

      const filePath = join(memoryDir, entry);
      try {
        const content = await readFile(filePath, 'utf-8');
        const fStat = await stat(filePath);

        files.push({
          name: entry,
          content,
          size: fStat.size,
          lastModified: fStat.mtime.toISOString()
        });
      } catch { /* skip unreadable files */ }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading project memory:', error.message);
    }
  }

  // MEMORY.md first, then alphabetical
  files.sort((a, b) => {
    if (a.name === 'MEMORY.md') return -1;
    if (b.name === 'MEMORY.md') return 1;
    return a.name.localeCompare(b.name);
  });

  return files;
}

/**
 * Get aggregate memory statistics across all projects.
 */
export async function getMemoryStats() {
  let totalProjects = 0;
  let projectsWithMemory = 0;
  let totalFiles = 0;

  try {
    const dirs = await readdir(PROJECTS_DIR);
    totalProjects = dirs.length;

    for (const dir of dirs) {
      const memoryDir = join(PROJECTS_DIR, dir, 'memory');
      try {
        const files = await readdir(memoryDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        if (mdFiles.length > 0) {
          projectsWithMemory++;
          totalFiles += mdFiles.length;
        }
      } catch { /* skip */ }
    }
  } catch {
    // No projects dir
  }

  return { totalProjects, projectsWithMemory, totalFiles };
}

/**
 * Full-text search across all MEMORY.md files.
 * Returns matches with project info and context snippets.
 */
export async function searchMemory(query) {
  const results = [];
  const queryLower = query.toLowerCase();

  try {
    const dirs = await readdir(PROJECTS_DIR);

    for (const dir of dirs) {
      const memoryDir = join(PROJECTS_DIR, dir, 'memory');

      try {
        const files = await readdir(memoryDir);

        for (const file of files) {
          if (!file.endsWith('.md')) continue;

          try {
            const content = await readFile(join(memoryDir, file), 'utf-8');
            if (!content.toLowerCase().includes(queryLower)) continue;

            const decodedPath = await decodeDirName(dir);

            // Extract context snippet around the match
            const idx = content.toLowerCase().indexOf(queryLower);
            const start = Math.max(0, idx - 60);
            const end = Math.min(content.length, idx + query.length + 60);
            let snippet = content.slice(start, end).replace(/\n/g, ' ').trim();
            if (start > 0) snippet = '...' + snippet;
            if (end < content.length) snippet += '...';

            results.push({
              projectId: dir,
              projectPath: decodedPath,
              projectName: decodedPath.split('/').pop() || dir,
              file,
              snippet
            });
          } catch { /* skip unreadable */ }
        }
      } catch { /* no memory dir */ }
    }
  } catch {
    // No projects dir
  }

  return results.slice(0, 50);
}

export default {
  getProjects,
  getProjectMemory,
  getMemoryStats,
  searchMemory
};
