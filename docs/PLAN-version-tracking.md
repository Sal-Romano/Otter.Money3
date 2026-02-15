# Plan: Version Tracking on Settings Page

## Goal
Display app version and API status on the Settings page. Single source of truth from `package.json`.

## Current State
- Root `package.json` version: `0.1.0` (web + api also `0.1.0`)
- **API health endpoint already exists**: `GET /api/health` returns `{ status, timestamp, version }` — version comes from `process.env.npm_package_version || '0.1.0'`
- Settings page has an **"About" section** (lines ~410-424) showing just logo + tagline — perfect spot for version info
- iOS `Info.plist` uses Xcode variables: `$(MARKETING_VERSION)` and `$(CURRENT_PROJECT_VERSION)`
- No version displayed anywhere in the app currently

## Implementation Steps

### Step 1: Add version display to Settings page
**File:** `apps/web/src/pages/Settings.tsx`

In the existing "About" section (after the logo/tagline, around line 420):
- Fetch `GET /api/health` on mount using `useEffect` or React Query
- Display: `Version 0.1.0 · API healthy` (green dot) or `Version 0.1.0 · API unreachable` (red dot)
- Use the existing `API_BASE` for the fetch URL
- Cache result, don't refetch on every render
- Graceful fallback: if health check fails, show version from a local constant and "API unreachable"

Example UI (bottom of About section):
```
[Otter Logo]
Otter Money
Finances for couples

v0.1.0 · API v0.1.0 ● Connected
```

### Step 2: Expose frontend version as a constant
**File:** `apps/web/src/utils/version.ts` (new file)

```typescript
export const APP_VERSION = __APP_VERSION__;
```

**File:** `apps/web/vite.config.ts`

Add a `define` block to inject version from package.json at build time:
```typescript
import pkg from './package.json';
// ...
define: {
  __APP_VERSION__: JSON.stringify(pkg.version),
},
```

This way the frontend always knows its own version, even if the API is unreachable.

### Step 3: Stamp iOS version from package.json
**File:** `scripts/ios-sync.sh`

Before syncing to Mac Mini, update the Xcode project's version:
```bash
VERSION=$(node -p "require('./package.json').version")
# Update Info.plist on Mac Mini after sync
ssh $MAC_MINI_HOST "cd $PROJECT && /usr/libexec/PlistBuddy -c \"Set :CFBundleShortVersionString $VERSION\" apps/web/ios/App/App/Info.plist"
```

This keeps iOS App Store version in sync with package.json automatically.

### Step 4 (optional): Add build number auto-increment
For App Store submissions, the build number must increment. Add to `ios-sync.sh`:
```bash
BUILD=$(date +%Y%m%d%H%M)  # e.g., 202602151430
ssh $MAC_MINI_HOST "cd $PROJECT && /usr/libexec/PlistBuddy -c \"Set :CFBundleVersion $BUILD\" apps/web/ios/App/App/Info.plist"
```

## Files to Touch
1. `apps/web/src/pages/Settings.tsx` — add version display to About section
2. `apps/web/src/utils/version.ts` — new file, exports APP_VERSION
3. `apps/web/vite.config.ts` — inject version at build time via `define`
4. `scripts/ios-sync.sh` — stamp version into Info.plist

## No Changes Needed
- API health endpoint — already returns version, no modifications required
- Root `package.json` — already has version field
- API code — version already sourced from npm_package_version env var
