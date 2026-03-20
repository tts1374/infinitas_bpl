# v1-heartbeat-hibernation-design

## 目的
- `PICKING/PLAYING` の実運用で、無通信時の切断検知遅延を抑える。
- `LOBBY/RESULT` の Hibernation 効率を維持しつつ、対戦中の復帰成功率を上げる。
- `PLAYER_ALREADY_CONNECTED` / `No active room` 系の体感不整合を減らす。

## スコープ
- 本ドキュメントは **次段実装向けの設計案**（未実装）。
- 現行実装（`REJOIN_COOLDOWN_SECONDS=20`）は維持し、段階的に導入する。

## 現状（2026-03-20 時点）
- `REJOIN_COOLDOWN_SECONDS = 20`（実装済み）。
- クライアント再接続ウィンドウも 20 秒（実装済み）。
- keepalive heartbeat は実質無効（`PING` は互換のため許容のみ）。

## 方針
1. `LOBBY/RESULT` は heartbeat 無効（Hibernation 優先）。
2. `PICKING/PLAYING` は heartbeat 有効（切断検知優先）。
3. 送信者は原則 `HOST` のみ（DO duration を抑制）。
4. 検知遅延を吸収するため、host disconnect 猶予と client 再接続窓を heartbeat 設定に合わせて引き上げる。

## 提案パラメータ
- `HEARTBEAT_ACTIVE_STATES = ["PICKING", "PLAYING"]`
- `HEARTBEAT_SENDER = HOST_ONLY`
- `PING_INTERVAL_SECONDS = 20`
- `PING_TIMEOUT_MISSES = 2`
- `HOST_DISCONNECT_GRACE_SECONDS = 40`
- `CLIENT_RECONNECT_WINDOW_SECONDS = 40`

補足:
- 目安式: `grace >= ping_interval * misses + reconnect_buffer`
- 上記設定では `20 * 2 + (buffer 5-10s)` を満たす。

## 期待効果
- 体感上「送ろうとしたらいつのまにか切断」ケースを減らす。
- `HOST_DISCONNECTED` クローズ判定の予測可能性を上げる。
- 全員 heartbeat と比較して通信量/DO wake-up を抑制する。

## 想定コストインパクト
- heartbeat なし: 追加メッセージ 0
- HOST のみ heartbeat (`20s`): 約 180 メッセージ / room / 時
- 全員 heartbeat (`20s`, 4人): 約 720 メッセージ / room / 時

## 仕様詳細
### 1. クライアント
- `PICKING/PLAYING` 入場で heartbeat 送信開始（HOST のみ）。
- `LOBBY/RESULT/CLOSED` で heartbeat 停止。
- `PLAYER_ALREADY_CONNECTED` は引き続き一時エラー扱いで再試行。
- 再接続 UI は「残り秒数」を表示し、`再試行` / `一覧に戻る` を提供。

### 2. Worker/DO
- `PING` を受信したら `PONG` を返す（既存互換）。
- 必要に応じて「最終 heartbeat 受信時刻」を host 判定補助に使う。
  - ただし FSM 権威は `webSocketClose/error + alarm` を維持。
- host disconnect 猶予は 40 秒に拡張。

### 3. Hibernation
- `LOBBY/RESULT` は無送信で休眠しやすい状態を優先。
- `PICKING/PLAYING` は「対戦品質優先ゾーン」として wake-up 増加を許容。

## 導入ステップ
1. **Step 1 (低リスク)**: クライアント heartbeat の状態別制御（HOST のみ）。
2. **Step 2 (同期調整)**: `HOST_DISCONNECT_GRACE` / 再接続窓を 40 秒へ拡張。
3. **Step 3 (観測強化)**: ログ/メトリクス追加（切断検知遅延、復帰成功率）。
4. **Step 4 (必要時)**: サーバー基準の再接続期限通知（C案）を追加。

## 監視指標
- reconnect success rate（`reconnect_started -> reconnect_succeeded`）
- `ROOM_CLOSED(close_reason=HOST_DISCONNECTED)` 発生率
- `PLAYER_ALREADY_CONNECTED` 発生率と継続時間
- average disconnect detection lag（推定）
- DO duration / room-minute（`PICKING/PLAYING`）

## ロールバック
- heartbeat を `PICKING/PLAYING` で無効化。
- host disconnect 猶予・client再接続窓を 20 秒へ戻す。
- UI は既存の再接続導線を維持しつつ、閾値のみ復旧。

