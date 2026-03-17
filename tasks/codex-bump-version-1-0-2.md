# codex-bump-version-1-0-2

## Purpose
- プロジェクトの出荷 version を `1.0.2` に引き上げる。

## Non-goals
- 依存関係の更新
- release workflow や updater 仕様の変更
- 機能ロジックの変更

## Changes
- root / workspace package の `version` を `1.0.2` に更新
- Tauri 設定と Rust crate version を `1.0.2` に更新

## Impact
- Users: 1.0.2 として配布可能になる
- Data: なし
- Compatibility: 互換性仕様の変更なし
- Cloudflare: なし

## Target Files / Layers
- Files:
  - `package.json`
  - `packages/shared/package.json`
  - `apps/client/package.json`
  - `apps/worker/package.json`
  - `apps/update-worker/package.json`
  - `apps/client/src-tauri/tauri.conf.json`
  - `apps/client/src-tauri/Cargo.toml`
- Layers: client / worker / shared / release metadata

## Test Focus
- 変更ファイルの差分確認（version 文字列のみ）
- `npm run typecheck` 成功
- `npm run lint` 成功

## Rollback Plan
- 上記ファイルの version を `1.0.1` に戻す

## Commit Split Plan
1. version 定義ファイルの一括更新

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
