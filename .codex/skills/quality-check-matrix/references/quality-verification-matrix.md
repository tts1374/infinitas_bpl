# QUALITY Verification Matrix

Use this matrix to choose the minimum required checks for the current change.
Always apply universal checks first, then add conditional checks by touched area.

## Universal Checks (Always Required)

Source: `QUALITY.md` sections 1 and 2.

- Build succeeds (no type errors) where applicable.
- Lint passes (no lint errors) where applicable.
- Tests pass where applicable.
- No unnecessary dependency additions.
- Diff is limited to intended files.
- No unrelated formatting-only changes.
- Generated outputs are updated only when intentional.
- UTF-8 (no BOM) and LF consistency is preserved.

## Conditional Checks by Change Area

| Touched area | Required additional checks | Source |
| --- | --- | --- |
| Room FSM, timers, aggregation, host authority, authoritative acceptance, idempotency, WS protocol payload/schema | Run all FSM/Protocol checks | `QUALITY.md` section 3 |
| Monitoring watcher/parser, source formats (`inf-notebook`, legacy/deprecated `inf_daken_counter` where still relevant), source failure handling | Run all monitoring source checks | `QUALITY.md` section 4 |
| Multi-player room flow behavior (ARENA/BPL), timeout/force advance/skip, recovery/failure behavior, DO state loss flow | Run all E2E checks | `QUALITY.md` section 5 |
| Release prep tasks (Ph1) | Run release readiness checks | `QUALITY.md` section 6 |
| Persistence/settings/snapshot compatibility changes | Run compatibility-focused validation required by root/local governance | root/local governance, `QUALITY.md` |
| Agent/governance definition changes | Run markdown/toml consistency and responsibility-boundary checks | root `AGENTS.md`, `WORKFLOW.md` |

## FSM/Protocol Checklist Scope

When section 3 is required, include:

- RoomState transitions.
- Timer/deadline behavior.
- expected-key / authoritative acceptance enforcement under the current contract.
- idempotency by `client_msg_id`.
- host permissions.
- public lobby summary behavior (visibility filtering, stale/expired listing handling).

## Monitoring Source Checklist Scope

When section 4 is required, include:

- `inf-notebook` extraction (`SCORE`, `MISSCOUNT`).
- legacy/deprecated `inf_daken_counter` behavior only if that path is actually touched.
- `observed_key == expected_key` enforcement where relevant.
- `SOURCE_UNAVAILABLE` behavior with TECH skip guidance.

## E2E Checklist Scope

When section 5 is required, include:

- 2-player ARENA flow.
- 2-player BPL (3 round) flow.
- Duplicate pick replacement.
- Timeout and FORCE_ADVANCE behavior where relevant.
- Host proxy skip (after unlock) where relevant.
- DO state loss to `ROOM_STATE_LOST` and room close.
- Recovery/reconnect behavior where the changed area makes it relevant.

## Practical Rule

- If uncertain whether a conditional area is touched, include the extra checks.
- If an environment constraint prevents execution, mark the check as `not run`, explain why, and note residual risk.
- Do not claim completion from universal checks alone when behavior semantics changed.