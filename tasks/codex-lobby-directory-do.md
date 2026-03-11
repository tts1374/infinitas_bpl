# codex-lobby-directory-do

## Mode Decision

Mode: Plan Mode
Reason:
- ロビー一覧の正本を KV から Durable Object へ変更するアーキテクチャ変更
- Durable Objects のロビー責務/TTL 清掃/状態通知を追加する高リスク変更
- Worker + RoomDO + client + shared + docs を跨ぐクロスレイヤ変更

Base:
- base branch: `v1`
- branch: `codex/lobby-directory-do`
- BASE_SHA: `835fcfcfe1adedf81a455014aa32f79858e5c8b4`

## Purpose
- ロビー一覧の正本を `LobbyDirectoryDO` に一本化し、KV 依存を撤去する。
- `GET /api/lobby` を追加し、v1 ロビー同期を 10 秒 polling で安定化する。
- `RESULT -> LOBBY` で同一 `roomId` を維持した再掲示を成立させる。

## Non-goals
- WS メッセージ schema の追加/変更は行わない。
- 監視ソース I/O 仕様（Rust watcher/parser）は変更しない。
- ランキング/統計ロジックは変更しない。

## Risk Triggers
- Durable Object FSM/timer 変更（match TTL の RESULT 継続を含む）
- KV ロビー挙動の廃止
- client/worker/shared の契約変更（ロビー一覧 API）

## Invariants Impacted
- INV-01: preserved
  - Worker は薄いルーティング、状態管理は DO 側で維持。
- INV-02: preserved
  - `LOBBY -> PICKING -> PLAYING -> RESULT -> CLOSED` の遷移契約は維持。
- INV-03: changed
  - `match_ttl` の有効範囲を RESULT まで維持し、TTL 超過時解散を担保。
- INV-05: preserved
  - `(player_id, client_msg_id)` 冪等は未変更。
- INV-06: preserved
  - host 権限境界は未変更。
- INV-07: changed
  - ロビー正本を KV から `LobbyDirectoryDO` へ移行。
- INV-08: preserved
  - DO state loss 時の `ROOM_STATE_LOST` クローズ動作は維持。

## Changes
- docs/design のロビー/KV 前提を `LobbyDirectoryDO` 正本へ更新。
- `LobbyDirectoryDO` 新規実装（storage 永続化、復元、TTL 清掃、表示条件フィルタ）。
- `GET /api/lobby` 実装と RoomDO->LobbyDirectoryDO 通知（upsert/remove）導入。
- RoomDO のロビー同期を KV 書き込みから DO 通知へ置換。
- ロビー用途 KV 実装/型/binding を削除。
- client ロビー取得を `/api/lobby` + 10 秒 polling へ移行。

## Impact
- Users: ロビー作成直後の一覧反映遅延を改善。
- Data: ロビー一覧データ保存先を KV から DO storage へ変更。
- Compatibility:
  - 新規 `GET /api/lobby` を追加。
  - 既存 `POST /api/rooms` と WS ルーム接続契約は維持。
- Cloudflare:
  - KV binding 削除。
  - `LobbyDirectoryDO` binding/migration 追加。

## Target Files / Layers
- Files:
  - `apps/worker/src/durable/*`
  - `apps/worker/src/routes/*`
  - `apps/worker/src/services/*`
  - `apps/worker/src/types/*`
  - `apps/worker/src/index.ts`
  - `apps/worker/wrangler.toml`
  - `apps/client/src/services/worker-api-client.ts`
  - `apps/client/src/stores/lobby-store.ts`
  - `apps/client/src/pages/LobbyPage.tsx`
  - `apps/client/src/app/App.tsx`
  - `packages/shared/src/{models,constants}/*`
  - `docs/design/{01,02,03,04,05,07,08}.md`
- Layers: worker / durable / client / shared / docs

## Test Focus
- QUALITY section 1 (technical): typecheck, worker test, build checks
- QUALITY section 2 (diff): 目的外差分なし、UTF-8/LF 維持
- QUALITY section 3 (FSM/Protocol): TTL/状態遷移/host権限/冪等への退行なし
- QUALITY section 4: not required（source I/O 非変更）
- QUALITY section 5: not run（手元 E2E は本タスクでは未実施）

## Rollback Plan
- 退行時は `codex/lobby-directory-do` の差分を revert し、`v1` の KV ロビー実装へ戻す。
- Cloudflare 側は DO binding/migration とルーティング差分を同時に戻す。

## Commit Split Plan
1. docs/design を LobbyDirectoryDO 正本仕様へ更新
2. shared 型/定数 + Worker LobbyDirectoryDO 基盤（env/wrangler 含む）
3. RoomDO 通知連携 + KV ロビー実装削除
4. client `/api/lobby` + 10 秒 polling 移行
5. 検証と微修正

## Checklist
- [x] Design doc alignment confirmed (required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed

