#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
SNAP_LIMIT="${2:-350}"

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

slug="$(extract_slug_from_arg "$TARGET" || true)"
if [[ -z "$slug" ]]; then
  echo "ERROR: Provide idea slug or full idea URL."
  echo "EXAMPLE: ./scripts/crawl_idea_subpages_playwright.sh gamified-personal-finance-education-app"
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
  "opportunity:opportunity"
  "opportunity-score:opportunity-score"
)

if ! playwright-cli list 2>/dev/null | grep -q 'status: open'; then
  playwright-cli open --extension "$base" >/dev/null 2>&1 || true
fi

echo "IDEA_SLUG=${slug}"
echo "BASE_URL=${base}"

auth_wall_pattern='Get Started with a Free Account|Sign Up Free|This is today\x27s free Idea of the Day'
not_found_pattern='Page not found|404 Not Found'

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

  goto_out="$(playwright-cli goto "$url" 2>&1 || true)"
  title="$(printf '%s' "$goto_out" | sed -n 's/^- Page Title: //p' | head -n1)"
  [[ -n "$title" ]] && echo "TITLE: ${title}"

  snap_out="$(playwright-cli snapshot 2>&1 || true)"
  snap_path="$(printf '%s' "$snap_out" | sed -n 's/^- \[Snapshot\](\(.*\)).*/\1/p' | tail -n1)"

  if [[ -z "$snap_path" ]]; then
    echo "STATUS: failed"
    echo "REASON: snapshot_missing"
    continue
  fi

  echo "SNAPSHOT: ${snap_path}"

  if [[ ! -f "$snap_path" ]]; then
    echo "STATUS: failed"
    echo "REASON: snapshot_file_missing"
    continue
  fi

  if grep -Eqi "$auth_wall_pattern" "$snap_path"; then
    echo "STATUS: blocked"
    echo "REASON: auth_wall"
    continue
  fi

  if grep -Eqi "$not_found_pattern" "$snap_path"; then
    echo "STATUS: missing"
    echo "REASON: not_found"
    continue
  fi

  echo "STATUS: ok"
  sed -n "1,${SNAP_LIMIT}p" "$snap_path"
done
