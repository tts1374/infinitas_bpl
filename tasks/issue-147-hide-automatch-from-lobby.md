# Issue #147 Execution Plan

## 目的
- オートマッチで作成された部屋をロビー一覧に表示しない。

## 非目的
- visibility モデル（PUBLIC/PRIVATE/UNLISTED）の再設計
- 既存ロビー誤登録データの即時クリーンアップ
- client/shared/WS/FSM/timer の仕様変更

## 変更点
- `apps/worker/src/services/room-create.ts` の create-time ロビー upsert 条件を `PUBLIC && auto_match !== true` に制限する。
- create-time 経路の回帰テストを worker 既存テスト実行対象に追加する。

## 影響範囲
- ユーザー影響: 新規オートマッチ部屋はロビー一覧に出なくなる。
- データ/互換性: 既存誤登録分は TTL で自然消滅。互換フォーマット変更なし。
- Cloudflare: 既存 Worker/DO 資源のみ利用、構成変更なし。

## 対象レイヤ/対象ファイル
- worker:
  - `apps/worker/src/services/room-create.ts`
  - `apps/worker/src/routes/matchmaking.test.mjs`

## Validation Plan
- `npm run test:worker`
- `npm --workspace @infinitas/worker run typecheck`
- `npm run lint`
- `npm --workspace @infinitas/worker exec wrangler deploy --dry-run`

## Rollback 方針
- create-time upsert 条件を元に戻す単一差分でロールバック可能。

## Commit 分割方針
- 1コミット:
  - worker実装修正
  - worker回帰テスト

## Delegation Packet
- task label: `issue-147-hide-automatch-from-lobby-on-create`
- objective: create-time で auto_match 部屋が LobbyDirectory に入らないことを保証する。
- in-scope files/layer: worker / `room-create.ts`, `matchmaking.test.mjs`
- non-goals: visibility再設計、backfill除去、cross-layer変更
- forbidden scope: `apps/client/**`, `packages/shared/**`, `docs/design/**`, lockfile/依存更新
- expected output: auto_match PUBLIC は upsert されず、通常 PUBLIC は従来どおり upsert される
- validation: 上記 Validation Plan を満たす
- escalation: 追加の契約変更・cross-layer化・CI/依存変更が必要化した場合
