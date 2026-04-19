# codex-phase-c-implementation-ready-default

## Source of Truth
- user request in this thread: A〜C Kickoff から C〜D へ進む際に、user がすでに Phase C implementation / C〜D execution を依頼しているのに、追加の explicit implementation authorization がないと進めない運用を止める
- applicable governance:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`
- required pre-implementation skill:
  - `.codex/skills/phase-c-kickoff-flow/SKILL.md`

## Purpose
- user が Phase C implementation または C〜D execution を明示依頼しており、正本 artifact により狭い ceiling がない場合は、task artifact / kickoff が `implementation-ready` を既定で維持できるようにする。
- kickoff 後に追加の explicit implementation authorization を synthetic に要求しない governance / skill / agent behavior を整える。

## Non-goals
- `kickoff-only` / `task-authoring-only` / `planning-only` を明示した artifact の優先順位を下げること
- broad request で正本 artifact のより狭い phase ceiling を上書きできるようにすること
- product code / app runtime / GitHub merge authority rule の変更
- `.github/workflows/**` や dependency / lockfile の変更

## Current Request Boundary
- current request ceiling: `implementation-ready`
- allowed outputs now:
  - task artifact 作成
  - C Kickoff artifact
  - in-scope governance / skill / agent / template implementation diff
  - required validation
  - Phase D follow-up assessment
- forbidden outputs now:
  - `apps/**`
  - `packages/**`
  - `.github/workflows/**`
  - dependency / lockfile 変更
  - merge / close / cleanup / GitHub write-back
- next unlock condition: `none` unless Replan Gate triggers

## Fixed decisions
- `C Kickoff status: READY` 単独では実装許可を意味しないが、user が Phase C implementation / C〜D execution を明示依頼しており、正本 artifact により狭い ceiling がない場合は `Implementation authorization: YES` にできる。
- missing concrete task artifact が唯一の blocker で、同一 turn の user request がすでに implementation を許可している場合は、artifact 作成後に same turn の C Kickoff -> implementation へ進んでよい。
- 追加の explicit implementation authorization を synthetic に `next unlock condition` として差し込まない。
- `kickoff-only` / `task-authoring-only` / `planning-only` の narrow ceiling がある場合は、従来どおりその ceiling を優先する。

## Changes
- `AGENTS.md` / `WORKFLOW.md` / `QUALITY.md` に implementation-ready default / same-turn unlock の governance を追加する。
- `.codex/skills/phase-c-kickoff-flow/SKILL.md` と `docs/c_kickoff_comment_template.md` に implementation-ready kickoff の扱いを反映する。
- `.codex/skills/plan-mode-gate/references/task-plan-template.md` に synthetic explicit authorization を要求しない task authoring guidance を反映する。
- `.codex/agents/strategy-orchestrator.toml` / `.codex/agents/execution-coordinator.toml` に、narrow ceiling がない execution request では implementation-ready を固定できる挙動を反映する。

## Impact
- Users/runtime: governance friction の低減のみ。product runtime 影響なし。
- Data/compatibility: なし。
- Cloudflare: なし。

## Target Layers / Files
- layer: governance / skill / agent / template
- files:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`
  - `.codex/skills/phase-c-kickoff-flow/SKILL.md`
  - `docs/c_kickoff_comment_template.md`
  - `.codex/skills/plan-mode-gate/references/task-plan-template.md`
  - `.codex/agents/strategy-orchestrator.toml`
  - `.codex/agents/execution-coordinator.toml`

## Validation Plan
- `npm run check:agents`
- `npm run check:design-contracts`
- `npm run lint`
- `npm run typecheck`
- `npm run test:client-stats`
- `npm run test:worker`
- `rg -n "implementation-ready|kickoff-only|task-authoring-only|next unlock condition|Phase C implementation|same turn" AGENTS.md WORKFLOW.md QUALITY.md .codex/skills .codex/agents docs -S`

## Validation Surface Note
- `.github/workflows/validate-reusable.yml` の quick validate surface に合わせて、`check:agents` / `lint` / `typecheck` / `test:client-stats` / `test:worker` を維持する。
- governance / agent definition 変更なので `check:design-contracts` を追加し、CI より狭くしない。

## Rollback Plan
- implementation-ready default / same-turn unlock に関する wording を revert し、従来の explicit unlock required 運用へ戻す。

## Commit Split Plan
1. task artifact と kickoff 境界を固定する
2. governance / skill / agent / template に implementation-ready default を反映する
3. validation only

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- execution profile: `Standard`
- Plan Mode: `YES`
- Standard Spawn Gate: `APPLICABLE`
- High-Risk Spawn Gate: `NOT_APPLICABLE`
- No-delegate reason: governance / skill / agent / template の bounded text update で single owner のまま進められ、user request が implementation-ready まで許可しているため

## Delegation Packet
- task label: `codex-phase-c-implementation-ready-default`
- objective: Phase C implementation / C〜D execution を user が明示依頼している場合に、narrow ceiling がない限り implementation-ready のまま kickoff から実装へ進める governance を整える
- in-scope files/layer: governance / skill / agent / template / 上記 Target Layers / Files
- non-goals: narrow ceiling の弱体化、product code 変更、GitHub merge/close behavior の変更、workflow CI / dependency 変更
- forbidden scope: `apps/**`, `packages/**`, `.github/workflows/**`, dependency / lockfile, merge / close / cleanup / GitHub write-back
- expected output: task artifact / kickoff / orchestrator / coordinator が synthetic explicit implementation authorization を要求せず、narrow ceiling がない execution request を `implementation-ready` として扱える
- validation: 上記 Validation Plan を満たす
- escalation: in-scope だけでは整合せず、追加の `.codex/agents/*.toml` 以外の prompt surface や CI/workflow 変更が必須になった場合

## Replan Gate
- broad request と narrow ceiling の優先順位を逆転させる必要が出た場合
- `.github/workflows/**` や dependency / lockfile 変更が必須になった場合
- product runtime / contract-sensitive behavior へ波及する変更が必要になった場合
