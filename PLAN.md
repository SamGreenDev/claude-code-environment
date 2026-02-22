# Implementation Plan: Sidebar Navigation + Project Server Manager

## Overview

Two interconnected changes to the Environment Dashboard:
1. **Sidebar Navigation** — Replace the horizontal top nav with a collapsible left sidebar
2. **Project Server Manager** — New "Projects" page for managing local dev servers

---

## Part 1: Sidebar Navigation

### 1.1 HTML Changes — `public/index.html`

**Replace** the `<header>` block (lines 21–62) with a slim topbar + sidebar structure.

**New app shell:**

```html
<div id="app">
  <!-- Slim Top Bar: hamburger + logo + theme toggle -->
  <header class="topbar">
    <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle sidebar">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    <a href="#/" class="logo">
      <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>Environment</span>
    </a>
    <div class="topbar-spacer"></div>
    <button class="theme-toggle" id="theme-toggle" title="Toggle theme" aria-label="Toggle theme">
      <!-- sun/moon SVGs unchanged -->
    </button>
  </header>

  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <nav class="sidebar-nav">
      <a href="#/activity" class="sidebar-link" data-route="activity">
        <svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span class="sidebar-label">Activity</span>
      </a>

      <!-- Collapsible: Customizations -->
      <div class="sidebar-group" data-group="customizations">
        <button class="sidebar-group-toggle">
          <svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l..."/>
          </svg>
          <span class="sidebar-label">Customizations</span>
          <svg class="sidebar-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="sidebar-group-items">
          <a href="#/agents" class="sidebar-link sidebar-link-nested" data-route="agents">Agents</a>
          <a href="#/skills" class="sidebar-link sidebar-link-nested" data-route="skills">Skills</a>
          <a href="#/commands" class="sidebar-link sidebar-link-nested" data-route="commands">Commands</a>
          <a href="#/rules" class="sidebar-link sidebar-link-nested" data-route="rules">Rules</a>
        </div>
      </div>

      <a href="#/plugins" class="sidebar-link" data-route="plugins">
        <svg class="sidebar-icon" ...><!-- plug icon --></svg>
        <span class="sidebar-label">Plugins</span>
      </a>
      <a href="#/mcp-servers" class="sidebar-link" data-route="mcp-servers">
        <svg class="sidebar-icon" ...><!-- server icon --></svg>
        <span class="sidebar-label">MCP Servers</span>
      </a>
      <a href="#/memory" class="sidebar-link" data-route="memory">
        <svg class="sidebar-icon" ...><!-- brain icon --></svg>
        <span class="sidebar-label">Memory</span>
      </a>

      <!-- Collapsible: Missions -->
      <div class="sidebar-group" data-group="missions">
        <button class="sidebar-group-toggle">
          <svg class="sidebar-icon" ...><!-- rocket icon --></svg>
          <span class="sidebar-label">Missions</span>
          <svg class="sidebar-chevron" ...><!-- chevron --></svg>
        </button>
        <div class="sidebar-group-items">
          <a href="#/mission-builder" class="sidebar-link sidebar-link-nested" data-route="mission-builder">Builder</a>
          <a href="#/holonet" class="sidebar-link sidebar-link-nested" data-route="holonet">Holonet</a>
          <a href="#/comms" class="sidebar-link sidebar-link-nested" data-route="comms">Comms</a>
        </div>
      </div>

      <!-- NEW: Projects -->
      <a href="#/projects" class="sidebar-link" data-route="projects">
        <svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        <span class="sidebar-label">Projects</span>
      </a>

      <!-- Spacer pushes Settings to bottom -->
      <div class="sidebar-spacer"></div>

      <a href="#/settings" class="sidebar-link" data-route="settings">
        <svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        <span class="sidebar-label">Settings</span>
      </a>
    </nav>
  </aside>

  <!-- Main Content -->
  <main id="main-content" class="main">...</main>
  <footer class="footer">...</footer>
</div>
```

**New templates to add** (before `error-template`):

