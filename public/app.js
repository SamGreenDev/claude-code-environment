/**
 * Claude Environment UI - Frontend Application
 * @author Sam Green <samuel.green2k@gmail.com>
 */

// ============================================================
// Theme Management
// ============================================================

const STORAGE_KEYS = {
  THEME: 'claude-ui-theme'  // Shared across all plugin UIs
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
  knowledge: document.getElementById('knowledge-template'),
  mcpServers: document.getElementById('mcp-servers-template'),
  mcpServerCard: document.getElementById('mcp-server-card-template'),
  lessons: document.getElementById('lessons-template'),
  lessonCard: document.getElementById('lesson-card-template'),
  settings: document.getElementById('settings-template'),
  hookItem: document.getElementById('hook-item-template'),
  envToggle: document.getElementById('env-toggle-template'),
  envSelect: document.getElementById('env-select-template'),
  detailModal: document.getElementById('detail-modal-template'),
  error: document.getElementById('error-template'),
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
  knowledge: null,
  groupedHooks: null,
  lessons: [],
  lessonsStats: null,
  currentRoute: '',
  modal: null,
  jediArchives: null, // Jedi Archives canvas instance
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
  const hash = window.location.hash.slice(1) || '/';
  const [path, ...rest] = hash.split('/').filter(Boolean);

  // Update active nav link (no nav link for dashboard since it's accessed via logo)
  document.querySelectorAll('.nav-link').forEach(link => {
    const route = link.dataset.route;
    link.classList.toggle('active', route === path);
  });

  // Route to page
  state.currentRoute = path || 'dashboard';

  // Clean up Jedi Archives when navigating away
  if (path !== 'activity' && state.jediArchives) {
    state.jediArchives.destroy();
    state.jediArchives = null;
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
    case 'knowledge':
      renderKnowledgePage(rest.join('/'));
      break;
    case 'lessons':
      renderLessonsPage();
      break;
    case 'settings':
      renderSettingsPage();
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
      { icon: '📚', value: overview.knowledge, label: 'Knowledge Files' },
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

// Knowledge Page
async function renderKnowledgePage(filePath = '') {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const { structure } = await api('/knowledge');
    state.knowledge = structure;

    const content = templates.knowledge.content.cloneNode(true);
    const treeContainer = content.getElementById('knowledge-tree');
    const contentArea = content.getElementById('knowledge-content');

    renderKnowledgeTree(treeContainer, structure, filePath);

    if (filePath) {
      await loadKnowledgeFile(contentArea, filePath);
    }

    main.innerHTML = '';
    main.appendChild(content);

    // Setup search after DOM is ready
    setupKnowledgeSearch();
  } catch (error) {
    showError(main, error.message);
  }
}

/**
 * Render knowledge tree recursively (VS Code style)
 */
function renderKnowledgeTree(container, items, activePath, level = 0) {
  container.innerHTML = '';

  items.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'tree-item';
    itemEl.dataset.level = level;
    itemEl.style.setProperty('--level', level);

    if (item.type === 'directory') {
      // Folder item
      const rowEl = document.createElement('div');
      rowEl.className = 'tree-row folder';
      rowEl.innerHTML = `
        <span class="tree-toggle">${TREE_ICONS.chevron}</span>
        <span class="tree-icon folder-closed">${TREE_ICONS.folderClosed}</span>
        <span class="tree-label">${item.name}</span>
      `;

      const childContainer = document.createElement('div');
      childContainer.className = 'tree-children';

      if (item.children && item.children.length > 0) {
        renderKnowledgeTree(childContainer, item.children, activePath, level + 1);
      }

      rowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        itemEl.classList.toggle('expanded');
        const iconEl = rowEl.querySelector('.tree-icon');
        if (itemEl.classList.contains('expanded')) {
          iconEl.className = 'tree-icon folder-open';
          iconEl.innerHTML = TREE_ICONS.folderOpen;
        } else {
          iconEl.className = 'tree-icon folder-closed';
          iconEl.innerHTML = TREE_ICONS.folderClosed;
        }
      });

      itemEl.appendChild(rowEl);
      itemEl.appendChild(childContainer);

      // Auto-expand if active path is inside
      if (activePath && activePath.startsWith(item.path + '/')) {
        itemEl.classList.add('expanded');
        const iconEl = rowEl.querySelector('.tree-icon');
        iconEl.className = 'tree-icon folder-open';
        iconEl.innerHTML = TREE_ICONS.folderOpen;
      }
    } else {
      // File item
      const rowEl = document.createElement('div');
      rowEl.className = 'tree-row';
      if (activePath === item.path) {
        rowEl.classList.add('selected');
      }

      const isMarkdown = item.name.endsWith('.md');
      const iconClass = isMarkdown ? 'file-markdown' : 'file-default';
      const iconSvg = isMarkdown ? TREE_ICONS.fileMarkdown : TREE_ICONS.fileDefault;

      rowEl.innerHTML = `
        <span class="tree-toggle-placeholder"></span>
        <span class="tree-icon ${iconClass}">${iconSvg}</span>
        <span class="tree-label">${item.name.replace('.md', '')}</span>
      `;

      rowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        // Update selection
        document.querySelectorAll('.tree-row.selected').forEach(el => {
          el.classList.remove('selected');
        });
        rowEl.classList.add('selected');
        window.location.hash = `/knowledge/${item.path}`;
      });

      itemEl.appendChild(rowEl);
    }

    container.appendChild(itemEl);
  });
}

