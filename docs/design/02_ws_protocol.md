# WebSocketプロトコル設計（Ph1 / Cloudflare Workers + Durable Objects）

## 0. 前提（Cloudflare）
- ルーム = 1 Durable Object（DO）
- WorkerはHTTP/WSの入口（ルーティング）。FSM・権限・タイマー・集計はDO内で完結。
- WebSocket Upgrade は Worker で受け、対象DOへ転送する（DO側で accept）。
- 先着順・時刻基準は DO の `Date.now()` を正とする。
- 冪等化: クライアント送信は `client_msg_id`（UUID）必須。DO内で `(player_id, client_msg_id)` を重複排除。

## 1. 接続経路（推奨）
- `POST /api/rooms`（HTTP）: ルーム作成（room_id払い出し、KVへ軽量メタ登録）
- `GET /api/rooms`（HTTP）: 公開ロビー一覧（KV読み）
- `GET /api/rooms/:room_id/ws?join_code=...`（WS Upgrade）: ルームへ接続（Workerがroom_idのDOへルーティング）

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
  - payload: `{ join_code?: string, display_name: string, source: "inf_daken_counter"|"inf-notebook", client_capabilities?: object }`
  - 備考: WS接続直後に必ず送る（DOがJOIN完了するまでstate配信しない）
- `ROOM_LEAVE`
  - payload: `{}`

### 3.2 READY_CHECK
- `READY_CHECK_OPEN`（ホスト）
  - payload: `{}`
- `READY_SET`
  - payload: `{ ready: boolean }`
- `START_MATCH`（ホスト）
  - payload: `{}`

### 3.3 PICKING
- `PICK_SUBMIT`
  - payload: `{ pick_chart_key: string }`

### 3.4 PLAYING（提出/スキップ/強制）
- `RESULT_SUBMIT`
  - payload: `{ round_index: number, observed_key: ExpectedKey, metric_value: number, source_meta?: object }`
- `SKIP_SELF`
  - payload: `{ round_index: number, reason: "UNOWNED"|"TECH"|"OTHER" }`
- `SKIP_HOST_ASSIGN`（ホスト）
  - payload: `{ round_index: number, target_player_id: string, reason: "UNOWNED"|"TECH"|"OTHER" }`
- `FORCE_ADVANCE`（ホスト）
  - payload: `{}`

### 3.5 状態同期/疎通
- `STATE_GET`
  - payload: `{}`
- `PING`
  - payload: `{}`

## 4. メッセージ一覧（DO -> Client）

### 4.1 ルーム
- `ROOM_JOIN_ACCEPTED`
  - payload: `{ room_state_snapshot: RoomStateSnapshot }`
- `ROOM_JOIN_REJECTED`
  - payload: `{ reason: string }`
- `ROOM_UPDATED`
  - payload: `{ room_state_snapshot: RoomStateSnapshot }`
- `ROOM_CLOSED`
  - payload: `{ reason: string }`

### 4.2 READY_CHECK
- `READY_CHECK_OPENED`
  - payload: `{ ready_check_deadline: "ISO8601" }`
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
  - payload: `{ round_index: number, player_id: string, status: "PLAYED"|"SKIPPED"|"TIMEOUT", metric_value: number, reason?: string|null, submitted_at: "ISO8601", submitted_by: "SELF"|"HOST"|"SYSTEM" }`
- `ROUND_ENDED`
  - payload: `{ round_index: number }`
- `FORCE_ADVANCE_APPLIED`
  - payload: `{ round_index: number, timed_out_players: string[] }`

### 4.5 RESULT
- `RESULT_READY`
  - payload: `{ summary: object, per_round: object, per_player: object }`

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
  "title_search_key": "string"
}
```

### 5.2 FrozenRound
```json
{
  "round_index": 0,
  "expected_key": { "play_style":"DP","difficulty":"NORMAL","title_search_key":"..." },
  "display": { "title":"string", "level": 12 }
}
```

### 5.3 RoomStateSnapshot（Ph1最小）
```json
{
  "room_id": "string",
  "room_state": "LOBBY|READY_CHECK|PICKING|PLAYING|RESULT|CLOSED",
  "settings": { "...": "..." },
  "host_player_id": "string",
  "players": [
    { "player_id": "string", "display_name": "string", "source": "inf_daken_counter|inf-notebook", "connected": true, "ready": false }
  ],
  "picks": [
    { "player_id": "string", "pick_chart_key": "string", "accepted_at": "ISO8601" }
  ],
  "frozen_rounds": [
    { "round_index": 0, "expected_key": { "play_style":"DP","difficulty":"NORMAL","title_search_key":"..." }, "display": { "title":"...", "level":12 } }
  ],
  "current_round": {
    "round_index": 0,
    "round_started_at": "ISO8601",
    "soft_ttl_seconds": 300,
    "confirmed": [
      { "player_id":"string", "status":"PLAYED|SKIPPED|TIMEOUT", "metric_value": 1234, "reason":"UNOWNED|TECH|OTHER|null", "submitted_by":"SELF|HOST|SYSTEM" }
    ]
  },
  "timers": {
    "ready_check_deadline": "ISO8601|null",
    "match_deadline": "ISO8601"
  }
}
```

## 6. DO側ガード（必須）
- 状態ガード: 状態に合わない操作は `ERROR` または `*_REJECTED`
- 冪等化: `(player_id, client_msg_id)` は二重適用しない
- 先着順: `PICK_SUBMIT` の採用順はDO受信順（DOがaccepted_at付与）
- 代理SKIP: `now - round_started_at >= 240s` かつ target未確定のみ許可
- START_MATCH: `players >= 2` かつ `room_state=READY_CHECK` のみ
- RESULT_SUBMIT: `observed_key == expected_key` かつ `round_index == current_round_index` のみ採用（accept_window=0）
- RESULT到達後: 提出系はすべて拒否（勝敗改変防止）
