# e2e testdata

ローカル専用 E2E の fixture/テンプレート置き場です。

## 構成

- `reflux/`
  - Reflux 監視投入用テンプレート (`latest.json`, `tracker.tsv`)
- `daken_counter_v3/`
  - `today_updates` WebSocket payload テンプレート
- `inf-notebook/`
  - `records/summary.json` + `export/recent.json` テンプレート
  - unresolved 系の参照情報
- `mixed/`
  - 混在シナリオ向けメモ

## 運用方針

- `scripts/run-local-e2e.ps1` はこの構成を前提に datasource 別 fixture を投入します。
- 実行時は `expected_key` から曲情報を解決し、テンプレートを元に round ごとの実体を生成します。
- 失敗時は runtime 配下の `artifacts/fixtures` に投入実体を保存します。

