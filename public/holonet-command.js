/**
 * HolonetCommand - Live Mission Execution Monitoring UI
 * Oracle Redwood dark theme with canvas DAG visualization
 */

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────────

  const NODE_W = 140;
  const NODE_H = 70;
  const CANVAS_PAD = 60;
  const MAX_COMMS = 200;
  const STAR_COUNT = 100;
  const RECONNECT_DELAY = 3000;
  const TARGET_FPS = 30;

  const STATUS_COLORS = {
    pending:   { fill: '#2a2a2a', border: '#555555', text: '#888888' },
    scheduled: { fill: '#1B6B93', border: '#4fa4ff', text: '#a8d4ff' },
    running:   { fill: '#1a3a5c', border: '#4fa4ff', text: '#4fa4ff' },
    completed: { fill: '#1a3a2a', border: '#40916C', text: '#52c67e' },
    failed:    { fill: '#3a1a1a', border: '#DC2626', text: '#ff6b6b' },
    retrying:  { fill: '#3a2a1a', border: '#E07A30', text: '#f4a261' },
  };

  const BADGE_COLORS = {
    DISPATCH: '#4fa4ff',
    COMPLETE: '#2D6A4F',
    FAIL:     '#DC2626',
    RETRY:    '#E07A30',
    INFO:     '#666666',
    OUTPUT:   '#1B6B93',
  };

  const BADGE_STATUS = {
    STANDBY:   '#3a3a3a',
    EXECUTING: '#4fa4ff',
    COMPLETED: '#2D6A4F',
    FAILED:    '#DC2626',
    ABORTED:   '#E07A30',
  };

  const FALLBACK_COLORS = [
    '#C74634', '#4fa4ff', '#40916C', '#E07A30', '#9B59B6',
    '#1B6B93', '#D35400', '#27AE60', '#8E44AD', '#2980B9',
  ];

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const STYLES = `
    .hc-root {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: #0d0d0d;
      color: #F0F0F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-sizing: border-box;
      overflow: hidden;
    }
    .hc-root *, .hc-root *::before, .hc-root *::after { box-sizing: border-box; }

    /* ── Top Bar ── */
    .hc-topbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: #1a1a1a;
      border-bottom: 1px solid #2a2a2a;
      flex-shrink: 0;
    }
    .hc-topbar-title {
      font-size: 13px;
      font-weight: 600;
      color: #C74634;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-right: 8px;
      white-space: nowrap;
    }
    .hc-run-select {
      background: #262626;
      border: 1px solid #3a3a3a;
      color: #F0F0F0;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 13px;
      flex: 1;
      min-width: 0;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      padding-right: 28px;
    }
    .hc-run-select:hover { border-color: #555; }
    .hc-run-select:focus { border-color: #C74634; }
    .hc-run-select option { background: #262626; color: #F0F0F0; }
    .hc-btn {
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid #3a3a3a;
      background: #262626;
      color: #F0F0F0;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s;
      outline: none;
    }
    .hc-btn:hover { background: #333; border-color: #555; }
    .hc-btn:active { background: #3a3a3a; }
    .hc-btn-primary { background: #C74634; border-color: #C74634; color: #fff; font-weight: 600; }
    .hc-btn-primary:hover { background: #D95A4A; border-color: #D95A4A; }
    .hc-btn-danger { background: #3a1a1a; border-color: #DC2626; color: #ff6b6b; }
    .hc-btn-danger:hover { background: #4a2a2a; border-color: #ff4444; }
    .hc-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .hc-status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: #3a3a3a;
      color: #F0F0F0;
      transition: background 0.3s, color 0.3s;
      white-space: nowrap;
    }
    .hc-status-badge.pulsing {
      animation: hc-pulse-badge 1.2s ease-in-out infinite;
    }
    @keyframes hc-pulse-badge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* ── Main Layout ── */
    .hc-main {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .hc-canvas-wrap {
      flex: 0 0 65%;
      position: relative;
      overflow: hidden;
      background: #0a0e1a;
    }
    .hc-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .hc-canvas-hint {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #333;
      pointer-events: none;
    }
    .hc-canvas-hint-icon { font-size: 48px; margin-bottom: 12px; }
    .hc-canvas-hint-text { font-size: 13px; color: #444; }

    /* ── Comms Panel ── */
    .hc-comms {
      flex: 1;
      display: flex;
      flex-direction: column;
      border-top: 1px solid #2a2a2a;
      background: #111;
      min-height: 0;
    }
    .hc-comms-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: #1a1a1a;
      border-bottom: 1px solid #2a2a2a;
      flex-shrink: 0;
    }
    .hc-comms-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #666;
    }
    .hc-comms-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #2D6A4F;
      animation: hc-blink 2s ease-in-out infinite;
    }
    @keyframes hc-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .hc-comms-clear {
      margin-left: auto;
      font-size: 11px;
      color: #555;
      cursor: pointer;
      padding: 2px 8px;
      border: 1px solid #333;
      border-radius: 4px;
      background: transparent;
    }
    .hc-comms-clear:hover { color: #888; border-color: #555; background: #1e1e1e; }
    .hc-comms-log {
      flex: 1;
      overflow-y: auto;
      padding: 6px 0;
      min-height: 0;
      scroll-behavior: smooth;
    }
    .hc-comms-log::-webkit-scrollbar { width: 4px; }
    .hc-comms-log::-webkit-scrollbar-track { background: #111; }
    .hc-comms-log::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    .hc-comm-entry {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 3px 14px;
      font-size: 12px;
      line-height: 1.5;
      border-left: 2px solid transparent;
      transition: background 0.1s;
    }
    .hc-comm-entry:hover { background: #1a1a1a; }
    .hc-comm-time { color: #555; font-size: 11px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .hc-comm-node { color: #A0A0A0; white-space: nowrap; font-weight: 500; min-width: 90px; }
    .hc-comm-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 1px 6px;
      border-radius: 3px;
      white-space: nowrap;
      color: #fff;
    }
    .hc-comm-msg { color: #C0C0C0; flex: 1; }
    .hc-comm-DISPATCH { border-left-color: #4fa4ff22; }
    .hc-comm-COMPLETE { border-left-color: #2D6A4F44; }
    .hc-comm-FAIL     { border-left-color: #DC262644; }
    .hc-comm-RETRY    { border-left-color: #E07A3044; }
    .hc-comm-OUTPUT   { border-left-color: #1B6B9344; }

    /* ── Failure Banner ── */
    .hc-failure-banner {
      position: absolute;
      top: 8px;
      left: 12px;
      right: 12px;
      z-index: 90;
      background: rgba(220, 38, 38, 0.12);
      border: 1px solid rgba(220, 38, 38, 0.4);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: hc-banner-in 0.3s ease-out;
    }
    @keyframes hc-banner-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .hc-failure-banner-icon { font-size: 16px; flex-shrink: 0; }
    .hc-failure-banner-text { flex: 1; min-width: 0; }
    .hc-failure-banner-title {
      font-size: 13px;
      font-weight: 700;
      color: #ff6b6b;
    }
    .hc-failure-banner-detail {
      font-size: 11px;
      color: #cc8888;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .hc-failure-banner .hc-btn { flex-shrink: 0; }

    /* ── Retry Button (topbar) ── */
    .hc-btn-retry {
      background: #3a1a1a;
      border-color: #C74634;
      color: #ff6b6b;
      font-weight: 600;
    }
    .hc-btn-retry:hover { background: #4a2020; border-color: #D95A4A; color: #ff8888; }

    /* ── Node Detail Overlay ── */
    .hc-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .hc-overlay-panel {
      background: #1a1a1a;
      border: 1px solid #3a3a3a;
      border-radius: 10px;
      padding: 20px 24px;
      min-width: 320px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      position: relative;
    }
    .hc-overlay-close {
      position: absolute;
      top: 12px; right: 14px;
      background: none; border: none;
      color: #666; font-size: 18px;
      cursor: pointer; line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .hc-overlay-close:hover { color: #F0F0F0; background: #333; }
    .hc-overlay-title { font-size: 15px; font-weight: 700; margin: 0 0 4px; color: #F0F0F0; }
    .hc-overlay-type  { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; }
    .hc-overlay-status {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    .hc-overlay-section { margin-top: 12px; }
    .hc-overlay-section-label { font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
    .hc-overlay-output {
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      padding: 10px 12px;
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      font-size: 12px;
      color: #A0A0A0;
      max-height: 160px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .hc-overlay-error {
      background: #1a0a0a;
      border: 1px solid #3a1a1a;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 12px;
      color: #ff6b6b;
      max-height: 100px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .hc-overlay-actions { display: flex; gap: 8px; margin-top: 16px; }
  `;

  function injectStyles() {
    if (document.getElementById('hc-styles')) return;
    const el = document.createElement('style');
    el.id = 'hc-styles';
    el.textContent = STYLES;
    document.head.appendChild(el);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function fmtTime(date) {
    return date.toTimeString().slice(0, 8);
  }

  function elapsed(startMs) {
    const s = Math.floor((Date.now() - startMs) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}m${sec.toString().padStart(2, '0')}s`;
  }

  function unitColor(label, agentType) {
    // Try to get color from faction data if available
    if (window.FactionData && agentType) {
      const unit = window.FactionData.getUnitForCurrentFaction(agentType);
      if (unit) return unit.color;
    }
    // Fallback: hash-based color
    let h = 0;
    for (let i = 0; i < (label || '').length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
    return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
  }

  function buildWsUrl(path) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}${path}`;
  }

  // ─── Layout helpers ──────────────────────────────────────────────────────────

  /**
   * Simple layered layout: topological sort → assign columns, then rows within columns.
   * Returns Map<nodeId, {x, y}> with canvas coords centered in NODE_W x NODE_H boxes.
   */
  function computeLayout(nodes, edges) {
    const ids = Array.from(nodes.keys());
    if (!ids.length) return new Map();

    // Build adjacency
    const childOf = new Map(); // parent → [children]
    const parentOf = new Map(); // child → [parents]
    ids.forEach(id => { childOf.set(id, []); parentOf.set(id, []); });
    edges.forEach(({ from, to }) => {
      if (childOf.has(from) && parentOf.has(to)) {
        childOf.get(from).push(to);
        parentOf.get(to).push(from);
      }
    });

    // Kahn's topological sort → assign levels
    const level = new Map();
    const inDeg = new Map(ids.map(id => [id, parentOf.get(id).length]));
    const queue = ids.filter(id => inDeg.get(id) === 0);
    queue.forEach(id => level.set(id, 0));
    let q = [...queue];
    while (q.length) {
      const next = [];
      q.forEach(id => {
        childOf.get(id).forEach(ch => {
          level.set(ch, Math.max(level.get(ch) || 0, (level.get(id) || 0) + 1));
          inDeg.set(ch, inDeg.get(ch) - 1);
          if (inDeg.get(ch) === 0) next.push(ch);
        });
      });
      q = next;
    }
    // Assign any unvisited (cycles)
    ids.forEach(id => { if (!level.has(id)) level.set(id, 0); });

    // Group by level
    const byLevel = new Map();
    ids.forEach(id => {
      const lv = level.get(id);
      if (!byLevel.has(lv)) byLevel.set(lv, []);
      byLevel.get(lv).push(id);
    });

    const HGAP = 180;
    const VGAP = 100;
    const positions = new Map();

    byLevel.forEach((group, lv) => {
      const x = CANVAS_PAD + lv * HGAP;
      const totalH = group.length * NODE_H + (group.length - 1) * (VGAP - NODE_H);
      const startY = CANVAS_PAD;
      group.forEach((id, i) => {
        const y = startY + i * VGAP;
        positions.set(id, { x, y });
      });
    });

    return positions;
  }

  // ─── Main Class ──────────────────────────────────────────────────────────────

  class HolonetCommand {
    constructor(containerId) {
      this.container = document.getElementById(containerId) || document.querySelector(containerId);
      if (!this.container) throw new Error(`HolonetCommand: container "${containerId}" not found`);

      injectStyles();

      this.nodes = new Map();          // nodeId → { id, label, type, status, startMs, output, error }
      this.edges = [];                  // [{ from, to }]
      this.positions = new Map();       // nodeId → { x, y }
      this.currentRunId = null;
      this.currentMissionId = null;
      this.ws = null;
      this.canvas = null;
      this.ctx = null;
      this.animationId = null;
      this.commsEntries = [];
      this.stars = [];
      this.scanlineY = 0;
      this.frame = 0;
      this.dashOffset = 0;
      this.lastFrameTime = 0;
      this.selectedNodeId = null;
      this.overlayEl = null;
      this.statusBadgeEl = null;
      this.execBtn = null;
      this.abortBtn = null;
      this.runSelect = null;
      this._wsReconnectTimer = null;
      this._destroyed = false;

      this._build();
      this._initStars();
      this._startLoop();
      this._connectWs();
      this._loadSelectors();
      this._parseUrlParams();
    }

    // ── Build DOM ──────────────────────────────────────────────────────────────

    _build() {
      this.container.innerHTML = '';

      const root = document.createElement('div');
      root.className = 'hc-root';

      // Top bar
      const topbar = document.createElement('div');
      topbar.className = 'hc-topbar';
      topbar.innerHTML = `
        <span class="hc-topbar-title">⬡ Holonet</span>
        <select class="hc-run-select"></select>
        <button class="hc-btn hc-btn-primary" id="hc-exec-btn">▶ Execute</button>
        <button class="hc-btn hc-btn-danger"   id="hc-abort-btn">⬛ Abort</button>
        <button class="hc-btn hc-btn-retry"    id="hc-retry-btn" style="display:none">↻ Retry Failed</button>
        <span class="hc-status-badge" id="hc-status-badge">STANDBY</span>
      `;
      root.appendChild(topbar);

      // Main
      const main = document.createElement('div');
      main.className = 'hc-main';

      // Canvas wrap
      const canvasWrap = document.createElement('div');
      canvasWrap.className = 'hc-canvas-wrap';
      canvasWrap.style.cssText = 'flex: 0 0 65%; position: relative; overflow: hidden;';

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'hc-canvas';
      canvasWrap.appendChild(this.canvas);

      this.hintEl = document.createElement('div');
      this.hintEl.className = 'hc-canvas-hint';
      this.hintEl.innerHTML = `
        <div class="hc-canvas-hint-icon">🛸</div>
        <div class="hc-canvas-hint-text">Select a mission or run to begin</div>
      `;
      canvasWrap.appendChild(this.hintEl);
      main.appendChild(canvasWrap);

      // Comms panel
      const comms = document.createElement('div');
      comms.className = 'hc-comms';
      comms.innerHTML = `
        <div class="hc-comms-header">
          <div class="hc-comms-dot"></div>
          <span class="hc-comms-title">Mission Comms</span>
          <button class="hc-comms-clear" id="hc-clear-comms">Clear</button>
        </div>
        <div class="hc-comms-log" id="hc-comms-log"></div>
      `;
      main.appendChild(comms);

      root.appendChild(main);
      this.container.appendChild(root);

      this.ctx = this.canvas.getContext('2d');
      this.runSelect = topbar.querySelector('.hc-run-select');
      this.execBtn = topbar.querySelector('#hc-exec-btn');
      this.abortBtn = topbar.querySelector('#hc-abort-btn');
      this.retryBtn = topbar.querySelector('#hc-retry-btn');
      this.statusBadgeEl = topbar.querySelector('#hc-status-badge');
      this.commsLog = root.querySelector('#hc-comms-log');
      this.canvasWrap = canvasWrap;
      this.failureBannerEl = null;

      // Events
      this.runSelect.addEventListener('change', () => this._onRunSelectChange());
      this.execBtn.addEventListener('click', () => this._onExecute());
      this.abortBtn.addEventListener('click', () => this._onAbort());
      this.retryBtn.addEventListener('click', () => this._onRetryFailed());
      root.querySelector('#hc-clear-comms').addEventListener('click', () => this._clearComms());
      this.canvas.addEventListener('click', (e) => this._onCanvasClick(e));

      this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
      this._resizeObserver.observe(canvasWrap);
      this._resizeCanvas();
    }

    _resizeCanvas() {
      const wrap = this.canvasWrap;
      this.canvas.width  = wrap.clientWidth  || wrap.offsetWidth  || 800;
      this.canvas.height = wrap.clientHeight || wrap.offsetHeight || 400;
    }

    // ── Stars ─────────────────────────────────────────────────────────────────

    _initStars() {
      this.stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.2 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.03 + 0.005,
      }));
    }

    // ── Animation Loop ────────────────────────────────────────────────────────

    _startLoop() {
      const MS_PER_FRAME = 1000 / TARGET_FPS;
      const loop = (ts) => {
        if (this._destroyed) return;
        this.animationId = requestAnimationFrame(loop);
        if (ts - this.lastFrameTime < MS_PER_FRAME) return;
        this.lastFrameTime = ts;
        this._tick();
        this._draw();
      };
      this.animationId = requestAnimationFrame(loop);
    }

    _tick() {
      this.frame++;
      this.dashOffset = (this.dashOffset + 1) % 24;
      this.scanlineY = (this.scanlineY + 0.3) % (this.canvas.height || 400);
      this.stars.forEach(s => {
        s.twinkle += s.speed;
      });
    }

    // ── Drawing ───────────────────────────────────────────────────────────────

    _draw() {
      const { canvas, ctx } = this;
      const W = canvas.width, H = canvas.height;
      if (!W || !H) return;

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, W, H);

      this._drawStars(W, H);
      this._drawScanline(W, H);

      if (this.nodes.size > 0) {
        this.hintEl.style.display = 'none';
        this._drawEdges(W, H);
        this._drawNodes(W, H);
      } else {
        this.hintEl.style.display = '';
      }
    }

    _drawStars(W, H) {
      const { ctx } = this;
      this.stars.forEach(s => {
        const alpha = 0.3 + 0.3 * Math.sin(s.twinkle);
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.fill();
      });
    }

    _drawScanline(W, H) {
      const { ctx } = this;
      const grad = ctx.createLinearGradient(0, this.scanlineY - 30, 0, this.scanlineY + 30);
      grad.addColorStop(0,   'rgba(100,180,255,0)');
      grad.addColorStop(0.5, 'rgba(100,180,255,0.018)');
      grad.addColorStop(1,   'rgba(100,180,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.max(0, this.scanlineY - 30), W, 60);
    }

    _getScaledPositions(W, H) {
      if (!this.positions.size) return new Map();

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.positions.forEach(({ x, y }) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + NODE_W);
        maxY = Math.max(maxY, y + NODE_H);
      });

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const availW = W - CANVAS_PAD * 2;
      const availH = H - CANVAS_PAD * 2;
      const scale = Math.min(1, Math.min(availW / (contentW || 1), availH / (contentH || 1)));
      const offX = CANVAS_PAD + (availW - contentW * scale) / 2 - minX * scale;
      const offY = CANVAS_PAD + (availH - contentH * scale) / 2 - minY * scale;

      const scaled = new Map();
      this.positions.forEach((pos, id) => {
        scaled.set(id, {
          x: offX + pos.x * scale,
          y: offY + pos.y * scale,
          w: NODE_W * scale,
          h: NODE_H * scale,
          scale,
        });
      });
      return scaled;
    }

    _drawEdges(W, H) {
      const { ctx } = this;
      const scaled = this._getScaledPositions(W, H);

      this.edges.forEach(({ from, to }) => {
        const fp = scaled.get(from);
        const tp = scaled.get(to);
        if (!fp || !tp) return;

        const fromNode = this.nodes.get(from);
        const toNode   = this.nodes.get(to);
        const fs = fromNode ? fromNode.status : 'pending';
        const ts = toNode   ? toNode.status   : 'pending';

        // Start/end points
        const x1 = fp.x + fp.w;
        const y1 = fp.y + fp.h / 2;
        const x2 = tp.x;
        const y2 = tp.y + tp.h / 2;
        const cpx = (x1 + x2) / 2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(cpx, y1, cpx, y2, x2, y2);

        if (fs === 'failed') {
          ctx.strokeStyle = '#ff4444';
          ctx.setLineDash([]);
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ff4444';
        } else if (fs === 'completed' && (ts === 'running' || ts === 'scheduled')) {
          // Animated dash — active data flow
          ctx.strokeStyle = '#6bb8ff';
          ctx.setLineDash([8, 6]);
          ctx.lineDashOffset = -this.dashOffset;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#6bb8ff';
        } else if (fs === 'completed') {
          ctx.strokeStyle = '#40916C';
          ctx.setLineDash([]);
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#40916C';
        } else {
          ctx.strokeStyle = '#555555';
          ctx.setLineDash([4, 5]);
          ctx.lineDashOffset = 0;
          ctx.lineWidth = 1;
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      });
    }

    _drawNodes(W, H) {
      const { ctx } = this;
      const scaled = this._getScaledPositions(W, H);
      const t = this.frame;

      this.nodes.forEach((node, id) => {
        const pos = scaled.get(id);
        if (!pos) return;
        const { x, y, w, h } = pos;
        const c = STATUS_COLORS[node.status] || STATUS_COLORS.pending;

        // Glow for running
        if (node.status === 'running') {
          const glow = 10 + 15 * (0.5 + 0.5 * Math.sin(t * 0.15));
          ctx.shadowBlur = glow;
          ctx.shadowColor = '#4fa4ff';
        } else if (node.status === 'completed') {
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#40916C';
        } else if (node.status === 'failed') {
          const failPulse = 6 + 4 * Math.sin(t * 0.22);
          ctx.shadowBlur = failPulse;
          ctx.shadowColor = '#DC2626';
        } else if (node.status === 'retrying') {
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#E07A30';
        } else {
          ctx.shadowBlur = 0;
        }

        // Rounded rect fill
        const r = Math.max(4, 8 * pos.scale);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fillStyle = c.fill;
        ctx.fill();

        // Selected highlight
        if (id === this.selectedNodeId) {
          ctx.strokeStyle = '#C74634';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = c.border;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.shadowBlur = 0;

        const fontSize = Math.max(8, Math.min(12, 12 * pos.scale));
        const smallFont = Math.max(7, Math.min(10, 10 * pos.scale));

        // Droid icon circle
        const iconR = Math.max(5, 8 * pos.scale);
        const dc = unitColor(node.label, node.type);
        ctx.beginPath();
        ctx.arc(x + iconR + 6 * pos.scale, y + iconR + 6 * pos.scale, iconR, 0, Math.PI * 2);
        ctx.fillStyle = dc;
        ctx.fill();
        ctx.font = `bold ${Math.max(6, 9 * pos.scale)}px -apple-system, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((node.label || '?')[0].toUpperCase(), x + iconR + 6 * pos.scale, y + iconR + 6 * pos.scale);

        // Node label
        ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labelX = x + w / 2;
        const labelY = y + h / 2 - smallFont * 0.7;

        // Truncate label
        let label = node.label || id;
        const maxW = w - 20 * pos.scale;
        while (ctx.measureText(label).width > maxW && label.length > 4) {
          label = label.slice(0, -2) + '…';
        }
        ctx.fillText(label, labelX, labelY);

        // Status text
        ctx.font = `${smallFont}px -apple-system, sans-serif`;
        ctx.fillStyle = c.text;
        ctx.fillText(node.status.toUpperCase(), labelX, labelY + fontSize + 4 * pos.scale);

        // Timer for running nodes
        if (node.status === 'running' && node.startMs) {
          ctx.font = `${smallFont}px 'SF Mono', Consolas, monospace`;
          ctx.fillStyle = '#4fa4ff';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(elapsed(node.startMs), x + w - 6 * pos.scale, y + h - 5 * pos.scale);
        }
      });

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // ── Status Badge ──────────────────────────────────────────────────────────

    _setStatus(status) {
      const el = this.statusBadgeEl;
      if (!el) return;
      el.textContent = status;
      el.style.background = BADGE_STATUS[status] || '#3a3a3a';
      el.style.color = status === 'STANDBY' ? '#888' : '#fff';
      if (status === 'EXECUTING') {
        el.classList.add('pulsing');
      } else {
        el.classList.remove('pulsing');
      }

      // Show/hide retry button and failure banner
      if (status === 'FAILED') {
        if (this.retryBtn) this.retryBtn.style.display = '';
        this._showFailureBanner();
      } else {
        if (this.retryBtn) this.retryBtn.style.display = 'none';
        this._hideFailureBanner();
      }
    }

    // ── Comms Panel ───────────────────────────────────────────────────────────

    _addComm(type, node, msg) {
      const entry = {
        type: type.toUpperCase(),
        node: node || 'SYSTEM',
        msg,
        time: new Date(),
      };
      this.commsEntries.push(entry);
      if (this.commsEntries.length > MAX_COMMS) {
        this.commsEntries.shift();
        const first = this.commsLog.firstChild;
        if (first) this.commsLog.removeChild(first);
      }
      this._appendCommEntry(entry);
    }

    _appendCommEntry(entry) {
      const color = BADGE_COLORS[entry.type] || '#666';
      const div = document.createElement('div');
      div.className = `hc-comm-entry hc-comm-${entry.type}`;
      div.innerHTML = `
        <span class="hc-comm-time">${fmtTime(entry.time)}</span>
        <span class="hc-comm-node">${this._esc(entry.node)}</span>
        <span class="hc-comm-badge" style="background:${color}">${entry.type}</span>
        <span class="hc-comm-msg">${this._esc(entry.msg)}</span>
      `;
      this.commsLog.appendChild(div);
      this.commsLog.scrollTop = this.commsLog.scrollHeight;
    }

    _clearComms() {
      this.commsEntries = [];
      this.commsLog.innerHTML = '';
    }

    _esc(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // ── DAG Rendering ─────────────────────────────────────────────────────────

    _renderMission(missionDef, runData) {
      this.nodes.clear();
      this.edges = [];

      const tasks = missionDef.tasks || missionDef.nodes || [];
      const deps  = missionDef.dependencies || missionDef.edges || [];

      // Normalise run statuses
      const statusMap = new Map();
      if (runData && (runData.nodeStates || runData.nodeStatuses)) {
        Object.entries(runData.nodeStates || runData.nodeStatuses).forEach(([k, v]) => statusMap.set(k, v));
      }
      if (runData && runData.tasks) {
        runData.tasks.forEach(t => statusMap.set(t.id || t.taskId, t.status));
      }

      tasks.forEach(task => {
        const id = task.id || task.taskId || task.name;
        const statusEntry = statusMap.get(id) || {};
        const status = (typeof statusEntry === 'string' ? statusEntry : statusEntry.status) || 'pending';
        const startMs = statusEntry.startedAt ? new Date(statusEntry.startedAt).getTime() : null;

        this.nodes.set(id, {
          id,
          label: task.label || task.name || id,
          type: task.type || task.agentType || 'task',
          status,
          startMs,
          output: statusEntry.output || null,
          error: statusEntry.error || null,
          files: statusEntry.files || [],
        });
      });

      // Edges
      deps.forEach(dep => {
        const from = dep.from || dep.source || dep.dependsOn;
        const to   = dep.to   || dep.target || dep.task;
        if (from && to) this.edges.push({ from, to });
      });

      // Fallback: task.dependsOn arrays
      tasks.forEach(task => {
        const id = task.id || task.taskId || task.name;
        const deps2 = task.dependsOn || task.dependencies || [];
        deps2.forEach(dep => this.edges.push({ from: dep, to: id }));
      });

      this.positions = computeLayout(this.nodes, this.edges);
    }

    _updateNodeStatus(nodeId, status, extras) {
      if (!this.nodes.has(nodeId)) {
        this.nodes.set(nodeId, { id: nodeId, label: nodeId, type: 'task', status: 'pending', startMs: null, output: null, error: null });
      }
      const node = this.nodes.get(nodeId);
      node.status = status;
      if (extras) Object.assign(node, extras);
      if (status === 'running' && !node.startMs) node.startMs = Date.now();
      if (status !== 'running') node.startMs = null;
      if (!this.positions.size) this.positions = computeLayout(this.nodes, this.edges);
    }

    // ── Run Selector ──────────────────────────────────────────────────────────

    async _loadSelectors() {
      try {
        const [runs, missions] = await Promise.all([
          fetch('/api/missions/runs').then(r => r.ok ? r.json() : []).catch(() => []),
          fetch('/api/missions').then(r => r.ok ? r.json() : []).catch(() => []),
        ]);

        this.runSelect.innerHTML = '<option value="">— Select run or mission —</option>';

        const runsArr = Array.isArray(runs) ? runs : (runs.runs || runs.data || []);
        const missionMap = new Map();
        const mArr = Array.isArray(missions) ? missions : (missions.missions || missions.data || []);
        mArr.forEach(m => missionMap.set(m.id || m.missionId, m.name || m.id));

        if (runsArr.length) {
          const grp = document.createElement('optgroup');
          grp.label = 'Recent Runs';
          runsArr.slice(0, 20).forEach(run => {
            const opt = document.createElement('option');
            opt.value = `run:${run.id || run.runId}`;
            const missionName = run.missionName || missionMap.get(run.missionId) || run.name || run.id;
            const ts = run.startedAt || run.createdAt;
            let datePart = '';
            if (ts) {
              const d = new Date(ts);
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              const hh = String(d.getHours()).padStart(2, '0');
              const min = String(d.getMinutes()).padStart(2, '0');
              datePart = `_${mm}-${dd}_${hh}:${min}`;
            }
            opt.textContent = `▶ ${missionName}${datePart} (${run.status || 'unknown'})`;
            grp.appendChild(opt);
          });
          this.runSelect.appendChild(grp);
        }

        if (mArr.length) {
          const grp = document.createElement('optgroup');
          grp.label = 'Available Missions';
          mArr.forEach(m => {
            const opt = document.createElement('option');
            opt.value = `mission:${m.id || m.missionId}`;
            opt.textContent = `⬡ ${m.name || m.id}`;
            grp.appendChild(opt);
          });
          this.runSelect.appendChild(grp);
        }
      } catch (_) { /* best effort */ }
    }

    _onRunSelectChange() {
      const val = this.runSelect.value;
      if (!val) return;
      if (val.startsWith('run:')) {
        this.loadRun(val.slice(4));
      } else if (val.startsWith('mission:')) {
        this.loadMission(val.slice(8));
      }
    }

    async loadRun(runId) {
      this.currentRunId = runId;
      try {
        const runRaw = await fetch(`/api/missions/runs/${runId}`).then(r => r.json());
        const runData = runRaw.data || runRaw;

        const missionRaw = await fetch(`/api/missions/${runData.missionId}`).then(r => r.json());
        const missionDef = missionRaw.data || missionRaw;

        this.currentMissionId = runData.missionId;
        this._renderMission(missionDef, runData);
        this._setStatus(runData.status === 'running' ? 'EXECUTING' : (runData.status || 'STANDBY').toUpperCase());
        this._addComm('INFO', 'SYSTEM', `Loaded run ${runId}`);

        // Reconstruct comms history from node states
        const nodeStates = runData.nodeStates || {};
        for (const [nodeId, state] of Object.entries(nodeStates)) {
          const label = this._nodeLabel(nodeId);
          const st = typeof state === 'string' ? state : (state.status || 'pending');
          if (st === 'scheduled') {
            this._addComm('INFO', label, 'Scheduled');
          } else if (st === 'running') {
            this._addComm('DISPATCH', label, `Execution started${state.startedAt ? ' at ' + new Date(state.startedAt).toLocaleTimeString() : ''}`);
          } else if (st === 'completed') {
            this._addComm('DISPATCH', label, 'Execution started');
            this._addComm('COMPLETE', label, state.output ? `Output: ${String(state.output).slice(0, 80)}` : 'Completed');
          } else if (st === 'failed') {
            this._addComm('DISPATCH', label, 'Execution started');
            this._addComm('FAIL', label, state.error || 'Node failed');
          } else if (st === 'retrying') {
            this._addComm('RETRY', label, `Retry attempt ${state.retryCount || ''}`);
          }
        }

        // Fetch and display stored run messages
        try {
          const msgsRaw = await fetch(`/api/missions/runs/${runId}/messages`).then(r => r.json());
          const msgs = msgsRaw.data || msgsRaw;
          if (Array.isArray(msgs)) {
            for (const m of msgs) {
              const msgLabel = m.nodeId ? this._nodeLabel(m.nodeId) : (m.from || 'SYSTEM');
              this._addComm('OUTPUT', msgLabel, String(m.content || m.message || '').slice(0, 120));
            }
          }
        } catch (_) { /* best effort */ }
      } catch (e) {
        this._addComm('INFO', 'SYSTEM', `Failed to load run ${runId}: ${e.message}`);
      }
    }

    async loadMission(missionId) {
      this.currentMissionId = missionId;
      this.currentRunId = null;
      try {
        const raw = await fetch(`/api/missions/${missionId}`).then(r => r.json());
        const missionDef = raw.data || raw;
        this._renderMission(missionDef, null);
        this._setStatus('STANDBY');
        this._addComm('INFO', 'SYSTEM', `Loaded mission ${missionId}`);
      } catch (e) {
        this._addComm('INFO', 'SYSTEM', `Failed to load mission ${missionId}: ${e.message}`);
      }
    }

    // ── Execute / Abort ───────────────────────────────────────────────────────

    async _onExecute() {
      if (!this.currentMissionId) {
        this._addComm('INFO', 'SYSTEM', 'No mission selected');
        return;
      }
      try {
        this.execBtn.disabled = true;
        const res = await fetch(`/api/missions/${this.currentMissionId}/run`, { method: 'POST' });
        const json = await res.json();
        const run = json.data || json;
        this.currentRunId = run.id || run.runId;
        this._addComm('DISPATCH', 'SYSTEM', `Run ${this.currentRunId} started`);
        await this.loadRun(this.currentRunId);
      } catch (e) {
        this._addComm('FAIL', 'SYSTEM', `Execute failed: ${e.message}`);
      } finally {
        this.execBtn.disabled = false;
      }
    }

    _onAbort() {
      if (!this.currentRunId || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify({ type: 'abort_run', runId: this.currentRunId }));
      this._setStatus('ABORTED');
      this._addComm('INFO', 'SYSTEM', `Abort requested for run ${this.currentRunId}`);
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    _connectWs() {
      if (this._destroyed) return;
      try {
        this.ws = new WebSocket(buildWsUrl('/ws/missions'));
        this.ws.onopen    = () => this._onWsOpen();
        this.ws.onmessage = (e) => this._onWsMessage(e);
        this.ws.onclose   = () => this._onWsClose();
        this.ws.onerror   = () => {};
      } catch (_) {
        this._scheduleWsReconnect();
      }
    }

    _onWsOpen() {
      clearTimeout(this._wsReconnectTimer);
      // After reconnect, re-fetch current run state in case events were missed
      if (this.currentRunId) {
        this._pollRunState(this.currentRunId);
      }
    }

    _onWsClose() {
      if (!this._destroyed) this._scheduleWsReconnect();
    }

    _scheduleWsReconnect() {
      clearTimeout(this._wsReconnectTimer);
      this._wsReconnectTimer = setTimeout(() => this._connectWs(), RECONNECT_DELAY);
    }

    /** Re-fetch run state from REST API to catch events missed during WS disconnect. */
    _pollRunState(runId) {
      fetch(`/api/missions/runs`)
        .then(r => r.json())
        .then(data => {
          const runs = data.data || data;
          const run = runs.find(r => r.id === runId);
          if (!run) return;
          // Sync node states
          for (const [nid, ns] of Object.entries(run.nodeStates || {})) {
            if (ns.status && ns.status !== 'pending') {
              this._updateNodeStatus(nid, ns.status, {
                output: ns.output || null,
                error: ns.error || null,
                files: ns.files || [],
              });
            }
          }
          // Sync run-level status
          if (run.status === 'completed') {
            this._setStatus('COMPLETED');
            this._addComm('COMPLETE', 'SYSTEM', 'Run completed (synced after reconnect)');
          } else if (run.status === 'failed') {
            this._setStatus('FAILED');
            this._addComm('FAIL', 'SYSTEM', `Run failed: ${run.error || 'node failure'}`);
          } else if (run.status === 'aborted') {
            this._setStatus('ABORTED');
            this._addComm('INFO', 'SYSTEM', 'Run aborted');
          }
        })
        .catch(() => {});
    }

    _onWsMessage(event) {
      let msg;
      try { msg = JSON.parse(event.data); } catch (_) { return; }

      const { type, runId, nodeId, missionId } = msg;

      switch (type) {
        case 'run_started':
          this.currentRunId = runId || msg.runId;
          this.currentMissionId = missionId || msg.missionId;
          if (this.currentMissionId) {
            fetch(`/api/missions/${this.currentMissionId}`)
              .then(r => r.json())
              .then(raw => {
                const def = raw.data || raw;
                this._renderMission(def, null);
                this._setStatus('EXECUTING');
                this._addComm('DISPATCH', 'SYSTEM', `Run started: ${this.currentRunId}`);
              })
              .catch(() => {});
          } else {
            this._setStatus('EXECUTING');
          }
          break;

        case 'node_scheduled':
          this._updateNodeStatus(nodeId, 'scheduled');
          this._addComm('INFO', this._nodeLabel(nodeId), 'Scheduled');
          break;

        case 'node_started':
          this._updateNodeStatus(nodeId, 'running', { startMs: Date.now() });
          this._addComm('DISPATCH', this._nodeLabel(nodeId), 'Execution started');
          break;

        case 'node_completed': {
          const files = msg.files || [];
          this._updateNodeStatus(nodeId, 'completed', { output: msg.output || null, files });
          let completeMsg = msg.output ? `Output: ${String(msg.output).slice(0, 80)}` : 'Completed';
          if (files.length) completeMsg += ` (${files.length} file${files.length > 1 ? 's' : ''} created)`;
          this._addComm('COMPLETE', this._nodeLabel(nodeId), completeMsg);
          this._checkRunComplete();
          break;
        }

        case 'node_failed':
          this._updateNodeStatus(nodeId, 'failed', { error: msg.error || 'Unknown error' });
          this._addComm('FAIL', this._nodeLabel(nodeId), msg.error || 'Node failed');
          break;

        case 'node_retrying':
          this._updateNodeStatus(nodeId, 'retrying');
          this._addComm('RETRY', this._nodeLabel(nodeId), `Retry attempt ${msg.retryCount || msg.attempt || ''}`);
          break;

        case 'run_completed':
          this._setStatus('COMPLETED');
          this._addComm('COMPLETE', 'SYSTEM', `Run ${runId || this.currentRunId} completed`);
          this.nodes.forEach(n => { if (n.status === 'running') n.status = 'completed'; });
          // Fetch and display run summary
          this._fetchAndDisplaySummary(runId || this.currentRunId);
          break;

        case 'run_failed':
          this._setStatus('FAILED');
          this._addComm('FAIL', 'SYSTEM', `Run failed: ${msg.error || ''}`);
          break;

        case 'run_aborted':
          this._setStatus('ABORTED');
          this._addComm('INFO', 'SYSTEM', 'Run aborted');
          break;

        case 'message_logged':
          this._addComm(msg.level || 'INFO', msg.nodeId ? this._nodeLabel(msg.nodeId) : (msg.node || 'SYSTEM'), msg.message || msg.msg || '');
          break;

        case 'message_relayed': {
          const m = msg.message || {};
          const fromLabel = m.from ? this._nodeLabel(m.from) : 'AGENT';
          const toLabel = m.to ? this._nodeLabel(m.to) : 'ALL';
          const content = String(m.content || '').slice(0, 120);
          this._addComm('OUTPUT', fromLabel, `→ ${toLabel}: ${content}`);
          break;
        }

        case 'init':
          if (!this.currentRunId && msg.activeRuns && msg.activeRuns.length) {
            this.loadRun(msg.activeRuns[0]);
          }
          break;

        default:
          break;
      }
    }

    async _fetchAndDisplaySummary(rId) {
      try {
        const raw = await fetch(`/api/missions/runs/${rId}/summary`).then(r => r.json());
        const summary = raw.data;
        if (!summary) return;

        this._addComm('INFO', 'SUMMARY', `${summary.totalFiles} file${summary.totalFiles !== 1 ? 's' : ''} produced`);
        if (summary.workdir) {
          this._addComm('INFO', 'SUMMARY', `Workdir: ${summary.workdir}`);
        }
        if (summary.setupHints && summary.setupHints.length) {
          this._addComm('INFO', 'SUMMARY', `Setup: ${summary.setupHints.join(' && ')}`);
        }
        // Show first 10 files
        const filesToShow = (summary.files || []).slice(0, 10);
        if (filesToShow.length) {
          this._addComm('OUTPUT', 'FILES', filesToShow.join(', ') + (summary.totalFiles > 10 ? ` (+${summary.totalFiles - 10} more)` : ''));
        }
      } catch (_) { /* best effort */ }
    }

    _nodeLabel(nodeId) {
      const node = this.nodes.get(nodeId);
      return node ? node.label : nodeId;
    }

    _checkRunComplete() {
      const allDone = Array.from(this.nodes.values()).every(n =>
        n.status === 'completed' || n.status === 'failed'
      );
      const anyFailed = Array.from(this.nodes.values()).some(n => n.status === 'failed');
      if (allDone) this._setStatus(anyFailed ? 'FAILED' : 'COMPLETED');
    }

    // ── URL Params ────────────────────────────────────────────────────────────

    _parseUrlParams() {
      const hash = location.hash || '';
      const qIdx = hash.indexOf('?');
      if (qIdx === -1) return;
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      const run     = params.get('run');
      const mission = params.get('mission');
      if (run)     this.loadRun(run);
      else if (mission) this.loadMission(mission);
    }

    // ── Canvas Click / Node Overlay ───────────────────────────────────────────

    _onCanvasClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const my = (e.clientY - rect.top)  * (this.canvas.height / rect.height);

      const scaled = this._getScaledPositions(this.canvas.width, this.canvas.height);
      let hit = null;
      scaled.forEach((pos, id) => {
        if (mx >= pos.x && mx <= pos.x + pos.w && my >= pos.y && my <= pos.y + pos.h) hit = id;
      });

      if (hit) {
        this.selectedNodeId = hit;
        this._showNodeOverlay(hit);
      } else {
        this.selectedNodeId = null;
        this._hideOverlay();
      }
    }

    _showNodeOverlay(nodeId) {
      this._hideOverlay();
      const node = this.nodes.get(nodeId);
      if (!node) return;

      const c = STATUS_COLORS[node.status] || STATUS_COLORS.pending;

      const overlay = document.createElement('div');
      overlay.className = 'hc-overlay';

      const panel = document.createElement('div');
      panel.className = 'hc-overlay-panel';

      let html = `
        <button class="hc-overlay-close" id="hc-ov-close">✕</button>
        <div class="hc-overlay-title">${this._esc(node.label)}</div>
        <div class="hc-overlay-type">${this._esc(node.type)}</div>
        <span class="hc-overlay-status" style="background:${c.fill};border:1px solid ${c.border};color:${c.text}">
          ${node.status.toUpperCase()}
        </span>
      `;

      if (node.output) {
        html += `
          <div class="hc-overlay-section">
            <div class="hc-overlay-section-label">Output</div>
            <div class="hc-overlay-output">${this._esc(node.output)}</div>
          </div>`;
      }

      if (node.error) {
        html += `
          <div class="hc-overlay-section">
            <div class="hc-overlay-section-label">Error</div>
            <div class="hc-overlay-error">${this._esc(node.error)}</div>
          </div>`;
      }

      if (node.files && node.files.length) {
        html += `
          <div class="hc-overlay-section">
            <div class="hc-overlay-section-label">Files Created (${node.files.length})</div>
            <div class="hc-overlay-output" style="max-height:120px;">${node.files.map(f => this._esc(f)).join('\n')}</div>
          </div>`;
      }

      html += `<div class="hc-overlay-actions">`;
      if (node.status === 'failed' && this.currentRunId) {
        html += `<button class="hc-btn hc-btn-primary" id="hc-ov-retry">↻ Retry Node</button>`;
      }
      html += `<button class="hc-btn" id="hc-ov-cancel">Close</button></div>`;

      panel.innerHTML = html;
      overlay.appendChild(panel);
      this.canvasWrap.appendChild(overlay);
      this.overlayEl = overlay;

      const close = () => { this._hideOverlay(); this.selectedNodeId = null; };
      overlay.querySelector('#hc-ov-close').addEventListener('click', close);
      overlay.querySelector('#hc-ov-cancel').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

      const retryBtn = overlay.querySelector('#hc-ov-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this._retryNode(nodeId));
      }
    }

    _hideOverlay() {
      if (this.overlayEl) {
        this.overlayEl.remove();
        this.overlayEl = null;
      }
    }

    async _retryNode(nodeId) {
      if (!this.currentRunId) return;
      try {
        await fetch(`/api/missions/runs/${this.currentRunId}/retry/${nodeId}`, { method: 'POST' });
        this._updateNodeStatus(nodeId, 'retrying');
        this._addComm('RETRY', this._nodeLabel(nodeId), 'Manual retry requested');
        this._hideOverlay();
      } catch (e) {
        this._addComm('FAIL', 'SYSTEM', `Retry failed: ${e.message}`);
      }
    }

    // ── Failure Banner & Retry ────────────────────────────────────────────────

    _showFailureBanner() {
      this._hideFailureBanner();
      if (!this.currentRunId) return;

      // Find first failed node
      let failedLabel = 'Unknown node';
      let failedError = '';
      for (const [, node] of this.nodes) {
        if (node.status === 'failed') {
          failedLabel = node.label || node.id;
          failedError = node.error || '';
          break;
        }
      }

      const banner = document.createElement('div');
      banner.className = 'hc-failure-banner';
      banner.innerHTML = `
        <span class="hc-failure-banner-icon">⚠</span>
        <div class="hc-failure-banner-text">
          <div class="hc-failure-banner-title">Mission Failed — "${this._esc(failedLabel)}" failed</div>
          ${failedError ? `<div class="hc-failure-banner-detail">${this._esc(String(failedError).slice(0, 120))}</div>` : ''}
        </div>
        <button class="hc-btn hc-btn-primary" id="hc-banner-retry">↻ Retry Failed</button>
      `;

      this.canvasWrap.appendChild(banner);
      this.failureBannerEl = banner;

      banner.querySelector('#hc-banner-retry').addEventListener('click', () => this._onRetryFailed());
    }

    _hideFailureBanner() {
      if (this.failureBannerEl) {
        this.failureBannerEl.remove();
        this.failureBannerEl = null;
      }
    }

    async _onRetryFailed() {
      if (!this.currentRunId) return;

      // Find root failed nodes — failed nodes whose upstream parents are NOT failed.
      // Only these need explicit retry; downstream failed nodes will re-trigger
      // naturally through the DAG when their parents complete.
      const failedIds = new Set();
      for (const [id, node] of this.nodes) {
        if (node.status === 'failed') failedIds.add(id);
      }
      if (!failedIds.size) return;

      const rootFailedIds = [];
      for (const id of failedIds) {
        const parents = this.edges.filter(e => e.to === id).map(e => e.from);
        const hasFailedParent = parents.some(pid => failedIds.has(pid));
        if (!hasFailedParent) rootFailedIds.push(id);
      }

      if (!rootFailedIds.length) return;

      // Disable retry buttons during operation
      if (this.retryBtn) { this.retryBtn.disabled = true; this.retryBtn.textContent = '↻ Retrying…'; }
      const bannerBtn = this.failureBannerEl?.querySelector('#hc-banner-retry');
      if (bannerBtn) { bannerBtn.disabled = true; bannerBtn.textContent = '↻ Retrying…'; }

      try {
        for (const nodeId of rootFailedIds) {
          await fetch(`/api/missions/runs/${this.currentRunId}/retry/${nodeId}`, { method: 'POST' });
          this._updateNodeStatus(nodeId, 'retrying');
          this._addComm('RETRY', this._nodeLabel(nodeId), 'Retry requested');
        }
        this._hideFailureBanner();
        this._setStatus('EXECUTING');
      } catch (e) {
        this._addComm('FAIL', 'SYSTEM', `Retry failed: ${e.message}`);
      } finally {
        if (this.retryBtn) { this.retryBtn.disabled = false; this.retryBtn.textContent = '↻ Retry Failed'; }
      }
    }

    // ── Destroy ───────────────────────────────────────────────────────────────

    destroy() {
      this._destroyed = true;
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.ws) { try { this.ws.close(); } catch (_) {} }
      clearTimeout(this._wsReconnectTimer);
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this._hideOverlay();
      this._hideFailureBanner();
      this.container.innerHTML = '';
    }
  }

  // ─── Export ──────────────────────────────────────────────────────────────────

  window.HolonetCommand = HolonetCommand;

})();
