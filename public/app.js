/**
 * Claude Environment UI - Frontend Application
 * @author Sam Green <samuel.green2k@gmail.com>
 */

// ============================================================
// Theme Management
// ============================================================

const STORAGE_KEYS = {
  THEME: 'claude-ui-theme',         // Shared across all plugin UIs
  SIDEBAR_COLLAPSED: 'env-sidebar-collapsed',
  SIDEBAR_GROUPS: 'env-sidebar-groups',
};

/**
 * Initialize theme from localStorage or system preference
 */
function initializeTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
}

/**
 * Escape HTML to prevent XSS in innerHTML
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Show a themed confirm modal. Returns a Promise<boolean>.
 */
function showConfirmModal(message, { title = 'Confirm', confirmLabel = 'Delete', danger = true } = {}) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content confirm-modal-content">
        <div class="modal-header">
          <span class="modal-title">${escapeHtml(title)}</span>
          <button class="modal-close" data-action="cancel">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin:0;color:var(--text-secondary);font-size:0.9rem;line-height:1.6">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary confirm-btn-cancel" data-action="cancel">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} confirm-btn-ok" data-action="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = (result) => {
      modal.remove();
      resolve(result);
    };
    modal.querySelector('.modal-backdrop').addEventListener('click', () => close(false));
    modal.querySelectorAll('[data-action="cancel"]').forEach(b => b.addEventListener('click', () => close(false)));
    modal.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(false); });
    modal.querySelector('.confirm-btn-ok').focus();
  });
}

/**
 * Show a themed alert modal. Returns a Promise<void>.
 */
function showAlertModal(message, { title = 'Error' } = {}) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content confirm-modal-content">
        <div class="modal-header">
          <span class="modal-title">${escapeHtml(title)}</span>
          <button class="modal-close" data-action="ok">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin:0;color:var(--text-secondary);font-size:0.9rem;line-height:1.6">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary confirm-btn-ok" data-action="ok">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => { modal.remove(); resolve(); };
    modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modal.querySelectorAll('[data-action="ok"]').forEach(b => b.addEventListener('click', close));
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    modal.querySelector('.confirm-btn-ok').focus();
  });
}

/**
 * Strip dangerous elements/attributes from HTML produced by marked.parse().
 * Uses DOM-based sanitization so no external dependency is needed.
 */
function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script,iframe,object,embed,form').forEach(el => el.remove());
  div.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
    // Strip javascript: URIs from href/src/action
    for (const prop of ['href', 'src', 'action']) {
      const val = el.getAttribute(prop);
      if (val && val.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(prop);
      }
    }
  });
  return div.innerHTML;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let newTheme;
  if (currentTheme === 'light') {
    newTheme = 'dark';
  } else if (currentTheme === 'dark') {
    newTheme = 'light';
  } else {
    // No explicit theme set, toggle based on system preference
    newTheme = prefersDark ? 'light' : 'dark';
  }

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
}

// Initialize theme immediately to prevent flash
initializeTheme();

// ============================================================
// Sidebar Navigation
// ============================================================

// Persisted sidebar state (collapsed + group open/closed)
const sidebarState = {
  collapsed: localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true',
  groups: JSON.parse(
    localStorage.getItem(STORAGE_KEYS.SIDEBAR_GROUPS) ||
    '{"customizations":true,"missions":false}'
  ),
};

/**
 * Initialize sidebar: group toggles, collapse, mobile overlay.
 * Called once on DOMContentLoaded.
 */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');

  if (!sidebar) return;

  // Apply saved collapsed state (desktop only)
  if (sidebarState.collapsed && window.innerWidth > 768) {
    sidebar.classList.add('collapsed');
  }

  // Apply saved group expanded states
  sidebar.querySelectorAll('.sidebar-group[data-group]').forEach(group => {
    const name = group.dataset.group;
    const btn = group.querySelector('.sidebar-group-toggle');
    if (sidebarState.groups[name]) {
      group.classList.add('expanded');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  });

  // Sidebar toggle button: collapse on desktop, open overlay on mobile
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        // Mobile: show sidebar as overlay
        const isOpen = sidebar.classList.toggle('open');
        if (overlay) {
          overlay.classList.toggle('visible', isOpen);
        }
      } else {
        // Desktop: toggle collapsed/icon-only mode
        const isCollapsed = sidebar.classList.toggle('collapsed');
        sidebarState.collapsed = isCollapsed;
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isCollapsed));
      }
    });
  }

  // Close mobile sidebar when clicking overlay
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }

  // Group expand/collapse toggles
  sidebar.querySelectorAll('.sidebar-group[data-group]').forEach(group => {
    const name = group.dataset.group;
    const btn = group.querySelector('.sidebar-group-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const isExpanded = group.classList.toggle('expanded');
      btn.setAttribute('aria-expanded', String(isExpanded));
      sidebarState.groups[name] = isExpanded;
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_GROUPS, JSON.stringify(sidebarState.groups));
    });
  });
}

/**
 * Update sidebar active state based on current route.
 * Highlights the matching sidebar-link and auto-expands parent groups.
 */
function updateSidebarActiveState(routePath) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Clear all active states and group highlights
  sidebar.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
  });
  sidebar.querySelectorAll('.sidebar-group').forEach(group => {
    group.classList.remove('has-active-child');
  });

  // Find matching sidebar link and activate it
  const activeLink = sidebar.querySelector(`.sidebar-link[data-route="${routePath}"]`);
  if (activeLink) {
    activeLink.classList.add('active');

    // If link is nested, expand its parent group and mark it as having an active child
    const parentGroup = activeLink.closest('.sidebar-group[data-group]');
    if (parentGroup) {
      parentGroup.classList.add('has-active-child');
      // Auto-expand if not already expanded
      if (!parentGroup.classList.contains('expanded')) {
        parentGroup.classList.add('expanded');
        const btn = parentGroup.querySelector('.sidebar-group-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        const name = parentGroup.dataset.group;
        sidebarState.groups[name] = true;
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_GROUPS, JSON.stringify(sidebarState.groups));
      }
    }
  }

  // Close mobile overlay after navigation
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.remove('visible');
  }
}

// ============================================================
// Templates
// ============================================================

// Templates
const templates = {
  dashboard: document.getElementById('dashboard-template'),
  statCard: document.getElementById('stat-card-template'),
  activity: document.getElementById('activity-template'),
  agents: document.getElementById('agents-template'),
  agentCard: document.getElementById('agent-card-template'),
  skills: document.getElementById('skills-template'),
  commands: document.getElementById('commands-template'),
  skillCard: document.getElementById('skill-card-template'),
  rules: document.getElementById('rules-template'),
  ruleCard: document.getElementById('rule-card-template'),
  plugins: document.getElementById('plugins-template'),
  pluginItem: document.getElementById('plugin-item-template'),
  mcpServers: document.getElementById('mcp-servers-template'),
  mcpServerCard: document.getElementById('mcp-server-card-template'),
  memory: document.getElementById('memory-template'),
  settings: document.getElementById('settings-template'),
  hookItem: document.getElementById('hook-item-template'),
  envToggle: document.getElementById('env-toggle-template'),
  envSelect: document.getElementById('env-select-template'),
  detailModal: document.getElementById('detail-modal-template'),
  error: document.getElementById('error-template'),
  missions: document.getElementById('missions-template'),
  missionBuilder: document.getElementById('mission-builder-template'),
  holonet: document.getElementById('holonet-template'),
  comms: document.getElementById('comms-template'),
  projects: document.getElementById('projects-template'),
  projectCard: document.getElementById('project-card-template'),
  projectFormModal: document.getElementById('project-form-modal-template'),
};

// State
const state = {
  overview: null,
  agents: [],
  skills: [],
  commands: [],
  rules: [],
  plugins: [],
  mcpServers: [],
  groupedHooks: null,
  memoryProjects: [],
  memoryStats: null,
  currentRoute: '',
  modal: null,
  jediArchives: null, // Jedi Archives canvas instance
  missionBuilder: null, // Mission Builder instance
  holonetCommand: null, // Holonet Command Center instance
  commsLog: null, // Comms Log instance
  projects: [], // Project configs
  projectsWs: null, // WebSocket for live project status/output
};

// API helpers
async function api(endpoint, options = {}) {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    // Try to get error message from response body
    try {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    } catch (e) {
      if (e.message && !e.message.startsWith('API error')) {
        throw e; // Re-throw if we got a real error message
      }
      throw new Error(`API error: ${response.status}`);
    }
  }

  return response.json();
}

