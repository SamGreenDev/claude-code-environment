# Installation Guide

Quick guide to installing the Claude Code Environment Dashboard plugin.

## Prerequisites

- **Node.js 18+** (check with `node -v`)
- **Claude Code CLI** installed and configured
- **~/.claude/** directory must exist

## Quick Install

```bash
# Clone directly into your Claude Code plugins directory
git clone https://github.com/USERNAME/claude-code-environment.git ~/.claude/plugins/local/environment

# Navigate to the plugin directory
cd ~/.claude/plugins/local/environment

# No dependencies to install! Ready to use.
```

**Replace USERNAME** with the actual GitHub username where the repository is hosted.

## Usage

### Launch the Dashboard

**Option 1: Using Claude Code CLI**
```bash
# In your Claude Code session, use the skill:
/environment:ui
```

**Option 2: Manual Start**
```bash
cd ~/.claude/plugins/local/environment
npm start

# Then open in browser:
# http://localhost:3848
```

### Other Skills

```bash
# Generate PDF screenshots of all UI pages
/environment:screenshots

# Uninstall the plugin completely
/environment:uninstall
```

## Custom Configuration

### Change Server Port

```bash
PORT=4000 npm start
```

Or set in your environment:
```bash
export PORT=4000
npm start
```

### Development Mode (with auto-reload)

```bash
npm run dev
```

## Upgrading

To upgrade to a newer version:

```bash
cd ~/.claude/plugins/local/environment
git pull origin main
npm start
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using the port
lsof -i :3848

# Kill it or use a different port
PORT=3849 npm start
```

### Permission Denied

Ensure your ~/.claude directory exists and is readable:
```bash
ls -la ~/.claude/
```

### No Data Showing

Verify your Claude Code configuration:
```bash
ls ~/.claude/agents/
ls ~/.claude/settings.json
```

### Server Won't Start

Check Node.js version:
```bash
node -v  # Should be 18.0.0 or higher
```

## Verification

After installation, verify the plugin is working:

1. Start the server: `npm start`
2. Open browser: http://localhost:3848
3. You should see the dashboard with your environment stats
4. Try clicking through different sections (Agents, Skills, Knowledge, etc.)

## Uninstalling

### Using the Skill
```bash
/environment:uninstall
```

### Manual Removal
```bash
rm -rf ~/.claude/plugins/local/environment
rm -rf ~/.claude/skills/environment:*
```

## Getting Help

- **GitHub Issues**: https://github.com/USERNAME/claude-code-environment/issues
- **Documentation**: See README.md
- **Email**: samuel.green2k@gmail.com

## What's Included

After installation, you'll have:

- **Web Dashboard** - Visual interface at http://localhost:3848
- **REST API** - 25+ endpoints for environment data
- **3 Skills**:
  - `/environment:ui` - Launch dashboard
  - `/environment:screenshots` - Generate PDF screenshots
  - `/environment:uninstall` - Remove plugin
- **Zero Dependencies** - No npm packages to install

## System Requirements

| Requirement | Version |
|------------|---------|
| Node.js | 18.0.0+ |
| npm | 9.0.0+ (bundled with Node) |
| Disk Space | ~2 MB |
| Claude Code | Any version |

## Features Available After Install

Once installed and running, you can explore:

- **Dashboard** - Environment stats and health
- **Agents** - View all sub-agent definitions
- **Skills** - Browse available skills with descriptions
- **Commands** - Quick slash commands reference
- **Knowledge** - File tree of your knowledge base
- **Rules** - Coding standards and guidelines
- **Memory** - Issue tracking system timeline
- **Settings** - Hooks and configuration viewer

## Next Steps

1. Install the plugin using the commands above
2. Launch with `/environment:ui`
3. Explore your Claude Code environment visually
4. Use as a reference while coding

Enjoy your new visual dashboard!