```html
<template id="projects-template">
  <div class="page-container projects-page">
    <div class="page-header">
      <div>
        <h1>Projects</h1>
        <p class="subtitle">Manage local development servers</p>
      </div>
      <button class="btn btn-primary" id="add-project-btn">+ Add Project</button>
    </div>
    <div class="projects-list" id="projects-list">
      <!-- Project cards rendered here -->
    </div>
  </div>
</template>

<template id="project-card-template">
  <div class="project-card" data-project-id="">
    <div class="project-card-header">
      <span class="project-status-dot"></span>
      <h3 class="project-name"></h3>
      <code class="project-port-badge"></code>
      <div class="project-actions">
        <button class="btn btn-sm btn-primary project-start-btn" title="Start server">Start</button>
        <button class="btn btn-sm btn-danger project-stop-btn" title="Stop server" style="display:none">Stop</button>
        <button class="btn btn-sm btn-secondary project-open-btn" title="Open in browser" style="display:none">Open</button>
        <button class="btn btn-sm btn-secondary project-edit-btn" title="Edit">Edit</button>
        <button class="btn btn-sm btn-danger project-delete-btn" title="Remove">Delete</button>
      </div>
    </div>
    <div class="project-card-meta">
      <span class="project-path"></span>
      <code class="project-command"></code>
    </div>
    <div class="project-output-panel" style="display:none">
      <div class="project-output-header">
        <span>Output</span>
        <button class="btn btn-xs btn-secondary project-clear-btn">Clear</button>
      </div>
      <pre class="project-output"></pre>
    </div>
  </div>
</template>

<template id="project-form-modal-template">
  <div class="modal">
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">Add Project</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form class="project-form" id="project-form">
          <div class="form-group">
            <label for="pf-name">Project Name</label>
            <input type="text" id="pf-name" required placeholder="My App" />
          </div>
          <div class="form-group">
            <label for="pf-path">File Path</label>
            <input type="text" id="pf-path" required placeholder="/Users/you/my-app" />
          </div>
          <div class="form-group">
            <label for="pf-command">Start Command</label>
            <input type="text" id="pf-command" required placeholder="npm run dev" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="pf-port">Port</label>
              <input type="number" id="pf-port" placeholder="3000" />
            </div>
            <div class="form-group">
              <label for="pf-url">URL to Open</label>
              <input type="text" id="pf-url" placeholder="http://localhost:3000" />
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
```

### 1.2 CSS Changes — `public/styles.css`

**Remove:** All `.header`, `.header-content`, `.header::after`, `.nav`, `.nav-link`, `.nav-link.active`, `.nav-link::before`, `.nav-link-activity`, `.nav-link-missions`, `.nav-link-holonet`, `.nav-link-comms` rules. Also remove the `@media` rule that changes `.header-content` to column.

**Add new blocks:**

```css
/* ═══ Topbar ═══ */
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 48px;
  background: linear-gradient(180deg, var(--bg-secondary) 0%, rgba(26, 26, 26, 0.95) 100%);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  padding: 0 var(--space-md);
  gap: var(--space-md);
  backdrop-filter: blur(12px);
}

.topbar::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 20%, var(--accent) 80%, transparent 100%);
  opacity: 0.3;
}

.topbar-spacer { flex: 1; }

.sidebar-toggle {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
}
.sidebar-toggle:hover { background: var(--bg-hover); }

/* ═══ Sidebar ═══ */
.sidebar {
  position: fixed;
  top: 48px;
  left: 0;
  bottom: 0;
  width: 220px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  z-index: 90;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width var(--transition-normal);
}

.sidebar.collapsed {
  width: 52px;
}

.sidebar.collapsed .sidebar-label,
.sidebar.collapsed .sidebar-chevron,
.sidebar.collapsed .sidebar-group-items {
  display: none;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-sm);
  flex: 1;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-sm);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition: all var(--transition-fast);
  border-left: 2px solid transparent;
}

.sidebar-link:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.sidebar-link.active {
  color: var(--accent);
  background: var(--bg-glow);
  border-left-color: var(--accent);
}

.sidebar-link-nested {
  padding-left: calc(var(--space-sm) + 26px);
  font-size: 0.75rem;
}

.sidebar-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Collapsible group */
.sidebar-group-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-sm);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition: all var(--transition-fast);
  text-align: left;
}

.sidebar-group-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.sidebar-chevron {
  width: 14px;
  height: 14px;
  margin-left: auto;
  transition: transform var(--transition-fast);
}

.sidebar-group.expanded .sidebar-chevron {
  transform: rotate(90deg);
}

.sidebar-group-items {
  display: none;
}

.sidebar-group.expanded .sidebar-group-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-group.has-active-child > .sidebar-group-toggle {
  color: var(--accent);
}

.sidebar-spacer {
  flex: 1;
}

/* ═══ Layout adjustments ═══ */
.main {
  margin-left: 220px;
  transition: margin-left var(--transition-normal);
  padding: var(--space-xl);
  min-height: calc(100vh - 48px);
}

.sidebar.collapsed ~ .main {
  margin-left: 52px;
}

.footer {
  margin-left: 220px;
  transition: margin-left var(--transition-normal);
}

.sidebar.collapsed ~ * ~ .footer {
  margin-left: 52px;
}

/* Mobile: sidebar as overlay */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    width: 220px !important;
  }
  .sidebar.mobile-open {
    transform: translateX(0);
    box-shadow: var(--shadow-lg);
  }
  .main, .footer {
    margin-left: 0 !important;
  }
}
```