// Router
function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  window.scrollTo(0, 0);
  const rawHash = window.location.hash.slice(1) || '/';
  const hash = rawHash.split('?')[0]; // Strip query params before routing
  const [path, ...rest] = hash.split('/').filter(Boolean);

  // Update sidebar active state
  updateSidebarActiveState(path || 'dashboard');

  // Route to page
  state.currentRoute = path || 'dashboard';

  // Clean up Jedi Archives when navigating away
  if (path !== 'activity' && state.jediArchives) {
    state.jediArchives.destroy();
    state.jediArchives = null;
  }
  // Clean up Mission Builder when navigating away
  if (path !== 'mission-builder' && state.missionBuilder) {
    state.missionBuilder.destroy();
    state.missionBuilder = null;
  }
  // Clean up Holonet Command when navigating away
  if (path !== 'holonet' && state.holonetCommand) {
    state.holonetCommand.destroy();
    state.holonetCommand = null;
  }
  // Clean up Comms Log when navigating away
  if (path !== 'comms' && state.commsLog) {
    state.commsLog.destroy();
    state.commsLog = null;
  }
  // Clean up Projects WebSocket when navigating away
  if (path !== 'projects' && state.projectsWs) {
    state.projectsWs.close();
    state.projectsWs = null;
  }

  switch (path) {
    case 'activity':
      renderActivityPage();
      break;
    case 'agents':
      renderAgentsPage();
      break;
    case 'skills':
      renderSkillsPage();
      break;
    case 'commands':
      renderCommandsPage();
      break;
    case 'rules':
      renderRulesPage();
      break;
    case 'plugins':
      renderPluginsPage();
      break;
    case 'mcp-servers':
      renderMCPServersPage();
      break;
    case 'memory':
      renderMemoryPage();
      break;
    case 'settings':
      renderSettingsPage();
      break;
    case 'missions':
      renderMissionsPage();
      break;
    case 'mission-builder':
      renderMissionBuilderPage();
      break;
    case 'holonet':
      renderHolonetPage(rest.join('/'));
      break;
    case 'comms':
      renderCommsPage();
      break;
    case 'projects':
      renderProjectsPage();
      break;
    default:
      renderDashboard();
  }
}

// Dashboard
async function renderDashboard() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { overview } = await api('/overview');
    state.overview = overview;

    const content = templates.dashboard.content.cloneNode(true);
    const statsGrid = content.getElementById('stats-grid');

    // Stats cards data
    const stats = [
      { icon: '🤖', value: overview.agents, label: 'Agents' },
      { icon: '⚡', value: overview.skills, label: 'Skills' },
      { icon: '📝', value: overview.commands, label: 'Commands' },
      { icon: '📏', value: overview.rules, label: 'Rules' },
      { icon: '🔌', value: overview.plugins || 0, label: 'Plugins' },
      { icon: '🖥️', value: overview.mcpServers || 0, label: 'MCP Servers' },
      { icon: '🔗', value: `${overview.hooks.active}/${overview.hooks.count}`, label: 'Hooks Active' },
    ];

    stats.forEach(stat => {
      const card = templates.statCard.content.cloneNode(true);
      card.querySelector('.stat-icon').textContent = stat.icon;
      card.querySelector('.stat-value').textContent = stat.value;
      card.querySelector('.stat-label').textContent = stat.label;
      statsGrid.appendChild(card);
    });

    main.innerHTML = '';
    main.appendChild(content);
  } catch (error) {
    showError(main, error.message);
  }
}

// Activity Page - Jedi Archives Visualization
async function renderActivityPage() {
  const main = document.getElementById('main-content');

  // Clone template
  const content = templates.activity.content.cloneNode(true);

  main.innerHTML = '';
  main.appendChild(content);

  // Initialize Jedi Archives after DOM is ready
  requestAnimationFrame(() => {
    if (window.JediArchives) {
      state.jediArchives = new window.JediArchives('jedi-archives-canvas');

      // Setup test spawn button
      const testBtn = document.getElementById('test-spawn-btn');
      if (testBtn) {
        const agentTypes = ['Explore', 'Plan', 'Bash', 'general-purpose', 'code-quality-agent', 'netsuite-specialist'];
        let typeIndex = 0;

        testBtn.addEventListener('click', () => {
          const type = agentTypes[typeIndex % agentTypes.length];
          const descriptions = [
            'Searching for API endpoints in codebase',
            'Planning authentication implementation',
            'Running test suite',
            'Investigating complex bug',
            'Reviewing code quality',
            'Analyzing NetSuite records'
          ];
          state.jediArchives.testSpawn(type, descriptions[typeIndex % descriptions.length]);
          typeIndex++;
        });
      }

      // Setup clear all button
      const clearBtn = document.getElementById('clear-agents-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          state.jediArchives.clearAllAgents();
        });
      }
    } else {
      console.error('[Activity] JediArchives not loaded');
    }
  });
}

// Agents Page
async function renderAgentsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { agents } = await api('/agents');
    state.agents = agents;

    const content = templates.agents.content.cloneNode(true);
    const grid = content.getElementById('agents-grid');

    if (agents.length === 0) {
      grid.innerHTML = '<p class="empty-state">No agents configured</p>';
    } else {
      agents.forEach(agent => {
        const card = createAgentCard(agent);
        grid.appendChild(card);
      });
    }

    main.innerHTML = '';
    main.appendChild(content);
  } catch (error) {
    showError(main, error.message);
  }
}

function createAgentCard(agent) {
  const card = templates.agentCard.content.cloneNode(true);
  card.querySelector('.card-title').textContent = agent.title;

  // Set description, with fallback for plugin agents
  let description = agent.description;
  if (!description && agent.plugin) {
    description = `Agent provided by the ${agent.plugin} plugin`;
  }
  card.querySelector('.card-description').textContent = description || 'No description';

  // Display plugin badge if agent comes from a plugin
  const pluginBadge = card.querySelector('.plugin-badge');
  if (pluginBadge && agent.plugin) {
    pluginBadge.textContent = agent.plugin;
    pluginBadge.style.display = 'inline-block';
  }

  const whenList = card.querySelector('.when-list');
  if (agent.whenToUse && agent.whenToUse.length > 0) {
    agent.whenToUse.slice(0, 3).forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      whenList.appendChild(li);
    });
  } else {
    whenList.parentElement.style.display = 'none';
  }

  card.querySelector('.view-details').addEventListener('click', () => {
    showDetailModal(agent.title, agent.content);
  });

  return card;
}

// Skills Page
async function renderSkillsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { skills } = await api('/skills');
    state.skills = skills;

    const content = templates.skills.content.cloneNode(true);
    const skillsGrid = content.getElementById('skills-grid');

    if (skills.length === 0) {
      skillsGrid.innerHTML = '<p class="empty-state">No skills configured</p>';
    } else {
      skills.forEach(skill => {
        const card = createSkillCard(skill);
        skillsGrid.appendChild(card);
      });
    }

    main.innerHTML = '';
    main.appendChild(content);
  } catch (error) {
    showError(main, error.message);
  }
}

// Commands Page
async function renderCommandsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { commands } = await api('/commands');
    state.commands = commands;

    const content = templates.commands.content.cloneNode(true);
    const commandsGrid = content.getElementById('commands-grid');

    if (commands.length === 0) {
      commandsGrid.innerHTML = '<p class="empty-state">No commands configured</p>';
    } else {
      commands.forEach(command => {
        const card = createSkillCard(command);
        commandsGrid.appendChild(card);
      });
    }

    main.innerHTML = '';
    main.appendChild(content);
  } catch (error) {
    showError(main, error.message);
  }
}

function createSkillCard(skill) {
  const card = templates.skillCard.content.cloneNode(true);
  card.querySelector('.command-badge').textContent = skill.command;
  card.querySelector('.card-title').textContent = skill.title;
  card.querySelector('.card-description').textContent = skill.description || 'No description';

  // Display author badge if present
  const authorBadge = card.querySelector('.author-badge');
  if (authorBadge && skill.author) {
    authorBadge.textContent = skill.author;
    authorBadge.style.display = 'inline-block';
  }

  card.querySelector('.view-details').addEventListener('click', () => {
    showDetailModal(skill.title, skill.content);
  });

  return card;
}

// Rules Page
async function renderRulesPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { rules } = await api('/rules');
    state.rules = rules;

    const content = templates.rules.content.cloneNode(true);
    const grid = content.getElementById('rules-grid');

    if (rules.length === 0) {
      grid.innerHTML = '<p class="empty-state">No rules configured</p>';
    } else {
      rules.forEach(rule => {
        const card = createRuleCard(rule);
        grid.appendChild(card);
      });
    }

    main.innerHTML = '';
    main.appendChild(content);
  } catch (error) {
    showError(main, error.message);
  }
}

function createRuleCard(rule) {
  const card = templates.ruleCard.content.cloneNode(true);
  card.querySelector('.card-title').textContent = rule.title;
  card.querySelector('.sections-count').textContent = `${rule.sections} sections`;

  card.querySelector('.view-details').addEventListener('click', () => {
    showDetailModal(rule.title, rule.content);
  });

  return card;
}

// Plugins Page
async function renderPluginsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { plugins } = await api('/plugins');
    state.plugins = plugins;

    const content = templates.plugins.content.cloneNode(true);
    const list = content.getElementById('plugins-list');

    if (plugins.length === 0) {
      list.innerHTML = '<p class="empty-state">No plugins installed</p>';
    } else {
      plugins.forEach(plugin => {
        const item = createPluginItem(plugin);
        list.appendChild(item);
      });
    }

    main.innerHTML = '';
    main.appendChild(content);
  } catch (error) {
    showError(main, error.message);
  }
}

