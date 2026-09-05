#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 /absolute/path/to/project-repo" >&2
  exit 1
fi

repo="$1"

if [[ ! -d "$repo/.git" ]]; then
  echo "ERROR: not a git repo: $repo" >&2
  exit 1
fi

cd "$repo"

echo "# Git"
git status -sb
git remote -v

echo
echo "# Package"
if [[ -f bun.lock ]]; then
  echo "manager=bun"
  bun run lint
  bun run build
else
  echo "manager=npm"
  npm run lint
  npm run build
fi
