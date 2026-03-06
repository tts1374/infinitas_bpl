# Plan: codex/pr-10-inf-notebook

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_pr10`
- branch: `codex/pr-10-inf-notebook`
- base branch: `v1`
- BASE_SHA: `ccc00cba0d902967ce6b31f57aaedd66d83f6f6d`

## 目的
- `docs/design/09_implementation_plan.md` の PR-10（`inf-notebook` 対応）を実装する。
- `inf-notebook` の `export/recent.json` から自動提出できる状態を作る。

## 非目的
- `inf_daken_counter` 対応（PR-11）。
- Worker / DO / shared の契約変更。
- watcher 基盤自体の全面再設計。

## 変更点
- Rust 側に `inf-notebook` の `export/recent.json` parser を追加する。
- last_seen timestamp と observed_key 生成を実装し、SCORE / MISSCOUNT を抽出する。
- React 側で watcher event を解釈し、`RESULT_SUBMIT` 自動送信と `SOURCE_UNAVAILABLE` 反映を追加する。

## 影響範囲
- ユーザー:
  - `inf-notebook` 利用時にプレー結果の自動提出が行われる。
  - parse 失敗時は `SOURCE_UNAVAILABLE` として扱われる。
- データ:
  - watcher の直近観測情報をメモリ上で扱う。既存保存形式は変更しない。
- 互換性:
  - 既存 WS schema と room snapshot schema は維持する。
- Cloudflare:
  - 影響なし。

## 対象ファイル / 対象レイヤ
- `apps/client/src-tauri/src/**`
- `apps/client/src/services/**`
- `apps/client/src/stores/**`
- `apps/client/src/pages/**`（必要最小限）
- `tasks/codex-pr-10-inf-notebook.md`

## テスト観点
- `export/recent.json` を正しく parse して SCORE / MISSCOUNT / observed_key を得られる。
- 同一 timestamp の再通知が重複送信されない。
- expected 不一致時は client 側で送信されない。
- parse 失敗時に `SOURCE_UNAVAILABLE` が state に反映される。
- `npm --workspace @infinitas/client run typecheck`
- `npm --workspace @infinitas/client run build`
- `npm run typecheck`
- `cargo test -p infinitas-client-tauri notebook`
- `cargo check`

## ロールバック方針
- PR-10 差分を revert し、PR-9 の watcher 基盤だけの状態へ戻す。

## Commit Plan（コミット分割計画）
1. PR-10 plan 追加（本ファイル）。
2. Rust 側に `inf-notebook` parser / テスト / watcher event 拡張を実装。
3. React 側に自動提出と `SOURCE_UNAVAILABLE` 反映を実装。
4. build/typecheck/test/cargo check を通し、最終調整する。

## 検証結果
- [x] `npm --workspace @infinitas/client run typecheck`
- [x] `npm --workspace @infinitas/client run build`
- [x] `npm run typecheck`
- [ ] `cargo test -p infinitas-client-tauri notebook` (`x86_64-w64-mingw32-clang` link 時に exported symbols 上限へ到達)
- [x] `cargo check`
- [x] `cargo check --tests`
