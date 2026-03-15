---
name: quality-check-matrix
description: "Select required verification checks for infinitas_arena tasks using QUALITY.md, AGENTS.md, and WORKFLOW.md. Use when validating completion, preparing a PR, or reviewing risky changes to produce an area-aware checklist that always includes technical and diff validation, and conditionally adds FSM/Protocol, monitoring source, and E2E checks."
---

# Quality Check Matrix

## Overview

Determine the smallest sufficient verification set for a given change.
Apply universal checks to every task, then add area-specific checks only when related files or behaviors are touched.

## Inputs

- Requested change summary
- Expected changed files/layers
- Current mode (`Local Execution Mode` or `Plan Mode`)
- Repository quality rules:
  - `QUALITY.md`
  - `AGENTS.md`
  - `WORKFLOW.md`

## Workflow

1. Identify touched areas from the request and changed files.
2. Load `references/quality-verification-matrix.md`.
3. Select required checks:
   - Always include universal checks.
   - Add conditional checks only for matched areas.
4. Output a concise checklist using `references/validation-output-template.md`.
5. Execute available checks and record evidence.
6. Report skipped checks with explicit reasons.

## Decision Rules

- Include all checks from QUALITY section 1 and section 2 on every task.
- Include QUALITY section 3 only when FSM, timers, protocol, idempotency, host authority, or KV listing behavior is changed.
- Include QUALITY section 4 only when monitoring source parsers/watchers or observed/expected key handling is changed.
- Include QUALITY section 5 only when gameplay flow, timeout/force-advance, skip, or DO state loss behavior is changed.
- Include QUALITY section 6 when preparing a release-oriented change.

## Output Requirements

- Keep output minimal and actionable.
- Separate `Required now` from `Not required`.
- For each required check, show pass/fail/not-run and one-line evidence.
- If a check is not run, state why and what risk remains.

## References

- `references/quality-verification-matrix.md`
- `references/validation-output-template.md`
