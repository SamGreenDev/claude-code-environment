# Uninstall Feature Design

**Date:** 2026-01-21
**Author:** Sam Green
**Status:** Approved

## Overview

Add a `/env-ui:uninstall` command that cleanly removes all components installed by the env-ui plugin.

## Problem

When users want to remove the env-ui plugin, they must manually:
1. Find and remove the plugin directory
2. Find and remove installed skills
3. Find and remove installed commands
4. Stop any running server

This is error-prone and may leave orphaned files.

## Solution

### 1. Installation Manifest

During installation, create `.installed-manifest.json` in the plugin directory:

```json
{
  "plugin": "env-ui",
  "version": "1.0.1",
  "installedAt": "2026-01-21T12:30:00Z",
  "paths": {
    "pluginDir": "~/.claude/plugins/local/env-ui",
    "skills": ["~/.claude/skills/env-ui:ui"],
    "commands": ["~/.claude/commands/env-ui.md"]
  }
}
```

### 2. Uninstall Skill

Create `skills/uninstall/SKILL.md` that:

1. Reads the manifest
2. Stops server if running (port 3848)
3. Removes commands
4. Removes skills
5. Removes plugin directory
6. Confirms what was removed

### 3. Bundle.md Updates

Update the install.sh template to generate the manifest after installing skills and commands.

## Files to Create/Modify

| File | Action |
|------|--------|
| `skills/uninstall/SKILL.md` | Create |
| `marketplace.json` | Add uninstall skill |
| `~/.claude/commands/bundle.md` | Add manifest generation |

## Testing

1. Create fresh bundle with `/bundle plugin env-ui`
2. Install to test location with `./install.sh --fresh`
3. Verify manifest exists
4. Run `/env-ui:uninstall`
5. Verify all components removed

## Risks

- If manifest is deleted/corrupted, uninstall falls back to convention-based removal
- Running server must be stopped before removing files