**Project page CSS:** (see Section 2.6)

### 1.3 JavaScript Changes — `public/app.js`

**Add sidebar initialization to `DOMContentLoaded`:**

```javascript
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const COLLAPSED_KEY = 'claude-ui-sidebar-collapsed';
  const GROUPS_KEY = 'claude-ui-sidebar-groups';

  // Restore collapsed state
  if (localStorage.getItem(COLLAPSED_KEY) === 'true') {
    sidebar.classList.add('collapsed');
  }

  // Toggle collapse/expand
  toggle.addEventListener('click', () => {
    // On mobile: toggle overlay
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
    } else {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem(COLLAPSED_KEY, sidebar.classList.contains('collapsed'));
    }
  });

  // Collapsible groups
  const savedGroups = JSON.parse(localStorage.getItem(GROUPS_KEY) || '{"customizations":true,"missions":false}');
  sidebar.querySelectorAll('.sidebar-group').forEach(group => {
    const name = group.dataset.group;
    if (savedGroups[name]) group.classList.add('expanded');

    group.querySelector('.sidebar-group-toggle').addEventListener('click', () => {
      group.classList.toggle('expanded');
      const state = JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}');
      state[name] = group.classList.contains('expanded');
      localStorage.setItem(GROUPS_KEY, JSON.stringify(state));
    });
  });
}
```

**Update `handleRoute()` (lines 190–266):**

Replace `.nav-link` selector with `.sidebar-link`:

```javascript
// Update active sidebar link
document.querySelectorAll('.sidebar-link').forEach(link => {
  const route = link.dataset.route;
  link.classList.toggle('active', route === path);
});

// Auto-expand parent group if nested link is active
document.querySelectorAll('.sidebar-group').forEach(group => {
  const hasActive = group.querySelector('.sidebar-link.active');
  group.classList.toggle('has-active-child', !!hasActive);
  if (hasActive && !group.classList.contains('expanded')) {
    group.classList.add('expanded');
  }
});

// Close mobile sidebar on navigation
const sidebar = document.getElementById('sidebar');
if (sidebar) sidebar.classList.remove('mobile-open');
```

**Add to router switch:**
```javascript
case 'projects':
  renderProjectsPage();
  break;
```

**Add to templates object:**
```javascript
projects: document.getElementById('projects-template'),
projectCard: document.getElementById('project-card-template'),
projectFormModal: document.getElementById('project-form-modal-template'),
```

**Add to state:**
```javascript
projects: [],
projectsWs: null,
```

**Add cleanup in `handleRoute()`:**
```javascript
// Clean up projects WebSocket when navigating away
if (path !== 'projects' && state.projectsWs) {
  state.projectsWs.close();
  state.projectsWs = null;
}
```

---

## Part 2: Project Server Manager

### 2.1 Data Model — `~/.claude/projects.json`

