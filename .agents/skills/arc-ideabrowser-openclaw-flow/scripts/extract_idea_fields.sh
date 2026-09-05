#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
LIMIT="${2:-1400}"

if [[ -n "$TARGET" ]]; then
  if [[ "$TARGET" == "idea-of-the-day" || "$TARGET" == "https://www.ideabrowser.com/idea-of-the-day" ]]; then
    openclaw browser open "https://www.ideabrowser.com/idea-of-the-day" >/dev/null 2>&1 || true
  elif [[ "$TARGET" =~ ^https?:// ]]; then
    openclaw browser open "$TARGET" >/dev/null 2>&1 || true
  else
    openclaw browser open "https://www.ideabrowser.com/idea/$TARGET" >/dev/null 2>&1 || true
  fi
fi

echo "# Tabs"
openclaw browser tabs

echo
echo "# Snapshot"
openclaw browser snapshot --format ai --limit "$LIMIT"