function createPluginItem(plugin) {
  const item = templates.pluginItem.content.cloneNode(true);

  // Basic info
  item.querySelector('.plugin-name').textContent = plugin.name;
  item.querySelector('.plugin-desc').textContent = plugin.description || 'No description';
  item.querySelector('.plugin-version').textContent = `v${plugin.version}`;

  // Meta info
  const authorEl = item.querySelector('.plugin-author');
  if (plugin.author) {
    authorEl.textContent = typeof plugin.author === 'string'
      ? plugin.author
      : plugin.author.name || 'Unknown';
  } else {
    authorEl.textContent = 'Unknown';
  }

  item.querySelector('.plugin-license').textContent = plugin.license || 'Not specified';
  item.querySelector('.plugin-installed').textContent = plugin.installedAt
    ? new Date(plugin.installedAt).toLocaleDateString()
    : 'Unknown';

  // Components
  const skillsSection = item.querySelector('.skills-section');
  const skillsList = item.querySelector('.plugin-skills');
  if (plugin.skills && plugin.skills.length > 0) {
    plugin.skills.forEach(skill => {
      const badge = document.createElement('span');
      badge.className = 'component-badge';
      badge.textContent = `/${plugin.name}:${skill}`;
      skillsList.appendChild(badge);
    });
  } else {
    skillsSection.classList.add('empty');
  }

  const commandsSection = item.querySelector('.commands-section');
  const commandsList = item.querySelector('.plugin-commands');
  if (plugin.commands && plugin.commands.length > 0) {
    plugin.commands.forEach(cmd => {
      const badge = document.createElement('span');
      badge.className = 'component-badge';
      badge.textContent = `/${cmd}`;
      commandsList.appendChild(badge);
    });
  } else {
    commandsSection.classList.add('empty');
  }

  const agentsSection = item.querySelector('.agents-section');
  const agentsList = item.querySelector('.plugin-agents');
  if (plugin.agents && plugin.agents.length > 0) {
    plugin.agents.forEach(agent => {
      const badge = document.createElement('span');
      badge.className = 'component-badge';
      badge.textContent = agent;
      agentsList.appendChild(badge);
    });
  } else {
    agentsSection.classList.add('empty');
  }

  // Usage text
  const usageText = item.querySelector('.usage-text');
  const usageLines = [];
  if (plugin.skills && plugin.skills.length > 0) {
    usageLines.push(`Invoke skills with /${plugin.name}:<skill-name>`);
  }
  if (plugin.commands && plugin.commands.length > 0) {
    usageLines.push(`Run commands with /${plugin.name}:<command-name>`);
  }
  if (usageLines.length === 0) {
    usageLines.push('This plugin provides configuration or hooks.');
  }
  usageText.textContent = usageLines.join('. ') + '.';

  // Homepage link
  const homepageBtn = item.querySelector('.plugin-homepage');
  if (plugin.homepage) {
    homepageBtn.href = plugin.homepage;
  } else if (plugin.repository) {
    homepageBtn.href = plugin.repository;
  } else {
    homepageBtn.style.display = 'none';
  }

  // Toggle expand/collapse
  const pluginItem = item.querySelector('.plugin-item');
  const pluginRow = item.querySelector('.plugin-row');
  pluginRow.addEventListener('click', () => {
    pluginItem.classList.toggle('expanded');
  });

  return item;
}

// MCP Servers Page
async function renderMCPServersPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { servers, stats } = await api('/mcp-servers');
    state.mcpServers = servers;

    const content = templates.mcpServers.content.cloneNode(true);
    const statsContainer = content.getElementById('mcp-stats');
    const listContainer = content.getElementById('mcp-servers-list');

    // Render stats
    renderMCPStats(statsContainer, stats);

    // Render servers list
    if (servers.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state empty-state-centered">
          <p>No MCP servers configured</p>
          <p class="empty-state-hint">Add servers to your ~/.claude/settings.json under the "mcpServers" key</p>
        </div>
      `;
    } else {
      servers.forEach(server => {
        const card = createMCPServerCard(server);
        listContainer.appendChild(card);
      });
    }

    main.innerHTML = '';
    main.appendChild(content);
  } catch (error) {
    showError(main, error.message);
  }
}

function renderMCPStats(container, stats) {
  const statItems = [
    { icon: '🔌', value: stats.total, label: 'Total Servers', subtitle: 'Configured MCP servers' },
    { icon: '✅', value: stats.enabled || 0, label: 'Enabled', subtitle: 'Active servers' },
    { icon: '📦', value: Object.keys(stats.byType).length, label: 'Types', subtitle: 'Different server types' },
    { icon: '🏠', value: (stats.bySource.user || 0) + (stats.bySource.home || 0), label: 'User Level', subtitle: 'From .mcp.json' },
  ];

  statItems.forEach(stat => {
    const card = templates.statCard.content.cloneNode(true);
    card.querySelector('.stat-icon').textContent = stat.icon;
    card.querySelector('.stat-value').textContent = stat.value;
    card.querySelector('.stat-label').textContent = stat.label;
    card.querySelector('.stat-subtitle').textContent = stat.subtitle;
    container.appendChild(card);
  });
}

function createMCPServerCard(server) {
  const card = templates.mcpServerCard.content.cloneNode(true);

  // Set server name
  card.querySelector('.mcp-server-name').textContent = server.name;

  // Set server type with icon
  const typeIcons = {
    npm: '📦',
    python: '🐍',
    docker: '🐳',
    node: '💚',
    filesystem: '📁',
    github: '🐙',
    database: '🗃️',
    api: '🌐',
    custom: '⚙️',
  };
  const typeIcon = typeIcons[server.type] || '⚙️';
  card.querySelector('.mcp-server-icon').textContent = typeIcon;
  card.querySelector('.mcp-server-type').textContent = server.type;

  // Set status badge (show enabled/disabled status)
  const statusBadge = card.querySelector('.mcp-server-status');
  const isEnabled = server.enabled !== false;
  statusBadge.textContent = isEnabled ? 'enabled' : 'disabled';
  statusBadge.classList.add(isEnabled ? 'status-configured' : 'status-disabled');

  // Set command
  card.querySelector('.mcp-command').textContent = server.command || '-';

  // Set arguments (truncate if too long)
  const argsEl = card.querySelector('.mcp-args');
  const argsRow = card.querySelector('.mcp-args-row');
  if (server.args && server.args.length > 0) {
    const argsStr = server.args.join(' ');
    argsEl.textContent = argsStr.length > 60 ? argsStr.substring(0, 57) + '...' : argsStr;
    argsEl.title = argsStr; // Full args on hover
  } else {
    argsRow.style.display = 'none';
  }

  // Set environment info
  const envEl = card.querySelector('.mcp-env');
  const envRow = card.querySelector('.mcp-env-row');
  if (server.envCount > 0) {
    envEl.textContent = `${server.envCount} variable${server.envCount > 1 ? 's' : ''}: ${server.envKeys.join(', ')}`;
  } else {
    envRow.style.display = 'none';
  }

  // Set source badge
  const sourceBadge = card.querySelector('.mcp-source-badge');
  sourceBadge.textContent = server.source === 'local' ? 'Local Override' : 'User Settings';
  sourceBadge.classList.add(`source-${server.source}`);

  return card;
}

// SVG Icons for tree explorer (VS Code style)
const TREE_ICONS = {
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  folderClosed: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  folderOpen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>',
  fileMarkdown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zm-3 11.5L7 12v3H5v-6h2v3l3-3 3 3v-3h2v6h-2v-3l-3 3.5z"/></svg>',
  fileDefault: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>'
};

// Memory Page
async function renderMemoryPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { projects, stats } = await api('/memory');
    state.memoryProjects = projects || [];
    state.memoryStats = stats || {};

    const content = templates.memory.content.cloneNode(true);
    const statsContainer = content.getElementById('memory-stats');
    const projectList = content.getElementById('memory-project-list');

    // Render stats
    const statItems = [
      { icon: '📁', value: stats.totalProjects || 0, label: 'Total Projects', subtitle: 'Claude Code projects' },
      { icon: '🧠', value: stats.projectsWithMemory || 0, label: 'With Memory', subtitle: 'Projects with MEMORY.md' },
      { icon: '📄', value: stats.totalFiles || 0, label: 'Memory Files', subtitle: 'Across all projects' },
    ];

    statItems.forEach(stat => {
      const card = templates.statCard.content.cloneNode(true);
      card.querySelector('.stat-icon').textContent = stat.icon;
      card.querySelector('.stat-value').textContent = stat.value;
      card.querySelector('.stat-label').textContent = stat.label;
      card.querySelector('.stat-subtitle').textContent = stat.subtitle;
      statsContainer.appendChild(card);
    });

    // Render project list in sidebar
    renderMemoryProjectList(projectList, state.memoryProjects);

    main.innerHTML = '';
    main.appendChild(content);

    // Setup search after DOM is ready
    setupMemorySearch();
  } catch (error) {
    showError(main, error.message);
  }
}

function renderMemoryProjectList(container, projects) {
  container.innerHTML = '';

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <p>No projects with memory files found</p>
      </div>
    `;
    return;
  }

  projects.forEach(project => {
    const item = document.createElement('div');
    item.className = 'memory-project-item';
    item.dataset.projectId = project.id;

    const modified = new Date(project.lastModified);
    const relTime = getRelativeTime(modified);

    item.innerHTML = `
      <span class="memory-project-item-name">${escapeHtml(project.name)}</span>
      <span class="memory-project-item-path">${escapeHtml(project.path)}</span>
      <div class="memory-project-item-meta">
        <span>${project.fileCount} file${project.fileCount !== 1 ? 's' : ''}</span>
        <span>${relTime}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      // Update selection
      container.querySelectorAll('.memory-project-item').forEach(el => {
        el.classList.remove('active');
      });
      item.classList.add('active');
      loadProjectMemory(project.id, project.name);
    });

    container.appendChild(item);
  });
}

async function loadProjectMemory(projectId, projectName) {
  const contentArea = document.getElementById('memory-content');
  if (!contentArea) return;

  contentArea.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading memory...</p>
    </div>
  `;

  try {
    const { files } = await api(`/memory/project/${encodeURIComponent(projectId)}`);

    if (files.length === 0) {
      contentArea.innerHTML = `
        <div class="empty-state memory-empty">
          <p>No memory files in this project</p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const file of files) {
      const modified = new Date(file.lastModified);
      const sizeStr = file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`;

      html += `
        <div class="memory-file-section">
          <div class="memory-file-header">
            <h3>${escapeHtml(file.name)}</h3>
            <span class="memory-file-meta">${sizeStr} &middot; ${modified.toLocaleDateString()}</span>
          </div>
          <div class="markdown-body">${sanitizeHtml(marked.parse(file.content))}</div>
        </div>
      `;
    }

    contentArea.innerHTML = html;
  } catch (error) {
    contentArea.innerHTML = `<div class="empty-state"><p>Failed to load: ${escapeHtml(error.message)}</p></div>`;
  }
}

function setupMemorySearch() {
  const searchInput = document.getElementById('memory-search-input');
  const resultsContainer = document.getElementById('memory-search-results');

  if (!searchInput || !resultsContainer) return;

  let searchTimeout = null;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (query.length < 2) {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('visible');
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        const { results } = await api(`/memory/search?q=${encodeURIComponent(query)}`);
        renderMemorySearchResults(results, resultsContainer);
      } catch (error) {
        resultsContainer.innerHTML = '<div class="search-error">Search failed</div>';
        resultsContainer.classList.add('visible');
      }
    }, 200);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) {
      searchInput.dispatchEvent(new Event('input'));
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.memory-search')) {
      resultsContainer.classList.remove('visible');
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      resultsContainer.classList.remove('visible');
      searchInput.blur();
    }
  });
}