```json
[
  {
    "id": "proj_1708600000_a1b2c3",
    "name": "My App",
    "path": "/Users/greensb/projects/my-app",
    "command": "npm run dev",
    "port": 3000,
    "url": "http://localhost:3000",
    "createdAt": "2026-02-22T10:00:00Z"
  }
]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | auto | `proj_${Date.now()}_${random}` |
| `name` | string | yes | Display name |
| `path` | string | yes | Absolute path to project root |
| `command` | string | yes | Shell command to start server |
| `port` | number | no | Expected port (display only) |
| `url` | string | no | URL to open in browser; auto-derived from port if omitted |
| `createdAt` | string | auto | ISO timestamp |

### 2.2 New File — `lib/project-server-manager.js`

Core process management module. ~150 lines.

```javascript
import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS_FILE = join(homedir(), '.claude', 'projects.json');
const MAX_LOG_LINES = 500;

// ─── In-memory state ───
const processes = new Map();  // id → { proc, logs[], startedAt }
let wsClients = new Set();

// ─── Persistence ───

export async function loadProjects() {
  if (!existsSync(PROJECTS_FILE)) return [];
  return JSON.parse(await readFile(PROJECTS_FILE, 'utf-8'));
}

async function saveProjects(projects) {
  await writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// ─── CRUD ───

export async function addProject({ name, path, command, port, url }) {
  const projects = await loadProjects();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const project = {
    id, name, path, command,
    port: port ? Number(port) : null,
    url: url || (port ? `http://localhost:${port}` : null),
    createdAt: new Date().toISOString(),
  };
  projects.push(project);
  await saveProjects(projects);
  return project;
}

export async function updateProject(id, updates) {
  const projects = await loadProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Project not found');
  // Only allow safe updates
  const { name, path, command, port, url } = updates;
  if (name !== undefined) projects[idx].name = name;
  if (path !== undefined) projects[idx].path = path;
  if (command !== undefined) projects[idx].command = command;
  if (port !== undefined) projects[idx].port = port ? Number(port) : null;
  if (url !== undefined) projects[idx].url = url || null;
  await saveProjects(projects);
  return projects[idx];
}

export async function removeProject(id) {
  if (processes.has(id)) await stopProject(id);
  const projects = await loadProjects();
  await saveProjects(projects.filter(p => p.id !== id));
}

// ─── Process Lifecycle ───

export async function startProject(id) {
  if (processes.has(id)) throw new Error('Project already running');

  const projects = await loadProjects();
  const project = projects.find(p => p.id === id);
  if (!project) throw new Error('Project not found');
  if (!existsSync(project.path)) throw new Error(`Path does not exist: ${project.path}`);

  const proc = spawn(project.command, [], {
    cwd: project.path,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,  // Creates process group for clean kill
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  const logs = [];

  const handleData = (stream) => (chunk) => {
    const lines = chunk.toString().split('\n').filter(l => l);
    for (const line of lines) {
      logs.push({ line, stream, ts: Date.now() });
      if (logs.length > MAX_LOG_LINES) logs.shift();
      broadcast({ type: 'project:log', id, line, stream, ts: Date.now() });
    }
  };

  proc.stdout.on('data', handleData('stdout'));
  proc.stderr.on('data', handleData('stderr'));

  proc.on('error', (err) => {
    broadcast({ type: 'project:status', id, status: 'error', message: err.message });
    processes.delete(id);
  });

  proc.on('close', (code) => {
    broadcast({ type: 'project:status', id, status: 'stopped', exitCode: code });
    processes.delete(id);
  });

  processes.set(id, { proc, logs, startedAt: Date.now() });
  broadcast({ type: 'project:status', id, status: 'running', pid: proc.pid });

  return { status: 'running', pid: proc.pid };
}

export async function stopProject(id) {
  const entry = processes.get(id);
  if (!entry) throw new Error('Project not running');

  return new Promise((resolve) => {
    const forceTimer = setTimeout(() => {
      try { process.kill(-entry.proc.pid, 'SIGKILL'); } catch {}
    }, 5000);

    entry.proc.on('close', () => {
      clearTimeout(forceTimer);
      processes.delete(id);
      resolve({ status: 'stopped' });
    });

    // Kill process group (shell + children)
    try {
      process.kill(-entry.proc.pid, 'SIGTERM');
    } catch {
      try { entry.proc.kill('SIGTERM'); } catch {}
    }
  });
}

// ─── Query ───

export function getStatuses() {
  const result = {};
  for (const [id, entry] of processes) {
    result[id] = { status: 'running', pid: entry.proc.pid, startedAt: entry.startedAt };
  }
  return result;
}

export function getLogs(id) {
  return processes.get(id)?.logs || [];
}

// ─── WebSocket ───

export function addWsClient(ws) {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: 'init', statuses: getStatuses() }));
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of wsClients) {
    if (ws.readyState === 1) {
      try { ws.send(data); } catch {}
    }
  }
}

