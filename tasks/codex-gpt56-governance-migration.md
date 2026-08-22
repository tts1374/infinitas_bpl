# codex-gpt56-governance-migration

## Purpose
- Migrate the repository Codex default and fixed sub-agent model policy from GPT-5.5 to GPT-5.6.
- Correct stale agent references and non-portable paths in repository-local skills.
- Extend governance validation so model drift and stale skill references fail locally.

## Non-goals
- Do not change the fixed eight-role responsibility model.
- Do not perform broad prompt trimming without representative behavior evaluation.
- Do not change product code, runtime contracts, dependencies, or release behavior.
- Do not move repository skills from `.codex/skills` to `.agents/skills` in this pass.

## Current Request Boundary
- Ceiling: implementation ready
- Allowed outputs now: task artifact creation, Phase C kickoff, scoped Codex config/agent/skill/checker edits, required validation
- Forbidden outputs now: product implementation, role additions/removals, broad governance rewrites, dependency updates, commit/PR/release operations
- Next unlock condition: none

## Success Criteria
- The repository default and spawned-agent default use the documented `gpt-5.6` identifier.
- The eight custom agents inherit the shared GPT-5.6 default while retaining their existing role-specific reasoning effort.
- Repository-local skills use canonical kebab-case agent names and contain no machine-specific absolute paths.
- `npm run check:agents` detects unsupported model values, stale agent aliases in skills, and absolute local paths in repository skills.
- Required governance validation passes with UTF-8 without BOM and LF preserved.

## Stop Condition
- Stop after scoped edits, validation, and diff/audit review are complete.

## Allowed Side Effects
- Add this task artifact.
- Update `AGENTS.md`, `QUALITY.md`, `.codex/config.toml`, `.codex/agents/*.toml`, selected `.codex/skills/*/SKILL.md`, and `scripts/check-agent-definitions.mjs`.

## Changes
- Normalize the GPT-5.6 model configuration and current sub-agent concurrency key.
- Centralize the spawned-agent model default and remove redundant per-agent model pins.
- Correct skill role references and replace hard-coded local paths with portable repository/skill references.
- Expand agent-definition validation to cover project config and repository-local skills.
- Record the centralized model-source and corresponding validation contract in root governance.

## Impact
- Users: future Codex tasks and sub-agents use GPT-5.6 consistently
- Data: none
- Compatibility: Codex configuration and instruction validation only
- Cloudflare: none

## Target Files / Layers
- Files:
  - `.codex/config.toml`
  - `.codex/agents/*.toml`
  - `.codex/skills/*/SKILL.md` where stale references or absolute paths exist
  - `scripts/check-agent-definitions.mjs`
  - `AGENTS.md`
  - `QUALITY.md`
  - `tasks/codex-gpt56-governance-migration.md`
- Layers: governance/config/scripts

## Test Focus
- `npm run check:agents`
- `npm run check:design-contracts`
- Negative checker probes for invalid model, deprecated skill alias, and absolute skill path
- Scoped diff review and UTF-8 no-BOM/LF verification

## Rollback Plan
- Revert the scoped configuration, agent, skill, checker, and task-artifact changes together if the new model policy or validation causes a regression.

## Commit Split Plan
1. GPT-5.6 agent configuration and governance validation migration

## Delegation
- No delegation: this is a single governance/config ownership scope with tightly coupled checker changes; parallel write work would add coordination risk without a useful independent workstream.

## Checklist
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Negative checker probes completed
- [x] Regression checks completed
- [x] Encoding and diff checks completed
