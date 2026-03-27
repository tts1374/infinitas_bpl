# Issue 124 Follow-up: Recreated Room Share Status

Mode decision: Plan Mode  
Reason: Durable Object recruitment status behavior changes across RESULT -> LOBBY transition.

## Objective

- Ensure join-page recruitment status can return from `closed` to `recruiting` when host explicitly recreates the room via `RETURN_TO_LOBBY`.

## Non-objective

- No WebSocket schema changes.
- No join URL format changes.
- No UI redesign changes.

## Scope

- Worker DO only.

Target files:
- `apps/worker/src/durable/room-object.ts`
- `apps/worker/src/durable/room-object.test.mjs`

## Invariants / Risk Notes

- Keep Worker route thin; status decision remains inside DO.
- Keep `recruitment_status=closed` while match is active (`PICKING/PLAYING/RESULT`).
- Only reset persistent share-closed flag on explicit host `RETURN_TO_LOBBY` success.

## Implementation Plan

- [ ] Add explicit reset path for `shareRecruitmentClosed` after successful `RETURN_TO_LOBBY`.
- [ ] Update/adjust join-status regression test for recreate behavior.
- [ ] Run worker tests and typecheck.

## Validation

Required:
- [ ] `npm --workspace @infinitas/worker run test`
- [ ] `npm --workspace @infinitas/worker run typecheck`
- [ ] Diff review: only intended files changed

Not required:
- Source I/O checks: not touched
- E2E checks: not required for this localized DO join-status fix

## Rollback

- Revert this follow-up commit to restore sticky-closed behavior.

## Commit Plan

1. `fix(worker): reopen join recruitment after explicit room recreate`
