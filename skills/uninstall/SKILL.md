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

## Execution

### Step 1: Read Manifest

Read the manifest to find installed components:

```bash
cat ~/.claude/plugins/local/environment/.installed-manifest.json 2>/dev/null || echo "No manifest found"
```

If manifest doesn't exist, use fallback paths:
- Plugin: `~/.claude/plugins/local/environment`
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

### Step 4: Remove Plugin Directory

Remove the entire plugin directory:

```bash
rm -rf ~/.claude/plugins/local/environment
```

### Step 5: Confirm Removal

Report what was removed:

```
environment plugin has been uninstalled.

Removed:
- Skill: /environment:ui
- Skill: /environment:uninstall
- Skill: /environment:screenshots
- Plugin directory: ~/.claude/plugins/local/environment

To reinstall, run the installer again:
  ./install.sh --fresh
```

## Warning

This action is irreversible. All plugin files will be permanently deleted.
