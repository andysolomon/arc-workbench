#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 \"Idea Title\"" >&2
  exit 1
fi

title="$*"

slug="$(printf '%s' "$title" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"

# remove very common filler terms to keep names compact
slug="$(printf '%s' "$slug" | sed -E 's/(^|-)for($|-)/-/g; s/(^|-)with($|-)/-/g; s/(^|-)the($|-)/-/g; s/-{2,}/-/g; s/^-+//; s/-+$//')"

# keep practical repo length
slug="$(printf '%s' "$slug" | cut -c1-58 | sed -E 's/-+$//')"

echo "$slug"
