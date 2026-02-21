/**
 * Project memory reader for Claude Code environment
 * Reads auto-memory files from ~/.claude/projects/<project>/memory/
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { PROJECTS_DIR } from './paths.js';

/**
 * Decode an encoded project directory name back to a display path.
 * Encoding: / → -, . → - (so /. becomes --)
 * e.g. "-Users-greensb-Development-portfolio-website" → "/Users/greensb/Development/portfolio-website"
 * e.g. "-Users-greensb--claude" → "/Users/greensb/.claude"
 *
 * Since both / and . map to -, we can't perfectly reverse it.
 * Strategy: build the path segment by segment, checking the filesystem
 * at each step to determine if a dash is a separator or literal.
 */
async function decodeProjectName(encodedName) {
  if (!encodedName.startsWith('-')) return encodedName;

  // Handle -- → /. first
  const normalized = encodedName.replace(/--/g, '/.');

  // Split on remaining dashes (which are either / or literal -)
  const parts = normalized.slice(1).split('-'); // slice(1) removes leading -
  let resolved = '/' + parts[0];

  for (let i = 1; i < parts.length; i++) {
    const withSlash = resolved + '/' + parts[i];
    const withDash = resolved + '-' + parts[i];

    // Check if the slash version exists as a directory
    try {
      const s = await stat(withSlash);
      if (s.isDirectory()) {
        resolved = withSlash;
        continue;
      }
    } catch {
      // Not a valid directory with slash
    }

    // Check if keeping the dash produces a valid directory
    try {
      const s = await stat(withDash);
      if (s.isDirectory()) {
        resolved = withDash;
        continue;
      }
    } catch {
      // Neither exists — default to slash (original encoding intent)
    }

    // Default: treat as slash separator
    resolved = withSlash;
  }

  return resolved;
}

/**
 * Create a short display name from the decoded path.
 * e.g. "/Users/greensb/Development/portfolio-website" → "~/Development/portfolio-website"
 */
function makeDisplayName(decodedPath) {
  const home = homedir();
  if (decodedPath.startsWith(home)) {
    return '~' + decodedPath.slice(home.length);
  }
  return decodedPath;
}

/**
 * Extract the first # heading from markdown content as a title.
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Scan all project memory directories and return summaries.
 */
export async function getProjectMemories() {
  const projects = [];

  let projectDirs;
  try {
    projectDirs = await readdir(PROJECTS_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') return { projects: [] };
    throw error;
  }

  for (const dirName of projectDirs) {
    // Skip hidden files and non-directories
    if (dirName.startsWith('.')) continue;

    const memoryDir = join(PROJECTS_DIR, dirName, 'memory');
    let memoryStat;
    try {
      memoryStat = await stat(memoryDir);
    } catch {
      continue; // No memory directory
    }
    if (!memoryStat.isDirectory()) continue;

    // Check for MEMORY.md
    const mainMemoryPath = join(memoryDir, 'MEMORY.md');
    let mainMemory = null;
    try {
      const content = await readFile(mainMemoryPath, 'utf-8');
      const fileStat = await stat(mainMemoryPath);
      mainMemory = {
        content: content,
        size: fileStat.size,
        lastModified: fileStat.mtime.toISOString(),
      };
    } catch {
      continue; // No MEMORY.md means skip this project
    }

    // Gather topic files (all .md files except MEMORY.md)
    const topicFiles = [];
    try {
      const files = await readdir(memoryDir);
      for (const file of files) {
        if (file === 'MEMORY.md' || !file.endsWith('.md')) continue;
        const filePath = join(memoryDir, file);
        try {
          const fileStat = await stat(filePath);
          if (!fileStat.isFile()) continue;
          const content = await readFile(filePath, 'utf-8');
          topicFiles.push({
            filename: file,
            title: extractTitle(content) || file.replace(/\.md$/, '').replace(/-/g, ' '),
            size: fileStat.size,
            lastModified: fileStat.mtime.toISOString(),
          });
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // readdir failed — proceed with empty topic files
    }

    // Sort topic files by lastModified descending
    topicFiles.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    const decodedPath = await decodeProjectName(dirName);
    projects.push({
      encodedName: dirName,
      displayName: makeDisplayName(decodedPath),
      decodedPath,
      mainMemory,
      topicFiles,
    });
  }

  // Sort projects by mainMemory.lastModified descending
  projects.sort((a, b) => new Date(b.mainMemory.lastModified) - new Date(a.mainMemory.lastModified));

  return { projects };
}

/**
 * Get full detail for a specific project's memory files.
 */
export async function getProjectMemoryDetail(projectName) {
  const memoryDir = join(PROJECTS_DIR, projectName, 'memory');

  // Read MEMORY.md
  let mainContent;
  try {
    mainContent = await readFile(join(memoryDir, 'MEMORY.md'), 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { error: 'Project memory not found' };
    }
    throw error;
  }

  // Read all topic files
  const topicFiles = [];
  try {
    const files = await readdir(memoryDir);
    for (const file of files) {
      if (file === 'MEMORY.md' || !file.endsWith('.md')) continue;
      try {
        const content = await readFile(join(memoryDir, file), 'utf-8');
        const fileStat = await stat(join(memoryDir, file));
        topicFiles.push({
          filename: file,
          title: extractTitle(content) || file.replace(/\.md$/, '').replace(/-/g, ' '),
          content,
          size: fileStat.size,
          lastModified: fileStat.mtime.toISOString(),
        });
      } catch {
        // Skip unreadable
      }
    }
  } catch {
    // No additional files
  }

  // Sort topic files by lastModified descending
  topicFiles.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

  const decodedPath = await decodeProjectName(projectName);
  return {
    encodedName: projectName,
    displayName: makeDisplayName(decodedPath),
    decodedPath,
    mainContent,
    topicFiles,
  };
}
