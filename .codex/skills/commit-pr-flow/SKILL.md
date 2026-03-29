---
name: commit-pr-flow
description: "Run a Phase C commit and PR flow from bounded plan items with strict scope control, validation gating, and review-ready output. Use when implementation is done and you need to stage intended files only, verify plan-to-diff alignment, create logical commits, and prepare or open a PR."
---

# Commit Pr Flow

## Overview

Use this skill after bounded implementation work is complete and ready to be finalized in Phase C.
Convert a scoped diff into reviewable commits and a PR without expanding scope.

## Inputs

- Task label or plan item label
- In-scope files or subtree
- Explicit non-goals and forbidden scope
- Required validation level from `QUALITY.md`
- Current git state (`status`, changed files, diff summary)
- Base branch (default: `v1`)

## Workflow

1. Confirm phase boundary:
- Run only in Phase C.
- Stop and escalate if requirement shaping or execution planning is still unresolved.

2. Confirm scope boundary:
- Compare changed files to declared in-scope files.
- Isolate or defer unrelated changes.
- Keep `1 plan item = 1 logical commit` when practical.

3. Run commit gate:
- Check staged diff matches the selected plan item.
- Keep generated file changes separated from handwritten logic when possible.
- Do not stage files outside declared ownership.

4. Run validation gate:
- Select minimum required checks from `references/phase-c-gate-checklist.md`.
- Execute required checks before commit.
- Record pass/fail/skip with concrete reason.

5. Create commit:
- Stage only intended files.
- Use a clear message with scope context.
- Do not amend unrelated commits.
- Do not hide failed checks.

6. Prepare PR:
- Use `references/pr-template-phase-c.md`.
- Include objective, changes, non-changes, impact, validation evidence, and regression checks.
- Add rollback and compatibility notes for high-risk changes.

7. Final consistency gate:
- Ensure diff remains within declared scope.
- Ensure required validation evidence is present.
- Ensure completion status is explicit (`complete` or `blocked`).

## Output Contract

Always return:
- Scope check result
- Validation result summary
- Commit units created (hash + message)
- PR title and body (or PR URL if created)
- Open risks, if any
- Final status: `complete` or `blocked`

## Escalation Conditions

- Out-of-scope files are required to finish current task.
- Required validation fails.
- Contract-sensitive impact is discovered unexpectedly.
- Plan item is too broad to commit safely as one logical unit.

## Prohibited Behavior

- Do not stage all changes blindly.
- Do not open a PR with unresolved required checks unless explicitly approved.
- Do not mix unrelated cleanup with scoped implementation.
- Do not claim completion while `Blocker` or unresolved `Must fix` findings remain.

## References

- `references/phase-c-gate-checklist.md`
- `references/pr-template-phase-c.md`
