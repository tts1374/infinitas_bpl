# issue-137-milestone-audit-log

## Purpose
- Milestone運用における監査ログとして、Issue↔PR対応表の記録方式を定型化する。

## Non-goals
- 文書以外の修正は行わない。
- API/WS/shared contract の変更は行わない。
- `.github/pull_request_template.md` は今回の対象外とする。

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- Standard Spawn Gate: 初期時点で bounded task が曖昧だったため `execution-coordinator` を実行済み
- High-Risk Spawn Gate: `NOT_APPLICABLE`（single-layer docs/governance、contract-sensitive 変更なし、cross-layer 変更なし）
- No-delegate reason: 単一レイヤ・単一bounded task・contract-sensitive 非該当・ローカル検証完結

## Changes
- `docs/issue_close_evidence_template.md` に Milestone監査ログの Issue↔PR対応表テンプレを追加する。
- 対応表の列は `Milestone / Issue# / PR# / 状態` の4列に固定する。
- `WORKFLOW.md` の PR/Closure Rules に、Milestone 管理 Issue での対応表併記ルールを追加する。

## Impact
- Users/runtime/data compatibility: なし（ドキュメント運用ルールのみ更新）。
- Cloudflare resources: 影響なし。

## Validation Plan
- 差分が `tasks/issue-137-milestone-audit-log.md` / `docs/issue_close_evidence_template.md` / `WORKFLOW.md` のみに限定されることを確認する。
- `WORKFLOW.md` 追記内容と `docs/issue_close_evidence_template.md` の列定義（4列）が一致することを確認する。
- 無関係な整形差分がないことを確認する。

## Replan Gate
- 実装中に `.github/pull_request_template.md` 追加更新など in-scope 外拡張が必要と判明した場合は、Phase C を停止し、Phase A/B へ戻して `WAITING_FOR_HUMAN_DECISION` または `ESCALATION` とする。
