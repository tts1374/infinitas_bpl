# issue-124-public-share

## Purpose
- Implement Issue #124 scope for PUBLIC room sharing: SNS share entry, join page -> deep link flow, join URL validity checks, and minimum analytics logging.

## Non-goals
- URL-only room entry (join_code-less auto-join).
- Exposing `join_code` in shared URL, join page, or deep link payload.
- PRIVATE room sharing behavior changes.
- FSM/protocol redesign outside the required API/flow additions.

## Changes
- Add Worker join-status API for join page (`r` param) with share-validity evaluation.
- Replace web join-page mock fallback with strict API-backed summary + minimal analytics events.
- Add client share UI for PUBLIC host in initial `LOBBY` only, with optional join_code insertion into X text (default OFF) and copy URL action.
- Add deep-link receiving on Tauri app side and route to Lobby join flow with prefilled room id while keeping join_code manual input.
- Reject/ignore deep-link-based room move when already in an active room.
- Add tests for new Worker API and client/web flow helpers.

## Impact
- Users: PUBLIC room hosts can share recruit links to SNS; participants can open join page and transition to app join flow safely.
- Data: No schema migration; adds read-only join status API response and lightweight event logging.
- Compatibility: Existing WS room protocol remains unchanged; join entry remains join_code-gated.
- Cloudflare: Worker route additions only; no new DO/KV bindings.

## Target Files / Layers
- Files:
  - `apps/worker/src/index.ts`
  - `apps/worker/src/routes/*` (new join status route)
  - `apps/worker/src/durable/room-object.ts` (internal join status fetch endpoint)
  - `apps/worker/src/types/*` (API type additions)
  - `apps/web/src/lib/join-room.ts`
  - `apps/web/src/pages/Join.tsx`
  - `apps/client/src/pages/RoomPage.tsx`
  - `apps/client/src/pages/LobbyPage.tsx`
  - `apps/client/src/services/tauri-bridge.ts`
  - `apps/client/src/app/App.tsx`
  - `apps/client/src-tauri/src/lib.rs`
  - `apps/client/src-tauri/Cargo.toml`
  - `apps/client/src-tauri/tauri.conf.json`
  - related tests for worker/client/web
- Layers:
  - worker
  - web
  - client
  - tauri (desktop)

## Test Focus
- Worker: route tests for join-status response mapping (`recruiting/full/closed/expired`) and URL invalid conditions.
- Web: join page summary fetch path and deep-link auto/manual retry behavior.
- Client: share visibility gating (PUBLIC + host + initial LOBBY), text generation, and deep-link room-id prefill behavior.
- Tauri/client integration: deep-link event propagation guard when already joined.
- Universal checks: build/lint/test and diff/encoding validation.

## Rollback Plan
- Revert this task's commits to remove join-status route, web API hookup, and client deep-link/share additions.
- Fallback behavior returns to existing lobby/manual join flow and static join page.

## Commit Split Plan
1. Worker join-status API and tests.
2. Web join-page API integration and analytics hooks.
3. Client share UI + deep-link receive handling and tests.

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (not required for this local contract-preserving change)
- [x] BASE_SHA recorded: `317b16cdba203fb73320ffd770ae02f4939fd71a`
