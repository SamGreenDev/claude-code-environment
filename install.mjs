#!/usr/bin/env node
// Environment Plugin Installer (Node.js 18+ ESM)
// Cross-platform: Windows/macOS/Linux

import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { homedir, tmpdir } from 'os';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPONENT_NAME = 'environment';
const COMPONENT_TYPE = 'plugin';
const COMPONENT_VERSION = '1.1.0';

const HOME = homedir();
const TARGET_DIR = join(HOME, '.claude', 'plugins', 'local', COMPONENT_NAME);
const SKILLS_DIR = join(HOME, '.claude', 'skills');
const COMMANDS_DIR = join(HOME, '.claude', 'commands');
const SCRIPT_DIR = __dirname;

let BACKUP_DIR = '';
let DRY_RUN = false;

// Colors (ANSI)
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const BLUE = '\x1b[0;34m';
const NC = '\x1b[0m';

const info    = (msg) => console.log(`${BLUE}[INFO]${NC} ${msg}`);
const success = (msg) => console.log(`${GREEN}[OK]${NC} ${msg}`);
const warn    = (msg) => console.log(`${YELLOW}[WARN]${NC} ${msg}`);
const error   = (msg) => console.log(`${RED}[ERROR]${NC} ${msg}`);

function usage() {
  console.log(`
Usage: node install.mjs [OPTIONS]

Install, update, or manage the ${COMPONENT_NAME} ${COMPONENT_TYPE} (v${COMPONENT_VERSION}).

Options:
  --fresh       Fresh install (fails if already installed)
  --update      Update existing installation
  --force       Force install (overwrites existing)
  --repair      Repair installation (reinstall without removing config)
  --uninstall   Remove the plugin completely
  --dry-run     Show what would happen without making changes
  --init-git    Initialize git repository in plugin directory
  --help        Show this help message

If no options are given, interactive mode is used.
`);
  process.exit(0);
}

function checkExisting() {
  return existsSync(TARGET_DIR) &&
    (existsSync(join(TARGET_DIR, 'package.json')) || existsSync(join(TARGET_DIR, '.claude-plugin', 'plugin.json')));
}

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function createBackup() {
  if (existsSync(TARGET_DIR)) {
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    BACKUP_DIR = join(tmpdir(), `${COMPONENT_NAME}-backup-${ts}`);
    if (DRY_RUN) {
      info(`[DRY RUN] Would backup ${TARGET_DIR} to ${BACKUP_DIR}`);
      return;
    }
    info(`Creating backup at ${BACKUP_DIR}`);
    copyDirRecursive(TARGET_DIR, BACKUP_DIR);
    success('Backup created');
  }
}

function restoreBackup() {
  if (BACKUP_DIR && existsSync(BACKUP_DIR)) {
    warn('Restoring from backup...');
    rmSync(TARGET_DIR, { recursive: true, force: true });
    copyDirRecursive(BACKUP_DIR, TARGET_DIR);
    success('Backup restored');
  }
}

function getPluginConfig() {
  const pluginJson = join(SCRIPT_DIR, '.claude-plugin', 'plugin.json');
  if (!existsSync(pluginJson)) return null;
  return JSON.parse(readFileSync(pluginJson, 'utf8'));
}

