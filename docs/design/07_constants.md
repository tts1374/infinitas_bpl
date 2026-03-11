# 定数一覧（Ph1）

## 0. 目的
Ph1で固定するタイマー値、制約値、表示/運用上の定数を整理する。  
実装時はこの定数一覧を単一の共有定義として扱う。

---

## 1. ルーム/進行定数

## 1.1 LOBBY / READY
- `READY_CHECK_TTL_MINUTES = 20`
  - LOBBY開始または `RESULT -> LOBBY` 復帰から20分で解散
- `START_MIN_PLAYERS = 2`
  - `players < 2` の間はホストSTART不可
- `PICKING_TTL_SECONDS = 120`
  - PICKING開始から120秒で未pickをランダム補完

## 1.2 ラウンド進行
- `ROUND_SOFT_TTL_SECONDS = 300`
  - START音声時点から5分で未確定者をTIMEOUT確定
- `HOST_SKIP_UNLOCK_SECONDS = 240`
  - 現行v1では代理SKIP無効のため、将来拡張用の予約値
- `ROUND_MUSIC_SELECT_SECONDS = 60`
  - ROUND_BEGINから60秒間は `MUSIC SELECT`
- `ROUND_STAGE_COUNTDOWN_AT_SECONDS = 50`
  - ROUND_BEGINから50秒後に残り10秒カウント開始（`count_beep`）
- `ROUND_START_CALL_AT_SECONDS = 72`
  - ROUND_BEGINから72秒後に残り3秒カウント開始（`count_beep`）
- `ROUND_PLAY_BEGIN_AT_SECONDS = 75`
  - ROUND_BEGINから75秒後に実プレイ開始（`count_go`）

## 1.3 マッチ全体
- `MATCH_TTL_MINUTES = 30`
  - マッチ全体の寿命
  - TTL到達時は未確定をTIMEOUTとして結果を確定し、必要なら `RESULT` または `CLOSED` へ遷移

## 1.4 再入室
- `REJOIN_COOLDOWN_SECONDS = 10`
  - 同一ルームへ退出後すぐ再入室する場合のクールダウン
  - ホストが非明示切断した場合の再接続猶予

---

## 2. WebSocket / 通信定数

## 2.1 疎通確認
- `PING_INTERVAL_SECONDS = 15`
  - クライアントからPING送信
- `PING_TIMEOUT_MISSES = 2`
  - 2回無応答で切断扱い

## 2.2 一覧API
- `ROOM_LIST_PAGE_SIZE = 10`
  - ロビー一覧1ページの件数

---

## 3. ルーム設定関連定数

## 3.1 join_code
- `JOIN_CODE_LENGTH = 8`
- `JOIN_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"`
  - `I`, `O`, `0`, `1` を除外
- `JOIN_CODE_CASE = UPPERCASE`
  - 比較時は大文字化して扱う

## 3.2 room_comment
- `ROOM_COMMENT_MAX_LENGTH = 80`
- `ROOM_COMMENT_ALLOW_EMPTY = true`
- `ROOM_COMMENT_ALLOW_NEWLINE = false`

## 3.3 プレイヤー数
- `MAX_PLAYERS_OPTIONS = [2, 3, 4]`

---

## 4. 勝敗/集計定数

## 4.1 metric
- `WIN_METRIC_OPTIONS = ["SCORE", "MISSCOUNT"]`

## 4.2 SCOREモード
- `SCORE_SKIP_VALUE = 0`
- `SCORE_TIMEOUT_VALUE = 0`

## 4.3 MISSCOUNTモード
- `MISSCOUNT_SKIP_VALUE = 9999`
- `MISSCOUNT_TIMEOUT_VALUE = 9999`

## 4.4 ARENA配点
- `ARENA_POINT_RANK_1 = 2`
- `ARENA_POINT_RANK_2 = 1`
- `ARENA_POINT_RANK_3 = 0`
- `ARENA_POINT_RANK_4 = 0`

## 4.5 BPL
- `BPL_ROUNDS = 3`
  - 3 STAGE固定

---

## 5. ソース監視定数

## 5.1 source options
- `SOURCE_OPTIONS = ["inf_daken_counter", "inf-notebook"]`

## 5.2 source制約
- `SOURCE_FIXED_PER_DEVICE = true`
- `SOURCE_CHANGE_ALLOWED_IN_ROOM = false`

## 5.3 監視異常
- `SOURCE_ERROR_CODE = "SOURCE_UNAVAILABLE"`
- 監視異常時は TECH スキップ誘導

---

## 6. ロビー/KV関連定数

## 6.1 visibility
- `VISIBILITY_OPTIONS = ["PUBLIC", "PRIVATE"]`

## 6.2 KV一覧保持
- `ROOM_KV_EXPIRES_AT = CREATED_AT + 30 minutes`
  - 作成時点でexpires_at設定
- `ROOM_LIST_EXCLUDE_EXPIRED = true`
  - `expires_at <= now` は一覧から除外
- `PUBLIC_LOBBY_CANDIDATE_FIELD = "public_lobby_candidate"`
  - `visibility = PUBLIC` かつ `room_state = LOBBY` の候補フラグ

---

## 7. エラーコード一覧（Ph1）

- `ROOM_FULL`
- `JOIN_CODE_INVALID`
- `NOT_HOST`
- `INVALID_STATE`
- `START_REQUIRES_MIN_PLAYERS`
- `RESULT_KEY_MISMATCH`
- `ROUND_ALREADY_CONFIRMED`
- `HOST_SKIP_LOCKED`（互換性維持のため定義のみ残置）
- `ROOM_STATE_LOST`
- `SOURCE_UNAVAILABLE`

---

## 8. ローカル設定定数

## 8.1 player
- `PLAYER_ID_GENERATION = UUID`
- `DISPLAY_NAME_PERSIST = true`
- `DISPLAY_NAME_DUPLICATE_ALLOWED = true`

## 8.2 ローカル保存
- `RESULT_SAVE_FORMAT = JSON`
- `SAVE_PER_ROUND = true`

---

## 9. 音通知定数

## 9.1 再生責務
- `SOUND_PLAYBACK_LOCAL_ONLY = true`

## 9.2 必須SE
- `round_intro`
- `count_beep`
- `match_found`
- `phase_locked`
- `count_go`
- `cancel`
- `error`

## 9.3 間隔制御
- `MATCH_FOUND_MIN_INTERVAL_MS = 400`

## 9.4 状態遷移時
- `SOUND_CLEAR_QUEUE_ON_STATE_CHANGE = true`
- `SOUND_STOP_CURRENT_ON_STATE_CHANGE = true`

---

## 10. 将来変更候補（Ph2以降）
以下はPh1では固定だが、将来拡張候補とする。

- `BPL_ROUNDS` を 5 に変更可能にする
- `ROOM_LIST_PAGE_SIZE` の調整
- `MATCH_TTL_MINUTES` の再検討
- `RESULT_TTL_MINUTES` の再検討
- `PING_INTERVAL_SECONDS` の最適化
- source監視の polling フォールバック
