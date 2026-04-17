---
name: post-approval-merge-flow
description: "Merge a reviewed PR after human approval using repository merge gates, then optionally continue through Issue close and local cleanup. Use when Codex is asked to own the post-approval sequence for a bot-created or task-owned PR."
---

# Post Approval Merge Flow

## Overview

Use this skill when the user wants Codex to take over after human review and approval.
This flow governs merge authorization, merged-state verification, and the optional downstream sequence of Issue close and local cleanup.

## Inputs

- Target PR URL or number
- Source of truth:
  - Issue
  - `tasks/*.md`
  - accepted bounded scope
- Execution profile (`Standard` or `High-Risk`)
- Whether the PR is bot-created / task-owned
- Human approval state
- Required checks state
- Review thread state
- Whether current request includes:
  - merge only
  - merge + close
  - merge + close + cleanup

## Workflow

1. Confirm request boundary:
   - Stop if the current request does not authorize merge.
   - Keep scope anchored to the PR's source Issue / `tasks/*.md`.

2. Confirm merge gate:
   - Verify there is human reviewer approval.
   - Verify required checks are green, or stop with `BLOCKED` unless explicit skip authority exists.
   - Verify unresolved actionable review threads do not remain.
   - Verify follow-up detection / close prerequisites are ready if close will follow.

3. Apply approval authority rule:
   - `Standard`: a human `Approve` on a bot-created or task-owned PR may serve as merge authorization when all merge gates are green.
   - `High-Risk`: require explicit user merge authorization or auto-merge permission in addition to approval.

4. Merge the PR:
   - Use the repository/default merge method unless the user asked for a specific one.
   - Do not self-approve.
   - Do not merge if approval/check/thread state is ambiguous.

5. Confirm merged state:
   - Require PR read-back showing merged state, merge commit SHA, or equivalent strong evidence.
   - Empty or silent write responses are not enough.

6. Run downstream steps only if requested:
   - `merge + close`: run [$issue-close-evidence-flow](C:/work/infinitas_arena/infinitas_arena/.codex/skills/issue-close-evidence-flow/SKILL.md)
   - `merge + close + cleanup`: after close, run [$worktree-branch-cleanup-guard](C:/Users/tts13/.codex/skills/worktree-branch-cleanup-guard/SKILL.md)

7. Report final status:
   - `COMPLETE` only if every requested downstream step finished and was verified.
   - Otherwise return `BLOCKED` or `ESCALATION` with the exact missing gate.

## Output Contract

Always return:
1. `Merge recommendation`
2. `Missing merge evidence`
3. `Merge execution summary`
4. `Downstream sequence status`
5. `Final status`

Use this template:

```text
Merge recommendation:
- <READY|BLOCKED|ESCALATION>
- reason: <summary>

Missing merge evidence:
- <none or list>

Merge execution summary:
- target PR: <pr>
- execution profile: <profile>
- approval state: <summary>
- required checks: <summary>
- review threads: <summary>
- merge result: <not run|merged>
- merged evidence: <merge commit sha / PR merged flag / URL>

Downstream sequence status:
- close: <not requested|complete|blocked>
- cleanup: <not requested|complete|blocked>

Final status: <COMPLETE|BLOCKED|ESCALATION>
```

## Rules

- Do not treat Codex-authored approval as merge authorization.
- Do not merge a `High-Risk` PR on approval alone.
- Do not merge with pending/failing required checks unless explicit authority exists and the skip is recorded.
- Do not close the Issue before merged state is confirmed.
- Do not run local cleanup before merged state is confirmed.
- Do not claim completion while any requested merge/close/cleanup step lacks read-back evidence.

## References

- `references/merge-checklist.md`
