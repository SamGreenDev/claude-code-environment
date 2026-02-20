/**
 * Mission Builder - Holographic Planning Table
 * DAG workflow editor for designing agent missions
 */

const _MODEL_DISPLAY = {
  'claude-haiku-4-5-20251001': 'claude-haiku-10-01',
};
function _modelLabel(id) { return _MODEL_DISPLAY[id] || id || 'claude-sonnet-4-6'; }

// Unit roster is now provided by FactionData (faction-data.js)
function _getCurrentUnits() {
  const { factionId } = window.FactionData.getCurrentFaction();
  return window.FactionData.UNIT_ROSTER[factionId] || window.FactionData.UNIT_ROSTER['rebel'];
}

function _getCurrentFactionId() {
  return window.FactionData.getCurrentFaction().factionId;
}

// ── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('mb-styles')) return;
  const style = document.createElement('style');
  style.id = 'mb-styles';
  style.textContent = `
    .mb-root {
      display: flex;
      width: 100%;
      height: 100%;
      min-height: 600px;
      background: #0d0d0d;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #F0F0F0;
      overflow: hidden;
      position: relative;
    }

    /* ── Sidebar ── */
    .mb-sidebar {
      width: 200px;
      min-width: 200px;
      background: #111;
      border-right: 1px solid #2a2a2a;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10;
    }
    .mb-sidebar-header {
      padding: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #666;
      border-bottom: 1px solid #2a2a2a;
      background: #0d0d0d;
    }
    .mb-palette {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .mb-palette::-webkit-scrollbar { width: 4px; }
    .mb-palette::-webkit-scrollbar-track { background: transparent; }
    .mb-palette::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

    .mb-palette-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      margin-bottom: 4px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      cursor: grab;
      transition: all 0.15s ease;
      user-select: none;
    }
    .mb-palette-item:hover {
      background: #222;
      border-color: #3a3a3a;
      transform: translateX(2px);
    }
    .mb-palette-item:active { cursor: grabbing; }
    .mb-palette-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }
    .mb-palette-info { min-width: 0; }
    .mb-palette-label {
      font-size: 11px;
      font-weight: 500;
      color: #E0E0E0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mb-palette-type {
      font-size: 9px;
      color: #555;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Canvas Area ── */
    .mb-canvas-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }

    /* ── Toolbar ── */
    .mb-toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: #111;
      border-bottom: 1px solid #2a2a2a;
      z-index: 10;
      flex-wrap: wrap;
    }
    .mb-mission-name {
      background: #1a1a1a;
      border: 1px solid #3a3a3a;
      color: #F0F0F0;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 13px;
      font-weight: 500;
      width: 180px;
      outline: none;
      transition: border-color 0.15s;
    }
    .mb-mission-name:focus { border-color: #C74634; }
    .mb-toolbar-sep {
      width: 1px;
      height: 20px;
      background: #2a2a2a;
      margin: 0 2px;
    }
    .mb-btn {
      background: #262626;
      border: 1px solid #3a3a3a;
      color: #F0F0F0;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      outline: none;
    }
    .mb-btn:hover { background: #333; border-color: #4a4a4a; }
    .mb-btn:active { transform: scale(0.97); }
    .mb-btn-primary { background: #C74634; border-color: #C74634; }
    .mb-btn-primary:hover { background: #E05A4A; border-color: #E05A4A; }
    .mb-btn-danger { color: #DC2626; border-color: #4a1010; }
    .mb-btn-danger:hover { background: #2a1010; border-color: #DC2626; }

    /* ── Faction Selectors ── */
    .mb-faction-select {
      background: #1a1a1a;
      border: 1px solid #3a3a3a;
      color: #F0F0F0;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
      transition: border-color 0.15s;
      font-family: inherit;
    }
    .mb-faction-select:focus { border-color: #C74634; }
    .mb-faction-select option { background: #1a1a1a; }
    .mb-side-toggle {
      min-width: 140px;
      text-align: center;
      font-size: 11px;
      letter-spacing: 0.04em;
    }

    /* ── Canvas wrapper ── */
    .mb-canvas-wrapper {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    .mb-canvas-wrapper canvas {
      position: absolute;
      top: 0; left: 0;
      pointer-events: none;
    }
    .mb-node-overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: 100%;
    }
    .mb-canvas-hint {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 11px;
      color: #333;
      pointer-events: none;
      white-space: nowrap;
    }

    /* ── Nodes ── */
    .mb-node {
      position: absolute;
      background: #1a1a1a;
      border: 1px solid #3a3a3a;
      border-radius: 8px;
      padding: 8px;
      min-width: 140px;
      max-width: 180px;
      cursor: default;
      transition: border-color 0.15s, box-shadow 0.15s;
      user-select: none;
      z-index: 1;
    }
    .mb-node:hover { border-color: #4a4a4a; }
    .mb-node.selected {
      border-color: #C74634;
      box-shadow: 0 0 12px rgba(199,70,52,0.4);
    }
    .mb-node.connecting-source {
      border-color: #4fa4ff;
      box-shadow: 0 0 12px rgba(79,164,255,0.4);
    }
    .mb-node-header {
      display: flex;
      align-items: center;
      gap: 7px;
      cursor: move;
      margin-bottom: 4px;
    }
    .mb-node-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }
    .mb-node-label {
      font-size: 12px;
      font-weight: 600;
      color: #F0F0F0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mb-node-type {
      font-size: 9px;
      color: #555;
      padding-left: 35px;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mb-node-badge {
      font-size: 9px;
      color: #444;
      padding-left: 35px;
    }

    /* ── Ports ── */
    .mb-node-port {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid #4fa4ff;
      background: #0d0d0d;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      cursor: crosshair;
      transition: all 0.15s;
      z-index: 100;
    }
    /* Larger hit area for easier clicking */
    .mb-node-port::after {
      content: '';
      position: absolute;
      top: -6px;
      left: -6px;
      right: -6px;
      bottom: -6px;
      border-radius: 50%;
    }
    .mb-node-port:hover {
      background: #4fa4ff;
      transform: translateX(-50%) scale(1.3);
    }
    .mb-port-input  { top: -9px; }
    .mb-port-output { bottom: -9px; }
    .mb-port-output { border-color: #50C878; }
    .mb-port-output:hover { background: #50C878; }

    /* connecting mode */
    .mb-connecting .mb-port-input {
      border-color: #ffcc00;
      animation: port-pulse 0.8s ease-in-out infinite;
    }
    .mb-connecting .mb-port-input:hover {
      background: #00cc66;
      border-color: #00cc66;
      transform: translateX(-50%) scale(1.5);
      box-shadow: 0 0 0 4px rgba(0,204,102,0.35);
      animation: none;
    }
    /* During connection mode:
       - Remove node stacking context so port z-index is global
       - Disable pointer events on node body so clicks pass through to ports */
    .mb-connecting .mb-node {
      pointer-events: none;
      z-index: auto !important;
    }
    .mb-connecting .mb-node-port {
      pointer-events: auto;
      z-index: 9999;
    }
    .mb-connecting .mb-node.connecting-source {
      pointer-events: none;
    }
    @keyframes port-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,204,0,0.4); }
      50% { box-shadow: 0 0 0 5px rgba(255,204,0,0); }
    }

    /* ── Preview line for drag-to-connect ── */
    .mb-preview-svg {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9998;
    }
    .mb-preview-svg line {
      stroke: #4fa4ff;
      stroke-width: 2;
      stroke-dasharray: 8 4;
      stroke-linecap: round;
      opacity: 0.7;
    }

    /* ── Right Panel ── */
    .mb-config-panel {
      width: 280px;
      min-width: 280px;
      background: #111;
      border-left: 1px solid #2a2a2a;
      display: flex;
      flex-direction: column;
      z-index: 10;
      transition: width 0.2s ease, opacity 0.2s ease;
    }
    .mb-config-panel.hidden {
      width: 0;
      min-width: 0;
      opacity: 0;
      overflow: hidden;
    }
    .mb-config-header {
      padding: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #666;
      border-bottom: 1px solid #2a2a2a;
      background: #0d0d0d;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .mb-config-close {
      background: none;
      border: none;
      color: #555;
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      line-height: 1;
    }
    .mb-config-close:hover { color: #F0F0F0; }
    .mb-config-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .mb-config-body::-webkit-scrollbar { width: 4px; }
    .mb-config-body::-webkit-scrollbar-track { background: transparent; }
    .mb-config-body::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    .mb-field {
      margin-bottom: 14px;
    }
    .mb-field label {
      display: block;
      font-size: 11px;
      color: #888;
      margin-bottom: 5px;
      font-weight: 500;
    }
    .mb-field input, .mb-field select, .mb-field textarea {
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #3a3a3a;
      color: #F0F0F0;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s;
      box-sizing: border-box;
      font-family: inherit;
      resize: vertical;
    }
    .mb-field input:focus, .mb-field select:focus, .mb-field textarea:focus {
      border-color: #C74634;
    }
    .mb-field select option { background: #1a1a1a; }
    .mb-config-footer {
      padding: 12px;
      border-top: 1px solid #2a2a2a;
    }
    .mb-delete-node-btn {
      width: 100%;
      background: transparent;
      border: 1px solid #4a1010;
      color: #DC2626;
      border-radius: 6px;
      padding: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .mb-delete-node-btn:hover { background: #2a1010; border-color: #DC2626; }

    /* ── Modal ── */
    .mb-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .mb-modal {
      background: #1a1a1a;
      border: 1px solid #3a3a3a;
      border-radius: 10px;
      padding: 20px;
      width: 420px;
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
    }
    .mb-modal-title {
      font-size: 14px;
      font-weight: 600;
      color: #F0F0F0;
      margin-bottom: 16px;
      padding-right: 24px;
    }
    .mb-modal-close {
      position: absolute;
      top: 12px;
      right: 14px;
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      font-size: 16px;
    }
    .mb-modal-close:hover { color: #F0F0F0; }
    .mb-ctx-row {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
      align-items: center;
    }
    .mb-ctx-row input {
      flex: 1;
      background: #262626;
      border: 1px solid #3a3a3a;
      color: #F0F0F0;
      border-radius: 5px;
      padding: 5px 8px;
      font-size: 12px;
      outline: none;
    }
    .mb-ctx-row input:focus { border-color: #C74634; }
    .mb-ctx-remove {
      background: none;
      border: 1px solid #4a1010;
      color: #DC2626;
      border-radius: 4px;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      flex-shrink: 0;
    }
    .mb-ctx-remove:hover { background: #2a1010; }
    .mb-modal-actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      margin-top: 16px;
    }

    /* ── Load Modal ── */
    .mb-mission-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .mb-mission-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      margin-bottom: 4px;
      background: #262626;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .mb-mission-item:hover { background: #303030; border-color: #4fa4ff; }
    .mb-mission-item-name { font-size: 13px; font-weight: 500; }
    .mb-mission-item-meta { font-size: 11px; color: #555; }
    .mb-empty-state {
      text-align: center;
      padding: 24px;
      color: #444;
      font-size: 13px;
    }

    /* ── Connection cursor ── */
    .mb-cursor-connect { cursor: crosshair !important; }

    /* ── Animate in ── */
    @keyframes mb-node-spawn {
      from { opacity: 0; transform: scale(0.8); }
      to   { opacity: 1; transform: scale(1); }
    }
    .mb-node-spawn { animation: mb-node-spawn 0.15s ease-out forwards; }
  `;
  document.head.appendChild(style);
}

