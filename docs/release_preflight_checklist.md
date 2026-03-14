# 本番リリース前チェックリスト

このチェックリストは、Ph1 の本番リリース判定をこのリポジトリ上でそのまま進めるための実務用シートです。
`AGENTS.md`、`WORKFLOW.md`、`QUALITY.md`、`docs/design/*` を前提にしています。

## 使い方

1. リリース対象ブランチを `v1` から切る
2. このファイルを開いたまま、各項目を上から順に埋める
3. 未実施や失敗が 1 つでも残っている間は本番リリースしない
4. 必要なら結果を PR 本文やリリースノートへ転記する

---

## 0. リリース情報

- [ ] 対象日: `YYYY-MM-DD`
- [ ] 担当者:
- [ ] 対象ブランチ:
- [ ] `BASE_SHA` 記録済み
- [ ] 対象バージョン:
- [ ] 非公開の作業差分が混ざっていない

メモ:

```text
BASE_SHA:
Release version:
Notes:
```

---

## 1. 事前ブロッカー解消

このセクションは「今のリポジトリでは先に片付けるべき項目」です。

- [x] CI workflow が存在する
  - 期待内容: typecheck / build / test を自動実行
  - 現状メモ: `.github/workflows/ci.yml` と `.github/workflows/release-desktop.yml` が存在する
- [x] Lint コマンドが存在する
  - 期待内容: ルートまたは workspace から再現可能
  - 現状メモ: ルート `package.json` に `npm run lint` が定義されている
- [x] Worker テストの実行導線が存在する
  - 期待内容: README や script なしでも同じコマンドで再実行できる
  - 現状メモ: ルート `package.json` に `npm run test:worker` が定義されている
- [x] リリース手順書がある
  - 最低限必要: Worker デプロイ手順、client 配布手順、ロールバック手順
  - 現状メモ: `apps/worker/README.md` に LOBBY Worker deploy 手順、`apps/update-worker/README.md` に updater / desktop release 手順がある
- [x] バージョン表記が揃っている
  - 確認対象:
  - `package.json`
  - `apps/client/package.json`
  - `apps/client/src-tauri/tauri.conf.json`
  - `apps/client/src-tauri/Cargo.toml`
  - 現状メモ: root / client / worker / update-worker / shared / Tauri / Cargo の version を `1.0.0` に統一済み

---

## 2. リポジトリ健全性

- [ ] `git status --short` がクリーン
- [ ] 目的外 diff がない
- [ ] 生成物を意図せずコミットしていない
- [ ] UTF-8 without BOM / LF の逸脱がない
- [ ] `v1` を base にしている

実行メモ:

```powershell
git status --short
git rev-parse --abbrev-ref HEAD
git merge-base HEAD v1
```

---

## 3. 自動検証

`QUALITY.md` の「技術的検証」に対応します。

### 3.1 Typecheck

- [ ] ルート TypeScript typecheck 成功

```powershell
npm run typecheck
```

### 3.2 Client build

- [ ] client production build 成功

```powershell
npm run build:client
```

### 3.3 Rust / Tauri buildability

- [ ] Rust 側 `cargo check` 成功
- [ ] 必要なら Tauri test build 成功

```powershell
cd apps/client/src-tauri
cargo check
cd ..
cd ..
npm --workspace @infinitas/client run tauri:build:test
```

### 3.4 Worker buildability

- [ ] Worker typecheck 成功
- [ ] Worker dry-run deploy 成功

```powershell
npm --workspace @infinitas/worker run typecheck
cd apps/worker
npx wrangler deploy --dry-run
```

### 3.5 Tests

- [ ] client stats test 成功
- [ ] Worker/DO テスト成功
- [ ] 追加した自動テストがあれば全件成功

```powershell
npm run test:client-stats
```

Worker テスト実行コマンド:

```powershell
npm run test:worker
```

### 3.6 Lint

- [ ] lint 成功

```powershell
npm run lint
```

---

## 4. Worker / Cloudflare 確認

- [x] `apps/worker` の deploy 手順書または runbook がある
- [ ] GitHub Actions `Deploy infinitas-arena Worker` workflow が実行可能
- [ ] Worker deploy 用 GitHub Secrets を確認した
  - `CLOUDFLARE_API_TOKEN_WORKER`
  - `CLOUDFLARE_ACCOUNT_ID`
- [ ] Worker smoke check 用 GitHub Variable を確認した
  - `CLOUDFLARE_WORKERS_SUBDOMAIN`
- [ ] `wrangler.toml` の本番設定を確認した
- [ ] Durable Object migration tag が意図通り
- [ ] preview と production の混同がない
- [ ] 本番 deploy 実行者と権限を確認した
- [ ] ロールバック時に戻すバージョンを控えた

確認対象:

- `apps/worker/wrangler.toml`
- `.github/workflows/deploy-worker.yml`
- `apps/worker/README.md`
- Cloudflare dashboard の DO / Worker

手動 deploy コマンド:

```powershell
npm --workspace @infinitas/worker run deploy
```

GitHub Actions 手動 deploy:

```text
Workflow: Deploy infinitas-arena Worker
Smoke check: /api/charts?play_style=SP&level_filter=ANY
```

### 4.1 Desktop updater release

- [ ] GitHub Secrets を確認した
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - `CLOUDFLARE_API_TOKEN_RELEASE`
  - `CLOUDFLARE_ACCOUNT_ID`
- [ ] GitHub Actions `Release Desktop` workflow が実行可能
- [ ] `apps/update-worker/wrangler.toml` の `DOWNLOAD_BASE_URL` / `APP_KV` / `APP_BUCKET` を確認した
- [ ] R2 upload 先 path 規約 `bpl-app/stable/<version>/windows-x86_64/` を確認した
- [ ] `app:stable:latest` を upload 成功後にのみ更新する手順を確認した
- [ ] Wrangler v4 の `--remote` を使うことを確認した

---

## 5. 仕様準拠チェック

### 5.1 FSM / Protocol

- [ ] `LOBBY` 内 ready 管理から `PICKING -> PLAYING -> RESULT -> CLOSED` への遷移を確認
- [ ] `client_msg_id` による重複排除を確認
- [ ] `expected_key` enforcement を確認
- [ ] host 権限制御を確認
- [ ] `LobbyDirectoryDO` の公開・非満員・`LOBBY`・TTL フィルタを確認

参照:

- `docs/design/01_fsm.md`
- `docs/design/02_ws_protocol.md`
- `docs/design/03_data_model.md`
- `docs/design/07_constants.md`

### 5.2 Source I/O

- [ ] `inf-notebook` で `SCORE` / `MISSCOUNT` が取れる
- [ ] `inf_daken_counter` で `SCORE` / `MISSCOUNT` が取れる
- [ ] `observed_key == expected_key` のみ採用される
- [ ] source 障害時に `SOURCE_UNAVAILABLE` が出る

参照:

- `docs/design/06_source_io_spec.md`

---

## 6. 手動 E2E

`QUALITY.md` の E2E 要件に対応します。可能なら 2 人・2 台で記録を残します。

### 6.1 ARENA

- [ ] create
- [ ] join
- [ ] ready
- [ ] pick
- [ ] play 1 ラウンド以上
- [ ] result 表示

### 6.2 BPL (BO3)

- [ ] create
- [ ] join
- [ ] ready
- [ ] pick
- [ ] play 1 ラウンド以上
- [ ] result 表示

### 6.3 例外系

- [ ] `players < 2` で START 不可
- [ ] 重複 pick の差し替え
- [ ] `TIMEOUT` 発生
- [ ] `FORCE_ADVANCE` 動作
- [ ] `SKIP_HOST_ASSIGN` が v1 では拒否され、強制確定は `FORCE_ADVANCE` で扱うことを確認
- [ ] `ROOM_STATE_LOST` 表示と room close

記録テンプレート:

```text
Date:
Mode:
Players:
Source:
Result:
Issues:
```

---

## 7. Client 出荷準備

- [ ] 表示崩れがない
- [ ] 音声キューが状態遷移で停止する
- [ ] ルーム解散時に音声が残らない
- [ ] local result JSON 保存を確認
- [ ] 設定保存を確認
- [ ] 初回起動導線を確認
- [ ] 配布物の格納先を決めた
- [ ] 配布ファイル名と版番号を決めた

確認対象:

- `apps/client/src-tauri/tauri.conf.json`
- `apps/client/src-tauri/Cargo.toml`

---

## 8. リリースノート / 運用

- [ ] 変更点を 3-10 行で要約した
- [ ] 既知の制約を記載した
- [ ] サポート対象外を記載した
- [ ] 障害時の連絡先または対応手順を決めた
- [ ] ロールバック条件を決めた
- [ ] deploy 実施時刻を決めた

最低限書く内容:

```text
- 何ができるようになったか
- 何はまだ未対応か
- 既知の注意点
- 問題が出た場合の戻し先
```

---

## 9. 最終 Go / No-Go

- [ ] 事前ブロッカーがすべて解消済み
- [ ] 自動検証がすべて成功
- [ ] 手動 E2E がすべて完了
- [ ] 本番 deploy 手順を第三者が読んでも再現できる
- [ ] ロールバック手順を第三者が読んでも再現できる
- [ ] 既知課題を許容したうえで release する判断が明文化されている

判定:

```text
GO / NO-GO:
Decision by:
Reason:
```

---

## 補足

2026-03-09 時点でローカル確認できている項目:

- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run build:client`: 成功
- `cargo check` (`apps/client/src-tauri`): 成功
- `npm --workspace @infinitas/worker run typecheck`: 成功
- `npx wrangler deploy --dry-run` (`apps/worker`): 成功
- `npm run test:client-stats`: 成功
- `npm run test:worker`: 成功
- `npm --workspace @infinitas/update-worker run build`: 成功

2026-03-09 時点で未整備または要補強の項目:

- GitHub 上での `Deploy infinitas-arena Worker` 手動実行結果
- GitHub 上での `Release Desktop` 手動実行結果
