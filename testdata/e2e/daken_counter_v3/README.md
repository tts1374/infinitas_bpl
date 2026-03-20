# daken_counter_v3 fixtures

`daken_counter_v3` は WebSocket (`today_updates`) 入力なので、E2E では payload テンプレートを使います。

- 正常系: `templates/normal/today_updates.template.json`
- 代表異常系: `templates/invalid_payload/*.json`

`scripts/start-daken-counter-v3-mock.ps1` が control ファイル更新を監視し、payload をクライアントへ配信します。