function installSkills() {
  const pluginConfig = getPluginConfig();
  if (!pluginConfig || !pluginConfig.skills) {
    warn('No plugin.json or skills found, skipping skill installation');
    return;
  }

  mkdirSync(SKILLS_DIR, { recursive: true });

  // Clean up old-style skills without namespace prefix
  for (const skill of pluginConfig.skills) {
    const oldDir = join(SKILLS_DIR, skill.name);
    if (existsSync(oldDir) && existsSync(join(oldDir, 'SKILL.md'))) {
      try {
        const content = readFileSync(join(oldDir, 'SKILL.md'), 'utf8');
        if (content.includes(COMPONENT_NAME)) {
          if (DRY_RUN) {
            info(`[DRY RUN] Would remove old-style skill: ${oldDir}`);
          } else {
            info(`Removing old-style skill: ${skill.name}`);
            rmSync(oldDir, { recursive: true, force: true });
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Install namespaced skills
  for (const skill of pluginConfig.skills) {
    const srcDir = join(SCRIPT_DIR, 'skills', skill.name);
    const destDir = join(SKILLS_DIR, `${COMPONENT_NAME}:${skill.name}`);

    if (!existsSync(srcDir)) {
      warn(`Skill source not found: ${srcDir}`);
      continue;
    }

    if (DRY_RUN) {
      info(`[DRY RUN] Would install skill: ${COMPONENT_NAME}:${skill.name}`);
      continue;
    }

    info(`Installing skill: ${COMPONENT_NAME}:${skill.name}`);
    rmSync(destDir, { recursive: true, force: true });
    copyDirRecursive(srcDir, destDir);

    // Patch SKILL.md frontmatter name field
    const skillMd = join(destDir, 'SKILL.md');
    if (existsSync(skillMd)) {
      let content = readFileSync(skillMd, 'utf8');
      content = content.replace(/^name:.*$/m, `name: ${COMPONENT_NAME}:${skill.name}`);
      writeFileSync(skillMd, content, 'utf8');
    }

    success(`Installed skill: ${COMPONENT_NAME}:${skill.name}`);
  }
}

function installCommands() {
  const cmdSrc = join(SCRIPT_DIR, 'commands');
  if (!existsSync(cmdSrc)) return;

  let entries;
  try {
    entries = readdirSync(cmdSrc);
  } catch { return; }

  if (entries.length === 0) return;

  mkdirSync(COMMANDS_DIR, { recursive: true });

  for (const fname of entries) {
    const srcPath = join(cmdSrc, fname);
    if (!statSync(srcPath).isFile()) continue;

    if (DRY_RUN) {
      info(`[DRY RUN] Would install command: ${fname}`);
    } else {
      info(`Installing command: ${fname}`);
      copyFileSync(srcPath, join(COMMANDS_DIR, fname));
      success(`Installed command: ${fname}`);
    }
  }
}

const SKIP_FILES = new Set([
  'install', 'install.sh', 'install.mjs', 'install.cmd',
  'INSTALL.md', 'DEPLOY_NOW.md', 'DEPLOYMENT_INSTRUCTIONS.md', 'node_modules'
]);

function doInstall() {
  if (DRY_RUN) {
    info(`[DRY RUN] Would install to ${TARGET_DIR}`);
    info('[DRY RUN] Would run npm install --production');
    installSkills();
    installCommands();
    info('[DRY RUN] Would create .installed-manifest.json');
    success('[DRY RUN] Install simulation complete');
    return;
  }

  info(`Installing ${COMPONENT_NAME} ${COMPONENT_TYPE} v${COMPONENT_VERSION}...`);

  mkdirSync(TARGET_DIR, { recursive: true });

  // Copy files
  for (const entry of readdirSync(SCRIPT_DIR)) {
    if (SKIP_FILES.has(entry) || entry.startsWith('.')) continue;
    const src = join(SCRIPT_DIR, entry);
    const dest = join(TARGET_DIR, entry);
    const stat = statSync(src);
    if (stat.isDirectory()) {
      copyDirRecursive(src, dest);
    } else {
      copyFileSync(src, dest);
    }
  }

  // npm install
  info('Installing dependencies...');
  try {
    execSync('npm install --production --silent', { cwd: TARGET_DIR, stdio: 'pipe' });
  } catch {
    try {
      execSync('npm install --production', { cwd: TARGET_DIR, stdio: 'inherit' });
    } catch {
      warn('npm install failed or npm not found, skipping dependency installation');
    }
  }

  installSkills();
  installCommands();

  // Create manifest
  const manifest = {
    name: COMPONENT_NAME,
    type: COMPONENT_TYPE,
    version: COMPONENT_VERSION,
    installedAt: new Date().toISOString(),
    targetDir: TARGET_DIR,
    skillsDir: SKILLS_DIR,
    commandsDir: COMMANDS_DIR
  };
  writeFileSync(join(TARGET_DIR, '.installed-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  success(`${COMPONENT_NAME} ${COMPONENT_TYPE} v${COMPONENT_VERSION} installed successfully!`);
}

function doUninstall() {
  info(`Uninstalling ${COMPONENT_NAME} ${COMPONENT_TYPE}...`);

  if (DRY_RUN) {
    info(`[DRY RUN] Would remove skills with prefix ${COMPONENT_NAME}:`);
    info(`[DRY RUN] Would remove ${TARGET_DIR}`);
    success('[DRY RUN] Uninstall simulation complete');
    return;
  }

  // Remove namespaced skills
  if (existsSync(SKILLS_DIR)) {
    for (const entry of readdirSync(SKILLS_DIR)) {
      if (entry.startsWith(`${COMPONENT_NAME}:`)) {
        const skillDir = join(SKILLS_DIR, entry);
        info(`Removing skill: ${entry}`);
        rmSync(skillDir, { recursive: true, force: true });
      }
    }
  }

  // Remove plugin directory
  if (existsSync(TARGET_DIR)) {
    rmSync(TARGET_DIR, { recursive: true, force: true });
    success(`Removed ${TARGET_DIR}`);
  }

  success(`${COMPONENT_NAME} ${COMPONENT_TYPE} uninstalled`);
}

function doInitGit() {
  if (!existsSync(TARGET_DIR)) {
    error('Plugin not installed. Install first.');
    process.exit(1);
  }

  if (DRY_RUN) {
    info(`[DRY RUN] Would initialize git repo in ${TARGET_DIR}`);
    return;
  }

  if (existsSync(join(TARGET_DIR, '.git'))) {
    warn('Git repository already exists');
    return;
  }

  execSync('git init', { cwd: TARGET_DIR, stdio: 'inherit' });

  writeFileSync(join(TARGET_DIR, '.gitignore'), `node_modules/
.DS_Store
*.log
.env
.env.*
`, 'utf8');

  execSync('git add -A', { cwd: TARGET_DIR, stdio: 'inherit' });
  execSync(`git commit -m "chore: initial commit of ${COMPONENT_NAME} plugin v${COMPONENT_VERSION}"`, { cwd: TARGET_DIR, stdio: 'inherit' });
  success(`Git repository initialized in ${TARGET_DIR}`);
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function interactiveMode() {
  if (checkExisting()) {
    let existingVersion = 'unknown';
    try {
      const pluginJson = JSON.parse(readFileSync(join(TARGET_DIR, '.claude-plugin', 'plugin.json'), 'utf8'));
      existingVersion = pluginJson.version || 'unknown';
    } catch { /* ignore */ }

    console.log(`\n${BLUE}Existing installation detected${NC} (v${existingVersion})`);
    console.log(`  Bundle version: ${GREEN}v${COMPONENT_VERSION}${NC}\n`);
    console.log('  1) Update');
    console.log('  2) Repair');
    console.log('  3) Uninstall');
    console.log('  4) Cancel\n');

    const choice = await prompt('Choose [1-4]: ');
    switch (choice) {
      case '1':
      case '2':
        createBackup();
        try { doInstall(); } catch (e) { restoreBackup(); throw e; }
        break;
      case '3':
        doUninstall();
        break;
      default:
        info('Cancelled');
        process.exit(0);
    }
  } else {
    console.log(`\n${BLUE}Installing ${COMPONENT_NAME} ${COMPONENT_TYPE} v${COMPONENT_VERSION}${NC}\n`);
    doInstall();
  }
}

// Parse arguments
const args = process.argv.slice(2);
let mode = '';

for (const arg of args) {
  switch (arg) {
    case '--fresh':     mode = 'fresh'; break;
    case '--update':    mode = 'update'; break;
    case '--force':     mode = 'force'; break;
    case '--repair':    mode = 'repair'; break;
    case '--uninstall': mode = 'uninstall'; break;
    case '--dry-run':   DRY_RUN = true; break;
    case '--init-git':  mode = 'init-git'; break;
    case '--help': case '-h': usage(); break;
    default:
      error(`Unknown option: ${arg}`);
      usage();
  }
}

switch (mode) {
  case 'fresh':
    if (checkExisting()) {
      error(`Already installed at ${TARGET_DIR}. Use --update or --force.`);
      process.exit(1);
    }
    doInstall();
    break;
  case 'update':
    if (!checkExisting()) {
      error('Not installed. Use --fresh instead.');
      process.exit(1);
    }
    createBackup();
    try { doInstall(); } catch (e) { restoreBackup(); throw e; }
    break;
  case 'force':
    createBackup();
    if (!DRY_RUN && existsSync(TARGET_DIR)) {
      rmSync(TARGET_DIR, { recursive: true, force: true });
    }
    doInstall();
    break;
  case 'repair':
    createBackup();
    try { doInstall(); } catch (e) { restoreBackup(); throw e; }
    break;
  case 'uninstall':
    doUninstall();
    break;
  case 'init-git':
    doInitGit();
    break;
  case '':
    await interactiveMode();
    break;
}
