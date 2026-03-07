# データモデル設計（Ph1 / Cloudflare Workers + Durable Objects）

## 0. 目的
- 勝敗判定に必要な最小データを一貫して保持する
- 誤採用防止（expected一致、accept_window=0）
- ローカル保存で部分結果を復元できる（ホスト落ちでも表示）
- 公開ロビー一覧はKVに「軽量メタ」だけを保存し、DO本体の状態とは分離する

## 1. 永続層の方針（Ph1）
- DO本体の状態: DO Storage に永続保存し、alarm / reconnect / hibernation 復帰後も復元可能にする
- 公開ロビー一覧: Cloudflare KV
- ローカル復元: クライアントが `RoomStateSnapshot` をラウンド確定ごとにローカル保存（JSON）

## 2. エンティティ（DO内）

### 2.1 Room（DO状態）
- `room_id: string`（UUID）
- `join_code: string|null`
- `visibility: PUBLIC|UNLISTED|PRIVATE`
- `settings: RoomSettings`
- `host_player_id: string`
- `room_state: RoomState`
- `created_at: datetime`
- `ready_check_deadline: datetime|null`
- `picking_deadline: datetime|null`
- `match_deadline: datetime|null`（`START_MATCH` 成功時、すなわち `PICKING` 開始時点で初めて確定）
- `result_deadline: datetime|null`（互換用。通常フローでは `null`）
- `closed_at: datetime|null`
- `close_reason: ALL_ROUNDS_COMPLETED|MATCH_TTL_EXPIRED|READY_CHECK_TTL_EXPIRED|HOST_DISCONNECTED|HOST_ABORTED|PICKING_ABORTED|FORCE_CLOSED|null`
- `result_ready_payload: object|null`
- `event_seq: int`

### 2.2 RoomSettings（Ph1）
- `mode: ARENA|BPL`
- `win_metric: SCORE|MISSCOUNT`
- `play_style: SP|DP`
- `level_filter: ANY|LV8_10|LV10|LV11|LV12`
- `room_comment: string`
- `max_players: 2|3|4`

### 2.3 Player
- `player_id: string`
- `display_name: string`
- `source: inf_daken_counter|inf-notebook`（端末設定）
- `connected: bool`
- `ready: bool`
- `joined_at: datetime`
- `left_at: datetime|null`
- `rejoin_until: datetime|null`（退出後の再入室クールダウン終端）
- `role: HOST|GUEST`（ホスト判定補助）

### 2.4 Pick（指名）
- `player_id: string`
- `pick_chart_key: string`
- `accepted_at: datetime`（DO受信時刻）

### 2.5 FrozenRound（凍結ラウンド）
- `round_index: int`
- `expected_key: ExpectedKey`
- `display: { title: string, level: int|null }`
- `started_at: datetime|null`（PLAYINGで開始時に埋める）
- `started_at: datetime|null`（`ROUND_BEGIN` 時点。演出開始時刻）
- `soft_ttl_seconds: int = 300`

### 2.6 Submission（ラウンド確定結果）
- `submission_id: string`（UUID。冪等用）
- `room_id: string`
- `round_index: int`
- `player_id: string`
- `status: PLAYED|SKIPPED|TIMEOUT`
- `reason: UNOWNED|TECH|OTHER|UNMAPPED_TIMEOUT|null`
- `metric: SCORE|MISSCOUNT`
- `metric_value: int`
  - SCORE: 0以上（SKIP/TIMEOUTは0）
  - MISSCOUNT: 0以上（SKIP/TIMEOUTは9999）
- `observed_key: ExpectedKey|null`（PLAYED時のみ）
- `submitted_at: datetime`
- `submitted_by: SELF|HOST|SYSTEM`
- `source_meta: object|null`（監視ソース由来の補助情報）

### 2.7 UnmatchedTitleLog（未同定ログ）
- `raw_title: string`
- `normalized_title_search_key: string`
- `play_style: SP|DP`
- `difficulty: string`
- `count: int`
- `last_seen_at: datetime`

### 2.8 IdempotencyLog（冪等管理）
- `player_id: string`
- `client_msg_id: string`
- `first_seen_at: datetime`
- `type: string`
- `hash: string|null`（payload fingerprint。任意）

