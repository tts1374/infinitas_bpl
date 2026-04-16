# QUALITY.md

## 0. 基本原則

完了条件は「動作を証明できること」。

常時必須:
1. 技術的検証
2. 差分検証

変更領域連動で追加必須:
- FSM/Protocol 検証
- 監視ソース検証
- E2E/シナリオ検証
- Agent/Governance 整合検証

---

## 1. 技術的検証 (常時必須)

- build/typecheck 成功
- lint 成功
- 関連 test 成功
- 不要な依存追加なし

Worker 変更時:
- `wrangler` build 成功
- DO/WS 系の基本起動性を確認

Client 変更時:
- client build/typecheck 成功
- 必要時に Rust 側 watcher/parser コンパイル性確認

---

## 2. 差分検証 (常時必須)

- 変更対象外 diff がない
- 無関係な整形変更なし
- 生成物更新は意図的
- UTF-8(no BOM) / LF を維持

---

## 3. リスク連動検証マトリクス

### 3.1 FSM / Protocol 変更時
必須確認:
- RoomState 遷移
- timer/deadline/TTL 振る舞い
- expected_key enforcement
- idempotency (`client_msg_id`)
- host 権限境界
- LobbyDirectory 公開条件

### 3.2 Lobby summary / freshness / cleanup 変更時
必須確認:
- stale cleanup が probe 後の newer summary を削除しない
- freshness token が同一 ms / 同一 tick 衝突で再利用されない
- `delete -> recreate` や reorder を含む経路で古い cleanup 条件が再一致しない
- 公開レスポンス schema が意図せず拡張されていない
- persisted helper state に bounded-growth または明示 reclaim 方針がある
- internal storage shape 変更時に restore compatibility がある

### 3.3 Source I/O 変更時
必須確認:
- `inf-notebook` 抽出
- `daken_counter_v3` 抽出
- `reflux` 抽出
- `inf_daken_counter` (legacy有効時) 抽出
- `observed_key == expected_key` 採用
- 異常時 `SOURCE_UNAVAILABLE` と TECHスキップ導線

### 3.4 E2E/シナリオ必須時
最低限:
- create -> ready -> pick -> play -> result
- duplicate pick 差し替え
- TIMEOUT と FORCE_ADVANCE
- `SKIP_HOST_ASSIGN` 拒否動作
- `ROOM_STATE_LOST` 経路

### 3.5 Agent/Governance 変更時
必須確認:
- `npm run check:agents` 成功
- `npm run check:design-contracts` 成功
- 廃止 agent 名の残存参照がない
- 状態語彙/severity 語彙の統一定義が維持される

### 3.6 Workflow Artifact / Closure Task 実行時
必須確認:
- Entry Protocol に `Stage / affected layers / contract-sensitive / execution profile / Plan Mode` がある
- 委譲した場合は `delegation execution record` が残っている
- 非委譲の場合は `No-delegate reason` が残っている
- Phase C 実行時は C Kickoff 出力が実装開始前にある
- review response 実行時は、対応 thread / validation / reply / resolve / 再レビュー依頼の処理状況が追跡できる
- Phase D で follow-up を作る場合は、次スレッドで再利用可能な `Issue-ready artifact` 粒度になっている
- Issue を閉じる場合は `docs/issue_close_evidence_template.md` に準拠している

---

## 4. Severity Convention (統一)

- `Blocker`: 完了不可。修正または明示再スコープまで停止
- `Must fix`: 現タスクで修正必須。延期時は明示的合意が必要
- `Should fix`: 重要改善。同タスク内または明示的後続化
- `Note`: 情報共有/軽微懸念。単独では完了阻害しない

---

## 5. Completion Evidence

完了宣言には次を含める:
- 実施検証一覧
- リスクに対応した証跡
- 未解決項目と扱い（修正/延期/エスカレーション）
- `COMPLETE/BLOCKED/ESCALATION` の明示

`Blocker` 未解決の完了宣言は禁止。
