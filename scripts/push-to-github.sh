#!/usr/bin/env bash
# One-time helper: authenticate as tyhusband and push to Invisible-Hours.
# Usage:
#   GITHUB_TOKEN=ghp_your_token_here ./scripts/push-to-github.sh
# Or run without env var and you'll be prompted (input hidden).

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  read -rsp "Paste your tyhusband GitHub Personal Access Token: " GITHUB_TOKEN
  echo
fi

if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "Error: no token provided." >&2
  exit 1
fi

echo "Clearing cached github.com credentials..."
printf "protocol=https\nhost=github.com\n" | git credential reject 2>/dev/null || true

echo "Storing credentials for tyhusband..."
printf "protocol=https\nhost=github.com\nusername=tyhusband\npassword=${GITHUB_TOKEN}\n\n" | git credential approve

echo "Pushing to origin/main..."
git push -u origin main

echo "Done. https://github.com/tyhusband/Invisible-Hours"
