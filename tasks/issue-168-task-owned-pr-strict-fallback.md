# issue-168-task-owned-pr-strict-fallback

## Source of Truth
- GitHub Issue `#168` "PR `#167` post-approval merge blocking incident"
- sticky hard constraint: `task-owned / user-authored PR` には `Strict fallback` を採用する

## Purpose
- `task-owned / user-authored PR` 向け merge authority fallback を `Standard` 変更の single-maintainer deadlock に限定して定義し、現行の user-authored publish 実態でも恒久的な merge 詰まりを避ける。
- `bot-created PR` lane と `task-owned / user-authored PR` lane の authorization rule を分離し、same-account deadlock 時の追加条件を明文化する。

## Non-goals
- `bot-created PR` lane の merge rule 緩和
- `High-Risk` 変更の merge authority 変更
- approval-only fallback の採用
- PR `#167` の merge 実行や個別 PR 運用の即時救済
- GitHub App / token / service-account / repository review policy の変更

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
- `task-owned / user-authored PR` fallback は `Standard` 変更かつ single-maintainer deadlock に限定する。
- fallback 適用には `required checks green`、`unresolved actionable review thread なし`、`follow-up 判定完了` を必須とする。
- fallback 適用には human `Approve` だけでなく、user の explicit `mergeしてOK` または同等の明示 merge authorization を必須とする。
- `bot-created PR` lane と `task-owned / user-authored PR` lane は別 rule として記述し、暗黙の lane 繰り上げを禁止する。
- `High-Risk` 変更は従来どおり approve 単独では merge authorization とみなさない。

## Changes
- `AGENTS.md` の merge authority boundary に `task-owned / user-authored PR` strict fallback lane を追加し、適用条件と explicit authorization requirement を明文化する。
- `WORKFLOW.md` の post-approval merge protocol に lane 別 gate を追加し、task-owned fallback の条件と read-back prerequisite を分離する。
- `QUALITY.md` に、task-owned fallback 実行時の required evidence と gate 確認項目を追加する。
- `.codex/skills/post-approval-merge-flow/SKILL.md` に、lane を必須入力として扱い、task-owned strict fallback の条件を満たさない場合は merge `BLOCKED` とする規則を追加する。

## Impact
- Users/runtime: なし。governance / workflow / skill wording の整理のみ。
- Data/compatibility: product contract 変更なし。merge authority vocabulary の明確化のみ。
- Cloudflare: 影響なし。

## Target Layers / Files
- layer: governance / skill
- files:
  - `AGENTS.md`
  - `WORKFLOW.md`
  - `QUALITY.md`
  - `.codex/skills/post-approval-merge-flow/SKILL.md`

## Validation Plan
- `npm run check:agents`
- `npm run check:design-contracts`
- `npm run lint`
- `npm run typecheck`
- `npm run test:client-stats`
- `npm run test:worker`
- `rg -n "task-owned / user-authored PR|bot-created PR|mergeしてOK|single-maintainer deadlock|strict fallback" AGENTS.md WORKFLOW.md QUALITY.md .codex/skills`

## Validation Surface Note
- PR CI `quick` は `check:agents`、lint、typecheck、client stats test、worker test を含むため、その面は最低限維持する。
- governance 変更として `QUALITY.md` 3.5 の `check:design-contracts` を追加し、repo 側の広い validation surface に寄せる。
- merge authority wording は text drift が事故原因になりやすいため、lane ごとの grep / read-through を required evidence とする。

## Rollback Plan
- strict fallback wording をまとめて revert し、暫定的に `task-owned / user-authored PR` の merge は explicit human handling required として戻す。

## Commit Split Plan
1. `tasks/issue-168-task-owned-pr-strict-fallback.md` を追加して scope / validation / kickoff 境界を固定する
2. governance docs と `post-approval-merge-flow` に strict fallback lane を反映する
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
- task label: `issue-168-task-owned-pr-strict-fallback`
- objective: `task-owned / user-authored PR` 向け strict fallback lane を governance と merge skill に反映し、same-account deadlock 時の merge authority 条件を明確化する
- in-scope files/layer: governance / skill / `AGENTS.md`, `WORKFLOW.md`, `QUALITY.md`, `.codex/skills/post-approval-merge-flow/SKILL.md`
- non-goals: bot lane 緩和、High-Risk merge rule 変更、approval-only fallback 採用、個別 PR merge 実行、GitHub infra / policy 変更
- forbidden scope: `apps/**`, `packages/**`, `.github/workflows/**`, `.codex/agents/**`, lockfile / dependency 更新
- expected output: `task-owned / user-authored PR` lane の strict fallback 条件が `bot-created PR` lane から分離され、explicit merge authorization が必須条件として一貫記述される
- validation: 上記 Validation Plan を満たす
- escalation: `.codex/agents/*.toml` の意味差分、CI/workflow 変更、reviewer authority 再定義、product contract-sensitive 変更が必要になった場合

## Replan Gate
- strict fallback を実装するために reviewer authority の意味そのものを再定義する必要が出た場合
- `Standard` / `High-Risk` 以外の新しい execution profile 分岐が必要になった場合
- merge authority lane の整理に `.codex/agents/*.toml`、CI/workflow、または GitHub 設定変更が必須化した場合
