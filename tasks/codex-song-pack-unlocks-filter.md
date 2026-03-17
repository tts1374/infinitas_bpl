# codex-song-pack-unlocks-filter

## Purpose
- Add user settings for BIT unlock, DJP unlock, and owned song packs.
- Apply the shared-ownership filter at `START MATCH` and use the fixed result in `PICKING`.

## Non-goals
- Do not change Room FSM state transitions or timer values.
- Do not change WebSocket message shape beyond fields strictly required for this feature.
- Do not change monitoring source I/O behavior.

## Changes
- Update client settings UI/state to persist unlock flags and owned pack IDs in local settings.
- Build song pack options from `inf_pack` and display `pack_name` in `display_order DESC` / `inf_pack_id ASC`.
- Carry each player's unlock/pack settings into match start snapshot and compute match-level filter in DO/server.
- Apply picking candidate filter with the fixed snapshot:
  - always include `initial`
  - include `bit` only if all players enable BIT
  - include `djp` only if all players enable DJP
  - include `pack` only for pack IDs enabled by all players
- Exclude invalid unlock rows (`unknown unlock_type`, `pack` without valid `inf_pack_id`) and add debug logging.

## Impact
- Users: Settings screen gains pack ownership toggles and picking list is filtered by common ownership.
- Data: Local settings schema adds/uses unlock and pack ownership fields.
- Compatibility: Existing settings without pack fields are backfilled to OFF defaults.
- Cloudflare: Worker/DO picking filter logic is updated; no infra resource changes.

## Target Files / Layers
- Files:
  - `apps/client/src/pages/SettingsPage.tsx`
  - `apps/client/src/pages/songPacks.ts`
  - `apps/client/src/*` (settings persistence / start match payload handling, exact files after trace)
  - `apps/worker/src/*` (match snapshot + picking filter handling, exact files after trace)
  - `packages/shared/src/*` (types/constants if needed)
- Layers: client, worker, shared

## Test Focus
- Technical: build/lint/test pass for touched layers.
- Diff: only intended files changed, no unrelated formatting/generation.
- FSM/Protocol: verify picking behavior/regression without state/timer contract break.
- E2E-light: confirm common-pack filtering scenarios and invalid-row exclusion behavior.

## Rollback Plan
- Revert this task's commits to restore prior settings fields and prior picking filter behavior.
- If partial rollback is needed, disable pack-based filtering behind previous unlock-only behavior.

## Commit Split Plan
1. Client settings model/UI updates for unlock+pack ownership and local persistence migration.
2. Shared/worker match snapshot and picking filter logic updates with debug logging.
3. Tests and validation updates.

## Checklist
- [ ] Design doc alignment confirmed (no contract doc update required)
- [ ] Impact scope identified
- [ ] Implementation completed
- [ ] Tests completed
- [ ] Regression checks completed
- [ ] Documentation updates completed (if required)
