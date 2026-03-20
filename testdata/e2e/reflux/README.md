# reflux fixtures

`watch/<client>/latest.json` と `watch/<client>/tracker.tsv` に実投入するテンプレートです。

- 正常系: `templates/normal/*`
- 代表異常系: `templates/unresolved_alias/*`

`run-local-e2e.ps1` は PLAYING 中の `expected_key` に合わせてこのテンプレート相当の実体を動的生成します。

