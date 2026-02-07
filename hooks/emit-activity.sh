#!/bin/bash
#
# emit-activity.sh - Hook script to emit agent activity events
# For the Jedi Archives visualization dashboard
#
# Usage:
#   emit-activity.sh spawn    # Called by SubagentStart hook
#   emit-activity.sh complete # Called by SubagentStop hook
#   emit-activity.sh task     # Called by PreToolUse[Task] hook (DISABLED - causes duplicate agents)
#
# The hook receives JSON data via stdin from Claude Code
#

set -e

# Environment server URL
SERVER_URL="${ACTIVITY_SERVER_URL:-http://localhost:3848}"

# Event type from argument
EVENT_TYPE="${1:-spawn}"

# Read JSON payload from stdin (Claude Code passes hook data this way)
PAYLOAD=$(cat)

# Debug logging - enable by creating /tmp/emit-activity-debug
if [ -f /tmp/emit-activity-debug ]; then
  echo "[emit-activity] $(date '+%H:%M:%S') Event: $EVENT_TYPE" >> /tmp/emit-activity.log
  echo "[emit-activity] Payload: $PAYLOAD" >> /tmp/emit-activity.log
fi

# Helper function to extract JSON value
json_value() {
  echo "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1
}

json_value_raw() {
  echo "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*[^,}]*" | sed 's/.*: *//' | tr -d '"}' | head -1
}

case "$EVENT_TYPE" in
  spawn)
    # SubagentStart hook - agent is starting
    # Server correlates with metadata stored by PreToolUse[Task] via session_id

    AGENT_ID=$(json_value "agent_id")
    if [ -z "$AGENT_ID" ]; then
      AGENT_ID=$(json_value "session_id")
    fi
    if [ -z "$AGENT_ID" ]; then
      AGENT_ID="agent-$(date +%s)-$$"
    fi

    SESSION_ID=$(json_value "session_id")

    AGENT_TYPE=$(json_value "agent_type")
    if [ -z "$AGENT_TYPE" ]; then
      AGENT_TYPE="general-purpose"
    fi

    if [ -f /tmp/emit-activity-debug ]; then
      echo "[emit-activity] spawn - agent_id=$AGENT_ID session_id=$SESSION_ID agent_type=$AGENT_TYPE" >> /tmp/emit-activity.log
    fi

    # Send spawn event (server looks up metadata using sessionId)
    curl -s -X POST "${SERVER_URL}/api/activity/spawn" \
      -H "Content-Type: application/json" \
      -d "{
        \"agentId\": \"$AGENT_ID\",
        \"sessionId\": \"$SESSION_ID\",
        \"agentType\": \"$AGENT_TYPE\"
      }" > /dev/null 2>&1 &
    ;;

  complete)
    # SubagentStop hook - agent finished
    # IMPORTANT: agent_id is unique per subagent, session_id is shared by parent session

    AGENT_ID=$(json_value "agent_id")
    if [ -z "$AGENT_ID" ]; then
      AGENT_ID=$(json_value "session_id")
    fi

    STATUS=$(json_value "status")
    if [ -z "$STATUS" ]; then
      STATUS="success"
    fi

    # Send complete event
    if [ -n "$AGENT_ID" ]; then
      curl -s -X POST "${SERVER_URL}/api/activity/complete" \
        -H "Content-Type: application/json" \
        -d "{
          \"agentId\": \"$AGENT_ID\",
          \"status\": \"$STATUS\"
        }" > /dev/null 2>&1 &
    fi
    ;;

  task)
    # PreToolUse[Task] hook - store metadata on server for correlation with SubagentStart

    SESSION_ID=$(json_value "session_id")
    SUBAGENT_TYPE=$(json_value "subagent_type")

    DESCRIPTION=$(json_value "description")
    if [ -z "$DESCRIPTION" ]; then
      DESCRIPTION=$(json_value "prompt" | head -c 100)
    fi

    if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
      curl -s -X POST "${SERVER_URL}/api/activity/metadata" \
        -H "Content-Type: application/json" \
        -d "{
          \"sessionId\": \"$SESSION_ID\",
          \"subagentType\": \"$SUBAGENT_TYPE\",
          \"description\": \"$DESCRIPTION\"
        }" > /dev/null 2>&1 &

      if [ -f /tmp/emit-activity-debug ]; then
        echo "[emit-activity] task event - stored metadata for session $SESSION_ID: $SUBAGENT_TYPE - $DESCRIPTION" >> /tmp/emit-activity.log
      fi
    fi
    ;;

  *)
    echo "Unknown event type: $EVENT_TYPE" >&2
    exit 1
    ;;
esac

# Exit immediately (async curl calls are backgrounded)
exit 0
