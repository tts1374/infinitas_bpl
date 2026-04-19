# issue-168-author-identity-lane-readback

## Source of Truth
- GitHub Issue `#168` "PR `#167` post-approval merge blocking incident"

## Purpose
- PR publish 後の actual author identity read-back を merge lane 判定の正本として固定し、`bot-created PR` と `task-owned / user-authored PR` の混同を防ぐ。
- publish flow と downstream merge / close flow が、想定 publish path ではなく read-back 済み lane evidence を共有できる状態にする。

## Non-goals
- `task-owned / user-authored PR` 向け strict fallback 条件そのものの定義
- bot-authored publication path の実装
- GitHub App / token / service-account / repository review policy の変更
- product code / CI workflow / dependency / lockfile 変更

## Current Request Boundary
- current request ceiling: `A〜C Kickoff まで`
- allowed outputs now:
  - requirement shaping
  - bounded task artifact 作成
  - Phase C kickoff artifact
- forbidden outputs now:
  - governance / skill implementation diff
  - commit / push / PR / release
  - merge / close / cleanup
  - Issue / PR への stateful write-back
- next unlock condition: user が明示的に Phase C implementation を許可する

## Fixed decisions
- lane 判定は publish path の意図ではなく、PR read-back の `author.login` / `author.is_bot` を基準にする。
- `author.is_bot` を read-back で確認できない PR を暗黙に `bot-created PR` 扱いしない。
- current Codex publish path が user-authored である限り、publish 完了証跡には lane evidence を必須で残す。
- lane vocabulary は少なくとも `bot-created PR` と `task-owned / user-authored PR` を使い分ける。

## Changes
- `AGENTS.md` / `WORKFLOW.md` に、merge authority lane 判定は actual author identity read-back を正本とする規範を追加する。
- `QUALITY.md` に、publish / merge 系 workflow で author identity read-back と lane evidence が確認済みであることを追加する。
- `.codex/skills/commit-pr-flow/SKILL.md` に、PR publish 後の `author.login` / `author.is_bot` read-back と lane evidence 記録を completion evidence として追加する。
- 必要なら `.codex/skills/post-approval-merge-flow/SKILL.md` の入力要件へ lane evidence read-back を反映し、想定 lane 推測を禁止する。

## Impact
- Users/runtime: なし。governance / skill wording の整理のみ。
- Data/compatibility: lane vocabulary は additive な運用整理で、product wire contract 変更なし。
- Cloudflare: 影響なし。

## Target Layers / Files
- layer: governance / skill
- files:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`
  - `.codex/skills/commit-pr-flow/SKILL.md`
  - `.codex/skills/post-approval-merge-flow/SKILL.md`

## Validation Plan
- `npm run check:agents`
- `npm run check:design-contracts`
- `npm run lint`
- `npm run typecheck`
- `npm run test:client-stats`
- `npm run test:worker`
- `rg -n "bot-created PR|task-owned / user-authored PR|author.login|author.is_bot|lane evidence" AGENTS.md WORKFLOW.md QUALITY.md .codex/skills`

## Validation Surface Note
- PR CI `quick` は `.github/workflows/validate-reusable.yml` の `npm run check:agents`、`npm run lint`、`npm run typecheck`、`npm run test:client-stats`、`npm run test:worker` を含む。
- governance 変更では `QUALITY.md` 3.5 に合わせて `npm run check:design-contracts` を追加し、CI より狭い面にしない。
- 今回の task は docs / skill text 変更が主で product runtime を直接触らないが、lane wording drift は grep / read-through で追加確認する。

## Rollback Plan
- lane evidence / author identity read-back に関する governance / skill wording をまとめて revert し、暫定的に explicit human verification を要求する運用へ戻す。

## Commit Split Plan
1. `tasks/issue-168-author-identity-lane-readback.md` を追加して scope / validation / kickoff 境界を固定する
2. governance docs と `commit-pr-flow` / 関連 skill に actual author identity read-back の必須化を反映する
3. validation only

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- execution profile: `Standard`
- Plan Mode: `YES`
- Standard Spawn Gate: `APPLICABLE`
- High-Risk Spawn Gate: `NOT_APPLICABLE`
- No-delegate reason: governance / skill の単一 owner 実装で bounded に進められ、current request ceiling も kickoff-only のため、この turn では implementation spawn を行わない

## Delegation Packet
- task label: `issue-168-author-identity-lane-readback`
- objective: PR publish 後の actual author identity read-back を lane 判定の正本として固定し、publish / merge flow が同じ lane evidence を参照できるようにする
- in-scope files/layer: governance / skill / `AGENTS.md`, `WORKFLOW.md`, `QUALITY.md`, `.codex/skills/commit-pr-flow/SKILL.md`, `.codex/skills/post-approval-merge-flow/SKILL.md`
- non-goals: strict fallback 条件の本体定義、bot publication path 実装、GitHub infra 設定変更、product code / CI / dependency 変更
- forbidden scope: `apps/**`, `packages/**`, `.github/workflows/**`, `.codex/agents/**`, lockfile / dependency 更新
- expected output: publish 完了証跡に `author.login` / `author.is_bot` read-back と lane evidence が残り、downstream merge flow が推測ではなく read-back lane を入力として扱う
- validation: 上記 Validation Plan を満たす
- escalation: `.codex/agents/*.toml` の意味差分、CI/workflow 変更、product contract-sensitive 変更、human policy decision が追加で必要な仕様差分が発生した場合

## Replan Gate
- lane evidence 必須化のために `.codex/agents/*.toml` や CI/workflow の更新が必須化した場合
- `bot-created PR` / `task-owned / user-authored PR` の 2 lane では表現できない追加 lane が必要になった場合
- publish evidence の read-back だけでは merge authority 判定を防御できず、追加の human policy decision が必要になった場合
