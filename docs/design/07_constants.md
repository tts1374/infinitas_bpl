# 定数一覧（Ph1）

## 0. 目的
Ph1で固定するタイマー値、制約値、表示/運用上の定数を整理する。  
実装時はこの定数一覧を単一の共有定義として扱う。

---

## 1. ルーム/進行定数

## 1.1 READY_CHECK
- `READY_CHECK_TTL_MINUTES = 20`
  - READY_CHECK開始から20分で解散
- `START_MIN_PLAYERS = 2`
  - `players < 2` の間はホストSTART不可

## 1.2 ラウンド進行
- `ROUND_SOFT_TTL_SECONDS = 300`
  - START音声時点から5分で未確定者をTIMEOUT確定
- `HOST_SKIP_UNLOCK_SECONDS = 240`
  - ラウンド開始後4分経過でホスト代理SKIP可
- `ROUND_STAGE_COUNTDOWN_AT_SECONDS = 40`
  - ROUND_BEGINから40秒後に `10..1`
- `ROUND_START_CALL_AT_SECONDS = 50`
  - ROUND_BEGINから50秒後に `3,2,1,START`

## 1.3 マッチ全体
- `MATCH_TTL_MINUTES = 30`
  - マッチ全体の寿命
  - TTL到達時は未確定をTIMEOUTとしてRESULTへ遷移
- `RESULT_TTL_MINUTES = 5`
  - RESULT表示維持時間
  - 超過でCLOSED

## 1.4 再入室
- `REJOIN_COOLDOWN_SECONDS = 10`
  - 同一ルームへ退出後すぐ再入室する場合のクールダウン

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
  - BO3固定

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
- `VISIBILITY_OPTIONS = ["PUBLIC", "UNLISTED", "PRIVATE"]`

## 6.2 KV一覧保持
- `ROOM_KV_EXPIRES_AT = CREATED_AT + 30 minutes`
  - 作成時点でexpires_at設定
- `ROOM_LIST_EXCLUDE_EXPIRED = true`
  - `expires_at <= now` は一覧から除外

---

## 7. エラーコード一覧（Ph1）

- `ROOM_FULL`
- `JOIN_CODE_INVALID`
- `NOT_HOST`
- `INVALID_STATE`
- `START_REQUIRES_MIN_PLAYERS`
- `RESULT_KEY_MISMATCH`
- `ROUND_ALREADY_CONFIRMED`
- `HOST_SKIP_LOCKED`
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

## 9. 音声通知定数

## 9.1 再生責務
- `VOICE_PLAYBACK_LOCAL_ONLY = true`

## 9.2 必須再生イベント
- `VOICE_STAGE_CALL = true`
- `VOICE_COUNTDOWN_10_TO_1 = true`
- `VOICE_START_CALL = true`

## 9.3 状態遷移時
- `VOICE_CLEAR_QUEUE_ON_STATE_CHANGE = true`
- `VOICE_STOP_CURRENT_ON_STATE_CHANGE = true`

---

## 10. 将来変更候補（Ph2以降）
以下はPh1では固定だが、将来拡張候補とする。

- `BPL_ROUNDS` を 5 に変更可能にする
- `ROOM_LIST_PAGE_SIZE` の調整
- `MATCH_TTL_MINUTES` の再検討
- `RESULT_TTL_MINUTES` の再検討
- `PING_INTERVAL_SECONDS` の最適化
- source監視の polling フォールバック
