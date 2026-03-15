# v1-gha-worker-api-url

## Purpose
- クライアントの Worker API URL をユーザー設定に依存させず、GitHub Actions で注入した本番 URL を既定適用する。

## Non-goals
- Room FSM / WS schema / Durable Object 挙動の変更。
- 監視ソース I/O（Rust watcher/parser）の変更。
- Worker API ルート仕様の変更。

## Changes
- クライアント runtime 設定で `VITE_WORKER_API_BASE_URL` を読み取り、`settingsDefaults.apiBaseUrl` に反映する。
- release workflow で `CLOUDFLARE_WORKERS_SUBDOMAIN` から Worker URL を組み立て、`VITE_WORKER_API_BASE_URL` として build 時に注入する。
- API URL のユーザー編集 UI は追加しない（既存方針を維持）。

## Impact
- Users: 設定画面で URL 手入力せずに本番 API へ接続できる。
- Data: 既存 local settings の永続形式は維持。
- Compatibility: 既存 API contract 互換。
- Cloudflare: release workflow に必要変数チェックを追加。

## Target Files / Layers
- Files:
  - `.github/workflows/release-desktop.yml`
  - `apps/client/src/runtime/runtime-config.ts`
  - `apps/client/src/vite-env.d.ts`
  - `apps/client/src/stores/settings-store.ts`
  - `apps/client/src/pages/SettingsPage.tsx`（ユーザー入力 UI を戻さないための差分整理）
- Layers: client, CI/deploy

## Test Focus
- `npm --workspace @infinitas/client run typecheck`
- 対象ファイル eslint
- `npm run test:client-stats`
- 可能なら `npm --workspace @infinitas/client run build`（環境制約で不可なら理由記録）
- `git diff` で目的外差分なし確認

## Rollback Plan
- release workflow で `VITE_WORKER_API_BASE_URL` 注入を削除し、runtime の env 参照を戻す。
- 既存既定値（localhost）へ戻して挙動を復元する。

## Commit Split Plan
1. client runtime に env ベース URL 読み取りを追加し、ユーザー編集 UI 追加差分を除去。
2. release workflow に Worker URL 注入と必要変数検証を追加。

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
