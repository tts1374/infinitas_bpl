# testdata

ローカル動作確認を省力化するための固定データ置き場です。

## 構成

- `debug-input/`
  ローカル debug UI から直接注入するための正規化済みテンプレート JSON。
  現在ラウンドの expected key に合わせて展開されるため、毎回ファイル監視入力を作り直さずに再利用できます。
- `notebook-unresolved-dialogs/`
  `inf-notebook` watcher の未解決ケース（`unresolved_alias` / `resolved_partial` / `ambiguous_recent`）を
  手動 E2E で再現するための `records/summary.json` / `export/recent.json` 固定 fixture。
- `runtime/`
  `scripts/start-local-two-clients.ps1` が生成する一時設定、ログ、インスタンス別 watcher ディレクトリ。
  Git 管理対象外です。

## JSON 方針

今回は「生入力そのもの」よりも「既存処理へ再現性高く流し込める」ことを優先し、`debug-input/` には正規化済みテンプレートを置いています。

- `result-template`
  現在ラウンドの expected key に合わせて `RESULT_SUBMIT` 相当の入力を組み立てる
- `skip-template`
  `SKIP_SELF` 相当を送る

必要になれば、将来的に raw watcher 入力 (`today_update.xml`, `recent.json`) を別ディレクトリで追加できます。

`notebook-unresolved-dialogs/` については以下を利用できます。

- `scripts/apply-notebook-unresolved-fixture.ps1`
- `scripts/verify-notebook-unresolved-dialogs.ps1`

## 代表ケース

- `arena_score_win_p1.json`
- `arena_score_lose_p2.json`
- `arena_score_draw_equal.json`
- `bpl_skip_case.json`
- `arena_misscount_clean_run.json`
- `bpl_score_standard_p2.json`
- `bpl_misscount_survival_p1.json`

## 運用メモ

- `win_p1` と `lose_p2` は 2 クライアント確認向けの対になるケースです
- `draw_equal` は両クライアントで同じ JSON を使って引き分け確認できます
- `MISSCOUNT` 系は小さい値が有利になるルール確認用です
