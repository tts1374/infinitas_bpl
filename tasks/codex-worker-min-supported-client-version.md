# codex-worker-min-supported-client-version

## Purpose

- Worker 側で `min_supported_client_version` を保持し、`1.0.0` クライアント接続を拒否する。
- 拒否時にクライアントへ更新案内メッセージを返す。

## Non-goals

- updater 配信方式の変更
- リリース version の再変更
- Room FSM や lobby ロジックの仕様変更

## Changes

- `ROOM_JOIN` payload に `client_version` を追加（optional）
- Worker に最小対応バージョン環境変数を追加（`MIN_SUPPORTED_CLIENT_VERSION`）
- 参加時に `client_version` を比較し、`1.0.0` を拒否
- 拒否理由に更新案内を含める
- 現行クライアントは `client_version` を送信する

## Impact

- Users: `1.0.0` は参加前に明示的に拒否され、更新案内を受け取る
- Data: なし
- Compatibility: `client_version` 未送信や古い版は参加不可（意図的）
- Cloudflare: Worker vars 追加のみ

## Target Files / Layers

- Files:
  - `docs/design/02_ws_protocol.md`
  - `docs/design/07_constants.md`
  - `packages/shared/src/ws/client.ts`
  - `apps/client/src/services/ws-client.ts`
  - `apps/client/src/stores/room-store.ts`
  - `apps/worker/src/types/env.ts`
  - `apps/worker/wrangler.toml`
  - `apps/worker/src/durable/room-object.ts`
- Layers: docs / shared / client / worker

## Test Focus

- `npm run typecheck` 成功
- `npm run lint` 成功
- `ROOM_JOIN_REJECTED` で更新案内が表示されること
- 差分が対象ファイルに限定されていること

## Rollback Plan

- 上記ファイル変更を戻し、version gate を無効化する

## Commit Split Plan

1. docs + shared contract 更新
2. worker gate 実装
3. client 送信・表示対応

## Checklist

- [x] Design doc alignment confirmed
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed
