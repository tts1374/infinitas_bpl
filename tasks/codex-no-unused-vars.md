# Plan: codex/no-unused-vars

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_unused`
- branch: `codex/no-unused-vars`
- base branch: `v1`
- BASE_SHA: `be7f77c34a5b2f245079781e8c75d3ed31a672ed`

## 目的
- ESLint の `@typescript-eslint/no-unused-vars` を有効化し、現在の未使用変数違反を解消する。
- lint を「導入済み」から「unused も拾える状態」へ一段進める。

## 非目的
- 新しい lint ルールの追加。
- 大規模な UI/設計変更。
- Worker テスト基盤の追加。
- formatting 専用変更。

## 変更点
- `eslint.config.mjs` で `@typescript-eslint/no-unused-vars` を有効化する。
- 現在 lint に引っかかる未使用 import / state / helper / 引数を最小差分で整理する。
- 必要なものは使用箇所へ寄せ、不要なものは削除する。

## 影響範囲
- ユーザー:
  - 直接影響は想定しない。
- データ:
  - 変更なし。
- 互換性:
  - 実行時互換性への影響は想定しないが、未使用扱いの state/helper 削除は画面ロジックを慎重に確認する。
- Cloudflare:
  - 影響なし。

## 対象ファイル / 対象レイヤ
- `eslint.config.mjs`
- unused 修正が必要な `apps/client/src/**` / `apps/worker/src/**`
- `tasks/codex-no-unused-vars.md`

## テスト観点
- `npm run lint` が `no-unused-vars` 有効状態で成功する。
- `npm run typecheck`
- `npm run build:client`
- `npm run test:client-stats`
- `cargo check`
- `npx wrangler deploy --dry-run`

## ロールバック方針
- `eslint.config.mjs` と関連修正を revert して、`no-unused-vars` 導入前へ戻す。

## Commit Plan（コミット分割計画）
1. no-unused-vars cleanup plan 追加。
2. lint 設定の有効化と未使用違反の解消。
3. 検証結果反映。

## 検証結果
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build:client`
- [ ] `npm run test:client-stats`
- [ ] `cargo check`
- [ ] `npx wrangler deploy --dry-run`
