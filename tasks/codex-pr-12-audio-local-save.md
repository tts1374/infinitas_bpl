# Plan: codex/pr-12-audio-local-save

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_pr12`
- branch: `codex/pr-12-audio-local-save`
- base branch: `v1`
- BASE_SHA: `93d12dbd0c77ef2e05854e81a0aef2cd490d13af`

## 目的
- `docs/design/09_implementation_plan.md` の PR-12（音声通知 / ローカル保存 / 最終仕上げ）を実装する。
- クライアントで Stage / countdown / START 音声を鳴らし、状態遷移時に再生キューと再生中音声を停止できるようにする。
- `RoomStateSnapshot` と `RESULT_READY` をローカル JSON として保存し、`ROOM_STATE_LOST` を含む終了系で部分結果を確認しやすくする。

## 非目的
- Worker / DO / shared の WS 契約変更。
- watcher/parser の仕様変更。
- 結果 JSON から別画面を新設して履歴ブラウズする機能。
- 外部音声素材や追加 npm/crate 依存の導入。

## 変更点
- `apps/client/src` に音声通知サービスとローカル結果保存サービスを追加し、`roomStore` / `settingsStore` の変化に追従させる。
- `speechSynthesis` を利用して Stage / countdown / START 音声をスケジュールし、ラウンド変更や `PLAYING` 離脱時に再生中・キュー済み音声を破棄する。
- Tauri Rust 側に結果 JSON を UTF-8 / LF / atomic write で保存する command を追加し、非Tauri環境では `localStorage` へフォールバックする。
- Room 画面と ErrorDialog を補強し、保存先・保存回数・直近保存時刻・`ROOM_STATE_LOST` 時の案内を表示する。

## 影響範囲
- ユーザー:
  - PLAYING 中に音声通知を受け取れる。
  - ラウンド進行に応じた snapshot/result がローカル保存される。
  - `ROOM_STATE_LOST` 時に blocking dialog と保存済み部分結果への導線が出る。
- データ:
  - 既存 settings の `voiceEnabled` を継続利用する。
  - ローカル結果 JSON を Tauri 保存ディレクトリ配下へ書き出し、非Tauriでは `localStorage` に保存する。
- 互換性:
  - Worker / shared schema は変更しない。
  - 保存 JSON は client 内部フォーマットの追加のみで既存通信互換性へ影響しない。
- Cloudflare:
  - 影響なし。

## 対象ファイル / 対象レイヤ
- `apps/client/src/app/App.tsx`
- `apps/client/src/components/ErrorDialog.tsx`
- `apps/client/src/pages/RoomPage.tsx`
- `apps/client/src/services/**`
- `apps/client/src/stores/**`
- `apps/client/src/styles.css`
- `apps/client/src-tauri/src/commands/**`
- `apps/client/src-tauri/src/lib.rs`
- `apps/client/src-tauri/src/models/**`
- `tasks/codex-pr-12-audio-local-save.md`

## テスト観点
- `PLAYING` の同一 round で Stage / countdown / START が 1 回だけスケジュールされ、ラウンド変更や `RESULT` / `CLOSED` 遷移で停止される。
- `voiceEnabled=false` では音声をスケジュールしない。
- snapshot / result payload 更新時にローカル保存状態が更新される。
- `ROOM_STATE_LOST` で blocking dialog と保存補助表示が出る。
- `npm --workspace @infinitas/client run typecheck`
- `npm --workspace @infinitas/client run build`
- `npm run typecheck`
- `cargo check`

## ロールバック方針
- PR-12 差分を revert し、PR-11 時点の client + watcher 実装へ戻す。

## Commit Plan（コミット分割計画）
1. PR-12 plan 追加（本ファイル）。
2. Tauri 結果保存 command と TS bridge / persistence service を実装。
3. 音声通知 service、Room UI、`ROOM_STATE_LOST` ダイアログ補強を実装。
4. build/typecheck/cargo check を通し、最終調整を行う。

## 検証結果
- [x] `npm --workspace @infinitas/client run typecheck`
- [x] `npm --workspace @infinitas/client run build`
- [x] `npm run typecheck`
- [x] `cargo check`
