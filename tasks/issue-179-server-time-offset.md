# issue-179-server-time-offset

## Purpose
- Implement Issue #179 by correcting client room display timers with server time offset derived from WS `server_time`.
- Keep Round Result / MUSIC SELECT / PLAY START / IN PLAY display timing stable when the local PC clock is ahead of or behind server time.

## Non-goals
- Do not remove the #177 Round Result 10-second safety window.
- Do not change PICKING TTL, `ROUND_MUSIC_SELECT_SECONDS`, `ROUND_PLAY_BEGIN_AT_SECONDS`, or other timer constants.
- Do not move authoritative game progression from worker/DO to client.
- Do not redesign the room UI or change source submission behavior.

## Current Request Boundary
- Ceiling: implementation ready only after this artifact exists and C Kickoff is completed.
- Allowed outputs now: task artifact creation, C Kickoff in a later turn, bounded implementation after kickoff authorization, validation, audit, Phase D summary.
- Forbidden outputs now: implementation before C Kickoff, commit, PR, release, unrelated refactor.
- Next unlock condition: later Phase C turn must emit C Kickoff with delegation execution record before code changes.

## Changes
- Store or derive a client-side server time offset from received WS envelopes using existing `server_time`.
- Use corrected current time for RoomPage display timers and phase presentation instead of raw `Date.now()`.
- Preserve existing reconnect/local-only timers unless they intentionally depend on server room time.
- Add regression tests covering local clock behind and ahead for Round Result and MUSIC SELECT/PLAY START transitions.
- Do not change shared/worker wire schema unless Replan Gate is triggered.

## Impact
- Users: room phase display timing aligns with server time even when the PC clock is skewed.
- Data: no persistence or migration expected.
- Compatibility: uses existing additive-free WS envelope field; no client/server schema change expected.
- Cloudflare: no Worker/DO runtime behavior change expected.

## Target Files / Layers
- Files: `apps/client/src/stores/room-store.ts`, `apps/client/src/pages/RoomPage.tsx`, `apps/client/src/features/room/round-phase.ts`, focused room tests.
- Conditional files: `packages/shared/**`, `apps/worker/**`, `docs/design/**` only after Replan Gate.
- Layers: client primary; shared/worker contract read-only by default.

## Validation Plan
- `npm run lint`
- `npm run typecheck`
- `npm --workspace @infinitas/client run test`
- `npm run test:client-stats`
- `npm run test:worker`
- `npm run check:design-contracts`
- `git diff --check`

## Rollback Plan
- Revert the client offset helper/store usage and focused tests. No data rollback expected.

## Commit Split Plan
1. Client server-time offset display fix and focused regression tests.

## Delegation Packet
- task label: issue-179-server-time-offset
- objective: make room display timers use server-time-corrected now while preserving existing authoritative server progression and #177 Round Result behavior.
- success criteria: slow/fast local clock tests pass; Round Result does not overstay or disappear prematurely; no constants/wire schema changes unless replanned.
- in-scope files/layer: client room store/time helper, RoomPage display timer consumers, focused tests.
- non-goals: Worker authority changes, shared schema changes, source behavior changes, UI redesign.
- forbidden scope: timer constant changes, generated artifacts, lockfile changes, unrelated formatting.
- allowed side effects: focused test additions and minimal helper extraction.
- expected output: implementation diff, validation results, contract audit status, implementation audit status.
- validation: run the validation plan above.
- continue-without-escalation boundary: client-only use of existing `server_time` for display timing.
- escalation: any need for new WS fields, worker timestamp semantics, shared model changes, compatibility migration, or design contract change.
