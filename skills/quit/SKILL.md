---
name: environment:quit
description: Stop the Environment Dashboard server
allowed-tools: Bash(lsof *), Bash(kill *), Bash(curl *)
---

# Stop Environment Dashboard

Stop the running Environment Dashboard server.

## Instructions

1. Check if the environment server is running on port 3848
2. If running, kill the process
3. Confirm shutdown
4. If not running, report that it's already stopped

## Plugin Root

Before executing commands, determine the plugin installation directory:
1. Read `~/.claude/plugins/installed_plugins.json`
2. Find the entry with key starting with `environment@`
3. Use its `installPath` value as `PLUGIN_DIR` in all commands below

## Execution

Check if the server is running:

```bash
lsof -i :3848 | grep LISTEN
```

If running, kill the server process:

```bash
lsof -ti :3848 | xargs kill
```

Verify it stopped:

```bash
lsof -i :3848 | grep LISTEN
```

## Success Response

If the server was running and stopped:

```
Environment Dashboard server stopped.
```

If the server was not running:

```
Environment Dashboard server is not running.
```
