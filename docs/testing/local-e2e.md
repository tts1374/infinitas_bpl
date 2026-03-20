# Local E2E (Windows)

この手順はローカル専用です。CI では実行しません。

## 前提

- Windows 環境
- `npm install` 済み
- `v1` ブランチ
- Worker/Client の開発起動が可能

## 代表シナリオ実行

### 1. Reflux / Reflux フル進行

```powershell
pwsh -File scripts/run-local-e2e.ps1 -Scenario reflux-reflux-full
```

### 2. 混在互換 (打鍵カウンタv3 / リザルト手帳)

```powershell
pwsh -File scripts/run-local-e2e.ps1 -Scenario mixed-daken-v3-notebook
```

## 2クライアント起動のみ（手動確認用）

```powershell
pwsh -File scripts/start-local-two-clients.ps1 `
  -E2E `
  -ClientCount 2 `
  -Scenario manual `
  -RoomId <ROOM_ID> `
  -JoinCode <JOIN_CODE> `
  -ClientASource reflux `
  -ClientBSource reflux
```

## 生成物

`scripts/run-local-e2e.ps1` 実行時:

- runtime root: `testdata/runtime/e2e/<scenario>-<timestamp>/`
- イベントログ(JSONL): `logs/<client>/<client>.events.jsonl`
- state dump: `runtime/<client>/<client>.state.json`
- スクリーンショット: `runtime/<client>/<client>.latest.png`
- 失敗時証跡: `artifacts/failure-*/`
- 投入 fixture 実体: `artifacts/fixtures/`

## 補足

- `INF_ARENA_E2E=1` は Tauri プロセス環境変数として起動スクリプトが自動設定します。
- 通常起動では E2E 用 command/API は無効です。

