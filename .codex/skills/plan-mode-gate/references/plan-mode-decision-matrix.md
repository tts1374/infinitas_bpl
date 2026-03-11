# Plan Mode Decision Matrix

Use this table to decide `Local Execution Mode` vs `Plan Mode`.
If one or more plan-required triggers match, choose `Plan Mode`.

## Plan-Required Triggers

| Trigger | Typical examples | Source |
| --- | --- | --- |
| Architecture change | Responsibility split changes, major flow redesign | `WORKFLOW.md` 2 |
| DO core behavior change | FSM, timers, aggregation, authority, idempotency | `WORKFLOW.md` 2, `AGENTS.md` 7.2, 8 |
| WebSocket contract change | `type`/`payload` schema changes | `WORKFLOW.md` 2, `AGENTS.md` 7.2 |
| Monitoring source I/O spec change | `inf_daken_counter` / `inf-notebook` input behavior changes | `WORKFLOW.md` 2, `AGENTS.md` 7.2, 9 |
| KV lobby contract change | Schema/list/paging behavior for lobby metadata | `WORKFLOW.md` 2, `AGENTS.md` 8.3 |
| Compatibility-impacting format change | `settings` / result snapshot format changes | `WORKFLOW.md` 2, `AGENTS.md` 7.2 |
| CI or deployment change | Wrangler, Workers, DO, KV pipeline/resource config | `WORKFLOW.md` 2, `AGENTS.md` 7.2 |
| Dependency update | Package/crate updates, lockfile change | `WORKFLOW.md` 2, `AGENTS.md` 7.2 |
| Cross-layer change | Spans client + worker + shared | `WORKFLOW.md` 2, `AGENTS.md` 7.2 |
| Security/reproducibility/integrity impact | Authz, replay safety, consistency constraints | `WORKFLOW.md` 2 |
| Requires design-doc contract update first | Implementation must follow updated `docs/design/*` | `WORKFLOW.md` 2, `AGENTS.md` 3 |

## Usually Local Execution

| Condition | Typical examples | Source |
| --- | --- | --- |
| Localized change in existing responsibility | Single-file bug fix, local validation tweak | `WORKFLOW.md` 1.A, 2 |
| UI-only update | Text, i18n, small rendering fix | `WORKFLOW.md` 1.A, 2 |
| Test-only reinforcement | Add test without behavior change | `WORKFLOW.md` 1.A, 2 |

## Validation Scope Mapping

Always apply:
- Technical checks: build, lint, test, no unnecessary dependency additions.
- Diff checks: only intended files, no unrelated formatting, no generated noise, UTF-8 no BOM and LF consistency.

Add checks only when changed area matches:
- FSM/Protocol touched: apply `QUALITY.md` section 3 checks.
- Monitoring source touched: apply `QUALITY.md` section 4 checks.
- End-to-end room flow touched: apply `QUALITY.md` section 5 checks.

## Tie-Breaker Rule

If classification is uncertain, choose `Plan Mode`.
