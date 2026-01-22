# Uninstall Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `/env-ui:uninstall` command that cleanly removes all plugin components using a tracked manifest.

**Architecture:** Installation creates `.installed-manifest.json` tracking all installed paths. Uninstall skill reads manifest, stops server, removes files in reverse order (commands → skills → plugin dir).

**Tech Stack:** Bash, Node.js (for manifest generation), Claude Code skills

---

### Task 1: Create Uninstall Skill

**Files:**
- Create: `~/.claude/plugins/local/env-ui/skills/uninstall/SKILL.md`

**Step 1: Create skill directory**

```bash
mkdir -p ~/.claude/plugins/local/env-ui/skills/uninstall
```

**Step 2: Write SKILL.md**

```markdown
---
name: uninstall
description: Completely remove env-ui plugin and all installed components
allowed-tools: Bash(lsof *), Bash(kill *), Bash(rm -rf *), Bash(rm *), Bash(cat *), Read
---

# Uninstall env-ui Plugin

Completely remove the env-ui plugin and all its installed components.

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
cat ~/.claude/plugins/local/env-ui/.installed-manifest.json
```

If manifest doesn't exist, use fallback paths:
- Plugin: `~/.claude/plugins/local/env-ui`
- Skill: `~/.claude/skills/env-ui:ui`
- Command: `~/.claude/commands/env-ui.md`

### Step 2: Stop Running Server

Check if server is running and stop it:

```bash
lsof -ti :3848 | xargs kill 2>/dev/null || true
```

### Step 3: Remove Installed Commands

Remove each command listed in manifest:

```bash
rm -f ~/.claude/commands/env-ui.md
```

### Step 4: Remove Installed Skills

Remove each skill directory listed in manifest:

```bash
rm -rf ~/.claude/skills/env-ui:ui
rm -rf ~/.claude/skills/env-ui:uninstall
```

### Step 5: Remove Plugin Directory

Remove the entire plugin directory:

```bash
rm -rf ~/.claude/plugins/local/env-ui
```

### Step 6: Confirm Removal

Report what was removed:

```
env-ui plugin has been uninstalled.

Removed:
- Command: /env-ui
- Skill: /env-ui:ui
- Skill: /env-ui:uninstall
- Plugin directory: ~/.claude/plugins/local/env-ui

To reinstall, run the installer again:
  ./install.sh --fresh
```

## Warning

This action is irreversible. All plugin files will be permanently deleted.
```

**Step 3: Verify file created**

```bash
cat ~/.claude/plugins/local/env-ui/skills/uninstall/SKILL.md | head -5
```

Expected: Shows frontmatter starting with `---`

**Step 4: Commit**

```bash
cd ~/.claude/plugins/local/env-ui
git add skills/uninstall/SKILL.md
git commit -m "feat: add uninstall skill"
```

---

### Task 2: Update marketplace.json

**Files:**
- Modify: `~/.claude/plugins/local/env-ui/marketplace.json`

**Step 1: Update marketplace.json to include uninstall skill**

Add the uninstall skill to the skills array:

```json
{
  "name": "env-ui",
  "version": "1.0.2",
  "description": "Visual dashboard for viewing and configuring your Claude Code environment",
  "author": "Sam Green",
  "license": "MIT",
  "skills": [
    {
      "name": "ui",
      "path": "skills/ui/SKILL.md",
      "description": "Launch the Environment Dashboard web UI"
    },
    {
      "name": "uninstall",
      "path": "skills/uninstall/SKILL.md",
      "description": "Completely remove env-ui plugin and all installed components"
    }
  ],
  "commands": [
    {
      "name": "env-ui",
      "path": "commands/env-ui.md",
      "description": "Launch the Environment Dashboard (alias for /env-ui:ui)"
    }
  ]
}
```

**Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('$HOME/.claude/plugins/local/env-ui/marketplace.json'))" && echo "Valid JSON"
```

Expected: "Valid JSON"

**Step 3: Commit**

