#!/usr/bin/env bash
# bootstrap.sh — Zero-prerequisite installer for the Environment Dashboard plugin
# Usage: curl -fsSL https://github.com/samgreen/environment/releases/latest/download/bootstrap.sh | bash
set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
PLUGIN_NAME="environment"
PLUGIN_DIR="$HOME/.claude/plugins/local/environment"
SKILLS_DIR="$HOME/.claude/skills"
NODE_DIR="$PLUGIN_DIR/.node"
NODE_MIN_VERSION=18
REPO="samgreen/environment"
PORT=3848

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'
BOLD='\033[1m'; RESET='\033[0m'

info()  { printf "${BLUE}▸${RESET} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${RESET} %s\n" "$1"; }
fail()  { printf "${RED}✗${RESET} %s\n" "$1" >&2; exit 1; }

# ─── Cleanup trap ─────────────────────────────────────────────────────────────
CLEANUP_NEEDED=false
TMPDIR_BOOTSTRAP=""

cleanup() {
  if [ "$CLEANUP_NEEDED" = true ]; then
    warn "Installation failed — rolling back"
    [ -d "$PLUGIN_DIR" ] && rm -rf "$PLUGIN_DIR"
    # Don't remove skills dir itself, just our installed skills
    for d in "$SKILLS_DIR"/${PLUGIN_NAME}:*/; do
      [ -d "$d" ] && rm -rf "$d"
    done
  fi
  [ -n "$TMPDIR_BOOTSTRAP" ] && [ -d "$TMPDIR_BOOTSTRAP" ] && rm -rf "$TMPDIR_BOOTSTRAP"
}
trap cleanup EXIT

# ─── 1. Check basics ─────────────────────────────────────────────────────────
command -v curl  >/dev/null 2>&1 || fail "curl is required but not found"
command -v bash  >/dev/null 2>&1 || fail "bash is required but not found"
command -v tar   >/dev/null 2>&1 || fail "tar is required but not found"

printf "\n${BOLD}Environment Dashboard Installer${RESET}\n\n"

# ─── 2. Detect existing install ──────────────────────────────────────────────
if [ -f "$PLUGIN_DIR/server.js" ]; then
  warn "Existing installation detected at $PLUGIN_DIR"
  if [ -t 0 ]; then
    printf "  Update existing install? [y/N] "
    read -r answer
    case "$answer" in
      [yY]*) info "Updating existing installation…" ;;
      *)     info "Aborted."; exit 0 ;;
    esac
  else
    info "Non-interactive mode — updating existing installation…"
  fi
fi

CLEANUP_NEEDED=true

# ─── 3. Create directories ───────────────────────────────────────────────────
mkdir -p "$PLUGIN_DIR"
mkdir -p "$SKILLS_DIR"

# ─── 4. Check / install Node.js ──────────────────────────────────────────────
need_node=false

if command -v node >/dev/null 2>&1; then
  node_ver=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)
  if [ "$node_ver" -ge "$NODE_MIN_VERSION" ] 2>/dev/null; then
    ok "System Node.js v$(node -v | sed 's/^v//') detected"
  else
    warn "System Node.js too old (v$(node -v | sed 's/^v//'), need ${NODE_MIN_VERSION}+)"
    need_node=true
  fi
else
  info "Node.js not found on system"
  need_node=true
fi

if [ "$need_node" = true ]; then
  info "Installing local Node.js LTS…"

  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  case "$OS" in
    darwin) NODE_OS="darwin" ;;
    linux)  NODE_OS="linux" ;;
    *)      fail "Unsupported OS: $OS" ;;
  esac

  case "$ARCH" in
    arm64|aarch64) NODE_ARCH="arm64" ;;
    x86_64|amd64)  NODE_ARCH="x64" ;;
    *)              fail "Unsupported architecture: $ARCH" ;;
  esac

  # Fetch latest LTS version number
  NODE_LTS_VERSION=$(curl -fsSL "https://nodejs.org/dist/index.json" \
    | grep -o '"version":"v[0-9]*\.[0-9]*\.[0-9]*","date":"[^"]*","files":\[[^\]]*\],"npm":"[^"]*","v8":"[^"]*","uv":"[^"]*","zlib":"[^"]*","openssl":"[^"]*","modules":"[^"]*","lts":"[^"]*"' \
    | grep '"lts":"[A-Z]' | head -1 | grep -o '"version":"v[^"]*"' | cut -d'"' -f4)

  if [ -z "$NODE_LTS_VERSION" ]; then
    # Fallback to known LTS
    NODE_LTS_VERSION="v22.13.1"
    warn "Could not detect latest LTS, using fallback $NODE_LTS_VERSION"
  fi

  NODE_TARBALL="node-${NODE_LTS_VERSION}-${NODE_OS}-${NODE_ARCH}.tar.gz"
  NODE_URL="https://nodejs.org/dist/${NODE_LTS_VERSION}/${NODE_TARBALL}"

  info "Downloading Node.js ${NODE_LTS_VERSION} (${NODE_OS}-${NODE_ARCH})…"
  TMPDIR_BOOTSTRAP=$(mktemp -d)
  curl -fsSL --progress-bar "$NODE_URL" -o "$TMPDIR_BOOTSTRAP/$NODE_TARBALL"

  info "Extracting Node.js binary…"
  mkdir -p "$NODE_DIR/bin"
  tar -xzf "$TMPDIR_BOOTSTRAP/$NODE_TARBALL" -C "$TMPDIR_BOOTSTRAP"
  cp "$TMPDIR_BOOTSTRAP/node-${NODE_LTS_VERSION}-${NODE_OS}-${NODE_ARCH}/bin/node" "$NODE_DIR/bin/node"
  chmod +x "$NODE_DIR/bin/node"

  ok "Local Node.js installed at $NODE_DIR/bin/node"