/**
 * Setup knowledge search listeners
 */
function setupKnowledgeSearch() {
  const searchInput = document.getElementById('knowledge-search-input');
  const resultsContainer = document.getElementById('knowledge-search-results');

  if (!searchInput || !resultsContainer) return;

  let searchTimeout = null;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (query.length < 2) {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('visible');
      return;
    }

    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      await handleKnowledgeSearch(query, resultsContainer);
    }, 200);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) {
      handleKnowledgeSearch(searchInput.value, resultsContainer);
    }
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.knowledge-search')) {
      resultsContainer.classList.remove('visible');
    }
  });

  // Handle escape key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      resultsContainer.classList.remove('visible');
      searchInput.blur();
    }
  });
}

/**
 * Handle knowledge search with debounce
 */
async function handleKnowledgeSearch(query, container) {
  try {
    const { results } = await api(`/knowledge/search?q=${encodeURIComponent(query)}`);
    renderKnowledgeSearchResults(results, container);
  } catch (error) {
    console.error('Knowledge search failed:', error);
    container.innerHTML = '<div class="search-error">Search failed</div>';
    container.classList.add('visible');
  }
}

/**
 * Render knowledge search results
 */
function renderKnowledgeSearchResults(results, container) {
  if (results.length === 0) {
    container.innerHTML = '<div class="search-empty">No results found</div>';
    container.classList.add('visible');
    return;
  }

  let html = '';
  results.forEach(result => {
    const href = `#/knowledge/${result.path}`;
    html += `
      <a href="${href}" class="knowledge-search-result">
        <div class="search-result-name">${result.match}</div>
        ${result.category ? `<div class="search-result-category">${result.category}</div>` : ''}
        ${result.matchType === 'content' ? `<div class="search-result-preview">${result.match}</div>` : ''}
      </a>
    `;
  });

  container.innerHTML = html;
  container.classList.add('visible');

  // Add click handlers to close search and clear input
  container.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      const searchInput = document.getElementById('knowledge-search-input');
      if (searchInput) searchInput.value = '';
      container.classList.remove('visible');
    });
  });
}

