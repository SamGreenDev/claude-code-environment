/**
 * Lessons Reader - Read and manage lessons learned data
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = join(homedir(), '.claude');
const MEMORY_DIR = join(CLAUDE_DIR, 'memory');
const LESSONS_FILE = join(MEMORY_DIR, 'lessons-learned.json');
const KNOWLEDGE_DIR = join(CLAUDE_DIR, 'knowledge', 'learned');

/**
 * Get all lessons
 */
export async function getLessons() {
  try {
    const content = await readFile(LESSONS_FILE, 'utf-8');
    const data = JSON.parse(content);
    return data.lessons || [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get a single lesson by ID
 */
export async function getLessonById(id) {
  const lessons = await getLessons();
  return lessons.find(l => l.id === id);
}

/**
 * Get lessons statistics
 */
export async function getLessonsStats() {
  try {
    const content = await readFile(LESSONS_FILE, 'utf-8');
    const data = JSON.parse(content);
    const lessons = data.lessons || [];

    // Calculate stats
    const stats = {
      total: lessons.length,
      totalHits: lessons.reduce((sum, l) => sum + (l.hits || 0), 0),
      byCategory: {},
      byTech: {},
      mostHits: [],
      recentCount: 0
    };

    // Calculate date range
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let thisMonth = 0;

    lessons.forEach(lesson => {
      // By category
      const cat = lesson.category || 'other';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      // By tech
      (lesson.tech || []).forEach(tech => {
        stats.byTech[tech] = (stats.byTech[tech] || 0) + 1;
      });

      // Recent count
      const lessonDate = new Date(lesson.timestamp);
      if (lessonDate >= oneWeekAgo) {
        stats.recentCount++;
      }
      if (lessonDate >= oneMonthAgo) {
        thisMonth++;
      }
    });

    // Most hits (top 5)
    stats.mostHits = [...lessons]
      .sort((a, b) => (b.hits || 0) - (a.hits || 0))
      .slice(0, 5)
      .map(l => ({
        id: l.id,
        lesson: l.lesson,
        hits: l.hits || 0,
        category: l.category
      }));

    stats.thisMonth = thisMonth;

    // Date range
    if (lessons.length > 0) {
      const dates = lessons.map(l => new Date(l.timestamp)).sort((a, b) => a - b);
      stats.firstLesson = dates[0].toISOString();
      stats.lastLesson = dates[dates.length - 1].toISOString();
    }

    return stats;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        total: 0,
        totalHits: 0,
        byCategory: {},
        byTech: {},
        mostHits: [],
        recentCount: 0,
        thisMonth: 0
      };
    }
    throw error;
  }
}

/**
 * Delete a lesson by ID
 */
export async function deleteLesson(id) {
  const content = await readFile(LESSONS_FILE, 'utf-8');
  const data = JSON.parse(content);

  const index = data.lessons.findIndex(l => l.id === id);
  if (index === -1) {
    throw new Error('Lesson not found');
  }

  data.lessons.splice(index, 1);
  data.stats.totalLessons = data.lessons.length;
  data.lastUpdated = new Date().toISOString();

  await writeFile(LESSONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return { success: true };
}

/**
 * Promote a lesson to the knowledge base
 */
export async function promoteLesson(id) {
  const lesson = await getLessonById(id);
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  // Determine which tech to use for the knowledge file
  const primaryTech = lesson.tech?.[0] || 'general';
  const techDir = join(KNOWLEDGE_DIR, primaryTech);
  const knowledgeFile = join(techDir, 'README.md');

  // Ensure directory exists
  await mkdir(techDir, { recursive: true });

  // Read existing content or create new
  let existingContent = '';
  try {
    existingContent = await readFile(knowledgeFile, 'utf-8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    existingContent = `# ${primaryTech.charAt(0).toUpperCase() + primaryTech.slice(1)} - Learned Practices\n\nAuto-generated from Claude's self-corrections.\n`;
  }

  // Check if "Learned from Claude Sessions" section exists
  const sectionHeader = '## Learned from Claude Sessions';
  let newContent;

  if (!existingContent.includes(sectionHeader)) {
    // Add section at the end
    newContent = existingContent + `\n\n---\n\n${sectionHeader}\n\n> Auto-generated from Claude's self-corrections. Review and edit as needed.\n`;
  } else {
    newContent = existingContent;
  }

  // Format the lesson entry
  const dateStr = new Date(lesson.timestamp).toISOString().split('T')[0];
  const categoryTitle = lesson.category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const lessonEntry = `
### ${categoryTitle}

**${lesson.lesson}** (learned ${dateStr})
- ${lesson.failedAttempt ? `\`${lesson.failedAttempt}\`` : '_No code snippet_'}
- ${lesson.resolution ? `\`${lesson.resolution}\`` : '_No resolution snippet_'}
${lesson.error ? `- Error: ${lesson.error}` : ''}
`;

  // Append the lesson
  newContent = newContent + lessonEntry;

  await writeFile(knowledgeFile, newContent, 'utf-8');

  return {
    success: true,
    file: knowledgeFile,
    tech: primaryTech
  };
}

/**
 * Search lessons by query
 */
export async function searchLessons(query) {
  const lessons = await getLessons();
  const queryLower = query.toLowerCase();

  return lessons.filter(lesson => {
    // Search in tech
    if (lesson.tech?.some(t => t.toLowerCase().includes(queryLower))) return true;
    // Search in category
    if (lesson.category?.toLowerCase().includes(queryLower)) return true;
    // Search in lesson text
    if (lesson.lesson?.toLowerCase().includes(queryLower)) return true;
    // Search in error
    if (lesson.error?.toLowerCase().includes(queryLower)) return true;
    // Search in failed attempt
    if (lesson.failedAttempt?.toLowerCase().includes(queryLower)) return true;
    return false;
  });
}

/**
 * Increment hit count for a lesson
 */
export async function incrementHits(id) {
  const content = await readFile(LESSONS_FILE, 'utf-8');
  const data = JSON.parse(content);

  const lesson = data.lessons.find(l => l.id === id);
  if (lesson) {
    lesson.hits = (lesson.hits || 0) + 1;
    data.stats.totalHits = data.lessons.reduce((sum, l) => sum + (l.hits || 0), 0);
    data.lastUpdated = new Date().toISOString();
    await writeFile(LESSONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  return { success: true, hits: lesson?.hits || 0 };
}

export default {
  getLessons,
  getLessonById,
  getLessonsStats,
  deleteLesson,
  promoteLesson,
  searchLessons,
  incrementHits
};
