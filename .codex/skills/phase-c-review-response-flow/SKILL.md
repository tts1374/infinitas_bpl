---
name: phase-c-review-response-flow
description: "Handle a PR review iteration as a bounded Phase C continuation. Use when Codex receives review URLs or threads and needs to inspect actionable comments, keep scope anchored to the original Issue/task, rerun required validation/audit, and prepare or execute reply/resolve/re-review steps."
---

# Phase C Review Response Flow

## Overview

Use this skill when a user brings PR review feedback and expects Phase C work to continue from the existing source of truth.
Do not treat the review thread itself as a new specification.

## Inputs

- Source of truth:
  - `Issue`
  - `tasks/*.md`
  - linked PR
- Review context:
  - review URL
  - inline thread URL
  - unresolved review threads
- Current execution state:
  - touched layer
  - execution profile
  - current branch / diff state
- Applicable governance:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`

## Workflow

1. Restate that this is a `Phase C` continuation and keep the original `Issue` / `tasks/*.md` as the scope anchor.
2. Inspect review context with thread-aware reads and separate:
   - actionable unresolved threads
   - informational or already-resolved threads
3. Re-judge:
   - execution profile
   - contract-sensitive surface
   - whether `Replan Gate` is triggered
4. If the review fix stays in-scope, convert each actionable cluster into a bounded fix packet.
5. For `High-Risk` work, rerun required implementer / contract audit / implementation audit on the current state.
6. Run required validation from `QUALITY.md`.
7. Prepare GitHub write-back in this order:
   - thread reply
   - resolve addressed thread
   - re-review request after no unresolved actionable thread remains
8. Use [references/review-response-checklist.md](references/review-response-checklist.md) to keep the loop stable.

## Output Contract

Always return:
1. `Review response kickoff`
2. `Source of truth`
3. `Actionable thread set`
4. `Execution profile re-judgment`
5. `Validation and audit plan`
6. `GitHub write-back plan or completed actions`
7. `Final status`

Use this template:

```text
Review response kickoff: <READY|BLOCKED>

Source of truth:
- <Issue / tasks file / PR>

Actionable thread set:
- <thread / summary / severity>

Execution profile re-judgment:
- <Local-Fast|Standard|High-Risk>

Validation and audit plan:
- <required checks>

GitHub write-back plan or completed actions:
- reply: <planned|done|N/A>
- resolve: <planned|done|N/A>
- re-review request: <planned|done|N/A>

Final status:
- <COMPLETE|BLOCKED|ESCALATION>
```

## Rules

- Do not expand scope just because a review comment suggests a broader cleanup.
- Do not mark review work complete while actionable unresolved threads remain unaddressed.
- Do not resolve a thread without a substantive response tied to the final implementation.
- Do not request re-review while unresolved actionable threads remain.
- If a review requires contract change, cross-layer expansion, dependency update, or CI change, stop with `ESCALATION`.
