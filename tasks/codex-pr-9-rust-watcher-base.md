# Plan: codex/pr-9-rust-watcher-base

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_arena_pr9`
- branch: `codex/pr-9-rust-watcher-base`
- base branch: `v1`
- BASE_SHA: `bb1b7ee2a427d9ff4a30730b6e06359d39205e1a`

## 目的
- `docs/design/09_implementation_plan.md` の PR-9（Rust watcher 基盤）を実装する。
- Tauri Rust 側で source ごとの file watcher 起動/停止、source path 設定、parser interface、Rust -> React の event bridge を成立させる。

## 非目的
- `inf-notebook` / `inf_daken_counter` の実データ parser 実装（PR-10/11）。
- Worker / DO / shared の契約変更。
- 音声通知、ローカル結果保存、RESULT_SUBMIT 自動送信。

## 変更点
- `apps/client/src-tauri` に watcher / parser / model / command モジュールを追加し、Tauri command で watcher start/stop/state 取得を提供する。
- `notify` ベースで source ごとの監視対象パスを解決し、ファイル変更時に React へイベントを emit する。
- React 側に Tauri bridge と `sourceStore` を追加し、watcher 状態と直近イベントを表示する。
- Settings 画面から watcher の再起動/停止と source path 適用ができるようにする。

## 影響範囲
- ユーザー:
  - 保存済み source 設定を元に watcher を起動できる。
  - 変更イベントや監視異常が Settings 画面で確認できる。
- データ:
  - ローカル設定値は既存 localStorage を継続利用し、watcher 状態はメモリ上でのみ保持する。
- 互換性:
  - Worker / shared の既存 schema は変更しない。
- Cloudflare:
  - 影響なし。

## 対象ファイル / 対象レイヤ
- `apps/client/src-tauri/src/**`
- `apps/client/src/services/**`
- `apps/client/src/stores/**`
- `apps/client/src/pages/SettingsPage.tsx`
- `apps/client/src/app/App.tsx`
- `apps/client/package.json`
- `apps/client/src-tauri/Cargo.toml`
- `apps/client/src-tauri/Cargo.lock`
- `package-lock.json`
- `tasks/codex-pr-9-rust-watcher-base.md`

## テスト観点
- `inf_daken_counter` と `inf-notebook` それぞれで required path を渡して watcher を起動できる。
- 監視対象ファイル変更時に Rust 側 event が React 側 store へ反映される。
- パス不備や read 失敗時に error event と detail が出る。
- `npm --workspace @infinitas/client run typecheck`
- `npm --workspace @infinitas/client run build`
- `npm run typecheck`
- `cargo check`

## ロールバック方針
- PR-9 差分を revert し、PR-8 の client UI のみの状態へ戻す。

## Commit Plan（コミット分割計画）
1. PR-9 plan 追加（本ファイル）。
2. `apps/client/src-tauri` に watcher / parser / command 基盤と依存追加を実装。
3. React 側の Tauri bridge / `sourceStore` / Settings UI を実装。
4. build/typecheck/cargo check を通し、最終調整を行う。

## 検証結果
- [x] `npm install`
- [x] `npm --workspace @infinitas/client run typecheck`
- [x] `npm --workspace @infinitas/client run build`
- [x] `npm run typecheck`
- [x] `cargo check`
