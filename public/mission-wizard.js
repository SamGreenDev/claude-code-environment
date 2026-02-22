/**
 * Mission Wizard — AI-powered team recommendation chat modal
 * Allows users to describe goals in natural language and get DAG recommendations
 */

(function () {
  // ─── Styles ──────────────────────────────────────────────────────────────────

  function injectWizardStyles() {
    if (document.getElementById('mw-styles')) return;
    const style = document.createElement('style');
    style.id = 'mw-styles';
    style.textContent = `
      .mw-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
        animation: mw-fade-in 0.15s ease;
      }
      @keyframes mw-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .mw-modal {
        background: #151515;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        width: 560px;
        max-width: 92vw;
        height: 620px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: mw-slide-up 0.2s ease;
      }
      @keyframes mw-slide-up {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      /* Header */
      .mw-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid #2a2a2a;
        background: #111;
        flex-shrink: 0;
      }
      .mw-header-title {
        font-size: 14px;
        font-weight: 600;
        color: #F0F0F0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mw-header-title span { font-size: 16px; }
      .mw-close-btn {
        background: none;
        border: none;
        color: #666;
        font-size: 18px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
      }
      .mw-close-btn:hover { color: #F0F0F0; background: #2a2a2a; }

      /* Chat area */
      .mw-chat {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .mw-chat::-webkit-scrollbar { width: 4px; }
      .mw-chat::-webkit-scrollbar-track { background: transparent; }
      .mw-chat::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

      .mw-bubble {
        max-width: 88%;
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.5;
        animation: mw-bubble-in 0.15s ease;
      }
      @keyframes mw-bubble-in {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .mw-bubble-user {
        align-self: flex-end;
        background: #1e3a5f;
        color: #d0e8ff;
        border-bottom-right-radius: 3px;
      }
      .mw-bubble-assistant {
        align-self: flex-start;
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        color: #d0d0d0;
        border-bottom-left-radius: 3px;
      }
      .mw-bubble-error {
        align-self: flex-start;
        background: #2a1010;
        border: 1px solid #4a1010;
        color: #f0a0a0;
        border-bottom-left-radius: 3px;
      }

      /* Mission preview card */
      .mw-preview {
        margin-top: 10px;
        background: #111;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 12px;
      }
      .mw-preview-title {
        font-size: 12px;
        font-weight: 600;
        color: #C74634;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .mw-preview-nodes {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }
      .mw-preview-node {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 8px;
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 6px;
        font-size: 11px;
      }
      .mw-preview-node-icon {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
      }
      .mw-preview-node-label { color: #d0d0d0; }
      .mw-preview-node-type { color: #666; font-size: 9px; }
      .mw-preview-edges {
        font-size: 10px;
        color: #666;
        font-family: "SF Mono", "Fira Code", Consolas, monospace;
        margin-top: 4px;
      }
      .mw-preview-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .mw-btn {
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid #3a3a3a;
        background: #1a1a1a;
        color: #d0d0d0;
        transition: all 0.15s;
      }
      .mw-btn:hover { background: #252525; border-color: #555; }
      .mw-btn-primary {
        background: #C74634;
        border-color: #C74634;
        color: #fff;
      }
      .mw-btn-primary:hover { background: #D95A4A; }

      /* Suggestions */
      .mw-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .mw-suggestion {
        padding: 3px 10px;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        font-size: 11px;
        color: #999;
        cursor: pointer;
        transition: all 0.15s;
      }
      .mw-suggestion:hover { border-color: #C74634; color: #d0d0d0; }

      /* Input area */
      .mw-input-area {
        padding: 12px 16px;
        border-top: 1px solid #2a2a2a;
        background: #111;
        flex-shrink: 0;
      }
      .mw-input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      .mw-input {
        flex: 1;
        background: #1a1a1a;
        border: 1px solid #3a3a3a;
        color: #F0F0F0;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        resize: none;
        outline: none;
        min-height: 20px;
        max-height: 80px;
        transition: border-color 0.15s;
      }
      .mw-input:focus { border-color: #C74634; }
      .mw-input::placeholder { color: #555; }
      .mw-send-btn {
        padding: 8px 16px;
        background: #C74634;
        border: none;
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
      }
      .mw-send-btn:hover { background: #D95A4A; }
      .mw-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .mw-footer-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }
      .mw-backend-label {
        font-size: 10px;
        color: #555;
      }
      .mw-backend-select {
        background: #1a1a1a;
        border: 1px solid #333;
        color: #999;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 10px;
        outline: none;
      }
      .mw-backend-select:focus { border-color: #C74634; }

      /* Loading dots */
      .mw-loading {
        display: flex;
        gap: 4px;
        padding: 4px 0;
      }
      .mw-loading-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #555;
        animation: mw-dot-pulse 1.2s infinite;
      }
      .mw-loading-dot:nth-child(2) { animation-delay: 0.2s; }
      .mw-loading-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes mw-dot-pulse {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Agent type → color mapping ──────────────────────────────────────────────

  const AGENT_COLORS = {
    'Plan': '#4fa4ff',
    'Explore': '#50C878',
    'general-purpose': '#C74634',
    'code-implementer': '#22C55E',
    'code-reviewer': '#E07A30',
    'security-reviewer': '#DC2626',
    'architect': '#8B5CF6',
    'refactor-cleaner': '#14B8A6',
    'e2e-runner': '#F59E0B',
    'Bash': '#6B7280',
  };

  function agentColor(type) {
    return AGENT_COLORS[type] || '#666';
  }

  // ─── MissionWizard Class ─────────────────────────────────────────────────────

  class MissionWizard {
    constructor(builder) {
      this.builder = builder;
      this._history = [];
      this._lastMission = null;
      this._backdrop = null;
      this._sending = false;
      injectWizardStyles();
    }

    open() {
      if (this._backdrop) {
        this._backdrop.style.display = 'flex';
        this._scrollToBottom();
        this._focusInput();
        return;
      }
      this._build();
      document.body.appendChild(this._backdrop);
      this._focusInput();
    }

    close() {
      if (this._backdrop) {
        this._backdrop.style.display = 'none';
      }
    }

    _build() {
      this._backdrop = document.createElement('div');
      this._backdrop.className = 'mw-backdrop';
      this._backdrop.addEventListener('click', (e) => {
        if (e.target === this._backdrop) this.close();
      });

      const modal = document.createElement('div');
      modal.className = 'mw-modal';

      // Header
      const header = document.createElement('div');
      header.className = 'mw-header';
      const title = document.createElement('div');
      title.className = 'mw-header-title';
      title.innerHTML = '<span>&#10024;</span> Mission Wizard';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'mw-close-btn';
      closeBtn.textContent = '\u00d7';
      closeBtn.addEventListener('click', () => this.close());
      header.appendChild(title);
      header.appendChild(closeBtn);

      // Chat area
      this._chatEl = document.createElement('div');
      this._chatEl.className = 'mw-chat';

      // Welcome message
      if (this._history.length === 0) {
        this._addAssistantBubble('Describe your goal and I\'ll recommend an optimal agent team. For example:\n\n\u2022 "Build a REST API with auth and tests"\n\u2022 "Refactor the payment module"\n\u2022 "Security audit of the user service"');
      } else {
        this._rebuildChat();
      }

      // Input area
      const inputArea = document.createElement('div');
      inputArea.className = 'mw-input-area';

      const inputRow = document.createElement('div');
      inputRow.className = 'mw-input-row';

      this._input = document.createElement('textarea');
      this._input.className = 'mw-input';
      this._input.placeholder = 'Describe your goal\u2026';
      this._input.rows = 1;
      this._input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._sendMessage();
        }
      });
      this._input.addEventListener('input', () => {
        this._input.style.height = 'auto';
        this._input.style.height = Math.min(this._input.scrollHeight, 80) + 'px';
      });

      this._sendBtn = document.createElement('button');
      this._sendBtn.className = 'mw-send-btn';
      this._sendBtn.textContent = 'Send';
      this._sendBtn.addEventListener('click', () => this._sendMessage());

      inputRow.appendChild(this._input);
      inputRow.appendChild(this._sendBtn);

      // Backend selector
      const footerRow = document.createElement('div');
      footerRow.className = 'mw-footer-row';
      const label = document.createElement('span');
      label.className = 'mw-backend-label';
      label.textContent = 'Backend:';
      this._backendSelect = document.createElement('select');
      this._backendSelect.className = 'mw-backend-select';
      for (const opt of ['cli', 'api', 'rules']) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt.toUpperCase();
        this._backendSelect.appendChild(o);
      }
      this._backendSelect.value = 'cli';
      footerRow.appendChild(label);
      footerRow.appendChild(this._backendSelect);

      inputArea.appendChild(inputRow);
      inputArea.appendChild(footerRow);

      modal.appendChild(header);
      modal.appendChild(this._chatEl);
      modal.appendChild(inputArea);
      this._backdrop.appendChild(modal);
    }

    async _sendMessage() {
      const text = this._input.value.trim();
      if (!text || this._sending) return;

      this._sending = true;
      this._sendBtn.disabled = true;
      this._input.value = '';
      this._input.style.height = 'auto';

      // Add user bubble
      this._addUserBubble(text);
      this._history.push({ role: 'user', content: text });

      // Add loading indicator
      const loadingEl = this._addLoadingBubble();

      try {
        const resp = await fetch('/api/missions/wizard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: this._history.slice(0, -1), // exclude current message (server gets it as message param)
            backend: this._backendSelect.value,
          }),
        });

        loadingEl.remove();

        const data = await resp.json();

        if (!resp.ok) {
          this._addErrorBubble(data.error || 'Request failed');
          return;
        }

        // Add assistant response
        this._history.push({ role: 'assistant', content: data.message });
        const bubbleEl = this._addAssistantBubble(data.message);

        // Add mission preview if present
        if (data.mission) {
          this._lastMission = data.mission;
          this._addMissionPreview(bubbleEl, data.mission);
        }

        // Add suggestions
        if (data.suggestions?.length) {
          this._addSuggestions(bubbleEl, data.suggestions);
        }
      } catch (err) {
        loadingEl.remove();
        this._addErrorBubble(`Network error: ${err.message}`);
      } finally {
        this._sending = false;
        this._sendBtn.disabled = false;
        this._focusInput();
      }
    }

    _addUserBubble(text) {
      const el = document.createElement('div');
      el.className = 'mw-bubble mw-bubble-user';
      el.textContent = text;
      this._chatEl.appendChild(el);
      this._scrollToBottom();
      return el;
    }

    _addAssistantBubble(text) {
      const el = document.createElement('div');
      el.className = 'mw-bubble mw-bubble-assistant';
      // Simple markdown-like formatting
      el.innerHTML = this._formatText(text);
      this._chatEl.appendChild(el);
      this._scrollToBottom();
      return el;
    }

    _addErrorBubble(text) {
      const el = document.createElement('div');
      el.className = 'mw-bubble mw-bubble-error';
      el.textContent = text;
      this._chatEl.appendChild(el);
      this._scrollToBottom();
      return el;
    }

    _addLoadingBubble() {
      const el = document.createElement('div');
      el.className = 'mw-bubble mw-bubble-assistant';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '8px';

      const statusText = document.createElement('span');
      statusText.style.color = '#999';
      statusText.style.fontSize = '12px';
      statusText.textContent = 'Evaluating your request';

      const dots = document.createElement('span');
      dots.className = 'mw-loading';
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'mw-loading-dot';
        dots.appendChild(dot);
      }

      el.appendChild(statusText);
      el.appendChild(dots);
      this._chatEl.appendChild(el);
      this._scrollToBottom();
      return el;
    }

    _addMissionPreview(parentEl, mission) {
      const preview = document.createElement('div');
      preview.className = 'mw-preview';

      // Title
      const titleEl = document.createElement('div');
      titleEl.className = 'mw-preview-title';
      titleEl.innerHTML = `&#9881; ${this._escapeHtml(mission.name || 'Proposed Mission')}`;
      preview.appendChild(titleEl);

      // Node badges
      const nodesEl = document.createElement('div');
      nodesEl.className = 'mw-preview-nodes';
      for (const node of mission.nodes) {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'mw-preview-node';

        const icon = document.createElement('div');
        icon.className = 'mw-preview-node-icon';
        icon.style.background = agentColor(node.agentType);
        icon.textContent = (node.label || 'X')[0];

        const labelEl = document.createElement('span');
        labelEl.className = 'mw-preview-node-label';
        labelEl.textContent = node.label;

        const typeEl = document.createElement('span');
        typeEl.className = 'mw-preview-node-type';
        typeEl.textContent = node.agentType;

        nodeEl.appendChild(icon);
        nodeEl.appendChild(labelEl);
        nodeEl.appendChild(typeEl);
        nodesEl.appendChild(nodeEl);
      }
      preview.appendChild(nodesEl);

      // Edge summary
      const edgesEl = document.createElement('div');
      edgesEl.className = 'mw-preview-edges';
      const edgeLabels = mission.edges.map(e => {
        const fromNode = mission.nodes.find(n => n.id === e.from);
        const toNode = mission.nodes.find(n => n.id === e.to);
        return `${fromNode?.label || e.from} \u2192 ${toNode?.label || e.to}`;
      });
      edgesEl.textContent = edgeLabels.join('  \u00b7  ');
      preview.appendChild(edgesEl);

      // Action buttons
      const actions = document.createElement('div');
      actions.className = 'mw-preview-actions';

      const applyBtn = document.createElement('button');
      applyBtn.className = 'mw-btn';
      applyBtn.textContent = 'Apply to Canvas';
      applyBtn.addEventListener('click', () => this._applyToCanvas(mission));

      const applyExecBtn = document.createElement('button');
      applyExecBtn.className = 'mw-btn mw-btn-primary';
      applyExecBtn.textContent = 'Apply & Execute';
      applyExecBtn.addEventListener('click', () => this._applyAndExecute(mission));

      actions.appendChild(applyBtn);
      actions.appendChild(applyExecBtn);
      preview.appendChild(actions);

      parentEl.appendChild(preview);
      this._scrollToBottom();
    }

    _addSuggestions(parentEl, suggestions) {
      const container = document.createElement('div');
      container.className = 'mw-suggestions';
      for (const text of suggestions) {
        const chip = document.createElement('button');
        chip.className = 'mw-suggestion';
        chip.textContent = text;
        chip.addEventListener('click', () => {
          this._input.value = text;
          this._input.focus();
        });
        container.appendChild(chip);
      }
      parentEl.appendChild(container);
      this._scrollToBottom();
    }

    _applyToCanvas(mission) {
      const laid = this._autoLayout(mission);
      this.builder.loadMission(laid);
      this.close();
    }

    _applyAndExecute(mission) {
      const laid = this._autoLayout(mission);
      this.builder.loadMission(laid);
      // Trigger save then execute
      this.builder._save().then(() => {
        this.builder._execute();
      });
      this.close();
    }

    /**
     * Auto-layout nodes using topological sort into layers.
     * Assigns position coordinates so nodes don't stack on (80,80).
     */
    _autoLayout(mission) {
      const nodes = mission.nodes;
      const edges = mission.edges;

      // Build adjacency: parent → children
      const childrenOf = new Map();
      const parentsOf = new Map();
      for (const n of nodes) {
        childrenOf.set(n.id, []);
        parentsOf.set(n.id, []);
      }
      for (const e of edges) {
        childrenOf.get(e.from)?.push(e.to);
        parentsOf.get(e.to)?.push(e.from);
      }

      // Topological sort into layers (Kahn's algorithm)
      const inDegree = new Map();
      for (const n of nodes) {
        inDegree.set(n.id, (parentsOf.get(n.id) || []).length);
      }

      const layers = [];
      const visited = new Set();
      let queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);

      while (queue.length > 0) {
        layers.push([...queue]);
        for (const id of queue) visited.add(id);

        const nextQueue = [];
        for (const id of queue) {
          for (const childId of (childrenOf.get(id) || [])) {
            inDegree.set(childId, inDegree.get(childId) - 1);
            if (inDegree.get(childId) === 0 && !visited.has(childId)) {
              nextQueue.push(childId);
            }
          }
        }
        queue = nextQueue;
      }

      // Handle any remaining nodes (cycles — shouldn't happen in a DAG but just in case)
      for (const n of nodes) {
        if (!visited.has(n.id)) {
          layers.push([n.id]);
          visited.add(n.id);
        }
      }

      // Assign positions: layers go left-to-right, nodes within layer are centered vertically
      const LAYER_X_GAP = 220;
      const NODE_Y_GAP = 120;
      const START_X = 80;
      const START_Y = 80;

      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
        const layer = layers[layerIdx];
        const x = START_X + layerIdx * LAYER_X_GAP;
        const totalHeight = (layer.length - 1) * NODE_Y_GAP;
        const startY = START_Y + Math.max(0, (300 - totalHeight) / 2);

        for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
          const node = nodeMap.get(layer[nodeIdx]);
          if (node) {
            node.position = { x, y: startY + nodeIdx * NODE_Y_GAP };
          }
        }
      }

      return mission;
    }

    _rebuildChat() {
      this._chatEl.innerHTML = '';
      for (const turn of this._history) {
        if (turn.role === 'user') {
          this._addUserBubble(turn.content);
        } else {
          this._addAssistantBubble(turn.content);
        }
      }
      // Re-add mission preview for last mission
      if (this._lastMission && this._chatEl.lastElementChild) {
        this._addMissionPreview(this._chatEl.lastElementChild, this._lastMission);
      }
    }

    _formatText(text) {
      // Simple formatting: bold, bullet points, newlines
      return this._escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\u2022 /g, '<br>\u2022 ')
        .replace(/\n(\d+)\. /g, '<br>$1. ')
        .replace(/\n/g, '<br>');
    }

    _escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    _scrollToBottom() {
      requestAnimationFrame(() => {
        if (this._chatEl) {
          this._chatEl.scrollTop = this._chatEl.scrollHeight;
        }
      });
    }

    _focusInput() {
      requestAnimationFrame(() => {
        if (this._input) this._input.focus();
      });
    }
  }

  // Export globally
  window.MissionWizard = MissionWizard;
})();
