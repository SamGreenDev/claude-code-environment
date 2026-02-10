#!/bin/bash
#
# emit-session.sh - Hook script to register/deregister Claude Code sessions
# For the claudemon session monitoring TUI
#
# Usage:
#   emit-session.sh register    # Called by SessionStart hook
#   emit-session.sh deregister  # Called by SessionEnd hook
#   emit-session.sh heartbeat   # Can be called periodically
#
# The hook receives JSON data via stdin from Claude Code
#

set -e

# Environment server URL
SERVER_URL="${ACTIVITY_SERVER_URL:-http://localhost:3848}"

# Event type from argument
EVENT_TYPE="${1:-register}"

# Read JSON payload from stdin (Claude Code passes hook data this way)
PAYLOAD=$(cat)

# Debug logging - enable by creating /tmp/emit-session-debug
if [ -f /tmp/emit-session-debug ]; then
  echo "[emit-session] $(date '+%H:%M:%S') Event: $EVENT_TYPE" >> /tmp/emit-session.log
  echo "[emit-session] Payload: $PAYLOAD" >> /tmp/emit-session.log
fi

# Helper function to extract JSON value
json_value() {
  printf '%s\n' "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1
}

json_value_raw() {
  printf '%s\n' "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*[^,}]*" | sed 's/.*: *//' | tr -d '"}' | head -1
}

# Extract a nested JSON value, e.g. json_extract_nested "tool_input" "description"
# Finds the parent object, then extracts the child key's string value
json_extract_nested() {
  local parent="$1"
  local child="$2"
  # Extract the parent object content, then find the child key within it
  printf '%s\n' "$PAYLOAD" | sed "s/.*\"${parent}\"[[:space:]]*:[[:space:]]*{//" | sed 's/}.*//' | grep -o "\"${child}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1
}

# Get or generate session ID
get_session_id() {
  local sid=$(json_value "session_id")
  if [ -z "$sid" ]; then
    # Fallback: generate from TTY path
    local tty_path=$(tty 2>/dev/null || echo "notty")
    sid="session-$(echo "$tty_path" | md5 | cut -c1-12)-$$"
  fi
  echo "$sid"
}

# Get iTerm2 session ID via AppleScript (macOS only)
get_iterm_session_id() {
  if [ "$TERM_PROGRAM" = "iTerm.app" ]; then
    osascript -e 'tell application "iTerm2" to id of current session of current window' 2>/dev/null || echo ""
  fi
}

# Get iTerm2 window ID via AppleScript (macOS only)
get_iterm_window_id() {
  if [ "$TERM_PROGRAM" = "iTerm.app" ]; then
    osascript -e 'tell application "iTerm2" to id of current window' 2>/dev/null || echo ""
  fi
}

