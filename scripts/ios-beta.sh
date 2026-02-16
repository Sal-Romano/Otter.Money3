#!/bin/bash
set -euo pipefail

# ── Otter Money: iOS Beta Deploy ──
# Syncs project to Mac Mini and runs fastlane beta to build + upload to TestFlight.
#
# Required env vars (set these in your shell or .env):
#   ASC_KEY_ID       - App Store Connect API Key ID
#   ASC_ISSUER_ID    - App Store Connect Issuer ID
#   MATCH_PASSWORD   - Password for match certificate repo encryption
#
# The API key .p8 file must exist at ~/AuthKey.p8 on the Mac Mini.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAC_HOST="sal@192.168.1.58"
MAC_PROJECT="~/Projects/otter-money"

# Source .env if vars aren't already set
if [ -z "${ASC_KEY_ID:-}" ] && [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Check required env vars
for var in ASC_KEY_ID ASC_ISSUER_ID MATCH_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    echo "Error: $var is not set"
    echo "Set it in your environment or in .env"
    exit 1
  fi
done

# Determine lane (default: beta, or pass 'build' for local-only build)
LANE="${1:-beta}"

echo "==> Syncing project to Mac Mini..."
npm run ios:sync

echo "==> Running fastlane ios $LANE on Mac Mini..."
ssh "$MAC_HOST" "cd $MAC_PROJECT && \
  export PATH=/opt/homebrew/bin:/opt/homebrew/opt/ruby/bin:\$PATH && \
  export LANG=en_US.UTF-8 && \
  export LC_ALL=en_US.UTF-8 && \
  export ASC_KEY_ID='$ASC_KEY_ID' && \
  export ASC_ISSUER_ID='$ASC_ISSUER_ID' && \
  export ASC_KEY_CONTENT=\"\$(cat ~/AuthKey.p8)\" && \
  export MATCH_PASSWORD='$MATCH_PASSWORD' && \
  export CI=1 && \
  bundle exec fastlane ios $LANE"

echo "==> Done! Check TestFlight for the new build."
