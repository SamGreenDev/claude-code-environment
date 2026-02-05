#!/usr/bin/env bash
# Environment Plugin Installer (Bash)
# Compatible with Bash 3.2+ (macOS default)

set -euo pipefail

COMPONENT_NAME="environment"
COMPONENT_TYPE="plugin"
COMPONENT_VERSION="1.1.0"

TARGET_DIR="$HOME/.claude/plugins/local/$COMPONENT_NAME"
SKILLS_DIR="$HOME/.claude/skills"
COMMANDS_DIR="$HOME/.claude/commands"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR=""
DRY_RUN=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
success() { printf "${GREEN}[OK]${NC} %s\n" "$1"; }
warn()    { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
error()   { printf "${RED}[ERROR]${NC} %s\n" "$1"; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Install, update, or manage the $COMPONENT_NAME $COMPONENT_TYPE (v$COMPONENT_VERSION).

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
EOF
  exit 0
}

check_existing() {
  if [ -d "$TARGET_DIR" ]; then
    if [ -f "$TARGET_DIR/package.json" ] || [ -f "$TARGET_DIR/.claude-plugin/plugin.json" ]; then
      return 0
    fi
  fi
  return 1
}

create_backup() {
  if [ -d "$TARGET_DIR" ]; then
    BACKUP_DIR="/tmp/${COMPONENT_NAME}-backup-$(date +%Y%m%d%H%M%S)"
    if [ "$DRY_RUN" -eq 1 ]; then
      info "[DRY RUN] Would backup $TARGET_DIR to $BACKUP_DIR"
      return 0
    fi
    info "Creating backup at $BACKUP_DIR"
    cp -R "$TARGET_DIR" "$BACKUP_DIR"
    success "Backup created"
  fi
}

restore_backup() {
  if [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
    warn "Restoring from backup..."
    rm -rf "$TARGET_DIR"
    cp -R "$BACKUP_DIR" "$TARGET_DIR"
    success "Backup restored"
  fi
}

install_skills() {
  local plugin_json="$SCRIPT_DIR/.claude-plugin/plugin.json"
  if [ ! -f "$plugin_json" ]; then
    warn "No plugin.json found, skipping skill installation"
    return 0
  fi

  mkdir -p "$SKILLS_DIR"

  # Clean up old-style skills without namespace prefix
  for old_name in ui uninstall screenshots; do
    local skill_dir="$SKILLS_DIR/$old_name"
    if [ -d "$skill_dir" ] && [ -f "$skill_dir/SKILL.md" ]; then
      if grep -q "$COMPONENT_NAME" "$skill_dir/SKILL.md" 2>/dev/null; then
        if [ "$DRY_RUN" -eq 1 ]; then
          info "[DRY RUN] Would remove old-style skill: $skill_dir"
        else
          info "Removing old-style skill: $old_name"
          rm -rf "$skill_dir"
        fi
      fi
    fi
  done

  # Parse skill names from plugin.json (bash 3.2 compatible, use python3 if available)
  local skill_names=""
  if command -v python3 >/dev/null 2>&1; then
    skill_names=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for s in data.get('skills', []):
    print(s['name'])
" "$plugin_json" 2>/dev/null) || true
  fi

  if [ -z "$skill_names" ]; then
    # Fallback: grep-based parsing (look for skills array entries)
    skill_names=$(grep -A 100 '"skills"' "$plugin_json" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"name"[[:space:]]*:[[:space:]]*"//' | sed 's/"//' | head -20)
  fi

  local IFS=$'\n'
  for skill_name in $skill_names; do
    local src_dir="$SCRIPT_DIR/skills/$skill_name"
    local dest_dir="$SKILLS_DIR/${COMPONENT_NAME}:${skill_name}"

    if [ ! -d "$src_dir" ]; then
      warn "Skill source not found: $src_dir"
      continue
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
      info "[DRY RUN] Would install skill: ${COMPONENT_NAME}:${skill_name}"
      continue
    fi

    info "Installing skill: ${COMPONENT_NAME}:${skill_name}"
    rm -rf "$dest_dir"
    cp -R "$src_dir" "$dest_dir"

    # Patch SKILL.md frontmatter name field to use namespaced name
    local skill_md="$dest_dir/SKILL.md"
    if [ -f "$skill_md" ]; then
      local tmp_file
      tmp_file=$(mktemp)
      sed "s/^name:.*$/name: ${COMPONENT_NAME}:${skill_name}/" "$skill_md" > "$tmp_file"
      mv "$tmp_file" "$skill_md"
    fi

    success "Installed skill: ${COMPONENT_NAME}:${skill_name}"
  done
}

install_commands() {
  local cmd_src="$SCRIPT_DIR/commands"
  if [ ! -d "$cmd_src" ] || [ -z "$(ls -A "$cmd_src" 2>/dev/null)" ]; then
    return 0
  fi

  mkdir -p "$COMMANDS_DIR"

  for cmd_file in "$cmd_src"/*; do
    [ -f "$cmd_file" ] || continue
    local fname
    fname="$(basename "$cmd_file")"
    if [ "$DRY_RUN" -eq 1 ]; then
      info "[DRY RUN] Would install command: $fname"
    else
      info "Installing command: $fname"
      cp "$cmd_file" "$COMMANDS_DIR/$fname"
      success "Installed command: $fname"
    fi
  done
}

do_install() {
  if [ "$DRY_RUN" -eq 1 ]; then
    info "[DRY RUN] Would install to $TARGET_DIR"
    info "[DRY RUN] Would run npm install --production"
    install_skills
    install_commands
    info "[DRY RUN] Would create .installed-manifest.json"
    success "[DRY RUN] Install simulation complete"
    return 0
  fi

  info "Installing $COMPONENT_NAME $COMPONENT_TYPE v$COMPONENT_VERSION..."

  # Create target directory and copy files
  mkdir -p "$TARGET_DIR"

  # Copy everything except installer files and node_modules
  for item in "$SCRIPT_DIR"/*; do
    local base
    base="$(basename "$item")"
    case "$base" in
      install|install.sh|install.mjs|install.cmd|INSTALL.md|DEPLOY_NOW.md|DEPLOYMENT_INSTRUCTIONS.md|node_modules)
        continue
        ;;
      *)
        cp -R "$item" "$TARGET_DIR/"
        ;;
    esac
  done

  # Also copy hidden files (except . and ..)
  for item in "$SCRIPT_DIR"/.*; do
    local base
    base="$(basename "$item")"
    case "$base" in
      .|..|.git|.DS_Store)
        continue
        ;;
      *)
        cp -R "$item" "$TARGET_DIR/" 2>/dev/null || true
        ;;
    esac
  done

  # Run npm install
  info "Installing dependencies..."
  if command -v npm >/dev/null 2>&1; then
    (cd "$TARGET_DIR" && npm install --production --silent 2>/dev/null) || \
    (cd "$TARGET_DIR" && npm install --production)
  else
    warn "npm not found, skipping dependency installation"
  fi

  # Install skills and commands
  install_skills
  install_commands

  # Create manifest
  cat > "$TARGET_DIR/.installed-manifest.json" <<MANIFEST
{
  "name": "$COMPONENT_NAME",
  "type": "$COMPONENT_TYPE",
  "version": "$COMPONENT_VERSION",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "targetDir": "$TARGET_DIR",
  "skillsDir": "$SKILLS_DIR",
  "commandsDir": "$COMMANDS_DIR"
}
MANIFEST

  success "$COMPONENT_NAME $COMPONENT_TYPE v$COMPONENT_VERSION installed successfully!"
}

do_uninstall() {
  info "Uninstalling $COMPONENT_NAME $COMPONENT_TYPE..."

  if [ "$DRY_RUN" -eq 1 ]; then
    info "[DRY RUN] Would remove skills with prefix ${COMPONENT_NAME}:"
    info "[DRY RUN] Would remove $TARGET_DIR"
    success "[DRY RUN] Uninstall simulation complete"
    return 0
  fi

  # Remove namespaced skills
  for skill_dir in "$SKILLS_DIR"/${COMPONENT_NAME}:*; do
    if [ -d "$skill_dir" ]; then
      info "Removing skill: $(basename "$skill_dir")"
      rm -rf "$skill_dir"
    fi
  done

  # Remove plugin directory
  if [ -d "$TARGET_DIR" ]; then
    rm -rf "$TARGET_DIR"
    success "Removed $TARGET_DIR"
  fi

  success "$COMPONENT_NAME $COMPONENT_TYPE uninstalled"
}

do_init_git() {
  if [ ! -d "$TARGET_DIR" ]; then
    error "Plugin not installed. Install first."
    exit 1
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    info "[DRY RUN] Would initialize git repo in $TARGET_DIR"
    return 0
  fi

  cd "$TARGET_DIR"

  if [ -d ".git" ]; then
    warn "Git repository already exists"
    return 0
  fi

  git init

  cat > .gitignore <<'GITIGNORE'
node_modules/
.DS_Store
*.log
.env
.env.*
GITIGNORE

  git add -A
  git commit -m "chore: initial commit of $COMPONENT_NAME plugin v$COMPONENT_VERSION"
  success "Git repository initialized in $TARGET_DIR"
  cd "$SCRIPT_DIR"
}

interactive_mode() {
  if check_existing; then
    local existing_version="unknown"
    if [ -f "$TARGET_DIR/.claude-plugin/plugin.json" ] && command -v python3 >/dev/null 2>&1; then
      existing_version=$(python3 -c "
import json
with open('$TARGET_DIR/.claude-plugin/plugin.json') as f:
    print(json.load(f).get('version', 'unknown'))
" 2>/dev/null || echo "unknown")
    fi

    printf "\n${BLUE}Existing installation detected${NC} (v%s)\n" "$existing_version"
    printf "  Bundle version: ${GREEN}v%s${NC}\n\n" "$COMPONENT_VERSION"
    printf "  1) Update\n"
    printf "  2) Repair\n"
    printf "  3) Uninstall\n"
    printf "  4) Cancel\n\n"
    printf "Choose [1-4]: "

    read -r choice
    case "$choice" in
      1)
        create_backup
        trap restore_backup ERR
        do_install
        trap - ERR
        ;;
      2)
        create_backup
        trap restore_backup ERR
        do_install
        trap - ERR
        ;;
      3)
        do_uninstall
        ;;
      4|*)
        info "Cancelled"
        exit 0
        ;;
    esac
  else
    printf "\n${BLUE}Installing $COMPONENT_NAME $COMPONENT_TYPE v$COMPONENT_VERSION${NC}\n\n"
    do_install
  fi
}

# Parse arguments
MODE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --fresh)     MODE="fresh" ;;
    --update)    MODE="update" ;;
    --force)     MODE="force" ;;
    --repair)    MODE="repair" ;;
    --uninstall) MODE="uninstall" ;;
    --dry-run)   DRY_RUN=1 ;;
    --init-git)  MODE="init-git" ;;
    --help|-h)   usage ;;
    *) error "Unknown option: $1"; usage ;;
  esac
  shift
done

case "$MODE" in
  fresh)
    if check_existing; then
      error "Already installed at $TARGET_DIR. Use --update or --force."
      exit 1
    fi
    do_install
    ;;
  update)
    if ! check_existing; then
      error "Not installed. Use --fresh instead."
      exit 1
    fi
    create_backup
    trap restore_backup ERR
    do_install
    trap - ERR
    ;;
  force)
    create_backup
    if [ "$DRY_RUN" -eq 0 ] && [ -d "$TARGET_DIR" ]; then
      rm -rf "$TARGET_DIR"
    fi
    do_install
    ;;
  repair)
    create_backup
    trap restore_backup ERR
    do_install
    trap - ERR
    ;;
  uninstall)
    do_uninstall
    ;;
  init-git)
    do_init_git
    ;;
  "")
    interactive_mode
    ;;
esac
