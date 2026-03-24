# codex-regression-guard-1-6

## Purpose
- Reduce regression risk by tightening FSM/WS/data contracts and making drift detectable in CI.
- Implement feasible parts of the 1-6 ideal fixes with the smallest safe cross-layer diff.

## Non-goals
- No broad feature redesign of room flow or source-monitoring runtime behavior.
- No dependency updates.
- No refactor-only changes outside contract/touch points.

## Changes
- Add a design addendum for regression-critical contract rules.
- Align close reason contract to include `ROOM_STATE_LOST` consistently.
- Tighten `RESULT_READY` payload typing from opaque objects to structured models.
- Add snapshot/archive compatibility policy notes and versioning guard constants.
- Add contract-focused tests for shared enums/payload shape and close-reason handling.
- Add a lightweight design-contract consistency check script to catch doc/code drift.

## Impact
- Users: Safer behavior consistency and clearer failure semantics (`ROOM_STATE_LOST`) with no intended UX regression.
- Data: No destructive migration; compatibility policy clarified and guarded.
- Compatibility: Contract typing is stricter; compile-time mismatches are surfaced earlier.
- Cloudflare: No infrastructure/resource change; room protocol contract checks are strengthened.

## Target Files / Layers
- Files:
  - `docs/design/01_fsm.md`
  - `docs/design/02_ws_protocol.md`
  - `docs/design/03_data_model.md`
  - `docs/design/05_screen_list.md`
  - `docs/design/07_constants.md`
  - `docs/design/08_repo_structure.md`
  - `docs/design/10_regression_guard_addendum.md` (new)
  - `AGENTS.md`
  - `packages/shared/src/enums/room.ts`
  - `packages/shared/src/ws/server.ts`
  - `packages/shared/src/index.ts` and related model files as needed
  - `apps/client/src/stores/room-store.ts` (close reason handling)
  - `apps/worker/src/durable/room-state.test.mjs` and/or `room-object.test.mjs`
  - `scripts/check-design-contracts.mjs` (new)
  - `package.json` (script wiring)
- Layers: docs / shared / client / worker / scripts

## Test Focus
- Root lint/typecheck for changed TS surfaces.
- Worker tests for room close reason and `RESULT_READY` contract effects.
- New design-contract check script execution.
- Diff validation: intended files only, no unrelated formatting/noise, UTF-8 no BOM/LF.

## Rollback Plan
- Revert this task as a single logical set (or commit split) to restore prior contracts.
- If runtime issue appears, disable only strict checks first (script/test), keep doc clarifications.

## Commit Split Plan
1. Design docs and governance alignment (`AGENTS.md` + `docs/design/*` + new addendum)
2. Shared/client/worker contract typing and close-reason alignment
3. Verification hardening (tests + design-contract check script + npm script)

## Checklist
- [x] Design doc alignment confirmed (contract ambiguity removed)
- [x] Impact scope identified (docs/shared/client/worker/scripts)
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed
