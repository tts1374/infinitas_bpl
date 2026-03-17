# codex-tauri-config-version-1-0-1

## Purpose

- updater endpoint 注入を `TAURI_CONFIG` ベースに修正する。
- 出荷 version を `1.0.1` に戻す。

## Non-goals

- updater 配信方式の変更
- update-worker API 仕様の変更
- アプリ機能ロジックの変更

## Changes

- `release-desktop.yml` の updater 注入環境変数を `TAURI_UPDATER_PLUGIN_CONFIG` から `TAURI_CONFIG` に変更
- 関連ドキュメントの注入方法説明を `TAURI_CONFIG` に更新
- root / workspace / tauri / cargo の version を `1.0.1` に変更

## Impact

- Users: 自動更新 endpoint が build 時に正しく注入される
- Data: なし
- Compatibility: なし
- Cloudflare: なし（既存 endpoint URL を継続）

## Target Files / Layers

- Files:
  - `.github/workflows/release-desktop.yml`
  - `apps/client/src-tauri/UPDATER.md`
  - `package.json`
  - `apps/client/package.json`
  - `apps/worker/package.json`
  - `apps/update-worker/package.json`
  - `packages/shared/package.json`
  - `apps/client/src-tauri/tauri.conf.json`
  - `apps/client/src-tauri/Cargo.toml`
- Layers: CI / client / worker / shared / release metadata

## Test Focus

- Workflow YAML の整合性確認
- `npm run typecheck` 成功
- `npm run lint` 成功
- 差分が意図したファイルに限定されていること

## Rollback Plan

- 上記ファイルの変更を戻し、従来の注入方法と version に戻す

## Commit Split Plan

1. release workflow と updater ドキュメント修正
2. version を `1.0.1` に戻す

## Checklist

- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
