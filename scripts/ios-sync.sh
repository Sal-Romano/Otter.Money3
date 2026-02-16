#!/bin/bash
# Sync Otter Money iOS project to Mac Mini
# Usage: ./scripts/ios-sync.sh [--build] [--open]
#   --build   Build web app before syncing (default: just sync)
#   --open    Open Xcode on Mac Mini after sync

set -e

MAC_MINI_HOST="sal@192.168.1.58"
MAC_MINI_PROJECT="~/Projects/otter-money"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/apps/web"

BUILD=false
OPEN=false

for arg in "$@"; do
  case $arg in
    --build) BUILD=true ;;
    --open)  OPEN=true ;;
    *)       echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Step 1: Build web app if requested (with production API URL for Capacitor)
if [ "$BUILD" = true ]; then
  echo "=> Building web app..."
  cd "$PROJECT_ROOT"
  VITE_API_URL=https://app.otter.money/api VITE_APP_URL=https://app.otter.money npm run build:web
fi

# Step 2: Run cap sync to update iOS project
echo "=> Running Capacitor sync..."
cd "$WEB_DIR"
npx cap sync ios 2>&1 || true

# Step 3: Rsync project to Mac Mini (exclude Pods, they're installed on Mac)
echo "=> Syncing to Mac Mini ($MAC_MINI_HOST)..."
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.env.production' \
  --exclude 'apps/web/ios/App/Pods' \
  "$PROJECT_ROOT/" "$MAC_MINI_HOST:$MAC_MINI_PROJECT/"

# Step 4: Run pod install on Mac Mini
echo "=> Running pod install on Mac Mini..."
ssh "$MAC_MINI_HOST" "export PATH='/opt/homebrew/bin:\$PATH' && export LANG=en_US.UTF-8 && cd $MAC_MINI_PROJECT/apps/web/ios/App && pod install"

# Step 5: Open Xcode if requested
if [ "$OPEN" = true ]; then
  echo "=> Opening Xcode on Mac Mini..."
  ssh "$MAC_MINI_HOST" "open $MAC_MINI_PROJECT/apps/web/ios/App/App.xcworkspace"
fi

echo "=> Done! iOS app synced. Build from Xcode on Mac Mini."
