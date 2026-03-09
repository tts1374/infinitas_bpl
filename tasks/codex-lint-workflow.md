# Plan: codex/lint-workflow

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_lint`
- branch: `codex/lint-workflow`
- base branch: `v1`
- BASE_SHA: `368256b4fca6cf24fdb63facb65dc0256804e9c8`

## 目的
- リポジトリに再現可能な lint 実行基盤を追加する。
- 本番リリース前チェックリストで未整備だった `lint` 項目を埋められるようにする。
- 既存 CI に lint を追加し、push / pull request ごとに自動実行される状態にする。

## 非目的
- 大規模なコード整形や設計変更。
- Worker/DO テスト基盤の整備。
- ルールを厳しくしすぎて大量修正を生むこと。
- Prettier や formatting tool の同時導入。

## 変更点
- ESLint ベースの最小 lint 構成を root に追加する。
- root `package.json` に `lint` script を追加する。
- 必要最小限の ignore / globals / TypeScript 設定を入れる。
- `.github/workflows/ci.yml` に lint 実行を追加する。
- lint 導入時に見つかった現行コードの最小限の違反だけ修正する。

## 影響範囲
- ユーザー:
  - 直接影響なし。
- データ:
  - 変更なし。
- 互換性:
  - 実行時互換性への影響は想定しない。
- Cloudflare:
  - 影響なし。CI 上の静的検証のみ追加。

## 対象ファイル / 対象レイヤ
- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`
- ESLint 設定ファイル
- lint 修正が必要な最小限の TS/TSX ファイル
- `tasks/codex-lint-workflow.md`

## テスト観点
- `npm ci` 後に `npm run lint` が成功する。
- 既存の `typecheck` / build / stats test / `cargo check` / Worker dry-run が維持される。
- CI workflow に lint 追加後も既存 job 構成を壊さない。

## ロールバック方針
- lint 関連の設定、依存、CI 追加分を revert して導入前の状態へ戻す。

## Commit Plan（コミット分割計画）
1. lint workflow plan 追加。
2. lint 依存、設定、script、CI 追加。
3. lint 違反の最小修正と検証結果反映。

## 検証結果
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build:client`
- [ ] `npm run test:client-stats`
- [ ] `cargo check`
- [ ] `npx wrangler deploy --dry-run`
