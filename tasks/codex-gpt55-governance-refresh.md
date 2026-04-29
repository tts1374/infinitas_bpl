# codex-gpt55-governance-refresh

## Purpose
- Refresh governance, agent, and core skill instructions for GPT-5.5-era prompting and orchestration.
- Make outcome-first expectations, success criteria, stopping rules, and escalation boundaries easier to read and harder to miss.
- Reduce duplicated process wording while preserving repository-specific phase and delegation controls.

## Non-goals
- Do not change product behavior, app code, or runtime tool implementations.
- Do not broaden role boundaries or repository workflow semantics beyond what is needed for clearer instruction design.
- Do not rewrite every skill in the repository when a targeted refresh of canonical and orchestration-heavy surfaces is sufficient.

## Current Request Boundary
- Ceiling: implementation ready
- Allowed outputs now: task artifact creation, governance doc edits, agent definition edits, core skill instruction edits, required validation
- Forbidden outputs now: unrelated product implementation, dependency updates, workflow scope expansion outside governance/agent/skill wording refresh
- Next unlock condition: none

## Changes
- Update root governance docs to prefer outcome-first instructions and clearer continue-versus-escalate boundaries.
- Update `.codex/agents/*.toml` to front-load objective, success criteria, and stopping rules while trimming repeated process wording.
- Update core orchestration/reference skills so they remain judgment-light and artifact/checklist oriented.

## Impact
- Users: clearer and more consistent agent behavior for future repository work
- Data: none
- Compatibility: instruction semantics only; repository governance remains aligned with existing phase model
- Cloudflare: none

## Target Files / Layers
- Files:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`
  - `.codex/agents/*.toml`
  - `.codex/skills/plan-mode-gate/SKILL.md`
  - `.codex/skills/issue-readiness-check/SKILL.md`
  - `.codex/skills/quality-check-matrix/SKILL.md`
  - `.codex/skills/fsm-protocol-guard/SKILL.md`
  - `.codex/skills/phase-c-kickoff-flow/SKILL.md`
- Layers: docs

## Test Focus
- `npm run check:agents`
- `npm run check:design-contracts`
- Diff review for preserved phase/delegation vocabulary and no unintended scope drift

## Rollback Plan
- Revert the touched governance, agent, and skill docs as one scoped documentation change if the new wording causes validation or workflow regressions.

## Commit Split Plan
1. Root governance doc refresh
2. Agent and core skill refresh

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
