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

## GitHub Actions release workflow

Windows 向け updater 配布は [release-desktop.yml](../../.github/workflows/release-desktop.yml) で行います。v1 では `workflow_dispatch` の手動実行のみを前提にし、以下の順序を固定しています。

1. `apps/client/src-tauri/tauri.conf.json` から version を一度だけ抽出する
2. GitHub Secrets 経由で updater 署名鍵を注入して Tauri build を行う
3. `.msi` と `.msi.sig` を 1 件ずつ特定し、`app.msi` / `app.msi.sig` に正規化する
4. R2 へ upload する
5. upload 成功後のみ KV `app:stable:latest` を更新する
6. R2 object と KV 値を `wrangler ... --remote` で post-check する

### 必要な GitHub Secrets

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 任意の GitHub Variables

- `CLOUDFLARE_R2_BUCKET`
  - 未設定時の既定値: `infinitas-arena-updates`
- `CLOUDFLARE_KV_BINDING_NAME`
  - 未設定時の既定値: `APP_KV`

### workflow_dispatch inputs

- `download_base_path`
  - 既定値: `bpl-app/stable`
- `app_target`
  - 既定値: `windows-x86_64`

### Cloudflare 側の準備

- R2 bucket `infinitas-arena-updates` が存在していること
- KV namespace `infinitas-arena-config` が存在していること
- Worker `infinitas-arena-update-api` の Wrangler 設定が repo 内の [wrangler.toml](./wrangler.toml) と一致していること
- 配布 URL のベースが `DOWNLOAD_BASE_URL` と整合していること

### 起動方法

1. GitHub Actions の `Release Desktop` workflow を開く
2. 必要なら `download_base_path` / `app_target` を上書きする
3. 実行後、artifact `desktop-updater-<version>` と R2 / KV の post-check 成功を確認する

### R2 path 規約

workflow は R2 に次の path で配置します。

```text
bpl-app/
  stable/
    <version>/
      windows-x86_64/
        app.msi
        app.msi.sig
```

### latest 更新順序

`app:stable:latest` は R2 upload の後にしか更新しません。build、artifact 収集、upload のいずれかが失敗した場合は workflow を fail させ、latest は進めません。

### 失敗時の扱いとロールバック

- version 抽出、artifact 収集、R2 upload、KV update のどこかで失敗したら workflow は fail します
- 2 個目の R2 upload に失敗した場合は、先に upload した object を削除して partial upload を残さないようにします
- `app:stable:latest` は upload 成功後にしか更新しないため、既存版は維持されます
- もし KV を戻す必要がある場合は、`wrangler kv key put --binding APP_KV "app:stable:latest" "<previous-version>" --remote` を使って手動で直前 version に戻します

### Wrangler v4 の注意

Wrangler v4 では remote の R2 / KV 操作に `--remote` が必要です。release workflow でも `wrangler r2 object put/get/delete` と `wrangler kv key put/get` のすべてで `--remote` を明示しています。
