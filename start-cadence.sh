#!/usr/bin/env bash
# Starts the Cadence dev server. The Linux counterpart to start-cadence.cmd.
#
# Run it from anywhere - it works out where it lives rather than depending on
# the shell's current directory, so a desktop launcher pointing straight at
# this file behaves the same as running it from the repo.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on your PATH."
  echo "Install Node.js first:  sudo pacman -S nodejs npm"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run in this folder - installing dependencies. This takes a minute."
  echo
  npm install
  echo
fi

cat <<'BANNER'
============================================
 Starting Cadence.
 Your browser will open at localhost:3000.
 To test on your phone, use the "Network:"
 address printed below - same wifi only.

 Leave this window open while you use it.
 Press Ctrl+C to stop the server.
============================================
BANNER
echo

# --open asks Vite to launch the default browser. Under Hyprland that goes
# through xdg-open; if no browser opens, the localhost URL below still works.
exec npm run dev -- --open