function renderMemorySearchResults(results, container) {
  if (results.length === 0) {
    container.innerHTML = '<div class="search-empty">No results found</div>';
    container.classList.add('visible');
    return;
  }

  let html = '';
  results.forEach(result => {
    html += `
      <div class="memory-search-result" data-project-id="${escapeHtml(result.projectId)}" data-project-name="${escapeHtml(result.projectName)}">
        <div class="memory-search-result-project">${escapeHtml(result.projectName)}</div>
        <div class="memory-search-result-file">${escapeHtml(result.file)}</div>
        <div class="memory-search-result-snippet">${escapeHtml(result.snippet)}</div>
      </div>
    `;
  });

  container.innerHTML = html;
  container.classList.add('visible');

  // Add click handlers to navigate to the project
  container.querySelectorAll('.memory-search-result').forEach(el => {
    el.addEventListener('click', () => {
      const projectId = el.dataset.projectId;
      const projectName = el.dataset.projectName;

      // Highlight the project in the sidebar
      const projectList = document.getElementById('memory-project-list');
      if (projectList) {
        projectList.querySelectorAll('.memory-project-item').forEach(item => {
          item.classList.toggle('active', item.dataset.projectId === projectId);
        });
      }

      loadProjectMemory(projectId, projectName);

      const searchInput = document.getElementById('memory-search-input');
      if (searchInput) searchInput.value = '';
      container.classList.remove('visible');
    });
  });
}

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Settings Page - State tracking for view mode
let settingsViewMode = 'user'; // 'user' or 'project'
let activeProjectPath = null;

async function renderSettingsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const [settingsRes, groupedHooksRes, projectRes] = await Promise.all([
      api('/settings'),
      api('/hooks?grouped=true'),
      api('/project'),
    ]);

    state.groupedHooks = groupedHooksRes;
    const settings = settingsRes.settings;
    const schema = settingsRes.schema;

    const content = templates.settings.content.cloneNode(true);
    const hooksList = content.getElementById('hooks-list');
    const envVars = content.getElementById('env-vars');
    const projectPathInput = content.getElementById('project-path');
    const setProjectBtn = content.getElementById('set-project-btn');
    const projectStatus = content.getElementById('project-status');
    const levelIndicator = content.getElementById('settings-level-indicator');

    // Initialize view mode based on whether a project was previously set
    if (projectRes.path) {
      projectPathInput.value = projectRes.path;
      activeProjectPath = projectRes.path;
      settingsViewMode = 'project';
    } else {
      settingsViewMode = 'user';
      activeProjectPath = null;
    }

    // Function to update level indicator
    const updateLevelIndicator = (mode) => {
      if (mode === 'project' && activeProjectPath) {
        levelIndicator.innerHTML = `<span class="level-badge project active">Project Level</span>`;
      } else {
        levelIndicator.innerHTML = `<span class="level-badge user active">User Level</span>`;
      }
    };

    // Function to render user settings
    const renderUserSettings = () => {
      settingsViewMode = 'user';
      updateLevelIndicator('user');
      setProjectBtn.textContent = 'Set Project';
      setProjectBtn.classList.remove('btn-warning');
      setProjectBtn.classList.add('btn-primary');
      projectStatus.innerHTML = '';

      // Clear and render grouped hooks
      hooksList.innerHTML = '';
      const grouped = state.groupedHooks;
      const allHooks = [...(grouped.user || []), ...Object.values(grouped.plugins || {}).flat()];

      if (allHooks.length === 0) {
        hooksList.innerHTML = '<p class="empty-state-small">No hooks configured</p>';
      } else {
        // User hooks group
        if (grouped.user && grouped.user.length > 0) {
          hooksList.appendChild(createHookGroup('User Hooks', 'user', grouped.user, 'user'));
        }

        // Plugin hook groups
        for (const [pluginName, pluginHooks] of Object.entries(grouped.plugins || {})) {
          hooksList.appendChild(createHookGroup(pluginName, pluginName, pluginHooks, 'user'));
        }
      }

      // Clear and render user env vars
      envVars.innerHTML = '';
      const env = settings.env || {};
      const envSchema = schema?.env || {};
      const defaults = {
        ANALYSIS_LEVEL: 'code-review',
        CRITICAL_ISSUE_MODE: 'warn',
        AUTO_DOCUMENT: 'true',
        UPDATE_PRACTICES: 'true',
      };

      Object.entries(envSchema).forEach(([key, config]) => {
        const currentValue = env[key] ?? defaults[key];
        if (config.type === 'boolean') {
          renderBooleanSetting(envVars, key, config, currentValue, 'user');
        } else if (config.type === 'select') {
          renderSelectSetting(envVars, key, config, currentValue, 'user');
        }
      });
    };

    // Function to render project settings
    const renderProjectSettings = async (projectPath) => {
      try {
        const [projectData, projectHooksRes, projectEnvRes] = await Promise.all([
          api('/project/settings'),
          api('/project/hooks'),
          api('/project/env')
        ]);

        if (!projectData.exists) {
          projectStatus.innerHTML = `
            <div class="project-status warning">
              <div class="project-status-header">
                <span class="project-status-icon">⚠️</span>
                <span class="project-status-title">Not a Claude Project</span>
              </div>
              <div class="project-status-path">${escapeHtml(projectPath)}</div>
              <p style="margin-top: 8px; font-size: 0.875rem; color: var(--text-secondary);">
                This directory does not have a .claude folder. Run <code>/project-init</code> to set it up.
              </p>
            </div>
          `;
          return;
        }

        settingsViewMode = 'project';
        activeProjectPath = projectPath;
        updateLevelIndicator('project');
        setProjectBtn.textContent = 'Close Project Settings';
        setProjectBtn.classList.remove('btn-primary');
        setProjectBtn.classList.add('btn-warning');

        // Show project status
        projectStatus.innerHTML = `
          <div class="project-status success">
            <div class="project-status-header">
              <span class="project-status-icon">✓</span>
              <span class="project-status-title">${escapeHtml(projectPath.split('/').pop())}</span>
            </div>
            <div class="project-files">
              <span class="project-file-badge ${projectData.hasClaudeMd ? 'exists' : 'missing'}">
                ${projectData.hasClaudeMd ? '✓' : '○'} CLAUDE.md
              </span>
              <span class="project-file-badge ${projectData.hasSettings ? 'exists' : 'missing'}">
                ${projectData.hasSettings ? '✓' : '○'} settings.json
              </span>
              <span class="project-file-badge ${projectData.hasLocalSettings ? 'exists' : 'missing'}">
                ${projectData.hasLocalSettings ? '✓' : '○'} settings.local.json
              </span>
            </div>
          </div>
        `;

        // Clear and render project hooks
        hooksList.innerHTML = '';
        const projectHooks = projectHooksRes.hooks || [];
        if (projectHooks.length === 0) {
          hooksList.innerHTML = '<div class="empty-state-small">No project hooks configured</div>';
        } else {
          hooksList.appendChild(createHookGroup('Project Hooks', 'project', projectHooks.map(h => ({
            ...h, sourceType: 'project'
          })), 'project'));
        }

        // Clear and render project env vars
        envVars.innerHTML = '';
        const mergedEnv = projectEnvRes.merged || { ...projectEnvRes.env, ...projectEnvRes.localEnv };
        const envSchema = schema?.env || {};

        if (Object.keys(envSchema).length === 0) {
          envVars.innerHTML = '<div class="empty-state-small">No environment variables defined</div>';
        } else {
          Object.entries(envSchema).forEach(([key, config]) => {
            const currentValue = mergedEnv[key] ?? null;
            if (config.type === 'boolean') {
              renderBooleanSetting(envVars, key, config, currentValue, 'project');
            } else if (config.type === 'select') {
              renderSelectSetting(envVars, key, config, currentValue, 'project');
            }
          });
        }
      } catch (error) {
        projectStatus.innerHTML = `
          <div class="project-status warning">
            <div class="project-status-header">
              <span class="project-status-icon">⚠️</span>
              <span class="project-status-title">Error Loading Project</span>
            </div>
            <div class="project-status-path">${escapeHtml(error.message)}</div>
          </div>
        `;
      }
    };

    // Handle set/close project button
    setProjectBtn.addEventListener('click', async () => {
      if (settingsViewMode === 'project') {
        // Close project settings - switch back to user view
        try {
          await api('/project', { method: 'PUT', body: { path: '' } });
        } catch (error) {
          showToast(`Failed to close project: ${error.message}`, 'error');
        }
        activeProjectPath = null;
        renderUserSettings();
      } else {
        // Set project - switch to project view
        const path = projectPathInput.value.trim();
        if (!path) return;

        try {
          setProjectBtn.disabled = true;
          setProjectBtn.textContent = 'Loading...';

          await api('/project', {
            method: 'PUT',
            body: { path }
          });

          await renderProjectSettings(path);
        } catch (error) {
          projectStatus.innerHTML = `
            <div class="project-status warning">
              <div class="project-status-header">
                <span class="project-status-icon">⚠️</span>
                <span class="project-status-title">Error</span>
              </div>
              <div class="project-status-path">${escapeHtml(error.message)}</div>
            </div>
          `;
        } finally {
          setProjectBtn.disabled = false;
          if (settingsViewMode === 'user') {
            setProjectBtn.textContent = 'Set Project';
          }
        }
      }
    });

    // Initial render based on current view mode
    if (settingsViewMode === 'project' && activeProjectPath) {
      await renderProjectSettings(activeProjectPath);
    } else {
      renderUserSettings();
    }

    main.innerHTML = '';
    main.appendChild(content);

  } catch (error) {
    showError(main, error.message);
  }
}

