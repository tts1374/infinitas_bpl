# issue-135-agent-delegation-enforcement

## Purpose
- Ensure orchestration definitions require actual sub-agent spawning when delegation is selected.

## Non-goals
- No role-boundary redesign across all agents.
- No implementation behavior change outside agent-definition prompts.
- No model/version changes.

## Changes
- Add explicit delegation execution contract to `strategy_orchestrator` canonical definition.
- Add explicit delegation execution contract to `execution_coordinator` canonical definition.
- Synchronize the same semantic changes to derived `.toml` files.
- Add delegation execution record to required output shape for both roles.

## Impact
- Users: none (governance/agent behavior only).
- Data/compatibility: none.
- Cloudflare/runtime: none.
- Orchestration: delegated routes are less likely to remain "paper-only".

## Target Files / Layers
- Files:
  - `.codex/agents/strategy-orchestrator.md`
  - `.codex/agents/strategy-orchestrator.toml`
  - `.codex/agents/execution-coordinator.md`
  - `.codex/agents/execution-coordinator.toml`
- Layers: governance / agent definitions

## Test Focus
- Markdown and TOML remain semantically aligned.
- Added rules do not contradict existing mission/scope/prohibited sections.
- Diff remains limited to targeted agent-definition files plus this plan file.

## Rollback Plan
- Revert the four agent-definition files and this task file in one rollback commit.

## Commit Split Plan
1. Plan artifact addition.
2. Canonical markdown updates (`strategy_orchestrator`, `execution_coordinator`).
3. Derived TOML synchronization.

## Checklist
- [x] Scope and non-goals fixed
- [x] Canonical markdown updated first
- [x] Derived TOML synchronized
- [x] Final verification completed
