/**
 * Jedi Archives - Agent Visualization Dashboard
 * Canvas-based pixel art rendering of Jedi at holocron terminals
 * @author Sam Green <samuel.green2k@gmail.com>
 */

// ============================================================
// Constants & Color Palette
// ============================================================

const COLORS = {
  // Background colors
  bgDeep: '#0a1628',
  bgMid: '#0f1f35',
  bgLight: '#152540',

  // Holocron/terminal colors
  holocronBlue: '#4fa4ff',
  holocronGlow: '#7fdbff',
  holocronDim: '#1a3a5c',

  // Accent colors
  archiveGold: '#c9a227',
  goldLight: '#e8c547',

  // Jedi robe colors
  robeBrown: '#5c4033',
  robeLight: '#7a5a45',
  robeDark: '#3d2a22',

  // Special effects
  forceGhost: '#a8d4ff',
  forceSparkle: '#ffffff',
  dataPurple: '#9b7ed9',
  dataGreen: '#4ade80',

  // Text
  textGlow: '#7fdbff',
  textDim: '#4a6a8a'
};

// Terminal positions (12 terminals in 2 rows of 6)
const TERMINAL_POSITIONS = [
  // Row 1 (top) - terminals 0-5
  { x: 100, y: 180 },
  { x: 240, y: 180 },
  { x: 380, y: 180 },
  { x: 520, y: 180 },
  { x: 660, y: 180 },
  { x: 800, y: 180 },
  // Row 2 (bottom) - terminals 6-11
  { x: 100, y: 400 },
  { x: 240, y: 400 },
  { x: 380, y: 400 },
  { x: 520, y: 400 },
  { x: 660, y: 400 },
  { x: 800, y: 400 }
];

// Animation timing
const FRAME_RATE = 60;
const WALK_SPEED = 2;
const ANIMATION_FRAME_DURATION = 150; // ms per sprite frame

// Agent type to Jedi class mapping
const JEDI_CLASS_MAP = {
  'Explore': 'scholar',
  'Plan': 'council',
  'Bash': 'guardian',
  'general-purpose': 'padawan',
  'code-quality-agent': 'sentinel',
  'netsuite-specialist': 'consular',
  'deploy-agent': 'guardian',
  'documentation-agent': 'scholar',
  'bundling-agent': 'padawan',
  'apex-specialist': 'consular',
  'claude-code-guide': 'scholar',
  'statusline-setup': 'padawan',
  'default': 'padawan'
};

// Jedi class visual configs
const JEDI_CONFIGS = {
  scholar: {
    name: 'Scholar',
    robeColor: '#5c4033',
    accentColor: '#c9a227',
    description: 'Jedi Librarian'
  },
  council: {
    name: 'Council',
    robeColor: '#4a3728',
    accentColor: '#e8c547',
    description: 'Jedi Master'
  },
  guardian: {
    name: 'Guardian',
    robeColor: '#3d4a5c',
    accentColor: '#4fa4ff',
    description: 'Jedi Knight'
  },
  padawan: {
    name: 'Padawan',
    robeColor: '#6b5344',
    accentColor: '#7fdbff',
    description: 'Young Jedi'
  },
  sentinel: {
    name: 'Sentinel',
    robeColor: '#5c5033',
    accentColor: '#ffe066',
    description: 'Jedi Sentinel'
  },
  consular: {
    name: 'Consular',
    robeColor: '#2d4a3d',
    accentColor: '#4ade80',
    description: 'Jedi Consular'
  }
};

// ============================================================
// Main JediArchives Class
// ============================================================

class JediArchives {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error('[JediArchives] Canvas not found:', canvasId);
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.agents = new Map();
    this.particles = [];
    this.dataStreams = [];
    this.lastTime = 0;
    this.animationFrame = 0;
    this.ws = null;
    this.connected = false;

    // Set canvas size
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Start animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    // Connect to WebSocket
    this.connectWebSocket();

