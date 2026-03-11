---
name: commit-plan-enforcer
description: "Enforce task-level commit sequencing in infinitas_bpl. Use when a task has a commit split plan (especially Plan Mode with tasks/*.md) to map one planned item to one logical commit, block out-of-plan diffs, check git status cleanliness before each commit, and keep commit history aligned with WORKFLOW.md."
---

# Commit Plan Enforcer

## Overview

Use this skill to keep implementation commits consistent with the task plan.
Apply strict commit gating in Plan Mode and lightweight commit discipline in Local Execution Mode.

## Inputs

- Current execution mode (`Plan Mode` or `Local Execution Mode`)
- Task file (for Plan Mode): `tasks/<branch-or-pr-name>.md`
- `Commit Split Plan` section from the task file
- Current branch status and staged/unstaged diffs

## Workflow

1. Detect mode and commit policy scope using `references/commit-plan-rules.md`.
2. If `Plan Mode`, load `Commit Split Plan` from `tasks/*.md`.
3. Pick one planned item as the only allowed scope for the next commit.
4. Run pre-commit gate checks:
   - Scope matches the selected plan item.
   - No unrelated formatting/reorder/rename noise.
   - No unintended generated output.
   - No accidental dependency/lockfile changes unless planned.
5. Commit exactly one logical unit.
6. Mark the plan item as done and report next item.

## Rules

- `Plan Mode`:
  - Commit granularity must be explicit before implementation.
  - One plan item equals one logical commit.
  - Before each commit, repository state must be clean except intended changes for that item.
  - Do not mix generated diffs and manual edits in one commit.
  - Formatting-only changes are separate PR scope.
- `Local Execution Mode`:
  - Detailed commit plan is not mandatory.
  - Keep commits minimal and avoid unstructured commit spam.

## Output Format

Use `references/commit-checklist-template.md` and emit:

- Mode decision
- Selected plan item
- Pre-commit gate results
- Commit result
- Next allowed item

## References

- `references/commit-plan-rules.md`
- `references/commit-checklist-template.md`
