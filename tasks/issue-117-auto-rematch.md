# issue-117-auto-rematch

## Purpose
- Add private-room-only auto rematch mode that advances to next match after RESULT countdown when safety conditions are met.

## Non-goals
- No behavior change for PUBLIC rooms.
- No room recreation flow.
- No host handover, variable countdown, or rematch settings screen.
- No lobby listing filter/schema changes.

## Changes
- Extend shared room/ws models for private auto rematch flags, countdown state, generation token, and per-player opt-out.
- Add room-create UI option (`auto rematch`) visible only for PRIVATE room creation.
- Extend result UI with auto-rematch badge/countdown and actions (`stop auto rematch`, `skip next match`, `leave`).
- Implement DO internal auto-rematch flow: RESULT(20s) -> internal RETURN_TO_LOBBY -> auto ready selected players -> internal START_MATCH -> PICKING.
- Enforce start/cancel conditions and generation guard for stale timer/messages.
- Prevent RESULT countdown-time join during private auto-rematch countdown.

## Impact
- Users: Private room users can continuously rematch with fewer manual steps.
- Data: Adds in-room transient state fields only.
- Compatibility: Existing protocol preserved; adds optional fields/messages.
- Cloudflare: Room DO logic/timers and WS handling are extended.

## Target Files / Layers
- Files:
  - `shared/*` room/protocol types and constants
  - `worker/*` room durable object fsm/ws handlers
  - `client/*` room create modal + result view + ws action wiring
  - tests for worker/client flow touched by this issue
- Layers: client / worker / shared

## Test Focus
- Technical: build, lint, unit/integration tests in touched packages.
- Diff: only intended files, no formatting-only changes, UTF-8 (no BOM) and LF integrity.
- FSM/Protocol: RESULT->LOBBY->PICKING path, host authority preservation, generation stale-fire prevention.
- E2E-focused checks (at least automated/integration equivalents): private on/off, opt-out branch, player leave, source unavailable, host disconnect, public unaffected.

## Rollback Plan
- Disable new auto-rematch path by forcing `autoRematchEnabled=false` server-side and hiding client controls.
- Revert commits in reverse order (client UI, worker flow, shared types) if regression is detected.

## Commit Split Plan
1. shared contract/types/constants for auto rematch.
2. worker DO state + timer + internal event flow and guards.
3. client room create/result UI + ws actions.
4. tests for new behavior and regressions.
5. docs/design updates and task checklist sync.

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [ ] Regression checks completed
- [x] Documentation updates completed (if required)
