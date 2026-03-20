# v1-heartbeat-hibernation-implementation

## Purpose
- `tasks/v1-heartbeat-hibernation-design.md` の方針に沿って、対戦中のみ heartbeat を有効化し、再接続猶予を 40 秒へ拡張する。

## Non-goals
- WS メッセージ型の追加/削除や payload スキーマ変更は行わない。
- LobbyDirectoryDO や監視ソース I/O の仕様変更は行わない。
- 段階導入のうち、観測基盤追加（Step 3）と再接続期限サーバ通知（Step 4）はこのタスク対象外。

## Changes
- shared 定数で `REJOIN_COOLDOWN_SECONDS` を 40 秒へ更新。
- client 側で heartbeat を `PICKING/PLAYING` かつ host のときのみ送信し、その他状態で停止。
- client 側再接続 UI/再試行窓を 40 秒へ同期。
- worker 側で `PING` 受信時に `PONG` を返し、host disconnect 猶予を 40 秒へ反映。
- 既存テスト（room-state 等）を新しい猶予値に合わせて更新。

## Impact
- Users: `PICKING/PLAYING` 中の切断検知と再接続体験が改善。
- Data: 既存保存形式への影響なし。
- Compatibility: `PING/PONG` は既存型を利用し互換維持。
- Cloudflare: `PICKING/PLAYING` 中のみ host heartbeat による wake-up が増加。

## Target Files / Layers
- Files:
  - `packages/shared/src/constants/timers.ts`
  - `apps/client/src/stores/room-store.ts`
  - `apps/client/src/services/ws-client.ts`（必要な場合）
  - `apps/worker/src/durable/room-state.ts`
  - `apps/worker/src/durable/room-object.ts`
  - `apps/worker/src/durable/room-state.test.mjs`
  - 関連する client test（必要な場合）
- Layers: client / worker / shared

## Test Focus
- Technical: 対象パッケージの build/test を実行。
- Diff: 目的ファイル以外の差分なし、UTF-8(no BOM)/LF逸脱なし。
- FSM/Protocol: host 切断猶予・再接続猶予・PING/PONG 互換動作を確認。

## Rollback Plan
- heartbeat 送信条件を無効化（常時停止）し、`REJOIN_COOLDOWN_SECONDS` と client reconnect window を 20 秒へ戻す。
- `PING` 受信時の `PONG` 応答を no-op 許容へ戻す（必要時）。

## Commit Split Plan
1. shared/worker の猶予値と heartbeat 応答更新。
2. client heartbeat 状態制御と再接続窓同期。
3. テスト調整と最終検証。

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
