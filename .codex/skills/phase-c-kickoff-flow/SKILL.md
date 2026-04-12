---
name: phase-c-kickoff-flow
description: "Create Phase C kickoff artifacts before implementation starts. Use when Phase A/B is already decided and Codex needs to restate the source of truth, re-judge execution profile, apply the Spawn Gate, and emit a `delegation execution record` from an Issue, `tasks/*.md`, or A-lite agreement."
---

# Phase C Kickoff Flow

## Overview

Use this skill only after Phase A/B inputs are already available.
Do not use it for initial requirement shaping or task breakdown.

## Inputs

- Source of truth:
  - `Issue`
  - `tasks/*.md`
  - A-lite agreement summary
- Current Phase A/B result, if already stated
- Expected touched layers
- Applicable governance:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`

## Workflow

1. Confirm that Phase C is the next intended step.
2. Identify the source of truth and restate it explicitly.
3. Re-judge:
   - execution profile
   - Plan Mode status
   - Spawn Gate result
4. Emit `delegation execution record` entries for each role that matters now.
5. If a mandatory spawn path is missing, return `BLOCKED` instead of silently continuing.
6. Use [references/kickoff-checklist.md](references/kickoff-checklist.md) and [docs/c_kickoff_comment_template.md](C:/work/infinitas_arena/infinitas_arena/docs/c_kickoff_comment_template.md) to keep output shape stable.

## Output Contract

Always return these sections in this order:
1. `C Kickoff status`
2. `Source of truth`
3. `Execution profile re-judgment`
4. `Plan Mode`
5. `Spawn Gate result`
6. `delegation execution record`
7. `Replan triggers`

Use this template:

```text
C Kickoff status: <READY|BLOCKED>

Source of truth:
- <Issue / tasks file / A-lite summary>

Execution profile re-judgment:
- <Local-Fast|Standard|High-Risk>

Plan Mode:
- <YES|NO>

Spawn Gate result:
- <result>

delegation execution record:
- role: <role-name>
- spawned: <yes|no>
- objective: <objective>
- no-delegate reason: <reason or N/A>

Replan triggers:
- <trigger or "none">
```

## Rules

- Do not start implementation in the same output block.
- Do not omit the source of truth.
- Do not mark kickoff `READY` if a mandatory High-Risk spawn path is still missing.
- If Plan artifact is missing, restate the A-lite agreement before giving kickoff output.