// ─── Cleanup ───

export function shutdownAll() {
  for (const [id, entry] of processes) {
    try { process.kill(-entry.proc.pid, 'SIGTERM'); } catch {
      try { entry.proc.kill('SIGTERM'); } catch {}
    }
  }
  processes.clear();
}
```

### 2.3 New File — `lib/project-api-handler.js`

REST endpoint handlers. ~80 lines.

```javascript
import { sendJson } from './router.js';
import * as pm from './project-server-manager.js';

export function registerProjectRoutes(router) {
  router.get('/api/projects', handleGetProjects);
  router.post('/api/projects', handleAddProject);
  router.put('/api/projects/:id', handleUpdateProject);
  router.delete('/api/projects/:id', handleDeleteProject);
  router.post('/api/projects/:id/start', handleStartProject);
  router.post('/api/projects/:id/stop', handleStopProject);
  router.get('/api/projects/:id/logs', handleGetLogs);
}

async function handleGetProjects(req, res) {
  try {
    const projects = await pm.loadProjects();
    const statuses = pm.getStatuses();
    sendJson(res, 200, {
      projects: projects.map(p => ({
        ...p,
        status: statuses[p.id]?.status || 'stopped',
        pid: statuses[p.id]?.pid || null,
      }))
    });
  } catch (err) {
    sendJson(res, 500, { error: 'Failed to load projects' });
  }
}

