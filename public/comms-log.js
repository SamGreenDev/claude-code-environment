/**
 * CommsLog - Holonet Command Center Communication Log
 * Star Wars terminal-style communication log with WebSocket integration
 */

class CommsLog {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`CommsLog: Container #${containerId} not found`);
      return;
    }

    this.state = {
      entries: [],
      ws: null,
      currentRunId: null,
      typeFilter: 'all',
      nodeFilter: 'all',
      searchText: '',
      autoScroll: true,
    };

    this._buildLayout();
    this._applyStyles();
    this._bindEvents();
    this._loadRuns();
    this._connectWebSocket();
  }

  // ─────────────────────────────────────────────────────────────
  // Layout
  // ─────────────────────────────────────────────────────────────

  _buildLayout() {
    this.container.innerHTML = `
      <div class="cl-wrapper" id="cl-wrapper">
        <!-- CRT scanline overlay -->
        <div class="cl-scanlines" aria-hidden="true"></div>

        <!-- Header -->
        <header class="cl-header">
          <div class="cl-header-title">
            <span class="cl-blink">▌</span>
            HOLONET COMMS LOG
            <span class="cl-blink">▐</span>
          </div>
          <div class="cl-header-sub">IMPERIAL SECURE CHANNEL · ENCRYPTION ACTIVE</div>
        </header>

        <!-- Filter Bar -->
        <div class="cl-filters">
          <div class="cl-filter-row">
            <label class="cl-label">RUN:</label>
            <select id="cl-run-select" class="cl-select">
              <option value="">— SELECT MISSION —</option>
            </select>

            <label class="cl-label">TYPE:</label>
            <div class="cl-type-btns">
              <button class="cl-type-btn cl-active" data-type="all">ALL</button>
              <button class="cl-type-btn" data-type="DISPATCH">DISPATCH</button>
              <button class="cl-type-btn" data-type="COMPLETE">COMPLETE</button>
              <button class="cl-type-btn" data-type="FAIL">FAIL</button>
              <button class="cl-type-btn" data-type="OUTPUT">OUTPUT</button>
            </div>

            <label class="cl-label">NODE:</label>
            <select id="cl-node-select" class="cl-select">
              <option value="all">ALL NODES</option>
            </select>

            <input id="cl-search" class="cl-search" type="text" placeholder="SEARCH TRANSMISSION..." />
            <button id="cl-clear-btn" class="cl-clear-btn">CLEAR</button>
          </div>
        </div>

        <!-- Log Display -->
        <div class="cl-log-container" id="cl-log-container">
          <div class="cl-log" id="cl-log">
            <div class="cl-entry cl-INFO">
              <span class="cl-time">[--:--:--]</span>
              <span class="cl-node">[SYSTEM]</span>
              <span class="cl-badge" style="color:#666666">[INFO]</span>
              <span class="cl-msg">Awaiting transmission... Connect to a mission to begin.</span>
            </div>
          </div>
        </div>

        <!-- Jump to Latest -->
        <button class="cl-jump-btn" id="cl-jump-btn" style="display:none">
          ↓ JUMP TO LATEST
        </button>

        <!-- Status Bar -->
        <div class="cl-status-bar">
          <span id="cl-status-text">STANDBY</span>
          <span class="cl-status-sep">·</span>
          <span id="cl-entry-count">0 TRANSMISSIONS</span>
          <span class="cl-status-sep">·</span>
          <span id="cl-ws-status" class="cl-ws-disconnected">WS: OFFLINE</span>
        </div>
      </div>
    `;

    this._logEl = document.getElementById('cl-log');
    this._logContainer = document.getElementById('cl-log-container');
    this._runSelect = document.getElementById('cl-run-select');
    this._nodeSelect = document.getElementById('cl-node-select');
    this._searchInput = document.getElementById('cl-search');
    this._clearBtn = document.getElementById('cl-clear-btn');
    this._jumpBtn = document.getElementById('cl-jump-btn');
    this._wsStatusEl = document.getElementById('cl-ws-status');
    this._statusText = document.getElementById('cl-status-text');
    this._entryCount = document.getElementById('cl-entry-count');
  }

  _applyStyles() {
    if (document.getElementById('cl-styles')) return;

    const style = document.createElement('style');
    style.id = 'cl-styles';
    style.textContent = `
      /* ── Wrapper ── */
      .cl-wrapper {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 400px;
        background: #0a0a0a;
        color: #33ff33;
        font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
        font-size: 13px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid #1a3a1a;
        box-shadow: 0 0 30px rgba(51,255,51,0.08), inset 0 0 60px rgba(0,0,0,0.5);
      }

      /* ── CRT Scanlines ── */
      .cl-scanlines {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 100;
        background: repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 2px,
          rgba(0,255,0,0.03) 2px,
          rgba(0,255,0,0.03) 3px
        );
      }

      /* ── Header ── */
      .cl-header {
        padding: 12px 16px 8px;
        border-bottom: 1px solid #1a3a1a;
        background: linear-gradient(180deg, #0d1a0d 0%, #0a0a0a 100%);
        flex-shrink: 0;
      }
      .cl-header-title {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 4px;
        text-shadow: 0 0 10px rgba(51,255,51,0.8), 0 0 20px rgba(51,255,51,0.4);
        color: #33ff33;
      }
      .cl-header-sub {
        font-size: 10px;
        color: #1a8a1a;
        letter-spacing: 3px;
        margin-top: 2px;
      }

      /* ── Blink animation ── */
      .cl-blink {
        animation: cl-blink-anim 1s step-end infinite;
      }
      @keyframes cl-blink-anim {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      /* ── Filters ── */
      .cl-filters {
        padding: 8px 16px;
        border-bottom: 1px solid #1a3a1a;
        background: #080808;
        flex-shrink: 0;
      }
      .cl-filter-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      .cl-label {
        color: #1a8a1a;
        font-size: 10px;
        letter-spacing: 2px;
        flex-shrink: 0;
      }
      .cl-select {
        background: #0d1a0d;
        color: #33ff33;
        border: 1px solid #1a5a1a;
        border-radius: 2px;
        padding: 3px 6px;
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        outline: none;
      }
      .cl-select:focus { border-color: #33ff33; }
      .cl-select option { background: #0a0a0a; }

      /* ── Type filter buttons ── */
      .cl-type-btns { display: flex; gap: 4px; }
      .cl-type-btn {
        background: transparent;
        color: #1a8a1a;
        border: 1px solid #1a5a1a;
        border-radius: 2px;
        padding: 3px 8px;
        font-family: inherit;
        font-size: 10px;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .cl-type-btn:hover { color: #33ff33; border-color: #33ff33; }
      .cl-type-btn.cl-active {
        background: #0d2a0d;
        color: #33ff33;
        border-color: #33ff33;
        text-shadow: 0 0 6px rgba(51,255,51,0.6);
      }

      /* ── Search ── */
      .cl-search {
        background: #0d1a0d;
        color: #33ff33;
        border: 1px solid #1a5a1a;
        border-radius: 2px;
        padding: 3px 8px;
        font-family: inherit;
        font-size: 11px;
        outline: none;
        flex: 1;
        min-width: 120px;
      }
      .cl-search::placeholder { color: #1a5a1a; }
      .cl-search:focus { border-color: #33ff33; }

      /* ── Clear button ── */
      .cl-clear-btn {
        background: transparent;
        color: #DC2626;
        border: 1px solid #DC2626;
        border-radius: 2px;
        padding: 3px 10px;
        font-family: inherit;
        font-size: 10px;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      .cl-clear-btn:hover { background: #1a0808; }

      /* ── Log Area ── */
      .cl-log-container {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
        scrollbar-width: thin;
        scrollbar-color: #1a5a1a #0a0a0a;
      }
      .cl-log-container::-webkit-scrollbar { width: 6px; }
      .cl-log-container::-webkit-scrollbar-track { background: #0a0a0a; }
      .cl-log-container::-webkit-scrollbar-thumb { background: #1a5a1a; border-radius: 3px; }

      /* ── Log Entries ── */
      .cl-log { padding: 0 16px; }
      .cl-entry {
        display: flex;
        align-items: baseline;
        gap: 6px;
        padding: 2px 0;
        line-height: 1.6;
        border-bottom: 1px solid transparent;
        transition: background 0.1s;
      }
      .cl-entry:hover { background: rgba(51,255,51,0.03); }
      .cl-entry.cl-hidden { display: none; }

      .cl-time { color: #1a6a1a; flex-shrink: 0; }
      .cl-node { color: #2da82d; flex-shrink: 0; min-width: 120px; }
      .cl-badge { flex-shrink: 0; min-width: 80px; font-weight: 700; }
      .cl-msg {
        color: #33ff33;
        text-shadow: 0 0 5px rgba(51,255,51,0.5);
        word-break: break-word;
        flex: 1;
      }

      /* Entry type accents */
      .cl-COMPLETE .cl-msg { color: #4dff88; }
      .cl-FAIL .cl-msg { color: #ff6666; text-shadow: 0 0 5px rgba(255,50,50,0.5); }
      .cl-RETRY .cl-msg { color: #ffaa44; }
      .cl-INFO .cl-msg { color: #888888; }
      .cl-OUTPUT .cl-msg { color: #44aacc; }

      /* ── Jump to Latest ── */
      .cl-jump-btn {
        position: absolute;
        bottom: 40px;
        right: 20px;
        background: #0d2a0d;
        color: #33ff33;
        border: 1px solid #33ff33;
        border-radius: 2px;
        padding: 6px 14px;
        font-family: inherit;
        font-size: 11px;
        letter-spacing: 1px;
        cursor: pointer;
        z-index: 50;
        box-shadow: 0 0 10px rgba(51,255,51,0.3);
        animation: cl-pulse 2s ease-in-out infinite;
      }
      @keyframes cl-pulse {
        0%, 100% { box-shadow: 0 0 10px rgba(51,255,51,0.3); }
        50% { box-shadow: 0 0 20px rgba(51,255,51,0.6); }
      }

      /* ── Status Bar ── */
      .cl-status-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 16px;
        border-top: 1px solid #1a3a1a;
        background: #080808;
        font-size: 10px;
        color: #1a8a1a;
        letter-spacing: 1px;
        flex-shrink: 0;
      }
      .cl-status-sep { color: #1a5a1a; }
      .cl-ws-connected { color: #33ff33; }
      .cl-ws-disconnected { color: #DC2626; }
      .cl-ws-connecting { color: #E07A30; }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────────
  // Event Binding
  // ─────────────────────────────────────────────────────────────

  _bindEvents() {
    // Run selector
    this._runSelect.addEventListener('change', (e) => {
      this.state.currentRunId = e.target.value || null;
      if (this.state.currentRunId) {
        this._loadRun(this.state.currentRunId);
      }
    });

    // Type filter buttons
    this.container.querySelectorAll('.cl-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.cl-type-btn').forEach((b) => b.classList.remove('cl-active'));
        btn.classList.add('cl-active');
        this.state.typeFilter = btn.dataset.type;
        this._applyFilters();
      });
    });

    // Node filter
    this._nodeSelect.addEventListener('change', (e) => {
      this.state.nodeFilter = e.target.value;
      this._applyFilters();
    });

    // Search
    this._searchInput.addEventListener('input', (e) => {
      this.state.searchText = e.target.value.toLowerCase();
      this._applyFilters();
    });

    // Clear
    this._clearBtn.addEventListener('click', () => {
      this.state.entries = [];
      this._logEl.innerHTML = '';
      this._updateCount();
    });

    // Scroll detection
    this._logContainer.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this._logContainer;
      const atBottom = scrollHeight - scrollTop - clientHeight < 40;
      this.state.autoScroll = atBottom;
      this._jumpBtn.style.display = atBottom ? 'none' : 'block';
    });

    // Jump to latest
    this._jumpBtn.addEventListener('click', () => {
      this._scrollToBottom(true);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WebSocket
  // ─────────────────────────────────────────────────────────────

  _connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws/missions`;

    this._setWsStatus('connecting');

    try {
      this.state.ws = new WebSocket(url);
    } catch (err) {
      this._setWsStatus('disconnected');
      return;
    }

    this.state.ws.onopen = () => {
      this._setWsStatus('connected');
      this._statusText.textContent = 'CONNECTED';
    };

    this.state.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleWsEvent(data);
      } catch (e) {
        // Ignore malformed messages
      }
    };

    this.state.ws.onclose = () => {
      this._setWsStatus('disconnected');
      this._statusText.textContent = 'RECONNECTING...';
      setTimeout(() => this._connectWebSocket(), 3000);
    };

    this.state.ws.onerror = () => {
      this._setWsStatus('disconnected');
    };
  }

  _handleWsEvent(data) {
    const { type, nodeLabel, missionName, error, message } = data;

    switch (type) {
      case 'node_scheduled':
        this._addEntry('DISPATCH', nodeLabel, `Unit ${nodeLabel} queued for dispatch`);
        break;
      case 'node_started':
        this._addEntry('DISPATCH', nodeLabel, `Unit ${nodeLabel} deployed - mission active`);
        break;
      case 'node_completed':
        this._addEntry('COMPLETE', nodeLabel, `Unit ${nodeLabel} reports mission success`);
        break;
      case 'node_failed':
        this._addEntry('FAIL', nodeLabel, `Unit ${nodeLabel} encountered critical failure: ${error || 'unknown'}`);
        break;
      case 'message_logged':
        this._addEntry(data.level === 'output' ? 'OUTPUT' : 'INFO', nodeLabel || 'SYSTEM', message || '');
        break;
      case 'run_started':
        this._addEntry('INFO', 'SYSTEM', `=== MISSION ${missionName || ''} INITIATED ===`);
        break;
      case 'run_completed':
        this._addEntry('COMPLETE', 'SYSTEM', '=== MISSION COMPLETE - ALL UNITS REPORTING ===');
        break;
      case 'run_failed':
        this._addEntry('FAIL', 'SYSTEM', '=== MISSION FAILED ===');
        break;
      default:
        break;
    }
  }

  _setWsStatus(status) {
    this._wsStatusEl.className = `cl-ws-${status}`;
    const labels = { connected: 'WS: ONLINE', disconnected: 'WS: OFFLINE', connecting: 'WS: LINKING...' };
    this._wsStatusEl.textContent = labels[status] || 'WS: UNKNOWN';
  }

  // ─────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────

  async _loadRuns() {
    try {
      const [runsRes, missionsRes] = await Promise.all([
        fetch('/api/missions/runs').then(r => r.ok ? r.json() : {}),
        fetch('/api/missions').then(r => r.ok ? r.json() : {}),
      ]);
      const runs = runsRes.data || runsRes || [];
      const missions = missionsRes.data || missionsRes || [];

      // Build mission name lookup
      const missionMap = {};
      (Array.isArray(missions) ? missions : []).forEach(m => {
        missionMap[m.id || m.missionId] = m.name || m.id;
      });

      const statusIcons = {
        completed: '✓',
        failed: '✗',
        aborted: '⬛',
        running: '●',
      };

      (Array.isArray(runs) ? runs : []).forEach((run) => {
        const opt = document.createElement('option');
        opt.value = run.id;
        const missionName = missionMap[run.missionId] || 'Unknown Mission';
        const icon = statusIcons[run.status] || '○';
        const dateStr = this._formatRelativeDate(run.startedAt);
        opt.textContent = `${icon} ${missionName} · ${dateStr} · ${(run.status || 'unknown').toUpperCase()}`;
        this._runSelect.appendChild(opt);
      });
    } catch (e) {
      // Server may not have this endpoint yet
    }
  }

  async _loadRun(runId) {
    try {
      const res = await fetch(`/api/missions/runs/${runId}`);
      if (!res.ok) return;
      const json = await res.json();
      const run = json.data || json;

      // Clear and repopulate
      this.state.entries = [];
      this._logEl.innerHTML = '';

      // Fetch mission definition for node labels
      let missionNodes = [];
      if (run.missionId) {
        try {
          const mRes = await fetch(`/api/missions/${run.missionId}`);
          if (mRes.ok) {
            const mJson = await mRes.json();
            const mission = mJson.data || mJson;
            missionNodes = mission.nodes || [];
          }
        } catch { /* best effort */ }
      }

      // Build node label map from mission nodes or nodeStates
      const nodeLabels = {};
      missionNodes.forEach((n) => { nodeLabels[n.id] = n.label || n.id; });

      // Populate node filter from nodeStates (with labels from mission)
      const nodeFilterItems = Object.keys(run.nodeStates || {}).map((id) => ({
        id,
        label: nodeLabels[id] || id,
      }));
      this._populateNodeFilter(nodeFilterItems);

      // Add any stored messages first
      (run.messages || []).forEach((msg) => {
        this._addEntry(msg.type || 'INFO', msg.nodeLabel || 'SYSTEM', msg.content || '', msg.timestamp, false);
      });

      // Synthesize comms entries from nodeStates
      const entries = [];
      for (const [nodeId, state] of Object.entries(run.nodeStates || {})) {
        const label = nodeLabels[nodeId] || nodeId;

        if (state.startedAt) {
          entries.push({ type: 'DISPATCH', nodeLabel: label, message: `Node started`, timestamp: state.startedAt });
        }
        if (state.status === 'completed' && state.completedAt) {
          const outputPreview = state.output ? String(state.output).slice(0, 300) : 'Completed';
          entries.push({ type: 'COMPLETE', nodeLabel: label, message: outputPreview, timestamp: state.completedAt });
        }
        if (state.status === 'failed' && state.completedAt) {
          entries.push({ type: 'FAIL', nodeLabel: label, message: state.error || 'Failed', timestamp: state.completedAt });
        }
        if (state.status === 'retrying') {
          entries.push({ type: 'RETRY', nodeLabel: label, message: `Retry #${state.retryCount || 1}`, timestamp: state.startedAt });
        }
        if (state.output && state.status === 'completed') {
          entries.push({ type: 'OUTPUT', nodeLabel: label, message: String(state.output), timestamp: state.completedAt });
        }
      }

      // Sort by timestamp and add
      entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      entries.forEach((e) => this._addEntry(e.type, e.nodeLabel, e.message, e.timestamp, false));

      // Run status entry
      if (run.status === 'completed') {
        this._addEntry('COMPLETE', 'SYSTEM', `Mission run completed`, run.completedAt, false);
      } else if (run.status === 'failed') {
        this._addEntry('FAIL', 'SYSTEM', run.error || 'Mission run failed', run.completedAt, false);
      } else if (run.status === 'running') {
        this._addEntry('INFO', 'SYSTEM', 'Mission run in progress...', run.startedAt, false);
      }

      this._applyFilters();
      this._scrollToBottom(true);
    } catch (e) {
      // Handle gracefully
    }
  }

  _populateNodeFilter(nodes) {
    this._nodeSelect.innerHTML = '<option value="all">ALL NODES</option>';
    nodes.forEach((node) => {
      const opt = document.createElement('option');
      opt.value = node.label || node.id;
      opt.textContent = node.label || node.id;
      this._nodeSelect.appendChild(opt);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Entry Management
  // ─────────────────────────────────────────────────────────────

  _addEntry(type, nodeLabel, message, timestamp, scroll = true) {
    const MAX_ENTRIES = 500;

    const entry = {
      type,
      nodeLabel: nodeLabel || 'SYSTEM',
      message,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      id: `cl-e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    this.state.entries.push(entry);

    // Enforce max entries
    if (this.state.entries.length > MAX_ENTRIES) {
      const removed = this.state.entries.shift();
      const removedEl = document.getElementById(removed.id);
      if (removedEl) removedEl.remove();
    }

    const el = this._buildEntryEl(entry);
    this._logEl.appendChild(el);

    // Apply current filters to new entry
    this._filterEntry(entry, el);

    if (scroll && this.state.autoScroll) {
      this._scrollToBottom();
    }

    this._updateCount();
  }

  _buildEntryEl(entry) {
    const { type, nodeLabel, message, timestamp, id } = entry;

    const badgeColors = {
      DISPATCH: '#4fa4ff',
      COMPLETE: '#2D6A4F',
      FAIL: '#DC2626',
      RETRY: '#E07A30',
      INFO: '#666666',
      OUTPUT: '#1B6B93',
    };

    const badgeColor = badgeColors[type] || '#666666';
    const timeStr = this._formatTime(timestamp);
    const nodeStr = `[${nodeLabel}]`;
    const badgeStr = `[${type}]`;

    const div = document.createElement('div');
    div.className = `cl-entry cl-${type}`;
    div.id = id;
    div.dataset.type = type;
    div.dataset.node = nodeLabel;
    div.dataset.msg = message.toLowerCase();

    div.innerHTML = `
      <span class="cl-time">[${timeStr}]</span>
      <span class="cl-node">${this._esc(nodeStr)}</span>
      <span class="cl-badge" style="color:${badgeColor}">${badgeStr}</span>
      <span class="cl-msg">${this._esc(message)}</span>
    `;

    return div;
  }

  // ─────────────────────────────────────────────────────────────
  // Filtering
  // ─────────────────────────────────────────────────────────────

  _applyFilters() {
    const { typeFilter, nodeFilter, searchText } = this.state;
    const allEntries = this._logEl.querySelectorAll('.cl-entry');

    allEntries.forEach((el) => {
      const type = el.dataset.type;
      const node = el.dataset.node;
      const msg = el.dataset.msg || '';

      const typeMatch = typeFilter === 'all' || type === typeFilter;
      const nodeMatch = nodeFilter === 'all' || node === nodeFilter;
      const searchMatch = !searchText || msg.includes(searchText) || node.toLowerCase().includes(searchText);

      el.classList.toggle('cl-hidden', !(typeMatch && nodeMatch && searchMatch));
    });
  }

  _filterEntry(entry, el) {
    const { typeFilter, nodeFilter, searchText } = this.state;
    const typeMatch = typeFilter === 'all' || entry.type === typeFilter;
    const nodeMatch = nodeFilter === 'all' || entry.nodeLabel === nodeFilter;
    const searchMatch = !searchText || entry.message.toLowerCase().includes(searchText) || entry.nodeLabel.toLowerCase().includes(searchText);
    el.classList.toggle('cl-hidden', !(typeMatch && nodeMatch && searchMatch));
  }

  // ─────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────

  _scrollToBottom(force = false) {
    if (force || this.state.autoScroll) {
      this._logContainer.scrollTop = this._logContainer.scrollHeight;
      this.state.autoScroll = true;
      this._jumpBtn.style.display = 'none';
    }
  }

  _updateCount() {
    this._entryCount.textContent = `${this.state.entries.length} TRANSMISSIONS`;
  }

  _formatTime(date) {
    if (!(date instanceof Date) || isNaN(date)) date = new Date();
    return [
      date.getHours().toString().padStart(2, '0'),
      date.getMinutes().toString().padStart(2, '0'),
      date.getSeconds().toString().padStart(2, '0'),
    ].join(':');
  }

  _formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  _formatRelativeDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      // Fall back to short date
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${mm}/${dd}`;
    } catch {
      return '—';
    }
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  /**
   * Programmatically add a log entry
   * @param {string} type - DISPATCH | COMPLETE | FAIL | RETRY | INFO | OUTPUT
   * @param {string} nodeLabel - Node/droid label
   * @param {string} message - Message content
   */
  log(type, nodeLabel, message) {
    this._addEntry(type, nodeLabel, message);
  }

  /**
   * Destroy the instance, close WebSocket, clear container
   */
  destroy() {
    if (this.state.ws) {
      this.state.ws.onclose = null;
      this.state.ws.close();
      this.state.ws = null;
    }
    this.state.entries = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
    const styleEl = document.getElementById('cl-styles');
    if (styleEl) styleEl.remove();
  }
}

// Export
window.CommsLog = CommsLog;
