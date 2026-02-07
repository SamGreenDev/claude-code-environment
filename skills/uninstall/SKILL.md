---
name: environment:uninstall
description: Completely remove environment plugin and all installed components
allowed-tools: Bash(lsof *), Bash(kill *), Bash(rm -rf *), Bash(rm *), Bash(cat *), Read
---

# Uninstall Environment Plugin

Completely remove the environment plugin and all its installed components.

## Instructions

1. Read the installation manifest
2. Stop the server if running
3. Remove installed commands
4. Remove installed skills
5. Remove the plugin directory
6. Confirm removal

## Plugin Root

Before executing commands, determine the plugin installation directory:
1. Read `~/.claude/plugins/installed_plugins.json`
2. Find the entry with key starting with `environment@`
3. Use its `installPath` value as `PLUGIN_DIR` in all commands below

## Execution

### Step 1: Read Manifest

Read the manifest to find installed components:

```bash
PLUGIN_DIR="<installPath from installed_plugins.json>"
cat "$PLUGIN_DIR/.installed-manifest.json" 2>/dev/null || echo "No manifest found"
```

If manifest doesn't exist, use fallback paths:
- Plugin: `PLUGIN_DIR` (from installed_plugins.json)
- Skill: `~/.claude/skills/environment:ui`
- Skill: `~/.claude/skills/environment:uninstall`
- Skill: `~/.claude/skills/environment:screenshots`

### Step 2: Stop Running Server

Check if server is running and stop it:

```bash
lsof -ti :3848 | xargs kill 2>/dev/null || echo "No server running"
```

### Step 3: Remove Installed Skills

Remove each skill directory listed in manifest:

```bash
rm -rf ~/.claude/skills/environment:ui
rm -rf ~/.claude/skills/environment:uninstall
rm -rf ~/.claude/skills/environment:screenshots
```

### Step 4: Remove Plugin

Remove the plugin entry. If installed from a marketplace, use:
```
/plugin uninstall environment@sam-green-marketplace
```

If installed locally, remove the plugin directory:
```bash
rm -rf "$PLUGIN_DIR"
```

### Step 5: Confirm Removal

Report what was removed:

```
environment plugin has been uninstalled.

Removed:
- Skill: /environment:ui
- Skill: /environment:uninstall
- Skill: /environment:screenshots
- Plugin (via marketplace uninstall or directory removal)

To reinstall from marketplace:
  /plugin install environment@sam-green-marketplace
```

## Warning

This action is irreversible. All plugin files will be permanently deleted.
