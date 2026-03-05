# WORKFLOW.md

## 0. 基本原則
- 1PR1目的。
- 目的外変更は分離する。
- 3ステップ以上の作業は必ず計画を書く。
- 状態機械（Room FSM / WS protocol / timers / aggregation）を壊す変更は単独PRで扱う。

---

## 1. プランモード

以下の場合は必ず `tasks/<branch-or-pr-name>.md` に計画を書く（単一共有ファイルは使用しない）。

- 3ステップ以上の変更
- アーキテクチャ変更
- Durable Objects のFSM/タイマー/集計/権限制御変更
- WebSocket message schema 変更（type/payload）
- 監視ソースI/O仕様変更（inf_daken_counter / inf-notebook）
- ロビー一覧(KV)のスキーマ/取得/ページング変更
- 保存形式/互換性に影響する変更（settings/result snapshot）
- CI / デプロイ変更（Wrangler/Workers/DO/KV）
- 依存関係更新（lockfile含む）

### 記載形式（例）
- [ ] 設計確認（該当docs/designの確認）
- [ ] 影響範囲特定（client/worker/shared/KV）
- [ ] 実装
- [ ] テスト
- [ ] 回帰確認
- [ ] ドキュメント更新

---

## 2. コミット計画の宣言
実装前にコミット粒度を明示する。

例:
1. shared型/定数追加
2. DOロジック追加
3. client UI 追加
4. watcher 追加
5. テスト追加
6. ドキュメント更新

---

## 3. Commit Execution Rules
- 計画内の1項目 = 1論理コミット。
- 作業単位が完了したら即コミットする（逐次コミット）。
- `git status` は各コミット前にクリーンであること。
- 機械生成差分と手動修正を混在させない。
- 整形のみの変更は別PR。

---

## 4. PR本文テンプレート
PRには以下を含める:
- 目的
- 変更点
- 非変更点
- 影響範囲（ユーザー / データ / 互換性 / Cloudflare）
- テスト内容
- 回帰確認項目

---

## 5. 完了条件（ワークフロー観点）
- 計画通りの差分のみ存在する。
- 目的外変更がない。
- QUALITY基準を満たす。
- `git status` がクリーンである。
