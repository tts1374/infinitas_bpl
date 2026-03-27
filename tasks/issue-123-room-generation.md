# issue-123-room-generation

## Purpose
- Implement minimal room recreation on same `room_id` after invalid/expired room, with new `generation`.
- Keep TTL expiration behavior intact while allowing only last host to recreate within the allowed window.

## Non-goals
- No auto-follow, auto-rejoin, or participant state restoration.
- No auto-rematch implementation.
- No unrelated refactor, rename, or formatting-only updates.

## Changes
- Add `generation` to room state/protocol and enforce stale-generation rejection on mutable room operations.
- Implement recreate flow in worker (same `room_id`, new generation, lobby reset, last-host-only, stale-safe conflict handling).
- Update lobby listing semantics so recreated public rooms are listed immediately with replacement behavior.
- Update client room state handling and invalid-room UX:
  - Non-host returns to lobby list (no waiting mode).
  - Private rejoin modal gets last successful `join_code` as initial value (manual submit only).
- Keep `match_id` responsibility unchanged (match-scoped issuance on `START_MATCH` only).
- Add/update tests for generation increment, recreate eligibility, stale rejection, conflict safety, and UI flows.
- Update normative design docs where contract/spec changes are introduced, then align implementation.

## Impact
- Users: Host can recreate expired/invalid room with same room code; non-host flows return to list with manual rejoin path.
- Data: Adds room generation and recreate-related metadata/state checks; no historical participant recovery store.
- Compatibility: WS payload contracts for mutable operations include generation; old clients are version-gated.
- Cloudflare: Durable Object lifecycle/authority checks and lobby directory update flow are extended.

## Target Files / Layers
- Files:
  - `shared/src/types/*` (room/protocol types)
  - `worker/src/durable/room.ts` and related room handlers/tests
  - `worker/src/durable/lobby-directory.ts` and related tests (if required for replacement semantics)
  - `client/src/*` room state store, ws message sender, lobby/join modal/error flow
  - `docs/design/01_fsm.md`, `docs/design/02_ws_protocol.md`, `docs/design/03_data_model.md`, `docs/design/07_constants.md` (as needed)
- Layers: shared / worker / client / docs

## Test Focus
- Technical: package builds, lint, and tests for touched modules.
- Diff: intended files only; UTF-8 (no BOM) and LF integrity.
- FSM/Protocol:
  - stale generation operations are rejected (`READY_SET`, `START_MATCH`, `RETURN_TO_LOBBY`, `RESULT_SUBMIT`, `ROOM_LEAVE`)
  - recreate acceptance only for last host and only when no active current generation
  - recreate race: only first request succeeds
- E2E-equivalent behavior checks for public/private post-expiry return-to-list and manual rejoin path.

## Rollback Plan
- Disable recreate command path and generation enforcement by reverting worker/shared/client commits in reverse order.
- If emergency mitigation is needed, temporarily reject recreate attempts server-side while preserving existing room behavior.

## Commit Split Plan
1. Design docs + shared contract updates (`generation` and protocol payload changes).
2. Worker room recreate flow, generation guards, and lobby replacement semantics.
3. Client state/message updates and invalid-room UX/private join-code initial value flow.
4. Tests for worker/client generation and recreate scenarios.
5. Final validation-only adjustments (if required) with no behavior changes.

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)

## Validation Notes
- Executed: `npx tsx --test apps/worker/src/durable/room-state.test.mjs apps/worker/src/durable/room-object.test.mjs apps/worker/src/durable/contract-guards.test.mjs apps/worker/src/master/chart-master.test.mjs apps/worker/src/routes/join.test.mjs` (pass: 57, fail: 0)
- Executed: `git diff --check` (no fatal diff errors)
- Executed: changed-file BOM scan (no UTF-16 / UTF-8 BOM detected)
- Not executable in current environment:
  - `npm run test:worker` (`tsx` not found in current dependency state)
  - project-wide `typecheck` (`tsc`/front-end type deps missing)

## Mode Decision
- Mode decision: Plan Mode
- Reason: Durable Object lifecycle/FSM changes, WebSocket contract updates, and cross-layer (`shared`/`worker`/`client`) implementation.
- BASE_SHA: `421990ee5255f9607594b46328df8f0f6e4f8090`
