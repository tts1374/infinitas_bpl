# issue-125-web-lp-join

## Purpose
- Add a new static web app at `apps/web` that provides the LP (`/`) and join page (`/join`) foundation based on the wireframe `Landing.tsx`.

## Non-goals
- Implement the production Worker API for join status.
- Expose or embed `join_code` in URL or UI.
- Change responsibilities of existing `apps/client` and `apps/worker`.

## Changes
- Scaffold `apps/web` (React + TypeScript + static build friendly routing).
- Implement LP UI by reflecting the wireframe `Landing.tsx` as the visual/content source of truth.
- Implement `/join?r=...` with deep-link auto-attempt, manual retry, and placeholder API integration point for room status.
- Externalize replaceable constants (download/release/support URLs, deep link scheme, join API endpoint).
- Integrate workspace scripts so root can run `dev:web` and `build:web`.

## Impact
- Users: Adds a public LP and join entry page for app onboarding.
- Data: None (read-only mock/future API connection point).
- Compatibility: No impact to existing app protocol/contracts.
- Cloudflare: No resource/config changes in this task.

## Target Files / Layers
- Files:
  - `apps/web/*` (new app files)
  - `package.json` (root scripts only)
- Layers:
  - web app (new)
  - root workspace scripts

## Test Focus
- `apps/web` build success with type checks.
- Root workspace `build:web` script success.
- Diff validation (only intended files, no unrelated formatting/encoding drift).
- Manual route check for `/` and `/join?r=...` in dev build.

## Rollback Plan
- Revert this task's commits to remove `apps/web` and root script additions.
- Existing client/worker behavior remains unchanged.

## Commit Split Plan
1. Scaffold `apps/web` app skeleton and routing foundation.
2. Implement Landing and Join pages with constants and deep-link/state connector.
3. Integrate root scripts and run validations.

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
