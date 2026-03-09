# Plan: codex/ci-workflow

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_ci`
- branch: `codex/ci-workflow`
- base branch: `v1`
- BASE_SHA: `cafc52e8cca8b5a21abee80cc095ba60f552ef90`

## 目的
- GitHub Actions の CI workflow を追加し、既存の主要検証コマンドを pull request / push で自動実行できるようにする。
- 本番リリース前チェックリストにある最低限の自動検証のうち、現時点でローカル再現できるものを CI へ載せる。

## 非目的
- lint 基盤の新規導入。
- Worker/DO テスト実行基盤の整備。
- Tauri 本番ビルドや Cloudflare 本番 deploy の自動化。
- アプリ本体ロジックや設計仕様の変更。

## 変更点
- `.github/workflows/ci.yml` を追加する。
- Windows runner 上で Node / Rust をセットアップし、既存 script ベースで typecheck / build / cargo check / stats test を実行する。
- workflow は全 `push` / `pull_request` と `workflow_dispatch` を対象にする。

## 影響範囲
- ユーザー:
  - 直接影響なし。
- データ:
  - 変更なし。
- 互換性:
  - アプリ実行時の互換性影響なし。
- Cloudflare:
  - deploy は行わず、ローカル bundle 相当のチェックまでに留める可能性がある。

## 対象ファイル / 対象レイヤ
- `.github/workflows/ci.yml`
- `tasks/codex-ci-workflow.md`

## テスト観点
- workflow で使用する各コマンドがローカルで成功する。
- Windows runner を前提とした Rust toolchain 設定と整合する。
- 既存未整備項目（lint、Worker テスト）が CI 対象外であることが明確に分かる。

## ロールバック方針
- `.github/workflows/ci.yml` を revert して CI 導入前の状態へ戻す。

## Commit Plan（コミット分割計画）
1. CI workflow plan 追加（本ファイル）。
2. GitHub Actions workflow 追加。
3. ローカルで対象コマンドを再実行し、結果を反映。

## 検証結果
- [x] `npm run typecheck`
- [x] `npm run build:client`
- [x] `cargo check`
- [x] `npm run test:client-stats`
- [x] `npx wrangler deploy --dry-run`
