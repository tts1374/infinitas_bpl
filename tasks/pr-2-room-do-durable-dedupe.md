# pr-2-room-do-durable-dedupe

## Purpose
- `RoomDurableObject` の `seenClientMessageIds` を durable 化し、constructor 再実行後も重複メッセージ抑止を継続できるようにする。

## Non-goals
- `ctx.acceptWebSocket()` への基盤移行
- reconnect 猶予仕様変更
- WS schema/type/payload の変更
- LobbyDirectoryDO や SQL API への拡張
- room 全体状態モデル再設計

## Changes
- `RoomDurableRecord` に `seen_client_message_ids` を追加し、serialize/deserialize を導入する。
- constructor hydrate で durable state から `seenClientMessageIds` を復元する（不正データは安全に無視）。
- message dedupe を durable 復元済み state ベースに変更する（`playerId -> Set` をメモリ表現として使用）。
- `RETURN_TO_LOBBY` では clear せず、`CLOSED` 遷移と record 削除相当時のみ clear する。
- `seenClientMessageIds[playerId]` に上限を設け、古い ID を先頭から削除して永続化サイズを bounded に保つ。
- 既存 `processedRequestKeys` ベース idempotency を維持する。

## Impact
- Users: 目に見える UI 変更なし。hibernation 復帰後の重複再送挙動が安定化。
- Data: `room-record` に `seen_client_message_ids` が追加される。
- Compatibility: 旧 record（当該フィールド欠落）を受理し空として扱う後方互換。
- Cloudflare: Durable Object storage record 更新のみ。KV/Lobby contract 変更なし。

## Target Files / Layers
- Files:
  - `apps/worker/src/durable/room-object.ts`
  - （必要最小限で）関連テストファイル
- Layers:
  - worker (Durable Object)

## Test Focus
- QUALITY 1: worker build/typecheck, lint, 既存テスト実行（対象範囲）
- QUALITY 2: 目的外 diff 無し、UTF-8 no BOM / LF 逸脱無し
- QUALITY 3: idempotency（client_msg_id）重複排除、`RETURN_TO_LOBBY` 後の dedupe 継続、`CLOSED` 後の clear
- QUALITY 4: 対象外（監視ソース I/O 非変更）
- QUALITY 5: 対象外（E2E は今回スコープ外。必要時は別途）

## Rollback Plan
- 本差分を revert し、`room-record` の追加フィールドを無視する既存挙動へ戻す。
- 旧 record は optional decode で扱うため、ロールバック時の互換性リスクは低い。

## Commit Split Plan
1. `RoomDurableRecord` 拡張と serialize/deserialize・hydrate/clear 実装
2. message dedupe 呼び出し更新と最小限の検証/テスト更新

## Checklist
- [x] Design doc alignment confirmed (contract changeなし)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (not required)