function renderBooleanSetting(container, key, config, value, level = 'user') {
  const item = templates.envToggle.content.cloneNode(true);
  item.querySelector('.setting-label').textContent = config.label;

  // For project level, show "inherit" state if null
  const descEl = item.querySelector('.setting-desc');
  if (level === 'project' && value === null) {
    descEl.textContent = 'Inherits from user settings';
  } else {
    descEl.textContent = config.description || '';
  }

  const toggle = item.querySelector('.setting-toggle');
  toggle.checked = value === 'true' || value === true;
  toggle.dataset.level = level;

  // For project, use indeterminate state when inheriting
  if (level === 'project' && value === null) {
    toggle.indeterminate = true;
    toggle.checked = false;
  }

  toggle.addEventListener('change', async () => {
    const newValue = toggle.checked ? 'true' : 'false';
    try {
      await updateEnvVar(key, newValue, level);
      toggle.indeterminate = false;
      descEl.textContent = config.description || '';
    } catch (error) {
      toggle.checked = !toggle.checked; // Revert on error
      showToast(`Failed to update ${config.label}: ${error.message}`, 'error');
    }
  });

  container.appendChild(item);
}

function renderSelectSetting(container, key, config, value, level = 'user') {
  const item = templates.envSelect.content.cloneNode(true);
  item.querySelector('.setting-label').textContent = config.label;

  const descEl = item.querySelector('.setting-desc');
  if (level === 'project' && value === null) {
    descEl.textContent = 'Inherits from user settings';
  } else {
    descEl.textContent = config.description || '';
  }

  const select = item.querySelector('.setting-select');
  select.dataset.level = level;

  // For project level, add an "inherit" option
  if (level === 'project') {
    const inheritOpt = document.createElement('option');
    inheritOpt.value = '__inherit__';
    inheritOpt.textContent = '(Inherit from user)';
    inheritOpt.selected = value === null;
    select.appendChild(inheritOpt);
  }

  config.options.forEach(option => {
    const optEl = document.createElement('option');
    optEl.value = option;
    optEl.textContent = option;
    optEl.selected = option === value;
    select.appendChild(optEl);
  });

  select.addEventListener('change', async () => {
    try {
      const newValue = select.value === '__inherit__' ? null : select.value;
      await updateEnvVar(key, newValue, level);
      if (newValue === null) {
        descEl.textContent = 'Inherits from user settings';
      } else {
        descEl.textContent = config.description || '';
      }
    } catch (error) {
      // Revert to previous value
      const prevOption = Array.from(select.options).find(o => o.value === (value || '__inherit__'));
      if (prevOption) prevOption.selected = true;
      showToast(`Failed to update ${config.label}: ${error.message}`, 'error');
    }
  });

  container.appendChild(item);
}

/**
 * Create a collapsible hook group section
 */
function createHookGroup(label, groupId, hooks, level) {
  const group = document.createElement('div');
  group.className = 'hook-group';
  group.dataset.groupId = groupId;

  // Determine group type: user, plugin, or project
  const isProject = level === 'project';
  const isPlugin = !isProject && groupId !== 'user';
  const groupType = isProject ? 'project' : (isPlugin ? 'plugin' : 'user');
  const enabledCount = hooks.filter(h => h.enabled).length;
  // Bulk toggle is only supported for user-level groups (user and plugin), not project
  const supportsBulkToggle = !isProject;

  // Group header
  const header = document.createElement('div');
  header.className = 'hook-group-header';
  header.innerHTML = `
    <div class="hook-group-left">
      <svg class="hook-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
      <span class="hook-group-label">${isPlugin ? escapeHtml(label) : (isProject ? 'Project Hooks' : 'User Hooks')}</span>
      ${isPlugin ? '<span class="hook-group-badge">plugin</span>' : ''}
      <span class="hook-group-count">${enabledCount}/${hooks.length} active</span>
    </div>
    ${supportsBulkToggle ? `
    <label class="toggle hook-group-master" title="Toggle all hooks in this group">
      <input type="checkbox" class="hook-group-toggle">
      <span class="toggle-slider"></span>
    </label>` : ''}
  `;

  // Master toggle state (only if supported)
  const masterToggle = header.querySelector('.hook-group-toggle');
  if (masterToggle) {
    masterToggle.checked = enabledCount === hooks.length;
    masterToggle.indeterminate = enabledCount > 0 && enabledCount < hooks.length;

    // Stop propagation so it doesn't toggle collapse
    const masterLabel = header.querySelector('.hook-group-master');
    masterLabel.addEventListener('click', (e) => e.stopPropagation());

    masterToggle.addEventListener('change', async () => {
      const enabled = masterToggle.checked;
      try {
        await api(`/hooks/group/${groupType}/${encodeURIComponent(groupId)}/toggle`, {
          method: 'PUT',
          body: { enabled }
        });
        // Sync local state and refresh toggles
        hooks.forEach(h => { h.enabled = enabled; });
        const itemToggles = items.querySelectorAll('.hook-toggle');
        itemToggles.forEach(t => { t.checked = enabled; });
        masterToggle.indeterminate = false;
        countEl.textContent = `${enabled ? hooks.length : 0}/${hooks.length} active`;
        showToast(`${enabled ? 'Enabled' : 'Disabled'} all ${escapeHtml(label)} hooks`, 'success');
      } catch (error) {
        masterToggle.checked = !enabled;
        showToast(`Failed to toggle group: ${error.message}`, 'error');
      }
    });
  }

  // Items container
  const items = document.createElement('div');
  items.className = 'hook-group-items';

  hooks.forEach(hook => {
    items.appendChild(createHookItem(hook, level, masterToggle, hooks));
  });

  // Collapse/expand with localStorage persistence
  const countEl = header.querySelector('.hook-group-count');
  const expandedGroups = JSON.parse(localStorage.getItem('claude-hooks-expanded') || '[]');
  if (!expandedGroups.includes(groupId)) {
    group.classList.add('collapsed');
  }

  header.addEventListener('click', () => {
    group.classList.toggle('collapsed');
    const stored = JSON.parse(localStorage.getItem('claude-hooks-expanded') || '[]');
    if (group.classList.contains('collapsed')) {
      const idx = stored.indexOf(groupId);
      if (idx !== -1) stored.splice(idx, 1);
    } else {
      if (!stored.includes(groupId)) stored.push(groupId);
    }
    localStorage.setItem('claude-hooks-expanded', JSON.stringify(stored));
  });

  group.appendChild(header);
  group.appendChild(items);

  return group;
}

/**
 * Create a single hook item row
 */
function createHookItem(hook, level, masterToggle, groupHooks) {
  const item = templates.hookItem.content.cloneNode(true);
  item.querySelector('.hook-name').textContent = hook.name;
  item.querySelector('.hook-type').textContent = hook.type;

  const matcherEl = item.querySelector('.hook-matcher');
  if (hook.matcher && hook.matcher !== '*') {
    matcherEl.textContent = hook.matcher;
  } else {
    matcherEl.style.display = 'none';
  }

  // Hide source badge (grouping already indicates source)
  const sourceEl = item.querySelector('.hook-source');
  sourceEl.style.display = 'none';

  const toggle = item.querySelector('.hook-toggle');
  toggle.dataset.hookId = hook.id;
  toggle.dataset.level = level;
  toggle.checked = hook.enabled;
  toggle.addEventListener('change', () => {
    toggleHook(hook.id, toggle, level, masterToggle, groupHooks);
  });

  return item;
}

