---
name: plan-mode-gate
description: "Determine whether a requested change in infinitas_arena must run in Plan Mode before implementation, using AGENTS.md, WORKFLOW.md, and QUALITY.md. Use when starting coding tasks to classify risk, output either a lightweight pre-execution note for Local Execution or a tasks file draft for Plan Mode, and gate implementation until the required artifact exists."
---

# Plan Mode Gate

## Overview

Use this skill at task intake to choose `Local Execution Mode` or `Plan Mode` with minimal ambiguity.
Apply repository governance first, then output only the mode-specific artifact required to start implementation safely.

## Inputs

- User request
- Expected affected files and layers (client, worker, shared, docs, CI)
- Repository rules from:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`

## Workflow

1. Summarize the requested change in 1 to 3 bullets.
2. Classify risk with `references/plan-mode-decision-matrix.md`.
3. Decide the execution mode:
   - If any plan-required trigger matches, choose `Plan Mode`.
   - Otherwise choose `Local Execution Mode`.
4. Output the required gate artifact:
   - `Plan Mode`: create `tasks/<branch-or-pr-name>.md` from `references/task-plan-template.md`.
   - `Local Execution Mode`: output a 3-line pre-execution note:
     - Target
     - Intended files
     - Validation method
5. Apply verification scope from `QUALITY.md`:
   - Always include technical validation and diff validation.
   - Add FSM/Protocol, source I/O, and E2E checks only when those areas are touched.
6. Enforce the gate:
   - If `Plan Mode`, do not implement until the plan file exists.
   - If `Local Execution Mode`, proceed with the smallest correct diff.

## Decision Rules

- Default to `Plan Mode` for architecture changes, DO FSM/timers/aggregation/authority changes, WS schema changes, source I/O spec changes, KV lobby schema/list/paging changes, compatibility-impacting data format changes, CI/deploy changes, dependency updates including lockfile, cross-layer changes, security/reproducibility/integrity impact, and design-doc-first contract changes.
- Default to `Local Execution Mode` for local UI/text/validation fixes, single-file bug fixes inside existing responsibilities, and test additions without behavioral change.
- If uncertain, choose `Plan Mode`.

## Output Formats

### Local Execution Note

```markdown
Target: <what is being changed>
Intended files: <specific files>
Validation: <minimal required checks>
```

### Plan Mode Note

```markdown
Mode decision: Plan Mode
Reason: <matched trigger(s)>
Plan file: tasks/<branch-or-pr-name>.md
Next step: Implement only after plan is written
```

## References

- `references/plan-mode-decision-matrix.md`
- `references/task-plan-template.md`
