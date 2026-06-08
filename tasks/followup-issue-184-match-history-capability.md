# Follow-up: minimize match history window capability

## Background
- Issue #184 adds the fixed-label `match-history` Tauri window.
- The window currently shares the main capability, including plugins that its localStorage-only view does not use.

## Purpose
- Give the `match-history` window a dedicated least-privilege Tauri capability.

## Non-goals
- Do not change the main window capability.
- Do not change match history UI, storage behavior, or window lifecycle.
- Do not add new plugin permissions.

## Acceptance Criteria
- `match-history` is removed from the broad main capability.
- A dedicated capability grants only the permissions required for the match history view to render and update.
- Open, existing-focus, Close/recreate, and Reset desktop smoke remain green.

## Target Layers / Files
- layer: client Tauri capability
- files: `apps/client/src-tauri/capabilities/*.json`

## Validation
- Run `cargo check`.
- Run `npm run build:client`.
- Run desktop CUA smoke for open, existing-focus, Close/recreate, and Reset.
- Confirm `git diff --check` passes.

## Recommended Execution Mode
- execution profile: Standard
- Plan Mode: NO

## Delegation Hint
- role: front-implementer
- spawned: later
- objective: split the secondary window into a dedicated least-privilege capability without changing behavior.
- no-delegate reason: none