// ── Utils ────────────────────────────────────────────────────────────────────

function uid() {
  return 'n' + Math.random().toString(36).slice(2, 9);
}

function getUnitByType(type) {
  const factionId = _getCurrentFactionId();
  return window.FactionData.getUnitByType(factionId, type);
}

// ── MissionBuilder ────────────────────────────────────────────────────────────

class MissionBuilder {
  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

    if (!this.container) throw new Error('MissionBuilder: container not found');

    injectStyles();

    // State
    this.nodes = new Map();
    this.edges = new Map();
    this.selectedNodeId = null;
    this.connectingFrom = null;
    this.missionId = null;
    this.missionName = 'Untitled Mission';
    this.context = {};

    // Animation
    this._rafId = null;
    this._lastFrame = 0;
    this._stars = [];
    this._gridLines = null;

    // Drag state
    this._dragging = null;
    this._dragOffset = { x: 0, y: 0 };

    this._build();
    this._initStars();
    this._startAnimation();
    this._bindGlobalEvents();
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  _build() {
    this.container.style.cssText = 'width:100%;height:100%;overflow:hidden;';
    this.container.innerHTML = '';

    this.root = document.createElement('div');
    this.root.className = 'mb-root';

    // Sidebar
    this.sidebar = this._buildSidebar();

    // Canvas area
    this.canvasArea = document.createElement('div');
    this.canvasArea.className = 'mb-canvas-area';

    this.toolbar = this._buildToolbar();

    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.className = 'mb-canvas-wrapper';

    this.canvas = document.createElement('canvas');
    this.canvasWrapper.appendChild(this.canvas);

    this.overlay = document.createElement('div');
    this.overlay.className = 'mb-node-overlay';
    this.canvasWrapper.appendChild(this.overlay);

    const hint = document.createElement('div');
    hint.className = 'mb-canvas-hint';
    hint.textContent = 'Drag units from panel · Drag from output port to input port to connect · Click node to configure';
    this.canvasWrapper.appendChild(hint);

    this.canvasArea.appendChild(this.toolbar);
    this.canvasArea.appendChild(this.canvasWrapper);

    // Config panel
    this.configPanel = this._buildConfigPanel();

    this.root.appendChild(this.sidebar);
    this.root.appendChild(this.canvasArea);
    this.root.appendChild(this.configPanel);
    this.container.appendChild(this.root);

    this._resizeCanvas();
    this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
    this._resizeObserver.observe(this.canvasWrapper);

    this._bindCanvasEvents();
  }

  _buildSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'mb-sidebar';

    this._sidebarHeader = document.createElement('div');
    this._sidebarHeader.className = 'mb-sidebar-header';
    sidebar.appendChild(this._sidebarHeader);

    this._palette = document.createElement('div');
    this._palette.className = 'mb-palette';

