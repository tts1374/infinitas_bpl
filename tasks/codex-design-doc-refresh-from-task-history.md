# codex-design-doc-refresh-from-task-history

## Purpose
- `tasks/*.md` の履歴を Last commit date の旧->新順で確認し、実装済み内容に合わせて `docs/design/01_fsm.md` から `08_repo_structure.md` の規範仕様を最新化する。
- 必要に応じて `09_implementation_plan.md` を old 領域へ移し、`09+` の新規資料を追加して設計資料の整合性を維持する。

## Non-goals
- 実装コード（client/worker/shared）の挙動変更。
- 設計書更新と無関係な文面整形やリファクタリング。

## Changes
- `tasks` 配下 md の Last commit date を取得し、旧->新順で読み込む。
- タスク内容から仕様確定済み事項のみ抽出し、`docs/design/01-08` に反映する。
- 必要なら `docs/design/09_implementation_plan.md` を old 領域へ移し、新しい `09+` ドキュメントを作成する。

## Impact
- Users: 直接影響なし（ドキュメントのみ）。
- Data: 影響なし。
- Compatibility: 実装仕様の記録精度が向上し、将来の仕様解釈差異を低減。
- Cloudflare: 直接変更なし（文書化のみ）。

## Target Files / Layers
- Files:
  - `tasks/*.md`
  - `docs/design/01_fsm.md`
  - `docs/design/02_ws_protocol.md`
  - `docs/design/03_data_model.md`
  - `docs/design/04_tech_stack.md`
  - `docs/design/05_screen_list.md`
  - `docs/design/06_source_io_spec.md`
  - `docs/design/07_constants.md`
  - `docs/design/08_repo_structure.md`
  - `docs/design/09_implementation_plan.md`（必要時）
  - `docs/design/old/*`（必要時）
  - `docs/design/09+`（必要時）
- Layers: docs

## Test Focus
- 差分検証（対象ファイル以外の変更なし、無関係整形なし）。
- UTF-8 no BOM / LF の維持確認。
- 内容検証（タスク時系列と設計書反映が矛盾しないこと）。

## Rollback Plan
- 変更をコミット単位で revert し、設計書を更新前状態へ戻す。
- 追加した `09+` 文書や old 移設は同一コミットで巻き戻す。

## Commit Split Plan
1. tasks 履歴の時系列抽出と反映方針の整理（ドキュメント作業前提）
2. `docs/design/01-08` の更新
3. `09` 系の移設/新設（必要時）
4. 最終検証（差分・整合性・エンコーディング）

## Checklist
- [ ] Design doc alignment confirmed (if required)
- [ ] Impact scope identified
- [ ] Implementation completed
- [ ] Tests completed
- [ ] Regression checks completed
- [ ] Documentation updates completed (if required)
