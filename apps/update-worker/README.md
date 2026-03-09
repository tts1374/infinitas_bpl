# update-worker

Cloudflare Workers で Tauri 2 updater の dynamic update server を提供する package です。

## 必要な Cloudflare リソース

- Worker: `infinitas-arena-update-api`
- KV namespace: `infinitas-arena-config`
- R2 bucket: `infinitas-arena-updates`

## Binding 名

- `APP_KV`: 更新設定を読む KV binding
- `APP_BUCKET`: `.sig` を読む R2 binding
- `DOWNLOAD_BASE_URL`: 配布 MSI を返すためのベース URL

`DOWNLOAD_BASE_URL` には配布 URL のベースを設定します。v1 では `https://pub-f873923a35b944bbb316013ecc7e3805.r2.dev` を入れていますが、配布先を切り替える場合はここだけ差し替えます。

## API

- Endpoint: `GET /api/app/update`
- Query:
  - `version`: クライアントの現在バージョン
  - `target`: `windows-x86_64`

判定ルール:

- `app:update:disabled == "true"` のときは `204 No Content`
- `app:stable:latest` が未設定または invalid のときは `500`
- `version >= latest` のときは `204 No Content`
- `version < latest` のときは `200 OK` と updater JSON

返却 JSON は dynamic update server 形式で、少なくとも `version`, `url`, `signature` を返します。`signature` には `app.msi.sig` のファイル内容そのものを入れます。

## KV キー

- `app:stable:latest`
  - 例: `1.0.1`
- `app:update:disabled`
  - 例: `false`

## R2 パス規約

```text
bpl-app/
  stable/
    1.0.1/
      windows-x86_64/
        app.msi
        app.msi.sig
```

Worker は `app.msi` の URL を `DOWNLOAD_BASE_URL + objectKey` で組み立て、`.sig` は `APP_BUCKET` から読み出して JSON に含めます。

## ローカル開発

1. [wrangler.toml](./wrangler.toml) の `APP_KV` namespace ID を実際の `infinitas-arena-config` ID に置き換える
2. 必要なら `DOWNLOAD_BASE_URL` を配布 URL に合わせて更新する
3. `npm --workspace @infinitas/update-worker run dev`
4. 別ターミナルから `curl "http://127.0.0.1:8787/api/app/update?version=1.0.0&target=windows-x86_64"`

ローカルの `wrangler dev` では binding がシミュレートされるため、KV / R2 を使った update 判定をそのまま確認できます。

## デプロイ

- `npm --workspace @infinitas/update-worker run build`
- `npm --workspace @infinitas/update-worker run deploy`

`build` は `wrangler deploy --dry-run` を使った bundle 確認です。`deploy` 前に namespace ID と `DOWNLOAD_BASE_URL` を本番値で確認してください。