async function handleAddProject(req, res) {
  try {
    const { name, path, command, port, url } = req.body;
    if (!name || !path || !command) {
      return sendJson(res, 400, { error: 'name, path, and command are required' });
    }
    const project = await pm.addProject({ name, path, command, port, url });
    sendJson(res, 201, { project });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handleUpdateProject(req, res) {
  try {
    const project = await pm.updateProject(req.params.id, req.body);
    sendJson(res, 200, { project });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleDeleteProject(req, res) {
  try {
    await pm.removeProject(req.params.id);
    sendJson(res, 200, { status: 'deleted' });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleStartProject(req, res) {
  try {
    const result = await pm.startProject(req.params.id);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleStopProject(req, res) {
  try {
    const result = await pm.stopProject(req.params.id);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

async function handleGetLogs(req, res) {
  try {
    const logs = pm.getLogs(req.params.id);
    sendJson(res, 200, { logs });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}
```

### 2.4 WebSocket — `/ws/projects`

Add a 4th WebSocket endpoint. Modify `lib/activity-handler.js` `initWebSocket()`:

**In the `server.on('upgrade')` handler, add:**

```javascript
} else if (url.pathname === '/ws/projects') {
  projectsWss.handleUpgrade(request, socket, head, (ws) => {
    projectsWss.emit('connection', ws, request);
  });
}
```

**Create the WSS in `server.js`:**

```javascript
import { WebSocketServer } from 'ws';
import { addWsClient as addProjectWsClient } from './lib/project-server-manager.js';

// In initWebSocket or server.js after server creation:
const projectsWss = new WebSocketServer({ noServer: true });
projectsWss.on('connection', (ws) => {
  addProjectWsClient(ws);
});
```

**Decision:** The cleanest approach is to add the projects WSS creation and upgrade handling directly in `activity-handler.js`'s `initWebSocket()`, since it already manages all upgrade routing. Pass an `onProjectConnection` callback in the `options` parameter (same pattern as `onSessionConnection` and `onMissionUpgrade`).

**WebSocket protocol (server → client):**

| Type | Payload | Trigger |
|------|---------|---------|
| `init` | `{ statuses: { [id]: { status, pid, startedAt } } }` | Client connects |
| `project:status` | `{ id, status, pid?, exitCode?, message? }` | Start/stop/error/crash |
| `project:log` | `{ id, line, stream, ts }` | Each stdout/stderr line |

### 2.5 Server Integration — `server.js` Changes

```javascript
// Add imports
import { registerProjectRoutes } from './lib/project-api-handler.js';
import { addWsClient as addProjectWsClient, shutdownAll as shutdownProjects } from './lib/project-server-manager.js';

// Register routes (after existing registrations)
registerProjectRoutes(router);

// Update initWebSocket call to include project WS callback
initWebSocket(server, {
  onSessionConnection: addSessionClient,
  onMissionUpgrade: handleMissionUpgrade,
  onProjectConnection: addProjectWsClient,  // NEW
});

// Update SIGINT handler
process.on('SIGINT', () => {
  shutdownProjects();   // Kill all project child processes
  shutdownActivity();
  // ... existing shutdown
});
```

### 2.6 Project Page CSS (add to `styles.css`)

```css
/* ═══ Projects Page ═══ */
.projects-page .page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.project-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-md);
  transition: border-color var(--transition-fast);
}

.project-card:hover {
  border-color: var(--border-default);
}

.project-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  cursor: pointer;
}

.project-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);
}

.project-status-dot.running {
  background: var(--success-light);
  box-shadow: 0 0 8px var(--success);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.project-name {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
}

.project-port-badge {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.project-actions {
  display: flex;
  gap: 4px;
}

.project-card-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 var(--space-lg) var(--space-md);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.project-output-panel {
  border-top: 1px solid var(--border-subtle);
}

.project-output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-md);
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.project-output {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  padding: var(--space-sm) var(--space-md);
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-primary);
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

.project-output .log-stderr { color: var(--error); }

/* Project form */
.project-form .form-group {
  margin-bottom: var(--space-md);
}

.project-form label {
  display: block;
  margin-bottom: var(--space-xs);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  font-family: var(--font-display);
}

.project-form input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.875rem;
}

.project-form input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(199, 70, 52, 0.2);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--space-md);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}
```

### 2.7 Frontend JavaScript — Projects Page (`public/app.js`)

Full render function and WS integration:

```javascript
// ─── Projects Page ───

let projectsWs = null;

async function renderProjectsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { projects } = await api('/projects');
    state.projects = projects;

    const content = templates.projects.content.cloneNode(true);
    const list = content.getElementById('projects-list');

    if (projects.length === 0) {
      list.innerHTML = `
        <div class="empty-state empty-state-centered">
          <p>No projects configured yet</p>
          <p class="empty-state-hint">Add a project to manage its dev server from here</p>
        </div>
      `;
    } else {
      projects.forEach(p => list.appendChild(createProjectCard(p)));
    }

    // Wire up add button after inserting to DOM
    main.innerHTML = '';
    main.appendChild(content);

    document.getElementById('add-project-btn')?.addEventListener('click', () => {
      showProjectFormModal();
    });

    // Connect WebSocket for live updates
    connectProjectsWs();
  } catch (err) {
    showError(main, err.message);
  }
}

function createProjectCard(project) {
  const card = templates.projectCard.content.cloneNode(true);
  const el = card.querySelector('.project-card');
  el.dataset.projectId = project.id;

  const isRunning = project.status === 'running';

  card.querySelector('.project-name').textContent = project.name;
  card.querySelector('.project-path').textContent = project.path;
  card.querySelector('.project-command').textContent = project.command;
  card.querySelector('.project-port-badge').textContent = project.port ? `:${project.port}` : '';

  const dot = card.querySelector('.project-status-dot');
  if (isRunning) dot.classList.add('running');

  const startBtn = card.querySelector('.project-start-btn');
  const stopBtn = card.querySelector('.project-stop-btn');
  const openBtn = card.querySelector('.project-open-btn');

  if (isRunning) {
    startBtn.style.display = 'none';
    stopBtn.style.display = '';
    if (project.url) openBtn.style.display = '';
  }

  startBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await api(`/projects/${project.id}/start`, { method: 'POST' });
      showToast(`Started ${project.name}`, 'success');
      renderProjectsPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  stopBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await api(`/projects/${project.id}/stop`, { method: 'POST' });
      showToast(`Stopped ${project.name}`, 'success');
      renderProjectsPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (project.url) window.open(project.url, '_blank');
  });

  card.querySelector('.project-edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showProjectFormModal(project);
  });

  card.querySelector('.project-delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${project.name}"?`)) return;
    try {
      await api(`/projects/${project.id}`, { method: 'DELETE' });
      renderProjectsPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Toggle output panel on card header click
  const outputPanel = card.querySelector('.project-output-panel');
  const logOutput = card.querySelector('.project-output');

  card.querySelector('.project-card-header').addEventListener('click', async () => {
    const isHidden = outputPanel.style.display === 'none';
    outputPanel.style.display = isHidden ? '' : 'none';
    if (isHidden && isRunning) {
      // Load buffered logs
      try {
        const { logs } = await api(`/projects/${project.id}/logs`);
        logOutput.textContent = '';
        logs.forEach(l => {
          const span = document.createElement('span');
          span.className = `log-${l.stream}`;
          span.textContent = l.line + '\n';
          logOutput.appendChild(span);
        });
        logOutput.scrollTop = logOutput.scrollHeight;
      } catch {}
    }
  });

  // Clear button
  card.querySelector('.project-clear-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    logOutput.textContent = '';
  });

  return card;
}

