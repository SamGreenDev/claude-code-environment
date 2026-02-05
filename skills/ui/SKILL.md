---
name: environment:ui
description: Launch the Environment Dashboard web UI
allowed-tools: Bash(nohup *), Bash(node *), Bash(lsof *), Bash(open *), Bash(curl *), Bash(sleep *), Bash(kill *)
---

# Environment Dashboard

Launch the visual dashboard to view and configure your Claude Code environment.

## Instructions

1. Check if the environment server is already running on port 3848
2. If not running, start the server in background from the plugin directory
3. Wait briefly for server to start (1-2 seconds)
4. Verify server is responsive via health check
5. Open the browser to http://localhost:3848
6. Report success with the URL and available pages

## Execution

First, check if the server is already running:

```bash
lsof -i :3848 | grep LISTEN
```

If not running, start the server from the plugin directory:

```bash
NODE_BIN=$(command -v node || echo "$HOME/.claude/plugins/local/environment/.node/bin/node")
nohup "$NODE_BIN" "$HOME/.claude/plugins/local/environment/server.js" > /dev/null 2>&1 &
sleep 1
```

Verify server is responsive:

```bash
curl -s http://localhost:3848/api/health
```

If health check fails, try the overview endpoint:

```bash
curl -s http://localhost:3848/api/overview | head -c 50
```

Open in default browser:

```bash
open http://localhost:3848
```

## Notes

- Server auto-shuts down after 30 minutes of inactivity
- Dashboard shows: Agents, Skills, Commands, Knowledge, Memory, Settings
- Settings page allows toggling hooks and environment variables
- All changes persist to ~/.claude/settings.json
- The dashboard reads YOUR configuration dynamically

## Pages Available

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | / | Overview with quick stats (via logo) |
| Agents | /agents | Sub-agent configurations |
| Skills | /skills | Available skills and commands |
| Rules | /rules | Coding standards and guidelines |
| Knowledge | /knowledge | Knowledge base file browser |
| Memory | /memory | Issue memory and patterns |
| Settings | /settings | Toggle hooks and env vars |
| MCP Servers | /mcp | MCP server configurations |
| Plugins | /plugins | Installed plugins and details |

## Success Response

After launching, confirm with:

```
Environment Dashboard is running at http://localhost:3848

Available pages:
- Dashboard: Overview with quick stats
- Agents: Sub-agent configurations
- Skills: Available skills and commands
- Settings: Toggle hooks and env vars
```
