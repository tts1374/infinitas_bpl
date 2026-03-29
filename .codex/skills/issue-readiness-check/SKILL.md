---
name: issue-readiness-check
description: "Phase 1 exit-gate skill for deciding whether an issue is ready to hand off to execution planning. Use after issue shaping or wall-sparring to check specification gaps, acceptance criteria coverage, scope boundaries, and blocking unresolved items, then return ready/not ready with concrete next actions."
---

# Issue Readiness Check

## Overview

Use this skill to decide whether Phase 1 is closed and whether an issue can be handed to execution planning.
Use this as a readiness gate only, not as execution planning or post-implementation audit.

## Responsibilities

- Inspect missing specification details.
- Verify acceptance criteria sufficiency and testability.
- Verify scope boundary clarity for in-scope and out-of-scope.
- Detect unresolved items and classify blocking impact.
- Select the next role or skill to run.
- Return a final readiness decision: `ready` or `not ready`.

## Use Cases

Use when:
- Check implementation readiness after wall-sparring.
- Confirm whether handoff to issue triage or execution planning is safe.
- Separate fatal unresolved items from deferrable improvements.
- Produce a Phase 1 completion decision.

Do not use when:
- Stay in early idea exploration with low requirement maturity.
- Continue discovery that has not produced concrete scope and criteria.
- Continue execution planning that is already in progress.
- Perform post-implementation audit as the primary purpose.

## Inputs

Require these inputs:
- Current issue text.
- Additional specification text to include.
- Decisions already made.
- Unresolved items.
- Acceptance criteria.
- Scope boundaries (in-scope and out-of-scope).

## Workflow

1. Summarize issue objective and expected delivery outcome in 1 to 3 bullets.
2. Evaluate readiness on these dimensions:
   - specification completeness
   - acceptance criteria completeness and observability
   - scope boundary clarity
   - blocking unresolved decisions
   - handoff clarity to next role or skill
3. Classify each gap as:
   - `blocking`: prevents safe handoff to execution planning
   - `non-blocking`: useful improvement that does not block handoff
4. Identify missing inputs needed to defend the decision.
5. Decide readiness:
   - return `ready` only when no blocking gap remains
   - return `not ready` when one or more blocking gaps remain
6. Recommend only 1 or 2 next steps, including next role or skill.

## Output Contract

Always return these sections in this order:
1. `Readiness status`: `ready` or `not ready`
2. `Ready rationale`
3. `Blocking gaps`
4. `Non-blocking gaps`
5. `Missing inputs`
6. `Next role/skill`
7. `Handoff cautions for execution planning`

Use this output template:

```text
Readiness status: <ready|not ready>

Ready rationale:
- <reason 1>
- <reason 2>

Blocking gaps:
- <gap or "none">

Non-blocking gaps:
- <gap or "none">

Missing inputs:
- <input or "none">

Next role/skill:
- <role_or_skill_1>
- <role_or_skill_2 or "none">

Handoff cautions for execution planning:
- <caution 1>
- <caution 2>
```

Apply these format rules:
- Put `Readiness status` at the top.
- Separate missing points into `Blocking gaps` and `Non-blocking gaps`.
- Write concrete missing information, not abstract statements.
- Keep next steps to 1 or 2 actions.

## Success Criteria

- Make Phase 1 closure decision explicit.
- Make execution planning handoff viability explicit.
- If not ready, state exactly what to fill next.
