# データモデル設計（Ph1 / Cloudflare Workers + Durable Objects）

## 0. 目的
- 勝敗判定に必要な最小データを一貫して保持する
- 誤採用防止（expected一致、accept_window=0）
- ローカル保存で部分結果を復元できる（ホスト落ちでも表示）
- 公開ロビー一覧の正本は `LobbyDirectoryDO` の `rooms` ストレージに保持する

## 1. 永続層の方針（Ph1）
- DO本体の状態: DO Storage に永続保存し、alarm / reconnect / hibernation 復帰後も復元可能にする
- 公開ロビー一覧: LobbyDirectoryDO storage
- ローカル復元: クライアントが `RoomStateSnapshot` をラウンド確定ごとにローカル保存（JSON）

## 2. エンティティ（DO内）

### 2.1 Room（DO状態）
- `room_id: string`（UUID）
- `join_code: string|null`
- `visibility: PUBLIC|PRIVATE`
- `settings: RoomSettings`
- `host_player_id: string`
- `room_state: RoomState`
- `created_at: datetime`
- `ready_check_deadline: datetime|null`（LOBBY ready 管理用。ルーム作成時と `RESULT -> LOBBY` 復帰時に張り直す）
- `picking_deadline: datetime|null`
- `match_deadline: datetime|null`（`START_MATCH` 成功時、すなわち `PICKING` 開始時点で初めて確定）
- `result_deadline: datetime|null`（Ph1未使用。現行フローでは通常 `null` 固定の予約欄）
- `closed_at: datetime|null`
- `close_reason: ALL_ROUNDS_COMPLETED|MATCH_TTL_EXPIRED|READY_CHECK_TTL_EXPIRED|HOST_DISCONNECTED|HOST_ABORTED|PICKING_ABORTED|FORCE_CLOSED|null`
- `result_ready_payload: object|null`（`RESULT` 中は保持し、`RESULT -> LOBBY` 復帰時にクリア。`summary.is_rated / rated_block_reason / rating_*` を含む）
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

備考:
- `source_meta` はラウンド中の状態同期と `RESULT_READY` 集計へ引き継いでよい
- 少なくとも `score` / `misscount` / `title` / `title_search_key` / `source` / `timestamp` を保持できる形にする

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

## 3. LobbyDirectoryDO（公開ロビー正本）

### 3.1 Storage Schema
- key: `rooms`
- value: `Record<string, LobbyRoomSummary>`

```ts
type LobbyRoomSummary = {
  roomId: string;
  roomName: string;
  ownerUserId: string;
  ownerDisplayName: string;
  isPublic: boolean;
  currentPlayers: number;
  maxPlayers: 2 | 3 | 4;
  isFull: boolean;
  status: "LOBBY" | "PICKING" | "PLAYING" | "RESULT";
  ttlStartedAt: number;
  createdAt: number;
  updatedAt: number;
};
```

### 3.2 更新タイミング
- ルーム作成: `status=LOBBY`, `ttlStartedAt=now` で upsert
- `START_MATCH` 成功（`PICKING` 開始）: `ttlStartedAt=now` に更新して upsert
- `PLAYING` / `RESULT`: status のみ更新（`ttlStartedAt` は維持）
- `RESULT -> LOBBY`: `ttlStartedAt=now` に更新して upsert
- `CLOSED` / 解散: remove

### 3.3 TTL / 一覧導出
- `ttlStartedAt` は TTL 判定の唯一の起点時刻とする（`updatedAt` はTTL判定に使わない）
- 期限判定:
  - `status = LOBBY`: `now - ttlStartedAt > ready_check_ttl`
  - `status in [PICKING, PLAYING, RESULT]`: `now - ttlStartedAt > match_ttl`
- `GET /api/lobby` は返却前に期限切れを清掃し、以下のみ返す
  - `isPublic = true`
  - `isFull = false`
  - `status = LOBBY`
  - TTL 未超過

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

## 6. タイトル同定（Ph1 v1）