async function toggleHook(id, toggle, level = 'user', masterToggle = null, groupHooks = null) {
  // Validate hook ID format — plugin hooks use "plugin:name:type.x.y", user hooks use "type.x.y"
  const isPluginHook = id.startsWith('plugin:');
  if (!isPluginHook) {
    const parts = id.split('.');
    if (parts.length !== 3 || isNaN(parts[1]) || isNaN(parts[2])) {
      showToast('Invalid hook ID format', 'error');
      toggle.checked = !toggle.checked;
      return;
    }
  }

  try {
    if (level === 'project') {
      await api(`/project/hooks/${encodeURIComponent(id)}/toggle`, { method: 'PUT' });
    } else {
      const result = await api(`/hooks/${encodeURIComponent(id)}/toggle`, { method: 'PUT' });
      // Update local grouped state
      const allHooks = [
        ...(state.groupedHooks?.user || []),
        ...Object.values(state.groupedHooks?.plugins || {}).flat()
      ];
      const hook = allHooks.find(h => h.id === id);
      if (hook) {
        hook.enabled = result.enabled;
      }
    }

    // Update master toggle if present
    if (masterToggle && groupHooks) {
      const enabledCount = groupHooks.filter(h => h.enabled).length;
      masterToggle.checked = enabledCount === groupHooks.length;
      masterToggle.indeterminate = enabledCount > 0 && enabledCount < groupHooks.length;
      // Update count text
      const countEl = masterToggle.closest('.hook-group-header')?.querySelector('.hook-group-count');
      if (countEl) {
        countEl.textContent = `${enabledCount}/${groupHooks.length} active`;
      }
    }

    showToast('Hook toggled successfully', 'success');
  } catch (error) {
    toggle.checked = !toggle.checked; // Revert
    showToast(`Failed to toggle hook: ${error.message}`, 'error');
  }
}

async function updateEnvVar(key, value, level = 'user') {
  if (level === 'project') {
    if (value === null) {
      // Delete the key to inherit from user settings
      await api(`/project/env/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      return;
    }
    await api(`/project/env/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: { value }
    });
  } else {
    await api(`/settings/env/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: { value }
    });
  }
}

// Modal
function showDetailModal(title, content) {
  const modal = templates.detailModal.content.cloneNode(true);
  modal.querySelector('.modal-title').textContent = title;
  modal.querySelector('.modal-body').innerHTML = sanitizeHtml(marked.parse(content || 'No content available'));

  const modalEl = modal.querySelector('.modal');

  const closeModal = () => {
    document.body.removeChild(state.modal);
    state.modal = null;
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  document.body.appendChild(modal);
  state.modal = document.body.lastElementChild;
}

// Utilities
function showLoading(container) {
  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  `;
}

function showError(container, message) {
  const content = templates.error.content.cloneNode(true);
  content.querySelector('.error-message').textContent = message;
  container.innerHTML = '';
  container.appendChild(content);
}

// ============================================================
// Missions List Page
// ============================================================

const MISSION_STATUS_COLORS = {
  completed: { bg: 'rgba(45,106,79,0.15)', text: '#40916c', border: 'rgba(45,106,79,0.3)' },
  running:   { bg: 'rgba(27,107,147,0.15)', text: '#4da8da', border: 'rgba(27,107,147,0.3)' },
  failed:    { bg: 'rgba(199,70,52,0.15)', text: '#e07a5f', border: 'rgba(199,70,52,0.3)' },
  aborted:   { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', border: 'rgba(156,163,175,0.3)' },
  pending:   { bg: 'rgba(224,122,48,0.15)', text: '#e07a30', border: 'rgba(224,122,48,0.3)' },
};

async function renderMissionsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const [defsResp, runsResp] = await Promise.all([
      api('/missions'),
      api('/missions/runs'),
    ]);
    const definitions = defsResp.data || defsResp || [];
    const runs = (runsResp.data || runsResp || []).sort((a, b) =>
      new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt)
    );

    const content = templates.missions.content.cloneNode(true);
    const listEl = content.getElementById('missions-list');

    // Render definitions by default
    renderMissionDefinitions(listEl, definitions, runs);

    main.innerHTML = '';
    main.appendChild(content);

    // Tab switching
    document.querySelectorAll('.missions-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.missions-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const list = document.getElementById('missions-list');
        if (tab.dataset.tab === 'definitions') {
          renderMissionDefinitions(list, definitions, runs);
        } else {
          renderMissionRuns(list, runs, definitions);
        }
      });
    });
  } catch (err) {
    showError(main, err.message || 'Failed to load missions');
  }
}

function renderMissionDefinitions(container, definitions, runs) {
  if (definitions.length === 0) {
    container.innerHTML = `
      <div class="empty-state empty-state-centered">
        <div class="empty-state-icon">🎯</div>
        <h3>No missions yet</h3>
        <p>Create a mission in the <a href="#/mission-builder">Builder</a></p>
      </div>`;
    return;
  }

  // Build run count map
  const runCounts = {};
  for (const r of runs) {
    runCounts[r.missionId] = (runCounts[r.missionId] || 0) + 1;
  }

  container.innerHTML = definitions.map(m => {
    const nodeCount = (m.nodes || []).length;
    const edgeCount = (m.edges || []).length;
    const rc = runCounts[m.id] || 0;
    const created = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—';
    const updated = m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : '—';
    const agentTypes = [...new Set((m.nodes || []).map(n => n.agentType))].join(', ') || 'none';

    return `
      <div class="mission-card" data-id="${m.id}">
        <div class="mission-card-header">
          <div class="mission-card-title">
            <h3>${escapeHtml(m.name || 'Untitled Mission')}</h3>
            <span class="mission-card-meta">${nodeCount} node${nodeCount !== 1 ? 's' : ''} · ${edgeCount} edge${edgeCount !== 1 ? 's' : ''} · ${rc} run${rc !== 1 ? 's' : ''}</span>
          </div>
          <div class="mission-card-actions">
            <button class="btn btn-sm mission-btn-edit" title="Edit in Builder" data-id="${m.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-danger mission-btn-delete" title="Delete mission" data-id="${m.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        ${m.description ? `<p class="mission-card-desc">${escapeHtml(m.description)}</p>` : ''}
        <div class="mission-card-footer">
          <span class="mission-card-agents">${escapeHtml(agentTypes)}</span>
          <span class="mission-card-date">Created ${created} · Updated ${updated}</span>
        </div>
      </div>`;
  }).join('');

  // Wire up edit buttons
  container.querySelectorAll('.mission-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/mission-builder?mission=${btn.dataset.id}`;
    });
  });

  // Wire up delete buttons
  container.querySelectorAll('.mission-btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const card = btn.closest('.mission-card');
      const name = card.querySelector('h3').textContent;
      const ok = await showConfirmModal(`Delete mission "${name}"? This cannot be undone.`, { title: 'Delete Mission' });
      if (!ok) return;
      try {
        await api(`/missions/${id}`, { method: 'DELETE' });
        card.remove();
        const list = document.getElementById('missions-list');
        if (!list.querySelector('.mission-card')) {
          list.innerHTML = `
            <div class="empty-state empty-state-centered">
              <div class="empty-state-icon">🎯</div>
              <h3>No missions yet</h3>
              <p>Create a mission in the <a href="#/mission-builder">Builder</a></p>
            </div>`;
        }
      } catch (err) {
        showAlertModal('Failed to delete mission: ' + err.message);
      }
    });
  });
}

function renderMissionRuns(container, runs, definitions) {
  if (runs.length === 0) {
    container.innerHTML = `
      <div class="empty-state empty-state-centered">
        <div class="empty-state-icon">🚀</div>
        <h3>No runs yet</h3>
        <p>Launch a mission from the <a href="#/holonet">Holonet</a></p>
      </div>`;
    return;
  }

  // Build mission name map
  const missionNames = {};
  for (const m of definitions) {
    missionNames[m.id] = m.name || 'Untitled';
  }

  container.innerHTML = runs.map(r => {
    const status = r.status || 'pending';
    const colors = MISSION_STATUS_COLORS[status] || MISSION_STATUS_COLORS.pending;
    const nodeStates = r.nodeStates || {};
    const totalNodes = Object.keys(nodeStates).length;
    const completedNodes = Object.values(nodeStates).filter(n => n.status === 'completed').length;
    const failedNodes = Object.values(nodeStates).filter(n => n.status === 'failed').length;
    const started = r.startedAt ? new Date(r.startedAt).toLocaleString() : '—';
    const duration = r.startedAt && r.completedAt
      ? formatDuration(new Date(r.completedAt) - new Date(r.startedAt))
      : r.startedAt ? 'in progress' : '—';
    const missionName = missionNames[r.missionId] || r.missionId?.slice(0, 16) || '—';
    const filesCount = Object.values(nodeStates).reduce((sum, n) => sum + (n.files?.length || 0), 0);
    const runName = r.name || r.id?.slice(0, 16) || '—';

    return `
      <div class="mission-run-card" data-id="${r.id}">
        <div class="mission-run-header">
          <div class="mission-run-title">
            <h3>${escapeHtml(runName)}</h3>
            <span class="mission-status-pill" style="background:${colors.bg};color:${colors.text};border:1px solid ${colors.border}">${status}</span>
          </div>
          <div class="mission-card-actions">
            <button class="btn btn-sm mission-btn-view" title="View in Holonet" data-id="${r.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </button>
            <button class="btn btn-sm btn-danger mission-btn-delete-run" title="Delete run" data-id="${r.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="mission-run-meta">
          <span>Mission: ${escapeHtml(missionName)}</span>
          <span>${started}</span>
          <span>${duration}</span>
        </div>
        <div class="mission-run-stats">
          <span class="mission-run-stat">${completedNodes}/${totalNodes} nodes completed</span>
          ${failedNodes ? `<span class="mission-run-stat stat-failed">${failedNodes} failed</span>` : ''}
          <span class="mission-run-stat">${filesCount} file${filesCount !== 1 ? 's' : ''} produced</span>
        </div>
      </div>`;
  }).join('');

  // Wire up view buttons
  container.querySelectorAll('.mission-btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/holonet?run=${btn.dataset.id}`;
    });
  });

  // Wire up delete buttons
  container.querySelectorAll('.mission-btn-delete-run').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const card = btn.closest('.mission-run-card');
      const ok = await showConfirmModal('Delete this run? This cannot be undone.', { title: 'Delete Run' });
      if (!ok) return;
      try {
        await api(`/missions/runs/${id}`, { method: 'DELETE' });
        card.remove();
        const list = document.getElementById('missions-list');
        if (!list.querySelector('.mission-run-card')) {
          list.innerHTML = `
            <div class="empty-state empty-state-centered">
              <div class="empty-state-icon">🚀</div>
              <h3>No runs yet</h3>
              <p>Launch a mission from the <a href="#/holonet">Holonet</a></p>
            </div>`;
        }
      } catch (err) {
        showAlertModal('Failed to delete run: ' + err.message);
      }
    });
  });
}

