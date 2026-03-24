# WebSocketプロトコル設計（Ph1 / Cloudflare Workers + Durable Objects）

## 0. 前提（Cloudflare）
- ルーム = 1 Durable Object（DO）
- WorkerはHTTP/WSの入口（ルーティング）。FSM・権限・タイマー・集計はDO内で完結。
- WebSocket Upgrade は Worker で受け、対象DOへ転送する（DO側で accept）。
- 先着順・時刻基準は DO の `Date.now()` を正とする。
- 冪等化: クライアント送信は `client_msg_id`（UUID）必須。DO内で `(player_id, client_msg_id)` を重複排除。

## 1. 接続経路（推奨）
- `POST /api/rooms`（HTTP）: ルーム作成（room_id払い出し、RoomDO初期化、LobbyDirectoryDO登録）
- `GET /api/lobby`（HTTP）: 公開ロビー一覧（LobbyDirectoryDO読み）
- `GET /api/rooms/:room_id/ws?join_code=...`（WS Upgrade）: ルームへ接続（Workerがroom_idのDOへルーティング）
- `GET /api/charts`（HTTP）: 全体譜面検索（設定条件での候補取得）
- `GET /api/rooms/:room_id/charts`（HTTP）: ルーム文脈付き譜面検索（`match_song_unlock_filter` を反映）
- `GET /api/song-packs`（HTTP）: 楽曲パック一覧取得
- `GET /api/chart-aliases/resolve`（HTTP）: alias exact 解決（runtime alias）

## 2. 共通Envelope

### 2.1 Client -> DO（via WS）
```json
{
  "type": "MSG_TYPE",
  "client_msg_id": "uuid",
  "room_id": "string",
  "player_id": "string",
  "payload": {}
}
```

### 2.2 DO -> Client（via WS）
```json
{
  "type": "MSG_TYPE",
  "server_msg_id": "uuid",
  "server_time": "ISO8601",
  "room_id": "string",
  "payload": {}
}
```

## 3. メッセージ一覧（Client -> DO）

### 3.1 ルーム
- `ROOM_JOIN`
  - payload: `{ join_code?: string, display_name: string, source: "inf_daken_counter"|"inf-notebook"|"daken_counter_v3"|"reflux", client_version?: string, client_capabilities?: object }`
  - 備考: WS接続直後に必ず送る（DOがJOIN完了するまでstate配信しない）
  - 備考: `client_capabilities.song_unlocks = { bit_unlocked: boolean, djp_unlocked: boolean, allow_leggendaria: boolean, owned_pack_ids: number[] }` を送ると、`START_MATCH` 時の共通解禁フィルタ計算に利用される
- `ROOM_LEAVE`
  - payload: `{}`

### 3.2 LOBBY
- `READY_SET`
  - payload: `{ ready: boolean }`
- `START_MATCH`（ホスト）
  - payload: `{ request_id: string }`
- `RETURN_TO_LOBBY`（ホスト）
  - payload: `{ request_id: string }`

### 3.3 PICKING
- `PICK_SUBMIT`
  - payload: `{ request_id: string, pick_chart_key: string }`

### 3.4 PLAYING（提出/スキップ/強制）
- `RESULT_SUBMIT`
  - payload: `{ request_id: string, round_index: number, observed_key: ExpectedKey, metric_value: number, source_meta?: object }`
- `SKIP_SELF`
  - payload: `{ request_id: string, round_index: number, reason: "UNOWNED"|"TECH"|"OTHER" }`
- `SKIP_HOST_ASSIGN`（ホスト / 予約）
  - payload: `{ request_id: string, round_index: number, target_player_id: string, reason: "UNOWNED"|"TECH"|"OTHER" }`
  - 備考: 現行v1では受理しない。未確定者の強制確定は `FORCE_ADVANCE` を用いる
- `FORCE_ADVANCE`（ホスト）
  - payload: `{ request_id: string }`

### 3.5 状態同期/疎通
- `STATE_GET`
  - payload: `{}`
- `PING`
  - payload: `{}`
  - 備考: 現行クライアント実装では `PICKING/PLAYING` かつ host のみ送信

## 4. メッセージ一覧（DO -> Client）