```bash
cd ~/.claude/plugins/local/env-ui
git add marketplace.json
git commit -m "feat: add uninstall skill to marketplace"
```

---

### Task 3: Update bundle.md to Generate Manifest

**Files:**
- Modify: `~/.claude/commands/bundle.md` (lines ~455-458, after skill installation)

**Step 1: Add manifest generation code**

After the skills installation node block (around line 458), add manifest generation:

```javascript
      // Create installation manifest for clean uninstall
      if [ -f "$TARGET_DIR/marketplace.json" ] && command -v node &> /dev/null; then
        log_info "Creating installation manifest..."
        node -e "
          const fs = require('fs');
          const path = require('path');
          const marketplace = JSON.parse(fs.readFileSync('$TARGET_DIR/marketplace.json', 'utf8'));
          
          const manifest = {
            plugin: '$COMPONENT_NAME',
            version: '$COMPONENT_VERSION',
            installedAt: new Date().toISOString(),
            paths: {
              pluginDir: '$TARGET_DIR',
              skills: (marketplace.skills || []).map(s => 
                path.join('$HOME/.claude/skills', '$COMPONENT_NAME:' + s.name)
              ),
              commands: (marketplace.commands || []).map(c => 
                path.join('$HOME/.claude/commands', c.name + '.md')
              )
            }
          };
          
          fs.writeFileSync(
            path.join('$TARGET_DIR', '.installed-manifest.json'),
            JSON.stringify(manifest, null, 2)
          );
          console.log('  Created installation manifest');
        "
      fi
```

**Step 2: Verify bundle.md syntax**

```bash
head -500 ~/.claude/commands/bundle.md | tail -50
```

Expected: Shows the install section without syntax errors

**Step 3: Commit**

```bash
cd ~/.claude/commands
git add bundle.md
git commit -m "feat: generate installation manifest for plugin uninstall"
```

---

### Task 4: Test Bundle Creation

**Step 1: Create fresh bundle**

```bash
# Will use /bundle plugin env-ui command
```

**Step 2: Extract and inspect**

```bash
cd ~/Development/Exports
unzip -o plugin-env-ui-*.zip -d /tmp/test-bundle
cat /tmp/test-bundle/plugin-env-ui-*/install.sh | grep -A 30 "installation manifest"
```

Expected: Shows manifest generation code in install.sh

**Step 3: Test installation (dry run)**

```bash
cd /tmp/test-bundle/plugin-env-ui-*
./install.sh --dry-run
```

Expected: Shows what would be installed without making changes

**Step 4: Cleanup test files**

```bash
rm -rf /tmp/test-bundle
```

---

### Task 5: Install Uninstall Skill to Skills Directory

**Files:**
- Create: `~/.claude/skills/env-ui:uninstall/SKILL.md`

**Step 1: Create skill directory**

```bash
mkdir -p ~/.claude/skills/env-ui:uninstall
```

**Step 2: Copy and patch SKILL.md**

```bash
cp ~/.claude/plugins/local/env-ui/skills/uninstall/SKILL.md ~/.claude/skills/env-ui:uninstall/SKILL.md
# Patch the name field
sed -i '' 's/^name: uninstall/name: env-ui:uninstall/' ~/.claude/skills/env-ui:uninstall/SKILL.md
```

**Step 3: Verify patched name**

```bash
head -3 ~/.claude/skills/env-ui:uninstall/SKILL.md
```

Expected: Shows `name: env-ui:uninstall`

---

## Summary

After completing all tasks:

1. `/env-ui:uninstall` skill is available
2. `marketplace.json` includes the uninstall skill
3. `bundle.md` generates installation manifests
4. Future bundle installs will create `.installed-manifest.json`
5. Uninstall reads manifest for clean removal

**Test the full flow:**
1. `/bundle plugin env-ui` - creates new bundle with manifest support
2. `./install.sh --fresh` - installs and creates manifest
3. `/env-ui:uninstall` - cleanly removes everything
