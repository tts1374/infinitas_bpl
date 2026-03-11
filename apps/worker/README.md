# worker

LOBBY 系本体 Cloudflare Worker を提供する package です。

## Cloudflare リソース

- Worker: `infinitas-arena`
- Durable Object binding: `ROOM_DO` / `LOBBY_DIRECTORY_DO`
- migration tags: `v1-room-do-lobby`, `v1-lobby-directory-do`

この package は updater 用 Worker ではありません。desktop release は [release-desktop.yml](../../.github/workflows/release-desktop.yml)、updater API は [apps/update-worker](../update-worker/README.md) を使います。

## Wrangler 設定

- config: [wrangler.toml](./wrangler.toml)
- working directory: `apps/worker`

deploy は常にこの `wrangler.toml` を前提にします。repo ルートから曖昧に deploy せず、`apps/worker` を基準に `wrangler deploy` を実行します。

## ローカル実行

- install: `npm ci`
- typecheck: `npm --workspace @infinitas/worker run typecheck`
- dry-run deploy: `cd apps/worker && npx wrangler deploy --dry-run`
- deploy: `cd apps/worker && npx wrangler deploy`

## GitHub Actions deploy workflow

LOBBY Worker の production deploy は [deploy-worker.yml](../../.github/workflows/deploy-worker.yml) で行います。

### 役割

- `apps/worker` の Worker を GitHub Actions から deploy する
- `workflow_dispatch` で手動実行する
- `push` 時は `v1` ブランチ上の次の変更で自動実行する
  - `apps/worker/**`
  - `.github/workflows/deploy-worker.yml`
- deploy 後に `workers.dev` へ簡易疎通確認を行う

### 必要な GitHub Secrets

- `CLOUDFLARE_API_TOKEN_WORKER`
- `CLOUDFLARE_ACCOUNT_ID`

`CLOUDFLARE_API_TOKEN_WORKER` は LOBBY Worker deploy 専用です。Wrangler 実行時の認証にのみ使い、desktop release や updater 用更新には使いません。

想定する最小権限:

- `Account Settings: Read`
- `Workers Scripts: Edit`

### 必要な GitHub Variables

- `CLOUDFLARE_WORKERS_SUBDOMAIN`

smoke check では次の URL を使います。

```text
https://infinitas-arena.<CLOUDFLARE_WORKERS_SUBDOMAIN>.workers.dev/api/charts?play_style=SP&level_filter=ANY
```

### 手動実行方法

1. GitHub Actions の `Deploy infinitas-arena Worker` workflow を開く
2. `Run workflow` から対象 ref を選んで実行する
3. `Deploy Worker with Wrangler` と `Smoke check workers.dev deployment` の成功を確認する

### 自動実行条件

`push` では次の path に変更がある場合だけ実行します。

```yaml
paths:
  - "apps/worker/**"
  - ".github/workflows/deploy-worker.yml"
```

shared package 依存を後から追加したい場合は `paths` に明示的に足します。v1 では `apps/worker/**` を中心にした最小構成に留めます。
