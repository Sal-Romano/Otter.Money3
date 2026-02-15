#!/bin/bash
# Enable iOS live reload: syncs Capacitor config pointing at Vite dev server,
# then starts the Vite dev server. Changes hot-reload on the iPhone instantly.
#
# Prerequisites:
#   - Vite dev server + API must be running (npm run dev)
#   - iOS app must be built once in Xcode on the Mac Mini
#   - iPhone and this machine must be on the same network
#
# Usage: ./scripts/ios-live-reload.sh [start|stop]
#   start  - Configure Capacitor for live reload and sync to Mac (default)
#   stop   - Revert Capacitor to bundled mode and sync to Mac

set -e

MAC_MINI_HOST="sal@192.168.1.58"
MAC_MINI_PROJECT="~/Projects/otter-money"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/apps/web"
LOCAL_IP=$(hostname -I | awk '{print $1}')
DEV_SERVER_URL="http://${LOCAL_IP}:3001"

ACTION="${1:-start}"

if [ "$ACTION" = "start" ]; then
  echo "=> Enabling live reload..."
  echo "   Dev server URL: $DEV_SERVER_URL"

  # Update Capacitor config with dev server URL and sync
  cd "$WEB_DIR"
  CAPACITOR_SERVER_URL="$DEV_SERVER_URL" npx cap sync ios 2>&1 || true

  # Sync the updated config to Mac Mini
  rsync -avz --delete \
    --exclude '.git' \
    --exclude '.env.production' \
    --exclude 'apps/web/ios/App/Pods' \
    "$PROJECT_ROOT/" "$MAC_MINI_HOST:$MAC_MINI_PROJECT/" 2>&1 | tail -3

  echo ""
  echo "=> Live reload enabled!"
  echo "   1. Make sure 'npm run dev' is running on this machine"
  echo "   2. Rebuild the app in Xcode on the Mac Mini (Cmd+R)"
  echo "   3. Code changes will now hot-reload on the iPhone"
  echo ""
  echo "   Run './scripts/ios-live-reload.sh stop' when done to revert to bundled mode."

elif [ "$ACTION" = "stop" ]; then
  echo "=> Disabling live reload (reverting to bundled mode)..."

  # Build production web assets
  cd "$PROJECT_ROOT"
  VITE_API_URL=https://app.otter.money/api npm run build:web

  # Sync without dev server URL (uses bundled assets)
  cd "$WEB_DIR"
  npx cap sync ios 2>&1 || true

  # Sync to Mac Mini
  rsync -avz --delete \
    --exclude '.git' \
    --exclude '.env.production' \
    --exclude 'apps/web/ios/App/Pods' \
    "$PROJECT_ROOT/" "$MAC_MINI_HOST:$MAC_MINI_PROJECT/" 2>&1 | tail -3

  echo "=> Bundled mode restored. Rebuild in Xcode on Mac Mini."

else
  echo "Usage: $0 [start|stop]"
  exit 1
fi
