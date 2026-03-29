---
name: plan-mode-gate
description: "Reference skill for Plan Mode decision support. Used by strategy_orchestrator or execution_coordinator to classify whether Plan Mode is required. This skill does not replace stage/routing decisions and does not by itself authorize implementation."
---

# Plan Mode Gate

## Overview

Use this skill only as a reference aid for `strategy_orchestrator` or `execution_coordinator` when deciding whether work should run in `Local Execution Mode` or `Plan Mode`.

This skill does not:
- replace stage classification
- replace team-shape selection
- replace bounded handoff preparation
- authorize direct implementation by itself

It only supports the Plan Mode decision using repository governance.

## Inputs

- User request
- Current task framing from the orchestrating agent
- Expected affected files and layers (client, worker, shared, docs, CI, web, update-worker)
- Repository rules from:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`

This skill should be invoked only after the orchestrating agent has already framed the task enough to evaluate risk.

## Workflow

1. Summarize the requested change in 1 to 3 bullets.
2. Classify risk with `references/plan-mode-decision-matrix.md`.
3. Decide whether repository rules imply:
   - `Plan Mode required`
   - `Local Execution Mode allowed`
4. Return only:
   - mode recommendation
   - matched trigger(s) or local-execution basis
   - minimum validation scope implied by `QUALITY.md`
   - whether a plan artifact is required before implementation

Do not:
- perform stage classification beyond Plan Mode support
- prepare team shape
- create downstream handoff packets
- proceed into implementation by yourself

## Decision Rules

- Default to `Plan Mode` for architecture changes, DO FSM/timers/aggregation/authority changes, WS schema changes, source I/O spec changes, public lobby contract changes, compatibility-impacting data format changes, CI/deploy changes, dependency updates including lockfile, cross-layer changes, security/reproducibility/integrity impact, and design-doc-first contract changes.
- Default to `Local Execution Mode` for local UI/text/validation fixes, single-file bug fixes inside existing responsibilities, and test additions without behavioral change.
- If uncertain, choose `Plan Mode`.

These rules support orchestration. They do not replace orchestrator ownership of scope/routing decisions.

## Output Formats

### Local Execution Recommendation

Mode recommendation: Local Execution Mode
Basis: <why plan-required triggers do not match>
Suggested validation: <minimal required checks>

### Plan Mode Recommendation

Mode recommendation: Plan Mode
Reason: <matched trigger(s)>
Required artifact: tasks/<branch-or-pr-name>.md
Suggested next step for orchestrator: create or request the required plan artifact before implementation

## References

* `references/plan-mode-decision-matrix.md`
* `references/task-plan-template.md`