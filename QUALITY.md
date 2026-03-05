# QUALITY.md

## 0. 完了の定義
タスクは「動作の証明」ができるまで完了と見なさない。
ビルド成功・テスト成功・差分妥当性確認を必須とする。

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

## 3. FSM/Protocol検証（重要）
変更がある場合は必ず確認する:
- RoomState 遷移（LOBBY->READY_CHECK->PICKING->PLAYING->RESULT->CLOSED）
- タイマー（20min/5min/30min/5min）動作
- expected_key enforcement（accept_window=0）
- idempotency（client_msg_id）重複排除
- host権限（START/force advance/host skip）
- KV listing（expires_at / limit=10 / cursor）

---

## 4. 監視ソース検証
- inf-notebook: export/recent.json から SCORE/MISSCOUNT 抽出できる
- inf_daken_counter: today_update.xml から SCORE/MISSCOUNT 抽出できる
- observed_key == expected_key のみ採用される
- 監視異常時に SOURCE_UNAVAILABLE を出し、TECHスキップ誘導できる

---

## 5. E2E（最低限）
- 2人で ARENA: create -> ready -> pick -> play(1ラウンド以上) -> result
- 2人で BPL(BO3): 同様
- 重複ピックの差し替え
- TIMEOUT（soft ttl）と FORCE_ADVANCE
- host代理SKIP（unlock後）
- DO state loss -> ROOM_STATE_LOST -> room close

---

## 6. リリース前確認（Ph1）
- バージョン整合性
- CHANGELOG（ある場合）
- ルーム一覧(KV)のexpires運用確認
