# Claude Code Environment Dashboard

A web-based visualization tool for exploring and managing your Claude Code configuration.

**Plugin Name:** environment
**Author:** Sam Green

---

## Features

- **Dashboard** - Environment overview with quick stats and status indicators
- **Agents Browser** - View all sub-agents with detail modals showing full prompts
- **Skills & Commands** - Browse available skills and quick commands with descriptions
- **Knowledge Base** - File tree explorer with markdown preview for all knowledge files
- **Rules Viewer** - Read coding standards, security rules, and workflow guidelines
- **Memory Inspector** - Timeline view of issues with quick-ref index browsing
- **Settings Manager** - View and manage hooks, environment variables, and permissions

## Usage

Invoke via: `/environment:ui` to launch the dashboard

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (SPA)                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ index.html (24 templates) + app.js (router/state)   │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (JSON)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   NODE.JS SERVER                            │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │  server.js   │  │   router.js   │  │ api-handlers   │   │
│  │  (HTTP/CORS) │  │ (URL match)   │  │ (25+ routes)   │   │
│  └──────────────┘  └───────────────┘  └────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ config-reader │ agent-parser │ memory-reader         │   │
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

## Request/Response Flow

```
User Action → app.js handleRoute() → api() fetch
                                          │
                    ┌─────────────────────┘
                    ▼
              server.js (CORS)
                    │
                    ▼
              router.handle()
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   API Handler            serveStatic()
        │                       │
        ▼                       ▼
   Read ~/.claude/*      Return file
        │
        ▼
   JSON Response → app.js → Clone template → Render DOM
```

---

## File Structure

```
env-ui/  (directory name remains the same)
├── server.js              # HTTP server (auto-shutdown 30min)
├── package.json           # Zero external dependencies
├── README.md              # This file
├── marketplace.json       # Plugin metadata (name: "environment")
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest (name: "environment")
├── skills/
│   ├── ui/                # Launch dashboard (/environment:ui)
│   ├── screenshots/       # Generate PDF (/environment:screenshots)
│   └── uninstall/         # Remove plugin (/environment:uninstall)
├── lib/
│   ├── router.js          # URL pattern matching
│   ├── config-reader.js   # Settings & config parsing
│   ├── agent-parser.js    # Markdown file parsing
│   ├── memory-reader.js   # Issue tracking system
│   └── api-handlers.js    # REST endpoint handlers
└── public/
    ├── index.html         # SPA shell + 24 templates
    ├── app.js             # Client router & rendering
    ├── styles.css         # Oracle Redwood dark theme
    └── vendor/
        └── marked.min.js  # Markdown parser
```

---

## Prerequisites

- **Node.js 18+** (uses ES modules)
- **Claude Code installation** (~/.claude/ directory must exist)

---

## Installation & Setup

### Installation

Use the Claude Code plugin installer or extract manually:

```bash
# Extract to ~/.claude/plugins/local/
unzip environment-plugin.zip -d ~/.claude/plugins/local/

# Navigate to directory
cd ~/.claude/plugins/local/env-ui

# Start server manually (or use /environment:ui skill)
npm start
```

### Upgrading (Reinstall)

If you have a previous installation, remove or overwrite it:

```bash
# Option 1: Remove old installation first (recommended)
rm -rf ~/.claude/plugins/local/env-ui
unzip environment-plugin.zip -d ~/.claude/plugins/local/

# Option 2: Overwrite in place
unzip -o environment-plugin.zip -d ~/.claude/plugins/local/
```

> **Note:** The `-o` flag overwrites existing files without prompting. Your Claude Code configuration (agents, skills, settings, etc.) is stored outside the plugin directory and will not be affected.

### With Custom Port

```bash
PORT=4000 npm start
```

### Development Mode (with file watching)

```bash
npm run dev
```

---

## Usage

1. Start the server with `npm start`
2. Open **http://localhost:3848** in your browser
3. Click the **Claude Code** logo to return to dashboard from any page
4. Navigate using the top navigation links:
   - **Dashboard** - Overview stats
   - **Agents** - Sub-agent definitions
   - **Skills** - Available skills and commands
   - **Knowledge** - Knowledge base files
   - **Rules** - Coding standards
   - **Memory** - Issue tracking
   - **Settings** - Hooks and configuration
5. Click **"View Details"** buttons on cards to see full content in modals

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/overview` | GET | Dashboard stats (counts, status) |
| `/api/agents` | GET | List all agents with metadata |
| `/api/agents/:name` | GET | Single agent full content |
| `/api/skills` | GET | List all skills |
| `/api/skills/:name` | GET | Single skill details |
| `/api/commands` | GET | List all commands |
| `/api/commands/:name` | GET | Single command details |
| `/api/rules` | GET | List all rule files |
| `/api/rules/:name` | GET | Single rule content |
| `/api/knowledge` | GET | Knowledge base file tree |
| `/api/knowledge/*` | GET | Single knowledge file content |
| `/api/memory` | GET | Memory system overview |
| `/api/memory/quick-ref` | GET | Quick reference index |
| `/api/memory/issues` | GET | All tracked issues |
| `/api/settings` | GET | Full settings object |
| `/api/hooks` | GET | Configured hooks list |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3848` | Server port number |

### Auto-Shutdown

The server automatically shuts down after **30 minutes of inactivity** to conserve resources. Simply restart with `npm start` when needed.

### Settings Source

The dashboard reads configuration from:
- `~/.claude/settings.json` - User-level settings
- `~/.claude/settings.local.json` - Local overrides (not tracked in git)

---

## Design

The UI uses the **Oracle Redwood dark theme** with:
- Background: `#161616`
- Cards: `#242424`
- Accent: `#C74634` (Oracle Red)
- Text: `#F5F5F5`

---

## Zero Dependencies

This project has **no external npm dependencies**. It uses:
- Native Node.js `http`, `fs`, `path` modules
- Vanilla JavaScript for the client
- Bundled `marked.min.js` for markdown rendering

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

---

## License

MIT License - Feel free to modify and distribute.
