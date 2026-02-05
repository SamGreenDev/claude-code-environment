#!/usr/bin/env node

/**
 * Environment UI Server
 * Web application for visualizing Claude Code environment
 * @author Sam Green <samuel.green2k@gmail.com>
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { createRouter, sendFile, sendJson, getContentType } from './lib/router.js';
import { registerApiRoutes } from './lib/api-handlers.js';
import { initWebSocket, registerActivityRoutes } from './lib/activity-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const UI_COMPONENTS_DIR = join(__dirname, '..', 'ui-components');
const PORT = process.env.PORT || 3848;
const AUTO_SHUTDOWN_MS = 30 * 60 * 1000; // 30 minutes of inactivity

let lastActivity = Date.now();
let shutdownTimer = null;

/**
 * Reset the auto-shutdown timer
 */
function resetShutdownTimer() {
  lastActivity = Date.now();

  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
  }

  shutdownTimer = setTimeout(() => {
    console.log('\n[environment] No activity for 30 minutes, shutting down...');
    process.exit(0);
  }, AUTO_SHUTDOWN_MS);
}

/**
 * Serve static files from public directory or shared ui-components
 */
async function serveStatic(req, res) {
  let filePath = req.url.split('?')[0];

  // Never serve static files for API routes
  if (filePath.startsWith('/api/')) {
    sendJson(res, 404, { error: 'API endpoint not found' });
    return;
  }

  // Serve shared UI components
  if (filePath.startsWith('/ui-components/')) {
    const componentPath = filePath.replace('/ui-components/', '');
    const fullPath = join(UI_COMPONENTS_DIR, componentPath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(UI_COMPONENTS_DIR)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const content = await readFile(fullPath);
      const contentType = getContentType(filePath);
      sendFile(res, content, contentType);
      return;
    } catch (error) {
      sendJson(res, 404, { error: 'Component not found' });
      return;
    }
  }

  // Default to index.html for root and SPA routes
  if (filePath === '/' || !filePath.includes('.')) {
    filePath = '/index.html';
  }

  const fullPath = join(PUBLIC_DIR, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const content = await readFile(fullPath);
    const contentType = getContentType(filePath);
    sendFile(res, content, contentType);
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        const indexContent = await readFile(join(PUBLIC_DIR, 'index.html'));
        sendFile(res, indexContent, 'text/html; charset=utf-8');
      } catch {
        sendJson(res, 404, { error: 'Not found' });
      }
    } else {
      sendJson(res, 500, { error: 'Server error' });
    }
  }
}

// Create router and register API routes
const router = createRouter();
registerApiRoutes(router);
registerActivityRoutes(router);

// Parse URL query string helper
function parseQuery(url) {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return {};
  const queryString = url.slice(queryIndex + 1);
  const params = {};
  for (const pair of queryString.split('&')) {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
  }
  return params;
}

// Create HTTP server
const server = createServer(async (req, res) => {
  // Track activity for auto-shutdown
  resetShutdownTimer();

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Try API routes first
  const handled = await router.handle(req, res);

  // Fall back to static files
  if (!handled) {
    await serveStatic(req, res);
  }
});

// Start server
server.listen(PORT, () => {
  // Initialize WebSocket for activity updates
  initWebSocket(server);

  console.log(`
  ╔════════════════════════════════════════════╗
  ║     Claude Code Environment UI             ║
  ╚════════════════════════════════════════════╝

  Server running at: http://localhost:${PORT}

  Pages:
  - Dashboard:    http://localhost:${PORT}/
  - Activity:     http://localhost:${PORT}/#/activity
  - Agents:       http://localhost:${PORT}/#/agents
  - Skills:       http://localhost:${PORT}/#/skills
  - Commands:     http://localhost:${PORT}/#/commands
  - Knowledge:    http://localhost:${PORT}/#/knowledge
  - Memory:       http://localhost:${PORT}/#/memory
  - Lessons:      http://localhost:${PORT}/#/lessons
  - Settings:     http://localhost:${PORT}/#/settings

  WebSocket:      ws://localhost:${PORT}/ws/activity

  Auto-shutdown after 30 minutes of inactivity.
  Press Ctrl+C to stop.
  `);

  resetShutdownTimer();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[environment] Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