### 6.1 inf-notebook
- `records/summary.json.musicname`（DB由来）を同定入力に使う
- `music_title_alias` の exact 一致のみで解決する
  - `alias_scope = 'inf' AND alias = ?`
- `alias_norm` / case-fold / fuzzy は使わない

### 6.2 inf_daken_counter
従来どおり `normalize_title_input(raw_title)` を同定処理側で実施する。

最低限:
- Unicode NFKC
- trim
- 連続空白1つ化
- `\s+\(` -> `(`（括弧直前空白除去）
- 英字小文字化
- 記号の標準化（最小）

解決失敗:
- UnmatchedTitleLogへ記録
- Ph1は「未同定＝SKIP/TIMEOUTで割り切り」（手動再割当UIは入れない）

## 7. 監視ソース別の抽出仕様（Ph1）

### 7.1 リザルト手帳
入力:
- `records/summary.json`
- `export/recent.json.list[]`（補完専用）
使用:
- summary:
  - `musicname`
  - `playtype`
  - `difficulty`
  - `latest.timestamp`
- recent:
  - SCORE: `score`（EX SCORE絶対値）
  - MISSCOUNT: `misscount`
同定:
- summary の `musicname` を alias exact 解決
- chart は `textage_id + playtype + difficulty` で特定
新規イベント判定:
- summary の `latest` 差分のみ抽出
- recent は `timestamp -> record[]` の multimap で突合

補助:
- `recent.music` / `recent.difficulty` は warning 用（採否条件には使わない）

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

### 8.1 ルーム結果アーカイブ
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

### 8.2 統計アーカイブ
- 保存主体: client ローカル永続層
- 目的:
  - レート再計算
  - 曲別勝率ランキング
  - 直近勝敗履歴
  - 安定度集計
- 保存対象:
  - `matches`
    - `match_id`
    - `started_at`
    - `ended_at`
    - `battle_type: ARENA|BPL|PRIVATE`
    - `play_mode: SP|DP`
    - `opponent_count`
    - `opponent_id / opponent_name`
    - `match_result: WIN|LOSE|DRAW`
    - `match_point_total`
    - `is_rated`
    - `rating_before`
    - `rating_after`
    - `rating_delta`
    - `is_complete`
    - `invalid_reason`
  - `match_games`
    - `match_game_id`
    - `match_id`
    - `played_at`
    - `game_index`
    - `chart_id`
    - `battle_type: ARENA|BPL|PRIVATE`
    - `play_mode: SP|DP`
    - `game_result: WIN|LOSE|DRAW`
    - `round_point`
    - `my_ex_score`
    - `opponent_ex_score`
    - `my_bp`
    - `opponent_bp`
    - `result_confirmed_at`
  - `play_results`
    - `play_result_id`
    - `played_at`
    - `battle_type: ARENA|BPL|PRIVATE`
    - `play_mode: SP|DP`
    - `chart_id`
    - `my_ex_score`
    - `my_bp`
  - `personal_bests`
    - `chart_id`
    - `play_mode`
    - `best_ex_score`
    - `best_bp`
    - `best_played_at`
    - `source_play_result_id`
- 集計ルール:
  - レート系列は `ARENA_SP` / `ARENA_DP` / `BPL_SP` / `BPL_DP` を分離する
  - レート更新は `matches` を基準にマッチ単位で行う
  - ARENA は `match_games` を集約して最終順位を決め、pairwise 擬似対戦で `matches.rating_delta` を算出する
  - `RESULT_READY.summary.is_rated` をレート適用可否の権威情報とする
  - `PRIVATE`、`SKIPPED`、`TIMEOUT`、`FORCE_ADVANCE`、未提出、不一致、途中終了、最終結果衝突を含むマッチはレート対象外
  - unrated でも `matches / match_games / play_results` は保存し、`matches.invalid_reason` に block 理由を保持する
  - 曲別勝率ランキングは `match_games` を基準に集計する
  - 曲識別は表示名ではなく `chart_id` を正とする
