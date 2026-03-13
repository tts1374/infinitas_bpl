# codex-room-do-hibernation-pr1

## Base SHA
- `813b727898adb7e5e3f95eacf58018da85fff6d6`

## Purpose
- Migrate `RoomDurableObject` WebSocket handling from standard accept/listener flow to Durable Objects WebSocket Hibernation API.
- Make socket session cache rebuildable from `ctx.getWebSockets()` + WebSocket attachment after constructor re-entry.

## Non-goals
- No durable persistence for `seenClientMessageIds`.
- No reconnect grace redesign or `match_generation` introduction.
- No heartbeat/alarm/timer redesign.
- No `LobbyDirectoryDO` behavior changes.

## Changes
- Replace `serverSocket.accept()` / `addEventListener(...)` flow with `ctx.acceptWebSocket(...)` and DO event handlers.
- Introduce typed socket attachment helpers and cache rebuild path.
- Update `ROOM_JOIN` success path to persist `playerId/joinedAt/role` into attachment.
- Keep `sessionsBySocket` as rebuildable in-memory cache (not source of truth).

## Impact
- Users: None intended (infrastructure migration only).
- Data: Room state persistence stays unchanged; socket attachment stores per-connection metadata.
- Compatibility: WS message contract unchanged.
- Cloudflare: Uses Durable Objects Hibernation API for accepted sockets and lifecycle handlers.

## Target Files / Layers
- Files:
  - `apps/worker/src/durable/room-object.ts`
  - `tasks/codex-room-do-hibernation-pr1.md`
  - Additional worker-local type/test files only if strictly required by compile/tests
- Layers:
  - worker

## Test Focus
- `QUALITY.md` section 1 (build/type/lint/tests for touched scope)
- `QUALITY.md` section 2 (minimal diff + encoding/line endings)
- `QUALITY.md` section 3 (FSM/protocol safety checks for unchanged routing/authority/idempotency behavior)
- `QUALITY.md` sections 4-5 are not required unless source I/O or E2E behavior is touched by this diff

## Rollback Plan
- Revert this branch/PR to restore previous WebSocket accept/listener implementation.
- No data migration required because room persistent state schema is unchanged.

## Commit Split Plan
1. Add Plan Mode artifact for Hibernation migration scope.
2. Implement `room-object.ts` Hibernation API migration + attachment rebuild path.
3. Apply minimal related type/test adjustments if required by validation.

## Checklist
- [x] Design doc alignment confirmed (no contract change requiring doc update)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed (automated scope)
- [x] Documentation updates completed (not required for this PR)

## Execution Results
- `npm --workspace @infinitas/worker run typecheck` : pass
- `npm run test:worker` : pass
- `npm run lint` : pass
- `npm run typecheck` : pass
- `npm --workspace @infinitas/worker exec wrangler deploy --dry-run` : pass
- `QUALITY.md` section 3 full manual checklist : not run (manual/E2E-style verification pending)