    sidebar.appendChild(this._palette);
    this._renderSidebar();
    return sidebar;
  }

  _renderSidebar() {
    const { factionId } = window.FactionData.getCurrentFaction();
    const factionName = window.FactionData.getFactionName(factionId);
    const factionIcon = window.FactionData.getFactionIcon(factionId);
    this._sidebarHeader.textContent = `${factionIcon} ${factionName} Arsenal`;

    this._palette.innerHTML = '';
    const units = _getCurrentUnits();
    units.forEach(unit => {
      const item = document.createElement('div');
      item.className = 'mb-palette-item';
      item.draggable = true;
      item.dataset.unitType = unit.type;

      const icon = document.createElement('div');
      icon.className = 'mb-palette-icon';
      icon.style.background = unit.color;
      icon.textContent = unit.label.charAt(0);

      const info = document.createElement('div');
      info.className = 'mb-palette-info';
      const lbl = document.createElement('div');
      lbl.className = 'mb-palette-label';
      lbl.textContent = unit.label;
      const typ = document.createElement('div');
      typ.className = 'mb-palette-type';
      typ.textContent = unit.type;
      info.appendChild(lbl);
      info.appendChild(typ);

      item.appendChild(icon);
      item.appendChild(info);
      this._palette.appendChild(item);

      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/mb-unit', unit.type);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
  }

  _buildToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'mb-toolbar';

    this.nameInput = document.createElement('input');
    this.nameInput.className = 'mb-mission-name';
    this.nameInput.value = this.missionName;
    this.nameInput.placeholder = 'Mission name…';
    this.nameInput.addEventListener('input', () => {
      this.missionName = this.nameInput.value;
    });

    const sep = () => { const d = document.createElement('div'); d.className = 'mb-toolbar-sep'; return d; };

    const btn = (label, cls, handler) => {
      const b = document.createElement('button');
      b.className = 'mb-btn' + (cls ? ' ' + cls : '');
      b.textContent = label;
      b.addEventListener('click', handler);
      return b;
    };

    toolbar.appendChild(this.nameInput);
    toolbar.appendChild(sep());

    // Era/Faction selectors
    this._eraSelect = document.createElement('select');
    this._eraSelect.className = 'mb-faction-select';
    window.FactionData.ERAS.forEach(era => {
      const opt = document.createElement('option');
      opt.value = era.id;
      opt.textContent = era.label;
      this._eraSelect.appendChild(opt);
    });

    this._sideToggle = document.createElement('button');
    this._sideToggle.className = 'mb-btn mb-side-toggle';

    const currentFaction = window.FactionData.getCurrentFaction();
    this._eraSelect.value = currentFaction.eraId;
    this._updateSideToggle(currentFaction.side);

    this._eraSelect.addEventListener('change', () => this._onFactionChange());
    this._sideToggle.addEventListener('click', () => {
      const current = window.FactionData.getCurrentFaction();
      const newSide = current.side === 'light' ? 'dark' : 'light';
      this._updateSideToggle(newSide);
      this._onFactionChange();
    });

    toolbar.appendChild(this._eraSelect);
    toolbar.appendChild(this._sideToggle);
    toolbar.appendChild(sep());

    toolbar.appendChild(btn('⚙ Context', '', () => this._showContextModal()));

    this._workdirBadge = document.createElement('span');
    this._workdirBadge.style.cssText = 'font-size:10px;font-family:"SF Mono","Fira Code",Consolas,monospace;padding:3px 8px;border-radius:4px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    this._updateWorkdirBadge();
    toolbar.appendChild(this._workdirBadge);

    toolbar.appendChild(sep());
    toolbar.appendChild(btn('💾 Save', '', () => this._save()));
    toolbar.appendChild(btn('📂 Load', '', () => this._load()));
    toolbar.appendChild(btn('🗑 Delete', 'mb-btn-danger', () => this._deleteMission()));
    toolbar.appendChild(sep());
    toolbar.appendChild(btn('📋 Template', '', () => this._saveTemplate()));
    toolbar.appendChild(btn('▶', 'mb-btn-primary', () => this._execute()));

    return toolbar;
  }

  _buildConfigPanel() {
    const panel = document.createElement('div');
    panel.className = 'mb-config-panel hidden';

    const header = document.createElement('div');
    header.className = 'mb-config-header';
    const title = document.createElement('span');
    title.textContent = '☰ Node Config';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'mb-config-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this._deselectNode());
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'mb-config-body';
    this._configBody = body;

    const footer = document.createElement('div');
    footer.className = 'mb-config-footer';
    const delBtn = document.createElement('button');
    delBtn.className = 'mb-delete-node-btn';
    delBtn.textContent = '🗑 Delete Node';
    delBtn.addEventListener('click', () => {
      if (this.selectedNodeId) this._deleteNode(this.selectedNodeId);
    });
    footer.appendChild(delBtn);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);
    return panel;
  }

  // ── Canvas & Animation ──────────────────────────────────────────────────────

  _resizeCanvas() {
    const rect = this.canvasWrapper.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this._gridLines = null; // invalidate grid cache
  }

  _initStars() {
    this._stars = Array.from({ length: 200 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 1.5,
      alpha: 0.3 + Math.random() * 0.7,
      speed: 0.001 + Math.random() * 0.003,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  _startAnimation() {
    const loop = (ts) => {
      this._rafId = requestAnimationFrame(loop);
      if (ts - this._lastFrame < 66) return; // ~15fps cap
      this._lastFrame = ts;
      this._drawBackground(ts);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _drawBackground(ts) {
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    if (!W || !H) return;

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, W, H);

    // Stars
    this._stars.forEach(s => {
      s.phase += s.speed;
      const a = s.alpha * (0.5 + 0.5 * Math.sin(s.phase));
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fill();
    });

    // Holographic grid - perspective lines to center-top vanishing point
    if (!this._gridLines || this._gridLines.W !== W || this._gridLines.H !== H) {
      this._buildGrid(W, H);
    }
    ctx.save();
    ctx.strokeStyle = '#4fa4ff18';
    ctx.lineWidth = 0.5;
    for (const line of this._gridLines.lines) {
      ctx.beginPath();
      ctx.moveTo(line[0], line[1]);
      ctx.lineTo(line[2], line[3]);
      ctx.stroke();
    }
    ctx.restore();
  }

  _buildGrid(W, H) {
    const vx = W / 2;
    const vy = 0;
    const lines = [];
    // Radial lines from vanishing point
    const numRadial = 24;
    for (let i = 0; i <= numRadial; i++) {
      const t = i / numRadial;
      const bx = t * W;
      lines.push([vx, vy, bx, H]);
    }
    // Horizontal bands
    const numH = 12;
    for (let i = 1; i <= numH; i++) {
      const t = i / numH;
      const y = t * H;
      // Interpolate left/right edge x based on perspective
      const lx = vx + (0 - vx) * t;
      const rx = vx + (W - vx) * t;
      lines.push([lx, y, rx, y]);
    }
    this._gridLines = { W, H, lines };
  }

  // ── Node Creation ───────────────────────────────────────────────────────────

  _createNode(agentType, position) {
    const unit = getUnitByType(agentType);
    const factionId = _getCurrentFactionId();
    const factionName = window.FactionData.getFactionName(factionId);
    const factionIcon = window.FactionData.getFactionIcon(factionId);
    const id = uid();

    const el = document.createElement('div');
    el.className = 'mb-node mb-node-spawn';
    el.style.left = position.x + 'px';
    el.style.top = position.y + 'px';
    el.dataset.nodeId = id;

    // Input port
    const inputPort = document.createElement('div');
    inputPort.className = 'mb-node-port mb-port-input';
    inputPort.dataset.nodeId = id;
    inputPort.dataset.portType = 'input';
    inputPort.title = 'Drop connection here';

    // Header
    const header = document.createElement('div');
    header.className = 'mb-node-header';
    header.title = 'Drag to move';

    const icon = document.createElement('div');
    icon.className = 'mb-node-icon';
    icon.style.background = unit.color;
    icon.textContent = unit.label.charAt(0);

    const label = document.createElement('span');
    label.className = 'mb-node-label';
    label.textContent = unit.label;

    header.appendChild(icon);
    header.appendChild(label);

    const typeDiv = document.createElement('div');
    typeDiv.className = 'mb-node-type';
    typeDiv.textContent = agentType;

    const badge = document.createElement('div');
    badge.className = 'mb-node-badge';
    badge.textContent = `⚡ ${_modelLabel('')}`;

    // Output port
    const outputPort = document.createElement('div');
    outputPort.className = 'mb-node-port mb-port-output';
    outputPort.dataset.nodeId = id;
    outputPort.dataset.portType = 'output';
    outputPort.title = 'Drag to connect';

    el.appendChild(inputPort);
    el.appendChild(header);
    el.appendChild(typeDiv);
    el.appendChild(badge);
    el.appendChild(outputPort);

    this.overlay.appendChild(el);

    const node = {
      id,
      label: unit.label,
      agentType,
      unitClass: unit.unitClass,
      color: unit.color,
      position: { ...position },
      prompt: '',
      config: { timeout: 300, retries: 1 },
      provider: 'claude-code',
      model: '',
      mcpServers: [],
      element: el,
      inputPort,
      outputPort,
      iconEl: icon,
      labelEl: label,
      typeEl: typeDiv,
      badgeEl: badge,
    };

    this.nodes.set(id, node);
    this._bindNodeEvents(node);

    // Remove spawn class after animation
    setTimeout(() => el.classList.remove('mb-node-spawn'), 200);

    return node;
  }

  _bindNodeEvents(node) {
    const { element, inputPort, outputPort } = node;

    // Click node body → select
    element.addEventListener('mousedown', e => {
      if (e.target === inputPort || e.target === outputPort) return;
      if (e.target.closest('.mb-node-header')) return;
      e.stopPropagation();
      this._selectNode(node.id);
    });

    // Header drag
    const header = element.querySelector('.mb-node-header');
    header.addEventListener('mousedown', e => {
      e.stopPropagation();
      this._selectNode(node.id);

      const rect = element.getBoundingClientRect();
      this._dragging = node.id;
      this._dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      element.style.zIndex = '20';
    });

    // Output port mousedown → start drag-to-connect
    outputPort.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      if (this.connectingFrom === node.id) {
        this._cancelConnect();
        return;
      }
      this._startConnect(node.id, e);
    });

    // Stop input port mousedown from triggering node drag
    inputPort.addEventListener('mousedown', e => { e.stopPropagation(); });

    // Input port click → complete connection
    inputPort.addEventListener('click', e => {
      e.stopPropagation();
      if (this.connectingFrom && this.connectingFrom !== node.id) {
        this._finishConnect(node.id);
      }
    });
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  _selectNode(id) {
    if (this.selectedNodeId) {
      const prev = this.nodes.get(this.selectedNodeId);
      if (prev) prev.element.classList.remove('selected');
    }
    this.selectedNodeId = id;
    const node = this.nodes.get(id);
    if (node) {
      node.element.classList.add('selected');
      this._showConfig(node);
    }
  }

  _deselectNode() {
    if (this.selectedNodeId) {
      const node = this.nodes.get(this.selectedNodeId);
      if (node) node.element.classList.remove('selected');
    }
    this.selectedNodeId = null;
    this.configPanel.classList.add('hidden');
  }

  // ── Config Panel ────────────────────────────────────────────────────────────

  _showConfig(node) {
    this.configPanel.classList.remove('hidden');
    const body = this._configBody;
    body.innerHTML = '';

    const field = (label, inputEl) => {
      const wrap = document.createElement('div');
      wrap.className = 'mb-field';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      wrap.appendChild(lbl);
      wrap.appendChild(inputEl);
      return wrap;
    };

    // Label
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = node.label;
    labelInput.addEventListener('input', () => {
      node.label = labelInput.value;
      node.labelEl.textContent = labelInput.value;
      node.iconEl.textContent = labelInput.value.charAt(0);
    });
    body.appendChild(field('Label', labelInput));

    // Agent Type
    const typeSelect = document.createElement('select');
    const units = _getCurrentUnits();
    units.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.type;
      opt.textContent = `${u.label} (${u.type})`;
      if (u.type === node.agentType) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      const unit = getUnitByType(typeSelect.value);
      node.agentType = unit.type;
      node.unitClass = unit.unitClass;
      node.color = unit.color;
      node.iconEl.style.background = unit.color;
      node.typeEl.textContent = unit.type;
    });
    body.appendChild(field('Agent Type', typeSelect));

    // Prompt
    const promptTA = document.createElement('textarea');
    promptTA.rows = 6;
    promptTA.placeholder = 'Describe this agent\'s mission objectives…';
    promptTA.value = node.prompt;
    promptTA.addEventListener('input', () => { node.prompt = promptTA.value; });
    body.appendChild(field('Prompt / Instructions', promptTA));

    // Timeout
    const timeoutInput = document.createElement('input');
    timeoutInput.type = 'number';
    timeoutInput.min = 30;
    timeoutInput.max = 3600;
    timeoutInput.value = node.config.timeout;
    timeoutInput.addEventListener('input', () => {
      node.config.timeout = parseInt(timeoutInput.value, 10) || 300;
    });
    body.appendChild(field('Timeout (seconds)', timeoutInput));

    // Retries
    const retriesInput = document.createElement('input');
    retriesInput.type = 'number';
    retriesInput.min = 0;
    retriesInput.max = 3;
    retriesInput.value = node.config.retries;
    retriesInput.addEventListener('input', () => {
      node.config.retries = parseInt(retriesInput.value, 10) || 0;
    });
    body.appendChild(field('Retries', retriesInput));

    // Provider
    const providerSelect = document.createElement('select');
    ['claude-code', 'openai', 'gemini', 'local'].forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === node.provider) opt.selected = true;
      providerSelect.appendChild(opt);
    });
    providerSelect.addEventListener('change', () => { node.provider = providerSelect.value; });
    body.appendChild(field('Provider', providerSelect));

    // Model selector
    const modelSelect = document.createElement('select');
    modelSelect.style.cssText = 'width:100%;padding:6px 8px;background:var(--bg-primary, #161616);color:var(--text-primary, #F5F5F5);border:1px solid var(--border-default, #3F3F3F);border-radius:6px;font-size:0.85rem;';
    const modelOptions = [
      { value: '', label: '(default)' },
      { value: 'claude-opus-4-6', label: 'claude-opus-4-6' },
      { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6' },
      { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-10-01' },
    ];
    modelOptions.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      if (m.value === (node.model || '')) opt.selected = true;
      modelSelect.appendChild(opt);
    });
    modelSelect.addEventListener('change', () => {
      node.model = modelSelect.value || '';
      if (node.badgeEl) {
        node.badgeEl.textContent = `⚡ ${_modelLabel(node.model)}`;
      }
    });
    body.appendChild(field('Model', modelSelect));

    // MCP Servers section
    const mcpSection = document.createElement('div');
    mcpSection.style.cssText = 'margin-top:16px;border-top:1px solid var(--border-subtle, #2E2E2E);padding-top:12px;';

    const mcpHeader = document.createElement('div');
    mcpHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
    const mcpTitle = document.createElement('div');
    mcpTitle.textContent = 'MCP Servers';
    mcpTitle.style.cssText = 'font-weight:600;font-size:0.875rem;color:var(--text-primary, #F5F5F5);';
    mcpHeader.appendChild(mcpTitle);

    const mcpBadge = document.createElement('span');
    const selectedCount = (node.mcpServers || []).length;
    mcpBadge.textContent = selectedCount > 0 ? `${selectedCount} selected` : '';
    mcpBadge.style.cssText = 'font-size:0.7rem;color:var(--text-muted, #6B7280);';
    mcpHeader.appendChild(mcpBadge);
    mcpSection.appendChild(mcpHeader);

    const mcpChipsContainer = document.createElement('div');
    mcpChipsContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';

    const renderMcpChips = (servers) => {
      mcpChipsContainer.innerHTML = '';
      if (!servers || servers.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No MCP servers configured';
        empty.style.cssText = 'font-style:italic;color:var(--text-muted, #6B7280);font-size:0.8rem;';
        mcpChipsContainer.appendChild(empty);
        return;
      }
      servers.forEach(server => {
        const isSelected = (node.mcpServers || []).includes(server.name);
        const chip = document.createElement('span');

        const typeIcons = { npm: '\u{1F4E6}', python: '\u{1F40D}', docker: '\u{1F433}', node: '\u{1F49A}', filesystem: '\u{1F4C1}', github: '\u{1F419}', database: '\u{1F5C3}', api: '\u{1F310}' };
        const icon = typeIcons[server.type] || '\u2699\uFE0F';
        chip.textContent = `${icon} ${server.name}`;
        chip.title = `${server.type} — click to toggle`;
        chip.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:12px;font-size:0.75rem;cursor:pointer;transition:all 0.15s;border:1px solid ${isSelected ? 'var(--accent, #C74634)' : 'var(--border-default, #3F3F3F)'};background:${isSelected ? 'rgba(199,70,52,0.15)' : 'var(--bg-hover, #383838)'};color:${isSelected ? 'var(--accent-light, #E8685A)' : 'var(--text-primary, #F5F5F5)'};`;

        chip.addEventListener('click', () => {
          if (!node.mcpServers) node.mcpServers = [];
          const idx = node.mcpServers.indexOf(server.name);
          if (idx >= 0) {
            node.mcpServers.splice(idx, 1);
          } else {
            node.mcpServers.push(server.name);
          }
          mcpBadge.textContent = node.mcpServers.length > 0 ? `${node.mcpServers.length} selected` : '';
          renderMcpChips(servers);
        });

        chip.addEventListener('mouseenter', () => {
          if (!isSelected) chip.style.borderColor = 'var(--accent, #C74634)';
        });
        chip.addEventListener('mouseleave', () => {
          if (!isSelected) chip.style.borderColor = 'var(--border-default, #3F3F3F)';
        });

        mcpChipsContainer.appendChild(chip);
      });
    };

    // Fetch MCP servers with caching
    const now = Date.now();
    if (!this._mcpServersCache || !this._mcpServersCacheTime || (now - this._mcpServersCacheTime > 60000)) {
      const loadingMsg = document.createElement('div');
      loadingMsg.textContent = 'Loading MCP servers\u2026';
      loadingMsg.style.cssText = 'font-style:italic;color:var(--text-muted, #6B7280);font-size:0.8rem;';
      mcpChipsContainer.appendChild(loadingMsg);

      fetch('/api/mcp-servers')
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
        .then(({ servers }) => {
          this._mcpServersCache = servers || [];
          this._mcpServersCacheTime = Date.now();
          renderMcpChips(this._mcpServersCache);
        })
        .catch(() => {
          mcpChipsContainer.innerHTML = '';
          const err = document.createElement('div');
          err.textContent = 'Failed to load MCP servers';
          err.style.cssText = 'font-style:italic;color:var(--warning, #E07A30);font-size:0.8rem;';
          mcpChipsContainer.appendChild(err);
        });
    } else {
      renderMcpChips(this._mcpServersCache);
    }

    mcpSection.appendChild(mcpChipsContainer);
    body.appendChild(mcpSection);

    // Connections section
    const rels = this._computeRelationships(node.id);
    const connSection = document.createElement('div');
    connSection.style.cssText = 'margin-top:16px;border-top:1px solid var(--border-subtle, #2E2E2E);padding-top:12px;';

    const connTitle = document.createElement('div');
    connTitle.textContent = 'Connections';
    connTitle.style.cssText = 'font-weight:600;font-size:0.875rem;margin-bottom:8px;color:var(--text-primary, #F5F5F5);';
    connSection.appendChild(connTitle);

    const hasAny = rels.parents.length || rels.children.length || rels.siblings.length;
    if (!hasAny) {
      const empty = document.createElement('div');
      empty.textContent = 'No connections yet';
      empty.style.cssText = 'font-style:italic;color:var(--text-muted, #6B7280);font-size:0.8rem;';
      connSection.appendChild(empty);
    } else {
      const renderGroup = (label, nodes, dotColor) => {
        if (!nodes.length) return;
        const group = document.createElement('div');
        group.style.cssText = 'margin-bottom:6px;';
        const groupLabel = document.createElement('div');
        groupLabel.textContent = label;
        groupLabel.style.cssText = 'font-size:0.75rem;color:var(--text-secondary, #9CA3AF);margin-bottom:4px;';
        group.appendChild(groupLabel);
        const chips = document.createElement('div');
        chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
        nodes.forEach(n => {
          const chip = document.createElement('span');
          chip.textContent = n.label;
          chip.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:0.75rem;cursor:pointer;background:var(--bg-hover, #383838);color:var(--text-primary, #F5F5F5);transition:background 0.15s;`;
          chip.addEventListener('mouseenter', () => { chip.style.background = 'var(--accent, #C74634)'; });
          chip.addEventListener('mouseleave', () => { chip.style.background = 'var(--bg-hover, #383838)'; });
          chip.addEventListener('click', () => { this._selectNode(n.id); });
          // Dot indicator
          const dot = document.createElement('span');
          dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${dotColor};display:inline-block;flex-shrink:0;`;
          chip.prepend(dot);
          chips.appendChild(chip);
        });
        group.appendChild(chips);
        connSection.appendChild(group);
      };
      renderGroup('Parents', rels.parents, '#4fa4ff');
      renderGroup('Children', rels.children, '#40916C');
      renderGroup('Siblings', rels.siblings, '#E07A30');
    }

    // Template variable hints for parent outputs
    if (rels.parents.length > 0) {
      const hintSection = document.createElement('div');
      hintSection.style.cssText = 'margin-top:10px;padding:8px;background:var(--bg-elevated, #2E2E2E);border-radius:8px;border:1px solid var(--border-subtle, #2E2E2E);';

      const hintTitle = document.createElement('div');
      hintTitle.textContent = 'Template Variables';
      hintTitle.style.cssText = 'font-size:0.7rem;color:var(--text-secondary, #9CA3AF);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;';
      hintSection.appendChild(hintTitle);

      const hintDesc = document.createElement('div');
      hintDesc.textContent = 'Use these in prompts to reference parent outputs:';
      hintDesc.style.cssText = 'font-size:0.75rem;color:var(--text-muted, #6B7280);margin-bottom:6px;';
      hintSection.appendChild(hintDesc);

      const chipContainer = document.createElement('div');
      chipContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';

      // Add {context.workdir} chip if workdir is set
      if (this.context.workdir) {
        const wdChip = document.createElement('span');
        const wdText = '{context.workdir}';
        wdChip.textContent = wdText;
        wdChip.title = `Click to copy — resolves to "${this.context.workdir}"`;
        wdChip.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:6px;font-size:0.7rem;font-family:"SF Mono","Fira Code",Consolas,monospace;cursor:pointer;background:rgba(45,106,79,0.15);color:#52c67e;border:1px solid rgba(45,106,79,0.3);transition:background 0.15s;';
        wdChip.addEventListener('mouseenter', () => { wdChip.style.background = 'rgba(45,106,79,0.3)'; });
        wdChip.addEventListener('mouseleave', () => { wdChip.style.background = 'rgba(45,106,79,0.15)'; });
        wdChip.addEventListener('click', () => {
          navigator.clipboard.writeText(wdText).catch(() => {});
          wdChip.textContent = 'Copied!';
          setTimeout(() => { wdChip.textContent = wdText; }, 1200);
        });
        chipContainer.appendChild(wdChip);
      }

      rels.parents.forEach(p => {
        const varChip = document.createElement('span');
        const varText = `{${p.id}.output}`;
        varChip.textContent = varText;
        varChip.title = `Click to copy — references output from "${p.label}"`;
        varChip.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:6px;font-size:0.7rem;font-family:"SF Mono","Fira Code",Consolas,monospace;cursor:pointer;background:rgba(79,164,255,0.15);color:#4fa4ff;border:1px solid rgba(79,164,255,0.3);transition:background 0.15s;';
        varChip.addEventListener('mouseenter', () => { varChip.style.background = 'rgba(79,164,255,0.3)'; });
        varChip.addEventListener('mouseleave', () => { varChip.style.background = 'rgba(79,164,255,0.15)'; });
        varChip.addEventListener('click', () => {
          navigator.clipboard.writeText(varText).catch(() => {});
          varChip.textContent = 'Copied!';
          setTimeout(() => { varChip.textContent = varText; }, 1200);
        });
        chipContainer.appendChild(varChip);
      });
      hintSection.appendChild(chipContainer);
      connSection.appendChild(hintSection);
    }

    body.appendChild(connSection);
  }

  _computeRelationships(nodeId) {
    const parents = [];
    const children = [];
    const parentIds = new Set();
    const childIds = new Set();

    for (const edge of this.edges.values()) {
      if (edge.to === nodeId) {
        parentIds.add(edge.from);
        const n = this.nodes.get(edge.from);
        if (n) parents.push({ id: n.id, label: n.label });
      }
      if (edge.from === nodeId) {
        childIds.add(edge.to);
        const n = this.nodes.get(edge.to);
        if (n) children.push({ id: n.id, label: n.label });
      }
    }

    // Siblings: nodes sharing a parent or child with this node (excluding self)
    const siblingIds = new Set();
    for (const edge of this.edges.values()) {
      if (parentIds.has(edge.from) && edge.to !== nodeId) siblingIds.add(edge.to);
      if (childIds.has(edge.to) && edge.from !== nodeId) siblingIds.add(edge.from);
    }
    // Remove any that are already parents or children
    for (const id of parentIds) siblingIds.delete(id);
    for (const id of childIds) siblingIds.delete(id);

    const siblings = [];
    for (const id of siblingIds) {
      const n = this.nodes.get(id);
      if (n) siblings.push({ id: n.id, label: n.label });
    }

    return { parents, children, siblings };
  }

  _refreshConfigIfNeeded(...nodeIds) {
    if (this.selectedNodeId && nodeIds.includes(this.selectedNodeId)) {
      const node = this.nodes.get(this.selectedNodeId);
      if (node) this._showConfig(node);
    }
  }

  // ── Drag to Canvas ──────────────────────────────────────────────────────────

  _bindCanvasEvents() {
    this.overlay.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.overlay.addEventListener('drop', e => {
      e.preventDefault();
      const agentType = e.dataTransfer.getData('application/mb-unit') || e.dataTransfer.getData('application/mb-droid');
      if (!agentType) return;

      const rect = this.overlay.getBoundingClientRect();
      const x = e.clientX - rect.left - 70;
      const y = e.clientY - rect.top - 40;
      const node = this._createNode(agentType, { x: Math.max(10, x), y: Math.max(20, y) });
      this._selectNode(node.id);
    });

    // Click on canvas deselects
    this.overlay.addEventListener('mousedown', e => {
      if (e.target === this.overlay) {
        this._deselectNode();
        if (this.connectingFrom) this._cancelConnect();
      }
    });
  }

  // ── Node Dragging ───────────────────────────────────────────────────────────

  _bindGlobalEvents() {
    this._onMouseMove = e => {
      // Node dragging
      if (this._dragging) {
        const node = this.nodes.get(this._dragging);
        if (!node) return;

        const rect = this.overlay.getBoundingClientRect();
        const x = e.clientX - rect.left - this._dragOffset.x;
        const y = e.clientY - rect.top - this._dragOffset.y;
        const clampedX = Math.max(0, Math.min(rect.width - node.element.offsetWidth, x));
        const clampedY = Math.max(10, Math.min(rect.height - node.element.offsetHeight, y));

        node.element.style.left = clampedX + 'px';
        node.element.style.top = clampedY + 'px';
        node.position = { x: clampedX, y: clampedY };

        // Reposition all connected edges
        this._repositionEdges(node.id);
      }

      // Connection preview line
      if (this.connectingFrom && this._previewLine) {
        const rect = this.overlay.getBoundingClientRect();
        this._previewLine.setAttribute('x2', e.clientX - rect.left);
        this._previewLine.setAttribute('y2', e.clientY - rect.top);
      }
    };

    this._onMouseUp = (e) => {
      // Existing drag reset
      if (this._dragging) {
        const node = this.nodes.get(this._dragging);
        if (node) node.element.style.zIndex = '1';
        this._dragging = null;
      }

      // Connection drag completion
      if (this.connectingFrom) {
        // Hide preview SVG so elementFromPoint can reach the port underneath
        if (this._previewSvg) this._previewSvg.style.display = 'none';
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (this._previewSvg) this._previewSvg.style.display = '';
        const targetPort = target?.closest('.mb-node-port.mb-port-input');
        if (targetPort) {
          const targetNodeEl = targetPort.closest('.mb-node');
          if (targetNodeEl) {
            for (const [id, n] of this.nodes) {
              if (n.element === targetNodeEl && id !== this.connectingFrom) {
                this._finishConnect(id);
                return;
              }
            }
          }
        }
        this._cancelConnect();
      }
    };

    this._onKeyDown = e => {
      if (e.key === 'Escape') {
        if (this.connectingFrom) this._cancelConnect();
        else this._deselectNode();
      }
      if (e.key === 'Delete' && this.selectedNodeId && !this._isInputFocused()) {
        this._deleteNode(this.selectedNodeId);
      }
    };

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown);
  }

  _isInputFocused() {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  _repositionEdges(nodeId) {
    this.edges.forEach(edge => {
      if (edge.from === nodeId || edge.to === nodeId) {
        try { edge.line.position(); } catch (_) {}
      }
    });
  }

  // ── Edge Creation ───────────────────────────────────────────────────────────

  _startConnect(fromId, e) {
    this._cancelConnect();
    this.connectingFrom = fromId;
    this.overlay.classList.add('mb-cursor-connect');
    this.root.classList.add('mb-connecting');
    const node = this.nodes.get(fromId);
    if (node) node.element.classList.add('connecting-source');

    // Create SVG preview line
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('mb-preview-svg');
    this.overlay.appendChild(svg);
    this._previewSvg = svg;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    svg.appendChild(line);
    this._previewLine = line;

    // Set start point from the output port center
    const overlayRect = this.overlay.getBoundingClientRect();
    const portRect = node.outputPort.getBoundingClientRect();
    const startX = portRect.left + portRect.width / 2 - overlayRect.left;
    const startY = portRect.top + portRect.height / 2 - overlayRect.top;
    line.setAttribute('x1', startX);
    line.setAttribute('y1', startY);
    line.setAttribute('x2', e ? e.clientX - overlayRect.left : startX);
    line.setAttribute('y2', e ? e.clientY - overlayRect.top : startY);
  }

  _finishConnect(toId) {
    const fromId = this.connectingFrom;
    this._cancelConnect();
    if (!fromId || fromId === toId) return;

    // No duplicate edges
    const edgeKey = `e-${fromId}-${toId}`;
    if (this.edges.has(edgeKey)) return;

    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    if (!fromNode || !toNode) return;

    // Guard: LeaderLine must be loaded
    if (!window.LeaderLine) {
      console.error('LeaderLine library not loaded');
      this._toast('Connection library not loaded', '#DC2626');
      return;
    }

    // Create LeaderLine
    let line;
    try {
      line = new window.LeaderLine(fromNode.outputPort, toNode.inputPort, {
        color: '#4fa4ff80',
        size: 2,
        path: 'fluid',
        startPlug: 'disc',
        endPlug: 'arrow1',
        dash: { animation: true },
      });
    } catch (err) {
      console.error('LeaderLine failed:', err);
      this._toast('Connection failed', '#DC2626');
      return;
    }

    // LeaderLine appends SVG elements to document.body.
    // #app has z-index:1 creating a stacking context, so we must
    // lift LeaderLine SVGs above it and disable pointer events.
    requestAnimationFrame(() => {
      document.querySelectorAll('body > .leader-line, body > svg.leader-line').forEach(el => {
        el.style.pointerEvents = 'none';
        el.style.zIndex = '2';
      });
    });

    const edge = { id: edgeKey, from: fromId, to: toId, line };
    this.edges.set(edgeKey, edge);
    this._refreshConfigIfNeeded(fromId, toId);
  }

  _cancelConnect() {
    if (this.connectingFrom) {
      const node = this.nodes.get(this.connectingFrom);
      if (node) node.element.classList.remove('connecting-source');
    }
    this.connectingFrom = null;
    this.overlay.classList.remove('mb-cursor-connect');
    this.root.classList.remove('mb-connecting');

    // Remove preview line
    if (this._previewSvg) {
      this._previewSvg.remove();
      this._previewSvg = null;
      this._previewLine = null;
    }
  }

  _deleteEdge(edgeId) {
    const edge = this.edges.get(edgeId);
    if (!edge) return;
    const { from, to } = edge;
    try { edge.line.remove(); } catch (_) {}
    this.edges.delete(edgeId);
    this._refreshConfigIfNeeded(from, to);
  }

  // ── Node Deletion ───────────────────────────────────────────────────────────

  _deleteNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove connected edges
    for (const [edgeId, edge] of this.edges) {
      if (edge.from === id || edge.to === id) {
        this._deleteEdge(edgeId);
      }
    }

    node.element.remove();
    this.nodes.delete(id);

    if (this.selectedNodeId === id) {
      this.selectedNodeId = null;
      this.configPanel.classList.add('hidden');
    }
  }

  // ── Context Modal ───────────────────────────────────────────────────────────

  _showContextModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'mb-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'mb-modal';

    const title = document.createElement('div');
    title.className = 'mb-modal-title';
    title.textContent = '⚙ Context Variables';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'mb-modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => backdrop.remove());

    // ── Dedicated workdir field ──
    const workdirSection = document.createElement('div');
    workdirSection.style.cssText = 'margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #2a2a2a;';

    const workdirLabel = document.createElement('label');
    workdirLabel.textContent = 'Project Working Directory';
    workdirLabel.style.cssText = 'display:block;font-size:11px;color:#888;margin-bottom:5px;font-weight:600;';
    workdirSection.appendChild(workdirLabel);

    const workdirInput = document.createElement('input');
    workdirInput.type = 'text';
    workdirInput.value = this.context.workdir || '';
    workdirInput.placeholder = '~/projects/my-project';
    workdirInput.style.cssText = 'width:100%;background:#262626;border:1px solid #3a3a3a;color:#F0F0F0;border-radius:5px;padding:7px 10px;font-size:13px;font-family:"SF Mono","Fira Code",Consolas,monospace;outline:none;box-sizing:border-box;';
    workdirInput.addEventListener('focus', () => { workdirInput.style.borderColor = '#C74634'; });
    workdirInput.addEventListener('blur', () => { workdirInput.style.borderColor = '#3a3a3a'; });
    workdirSection.appendChild(workdirInput);

    const workdirHint = document.createElement('div');
    workdirHint.textContent = 'Agents will spawn in this directory and create files here';
    workdirHint.style.cssText = 'font-size:10px;color:#555;margin-top:4px;';
    workdirSection.appendChild(workdirHint);

    // ── Template variable chip for workdir ──
    const chipContainer = document.createElement('div');
    chipContainer.style.cssText = 'margin-top:8px;display:flex;gap:6px;align-items:center;';
    const chipLabel = document.createElement('span');
    chipLabel.textContent = 'Template var:';
    chipLabel.style.cssText = 'font-size:10px;color:#555;';
    chipContainer.appendChild(chipLabel);
    const workdirChip = document.createElement('span');
    workdirChip.textContent = '{context.workdir}';
    workdirChip.title = 'Click to copy — use in prompts to reference the working directory';
    workdirChip.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-family:"SF Mono","Fira Code",Consolas,monospace;cursor:pointer;background:rgba(79,164,255,0.15);color:#4fa4ff;border:1px solid rgba(79,164,255,0.3);transition:background 0.15s;';
    workdirChip.addEventListener('click', () => {
      navigator.clipboard.writeText('{context.workdir}').catch(() => {});
      workdirChip.textContent = 'Copied!';
      setTimeout(() => { workdirChip.textContent = '{context.workdir}'; }, 1200);
    });
    chipContainer.appendChild(workdirChip);
    workdirSection.appendChild(chipContainer);

    // ── Generic key-value rows ──
    const kvTitle = document.createElement('div');
    kvTitle.textContent = 'Additional Variables';
    kvTitle.style.cssText = 'font-size:11px;color:#888;margin-bottom:8px;font-weight:600;';

    const rowsContainer = document.createElement('div');
    const rows = [];

    const addRow = (k = '', v = '') => {
      const row = document.createElement('div');
      row.className = 'mb-ctx-row';

      const keyInput = document.createElement('input');
      keyInput.placeholder = 'KEY';
      keyInput.value = k;

      const valInput = document.createElement('input');
      valInput.placeholder = 'value';
      valInput.value = v;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'mb-ctx-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        row.remove();
        rows.splice(rows.indexOf({ keyInput, valInput }), 1);
      });

      row.appendChild(keyInput);
      row.appendChild(valInput);
      row.appendChild(removeBtn);
      rowsContainer.appendChild(row);
      rows.push({ keyInput, valInput });
    };

    // Populate existing context (skip workdir — it has its own field)
    Object.entries(this.context).forEach(([k, v]) => {
      if (k !== 'workdir') addRow(k, v);
    });
    if (Object.keys(this.context).filter(k => k !== 'workdir').length === 0) addRow();

    const addBtn = document.createElement('button');
    addBtn.className = 'mb-btn';
    addBtn.style.marginTop = '8px';
    addBtn.textContent = '+ Add Variable';
    addBtn.addEventListener('click', () => addRow());

    const actions = document.createElement('div');
    actions.className = 'mb-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'mb-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => backdrop.remove());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'mb-btn mb-btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const ctx = {};
      // Save workdir
      const wd = workdirInput.value.trim();
      if (wd) ctx.workdir = wd;
      // Save generic vars
      rowsContainer.querySelectorAll('.mb-ctx-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const k = inputs[0].value.trim();
        const v = inputs[1].value.trim();
        if (k && k !== 'workdir') ctx[k] = v;
      });
      this.context = ctx;
      this._updateWorkdirBadge();
      backdrop.remove();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(workdirSection);
    modal.appendChild(kvTitle);
    modal.appendChild(rowsContainer);
    modal.appendChild(addBtn);
    modal.appendChild(actions);
    backdrop.appendChild(modal);

    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }

  // ── Save / Load ─────────────────────────────────────────────────────────────

  getMissionData() {
    return {
      id: this.missionId,
      name: this.missionName,
      nodes: Array.from(this.nodes.values()).map(n => ({
        id: n.id,
        label: n.label,
        agentType: n.agentType,
        unitClass: n.unitClass,
        color: n.color,
        position: n.position,
        prompt: n.prompt,
        config: { ...n.config },
        provider: n.provider,
        model: n.model || '',
        mcpServers: [...(n.mcpServers || [])],
      })),
      edges: Array.from(this.edges.values()).map(e => ({
        id: e.id,
        from: e.from,
        to: e.to,
        type: 'sequential',
      })),
      context: { ...this.context },
    };
  }

  async _save() {
    const data = this.getMissionData();
    data.name = this.nameInput.value || 'Untitled Mission';
    this.missionName = data.name;

    try {
      const url = this.missionId ? `/api/missions/${this.missionId}` : '/api/missions';
      const method = this.missionId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data: saved } = await res.json();
      this.missionId = saved.id || saved._id || this.missionId;
      this._toast('Mission saved', '#2D6A4F');
    } catch (err) {
      console.error('Save failed:', err);
      this._toast('Save failed: ' + err.message, '#DC2626');
    }
  }

  async _load() {
    let missions;
    try {
      const res = await fetch('/api/missions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ({ data: missions } = await res.json());
    } catch (err) {
      this._toast('Failed to load missions', '#DC2626');
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'mb-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'mb-modal';

    const title = document.createElement('div');
    title.className = 'mb-modal-title';
    title.textContent = '📂 Load Mission';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'mb-modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => backdrop.remove());

    let listEl;
    if (!missions || !missions.length) {
      listEl = document.createElement('div');
      listEl.className = 'mb-empty-state';
      listEl.textContent = 'No saved missions found.';
    } else {
      listEl = document.createElement('ul');
      listEl.className = 'mb-mission-list';
      missions.forEach(m => {
        const item = document.createElement('li');
        item.className = 'mb-mission-item';
        const nameEl = document.createElement('div');
        nameEl.className = 'mb-mission-item-name';
        nameEl.textContent = m.name || 'Unnamed';
        const meta = document.createElement('div');
        meta.className = 'mb-mission-item-meta';
        meta.textContent = `${(m.nodes || []).length} nodes`;
        item.appendChild(nameEl);
        item.appendChild(meta);
        item.addEventListener('click', async () => {
          backdrop.remove();
          try {
            const res = await fetch(`/api/missions/${m.id || m._id}`);
            const { data: full } = await res.json();
            this.loadMission(full);
          } catch (err) {
            this._toast('Failed to load mission', '#DC2626');
          }
        });
        listEl.appendChild(item);
      });
    }

    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(listEl);
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
  }

  async _deleteMission() {
    if (!this.missionId) {
      this._toast('No saved mission to delete', '#E07A30');
      return;
    }
    if (!confirm(`Delete mission "${this.missionName}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/missions/${this.missionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.missionId = null;
      this.missionName = 'Untitled Mission';
      this.nameInput.value = this.missionName;
      this._clearCanvas();
      this._toast('Mission deleted', '#2D6A4F');
    } catch (err) {
      this._toast('Delete failed: ' + err.message, '#DC2626');
    }
  }

  async _saveTemplate() {
    const name = prompt('Template name:', this.missionName + ' (template)');
    if (!name) return;
    const data = { ...this.getMissionData(), name, isTemplate: true };

    try {
      await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      this._toast('Template saved', '#2D6A4F');
    } catch (err) {
      this._toast('Template save failed', '#DC2626');
    }
  }

  async _execute() {
    if (!this.missionId) {
      await this._save();
      if (!this.missionId) {
        this._toast('Save mission before executing', '#E07A30');
        return;
      }
    }

    try {
      const res = await fetch(`/api/missions/${this.missionId}/run`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data: run } = await res.json();
      window.location.hash = `/holonet?run=${run.id}`;
    } catch (err) {
      this._toast('Execute failed: ' + err.message, '#DC2626');
    }
  }

  loadMission(missionDef) {
    this._clearCanvas();
    this.missionId = missionDef.id || null;
    this.missionName = missionDef.name || 'Untitled Mission';
    this.context = { ...missionDef.context };
    this.nameInput.value = this.missionName;

    // Re-create nodes
    const nodeIdMap = new Map(); // old id → new node
    (missionDef.nodes || []).forEach(nd => {
      // Backward compat: migrate droidClass → unitClass
      if (nd.droidClass && !nd.unitClass) {
        nd.unitClass = window.FactionData.migrateDroidClass(nd.droidClass);
      }

      const unit = getUnitByType(nd.agentType);
      const pos = nd.position || { x: 80, y: 80 };
      const node = this._createNode(nd.agentType, pos);

      // Override with saved data
      node.label = nd.label || unit.label;
      node.unitClass = nd.unitClass || unit.unitClass;
      node.prompt = nd.prompt || '';
      node.config = { timeout: 300, retries: 1, ...nd.config };
      node.provider = nd.provider || 'claude-code';
      node.mcpServers = nd.mcpServers || [];
      node.model = nd.model || '';
      node.labelEl.textContent = node.label;
      node.iconEl.textContent = node.label.charAt(0);
      node.typeEl.textContent = nd.agentType;
      if (node.badgeEl) {
        node.badgeEl.textContent = `⚡ ${_modelLabel(node.model)}`;
      }

      nodeIdMap.set(nd.id, node.id);
    });

    // Defer edge creation until after browser layout so LeaderLine
    // can measure port bounding rects correctly
    requestAnimationFrame(() => {
      (missionDef.edges || []).forEach(ed => {
        const fromNewId = nodeIdMap.get(ed.from);
        const toNewId = nodeIdMap.get(ed.to);
        if (!fromNewId || !toNewId) return;
        this.connectingFrom = fromNewId;
        this._finishConnect(toNewId);
      });
    });

    this._updateWorkdirBadge();
    this._deselectNode();
  }

  _clearCanvas() {
    // Remove all edges
    for (const [id] of this.edges) this._deleteEdge(id);
    // Remove all nodes
    for (const [id] of this.nodes) {
      const node = this.nodes.get(id);
      if (node) node.element.remove();
    }
    this.nodes.clear();
    this.edges.clear();
    this.selectedNodeId = null;
    this.configPanel.classList.add('hidden');
  }

  // ── Workdir Badge ──────────────────────────────────────────────────────────

  _updateWorkdirBadge() {
    if (!this._workdirBadge) return;
    const wd = this.context.workdir;
    if (wd) {
      this._workdirBadge.textContent = wd;
      this._workdirBadge.style.background = 'rgba(45,106,79,0.3)';
      this._workdirBadge.style.color = '#52c67e';
      this._workdirBadge.style.border = '1px solid rgba(45,106,79,0.5)';
      this._workdirBadge.title = `Working directory: ${wd}`;
    } else {
      this._workdirBadge.textContent = 'no workdir';
      this._workdirBadge.style.background = 'rgba(60,60,60,0.3)';
      this._workdirBadge.style.color = '#555';
      this._workdirBadge.style.border = '1px solid #333';
      this._workdirBadge.title = 'No working directory set — click Context to configure';
    }
  }

  // ── Toast ───────────────────────────────────────────────────────────────────

  _toast(message, color = '#2D6A4F') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${color};
      color: #fff;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ── Faction Toggle ─────────────────────────────────────────────────────────

  _updateSideToggle(side) {
    const eraId = this._eraSelect ? this._eraSelect.value : 'ot';
    const era = window.FactionData.ERAS.find(e => e.id === eraId);
    if (!era) return;
    const factionId = side === 'dark' ? era.darkFaction : era.lightFaction;
    const faction = window.FactionData.FACTIONS[factionId];
    this._sideToggle.textContent = side === 'light'
      ? `☀ ${faction ? faction.name : 'Light'}`
      : `☽ ${faction ? faction.name : 'Dark'}`;
    this._sideToggle.dataset.side = side;
  }

  _onFactionChange() {
    const eraId = this._eraSelect.value;
    const side = this._sideToggle.dataset.side || 'light';
    window.FactionData.setCurrentFaction(eraId, side);
    this._updateSideToggle(side);
    this._renderSidebar();
    // Update existing node badges
    const factionId = _getCurrentFactionId();
    const factionName = window.FactionData.getFactionName(factionId);
    const factionIcon = window.FactionData.getFactionIcon(factionId);
    this.nodes.forEach(node => {
      if (node.badgeEl) {
        node.badgeEl.textContent = `⚡ ${_modelLabel(node.model)}`;
      }
    });
  }

  // ── Destroy ─────────────────────────────────────────────────────────────────

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._resizeObserver) this._resizeObserver.disconnect();

    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('keydown', this._onKeyDown);

    // Remove all LeaderLine instances
    for (const [id] of this.edges) {
      const edge = this.edges.get(id);
      if (edge) try { edge.line.remove(); } catch (_) {}
    }

    this.nodes.clear();
    this.edges.clear();
    if (this.container) this.container.innerHTML = '';
  }
}

window.MissionBuilder = MissionBuilder;
