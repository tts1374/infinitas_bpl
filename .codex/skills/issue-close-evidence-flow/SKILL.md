---
name: issue-close-evidence-flow
description: "Prepare compliant closure evidence comments for normal Issues and milestone management Issues. Use when Codex is about to close an Issue and needs the exact closure evidence body, including code versus non-code handling, follow-up links, and milestone audit-log rows when required."
---

# Issue Close Evidence Flow

## Overview

Use this skill only when the work is actually ready to close or when you need to identify what evidence is still missing.
Do not use it for generic progress reports.

## Inputs

- Issue type:
  - normal Issue
  - milestone management Issue
- Completion mode:
  - code
  - non-code
- PR URL or commit SHA, if code
- Follow-up Issue/PR links, if any
- Follow-up detection sources:
  - Issue body / comments
  - merged PR body / comments
  - Phase D output
  - `tasks/issue-*.md`

## Workflow

1. Decide whether the closure is `code` or `non-code`.
2. Collect closure evidence:
   - PR URL or commit SHA when `code`
   - non-code completion reason when `non-code`
3. Detect follow-ups only from explicit sources:
   - Issue body / comments
   - merged PR body / comments
   - Phase D output
   - `tasks/issue-*.md`
4. If follow-up is only inferable and not explicitly linked, stop with `BLOCKED`.
5. Load [docs/issue_close_evidence_template.md](C:/work/infinitas_arena/infinitas_arena/docs/issue_close_evidence_template.md).
6. Fill the closure-evidence section.
7. If the Issue is a milestone-management Issue, add the milestone audit table too.
8. If executing the close, post the closure evidence comment and confirm its existence by returned comment URL/id or read-back before closing the Issue.
9. Use [references/closure-checklist.md](references/closure-checklist.md) to verify status vocabulary, links, follow-up evidence completeness, and close ordering.

## Output Contract

Always return:
1. `Close recommendation`
2. `Missing evidence`
3. `Comment body`
4. `Final status`

Rules:
- If required evidence is missing, recommend `BLOCKED` instead of fabricating closure text.
- Preserve repository status vocabulary.
- For non-code closure, explain why code evidence is `N/A`.
- If no explicit follow-up is found, write `なし`.
- Do not invent follow-up numbers from implication alone.
- Closure evidence comment must be ready before recommending the close action.
- Do not close an Issue until the posted closure evidence comment is confirmed to exist.
