# codex-worker-error-log-settings

## Purpose

- `infinitas-arena` Worker で実行時エラーを確認しやすくするため、Cloudflare 側のログ収集設定を有効化する。

## Non-goals

- Worker ロジック（FSM / WS / ルーティング）の変更
- Durable Objects の挙動変更
- クライアント側の表示変更

## Changes

- `apps/worker/wrangler.toml` に observability ログ設定を追加する。
- 本番運用コストを考慮し、ログサンプリング率を 10% に設定する。

## Impact

- Users: なし（機能挙動の変更なし）
- Data: なし
- Compatibility: なし
- Cloudflare: Worker の observability ログ設定が有効化される

## Target Files / Layers

- Files:
  - `apps/worker/wrangler.toml`
- Layers: worker (deployment config)

## Test Focus

- Worker 設定ファイルの構文が維持されること
- `apps/worker` のビルド系コマンドが成功すること
- 差分が対象ファイルと tasks ファイルのみに限定されること

## Rollback Plan

- `apps/worker/wrangler.toml` の observability 設定追加を削除して元に戻す

## Commit Split Plan

1. tasks ファイル追加（Plan gate）
2. worker observability ログ設定追加

## Checklist

- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
