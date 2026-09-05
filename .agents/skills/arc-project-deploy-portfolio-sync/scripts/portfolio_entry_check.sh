#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 /absolute/path/to/andrewsolomon.dev project-keyword" >&2
  exit 1
fi

site_repo="$1"
keyword="$2"

cd "$site_repo"

echo "# Git"
git status -sb

echo
echo "# Matches in index + project pages"
rg -n "$keyword|projects/" index.html projects/*.html || true
