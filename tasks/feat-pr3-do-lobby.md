# Plan: feat/pr3-do-lobby

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl`
- branch: `feat/pr3-do-lobby`
- base branch: `v1`
- BASE_SHA: `b5c6ca458e07f56c2bb1beeba3dbe91119eefb65`

## 目的
- `docs/design/09_implementation_plan.md` の PR-3（DO 接続管理 + LOBBY）を実装する。
- Worker の WS 入口と Durable Object へのルーティングを追加し、複数プレイヤー接続・参加/退出・状態同期を成立させる。

## 非目的
- READY_CHECK 以降（`READY_CHECK_OPEN`/`READY_SET`/`START_MATCH`）の状態遷移実装（PR-4以降）。
- PICKING/PLAYING/RESULT のロジック、タイマー、集計実装（PR-5以降）。
- Client UI 実装（PR-8以降）。

## 変更点
- `GET /api/rooms/:room_id/ws` の WebSocket upgrade ルートを追加。
- Worker から `room_id` 由来の DO へ安定ルーティング（`idFromName(room_id)`）を実装。
- DO 側に接続管理を実装（セッション管理、切断時 cleanup、ブロードキャスト）。
- LOBBY 最小メッセージを実装:
  - Client: `ROOM_JOIN` / `ROOM_LEAVE` / `STATE_GET` / `PING`
  - Server: `ROOM_JOIN_ACCEPTED` / `ROOM_JOIN_REJECTED` / `ROOM_UPDATED` / `STATE_SNAPSHOT` / `PONG` / `ERROR`
- host 判定・`max_players` 超過拒否・`room_full` 判定を実装。
- `ROOM_JOIN_ACCEPTED` で `RoomStateSnapshot` を返却し、JOIN/LEAVE 時に `ROOM_UPDATED` を配信。
- `wrangler.toml` に Durable Object binding/migration を追加し、`WorkerEnv` 型を拡張。

## 影響範囲
- ユーザー:
  - 同一 room_id へ複数人が WS 接続し、参加/退出が即時同期される。
  - 定員超過時は `ROOM_JOIN_REJECTED` を受ける。
- データ:
  - PR-3では KV スキーマは変更しない（軽量ロビー形式は PR-2 を維持）。
  - DO 内メモリでプレイヤー接続状態を保持する（永続化は Ph1 では未対応）。
- 互換性:
  - 既存 HTTP API（`POST /api/rooms`/`GET /api/rooms`）との互換性は維持。
  - WS メッセージ形式は `packages/shared` の schema に準拠し、追加のみで破壊変更なし。
- Cloudflare resources:
  - Worker に Durable Object namespace binding を追加。
  - KV の利用方法・キー形式は変更しない。

## 実装方針（対象ファイル単位）
- `apps/worker/src/index.ts`:
  - `/api/rooms/:room_id/ws` のルーティング追加。
  - HTTP route と WS route の責務を分離。
- `apps/worker/src/routes/rooms.ts`:
  - `handleRoomWebSocket` を追加し、upgrade 検証と DO fetch 転送を実装。
- `apps/worker/src/types/env.ts`:
  - Durable Object namespace 型と binding（`ROOM_DO`）を追加。
- `apps/worker/src/durable/room-state.ts`（新規）:
  - LOBBY 用内部状態（settings, host_player_id, players, timers）と snapshot 組み立てを実装。
- `apps/worker/src/durable/ws-codec.ts`（新規）:
  - WS envelope の decode/encode と最小バリデーションを実装。
- `apps/worker/src/durable/room-object.ts`（新規）:
  - DO 本体（接続管理、メッセージ処理、broadcast、join/leave）を実装。
- `apps/worker/wrangler.toml`:
  - Durable Object namespace と migration を追加。

## テスト観点
- PR-3内で実施:
  - `npm run typecheck` 成功。
  - `wrangler build` 成功。
  - WS upgrade 経由で同一 room_id に複数接続できる。
  - `ROOM_JOIN` で参加、`ROOM_LEAVE`/切断で退出が反映され `ROOM_UPDATED` が配信される。
  - `max_players` 到達時に `ROOM_JOIN_REJECTED`（room full）となる。
  - 最初の参加者が host として固定される。
- E2E観点（後続PRで通し検証する項目）:
  - 2人 ARENA/BPL の通し（create -> ready -> pick -> play -> result）。
  - 監視2ソース（inf_daken_counter / inf-notebook）の提出通し。
  - TIMEOUT/強制進行（FORCE_ADVANCE）通し。

## ロールバック方針
- WS/DO 導入に不具合がある場合は PR-3 コミットを revert して PR-2（HTTP+KV）状態へ戻す。
- DO binding/migration の設定問題は `wrangler.toml` 差分のみ個別ロールバック可能にする。
- ルーム参加処理不具合時は DO ロジックを段階 revert し、HTTP API 側への影響を隔離する。

## Commit Plan（コミット分割計画）
1. PR-3 plan 追加（本ファイル）。
2. Worker WS route + Env/設定更新（DO binding/migration）。
3. DO 基盤（state/codec/object）追加。
4. LOBBY メッセージ処理（JOIN/LEAVE/STATE_GET/PING）と broadcast 実装。
5. typecheck / wrangler build 実行と最終調整。
