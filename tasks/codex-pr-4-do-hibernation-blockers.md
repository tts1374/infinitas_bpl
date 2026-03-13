# codex-pr-4-do-hibernation-blockers

## Base SHA
- `3f271daefcf133645d6dbf5ad22d8855fb11b8dc`

## Mode Decision
- Plan Mode
- Reason:
  - Durable Object timer/alarm behavior in `RoomDurableObject` is changed.
  - WebSocket heartbeat/broadcast behavior inside room flow is changed.
- Plan file:
  - `tasks/codex-pr-4-do-hibernation-blockers.md`

## Purpose
- Remove keepalive-only heartbeat handling in `RoomDurableObject`.
- Eliminate unnecessary periodic wake-ups that block Durable Objects hibernation.
- Keep only required deadline/reconnect/cleanup wake-ups.

## Non-goals
- No game rule or phase-transition contract changes.
- No durable de-duplication redesign.
- No close/reconnect contract redesign.
- No `ctx.acceptWebSocket()` migration work.
- No `LobbyDirectoryDO` contract changes.

## Changes
- Audit timer/alarm/heartbeat code paths in room worker logic.
- Remove or no-op keepalive-only heartbeat send/receive behavior.
- Remove unnecessary periodic `setInterval` / long-lived `setTimeout` usage.
- Keep deadline handling via state-derived next alarm scheduling only.
- Remove periodic no-change broadcast; keep broadcast event-driven.
- Add minimal comments where timer/alarm remains and why it is required.

## Invariants Impact
- `INV-01` preserved:
  - Worker stays thin; room timer/alarm logic remains in DO.
- `INV-02` preserved:
  - Room FSM phases stay unchanged.
- `INV-03` preserved:
  - Required phase/reconnect deadlines stay enforced.
- `INV-04` preserved:
  - `expected_key` enforcement behavior is unchanged.
- `INV-05` preserved:
  - Idempotency key and dedupe behavior are unchanged.
- `INV-06` preserved:
  - Host authority boundaries are unchanged.

## Impact
- Users:
  - No gameplay rule changes; idle traffic/wake-ups should decrease.
- Data:
  - No persistence schema changes.
- Compatibility:
  - No protocol redesign; heartbeat keepalive semantics are removed or no-op only.
- Cloudflare:
  - Fewer unnecessary wake-ups; alarm remains for required deadlines/cleanup only.

## Target Files / Layers
- Files:
  - `apps/client/src/services/ws-client.ts`
  - `apps/worker/src/durable/room-object.ts`
  - `packages/shared/src/constants/network.ts`
  - `packages/shared/src/ws/message-types.ts`
  - `tasks/codex-pr-4-do-hibernation-blockers.md`
- Layers:
  - client
  - worker
  - shared

## Test Focus
- `QUALITY.md` section 1 (build/type/lint/tests for touched scope)
- `QUALITY.md` section 2 (minimal diff, no unrelated format changes, UTF-8/LF)
- `QUALITY.md` section 3 (FSM/protocol safety: timeout/reconnect/authority/idempotency unchanged)
- `QUALITY.md` sections 4 and 5 are not required unless source I/O or E2E behavior is touched

## Rollback Plan
- Revert this branch to restore previous heartbeat/timer behavior.
- No data rollback or migration required.

## Commit Split Plan
1. Add Plan Mode artifact and confirm exact timer/heartbeat removal scope.
2. Implement minimal `RoomDurableObject` heartbeat/timer/alarm cleanup.
3. Apply minimal test updates and run required checks.

## Checklist
- [ ] Design doc alignment confirmed (contract change not required)
- [ ] Impact scope identified
- [ ] Implementation completed
- [ ] Tests completed
- [ ] Regression checks completed
- [ ] Documentation updates completed (if required)
