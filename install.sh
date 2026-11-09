#!/bin/sh
# Askwell Q and A Forum — one-shot setup.
# Installs project dependencies, creates the SQLite schema and seeds the demo
# community, then EXITS. It never starts the HTTP server: use `npm run dev` or
# `npm start` for that.
#
# Written for POSIX sh so both `sh install.sh` and `bash install.sh` work.
set -eu

cd "$(dirname "$0")"

export npm_config_yes=true
export CI=true

if [ ! -f package.json ]; then
  echo "install.sh: package.json missing — run this from the project root" >&2
  exit 1
fi

echo "[askwell] installing npm dependencies"
# node version advisory (auto-added by cenius)
if command -v node >/dev/null 2>&1; then
  _REQ_NODE="$(node -p "(require('./package.json').engines||{}).node||''" 2>/dev/null || true)"
  [ -n "$_REQ_NODE" ] && echo "-> This app requires Node $_REQ_NODE (you have $(node -v)). If install fails with EBADENGINE, upgrade Node: https://nodejs.org"
fi
npm install --no-audit --no-fund

echo "[askwell] creating the SQLite schema"
node scripts/migrate.js

echo "[askwell] seeding the demo community"
node scripts/seed.js

echo ""
echo "Setup complete."
echo "  Start the dev server : npm run dev"
echo "  Start the server     : npm start"
echo "  Run the test suite   : npm test"
echo "  Demo login           : cenius@cenius.ai / cenius"
