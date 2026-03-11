# FSM/Protocol Invariants

Use these invariant IDs when reporting impact.

| ID | Invariant | Source |
| --- | --- | --- |
| INV-01 | Worker route is thin; Durable Object owns FSM/timers/aggregation/broadcast/authority/idempotency | `AGENTS.md` 8.1 |
| INV-02 | Room state transitions follow design contract (`LOBBY -> READY_CHECK -> PICKING -> PLAYING -> RESULT -> CLOSED`) | `QUALITY.md` 3 |
| INV-03 | Timer behavior remains consistent with contract durations and transitions | `QUALITY.md` 3 |
| INV-04 | `expected_key` enforcement remains strict (`accept_window=0`) | `QUALITY.md` 3 |
| INV-05 | Idempotency de-duplicates by `(player_id, client_msg_id)` | `AGENTS.md` 8.2; `QUALITY.md` 3 |
| INV-06 | Host authority boundaries remain intact (`START`, force advance, host skip) | `QUALITY.md` 3 |
| INV-07 | KV lobby stores lightweight metadata only and excludes expired entries by `expires_at` | `AGENTS.md` 8.3; `QUALITY.md` 3 |
| INV-08 | DO state loss closes room with `ROOM_STATE_LOST`; clients show blocking error | `AGENTS.md` 8.4; `QUALITY.md` 5 |
| INV-09 | Monitoring submit path accepts only matching `observed_key` and valid `round_index` | `AGENTS.md` 9.1 |

## Impact Review Questions

For each changed area, answer:

- Which invariant IDs are affected?
- Is behavior preserved, tightened, or changed?
- If changed, which design docs are updated first?
- Which QUALITY checks prove safety?
