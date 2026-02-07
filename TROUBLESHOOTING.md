# Troubleshooting Guide

Common issues encountered with the Environment Dashboard plugin and how to resolve them.

---

## Issue: Failed Rebase with Merge Conflicts

### Symptoms

- Running `git pull` results in `interactive rebase in progress`
- Multiple conflicted files (potentially all tracked files)
- Git status shows 14+ conflicted files with remaining commits to replay

### Root Cause

The local branch has its own commit lineage (e.g., v1.0.2 enhancements) while the remote has a different lineage (e.g., v1.1.0 release). Since both lineages modified the same files, every file ends up with merge conflicts during rebase.

### Affected Files

All tracked files can be affected, including:

- `package.json`, `server.js`
- `lib/api-handlers.js`, `lib/config-reader.js`, `lib/plugin-reader.js`
- `public/app.js`, `public/index.html`, `public/styles.css`
- `.claude-plugin/plugin.json`, `.gitignore`, `README.md`
- `skills/screenshots/SKILL.md`, `skills/ui/SKILL.md`, `skills/uninstall/SKILL.md`

### Resolution

Abort the rebase and reset to the upstream version:

```bash
cd ~/.claude/plugins/local/environment
git rebase --abort
git fetch origin
git reset --hard origin/main
npm install
```

---

## Issue: Invalid package.json (Server Fails to Start)

### Symptoms

- `ERR_INVALID_PACKAGE_CONFIG` when running `node server.js`
- Error message: `Error: Invalid package config /Users/greensb/.claude/plugins/local/environment/package.json`

### Root Cause

Merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) inside `package.json` make it invalid JSON. Node.js cannot parse the package config.

### Resolution

Check for conflict markers in `package.json`:

```bash
grep -c "<<<<<<" package.json
```

If conflicts are present, either:

1. **Manual fix**: Edit `package.json` to remove conflict markers and keep the correct version
2. **Full reset** (recommended): Follow the steps in the rebase resolution above

---

## Issue: Missing Files After Partial Conflict Resolution

### Symptoms

- Server starts but v1.1.0 features do not work
- Missing files such as `activity-handler.js`, `session-handler.js`, `jedi-archives.js`, `router.js`
- Missing directories such as `hooks/`

### Root Cause

The v1.1.0 release added many new files that did not exist in the v1.0.2 lineage. A stuck rebase prevents these files from being added to the working tree.

### Resolution

A full reset or clean install is required. See the fix procedures below.

---

## Fix Procedures

### Quick Fix (Rebase in Progress)

Use this if you are currently stuck in a rebase:

```bash
cd ~/.claude/plugins/local/environment

# 1. Abort the stuck rebase
git rebase --abort

# 2. Ensure remote is configured
git remote add upstream https://github.com/SamGreenDev/claude-code-environment.git 2>/dev/null || true

# 3. Fetch latest and reset
git fetch upstream
git reset --hard upstream/main

# 4. Install dependencies (v1.1.0 requires the ws package)
npm install

# 5. Verify
node server.js
```

### Clean Install (Recommended)

Use this for the most reliable result, especially on a second computer:

```bash
# 1. Remove the existing installation
rm -rf ~/.claude/plugins/local/environment

# 2. Clone fresh from upstream
git clone https://github.com/SamGreenDev/claude-code-environment.git ~/.claude/plugins/local/environment

# 3. Install dependencies
cd ~/.claude/plugins/local/environment
npm install

# 4. Verify
node server.js
```

### Copy from Upstream Clone

Use this if you already have the upstream repo cloned elsewhere:

```bash
cd ~/.claude/plugins/local/environment

# 1. Abort any in-progress rebase
git rebase --abort 2>/dev/null || true

# 2. Copy upstream files (excluding .git)
rsync -av --exclude='.git' /path/to/claude-code-environment/ .

# 3. Install dependencies
npm install

# 4. Verify
node server.js

# 5. Clean up the clone directory
rm -rf /path/to/claude-code-environment/
```

---

## Prevention

To avoid these issues when updating the plugin:

| Approach | Command | Notes |
|----------|---------|-------|
| **Merge instead of rebase** | `git pull --rebase=false` | Avoids per-commit conflict resolution |
| **Hard reset to upstream** | `git fetch origin && git reset --hard origin/main` | Discards local changes entirely |
| **Stash local changes first** | `git stash && git pull` | Preserves local modifications |
| **Delete and re-clone** | See Clean Install above | Safest approach for plugin updates |

> **Recommendation**: For plugin updates where you have no local customizations to preserve, the safest approach is to delete and re-clone.

---

## Verification Checklist

After applying any fix, verify that the installation is working correctly:

- [ ] `node server.js` starts without errors
- [ ] Dashboard loads at http://localhost:3848
- [ ] Activity page loads at http://localhost:3848/#/activity
- [ ] `package.json` shows version 1.1.0
- [ ] `ls lib/` includes `activity-handler.js`, `router.js`, `session-handler.js`
- [ ] `ls public/` includes `jedi-archives.js`
- [ ] `ls hooks/` includes `emit-activity.sh`, `emit-session.sh`
