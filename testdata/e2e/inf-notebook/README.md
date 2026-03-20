# inf-notebook fixtures

`records/summary.json` 起点の監視仕様に沿った E2E fixture です。

- 正常系テンプレート
  - `templates/normal/summary.template.json`
  - `templates/normal/recent.template.json`
- 代表異常系
  - `templates/unresolved_alias/*`
  - 実体サンプルは `testdata/notebook-unresolved-dialogs/unresolved_alias/` を参照

`run-local-e2e.ps1` は round ごとに timestamp/曲情報を埋めて投入します。