async function loadKnowledgeFile(container, filePath) {
  try {
    const { content } = await api(`/knowledge/file/${encodeURIComponent(filePath)}`);
    container.innerHTML = `<div class="markdown-body">${marked.parse(content)}</div>`;

    // Highlight "Official Documentation" headings
    container.querySelectorAll('h2').forEach(h2 => {
      if (h2.textContent.toLowerCase().includes('official documentation')) {
        h2.classList.add('official-docs-heading');
      }
    });
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load file: ${escapeHtml(error.message)}</p></div>`;
  }
}


// Lessons Page
async function renderLessonsPage() {
  const main = document.getElementById('main-content');
  showLoading(main);

  try {
    const [lessonsRes, statsRes] = await Promise.all([
      api('/lessons'),
      api('/lessons/stats'),
    ]);

    state.lessons = lessonsRes.lessons || [];
    state.lessonsStats = statsRes.stats || {};

    const content = templates.lessons.content.cloneNode(true);
    const statsContainer = content.getElementById('lessons-stats');
    const lessonsList = content.getElementById('lessons-list');
    const categoryFilter = content.getElementById('category-filter');
    const techFilter = content.getElementById('tech-filter');
    const searchInput = content.getElementById('lessons-search');

    // Render stats
    const stats = state.lessonsStats;
    const statItems = [
      { icon: '📚', value: stats.total || 0, label: 'Total Lessons', subtitle: 'Captured corrections' },
      { icon: '📅', value: stats.thisMonth || 0, label: 'This Month', subtitle: 'Recent learnings' },
      { icon: '🎯', value: stats.totalHits || 0, label: 'Total Hits', subtitle: 'Times surfaced' },
      { icon: '🏷️', value: Object.keys(stats.byCategory || {}).length, label: 'Categories', subtitle: 'Issue types' },
    ];

    statItems.forEach(stat => {
      const card = templates.statCard.content.cloneNode(true);
      card.querySelector('.stat-icon').textContent = stat.icon;
      card.querySelector('.stat-value').textContent = stat.value;
      card.querySelector('.stat-label').textContent = stat.label;
      card.querySelector('.stat-subtitle').textContent = stat.subtitle;
      statsContainer.appendChild(card);
    });

    // Populate tech filter from stats
    const techs = Object.keys(stats.byTech || {}).sort();
    techs.forEach(tech => {
      const option = document.createElement('option');
      option.value = tech;
      option.textContent = tech;
      techFilter.appendChild(option);
    });

    // Render lessons
    renderLessonsList(lessonsList, state.lessons);

    // Setup filters
    const filterLessons = () => {
      const category = categoryFilter.value;
      const tech = techFilter.value;
      const search = searchInput.value.toLowerCase();

      const filtered = state.lessons.filter(lesson => {
        if (category && lesson.category !== category) return false;
        if (tech && !lesson.tech?.includes(tech)) return false;
        if (search) {
          const searchable = [
            lesson.lesson,
            lesson.error,
            lesson.failedAttempt,
            lesson.resolution,
            ...(lesson.tech || [])
          ].join(' ').toLowerCase();
          if (!searchable.includes(search)) return false;
        }
        return true;
      });

      renderLessonsList(lessonsList, filtered);
    };

    categoryFilter.addEventListener('change', filterLessons);
    techFilter.addEventListener('change', filterLessons);
    searchInput.addEventListener('input', filterLessons);

    main.innerHTML = '';
    main.appendChild(content);
  } catch (error) {
    showError(main, error.message);
  }
}

function renderLessonsList(container, lessons) {
  container.innerHTML = '';

  if (lessons.length === 0) {
    container.innerHTML = `
      <div class="empty-state empty-state-centered">
        <p>No lessons captured yet</p>
        <p class="empty-state-hint">Use /learn to capture lessons from mistakes, or enable automatic detection</p>
      </div>
    `;
    return;
  }

  // Sort by timestamp descending (most recent first)
  const sorted = [...lessons].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  sorted.forEach(lesson => {
    const card = createLessonCard(lesson);
    container.appendChild(card);
  });
}

function createLessonCard(lesson) {
  const card = templates.lessonCard.content.cloneNode(true);
  const cardEl = card.querySelector('.lesson-card');

  // Category badge
  const categoryEl = card.querySelector('.lesson-category');
  const categoryName = lesson.category?.replace(/-/g, ' ') || 'other';
  categoryEl.textContent = categoryName;
  categoryEl.classList.add(`category-${lesson.category || 'other'}`);

  // Date
  const dateEl = card.querySelector('.lesson-date');
  if (lesson.timestamp) {
    const date = new Date(lesson.timestamp);
    dateEl.textContent = date.toLocaleDateString();
  }

  // Lesson text
  card.querySelector('.lesson-text').textContent = lesson.lesson || 'No description';

  // Tech badges
  const techContainer = card.querySelector('.lesson-tech');
  (lesson.tech || []).forEach(tech => {
    const badge = document.createElement('span');
    badge.className = 'tech-badge';
    badge.textContent = tech;
    techContainer.appendChild(badge);
  });

  // Code blocks
  const failedCodeEl = card.querySelector('.failed-code');
  const fixedCodeEl = card.querySelector('.fixed-code');
  const failedBlock = card.querySelector('.code-block.failed');
  const fixedBlock = card.querySelector('.code-block.fixed');

  if (lesson.failedAttempt) {
    failedCodeEl.textContent = lesson.failedAttempt;
  } else {
    failedBlock.style.display = 'none';
  }

  if (lesson.resolution) {
    fixedCodeEl.textContent = lesson.resolution;
  } else {
    fixedBlock.style.display = 'none';
  }

  // Error message
  const errorEl = card.querySelector('.lesson-error');
  if (lesson.error) {
    errorEl.textContent = lesson.error;
  } else {
    errorEl.style.display = 'none';
  }

  // Hits
  card.querySelector('.lesson-hits').textContent = `${lesson.hits || 0} hits`;

  // Actions
  const promoteBtn = card.querySelector('.promote-btn');
  const deleteBtn = card.querySelector('.delete-btn');

  promoteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      promoteBtn.disabled = true;
      promoteBtn.textContent = 'Promoting...';
      const result = await api(`/lessons/${encodeURIComponent(lesson.id)}/promote`, { method: 'POST' });
      promoteBtn.textContent = 'Promoted!';
      setTimeout(() => {
        promoteBtn.textContent = 'Promote to KB';
        promoteBtn.disabled = false;
      }, 2000);
    } catch (error) {
      promoteBtn.textContent = 'Error';
      console.error('Failed to promote lesson:', error);
      setTimeout(() => {
        promoteBtn.textContent = 'Promote to KB';
        promoteBtn.disabled = false;
      }, 2000);
    }
  });

  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this lesson?')) return;

    try {
      await api(`/lessons/${encodeURIComponent(lesson.id)}`, { method: 'DELETE' });
      cardEl.remove();
      // Update state
      state.lessons = state.lessons.filter(l => l.id !== lesson.id);
    } catch (error) {
      console.error('Failed to delete lesson:', error);
      showToast('Failed to delete lesson', 'error');
    }
  });

  // Click card to view details
  cardEl.addEventListener('click', () => {
    showLessonDetailModal(lesson);
  });

  return card;
}

function showLessonDetailModal(lesson) {
  const modal = templates.detailModal.content.cloneNode(true);

  const categoryName = lesson.category?.replace(/-/g, ' ') || 'other';
  modal.querySelector('.modal-title').textContent = `Lesson: ${categoryName}`;

  let md = `## ${lesson.lesson || 'Lesson Details'}\n\n`;

  if (lesson.tech?.length) {
    md += `**Technologies:** ${lesson.tech.join(', ')}\n\n`;
  }

  if (lesson.file) {
    md += `**File:** \`${lesson.file}\`\n\n`;
  }

  if (lesson.failedAttempt) {
    md += `### Failed Approach\n\n\`\`\`\n${lesson.failedAttempt}\n\`\`\`\n\n`;
  }

  if (lesson.error) {
    md += `### Error\n\n${lesson.error}\n\n`;
  }

  if (lesson.resolution) {
    md += `### Resolution\n\n\`\`\`\n${lesson.resolution}\n\`\`\`\n\n`;
  }

  md += `---\n\n`;
  md += `**Hits:** ${lesson.hits || 0} | `;
  md += `**Trigger:** ${lesson.trigger || 'manual'} | `;
  md += `**Added:** ${lesson.timestamp ? new Date(lesson.timestamp).toLocaleString() : 'Unknown'}`;

  modal.querySelector('.modal-body').innerHTML = marked.parse(md);

  const closeModal = () => {
    document.body.removeChild(state.modal);
    state.modal = null;
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  document.body.appendChild(modal);
  state.modal = document.body.lastElementChild;
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
  modal.querySelector('.modal-body').innerHTML = marked.parse(content || 'No content available');

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Setup theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Initialize router
  initRouter();
});
