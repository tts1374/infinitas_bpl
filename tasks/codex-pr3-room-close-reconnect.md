# codex-pr3-room-close-reconnect

## Purpose
- `RoomDurableObject` の WebSocket close を即退室ではなく一時切断として扱い、`rejoin_until` 猶予内の再接続を安全に受理する。
- 同一 `playerId` の再JOINで seat/state を維持しつつ、旧 socket を新 socket に置換する。
- hibernation / constructor 再実行後でも reconnect 判定が room state で一貫するようにする。

## Non-goals
- room phase 遷移仕様の変更
- heartbeat 廃止や timer 最適化
- `ctx.acceptWebSocket()` 基盤移行
- durable dedupe / idempotency 仕様の変更
- `LobbyDirectoryDO` の仕様変更

## Changes
- `webSocketClose()` の責務を一時切断更新中心に整理し、即退室確定処理を除外する。
- close 時に対象 player の `connected=false`, `left_at=now`, `rejoin_until=now+grace` を更新して persistence する。
- `ROOM_JOIN` を「新規参加 / 再接続 / 競合 join」で分岐し、再接続条件を room state 基準で判定する。
- 再JOIN時に同一 player の旧 socket をクリーンアップし、新 socket を正として attachment/session を置換する。
- old socket close の遅延到達で新 socket 側状態を壊さないガードを追加する。
- close/reconnect 周辺の最小テストを追加・更新する。

## Impact
- Users: 一時切断後の同一 player 再接続で対戦継続しやすくなる。
- Data: 既存 room state フィールド (`connected/left_at/rejoin_until`) を利用。保存形式追加なし。
- Compatibility: WS schema 変更なし（既存 `ROOM_JOIN` / `ROOM_UPDATED` / snapshot 運用内）。
- Cloudflare: Room DO の close/join 内部ロジックのみ変更（FSM/Protocol 影響あり）。

## Target Files / Layers
- Files:
  - `apps/worker/src/durable/room-object.ts`
  - `apps/worker/src/durable/room-state.ts`（必要最小限のみ）
  - `apps/worker/src/durable/room-state.test.mjs`
  - `apps/worker/src/durable/room-object*.test*`（存在する場合のみ）
- Layers:
  - worker (Durable Object + tests)

## Test Focus
- close で即退室確定しないこと
- close 後に `connected=false`, `left_at`, `rejoin_until` が保存されること
- `rejoin_until` 内 `ROOM_JOIN` が reconnect 受理されること
- reconnect で `connected=true`, `left_at=null`, `rejoin_until=null` に戻ること
- reconnect で旧 socket が置換されること
- 期限超過時に reconnect 扱いしないこと
- old socket close が new socket の接続状態を壊さないこと
- 技術検証: worker 型/テスト
- 差分検証: 無関係 diff・encoding/LF 逸脱なし
- FSM/Protocol 検証: QUALITY.md section 3 の該当項目を変更範囲で確認

## Rollback Plan
- `room-object.ts` の close/reconnect 分岐を旧実装へ戻す。
- 併せて追加テストを戻し、既存 close 挙動に復帰する。

## Commit Split Plan
1. Room DO close/join の reconnect ロジック整理
2. close/reconnect 回帰テスト追加・更新

## BASE_SHA
- `476f1c98348ba0bd1aac20579820d2d7e2d21b16`

## Checklist
- [x] Design doc alignment confirmed (契約変更なし。既存 docs/design と矛盾しない範囲)
- [x] Impact scope identified (worker DO / WS / persistence / tests)
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (not required for this task)
