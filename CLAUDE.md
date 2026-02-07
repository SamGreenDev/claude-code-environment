# Environment Plugin for Claude Code

A web-based dashboard for visualizing and exploring Claude Code configuration, featuring real-time agent activity tracking with a Jedi Archives theme.

## Architecture

```
Browser (SPA)  ──HTTP/WS──>  Node.js Server (port 3848)  ──File I/O──>  ~/.claude/
```

- **Frontend**: Single-page app with hash routing, canvas-based agent visualization
- **Backend**: Native Node.js HTTP server + WebSocket, zero external deps (except `ws`)
- **Data**: Read-only access to `~/.claude/` filesystem (agents, skills, settings, etc.)

## Project Structure

```
├── server.js              # HTTP + WebSocket server entry point
├── public/                # Frontend SPA
│   ├── index.html         # App shell with 24 <template> tags
│   ├── app.js             # Router, state management, API client
│   ├── jedi-archives.js   # Canvas pixel art agent visualization
│   └── styles.css         # Oracle Redwood dark theme
├── lib/                   # Backend modules
│   ├── router.js          # URL pattern matching
│   ├── api-handlers.js    # 25+ REST endpoint handlers
│   ├── config-reader.js   # Settings & config parsing
│   ├── agent-parser.js    # Markdown agent/skill/command parsing
│   ├── activity-handler.js # WebSocket + agent state management
│   ├── session-handler.js # CLI session tracking
│   ├── plugin-reader.js   # Plugin discovery
│   ├── memory-reader.js   # Issue tracking system
│   ├── mcp-reader.js      # MCP server config
│   ├── lessons-reader.js  # Learning session data
│   └── stats-reader.js    # Statistics aggregation
├── hooks/                 # Claude Code hooks
│   ├── hooks.json         # Hook configuration (nested format)
│   ├── emit-session.sh    # Session register/deregister
│   └── emit-activity.sh   # Agent spawn/complete events
├── skills/                # Plugin skills
│   ├── ui/SKILL.md        # /environment:ui
│   ├── screenshots/SKILL.md
│   └── uninstall/SKILL.md
└── .claude-plugin/
    ├── plugin.json        # Plugin manifest
    └── marketplace.json   # Marketplace metadata
```

## Development Workflow

This plugin is developed locally and published to `@sam-green-marketplace`.

```bash
# Local dev: use claude-dev which loads via --plugin-dir
claude-dev

# Marketplace copies are DISABLED in enabledPlugins during dev
# Re-enable when publishing: set to true in ~/.claude/settings.json
```

### Key conventions

- **ES Modules**: `"type": "module"` in package.json, use `import`/`export`
- **Portable paths**: Always use `${CLAUDE_PLUGIN_ROOT}` in hooks.json, never hardcoded paths
- **Hook format**: Must use nested `{ hooks: [...] }` wrapper, NOT flat `{ type, command }`
- **Zero deps policy**: Only `ws` as external dependency; everything else is native Node.js
- **Read-only**: The dashboard never modifies user files

### Hook format reference

```json
{
  "hooks": {
    "EventType": [
      {
        "matcher": "optional-tool-matcher",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/script.sh" }
        ]
      }
    ]
  }
}
```

`matcher` goes at wrapper level (sibling to `hooks` array), not inside hook objects.

## Server Details

- **Port**: 3848 (configurable via `PORT` env var)
- **Auto-shutdown**: 30 minutes of inactivity
- **State persistence**: Agent states saved to `.agent-state.json`, restored on restart
- **CORS**: Enabled for local development

## Design System

- **Theme**: Oracle Redwood dark (`#161616` bg, `#C74634` accent)
- **Fonts**: JetBrains Mono (mono), IBM Plex Sans (sans)
- **Visualization**: Canvas-based Jedi Archives with pixel art agents

## Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| UI | `/environment:ui` | Launch dashboard in browser |
| Screenshots | `/environment:screenshots` | Generate PDF of all pages |
| Uninstall | `/environment:uninstall` | Remove plugin completely |

## Testing

No test framework currently configured. Manual verification:

1. `/environment:ui` - server starts, dashboard loads
2. Spawn agents in a session - Jedi appear in Archives view
3. Check all navigation pages render without errors
4. `/doctor` - passes with 0 plugin errors
