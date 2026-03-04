# Claude Code Environment Dashboard

A web-based visualization tool for exploring and managing your Claude Code configuration, featuring real-time agent activity tracking, mission orchestration, and a Jedi Archives theme.

**Plugin Name:** environment
**Author:** Sam Green
**Version:** 1.1.9

---

## Installation

### Option A: Claude Code Plugin Manager (Recommended)

1. Run `/plugin` in Claude Code
2. Go to "Marketplaces" tab
3. Select "Add Marketplace"
4. Enter: `https://github.com/SamGreenDev/claude-code-environment`
5. Go to "Discover" tab
6. Find "environment" and install

### Option B: Git Clone

```bash
git clone https://github.com/SamGreenDev/claude-code-environment.git
cd claude-code-environment
./install.sh
```

### Option C: One-liner (no prerequisites — works on a fresh Mac)

```bash
curl -fsSL https://raw.githubusercontent.com/SamGreenDev/claude-code-environment/main/bootstrap.sh | bash
```

### Option D: ZIP Bundle Download

1. Download the latest release from [GitHub Releases](https://github.com/SamGreenDev/claude-code-environment/releases)
2. Extract the ZIP file
3. Double-click `install-mac.command` (Mac) or `install-windows.bat` (Windows)

---

## Features

- **Dashboard** - Environment overview with quick stats and status indicators
- **Activity (Jedi Archives)** - Canvas-based pixel art agent visualization with real-time WebSocket updates; 6 Jedi classes (scholar, council, guardian, padawan, sentinel, consular)
- **Agents Browser** - View all sub-agents with detail modals showing full prompts
- **Skills & Commands** - Browse available skills and quick commands with descriptions
- **Knowledge Base** - File tree explorer with markdown preview for all knowledge files
- **Rules Viewer** - Read coding standards, security rules, and workflow guidelines
- **Memory Inspector** - Per-project MEMORY.md viewer with cross-project search
- **Settings Manager** - View and manage hooks, environment variables, and project-level config
- **Plugins** - Installed plugin browser with metadata
- **MCP Servers** - MCP server configuration viewer
- **Mission Builder** - Visual DAG workflow editor for designing multi-agent missions, with drag-and-drop node graph, faction theming (Star Wars eras), and AI-powered Mission Wizard
- **Holonet Command** - Live mission execution monitoring with canvas DAG visualization, real-time status updates, and comms panel
- **Comms Log** - Star Wars terminal-style communication log for mission runs with CRT aesthetic
- **Projects** - Dev server process manager (start/stop/logs) with real-time output streaming

## Usage

Invoke via: `/environment:ui` to launch the dashboard

---

## Architecture Overview

```
Browser (SPA)  ──HTTP/WS──>  Node.js Server (port 3848)  ──File I/O──>  ~/.claude/
```

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (SPA)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ index.html (22 templates) + app.js (router/state)   │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   NODE.JS SERVER                            │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │  server.js   │  │   router.js   │  │ api-handlers   │   │
│  │  (HTTP+WS)   │  │ (URL match)   │  │  (48+ routes)  │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ mission-engine │ activity-handler │ session-handler  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ File I/O
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    FILESYSTEM                               │
│  ~/.claude/                                                 │
│    ├── agents/        ├── skills/       ├── commands/      │
│    ├── knowledge/     ├── rules/        ├── memory/        │
│    └── settings.json                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
environment/
├── server.js              # HTTP + WebSocket server (auto-shutdown 30min)
├── package.json           # ES module, ws dependency
├── README.md
├── .claude-plugin/
│   ├── plugin.json        # Plugin manifest
│   └── marketplace.json   # Marketplace metadata
├── skills/
│   ├── ui/                # /environment:ui - Launch dashboard
│   ├── screenshots/       # /environment:screenshots - Generate PDF
│   ├── uninstall/         # /environment:uninstall - Remove plugin
│   ├── quit/              # /environment:quit - Stop server
│   └── restart/           # /environment:restart - Restart server
├── hooks/
│   ├── hooks.json         # Hook definitions (5 hooks)
│   ├── emit-session.sh    # Session register/deregister
│   └── emit-activity.sh   # Agent spawn/complete events
├── lib/
│   ├── router.js          # URL pattern matching
│   ├── api-handlers.js    # Core REST endpoints (30+)
│   ├── config-reader.js   # Settings & config parsing
│   ├── agent-parser.js    # Markdown agent/skill/command parsing
│   ├── plugin-reader.js   # Plugin discovery
│   ├── mcp-reader.js      # MCP server config
│   ├── memory-reader.js   # Per-project memory reader
│   ├── stats-reader.js    # Token usage statistics
│   ├── activity-handler.js # WebSocket + agent state management
│   ├── session-handler.js # CLI session tracking
│   ├── team-scanner.js    # tmux teammate discovery
│   ├── team-watcher.js    # Team membership polling
│   ├── mission-engine.js  # DAG-based mission orchestration
│   ├── mission-store.js   # Mission persistence
│   ├── mission-state.js   # Run status constants
│   ├── mission-api-handler.js # Mission REST + WebSocket
│   ├── project-api-handler.js # Dev server management API
│   ├── project-memory-reader.js # Project-specific memory
│   ├── project-server-manager.js # Dev server process manager
│   ├── wizard-api-handler.js # Mission wizard endpoint
│   ├── wizard-recommendation-engine.js # AI recommendations
│   ├── paths.js           # Shared path constants
│   ├── open-in-browser.sh # macOS browser launcher
│   └── provider/          # Mission execution providers
│       ├── base-provider.js
│       ├── claude-code-provider.js
│       └── provider-registry.js
└── public/
    ├── index.html         # SPA shell + 22 templates
    ├── app.js             # Client router & rendering (~2900 lines)
    ├── styles.css         # Oracle Redwood dark theme (~4900 lines)
    ├── jedi-archives.js   # Canvas pixel art agent visualization
    ├── faction-data.js    # Star Wars faction/unit data
    ├── mission-builder.js # Visual DAG workflow editor
    ├── mission-wizard.js  # AI team recommendation chat
    ├── holonet-command.js # Live mission monitoring
    ├── comms-log.js       # Terminal-style comms log
    └── vendor/
        ├── marked.min.js  # Markdown parser
        └── leader-line.min.js # SVG line drawing
```

---

## Prerequisites

- **Node.js 18+** (uses ES modules)
- **Claude Code installation** (~/.claude/ directory must exist)

---

## Manual Setup (Advanced)

If you installed via ZIP bundle and want to run the server manually:

```bash
# Navigate to plugin directory
cd ~/.claude/plugins/local/environment

# Start server manually (or use /environment:ui skill)
npm start
```

### With Custom Port

```bash
PORT=4000 npm start
```

### Upgrading (Reinstall)

If you have a previous installation, remove or overwrite it:

```bash
# Option 1: Remove old installation first (recommended)
rm -rf ~/.claude/plugins/local/environment
# Then reinstall using any method above

# Option 2: Overwrite in place (for ZIP installs)
unzip -o environment-plugin.zip -d ~/.claude/plugins/local/
```

> **Note:** Your Claude Code configuration (agents, skills, settings, etc.) is stored outside the plugin directory and will not be affected.

---

## Usage

1. Start the server with `npm start` or `/environment:ui`
2. Open **http://localhost:3848** in your browser
3. Click the **Claude Code** logo to return to dashboard from any page
4. Navigate using the top navigation links:
   - **Dashboard** - Overview stats
   - **Activity** - Jedi Archives agent visualization
   - **Agents** - Sub-agent definitions
   - **Skills** - Available skills and commands
   - **Knowledge** - Knowledge base files
   - **Rules** - Coding standards
   - **Memory** - Per-project memory inspector
   - **Settings** - Hooks and configuration
   - **Plugins** - Installed plugin browser
   - **MCP** - MCP server config
   - **Missions** - Mission builder and Holonet Command
   - **Projects** - Dev server manager
5. Click **"View Details"** buttons on cards to see full content in modals

---

## API Endpoints

### Core

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/overview` | GET | Dashboard stats (counts, status) |
| `/api/settings` | GET/PUT | User-level settings |
| `/api/claude-md` | GET | CLAUDE.md content |
| `/api/agents` | GET | List all agents with metadata |
| `/api/agents/:id` | GET | Single agent full content |
| `/api/skills` | GET | List all skills |
| `/api/skills/:id` | GET | Single skill details |
| `/api/commands` | GET | List all commands |
| `/api/rules` | GET | List all rule files |
| `/api/hooks` | GET | Configured hooks list |
| `/api/hooks/:id/toggle` | PUT | Toggle a hook on/off |
| `/api/hooks/group/:type/:id/toggle` | PUT | Toggle hook group |
| `/api/settings/env/:key` | PUT/DELETE | Manage environment variables |
| `/api/plugins` | GET | Installed plugin browser |
| `/api/mcp-servers` | GET | MCP server configuration |

### Memory

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/memory` | GET | Memory system overview |
| `/api/memory/search` | GET | Cross-project memory search |
| `/api/memory/project/:id` | GET | Per-project MEMORY.md |

### Project Config

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/project` | GET/PUT | Active project path |
| `/api/project/settings` | GET/PUT | Project-level settings |
| `/api/project/hooks` | GET | Project hooks list |
| `/api/project/hooks/:id/toggle` | PUT | Toggle project hook |
| `/api/project/env/:key` | GET/PUT/DELETE | Project environment variables |

### Agent Activity

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/activity/spawn` | POST | Register agent spawn |
| `/api/activity/complete` | POST | Mark agent complete |
| `/api/activity/metadata` | POST | Update agent metadata |
| `/api/activity/task` | POST | Agent task update |
| `/api/activity/agents` | GET | List active agents |
| `/api/activity/agents/:id` | GET | Single agent state |
| `/api/activity/agents` | DELETE | Clear all agents |
| `/api/activity/agents/:id` | DELETE | Remove specific agent |

### Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List CLI sessions |
| `/api/sessions/:id` | GET | Single session details |
| `/api/sessions/scan` | GET | Scan for active sessions |
| `/api/sessions/register` | POST | Register new session |
| `/api/sessions/:id/heartbeat` | POST | Session keepalive |
| `/api/sessions/:id/activity` | POST | Session activity update |
| `/api/sessions/:id/label` | PUT | Set session label |
| `/api/sessions/:id` | DELETE | Deregister session |

### Missions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/missions` | GET/POST | List or create missions |
| `/api/missions/:id` | GET/PUT/DELETE | Mission CRUD |
| `/api/missions/:id/run` | POST | Start a mission run |
| `/api/missions/runs` | GET | List all runs |
| `/api/missions/runs/:id` | GET | Single run details |
| `/api/missions/runs/:id/progress` | GET | Run progress |
| `/api/missions/runs/:id/summary` | GET | Run completion summary |
| `/api/missions/runs/:id/abort` | POST | Abort a running mission |
| `/api/missions/runs/:id/retry/:nodeId` | POST | Retry a failed node |
| `/api/missions/runs/:id/messages` | GET/POST | Run inter-node messages |
| `/api/missions/runs/:id/launch` | POST | Launch a run |
| `/api/missions/runs/:id` | DELETE | Delete a run |
| `/api/providers` | GET | Available execution providers |
| `/api/missions/wizard` | POST | AI mission recommendation |
| `/api/open` | POST | Open file in editor |

### Dev Servers (Projects)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET/POST | List or create dev servers |
| `/api/projects/:id` | PUT/DELETE | Update or remove dev server |
| `/api/projects/:id/start` | POST | Start dev server |
| `/api/projects/:id/stop` | POST | Stop dev server |
| `/api/projects/:id/logs` | GET | Dev server output |

---

## WebSocket Endpoints

| Path | Purpose |
|------|---------|
| `/ws/activity` | Real-time agent lifecycle events (spawn, complete, metadata) |
| `/ws/sessions` | CLI session tracking and heartbeat |
| `/ws/missions` | Mission run status and inter-node messaging |
| `/ws/projects` | Dev server output streaming |

---

## Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| ui | `/environment:ui` | Launch dashboard in browser |
| screenshots | `/environment:screenshots` | Generate PDF of all pages |
| uninstall | `/environment:uninstall` | Remove plugin completely |
| quit | `/environment:quit` | Stop the dashboard server |
| restart | `/environment:restart` | Restart the dashboard server |

---

## Hooks

The plugin wires 5 Claude Code hooks for real-time tracking:

| Event | Matcher | Purpose |
|-------|---------|---------|
| SessionStart | — | Register CLI session |
| PreToolUse | Task | Capture agent task metadata |
| SubagentStart | — | Track agent spawn |
| SubagentStop | — | Track agent completion |
| SessionEnd | — | Deregister CLI session |

Hook scripts use `${CLAUDE_PLUGIN_ROOT}` for portable paths and must use the nested `{ hooks: [...] }` format.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3848` | Server port number |

### Auto-Shutdown

The server automatically shuts down after **30 minutes of inactivity** to conserve resources. Restart with `npm start` or `/environment:restart` when needed.

### Settings Source

The dashboard reads configuration from:
- `~/.claude/settings.json` - User-level settings
- `~/.claude/settings.local.json` - Local overrides (not tracked in git)

---

## Design

The UI uses the **Oracle Redwood dark theme** with optional light mode:

- Background: `#0d0d0d`
- Cards: `#1a1a1a`
- Accent: `#C74634` (Oracle Red)
- Text: `#F5F5F5`
- Fonts: JetBrains Mono (mono), IBM Plex Sans (body)

The **Jedi Archives** activity view uses a canvas-based pixel art renderer with 6 agent classes: scholar, council, guardian, padawan, sentinel, and consular.

---

## Dependencies

- **`ws`** (^8.0.0) - WebSocket server for real-time features
- All other server modules use native Node.js APIs (`http`, `fs`, `path`, `child_process`)
- Client-side: `marked.min.js` (markdown rendering), `leader-line.min.js` (SVG connector lines)

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3848

# Kill it or use different port
PORT=3849 npm start
```

### Permission Denied

Ensure the ~/.claude directory exists and is readable:

```bash
ls -la ~/.claude/
```

### No Data Showing

Verify your Claude Code configuration exists:

```bash
ls ~/.claude/agents/
ls ~/.claude/settings.json
```

### Agents Not Appearing in Jedi Archives

Ensure the plugin hooks are active. Run `/doctor` to check hook registration status. The SubagentStart/Stop hooks must be enabled for real-time agent tracking.

---

## License

MIT License - Feel free to modify and distribute.
