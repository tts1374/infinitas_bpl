# notebook-unresolved-dialogs

`inf-notebook` watcher の未解決ケースダイアログを手動 E2E で再現するための固定 fixture です。

## 目的

- `unresolved_alias`
- `resolved_partial`
- `ambiguous_recent`

の 3 ケースを再現し、UI ダイアログ表示と操作を確認する。

## 前提

- `scripts/start-local-two-clients.ps1` などで Tauri クライアントを起動済み
- 対象クライアントの source は `inf-notebook`
- watcher 参照先は `testdata/runtime/instances/<instance>/inf-notebook`（既定）

## 構成

- `baseline/`
  - watcher 起動直後の基準状態
- `unresolved_alias/`
  - `records/summary.json` 側は有効譜面だが、現在ラウンド expected と一致しない観測を作るケース
- `resolved_partial/`
  - alias は解決するが `recent` が 0 件のケース
- `ambiguous_recent/`
  - 同一 timestamp の `recent` が 2 件あるケース

各フォルダ内:

- `records/summary.json`
- `export/recent.json`

## 推奨手順

1. baseline を適用
2. `unresolved_alias` を適用してダイアログ確認
3. `resolved_partial` を適用してダイアログ確認
4. `ambiguous_recent` を適用してダイアログ確認

実行補助:

- `scripts/apply-notebook-unresolved-fixture.ps1`
- `scripts/verify-notebook-unresolved-dialogs.ps1`
