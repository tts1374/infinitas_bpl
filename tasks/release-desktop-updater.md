# release-desktop-updater

## BASE_SHA

- `4c3428a62e0130f1ebbb2a765d5ecb354fb698ad`

## 目的

- GitHub Actions 上で Windows 向け Tauri アプリをビルドし、updater 署名済み `.msi` / `.sig` を生成する
- 生成物を Cloudflare R2 にアップロードし、成功後のみ KV の `app:stable:latest` を更新する
- 手動実行可能な release workflow と、その運用に必要な README を整備する

## 非目的

- update API Worker 本体の実装や仕様追加
- beta / rollout / min_supported_version / force-update の先回り実装
- R2 bucket / KV namespace の新規作成自動化
- Windows コード署名証明書の導入
- GitHub Releases を配布の正本に戻すこと

## 変更点

- GitHub Actions workflow を追加し、Windows runner で Tauri build を実行する
- CI で updater 署名鍵を環境変数注入し、`.msi` と `.sig` を収集して正規化する
- Wrangler を使って R2 upload と KV 更新を順序保証付きで行う
- 必要に応じて補助スクリプトまたは Wrangler 設定を追加し、責務を分離する
- README または運用メモに secrets / vars / 実行手順 / ロールバックを追記する

## 影響範囲

- ユーザー: 配布フローのみ。アプリ実行時の UI / 機能仕様は変更しない
- データ: `app:stable:latest` の更新手順にのみ影響し、値はアプリ version を単一ソースから反映する
- 互換性: updater が参照する配布物 path 規約を固定化する
- Cloudflare: R2 bucket への object upload、KV key put/get、Wrangler 認証に影響する

## 対象ファイル / 対象レイヤ

- `.github/workflows/*`
- `README.md` および必要なら補助ドキュメント
- `wrangler.jsonc` または既存 Wrangler 設定
- 必要なら CI 用補助スクリプト
- 参照のみ: `package.json`, `apps/client` / `src-tauri` の version source と build 設定

## テスト観点

- version を単一ソースから抽出できる
- Windows build が updater 署名付き成果物を生成できる
- `.msi` / `.sig` が 1 件ずつ特定でき、見つからなければ fail する
- R2 upload 成功後のみ KV `app:stable:latest` が更新される
- upload / KV / version 抽出の失敗で workflow が fail し、latest が進まない
- Wrangler v4 の remote 操作として `--remote` が明示されている

## ロールバック方針

- workflow 失敗時は `app:stable:latest` を更新しない
- 既存配布物と既存 latest を維持する
- 必要時は KV を手動で直前 version に戻し、R2 上の誤配置物を確認して対処する

## コミット分割計画

- [x] 設計確認（既存 build / version / Wrangler / README の確認）
- [x] release workflow と補助スクリプト実装
- [x] README / 運用メモ更新
- [x] ローカル検証と差分確認

## 検証結果

- `node scripts/release/get-tauri-version.mjs`
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build:client`
- `npm run test:worker`
- `npm --workspace @infinitas/update-worker run build`