# Get Terminal.app window ID via AppleScript (macOS only)
get_terminal_window_id() {
  if [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then
    osascript -e 'tell application "Terminal" to id of front window' 2>/dev/null || echo ""
  fi
}

case "$EVENT_TYPE" in
  register)
    # SessionStart hook - CLI session is starting
    SESSION_ID=$(get_session_id)
    # Get TTY from Claude Code's process (hooks don't have a TTY)
    TTY_PATH=$(ps -o tty= -p $PPID 2>/dev/null | tr -d ' ')
    if [ -n "$TTY_PATH" ] && [ "$TTY_PATH" != "??" ]; then
      TTY_PATH="/dev/$TTY_PATH"
    else
      TTY_PATH=""
    fi
    TERM_APP="${TERM_PROGRAM:-unknown}"
    WORKING_DIR=$(json_value "cwd")
    if [ -z "$WORKING_DIR" ]; then
      WORKING_DIR=$(pwd)
    fi
    # $PPID is the Claude Code process that launched this hook script
    PID=$PPID

    # Get terminal-specific window/session ID for focus switching
    TERMINAL_WINDOW_ID=""
    if [ "$TERM_PROGRAM" = "iTerm.app" ]; then
      # For iTerm2, store both window and session IDs
      ITERM_WINDOW=$(get_iterm_window_id)
      ITERM_SESSION=$(get_iterm_session_id)
      if [ -n "$ITERM_WINDOW" ] && [ -n "$ITERM_SESSION" ]; then
        TERMINAL_WINDOW_ID="${ITERM_WINDOW}:${ITERM_SESSION}"
      fi
    elif [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then
      TERMINAL_WINDOW_ID=$(get_terminal_window_id)
    fi

    # Extract current task from tool_input if available
    CURRENT_TASK=$(json_extract_nested "tool_input" "description")
    if [ -z "$CURRENT_TASK" ]; then
      CURRENT_TASK=$(json_extract_nested "tool_input" "prompt")
    fi
    # Escape double quotes for JSON safety
    CURRENT_TASK=$(echo "$CURRENT_TASK" | sed 's/"/\\"/g' | head -c 200)

    if [ -f /tmp/emit-session-debug ]; then
      echo "[emit-session] register - id=$SESSION_ID tty=$TTY_PATH app=$TERM_APP wid=$TERMINAL_WINDOW_ID cwd=$WORKING_DIR task=$CURRENT_TASK" >> /tmp/emit-session.log
    fi

    # Send registration
    curl -s -X POST "${SERVER_URL}/api/sessions/register" \
      -H "Content-Type: application/json" \
      -d "{
        \"sessionId\": \"$SESSION_ID\",
        \"pid\": $PID,
        \"ttyPath\": \"$TTY_PATH\",
        \"workingDirectory\": \"$WORKING_DIR\",
        \"terminalApp\": \"$TERM_APP\",
        \"terminalWindowId\": \"$TERMINAL_WINDOW_ID\",
        \"currentTask\": \"$CURRENT_TASK\"
      }" > /dev/null 2>&1 &
    ;;

  deregister)
    # SessionEnd hook - CLI session is ending
    SESSION_ID=$(get_session_id)

    if [ -f /tmp/emit-session-debug ]; then
      echo "[emit-session] deregister - id=$SESSION_ID" >> /tmp/emit-session.log
    fi

    # Send deregistration
    if [ -n "$SESSION_ID" ]; then
      curl -s -X DELETE "${SERVER_URL}/api/sessions/${SESSION_ID}" > /dev/null 2>&1 &
    fi
    ;;

  heartbeat)
    # Heartbeat - update session status
    SESSION_ID=$(get_session_id)
    STATUS=$(json_value "status")
    if [ -z "$STATUS" ]; then
      STATUS="idle"
    fi

    if [ -n "$SESSION_ID" ]; then
      curl -s -X POST "${SERVER_URL}/api/sessions/${SESSION_ID}/heartbeat" \
        -H "Content-Type: application/json" \
        -d "{\"status\": \"$STATUS\"}" > /dev/null 2>&1 &
    fi
    ;;

  activity)
    # Activity - report tool usage
    SESSION_ID=$(get_session_id)
    TOOL_NAME=$(json_value "tool_name")
    if [ -z "$TOOL_NAME" ]; then
      TOOL_NAME=$(json_value "tool")
    fi
    STATUS="executing"

    # Extract a meaningful summary based on tool type
    SUMMARY=""
    case "$TOOL_NAME" in
      Bash)
        SUMMARY=$(json_extract_nested "tool_input" "description")
        if [ -z "$SUMMARY" ]; then
          SUMMARY=$(json_extract_nested "tool_input" "command" | head -c 80)
        fi
        ;;
      Read|Write|Edit)
        FPATH_TMP=$(json_extract_nested "tool_input" "file_path")
        if [ -n "$FPATH_TMP" ]; then
          SUMMARY=$(basename "$FPATH_TMP")
        fi
        ;;
      Grep)
        SUMMARY=$(json_extract_nested "tool_input" "pattern" | head -c 60)
        ;;
      Glob)
        SUMMARY=$(json_extract_nested "tool_input" "pattern")
        ;;
      Task)
        SUMMARY=$(json_extract_nested "tool_input" "description")
        if [ -z "$SUMMARY" ]; then
          SUMMARY=$(json_extract_nested "tool_input" "prompt" | head -c 80)
        fi
        ;;
      WebSearch)
        SUMMARY=$(json_extract_nested "tool_input" "query" | head -c 60)
        ;;
      WebFetch)
        SUMMARY=$(json_extract_nested "tool_input" "url" | head -c 60)
        ;;
    esac
    # Escape double quotes in summary for JSON safety
    SUMMARY=$(echo "$SUMMARY" | sed 's/"/\\"/g' | head -c 100)

    if [ -f /tmp/emit-session-debug ]; then
      echo "[emit-session] activity - tool=$TOOL_NAME summary=$SUMMARY" >> /tmp/emit-session.log
    fi

    if [ -n "$SESSION_ID" ] && [ -n "$TOOL_NAME" ]; then
      curl -s -X POST "${SERVER_URL}/api/sessions/${SESSION_ID}/activity" \
        -H "Content-Type: application/json" \
        -d "{
          \"status\": \"$STATUS\",
          \"tool\": {
            \"name\": \"$TOOL_NAME\",
            \"summary\": \"$SUMMARY\"
          }
        }" > /dev/null 2>&1 &
    fi
    ;;

  *)
    echo "Unknown event type: $EVENT_TYPE" >&2
    exit 1
    ;;
esac

# Exit immediately (async curl calls are backgrounded)
exit 0
