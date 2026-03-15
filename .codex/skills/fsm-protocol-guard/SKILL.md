---
name: fsm-protocol-guard
description: "Guard high-risk Room FSM and WebSocket protocol work in infinitas_arena. Use when a task touches Durable Objects state transitions, timers, aggregation, expected_key enforcement, idempotency, host authority, WS schema/payload contracts, lobby KV behavior, or ROOM_STATE_LOST failure handling, to enforce Plan Mode and produce invariant-aware verification requirements."
---

# Fsm Protocol Guard

## Overview

Use this skill before implementing or reviewing high-risk room flow changes.
Force explicit guardrails so FSM/protocol changes remain contract-safe and testable.

## Inputs

- User request and intended behavior change
- Candidate files and layers
- Existing contract sources:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`
  - `docs/design/01_fsm.md`
  - `docs/design/02_ws_protocol.md`
  - `docs/design/03_data_model.md`
  - `docs/design/07_constants.md`

## Workflow

1. Detect whether the change touches FSM/protocol risk areas with `references/fsm-protocol-risk-matrix.md`.
2. Require `Plan Mode` when one or more risk triggers match.
3. Check invariant impact with `references/fsm-protocol-invariants.md`.
4. If contracts must change, update design docs first, then implement.
5. Produce a verification checklist using `references/fsm-protocol-checklist-template.md`.
6. Block completion until all required checks are executed or explicitly marked `not run` with residual risk.

## Guard Rules

- Worker routes remain thin; Durable Object owns FSM, timers, aggregation, authority, idempotency, and broadcast.
- Enforce idempotency with `client_msg_id` de-dup by `(player_id, client_msg_id)`.
- Enforce `observed_key == expected_key` and round-index validity before confirm/submit paths.
- Keep lobby KV lightweight metadata only; exclude expired rooms by `expires_at`.
- Handle DO state loss by closing room with `ROOM_STATE_LOST`.

## Required Validation Scope

- Always include `QUALITY.md` section 1 and section 2 checks.
- Always include `QUALITY.md` section 3 for FSM/protocol changes.
- Add `QUALITY.md` section 4 and section 5 when source I/O or end-to-end behavior is touched.

## Output Format

Use this structure:

```markdown
Mode decision: Plan Mode
Risk triggers:
- <trigger 1>
- <trigger 2>

Invariants impacted:
- <invariant id>: <impact summary>

Required checks:
- [ ] <check>
- [ ] <check>

Not required:
- <check group>: <reason>

Residual risks:
- <risk or None>
```

## References

- `references/fsm-protocol-risk-matrix.md`
- `references/fsm-protocol-invariants.md`
- `references/fsm-protocol-checklist-template.md`