fi

# ─── 5. Download plugin tarball ──────────────────────────────────────────────
info "Downloading latest plugin release…"
[ -z "$TMPDIR_BOOTSTRAP" ] && TMPDIR_BOOTSTRAP=$(mktemp -d)

TARBALL_URL="https://github.com/${REPO}/releases/latest/download/environment-plugin.tar.gz"
curl -fsSL --progress-bar -L "$TARBALL_URL" -o "$TMPDIR_BOOTSTRAP/environment-plugin.tar.gz"

# ─── 6. Extract plugin ──────────────────────────────────────────────────────
info "Extracting plugin files…"
tar -xzf "$TMPDIR_BOOTSTRAP/environment-plugin.tar.gz" -C "$PLUGIN_DIR" --strip-components=1 2>/dev/null \
  || tar -xzf "$TMPDIR_BOOTSTRAP/environment-plugin.tar.gz" -C "$PLUGIN_DIR"

ok "Plugin extracted to $PLUGIN_DIR"

# ─── 7. Install skills ──────────────────────────────────────────────────────
info "Installing skills…"
if [ -d "$PLUGIN_DIR/skills" ]; then
  for skill_dir in "$PLUGIN_DIR/skills"/*/; do
    [ ! -d "$skill_dir" ] && continue
    skill_name=$(basename "$skill_dir")
    target_dir="$SKILLS_DIR/${PLUGIN_NAME}:${skill_name}"
    mkdir -p "$target_dir"
    cp -R "$skill_dir"* "$target_dir/"
    ok "Installed skill: ${PLUGIN_NAME}:${skill_name}"
  done
fi

# ─── 8. Write manifest ──────────────────────────────────────────────────────
VERSION=$(grep '"version"' "$PLUGIN_DIR/package.json" 2>/dev/null | head -1 | grep -o '[0-9]*\.[0-9]*\.[0-9]*' || echo "unknown")
cat > "$PLUGIN_DIR/.installed-manifest.json" <<EOF
{
  "plugin": "$PLUGIN_NAME",
  "version": "$VERSION",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "method": "bootstrap",
  "nodeLocal": $( [ -f "$NODE_DIR/bin/node" ] && echo "true" || echo "false" ),
  "platform": "$(uname -s)-$(uname -m)"
}
EOF
ok "Wrote install manifest"

# ─── 9. Health check ────────────────────────────────────────────────────────
info "Running health check…"
NODE_BIN=$(command -v node 2>/dev/null || echo "$NODE_DIR/bin/node")

if [ ! -x "$NODE_BIN" ]; then
  warn "No usable node binary found — skipping health check"
else
  "$NODE_BIN" "$PLUGIN_DIR/server.js" &
  SERVER_PID=$!
  sleep 2

  if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    ok "Server health check passed"
  elif curl -sf "http://localhost:${PORT}/api/overview" >/dev/null 2>&1; then
    ok "Server overview endpoint responded"
  else
    warn "Health check did not respond (server may need Claude Code config to work)"
  fi

  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
fi

# ─── Done ────────────────────────────────────────────────────────────────────
CLEANUP_NEEDED=false

printf "\n${GREEN}${BOLD}Installation complete!${RESET}\n\n"
printf "  Plugin:  ${BOLD}%s${RESET}\n" "$PLUGIN_DIR"
printf "  Version: ${BOLD}%s${RESET}\n" "$VERSION"
[ -f "$NODE_DIR/bin/node" ] && printf "  Node.js: ${BOLD}%s${RESET} (local)\n" "$("$NODE_DIR/bin/node" -v)"
printf "\n"
printf "  ${BOLD}Next steps:${RESET}\n"
printf "    1. Open Claude Code\n"
printf "    2. Type ${BOLD}/environment:ui${RESET} to launch the dashboard\n"
printf "\n"
