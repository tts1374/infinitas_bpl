# Plan: feat/pr2-worker-room-api

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_arena`
- branch: `feat/pr2-worker-room-api`
- base branch: `v1`
- BASE_SHA: `2dbe8a7b054d4713988fe4ccb31f0a64b15831b6`

## 目的
- `docs/design/09_implementation_plan.md` の PR-2（Worker 入口 + ルーム作成/一覧）を実装する。
- `POST /api/rooms` と `GET /api/rooms` を Cloudflare Worker 側に実装し、公開ロビーを KV で管理できるようにする。

## 非目的
- `GET /api/rooms/:room_id/ws` の WebSocket upgrade 連携（PR-3以降）。
- Durable Object 内の FSM/タイマー/集計/ブロードキャスト実装（PR-3以降）。
- Client UI からの接続フロー実装（PR-8以降）。

## 変更点
- Worker エントリポイントとルーティングを追加。
- `POST /api/rooms` を実装（room_id 採番、join_code 生成/正規化、入力バリデーション、KV put）。
- `GET /api/rooms` を実装（cursor/limit、公開ロビー抽出、`expires_at` フィルタ、`PRIVATE` 除外）。
- join_code 生成ロジックを追加（8文字、大文字、指定文字集合）。
- KV 軽量メタ（RoomListingEntry）I/O 層を追加。
- Worker 開発設定（`wrangler.toml`、worker package scripts）を追加。

## 影響範囲
- ユーザー:
  - ロビー作成と公開一覧取得 API が利用可能になる。
  - `PRIVATE` ルームは一覧に表示されない。
- データ:
  - KV に `room:{room_id}` の軽量メタを保存する。
  - `expires_at` を作成時に設定し、一覧側で期限切れを除外する。
- 互換性:
  - 新規 API 追加で既存動作への破壊的変更はない。
  - join_code は大文字で統一し、仕様（8文字/文字集合）に固定する。
- Cloudflare resources:
  - Worker + KV バインディング前提のコードを追加。
  - DO の本体ロジックは未変更（PR-2では未実装）。

## 実装方針（対象ファイル単位）
- `apps/worker/src/index.ts`:
  - `/api/rooms` 系ルーティングとメソッド分岐を実装。
- `apps/worker/src/routes/rooms.ts`:
  - `POST /api/rooms` と `GET /api/rooms` のハンドラを実装。
- `apps/worker/src/services/room-create.ts`:
  - ルーム作成 payload 検証、join_code 正規化/生成、レスポンス生成を実装。
- `apps/worker/src/services/join-code.ts`:
  - 文字集合に準拠した join_code 生成・検証を実装。
- `apps/worker/src/kv/lobby-kv.ts`:
  - KV put/list/decode/filter を実装し、`expires_at` と `visibility` 条件を適用。
- `apps/worker/src/utils/http.ts`, `apps/worker/src/utils/validation.ts`:
  - JSON レスポンス、クエリ解析、入力検証ユーティリティを実装。
- `apps/worker/src/types/*.ts`:
  - Worker Env / API DTO を整理。
- `apps/worker/wrangler.toml`, `apps/worker/package.json`, `apps/worker/tsconfig.json`:
  - Worker 実行に必要な最小設定を追加。

## テスト観点
- PR-2内で実施:
  - `npm run typecheck` が成功する。
  - `POST /api/rooms` で作成成功し、`PRIVATE` 以外は KV 登録される。
  - `GET /api/rooms` で `limit=10` 既定、cursor によるページ取得、期限切れ除外が機能する。
  - `PRIVATE` が一覧から除外される。
  - `expires_at <= now` が一覧から除外される。
- E2E観点（後続PRで通し検証する項目）:
  - 2人 ARENA/BPL の通し（create -> ready -> pick -> play -> result）。
  - 監視2ソース（inf_daken_counter / inf-notebook）の提出通し。
  - TIMEOUT/強制進行（FORCE_ADVANCE）通し。

## ロールバック方針
- API 実装に不具合がある場合は PR-2 のコミットを revert して worker を smoke 状態へ戻す。
- KV 形式不整合が起きた場合は `room:*` キーを削除し、作成 API の再デプロイで再作成させる。
- join_code ロジック不具合時は生成/検証サービスのみをロールバックし、他 API 差分を温存する。

## Commit Plan（コミット分割計画）
1. PR-2 plan 追加（本ファイル）。
2. Worker ルーティング/型/ユーティリティの骨格追加。
3. `POST /api/rooms`（join_code・validation・KV put）実装。
4. `GET /api/rooms`（cursor/limit・filter）実装。
5. 設定ファイル更新と typecheck 実行結果反映。
