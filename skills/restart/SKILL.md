---
name: environment:restart
description: Restart the Environment Dashboard server
allowed-tools: Bash(nohup *), Bash(node *), Bash(lsof *), Bash(kill *), Bash(curl *), Bash(sleep *)
---

# Restart Environment Dashboard

Stop and restart the Environment Dashboard server.

## Instructions

1. Check if the environment server is running on port 3848
2. If running, kill the process
3. Wait briefly for the port to free up
4. Start the server in background from the plugin directory
5. Verify server is responsive via health check
6. Report success or failure

## Plugin Root

Before executing commands, determine the plugin installation directory:
1. Read `~/.claude/plugins/installed_plugins.json`
2. Find the entry with key starting with `environment@`
3. Use its `installPath` value as `PLUGIN_DIR` in all commands below

## Execution

Stop the server if running:

```bash
lsof -ti :3848 | xargs kill 2>/dev/null; sleep 1
```

Start the server from the plugin directory:

```bash
PLUGIN_DIR="<installPath from installed_plugins.json>"
nohup node "$PLUGIN_DIR/server.js" > /dev/null 2>&1 &
sleep 2
```

Verify server is responsive:

```bash
curl -s http://localhost:3848/api/health
```

If health check fails, try the overview endpoint:

```bash
curl -s http://localhost:3848/api/overview | head -c 50
```

## Success Response

If the server restarted successfully:

```
Environment Dashboard restarted at http://localhost:3848
```

If the server failed to start:

```
Failed to restart Environment Dashboard. Check server logs for details.
```
