# Plan: v1-inf-notebook-summary-watcher

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_arena`
- branch: `v1`
- base branch: `v1`
- BASE_SHA: `025ad49208df2652d6441aad0b21e8640d59c8d5`

## 目的
- `inf-notebook` 監視ロジックを `records/summary.json` 起点へ切り替える。
- `export/recent.json` は timestamp 参照で `score` / `misscount` 補完専用にする。
- 差分抽出・状態管理・再試行を実装し、誤判定を避ける。

## 非目的
- `inf_daken_counter` 側の仕様変更。
- OCR 精度改善、fuzzy / alias_norm 検索。
- Worker / DO / shared のWS契約変更。

## 変更点
- `records/summary.json` を監視対象として debounce + 再読込処理を実装。
- 前回スナップショットとの差分（`latest` 変化のみ）抽出を実装。
- `export/recent.json` を timestamp multimap で参照し、0/1/2+件を分岐処理。
- recent 0件時の短時間リトライを実装。
- alias 解決（exact）/ chart 特定 / 状態分類（`resolved_full` など）を parser 内で明示管理。
- source directory validation と設定文言を `records/summary.json` 前提へ更新。
- 設計ドキュメントの該当節を先行更新。

## 影響範囲
- ユーザー:
  - `inf-notebook` 自動提出の安定性が向上し、OCR由来不一致での不採用を減らす。
- データ:
  - watcher の入力解釈のみ変更。保存フォーマットは変更しない。
- 互換性:
  - WS message schema は維持。
- Cloudflare:
  - 影響なし。

## 対象ファイル / 対象レイヤ
- `docs/design/06_source_io_spec.md`（必要最小限で `03_data_model.md` も）
- `apps/client/src-tauri/src/parsers/notebook.rs`
- `apps/client/src-tauri/src/watchers/mod.rs`
- `apps/client/src-tauri/src/commands/source_directory_validation.rs`
- `apps/client/src/stores/settings-store.ts`
- `apps/client/src/stores/source-store.ts`
- `apps/client/src/pages/SettingsPage.tsx`
- `tasks/v1-inf-notebook-summary-watcher.md`

## テスト観点
- `summary.json` の `latest` 変化譜面のみ抽出される。
- `recent` timestamp multimap が重複 timestamp を保持できる。
- 0件 / 1件 / 2件以上 分岐が正しく動く。
- recent 0件時に短時間リトライし、最終的に `resolved_partial` へ遷移できる。
- alias exact 0件で `unresolved_alias` 扱いになる。
- `recent.music` / `recent.difficulty` 不一致は warning のみで不採用条件にならない。
- `cargo test -p infinitas-client-tauri notebook`
- `npm --workspace @infinitas/client run typecheck`

## ロールバック方針
- 本タスク差分を revert して、`export/recent.json` 起点の既存監視へ戻す。

## Commit Plan（コミット分割計画）
1. Plan 追加（本ファイル）。
2. 設計ドキュメント更新。
3. Rust parser / watcher / validation の実装と単体テスト。
4. client 設定文言・パス整合の最小更新と検証。