    console.log('[JediArchives] Initialized');
  }

  resize() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set display size
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';

    // Set actual size in memory (scaled for retina)
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Scale context for retina
    this.ctx.scale(dpr, dpr);

    this.width = rect.width;
    this.height = rect.height;

    // Recalculate terminal positions based on canvas size
    this.calculateTerminalPositions();
  }

  calculateTerminalPositions() {
    const margin = 140;
    const usableWidth = this.width - (margin * 2);
    const spacing = usableWidth / 5;

    // Update terminal positions
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        const index = row * 6 + col;
        TERMINAL_POSITIONS[index] = {
          x: margin + (col * spacing),
          y: row === 0 ? this.height * 0.32 : this.height * 0.72
        };
      }
    }
  }

  // ============================================================
  // WebSocket Connection
  // ============================================================

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/activity`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[JediArchives] WebSocket connected');
        this.connected = true;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('[JediArchives] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[JediArchives] WebSocket disconnected');
        this.connected = false;
        // Attempt reconnect after 3 seconds
        setTimeout(() => this.connectWebSocket(), 3000);
      };

      this.ws.onerror = (err) => {
        console.error('[JediArchives] WebSocket error:', err);
      };
    } catch (err) {
      console.error('[JediArchives] Failed to connect WebSocket:', err);
      setTimeout(() => this.connectWebSocket(), 3000);
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'init':
        // Initialize with existing agents
        message.agents.forEach(agent => this.addAgent(agent));
        break;

      case 'agent_spawned':
        this.addAgent(message.agent);
        break;

      case 'agent_updated':
        this.updateAgent(message.agent);
        break;

      case 'agent_completing':
        this.updateAgent(message.agent);
        this.triggerCompletionEffect(message.agent.id);
        break;

      case 'agent_removed':
        this.removeAgent(message.agentId);
        break;

      case 'agents_cleared':
        this.agents.clear();
        console.log('[JediArchives] All agents cleared');
        break;
    }
  }

  // ============================================================
  // Agent Management
  // ============================================================

  addAgent(agentData) {
    const terminal = TERMINAL_POSITIONS[agentData.terminalIndex] || TERMINAL_POSITIONS[0];

    const agent = {
      ...agentData,
      // Visual state
      currentX: this.width / 2,
      currentY: this.height + 50,
      targetX: terminal.x,
      targetY: terminal.y,
      opacity: 1,
      animFrame: 0,
      direction: terminal.x > this.width / 2 ? 1 : -1,
      // Effects
      glowIntensity: 0,
      dataStreamActive: false,
      completionProgress: 0
    };

    this.agents.set(agentData.id, agent);

    // Create entrance particles
    this.createSpawnParticles(agent.currentX, agent.currentY);

    console.log('[JediArchives] Agent added:', agentData.id);
  }

  updateAgent(agentData) {
    if (!this.agents.has(agentData.id)) {
      this.addAgent(agentData);
      return;
    }

    const agent = this.agents.get(agentData.id);
    Object.assign(agent, agentData);

    // Update visual state based on status
    if (agentData.status === 'working') {
      agent.dataStreamActive = true;
      agent.glowIntensity = 1;
    } else if (agentData.status === 'completing') {
      agent.completionProgress = 0;
    } else if (agentData.status === 'leaving') {
      agent.targetY = this.height + 50;
      agent.dataStreamActive = false;
      agent.forceGhostProgress = 0; // Start force ghost fade
    }
  }

  removeAgent(agentId) {
    this.agents.delete(agentId);
    console.log('[JediArchives] Agent removed:', agentId);
  }

  triggerCompletionEffect(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Create Force sparkle particles
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: agent.currentX,
        y: agent.currentY - 20,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 60,
        maxLife: 60,
        color: COLORS.forceSparkle,
        size: Math.random() * 3 + 1
      });
    }
  }

  createSpawnParticles(x, y) {
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 1,
        life: 40,
        maxLife: 40,
        color: COLORS.forceGhost,
        size: Math.random() * 2 + 1
      });
    }
  }

  // ============================================================
  // Animation Loop
  // ============================================================

  animate(currentTime) {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Update animation frame counter
    if (deltaTime > ANIMATION_FRAME_DURATION) {
      this.animationFrame++;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw layers
    this.drawBackground();
    this.drawShelves();
    this.drawTerminals();
    this.drawDataStreams();
    this.updateAndDrawAgents(deltaTime);
    this.updateAndDrawParticles();
    this.drawSpeechBubbles();
    this.drawHeader();
    this.drawConnectionStatus();

    requestAnimationFrame(this.animate);
  }

  // ============================================================
  // Drawing Methods
  // ============================================================

  drawBackground() {
    const ctx = this.ctx;

    // Deep space gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, COLORS.bgDeep);
    gradient.addColorStop(0.5, COLORS.bgMid);
    gradient.addColorStop(1, COLORS.bgDeep);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Barrel vault ceiling effect
    this.drawVaultedCeiling();

    // Ambient lighting spots
    this.drawAmbientLighting();
  }

  drawVaultedCeiling() {
    const ctx = this.ctx;

    // Draw arched ceiling ribs
    ctx.strokeStyle = COLORS.archiveGold;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.15;

    const archCount = 8;
    for (let i = 0; i <= archCount; i++) {
      const x = (this.width / archCount) * i;
      ctx.beginPath();
      ctx.moveTo(x, this.height);
      ctx.quadraticCurveTo(x, -50, this.width / 2, -100);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Top architectural detail
    ctx.fillStyle = COLORS.bgLight;
    ctx.fillRect(0, 0, this.width, 52);

    // Gold accent line
    ctx.strokeStyle = COLORS.archiveGold;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 52);
    ctx.lineTo(this.width, 52);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawAmbientLighting() {
    const ctx = this.ctx;

    // Blue ambient glow spots
    const glowPositions = [
      { x: this.width * 0.2, y: this.height * 0.3 },
      { x: this.width * 0.5, y: this.height * 0.5 },
      { x: this.width * 0.8, y: this.height * 0.3 },
      { x: this.width * 0.3, y: this.height * 0.7 },
      { x: this.width * 0.7, y: this.height * 0.7 }
    ];

    glowPositions.forEach(pos => {
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 150);
      gradient.addColorStop(0, 'rgba(79, 164, 255, 0.05)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(pos.x - 150, pos.y - 150, 300, 300);
    });
  }

  drawShelves() {
    const ctx = this.ctx;

    // Left shelf column
    this.drawShelfColumn(30, 60, 50, this.height - 120);

    // Right shelf column
    this.drawShelfColumn(this.width - 80, 60, 50, this.height - 120);
  }

  drawShelfColumn(x, y, width, height) {
    const ctx = this.ctx;

    // Shelf background
    ctx.fillStyle = COLORS.bgLight;
    ctx.fillRect(x, y, width, height);

    // Shelf border
    ctx.strokeStyle = COLORS.archiveGold;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.strokeRect(x, y, width, height);
    ctx.globalAlpha = 1;

    // Holocrons on shelves
    const shelfCount = 8;
    const shelfHeight = height / shelfCount;

    for (let i = 0; i < shelfCount; i++) {
      const shelfY = y + (i * shelfHeight) + 10;

      // Shelf divider line
      ctx.strokeStyle = COLORS.archiveGold;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(x, shelfY + shelfHeight - 5);
      ctx.lineTo(x + width, shelfY + shelfHeight - 5);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw 2-3 holocrons per shelf
      const holocronCount = Math.floor(Math.random() * 2) + 2;
      for (let j = 0; j < holocronCount; j++) {
        const hx = x + 10 + (j * 15);
        const hy = shelfY + shelfHeight - 20;

        // Holocron cube
        const pulse = Math.sin(Date.now() / 1000 + i + j) * 0.3 + 0.7;
        ctx.fillStyle = COLORS.holocronDim;
        ctx.fillRect(hx, hy, 10, 10);

        // Holocron glow
        ctx.globalAlpha = 0.3 * pulse;
        ctx.fillStyle = COLORS.holocronBlue;
        ctx.fillRect(hx + 2, hy + 2, 6, 6);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawTerminals() {
    const ctx = this.ctx;

    TERMINAL_POSITIONS.forEach((pos, index) => {
      // Check if terminal is occupied
      let occupied = false;
      let occupantStatus = null;
      this.agents.forEach(agent => {
        if (agent.terminalIndex === index && agent.status === 'working') {
          occupied = true;
          occupantStatus = agent.status;
        }
      });

      this.drawTerminal(pos.x, pos.y, occupied, index);
    });
  }

  drawTerminal(x, y, active, index) {
    const ctx = this.ctx;

    // Terminal base/pedestal
    ctx.fillStyle = COLORS.bgLight;
    ctx.fillRect(x - 25, y + 20, 50, 15);

    // Terminal pillar
    ctx.fillStyle = active ? COLORS.holocronDim : '#1a2a3a';
    ctx.fillRect(x - 15, y - 30, 30, 50);

    // Terminal screen/projector area
    if (active) {
      // Active glow
      const pulse = Math.sin(Date.now() / 500) * 0.2 + 0.8;

      // Outer glow
      const gradient = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 40);
      gradient.addColorStop(0, `rgba(79, 164, 255, ${0.3 * pulse})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y - 10, 40, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright area
      ctx.fillStyle = COLORS.holocronBlue;
      ctx.globalAlpha = 0.6 * pulse;
      ctx.fillRect(x - 12, y - 28, 24, 20);
      ctx.globalAlpha = 1;

      // Holographic projection lines
      ctx.strokeStyle = COLORS.holocronGlow;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 10 + i * 10, y - 28);
        ctx.lineTo(x - 15 + i * 15, y - 60);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      // Inactive terminal
      ctx.fillStyle = COLORS.holocronDim;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x - 12, y - 28, 24, 20);
      ctx.globalAlpha = 1;
    }

    // Terminal number label
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText((index + 1).toString(), x, y + 45);
  }

  drawDataStreams() {
    const ctx = this.ctx;

    this.agents.forEach(agent => {
      if (agent.dataStreamActive && agent.status === 'working') {
        this.drawDataStream(agent);
      }
    });
  }

  drawDataStream(agent) {
    const ctx = this.ctx;
    const x = agent.currentX;
    const y = agent.currentY - 40;

    // Vertical data stream
    ctx.strokeStyle = COLORS.holocronGlow;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;

    // Animated data bits
    const time = Date.now() / 100;
    for (let i = 0; i < 10; i++) {
      const yOffset = ((time + i * 5) % 50);
      const alpha = 1 - (yOffset / 50);
      ctx.globalAlpha = alpha * 0.6;

      ctx.beginPath();
      ctx.moveTo(x - 5 + Math.sin(time + i) * 3, y - yOffset);
      ctx.lineTo(x - 5 + Math.sin(time + i) * 3, y - yOffset - 5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + 5 + Math.cos(time + i) * 3, y - yOffset - 2);
      ctx.lineTo(x + 5 + Math.cos(time + i) * 3, y - yOffset - 7);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  updateAndDrawAgents(deltaTime) {
    this.agents.forEach(agent => {
      // Move toward target regardless of status (except leaving)
      if (agent.status !== 'leaving') {
        const dx = agent.targetX - agent.currentX;
        const dy = agent.targetY - agent.currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > WALK_SPEED) {
          agent.currentX += (dx / dist) * WALK_SPEED;
          agent.currentY += (dy / dist) * WALK_SPEED;
          agent.direction = dx > 0 ? 1 : -1;
          agent._arrived = false;
        } else if (!agent._arrived) {
          agent.currentX = agent.targetX;
          agent.currentY = agent.targetY;
          agent._arrived = true;
        }
      } else {
        // Leaving - Force ghost effect, stay in place and fade out
        agent.forceGhostProgress = (agent.forceGhostProgress || 0) + 0.015;

        // Create occasional force sparkles during ghost transition
        if (Math.random() < 0.15) {
          this.particles.push({
            x: agent.currentX + (Math.random() - 0.5) * 30,
            y: agent.currentY - 20 + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 1,
            vy: -Math.random() * 2 - 0.5,
            life: 30,
            maxLife: 30,
            color: COLORS.forceGhost,
            size: Math.random() * 2 + 1
          });
        }

        // Fade out opacity as ghost transition progresses
        agent.opacity = Math.max(0, 1 - agent.forceGhostProgress);
      }

      // Completion animation (runs alongside movement)
      if (agent.status === 'completing') {
        agent.completionProgress = Math.min(1, agent.completionProgress + 0.02);
      }

      // Draw the Jedi
      this.drawJedi(agent);
    });
  }

  drawJedi(agent) {
    const ctx = this.ctx;
    const x = agent.currentX;
    const y = agent.currentY;
    const config = JEDI_CONFIGS[agent.jediClass] || JEDI_CONFIGS.padawan;

    ctx.save();
    ctx.globalAlpha = agent.opacity;

    // Completion glow effect
    if (agent.status === 'completing') {
      const glowRadius = 30 + agent.completionProgress * 20;
      const gradient = ctx.createRadialGradient(x, y - 15, 0, x, y - 15, glowRadius);
      gradient.addColorStop(0, `rgba(168, 212, 255, ${0.5 * (1 - agent.completionProgress)})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y - 15, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Force ghost glow effect when leaving
    if (agent.status === 'leaving') {
      const ghostProgress = agent.forceGhostProgress || 0;
      const glowRadius = 40 + ghostProgress * 30;
      const gradient = ctx.createRadialGradient(x, y - 15, 0, x, y - 15, glowRadius);
      gradient.addColorStop(0, `rgba(168, 212, 255, ${0.4 * agent.opacity})`);
      gradient.addColorStop(0.5, `rgba(168, 212, 255, ${0.2 * agent.opacity})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y - 15, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Determine animation frame - use arrival flag for movement detection
    const isMoving = !agent._arrived && agent.status !== 'leaving';
    const walkFrame = isMoving ? Math.floor(this.animationFrame / 2) % 4 : 0;

    // Draw pixelated Jedi sprite (with force ghost tint when leaving)
    const isForceGhost = agent.status === 'leaving';
    this.drawPixelJedi(x, y, config, agent.direction, walkFrame, agent.status, isForceGhost, isMoving);

    ctx.restore();
  }

  drawPixelJedi(x, y, config, direction, walkFrame, status, isForceGhost = false, isMoving = false) {
    const ctx = this.ctx;
    const scale = 2; // Pixel size

    // Force ghost blue tint colors
    const ghostBlue = '#a8d4ff';
    const ghostBlueDark = '#7ab8f5';
    const ghostBlueMid = '#8ec8ff';

    // Flip for direction
    ctx.save();
    if (direction < 0) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }

    // Walking bob (disabled for ghost and when stationary at terminal)
    const bobOffset = ((status === 'working' && !isMoving) || isForceGhost) ? 0 : Math.sin(walkFrame * Math.PI / 2) * 2;

    // Head
    ctx.fillStyle = isForceGhost ? ghostBlue : '#e8d4b8'; // Skin tone or ghost blue
    this.drawPixelRect(x - 4 * scale, y - 35 * scale + bobOffset, 8 * scale, 8 * scale);

    // Hood/Hair
    ctx.fillStyle = isForceGhost ? ghostBlueDark : config.robeColor;
    this.drawPixelRect(x - 5 * scale, y - 36 * scale + bobOffset, 10 * scale, 4 * scale);
    this.drawPixelRect(x - 6 * scale, y - 33 * scale + bobOffset, 2 * scale, 4 * scale);
    this.drawPixelRect(x + 4 * scale, y - 33 * scale + bobOffset, 2 * scale, 4 * scale);

    // Eyes (faint for ghost)
    ctx.fillStyle = isForceGhost ? ghostBlueMid : '#2a2a2a';
    this.drawPixelRect(x - 2 * scale, y - 32 * scale + bobOffset, 1 * scale, 1 * scale);
    this.drawPixelRect(x + 1 * scale, y - 32 * scale + bobOffset, 1 * scale, 1 * scale);

    // Body/Robe
    ctx.fillStyle = isForceGhost ? ghostBlueDark : config.robeColor;
    this.drawPixelRect(x - 6 * scale, y - 27 * scale + bobOffset, 12 * scale, 20 * scale);

    // Robe inner layer (lighter)
    ctx.fillStyle = isForceGhost ? ghostBlue : this.lightenColor(config.robeColor, 20);
    this.drawPixelRect(x - 2 * scale, y - 25 * scale + bobOffset, 4 * scale, 16 * scale);

    // Belt
    ctx.fillStyle = isForceGhost ? ghostBlueMid : config.accentColor;
    this.drawPixelRect(x - 6 * scale, y - 15 * scale + bobOffset, 12 * scale, 2 * scale);

    // Lightsaber hilt on belt
    ctx.fillStyle = isForceGhost ? ghostBlue : '#888888';
    this.drawPixelRect(x + 5 * scale, y - 18 * scale + bobOffset, 2 * scale, 6 * scale);

    // Arms
    ctx.fillStyle = isForceGhost ? ghostBlueDark : config.robeColor;
    if (status === 'working') {
      // Arms raised, manipulating hologram
      const armWave = Math.sin(Date.now() / 300) * 2;
      this.drawPixelRect(x - 10 * scale, y - 25 * scale + armWave, 4 * scale, 10 * scale);
      this.drawPixelRect(x + 6 * scale, y - 25 * scale - armWave, 4 * scale, 10 * scale);
    } else if (isForceGhost) {
      // Arms in peaceful pose for ghost (slightly raised)
      this.drawPixelRect(x - 10 * scale, y - 24 * scale, 4 * scale, 11 * scale);
      this.drawPixelRect(x + 6 * scale, y - 24 * scale, 4 * scale, 11 * scale);
    } else {
      // Arms at sides (walking)
      const armSwing = Math.sin(walkFrame * Math.PI / 2) * 3;
      this.drawPixelRect(x - 10 * scale, y - 22 * scale + armSwing, 4 * scale, 12 * scale);
      this.drawPixelRect(x + 6 * scale, y - 22 * scale - armSwing, 4 * scale, 12 * scale);
    }

    // Feet (simplified)
    ctx.fillStyle = isForceGhost ? ghostBlueDark : '#3a3a3a';
    const footOffset = (!isForceGhost && (isMoving || status !== 'working')) ? Math.abs(Math.sin(walkFrame * Math.PI / 2)) * 3 : 0;
    this.drawPixelRect(x - 4 * scale, y - 7 * scale, 3 * scale, 3 * scale);
    this.drawPixelRect(x + 1 * scale, y - 7 * scale + footOffset, 3 * scale, 3 * scale);

    ctx.restore();
  }

  drawPixelRect(x, y, w, h) {
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
  }

  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `rgb(${R}, ${G}, ${B})`;
  }

  updateAndDrawParticles() {
    const ctx = this.ctx;

    // Update and draw particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // Gravity
      p.life--;

      if (p.life <= 0) return false;

      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      return true;
    });

    ctx.globalAlpha = 1;
  }

  drawSpeechBubbles() {
    const ctx = this.ctx;

    this.agents.forEach(agent => {
      if ((agent.status === 'working' || agent.status === 'completing') && agent.taskDescription) {
        this.drawSpeechBubble(agent);
      }
    });
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  drawSpeechBubble(agent) {
    const ctx = this.ctx;
    const padding = 10;
    const maxBubbleWidth = 200;
    const lineHeight = 14;
    const maxLines = 5;

    // Truncate task description at 100 chars
    let text = agent.taskDescription;
    if (text.length > 100) {
      text = text.substring(0, 97) + '...';
    }

    // Wrap text into lines
    ctx.font = '11px "JetBrains Mono", monospace';
    const maxTextWidth = maxBubbleWidth - padding * 2;
    let lines = this.wrapText(ctx, text, maxTextWidth);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].substring(0, lines[maxLines - 1].length - 3) + '...';
    }

    // Calculate bubble dimensions
    let widestLine = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > widestLine) widestLine = w;
    }
    const bubbleWidth = Math.min(widestLine + padding * 2, maxBubbleWidth);
    const bubbleHeight = lines.length * lineHeight + padding * 2;

    const x = agent.currentX;
    const y = agent.currentY - 110 - (bubbleHeight - 24) / 2;

    // Holographic style bubble
    const bubbleX = x - bubbleWidth / 2;
    const bubbleY = y - bubbleHeight / 2;

    // Bubble glow
    ctx.shadowColor = COLORS.holocronGlow;
    ctx.shadowBlur = 10;

    // Bubble background
    ctx.fillStyle = 'rgba(10, 22, 40, 0.85)';
    ctx.strokeStyle = COLORS.holocronBlue;
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 4);
    ctx.fill();
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Connector to Jedi
    ctx.beginPath();
    ctx.moveTo(x - 5, bubbleY + bubbleHeight);
    ctx.lineTo(x, bubbleY + bubbleHeight + 8);
    ctx.lineTo(x + 5, bubbleY + bubbleHeight);
    ctx.fillStyle = 'rgba(10, 22, 40, 0.85)';
    ctx.fill();
    ctx.stroke();

    // Draw wrapped text lines
    ctx.fillStyle = COLORS.textGlow;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textStartY = bubbleY + padding + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, textStartY + i * lineHeight);
    }

    // Jedi class indicator
    const config = JEDI_CONFIGS[agent.jediClass] || JEDI_CONFIGS.padawan;
    ctx.fillStyle = config.accentColor;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(config.name, x, bubbleY + bubbleHeight + 18);
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  drawHeader() {
    const ctx = this.ctx;

    // Title
    ctx.fillStyle = COLORS.archiveGold;
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('JEDI ARCHIVES', this.width / 2, 22);

    // Subtitle
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('HOLOCRON HALL - AGENT ACTIVITY', this.width / 2, 36);

    // Agent count
    const activeCount = Array.from(this.agents.values()).filter(
      a => a.status === 'working'
    ).length;

    ctx.textAlign = 'right';
    ctx.fillStyle = activeCount > 0 ? COLORS.holocronGlow : COLORS.textDim;
    ctx.fillText(`${activeCount} ACTIVE`, this.width - 20, 22);
  }

  drawConnectionStatus() {
    const ctx = this.ctx;

    // Connection indicator
    ctx.fillStyle = this.connected ? COLORS.dataGreen : COLORS.textDim;
    ctx.beginPath();
    ctx.arc(20, this.height - 20, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'left';
    ctx.fillText(this.connected ? 'CONNECTED' : 'RECONNECTING...', 30, this.height - 17);
  }

  // ============================================================
  // Public Methods
  // ============================================================

  // For testing - spawn an agent via server API (proper lifecycle)
  async testSpawn(type = 'Explore', description = 'Testing the Jedi Archives') {
    const agentId = `test-${Date.now()}`;

    try {
      // POST to server (creates server-side state with proper lifecycle)
      await fetch('/api/activity/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          agentType: type,
          taskDescription: description
        })
      });

      // Server handles status transitions (spawning → walking → working)
      // Complete after 8 seconds
      setTimeout(async () => {
        await fetch('/api/activity/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, status: 'success' })
        });
      }, 8000);

      console.log('[JediArchives] Test spawn initiated:', agentId);
      return agentId;
    } catch (err) {
      console.error('[JediArchives] Test spawn failed:', err);
      return null;
    }
  }

  // Clear all agents via server API
  async clearAllAgents() {
    try {
      await fetch('/api/activity/agents', { method: 'DELETE' });
      // Server broadcasts agents_cleared, which clears this.agents
      console.log('[JediArchives] Clear all requested');
    } catch (err) {
      console.error('[JediArchives] Clear all failed:', err);
    }
  }

  destroy() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Export for use in app.js
window.JediArchives = JediArchives;
