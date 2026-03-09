# Plan: codex/worker-test-path

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_worker_tests`
- branch: `codex/worker-test-path`
- base branch: `v1`
- BASE_SHA: `de2ff36`

## 目的
- Worker/DO の既存テストを、誰でも同じコマンドで再現できる形にする。
- 本番リリース前チェックリストの Worker テスト項目を埋めやすくする。
- 可能なら CI でも Worker テストを実行する。

## 非目的
- Worker/DO のロジック変更。
- テストケースの大幅追加。
- 新しい test framework の全面導入。
- Cloudflare deploy フローの変更。

## 変更点
- `apps/worker` に repeatable な test 実行 script を追加する。
- 必要に応じて test 用 tsconfig や一時出力先を追加する。
- 既存 `room-state` テストが TypeScript を安定して実行できるようにする。
- CI に Worker テストを追加する。

## 影響範囲
- ユーザー:
  - 直接影響なし。
- データ:
  - 変更なし。
- 互換性:
  - 実行時互換性への影響なし。
- Cloudflare:
  - 本番 resources への影響なし。CI とローカル検証導線のみ。

## 対象ファイル / 対象レイヤ
- `package.json`
- `apps/worker/package.json`
- `apps/worker/tsconfig*.json`
- `apps/worker/src/durable/room-state.test.*`
- `.github/workflows/ci.yml`
- `tasks/codex-worker-test-path.md`

## テスト観点
- `npm run test:worker` で Worker テストが成功する。
- `npm run lint`
- `npm run typecheck`
- `npm run build:client`
- `npm run test:client-stats`
- `cargo check`
- `npx wrangler deploy --dry-run`

## ロールバック方針
- Worker テスト導線関連の script / config / CI 変更を revert して元へ戻す。

## Commit Plan（コミット分割計画）
1. Worker test path plan 追加。
2. Worker テスト実行導線と CI 追加。
3. 検証結果反映。

## 検証結果
- [ ] `npm run test:worker`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build:client`
- [ ] `npm run test:client-stats`
- [ ] `cargo check`
- [ ] `npx wrangler deploy --dry-run`
