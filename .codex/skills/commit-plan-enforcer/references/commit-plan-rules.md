# Commit Plan Rules

Use this as the decision source for commit gating.

## Plan Mode Rules

Source: `WORKFLOW.md` section 5.2.

- Define commit granularity before implementation.
- Treat one plan item as one logical commit.
- Commit incrementally as each unit is completed.
- Ensure `git status` is clean before starting each next commit unit.
- Do not mix generated diffs and manual edits in one commit.
- Keep formatting-only changes in a separate PR.

## Local Execution Mode Rules

Source: `WORKFLOW.md` section 5.1.

- Detailed commit planning is not mandatory.
- Keep local fixes minimal and focused.
- Optionally group into 1 to 2 logical commits.
- Avoid producing many unstructured intermediate commits.

## Diff Discipline Rules

Source: `WORKFLOW.md` section 7 and `AGENTS.md` section 6.

- Include only required diffs for the task purpose.
- Exclude unrelated cleanup, reordering, or formatting noise.
- Do not edit generated outputs directly unless intentional.
- Do not touch lockfiles unless dependency update is intended.

## Pre-Commit Gate

Before allowing a commit in Plan Mode:

1. Selected plan item is explicit.
2. Changed files map to that item only.
3. No out-of-scope files are staged.
4. No prohibited diff patterns are detected.
5. Commit message reflects the selected item.
