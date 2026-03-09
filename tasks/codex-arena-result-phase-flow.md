## Purpose

ARENA の各曲間に mock 準拠の `RESULT PHASE` を 10 秒表示し、人数に応じた round 数だけ `PLAYING -> RESULT PHASE -> PLAYING` を繰り返してから `CLOSED (FINAL)` に遷移させる。

BASE_SHA: `ee73811177ac78fbd252d39b2e8c848416e4d0a2`

## Non-goals

- WebSocket schema の変更
- BPL の既存遷移仕様変更
- LOBBY / PICKING / FINAL RESULT の見た目改修
- stats / archive / source watcher の仕様変更

## Changes

- worker の ARENA round 進行で、最終 round 以外は次 round 開始を 10 秒遅延させる
- client の ARENA 表示で、上記遅延中を mock の `RESULT PHASE` として描画する
- ARENA の `RESULT PHASE` は人数に応じた round 数に従って表示し、最終 round 後のみ `CLOSED (FINAL)` に遷移する

## Impact

- User: ARENA の画面遷移が mock と一致する
- Data: 既存 snapshot / result_ready payload を流用し、保存形式は変更しない
- Compatibility: 既存 client / worker 間 schema は維持する
- Cloudflare: DO の timer/FSM 挙動のみ変更、KV や Worker route は非対象

## Target Files / Layers

- `apps/worker/src/durable/room-state.ts`
- `apps/client/src/pages/RoomPage.tsx`
- 必要時のみ `apps/client/src/components/RoomArena.tsx`

## Test Points

- 2人 ARENA: 1 曲目終了後に 10 秒 `RESULT PHASE`、2 曲目終了後に `CLOSED (FINAL)`
- 3人 ARENA: 1, 2 曲目終了後に 10 秒 `RESULT PHASE`、3 曲目終了後に `CLOSED (FINAL)`
- 4人 ARENA: 1, 2, 3 曲目終了後に 10 秒 `RESULT PHASE`、4 曲目終了後に `CLOSED (FINAL)`
- 既存 BPL 遷移に回帰がないこと
- client / worker の型検証と build が通ること

## Rollback

- worker の ARENA lead-in を 0 秒に戻す
- client の ARENA `RESULT PHASE` 判定を削除して従来どおり `PLAYING` / `CLOSED` のみ表示に戻す

## Commit Split

- [ ] worker の ARENA inter-round timer 実装
- [ ] client の ARENA `RESULT PHASE` 表示対応
- [ ] 型 / build 検証
