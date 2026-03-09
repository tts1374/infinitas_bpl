# Plan: codex/deploy-worker-workflow

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl`
- branch: `codex/deploy-worker-workflow`
- base branch: `v1`
- BASE_SHA: `b3c83eaf9b077150b289f8ae9c74f44175f636db`

## 目的
- LOBBY 系 Cloudflare Worker を GitHub Actions から production deploy できる workflow を追加する。
- `apps/worker/` 配下の変更時または手動実行時に `wrangler deploy` を実行できるようにする。
- deploy 後に `workers.dev` への簡易疎通確認を自動で行えるようにする。

## 非目的
- desktop release workflow との統合。
- updater 用 Worker / R2 / KV latest 更新の自動化。
- staging 環境や複数 Worker 同時 deploy の導入。
- Worker 本体 API の大規模変更。

## 変更点
- `.github/workflows/deploy-worker.yml` を追加する。
- `apps/worker/wrangler.toml` の Worker 名を `infinitas-arena` に揃える。
- `apps/worker/README.md` を追加し、deploy workflow の役割、手動実行、必要 secrets / variables、smoke check の前提を明記する。

## 影響範囲
- ユーザー:
  - 直接影響なし。
- データ:
  - 本番 deploy 実行時に Worker script / DO migration が Cloudflare 側へ反映される。
- 互換性:
  - Worker 名は `apps/worker/wrangler.toml` を正として扱う。
- Cloudflare:
  - Workers Scripts / KV / DO migration を伴う production deploy workflow を追加する。

## 対象ファイル / 対象レイヤ
- `.github/workflows/deploy-worker.yml`
- `apps/worker/wrangler.toml`
- `apps/worker/README.md`
- `tasks/codex-deploy-worker-workflow.md`

## テスト観点
- workflow が `workflow_dispatch` と `push(paths)` を持つ。
- install は root workspace の `npm ci` で再現できる。
- deploy は `apps/worker` を working directory にして `npx wrangler deploy` を実行する。
- smoke check は `workers.dev` の `GET /api/charts?play_style=SP&level_filter=ANY` で 2xx を確認する。

## ロールバック方針
- workflow と Worker README を revert し、必要なら `apps/worker/wrangler.toml` の Worker 名を元に戻す。

## Commit Plan（コミット分割計画）
1. deploy workflow plan 追加。
2. Worker deploy workflow と最小限の設定更新。
3. Worker 用 README 追加と検証結果反映。

## 検証予定
- `npm --workspace @infinitas/worker run typecheck`
- `cd apps/worker && npx wrangler deploy --dry-run`
- `git diff --check`