function formatDuration(ms) {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

// ============================================================
// Mission Builder Page
// ============================================================
function renderMissionBuilderPage() {
  const main = document.getElementById('main-content');
  const content = templates.missionBuilder.content.cloneNode(true);
  main.innerHTML = '';
  main.appendChild(content);

  requestAnimationFrame(() => {
    if (window.MissionBuilder) {
      state.missionBuilder = new window.MissionBuilder('mission-builder-container');
    }
  });
}

// ============================================================
// Holonet Command Center Page
// ============================================================
function renderHolonetPage(params) {
  const main = document.getElementById('main-content');
  const content = templates.holonet.content.cloneNode(true);
  main.innerHTML = '';
  main.appendChild(content);

  requestAnimationFrame(() => {
    if (window.HolonetCommand) {
      state.holonetCommand = new window.HolonetCommand('holonet-container');
      // Check for URL params like #/holonet?run=xxx or #/holonet?mission=xxx
      const hashParts = window.location.hash.split('?');
      if (hashParts[1]) {
        const urlParams = new URLSearchParams(hashParts[1]);
        const runId = urlParams.get('run');
        const missionId = urlParams.get('mission');
        if (runId) {
          state.holonetCommand.loadRun(runId);
        } else if (missionId) {
          state.holonetCommand.loadMission(missionId);
        }
      }
    }
  });
}

// ============================================================
// Comms Log Page
// ============================================================
function renderCommsPage() {
  const main = document.getElementById('main-content');
  const content = templates.comms.content.cloneNode(true);
  main.innerHTML = '';
  main.appendChild(content);

  requestAnimationFrame(() => {
    if (window.CommsLog) {
      state.commsLog = new window.CommsLog('comms-container');
    }
  });
}

// ============================================================
// Projects Page
// ============================================================

async function renderProjectsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const projects = await api('/projects');
    state.projects = projects;

    const content = templates.projects.content.cloneNode(true);
    const grid = content.getElementById('projects-grid');

    if (projects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state empty-state-centered projects-empty">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" class="empty-icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/>
            <line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
          <h3>No projects yet</h3>
          <p>Add a project to start managing local development servers.</p>
        </div>
      `;
    } else {
      projects.forEach(project => {
        const card = createProjectCard(project);
        grid.appendChild(card);
      });
    }

    main.innerHTML = '';
    main.appendChild(content);

    // Wire up Add Project button
    const addBtn = document.getElementById('add-project-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => showProjectForm(null));
    }

    // Connect WebSocket for live updates
    connectProjectsWs();
  } catch (error) {
    showError(main, error.message);
  }
}

function createProjectCard(project) {
  const card = templates.projectCard.content.cloneNode(true);
  const cardEl = card.querySelector('.project-card');
  cardEl.dataset.projectId = project.id;

  // Title row
  card.querySelector('.project-name').textContent = project.name;

  // Path, command, port
  card.querySelector('.project-path').textContent = project.path;
  card.querySelector('.project-command').textContent = project.command;

  const portRow = card.querySelector('.project-port-row');
  if (project.port) {
    card.querySelector('.project-port').textContent = project.port;
    portRow.style.display = '';
  }

  // Initial status
  const isRunning = project.status === 'running';
  setProjectCardStatus(card, isRunning ? 'running' : 'stopped');

  // Button wiring
  card.querySelector('.project-btn-start').addEventListener('click', () => {
    const latest = state.projects.find(p => p.id === project.id) || project;
    startProject(latest.id, latest);
  });
  card.querySelector('.project-btn-stop').addEventListener('click', () => stopProject(project.id));
  card.querySelector('.project-btn-open').addEventListener('click', () => {
    const latest = state.projects.find(p => p.id === project.id) || project;
    const url = latest.url || (latest.port ? `http://localhost:${latest.port}` : null);
    if (url) window.open(url, '_blank');
  });
  card.querySelector('.project-btn-logs').addEventListener('click', () => toggleProjectLog(project.id));
  card.querySelector('.project-btn-edit').addEventListener('click', async () => {
    // Re-fetch from server to guarantee fresh data
    try {
      const all = await api('/projects');
      state.projects = all;
      const latest = all.find(p => p.id === project.id) || project;
      showProjectForm(latest);
    } catch {
      showProjectForm(project);
    }
  });
  card.querySelector('.project-btn-delete').addEventListener('click', () => confirmDeleteProject(project));

  card.querySelector('.project-log-clear').addEventListener('click', () => {
    const output = document.querySelector(`.project-card[data-project-id="${project.id}"] .project-log-output`);
    if (output) output.innerHTML = '';
  });

  return card;
}

/**
 * Update the status pill, dot, and action buttons for a project card
 */
function setProjectCardStatus(cardOrId, status) {
  let cardEl;
  if (typeof cardOrId === 'string') {
    cardEl = document.querySelector(`.project-card[data-project-id="${cardOrId}"]`);
  } else {
    // DocumentFragment — find the .project-card inside
    cardEl = cardOrId.querySelector ? cardOrId.querySelector('.project-card') : cardOrId;
  }
  if (!cardEl) return;

  const dot = cardEl.querySelector('.project-status-dot');
  const pill = cardEl.querySelector('.project-status-pill');
  const btnStart = cardEl.querySelector('.project-btn-start');
  const btnStop = cardEl.querySelector('.project-btn-stop');
  const btnOpen = cardEl.querySelector('.project-btn-open');

  // Remove all status classes
  dot.classList.remove('running', 'stopped', 'error');
  pill.classList.remove('pill-running', 'pill-stopped', 'pill-error');

  if (status === 'running') {
    dot.classList.add('running');
    pill.textContent = 'Running';
    pill.classList.add('pill-running');
    btnStart.style.display = 'none';
    btnStop.style.display = '';
    btnOpen.style.display = '';
  } else if (status === 'error') {
    dot.classList.add('error');
    pill.textContent = 'Error';
    pill.classList.add('pill-error');
    btnStart.style.display = '';
    btnStop.style.display = 'none';
    btnOpen.style.display = 'none';
  } else {
    dot.classList.add('stopped');
    pill.textContent = 'Stopped';
    pill.classList.add('pill-stopped');
    btnStart.style.display = '';
    btnStop.style.display = 'none';
    btnOpen.style.display = 'none';
  }
}

/**
 * Toggle the log panel visibility for a project card
 */
function toggleProjectLog(projectId) {
  const cardEl = document.querySelector(`.project-card[data-project-id="${projectId}"]`);
  if (!cardEl) return;

  const panel = cardEl.querySelector('.project-log-panel');
  const logsBtn = cardEl.querySelector('.project-btn-logs');
  const isOpen = panel.style.display !== 'none';

  panel.style.display = isOpen ? 'none' : '';
  logsBtn.classList.toggle('active', !isOpen);

  // Scroll to bottom when opening
  if (!isOpen) {
    const logBody = panel.querySelector('.project-log-body');
    logBody.scrollTop = logBody.scrollHeight;
  }
}

/**
 * Append a line to a project's log output
 */
function appendProjectLog(projectId, text, isStderr = false) {
  const cardEl = document.querySelector(`.project-card[data-project-id="${projectId}"]`);
  if (!cardEl) return;

  const output = cardEl.querySelector('.project-log-output');
  if (!output) return;

  const span = document.createElement('span');
  span.className = isStderr ? 'log-line log-stderr' : 'log-line log-stdout';
  span.textContent = text;
  output.appendChild(span);

  // Auto-scroll if log panel is open
  const panel = cardEl.querySelector('.project-log-panel');
  if (panel && panel.style.display !== 'none') {
    const logBody = panel.querySelector('.project-log-body');
    logBody.scrollTop = logBody.scrollHeight;
  }

  // Auto-open log panel when there's output
  if (panel && panel.style.display === 'none') {
    panel.style.display = '';
    cardEl.querySelector('.project-btn-logs').classList.add('active');
  }

  // Keep output manageable (remove old lines beyond 2000)
  const lines = output.querySelectorAll('.log-line');
  if (lines.length > 2000) {
    for (let i = 0; i < lines.length - 1500; i++) {
      lines[i].remove();
    }
  }
}

