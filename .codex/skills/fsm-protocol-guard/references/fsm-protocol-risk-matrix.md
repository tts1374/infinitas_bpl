# FSM/Protocol Risk Matrix

Use this matrix to decide whether the change must be treated as high-risk.
If one or more rows match, choose `Plan Mode`.

| Risk trigger | Examples | Source |
| --- | --- | --- |
| Durable Object FSM/timer/aggregation/authority change | Room transition logic, timer behavior, host-only actions | `AGENTS.md` 7.2, 8.1; `WORKFLOW.md` 2 |
| WS schema/payload contract change | message `type`, payload shape, required fields | `AGENTS.md` 7.2; `WORKFLOW.md` 2 |
| Idempotency behavior change | de-dup key changes, replay handling change | `AGENTS.md` 8.2; `QUALITY.md` 3 |
| expected_key enforcement change | accept rules, timing windows, round checks | `AGENTS.md` 8.2, 9.1; `QUALITY.md` 3 |
| KV lobby behavior change | metadata schema, list filtering, paging behavior | `AGENTS.md` 8.3; `WORKFLOW.md` 2 |
| DO failure-mode change | `ROOM_STATE_LOST`, close flow, recovery rules | `AGENTS.md` 8.4; `QUALITY.md` 5 |
| Cross-layer contract change | client + worker + shared message/flow coupling | `WORKFLOW.md` 2; `AGENTS.md` 7.2 |
| Design-contract update required | update `docs/design/*` before implementation | `AGENTS.md` 3; `WORKFLOW.md` 2 |

## Local-Change Counterexamples

Usually not this skill's target:

- Local UI wording/display-only fixes.
- Minor validation changes inside existing responsibility.
- Test additions without behavior or contract change.
