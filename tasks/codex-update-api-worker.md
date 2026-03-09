# codex-update-api-worker

- BASE_SHA: `8393e203977c420d3bab27e8170b2a8870ac11d8`

## 目的

- Cloudflare Workers ベースの Tauri updater dynamic update server を既存 `apps/worker` に追加する。
- `/api/app/update` で stable / Windows 向けの更新有無判定と updater JSON 応答を返せるようにする。
- KV と R2 binding、ローカル開発手順、運用前提をコードと README に明示する。

## 非目的

- GitHub Actions からの upload 自動化
- beta channel、rollout、min_supported_version、force update
- Access 保護や認証導入
- Durable Objects の利用
- クライアント側 updater 基盤の再設計

## 変更点

- [ ] `apps/worker` に update route と pure function 群を追加
- [ ] version / target validation、SemVer 比較、204 / 200 / 400 / 500 応答を実装
- [ ] KV `app:stable:latest` / `app:update:disabled` と R2 `.sig` 読み出しを追加
- [ ] Wrangler の KV / R2 / vars binding と `WorkerEnv` を更新
- [ ] 正常系 / 異常系をカバーする worker テストを追加
- [ ] Worker 向け README にローカル開発・デプロイ・R2 パス規約を追記

## 影響範囲

- ユーザー: Windows クライアントが update server から更新確認できるようになる
- データ: KV に update 用の 2 キーを追加で参照するが、既存 room/lobby データ形式は変更しない
- 互換性: updater dynamic server 形式の JSON を返す。既存 room/charts API 契約は変更しない
- Cloudflare: Worker route、Wrangler bindings、KV / R2 リソース参照、download base URL 変数が追加される

## 対象ファイル / 対象レイヤ

- worker routes / services / utils (`apps/worker/src/**`)
- worker env / configuration (`apps/worker/wrangler.toml`, `apps/worker/src/types/env.ts`)
- worker package docs / tests (`apps/worker/**`)

## テスト観点

- `version=1.0.0`, latest=`1.0.1` で 200 + updater JSON
- `version=1.0.1`, latest=`1.0.1` で 204
- `disabled=true` で 204
- `version` / `target` 欠落や unsupported target で 400
- latest 未設定、`.sig` 不在で 500
- worker typecheck / lint / test / wrangler build が通る

## ロールバック方針

- update route と binding 追加差分を丸ごと戻し、既存 room/charts worker のみの状態へ戻す
- README の update API 追記を削除し、Cloudflare リソース参照を元に戻す

## コミット分割計画

- [ ] worker update API と bindings / tests の追加
- [ ] README と検証結果の整理