// ============================================================
// Project CRUD Operations
// ============================================================

async function startProject(id, project) {
  const cardEl = document.querySelector(`.project-card[data-project-id="${id}"]`);
  const startBtn = cardEl?.querySelector('.project-btn-start');

  if (startBtn) {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
  }

  try {
    await api(`/projects/${id}/start`, { method: 'POST' });

    // Open URL if autoOpen is set (stored on project object)
    if (project?.autoOpen) {
      const url = project.url || (project.port ? `http://localhost:${project.port}` : null);
      if (url) setTimeout(() => window.open(url, '_blank'), 800);
    }

    showToast('Project starting…', 'success');
  } catch (error) {
    showToast(`Failed to start: ${error.message}`, 'error');
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.style.opacity = '';
    }
  }
}

async function stopProject(id) {
  const cardEl = document.querySelector(`.project-card[data-project-id="${id}"]`);
  const stopBtn = cardEl?.querySelector('.project-btn-stop');

  if (stopBtn) {
    stopBtn.disabled = true;
    stopBtn.style.opacity = '0.5';
  }

  try {
    await api(`/projects/${id}/stop`, { method: 'POST' });
    showToast('Stopping server…', 'info');
  } catch (error) {
    showToast(`Failed to stop: ${error.message}`, 'error');
    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.style.opacity = '';
    }
  }
}

async function doCreateProject(data) {
  return api('/projects', { method: 'POST', body: data });
}

async function doUpdateProject(id, data) {
  return api(`/projects/${id}`, { method: 'PUT', body: data });
}

async function doDeleteProject(id) {
  return api(`/projects/${id}`, { method: 'DELETE' });
}

// ============================================================
// Project Form Modal
// ============================================================

function showProjectForm(project = null) {
  // Remove any existing modal
  hideProjectForm();

  const modal = templates.projectFormModal.content.cloneNode(true);
  const modalEl = modal.querySelector('.project-modal');
  const form = modal.querySelector('#project-form');
  const title = modal.querySelector('.project-modal-title');
  const submitBtn = modal.querySelector('#pf-submit');
  const cancelBtn = modal.querySelector('#pf-cancel');
  const closeBtn = modal.querySelector('.project-modal-close');
  const errorEl = modal.querySelector('#pf-error');

  // Pre-fill for edit mode
  if (project) {
    title.textContent = 'Edit Project';
    submitBtn.textContent = 'Save Changes';
    modal.querySelector('#pf-name').value = project.name || '';
    modal.querySelector('#pf-path').value = project.path || '';
    modal.querySelector('#pf-command').value = project.command || '';
    modal.querySelector('#pf-port').value = project.port || '';
    modal.querySelector('#pf-url').value = project.url || '';
    modal.querySelector('#pf-autoopen').checked = project.autoOpen || false;
  }

  const close = () => hideProjectForm();

  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  modal.querySelector('.project-modal-backdrop').addEventListener('click', close);

  // Escape key
  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKeyDown);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate required fields
    const name = form.querySelector('#pf-name').value.trim();
    const path = form.querySelector('#pf-path').value.trim();
    const command = form.querySelector('#pf-command').value.trim();

    if (!name || !path || !command) {
      errorEl.textContent = 'Name, path, and command are required.';
      errorEl.style.display = '';
      return;
    }

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = project ? 'Saving…' : 'Adding…';

    const portVal = form.querySelector('#pf-port').value.trim();
    const data = {
      name,
      path,
      command,
      port: portVal ? parseInt(portVal, 10) : null,
      url: form.querySelector('#pf-url').value.trim() || null,
      autoOpen: form.querySelector('#pf-autoopen').checked,
    };

    try {
      if (project) {
        const updated = await doUpdateProject(project.id, data);
        // Update the card in the DOM
        updateProjectCardData(project.id, updated);
        showToast('Project updated', 'success');
      } else {
        const created = await doCreateProject(data);
        // Append new card
        const grid = document.getElementById('projects-grid');
        if (grid) {
          const emptyState = grid.querySelector('.projects-empty');
          if (emptyState) emptyState.remove();
          const card = createProjectCard({ ...created, status: 'stopped' });
          grid.appendChild(card);
        }
        showToast('Project added', 'success');
      }
      close();
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = '';
      submitBtn.disabled = false;
      submitBtn.textContent = project ? 'Save Changes' : 'Save Project';
    }
  });

  document.body.appendChild(modal);
  state.modal = document.body.lastElementChild;
  state._projectModalKeyHandler = onKeyDown;

  // Focus first input
  requestAnimationFrame(() => {
    const firstInput = state.modal?.querySelector('input');
    if (firstInput) firstInput.focus();
  });
}

function hideProjectForm() {
  if (state._projectModalKeyHandler) {
    document.removeEventListener('keydown', state._projectModalKeyHandler);
    state._projectModalKeyHandler = null;
  }
  const existing = document.querySelector('.project-modal');
  if (existing) existing.remove();
  if (state.modal?.classList?.contains('project-modal') || !state.modal?.classList) {
    // Only clear state.modal if it's the project modal
    const isProjectModal = document.body.contains(existing) === false;
    if (!document.querySelector('.modal')) state.modal = null;
  }
}

function updateProjectCardData(id, updated) {
  const cardEl = document.querySelector(`.project-card[data-project-id="${id}"]`);
  if (!cardEl) return;

  cardEl.querySelector('.project-name').textContent = updated.name;
  cardEl.querySelector('.project-path').textContent = updated.path;
  cardEl.querySelector('.project-command').textContent = updated.command;

  const portRow = cardEl.querySelector('.project-port-row');
  if (updated.port) {
    cardEl.querySelector('.project-port').textContent = updated.port;
    portRow.style.display = '';
  } else {
    portRow.style.display = 'none';
  }

  // Update the in-memory project reference used by open/start buttons
  const idx = state.projects.findIndex(p => p.id === id);
  if (idx !== -1) Object.assign(state.projects[idx], updated);
}

function confirmDeleteProject(project) {
  // Inline confirmation using the delete button itself
  const cardEl = document.querySelector(`.project-card[data-project-id="${project.id}"]`);
  if (!cardEl) return;

  const deleteBtn = cardEl.querySelector('.project-btn-delete');
  if (deleteBtn.dataset.confirming === 'true') return;

  deleteBtn.dataset.confirming = 'true';
  deleteBtn.title = 'Click again to confirm';
  deleteBtn.style.color = 'var(--error)';
  deleteBtn.style.borderColor = 'var(--error)';

  const resetTimer = setTimeout(() => {
    deleteBtn.dataset.confirming = '';
    deleteBtn.title = 'Remove project';
    deleteBtn.style.color = '';
    deleteBtn.style.borderColor = '';
  }, 3000);

  const confirmHandler = async () => {
    clearTimeout(resetTimer);
    deleteBtn.removeEventListener('click', confirmHandler);

    try {
      await doDeleteProject(project.id);
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'scale(0.95)';
      cardEl.style.transition = 'opacity 200ms, transform 200ms';
      setTimeout(() => {
        cardEl.remove();
        // Show empty state if no more cards
        const grid = document.getElementById('projects-grid');
        if (grid && grid.querySelectorAll('.project-card').length === 0) {
          grid.innerHTML = `
            <div class="empty-state empty-state-centered projects-empty">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" class="empty-icon">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
              <h3>No projects yet</h3>
              <p>Add a project to start managing local development servers.</p>
            </div>
          `;
        }
      }, 200);
      showToast('Project removed', 'success');
    } catch (error) {
      showToast(`Failed to delete: ${error.message}`, 'error');
      deleteBtn.dataset.confirming = '';
      deleteBtn.style.color = '';
      deleteBtn.style.borderColor = '';
    }
  };

  // Re-wire click for confirmation (once)
  deleteBtn.addEventListener('click', confirmHandler, { once: true });
}

// ============================================================
// Projects WebSocket — live status & output
// ============================================================

function connectProjectsWs() {
  if (state.projectsWs) return;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws/projects`);
  state.projectsWs = ws;

  ws.addEventListener('message', (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'init':
        // Sync statuses from server on connect
        if (msg.statuses) {
          for (const [id, info] of Object.entries(msg.statuses)) {
            setProjectCardStatus(id, info.status);
          }
        }
        break;

      case 'project_status':
        setProjectCardStatus(msg.projectId, msg.status);
        // Re-enable any disabled buttons
        const cardEl = document.querySelector(`.project-card[data-project-id="${msg.projectId}"]`);
        if (cardEl) {
          cardEl.querySelectorAll('.project-btn-start, .project-btn-stop').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '';
          });
        }
        break;

      case 'project_output':
        // Detect stderr by checking if the backend tags it — otherwise treat as stdout
        appendProjectLog(msg.projectId, msg.data, msg.stream === 'stderr');
        break;
    }
  });

  ws.addEventListener('error', () => {
    // Silently fail — projects page still works, just no live updates
  });

  ws.addEventListener('close', () => {
    if (state.projectsWs === ws) state.projectsWs = null;
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Setup theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Initialize sidebar navigation
  initSidebar();

  // Initialize router
  initRouter();
});
