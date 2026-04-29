# codex-gpt55-agent-model-upgrade

## Purpose
- Upgrade the repository default Codex model and the fixed eight sub-agent definitions from GPT-5.4-era settings to GPT-5.5-era settings.
- Rebalance reasoning effort so the stronger base model is used intentionally rather than by a blind version swap.

## Non-goals
- Do not change agent mission/scope wording beyond what is needed for model-setting clarity.
- Do not add, remove, or rename agents.
- Do not change product code or workflow semantics.

## Current Request Boundary
- Ceiling: implementation ready
- Allowed outputs now: task artifact creation, `.codex/config.toml` edit, `.codex/agents/*.toml` model-setting edits, required validation
- Forbidden outputs now: unrelated governance rewrites, product implementation, dependency updates
- Next unlock condition: none

## Success Criteria
- `.codex/config.toml` default model is upgraded to GPT-5.5.
- All eight repository-local sub-agent definitions are upgraded from GPT-5.4 / GPT-5.4-mini to GPT-5.5.
- Reasoning effort is intentionally reassigned for GPT-5.5-era use rather than copied mechanically.
- `npm run check:agents` and `npm run check:design-contracts` pass after the edit.

## Stop Condition
- Stop after model-setting edits and required validation are complete.

## Allowed Side Effects
- Minimal wording-free edits limited to model and reasoning settings in repo Codex config and agent TOML files.
- A new scoped task artifact for this model upgrade pass.

## Changes
- Update `.codex/config.toml` default model.
- Update `.codex/agents/*.toml` model and `model_reasoning_effort` settings.

## Impact
- Users: stronger default/sub-agent capability for repository workflows
- Data: none
- Compatibility: Codex agent/runtime settings only
- Cloudflare: none

## Target Files / Layers
- Files:
  - `.codex/config.toml`
  - `.codex/agents/*.toml`
- Layers: docs/config

## Test Focus
- `npm run check:agents`
- `npm run check:design-contracts`
- Read-back diff to confirm only model-setting fields changed

## Rollback Plan
- Revert the touched Codex config and agent definition files as one scoped settings change if validation or runtime behavior regresses.

## Commit Split Plan
1. GPT-5.5 model-setting upgrade for default and fixed sub-agents

## Checklist
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