### 4.1 ルーム
- `ROOM_JOIN_ACCEPTED`
  - payload: `{ room_state_snapshot: RoomStateSnapshot }`
- `ROOM_JOIN_REJECTED`
  - payload: `{ reason: string }`
  - 備考: `client_version` が最小対応版未満または未送信の場合、`reason` には `CLIENT_VERSION_UNSUPPORTED: ...` を返す
- `ROOM_UPDATED`
  - payload: `{ room_state_snapshot: RoomStateSnapshot }`
- `ROOM_CLOSED`
  - payload: `{ close_reason: CloseReason, closed_at: "ISO8601", result_ready: boolean, event_id: string }`
- `ROOM_NOTIFICATION`
  - payload: `{ kind: "match_found"|"count_beep"|"phase_locked"|"count_go"|"cancel"|"error", event_id: string, scheduled_at: "ISO8601" }`

### 4.2 LOBBY
- `READY_STATUS_CHANGED`
  - payload: `{ player_id: string, ready: boolean }`
- `START_MATCH_REJECTED`
  - payload: `{ reason: string }`

### 4.3 PICKING
- `PICK_ACCEPTED`
  - payload: `{ player_id: string, pick_chart_key: string, accepted_at: "ISO8601" }`
- `PICK_REJECTED`
  - payload: `{ reason: string }`
- `PICK_FROZEN`
  - payload: `{ frozen_rounds: FrozenRound[] }`

### 4.4 PLAYING
- `ROUND_BEGIN`
  - payload: `{ round_index: number, expected_key: ExpectedKey, round_started_at: "ISO8601", soft_ttl_seconds: number }`
- `PLAYER_ROUND_CONFIRMED`
  - payload: `{ round_index: number, player_id: string, status: "PLAYED"|"SKIPPED"|"TIMEOUT", metric_value: number, reason?: string|null, submitted_at: "ISO8601", submitted_by: "SELF"|"HOST"|"SYSTEM", source_meta?: object|null }`
- `ROUND_ENDED`
  - payload: `{ round_index: number }`
- `FORCE_ADVANCE_APPLIED`
  - payload: `{ round_index: number, timed_out_players: string[] }`

### 4.5 RESULT
- `RESULT_READY`
  - payload: `{ summary: { match_id, mode, win_metric, total_rounds, completed_rounds, winner_player_ids, is_draw, is_rated, rated_block_reason, rating_before, rating_after, rating_delta }, per_round: object, per_player: object }`
  - 備考: `per_round.rounds[].results[]` には `status / metric_value / reason / submitted_at / submitted_by / source_meta?` を含めてもよい
  - 備考: `rated_block_reason` は最低限 `private_room | missing_submission | mismatch_observed_key | incomplete_match | skip_occurred | timeout_occurred | force_advanced | result_conflict` を扱う
  - 備考: v1 では `RESULT_READY.summary.is_rated` がレート適用可否の権威情報
  - 備考: v1 では `RESULT_READY.summary.match_id` を結果確定時の統計識別子の正本とし、欠落時のみ `room_id` fallback を許容
  - 備考: 進行中セッション識別は `RoomStateSnapshot.current_match_id` を正本とする（`RESULT_READY.summary.match_id` と同一であること）
  - 備考: 通常フローでは `PLAYING -> RESULT` 遷移時に配信し、`RESULT -> LOBBY` 復帰まで保持して表示する

### 4.6 同期/エラー
- `STATE_SNAPSHOT`
  - payload: `{ room_state_snapshot: RoomStateSnapshot }`
- `ERROR`
  - payload: `{ code: string, message: string }`
- `PONG`
  - payload: `{}`

## 5. 型定義（最小）

### 5.1 ExpectedKey
```json
{
  "play_style": "SP|DP",
  "difficulty": "NORMAL|HYPER|ANOTHER|LEGGENDARIA|...",
  "title_search_key": "string",
  "chart_id": "number|null (optional)"
}
```

### 5.2 FrozenRound
```json
{
  "round_index": 0,
  "expected_key": { "play_style":"DP","difficulty":"NORMAL","title_search_key":"...", "chart_id": 12345 },
  "display": { "title":"string", "level": 12 }
}
```

