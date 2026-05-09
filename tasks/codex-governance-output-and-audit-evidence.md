# codex-governance-output-and-audit-evidence

## Purpose
- 今後の Plan / kickoff / final など user-facing output を日本語優先にする。
- UI 実装に wireframe / screenshot / design doc / visual source of truth がある場合、準拠確認の証跡を必須化する。
- audit findings の disposition tracking を必須化し、PR / close / completion 前に `Blocker` / `Must fix` / `Should fix` が取り落とされないようにする。

## Non-goals
- product code や runtime behavior は変更しない。
- agent の rename や固定8役モデルの変更はしない。
- evidence と output language の明確化を超えて workflow semantics を広げない。

## Current Request Boundary
- Ceiling: implementation ready
- Allowed outputs now: task artifact creation, governance doc edits, agent definition edits, skill instruction edits, required validation
- Forbidden outputs now: product implementation, dependency updates, CI workflow changes, commit / push / PR / release
- Next unlock condition: none

## Changes
- user-facing な Plan / kickoff summary / review summary / final report は、user が明示的に別言語を求めない限り日本語で書く規則を追加する。
- wireframe / screenshot / design doc / visual reference を正本に持つ UI work では、design-source evidence を required output にする。
- completion / PR publication / review response completion / merge / close / cleanup の前に audit finding disposition を確認する規則を追加する。

## Impact
- Users: 英語のみの planning / final output を減らし、review evidence を追跡しやすくする。
- Data: none.
- Compatibility: instruction semantics only.
- Cloudflare: none.

## Target Files / Layers
- Files:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`
  - `.codex/agents/front-implementer.toml`
  - `.codex/agents/implementation-auditor.toml`
  - `.codex/agents/contract-auditor.toml`
  - `.codex/skills/commit-pr-flow/SKILL.md`
  - `.codex/skills/phase-c-review-response-flow/SKILL.md`
  - `.codex/skills/plan-mode-gate/SKILL.md`
  - `.codex/skills/phase-c-kickoff-flow/SKILL.md`
- Layers: governance / agent / skill docs

## Test Focus
- `npm run check:agents`
- `npm run check:design-contracts`
- product-code changes と unrelated wording churn がないことの diff review

## Rollback Plan
- この scoped governance / agent / skill documentation change を revert する。

## Commit Split Plan
1. output language と evidence rules の governance / agent / skill wording update

## Checklist
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