### 2.9 RequestIdLog（操作冪等管理）
- `player_id: string`
- `type: string`
- `request_id: string`
- `first_applied_at: datetime`

## 3. KV（公開ロビー軽量メタ）

### 3.1 KV Key/Value
- Key: `room:{room_id}`
- Value（例）:
```json
{
  "room_id": "uuid",
  "visibility": "PUBLIC|UNLISTED",
  "has_join_code": true,
  "mode": "ARENA|BPL",
  "win_metric": "SCORE|MISSCOUNT",
  "play_style": "SP|DP",
  "level_filter": "ANY|LV8_10|LV10|LV11|LV12",
  "room_comment": "string",
  "max_players": 4,
  "created_at": "ISO8601",
  "expires_at": "ISO8601"
}
```

### 3.2 KV更新タイミング
- ルーム作成: put（expires_at = created_at + ready_check_ttl + match_ttl）
- ルームCLOSED: delete
- 任意（Ph1では不要）: 人数・状態を反映したいなら別Keyで集約する（DOに負荷が寄るので後回し）

## 4. キー設計

### 4.1 ExpectedKey（採用判定キー）
- `play_style: SP|DP`
- `difficulty: NORMAL|HYPER|ANOTHER|LEGGENDARIA|...`
- `title_search_key: string`（入力側 normalize_title_input() の結果）

### 4.2 提出受理条件（Ph1）
- `accept_window_rounds = 0`
- `round_index == current_round_index` のみ採用
- `observed_key == expected_key` のみ `PLAYED` として採用
- 1プレイヤー1ラウンドは初回のみ採用（以後は拒否/ログのみ）

## 5. 勝敗判定

### 5.1 metricの比較方向
- `SCORE`: 大きい方が勝ち
- `MISSCOUNT`: 小さい方が勝ち

### 5.2 SKIP/TIMEOUT値
- SCORE: 0
- MISSCOUNT: 9999

### 5.3 ARENA配点（方針A）
- rank1: 2
- rank2: 1
- rank3+: 0
- 同点同順位、順位飛ばしあり

### 5.4 BPL（BO3）
- 3ラウンド固定
- 各ラウンド勝者が1勝
- 先に2勝で勝利
- 同点は勝ち数加算なし
- 終了時に同勝ち数なら総合引き分け

## 6. タイトル同定（入力側正規化）

### 6.1 normalize_title_input(raw_title)（同定処理側）
最低限:
- Unicode NFKC
- trim
- 連続空白1つ化
- `\s+\(` -> `(`（括弧直前空白除去）
- 英字小文字化
- 記号の標準化（最小）

生成物:
- `title_search_key_in`

### 6.2 マスタ参照（iidx_all_songs_master）
- `music_title_alias` -> `music.title_search_key` の順で解決
- 解決失敗:
  - UnmatchedTitleLogへ記録
  - Ph1は「未同定＝SKIP/TIMEOUTで割り切り」（手動再割当UIは入れない）

## 7. 監視ソース別の抽出仕様（Ph1）

### 7.1 リザルト手帳
入力:
- `export/recent.json.list[]`
使用:
- SCORE: `score`（EX SCORE絶対値）
- MISSCOUNT: `misscount`
同定:
- `difficulty` + `music`（title）
新規イベント判定:
- `timestamp` を last_seen として保持（内容差分追跡）

補助（任意）:
- `records/recent.json` は補助ログ。矛盾時は採用しない（誤採用防止）

### 7.2 打鍵カウンタ
入力:
- `today_update.xml`
使用:
- SCORE: `score_cur`
- MISSCOUNT: `bp`
同定:
- `difficulty`（DPH等）を `play_style + difficulty` に変換し統一
- `title` を normalize

新規イベント判定:
- fingerprint = `(title_key, chart_difficulty, score_cur, bp)` を last_seen として保持

## 8. ローカル保存（クライアント）
- 保存単位: ラウンド確定ごと
- 保存内容: `RoomStateSnapshot`（WS仕様と同一）
- 目的: ホスト落ち/切断時でも部分結果表示が可能

保存フォーマット例:
```json
{
  "version": "ph1",
  "saved_at": "ISO8601",
  "room_state_snapshot": { "...": "..." }
}
```