function showProjectFormModal(existing = null) {
  const frag = templates.projectFormModal.content.cloneNode(true);

  if (existing) {
    frag.querySelector('.modal-title').textContent = 'Edit Project';
    frag.querySelector('#pf-name').value = existing.name || '';
    frag.querySelector('#pf-path').value = existing.path || '';
    frag.querySelector('#pf-command').value = existing.command || '';
    frag.querySelector('#pf-port').value = existing.port || '';
    frag.querySelector('#pf-url').value = existing.url || '';
  }

  const closeModal = () => {
    if (state.modal) document.body.removeChild(state.modal);
    state.modal = null;
  };

  frag.querySelector('.modal-close').addEventListener('click', closeModal);
  frag.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  frag.querySelector('.modal-close-btn')?.addEventListener('click', closeModal);

  frag.querySelector('#project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: frag.querySelector('#pf-name')?.value || document.getElementById('pf-name').value,
      path: document.getElementById('pf-path').value,
      command: document.getElementById('pf-command').value,
      port: parseInt(document.getElementById('pf-port').value) || null,
      url: document.getElementById('pf-url').value || null,
    };

    try {
      if (existing) {
        await api(`/projects/${existing.id}`, { method: 'PUT', body });
      } else {
        await api('/projects', { method: 'POST', body });
      }
      closeModal();
      renderProjectsPage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.body.appendChild(frag);
  state.modal = document.body.lastElementChild;
}

// ─── Projects WebSocket ───

function connectProjectsWs() {
  if (state.projectsWs) {
    state.projectsWs.close();
    state.projectsWs = null;
  }

  const ws = new WebSocket(`ws://${window.location.host}/ws/projects`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'project:log') {
      const card = document.querySelector(`.project-card[data-project-id="${msg.id}"]`);
      if (!card) return;
      const logOutput = card.querySelector('.project-output');
      const span = document.createElement('span');
      span.className = `log-${msg.stream}`;
      span.textContent = msg.line + '\n';
      logOutput.appendChild(span);
      logOutput.scrollTop = logOutput.scrollHeight;
      // Trim to 500 lines
      while (logOutput.childNodes.length > 500) logOutput.removeChild(logOutput.firstChild);
    }

    if (msg.type === 'project:status') {
      const card = document.querySelector(`.project-card[data-project-id="${msg.id}"]`);
      if (!card) return;
      const dot = card.querySelector('.project-status-dot');
      const startBtn = card.querySelector('.project-start-btn');
      const stopBtn = card.querySelector('.project-stop-btn');
      const openBtn = card.querySelector('.project-open-btn');
      const isRunning = msg.status === 'running';

      dot.classList.toggle('running', isRunning);
      startBtn.style.display = isRunning ? 'none' : '';
      stopBtn.style.display = isRunning ? '' : 'none';
      openBtn.style.display = isRunning ? '' : 'none';
    }
  };

  ws.onerror = () => {};  // Reconnect handled by page re-render

  state.projectsWs = ws;
}
```

---

## Part 3: File Change Summary

### Files to Modify

| File | Description |
|------|-------------|
| `public/index.html` | Replace `<header>/<nav>` with topbar+sidebar; add 3 project templates; add script tag if needed |
| `public/app.js` | Sidebar init + state; router updates; projects page + WS; template refs |
| `public/styles.css` | Remove header/nav styles; add topbar/sidebar/project styles |
| `server.js` | Import project modules; register routes; wire WS; add shutdown hook |
| `lib/activity-handler.js` | Add `/ws/projects` upgrade path in `initWebSocket()` (4 lines) |

### Files to Create

| File | Purpose | ~Lines |
|------|---------|--------|
| `lib/project-server-manager.js` | Process lifecycle, CRUD, log ring buffer, WS broadcast | ~150 |
| `lib/project-api-handler.js` | REST endpoint handlers + route registration | ~80 |

### Files NOT Changed

| File | Reason |
|------|--------|
| `lib/router.js` | Already supports all HTTP methods and patterns needed |
| `lib/config-reader.js` | Projects use own persistence (`~/.claude/projects.json`) |
| `lib/session-handler.js` | Unrelated |
| `lib/team-watcher.js` | Unrelated |
| `lib/mission-*.js` | Unrelated |
| `hooks/` | No hook changes needed |
| `public/jedi-archives.js` | Unrelated |
| `public/mission-*.js` | Unrelated |
| `public/holonet-*.js` | Unrelated |
| `public/comms-*.js` | Unrelated |

---

## Part 4: Implementation Order

1. **Sidebar HTML + CSS** — Structural change to `index.html` and `styles.css`
2. **Sidebar JS** — `initSidebar()`, group expand/collapse, localStorage persistence
3. **Router update** — Change active link logic from `.nav-link` → `.sidebar-link`, auto-expand groups, add `projects` case
4. **`lib/project-server-manager.js`** — Core module: CRUD, spawn/kill, ring buffer, WS broadcast
5. **`lib/project-api-handler.js`** — 7 REST endpoints
6. **`server.js` wiring** — Import, register routes, add WS path, shutdown hook
7. **`activity-handler.js`** — Add `/ws/projects` to upgrade handler
8. **Projects frontend** — Templates, `renderProjectsPage()`, form modal, WS client
9. **Projects CSS** — Card styles, form styles, output panel
10. **Manual testing** — Verify sidebar on desktop + mobile, project CRUD, start/stop, live logs

---

## Part 5: Process Management — Edge Cases

| Scenario | Behavior |
|----------|----------|
| **Dashboard server restarts** | All child processes die (not detached+unref'd). Projects show "stopped" on reload. Config persists in `projects.json`. |
| **Dashboard crashes (SIGKILL)** | Children may survive as orphans. Port conflict on re-start alerts user. |
| **`stopProject()` timeout** | SIGTERM → 5s wait → SIGKILL. Uses process group kill (`-pid`) to catch shell children. |
| **Command not found** | `spawn` fires `error` event → status set to `error`, message broadcast to client. |
| **Port already in use** | Server command fails on its own, stderr captured and displayed. |
| **Rapid start/stop** | `startProject` checks `processes.has(id)` gate. `stopProject` returns Promise that resolves on `close`. |
| **Log memory** | Ring buffer capped at 500 entries per project. Old entries dropped. |
| **XSS in logs** | All log output uses `textContent`, never `innerHTML`. |
| **Path validation** | `existsSync(path)` before spawn. Project IDs are generated (not user-supplied paths in URLs). |
| **Concurrent file writes** | `projects.json` writes are async but serialized per request (Node single-thread). Race condition minimal for a single-user local tool. |
