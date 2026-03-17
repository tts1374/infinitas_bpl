# codex-updater-release-version-guard

## Purpose
- Release Desktop 実行時に、`channels/stable/latest.json` と同一または古い version の再出荷を防止し、自動アップデート未発火を事前に防ぐ。

## Non-goals
- updater 配信方式（`latest.json` 方式）自体の変更
- update-worker API への切替
- client runtime の updater UI/挙動変更

## Changes
- `release-desktop.yml` に、公開 `latest.json` を参照して release version の進行を検証する preflight ステップを追加
- 進行していない場合に workflow を fail し、原因がわかるエラーメッセージを出す

## Impact
- Users: 同一版再配布による「アップデートが来ない」混乱を減らす
- Data: なし
- Compatibility: なし（version 管理運用のガード追加のみ）
- Cloudflare: `PUBLIC_R2_BASE_URL/channels/stable/latest.json` への参照が preflight に追加される

## Target Files / Layers
- Files: `.github/workflows/release-desktop.yml`
- Layers: CI / release workflow

## Test Focus
- Workflow YAML の構文妥当性（静的確認）
- 追加した PowerShell ロジックの分岐確認（latest 取得、version 比較、fail 条件）
- 差分検証（対象ファイル限定、無関係差分なし）

## Rollback Plan
- 追加した preflight ステップを削除して従来フローへ戻す

## Commit Split Plan
1. Release workflow に version guard 追加

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
