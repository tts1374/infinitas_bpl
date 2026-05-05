# followup-server-time-offset-integration-proof

## Background
- Issue #179 added client-side server time offset handling from existing WS `server_time`.
- The focused tests verify corrected time behavior in the round presentation helper.
- Implementation audit found that coverage does not directly prove the full ingestion path from WS message handling to RoomPage timer decisions.

## Purpose
- Add focused integration-level proof that a received WS `server_time` updates client display timing inputs used by room presentation.

## Non-goals
- Do not change WS schema, worker timestamp semantics, or shared models.
- Do not change timer constants or authoritative game progression.
- Do not redesign RoomPage.

## Acceptance Criteria
- A focused test fails if `handleServerMessage` or the store path stops updating `serverTimeOffsetMs` from valid `server_time`.
- A focused test fails if RoomPage display timing reverts to raw local `Date.now()` for Round Result / MUSIC SELECT / PLAY START decisions.
- Existing Issue #179 skewed-clock helper tests remain passing.

## Target Layers / Files
- layer: client
- files: client room store / RoomPage presentation test harness; exact files may be selected during Phase A/B.

## Validation
- `npm run lint`
- `npm run typecheck`
- `npm --workspace @infinitas/client run test`
- `git diff --check`

## Recommended Execution Mode
- execution profile: Standard
- Plan Mode: YES

## Delegation Hint
- role: front-implementer
- spawned: later
- objective: add integration-level regression proof for server-time offset ingestion into room display timing.
- no-delegate reason: N/A
