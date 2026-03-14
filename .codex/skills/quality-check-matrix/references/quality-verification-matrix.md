# QUALITY Verification Matrix

Use this matrix to choose the minimum required checks for the current change.
Always apply universal checks first, then add conditional checks by touched area.

## Universal Checks (Always Required)

Source: `QUALITY.md` sections 1 and 2.

- Build succeeds (no type errors).
- Lint passes (no lint errors).
- Tests pass.
- No unnecessary dependency additions.
- Diff is limited to intended files.
- No unrelated formatting-only changes.
- Generated outputs are updated only when intentional.
- UTF-8 (no BOM) and LF consistency is preserved.

## Conditional Checks by Change Area

| Touched area | Required additional checks | Source |
| --- | --- | --- |
| Room FSM, timers, aggregation, host authority, expected_key enforcement, idempotency, WS protocol payload | Run all FSM/Protocol checks | `QUALITY.md` section 3 |
| Monitoring watcher/parser, source formats (`inf-notebook`, `inf_daken_counter`), source failure handling | Run all monitoring source checks | `QUALITY.md` section 4 |
| Multi-player room flow behavior (ARENA/BPL), timeout/force advance/skip, DO state loss flow | Run all E2E checks | `QUALITY.md` section 5 |
| Release prep tasks (Ph1) | Run release readiness checks | `QUALITY.md` section 6 |

## FSM/Protocol Checklist Scope

When section 3 is required, include:

- RoomState transitions.
- Timer behavior.
- expected_key enforcement (`accept_window=0`).
- idempotency by `client_msg_id`.
- host permissions.
- KV listing behavior (`expires_at`, paging limit/cursor).

## Monitoring Source Checklist Scope

When section 4 is required, include:

- `inf-notebook` extraction (`SCORE`, `MISSCOUNT`).
- `inf_daken_counter` extraction (`SCORE`, `MISSCOUNT`).
- `observed_key == expected_key` enforcement.
- `SOURCE_UNAVAILABLE` behavior with TECH skip guidance.

## E2E Checklist Scope

When section 5 is required, include:

- 2-player ARENA flow.
- 2-player BPL (3 round) flow.
- Duplicate pick replacement.
- Timeout (soft ttl) and FORCE_ADVANCE.
- Host proxy skip (after unlock).
- DO state loss to `ROOM_STATE_LOST` and room close.

## Practical Rule

- If uncertain whether a conditional area is touched, include the extra checks.
- If an environment constraint prevents execution, mark the check as `not run`, explain why, and note residual risk.
