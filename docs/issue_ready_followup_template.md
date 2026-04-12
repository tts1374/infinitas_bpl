# Issue-ready Follow-up テンプレ

Phase D で後続 Issue を切り出すときは、次スレッドでそのまま A/B を再開できる粒度まで整える。

## テンプレ

```md
## Background
- <背景>

## Purpose
- <目的>

## Non-goals
- <非目的>

## Acceptance Criteria
- <完了条件 1>
- <完了条件 2>

## Target Layers / Files
- layer: <client / worker / shared / governance>
- files: <候補または未確定なら層だけ>

## Validation
- <必要検証>

## Recommended Execution Mode
- execution profile: <Local-Fast / Standard / High-Risk>
- Plan Mode: <YES / NO>

## Delegation Hint
- role: <必要なら role 名>
- spawned: <yes / no / later>
- objective: <bounded objective>
- no-delegate reason: <non-spawn の場合>
```

## 記載ルール

- Issue 本文でも kickoff コメントでもよいが、後続担当が再質問なしで Phase A/B を始められる粒度にする。
- `Target Layers / Files` は未確定でもよいが、少なくとも layer は固定する。
- `Delegation Hint` は将来の実行ヒントであり、実際の spawn 実行記録とは区別する。
