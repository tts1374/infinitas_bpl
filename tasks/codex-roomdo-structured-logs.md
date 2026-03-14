# codex-roomdo-structured-logs

## Purpose
- Add a common structured log envelope for RoomDO so room-flow debugging is possible from a small, queryable schema.
- Keep RoomDO behavior unchanged while improving observability around websocket handling, state transitions, rejections, duplicates, and room closure.

## Non-goals
- Do not change websocket or FSM contract behavior.
- Do not add new external logging infrastructure or dependency changes.
- Do not refactor unrelated worker/client/shared code.

## Base
- Base branch: `v1`
- Base SHA: `bc6690855530b0ec35d2869e4d96875a58aa63ae`
- Worktree: `C:/work/infinitas_arena/infinitas_bpl__roomdo_structured_logs`
- Branch: `codex/roomdo-structured-logs`

## Changes
- Add a RoomDO-local structured logging helper with a fixed common envelope and event-specific `detail`.
- Replace or supplement ad-hoc RoomDO logs at the key debugging points: socket error/close, message receive/reject/duplicate, selected FSM transitions, force advance, and room close/state-loss paths.
- Reuse existing runtime context only; do not alter persistence or protocol payloads.

## Impact
- Users: none
- Data: none
- Compatibility: none intended; logs only
- Cloudflare: worker/DO runtime logging output becomes more structured and consistent

## Target Files / Layers
- Files:
  - `apps/worker/src/durable/room-object.ts`
  - `apps/worker/src/durable/room-state.ts` (only if needed to surface transition context cleanly)
- Layers: worker

## Invariant Impact
- INV-01: preserved
  - Note: Worker remains thin; logging stays inside RoomDO logic.
- INV-03: preserved
  - Note: Timer behavior is only observed, not changed.
- INV-04: preserved
  - Note: expected_key enforcement is only logged.
- INV-05: preserved
  - Note: idempotency paths are only logged.
- INV-06: preserved
  - Note: host authority checks are only logged.
- INV-08: preserved
  - Note: state loss handling is only logged.

## Test Focus
- `QUALITY.md` section 1 and section 2
- `QUALITY.md` section 3 because RoomDO flow code is touched, even though behavior should remain unchanged
- Targeted worker tests if log helper extraction requires code-path adjustments
- Diff / UTF-8 no-BOM / LF-safe validation

## Rollback Plan
- Revert the structured logging commit(s) to restore previous ad-hoc logging.
- If helper extraction causes risk, keep only the smallest direct log call updates or revert entirely.

## Commit Split Plan
1. Add the RoomDO structured log envelope and wire it through websocket, lifecycle, and critical room-flow events in one worker-only commit.

## Checklist
- [x] Design doc alignment confirmed
- [x] Impact scope identified
- [x] Implementation completed
- [ ] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)

## Validation Notes
- `git diff --check`: passed
- `tsc --noEmit -p tsconfig.json`: touched file checked clean; full workspace still fails in this worktree because app dependencies such as `react` and `@tauri-apps/*` are not installed