### 5.3 RoomStateSnapshot（Ph1最小）
```json
{
  "room_id": "string",
  "current_match_id": "string",
  "room_state": "LOBBY|PICKING|PLAYING|RESULT|CLOSED",
  "settings": { "...": "..." },
  "host_player_id": "string",
  "players": [
    { "player_id": "string", "display_name": "string", "source": "inf_daken_counter|inf-notebook|daken_counter_v3|reflux", "song_unlocks": { "bit_unlocked": false, "djp_unlocked": false, "allow_leggendaria": false, "owned_pack_ids": [] }, "connected": true, "ready": false }
  ],
  "match_song_unlock_filter": { "include_bit": false, "include_djp": false, "include_leggendaria": false, "common_pack_ids": [] },
  "picks": [
    { "player_id": "string", "pick_chart_key": "string", "accepted_at": "ISO8601" }
  ],
  "frozen_rounds": [
    { "round_index": 0, "expected_key": { "play_style":"DP","difficulty":"NORMAL","title_search_key":"...", "chart_id": 12345 }, "display": { "title":"...", "level":12 } }
  ],
  "current_round": {
    "round_index": 0,
    "round_started_at": "ISO8601",
    "soft_ttl_seconds": 300,
    "confirmed": [
      { "player_id":"string", "status":"PLAYED|SKIPPED|TIMEOUT", "metric_value": 1234, "reason":"UNOWNED|TECH|OTHER|null", "submitted_at":"ISO8601", "submitted_by":"SELF|HOST|SYSTEM", "source_meta": { "...": "..." } }
    ]
  },
  "timers": {
    "ready_check_deadline": "ISO8601|null",
    "picking_deadline": "ISO8601|null",
    "match_deadline": "ISO8601|null",
    "result_deadline": "ISO8601|null"
  },
  "result_ready": false,
  "close_reason": "CloseReason|null"
}
```

- `timers.result_deadline` は Ph1 現行フローでは通常 `null` 固定の予約欄

## 6. DO側ガード（必須）
- 状態ガード: 状態に合わない操作は `ERROR` または `*_REJECTED`
- 冪等化: `(player_id, client_msg_id)` は二重適用しない
- 操作系は `(player_id, type, request_id)` でも二重適用しない
- 先着順: `PICK_SUBMIT` の採用順はDO受信順（DOがaccepted_at付与）
- `SKIP_HOST_ASSIGN`: 現行v1では `INVALID_STATE` を返して受理しない
- `FORCE_ADVANCE`: `room_state=PLAYING` かつ未確定者ありのときのみ許可し、未確定者を `TIMEOUT` / `submitted_by=SYSTEM` で確定する
- START_MATCH: `players >= 2` かつ `room_state=LOBBY` かつ全員READY かつ前マッチ揮発状態クリア済みのみ
- START_MATCH: 成功時に `match_song_unlock_filter` を固定し、そのマッチ中は選曲候補とランダム抽選へ適用する
- START_MATCH: 成功時に `current_match_id` を新規発行し、同一ルーム内の再戦と統計識別を分離する
- RETURN_TO_LOBBY: `room_state=RESULT` のみ。復帰時は全員readyと前マッチ揮発状態をリセットする
- RETURN_TO_LOBBY: 復帰時は `current_match_id=room_id` に戻す（次戦開始までは provisional 識別子）
- RESULT_SUBMIT: `observed_key == expected_key` かつ `round_index == current_round_index` のみ採用（accept_window=0）
  - `play_style/difficulty/title_search_key` は常に一致必須
  - `chart_id` は双方にある場合のみ一致必須。`expected_key.chart_id` がある `daken_counter_v3` 観測で `observed_key.chart_id` 欠落時は不採用
- ROOM_JOIN: `client_version >= MIN_SUPPORTED_CLIENT_VERSION` を満たさない場合は `ROOM_JOIN_REJECTED` を返す
- PICKING timeout: 未pickプレイヤーへランダム割当を行ってから `PICK_FROZEN` / `ROUND_BEGIN` を配信
- `RESULT_READY` 生成後の `RESULT` / `CLOSED` では提出系はすべて拒否（勝敗改変防止）
