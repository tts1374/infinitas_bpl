# C Kickoff コメントテンプレ

Phase C 開始前は、実装着手より先に次のコメントまたは同等の記録を残す。

## テンプレ

```md
## C Kickoff
- 正本: <Issue / tasks/*.md / A-lite合意サマリ>
- 実行プロファイル再判定: <Local-Fast / Standard / High-Risk>
- Plan Mode: <YES / NO>
- Spawn Gate 結果: <APPLICABLE / NOT_APPLICABLE / SATISFIED>
- 状態: <READY / BLOCKED>

### delegation execution record
- role: `<role-name>`
- spawned: `<yes / no>`
- objective: <1-2行>
- no-delegate reason: <no の場合は必須。yes の場合は N/A>
```

## 記載ルール

- `正本` は scope を固定した文書または合意サマリを記載する。
- `Spawn Gate 結果` は適用した gate を要約できるなら自由記述でよい。
- 必須ロール未spawnの場合、`状態` は `BLOCKED` とする。
- 実装開始後に書くのではなく、開始前に残す。
