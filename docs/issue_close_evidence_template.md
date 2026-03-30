# Issue クローズ時の証跡テンプレ

Issue をクローズする際は、以下テンプレをクローズコメントとして記入する。

## テンプレ

```md
## クローズ証跡
- 対応種別: <コード / 非コード>
- PR URL または commit SHA: <URL または SHA。非コードの場合は N/A>
- 非コード完了理由: <非コードの場合は必須。コードの場合は N/A 可>
- フォローアップ有無: <なし / あり（Issue/PR番号）>
```

## Milestone運用の監査ログ（Issue↔PR対応表）

Milestone 管理 Issue では、クローズ証跡に加えて以下の対応表を同一コメント内に記載する。

### テンプレ

```md
## Milestone監査ログ
| Milestone | Issue# | PR# | 状態 |
| --- | --- | --- | --- |
| v1.0.0 | #123 | #456 | COMPLETE |
```

### 記載ルール

- `Issue#` は `#123` 形式で記載する。
- `PR#` は `#456` 形式で記載する。PR未作成の場合は `N/A` とする。
- `状態` は `READY / NOT_READY / WAITING_FOR_HUMAN_DECISION / COMPLETE / BLOCKED / ESCALATION` から選ぶ。

## 記載例（コード対応）

```md
## クローズ証跡
- 対応種別: コード
- PR URL または commit SHA: https://github.com/tts1374/infinitas_arena/pull/999
- 非コード完了理由: N/A
- フォローアップ有無: なし
```

## 記載例（非コード対応）

```md
## クローズ証跡
- 対応種別: 非コード
- PR URL または commit SHA: N/A
- 非コード完了理由: Phase A/B の要求定義・実行計画が確定し、別Issueで実装を行うため本Issueは計画完了としてクローズ
- フォローアップ有無: あり（#137）
```
