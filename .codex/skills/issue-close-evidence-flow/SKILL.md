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

## Workflow

1. Decide whether the closure is `code` or `non-code`.
2. Load [docs/issue_close_evidence_template.md](C:/work/infinitas_arena/infinitas_arena/docs/issue_close_evidence_template.md).
3. Fill the closure-evidence section.
4. If the Issue is a milestone-management Issue, add the milestone audit table too.
5. Use [references/closure-checklist.md](references/closure-checklist.md) to verify status vocabulary, links, and evidence completeness.

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
