#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
SNAP_LIMIT="${2:-350}"

extract_slug_from_text() {
  local source="$1"
  printf '%s' "$source" \
    | grep -Eo 'https?://www\.ideabrowser\.com/idea/[a-z0-9-]+' \
    | sed -E 's#^.*/idea/##' \
    | grep -Ev '^(idea-of-the-day|database|trends|market-insights|idea-generator|idea-builder|idea-agent)$' \
    | tail -n1
}

extract_slug_from_arg() {
  local arg="$1"
  if [[ -z "$arg" ]]; then
    return 0
  fi

  if [[ "$arg" =~ ^https?://www\.ideabrowser\.com/idea/([a-z0-9-]+) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi

  if [[ "$arg" =~ ^[a-z0-9-]+$ ]] && [[ "$arg" != "idea-of-the-day" ]]; then
    printf '%s' "$arg"
    return 0
  fi

  return 0
}

extract_tab_id() {
  local source="$1"
  printf '%s' "$source" | sed -n 's/^id: //p' | tail -n1
}

find_tab_id_for_url() {
  local url="$1"
  local tabs_out="$2"
  printf '%s\n' "$tabs_out" \
    | awk -v u="$url" 'index($0, u) {getline; sub(/^ *id: /, ""); print; exit}'
}

resolve_from_target() {
  local target="$1"

  if [[ -z "$target" ]]; then
    return 0
  fi

  if [[ "$target" == "idea-of-the-day" || "$target" == "https://www.ideabrowser.com/idea-of-the-day" ]]; then
    openclaw browser open "https://www.ideabrowser.com/idea-of-the-day" >/dev/null 2>&1 || true
  elif [[ "$target" =~ ^https?:// ]]; then
    openclaw browser open "$target" >/dev/null 2>&1 || true
  else
    openclaw browser open "https://www.ideabrowser.com/idea/$target" >/dev/null 2>&1 || true
  fi

  local tabs_output
  tabs_output="$(openclaw browser tabs || true)"
  extract_slug_from_text "$tabs_output"
}

slug=""

if [[ -n "$TARGET" ]]; then
  slug="$(extract_slug_from_arg "$TARGET" || true)"
fi

if [[ -z "$slug" && -n "$TARGET" ]]; then
  slug="$(resolve_from_target "$TARGET" || true)"
fi

if [[ -z "$slug" ]]; then
  tabs_output="$(openclaw browser tabs || true)"
  slug="$(extract_slug_from_text "$tabs_output" || true)"
fi

if [[ -z "$slug" ]]; then
  snap_try="$(openclaw browser snapshot --format ai --limit 1200 || true)"
  slug="$(extract_slug_from_text "$snap_try" || true)"
fi

if [[ -z "$slug" ]]; then
  echo "ERROR: Could not determine idea slug from target/tabs/snapshot."
  echo "ACTION: Open an IdeaBrowser idea page (or /idea-of-the-day) and retry."
  exit 1
fi

base="https://www.ideabrowser.com/idea/${slug}"

declare -a pages=(
  "main:"
  "value-ladder:value-ladder"
  "why-now:why-now"
  "proof-signals:proof-signals"
  "market-gap:market-gap"
  "execution-plan:execution-plan"
  "value-equation:value-equation"
  "value-matrix:value-matrix"
  "acp:acp"
  "keywords:keywords"
  "feasibility-score:feasibility-score"
  "problem-score:problem-score"
  "opportunity-score:opportunity-score"
)

echo "IDEA_SLUG=${slug}"
echo "BASE_URL=${base}"

for item in "${pages[@]}"; do
  label="${item%%:*}"
  path="${item#*:}"

  if [[ -z "$path" ]]; then
    url="$base"
  else
    url="$base/$path"
  fi

  echo
  echo "===== PAGE:${label} URL:${url} ====="

  open_output="$(openclaw browser open "$url" 2>/dev/null || true)"
  tab_id="$(extract_tab_id "$open_output")"

  if [[ -z "$tab_id" ]]; then
    tabs_output="$(openclaw browser tabs || true)"
    tab_id="$(find_tab_id_for_url "$url" "$tabs_output" || true)"
  fi

  if [[ -z "$tab_id" ]]; then
    echo "STATUS: blocked"
    echo "REASON: open_failed"
    continue
  fi

  if ! openclaw browser focus "$tab_id" >/dev/null 2>&1; then
    echo "STATUS: blocked"
    echo "REASON: focus_failed"
    continue
  fi

  snap="$(openclaw browser snapshot --format ai --limit "$SNAP_LIMIT" 2>/dev/null || true)"

  if [[ -z "$snap" ]]; then
    echo "STATUS: missing"
    echo "REASON: empty_snapshot"
    continue
  fi

  if printf '%s' "$snap" | grep -qi 'Vercel Security Checkpoint'; then
    echo "STATUS: blocked"
    echo "REASON: security_checkpoint"
    continue
  fi

  echo "STATUS: ok"
  echo "$snap"
done
