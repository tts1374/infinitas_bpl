# QUALITY.md

## 0. 完了の定義
タスクは「動作の証明」ができるまで完了と見なさない。
ビルド成功・テスト成功・差分妥当性確認を必須とする。

適用原則:
- すべての変更で「1. 技術的検証」「2. 差分検証」は必須。
- 「3. FSM/Protocol検証」「4. 監視ソース検証」「5. E2E」は、当該領域に変更がある場合のみ必須。
- 局所修正では、変更箇所に対して十分な最小検証を行う。

---

## 1. 技術的検証
- ビルド成功（型エラーなし）
- Lintエラーなし
- テスト成功
- 不要な依存追加なし

### Cloudflare（worker）
- `wrangler` build が成功する
- DOが起動し、WS接続が成立する

### Client（tauri）
- UIビルド成功
- Rust側 watcher/parser がコンパイルできる

---

## 2. 差分検証
- 変更対象以外に diff が存在しない
- 無関係な整形変更なし
- 生成物更新は意図的である
- UTF-8 (no BOM) / LF 逸脱がない

---

## 3. FSM/Protocol検証（該当変更時のみ必須）
変更がある場合は必ず確認する:
- RoomState 遷移（LOBBY内ready管理 -> PICKING -> PLAYING -> RESULT -> CLOSED）
- タイマー（ready_check 20min / picking 120s / round_soft_ttl 5min / match_ttl 30min）動作
- expected_key enforcement（accept_window=0）
- idempotency（client_msg_id）重複排除
- host権限（START_MATCH / RETURN_TO_LOBBY / FORCE_ADVANCE）
- LobbyDirectory 一覧（公開・非満員・LOBBY・TTL 未超過）

---

## 4. 監視ソース検証（該当変更時のみ必須）
- inf-notebook: export/recent.json から SCORE/MISSCOUNT 抽出できる
- inf_daken_counter: today_update.xml から SCORE/MISSCOUNT 抽出できる
- observed_key == expected_key のみ採用される
- 監視異常時に SOURCE_UNAVAILABLE を出し、TECHスキップ誘導できる

---

## 5. E2E（該当変更時のみ必須）
- 2人で ARENA: create -> ready -> pick -> play(1ラウンド以上) -> result
- 2人で BPL(BO3): 同様
- 重複ピックの差し替え
- TIMEOUT（soft ttl）と FORCE_ADVANCE
- `SKIP_HOST_ASSIGN` が v1 では拒否され、強制確定は `FORCE_ADVANCE` で扱われる
- DO state loss -> ROOM_STATE_LOST -> room close

---

## 6. リリース前確認（Ph1）
- バージョン整合性
- CHANGELOG（ある場合）
- `LobbyDirectoryDO` の一覧フィルタ / TTL 運用確認
