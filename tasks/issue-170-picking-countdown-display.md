# issue-170-picking-countdown-display

## Purpose
- Fix divergent song-pick wait countdown display from Issue #170 while preserving the existing timer contract.

## Non-goals
- Do not change PICKING TTL values.
- Do not change WS schema, `RoomStateSnapshot`, shared timer constants, Worker FSM, or Worker deadline authority.
- Do not redefine `ROUND_MUSIC_SELECT_SECONDS=45` as PICKING wait time.

## Current Request Boundary
- Ceiling: implementation ready
- Allowed outputs now: task artifact, bounded client implementation, focused tests, validation evidence
- Forbidden outputs now: commit, PR, release, unrelated refactors
- Next unlock condition: none

## Changes
- Derive the client pick-wait countdown only from authoritative `snapshot.timers.picking_deadline`.
- Use the same derived countdown for picker modal and room selection display.
- Avoid presenting a fallback TTL as an authoritative countdown when `picking_deadline` is absent.
- Add focused regression tests for the countdown derivation.

## Impact
- Users: pick-wait countdown should no longer diverge between player views for the same snapshot deadline.
- Data: none.
- Compatibility: no schema or persisted-data change planned.
- Cloudflare: no Worker deployment behavior change planned.

## Target Files / Layers
- Files: `apps/client/src/pages/RoomPage.tsx`, `apps/client/src/components/SongSearchModalView.tsx`, focused client room helper/test files.
- Layers: client.

## Test Focus
- Same deadline and clock input yields the same remaining seconds regardless of consuming surface.
- Missing `picking_deadline` returns no authoritative countdown instead of a fallback TTL.
- Expired deadlines clamp to zero.
- PLAYING `MUSIC SELECT:45` remains separate from PICKING countdown.

## Rollback Plan
- Revert the client helper, display wiring, and tests to restore the previous UI fallback behavior.

## Commit Split Plan
1. Client countdown derivation and display wiring.
2. Focused regression tests.

## Delegation Packet
- task label: issue-170-picking-countdown-display
- objective: make client pick-wait countdown display consistently reflect Worker-authoritative `picking_deadline`.
- success criteria: modal and room display consume the same derived countdown; null deadline does not show a fallback authoritative-looking countdown; tests cover same-deadline, null-deadline, and expired-deadline cases.
- in-scope files/layer: client files listed above.
- non-goals: Worker/shared/schema/timer contract changes.
- forbidden scope: unrelated UI redesign, lockfile changes, generated artifacts.
- allowed side effects: focused client tests and minimal type updates.
- expected output: implementation diff plus validation results.
- validation: `npm run lint`, `npm run typecheck`, `npm run test:worker`, focused client test command.
- continue-without-escalation boundary: client-only display and test changes.
- escalation: any need to change Worker deadline generation, shared constants, WS payload/schema, snapshot compatibility, or PICKING TTL semantics.
