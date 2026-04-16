# issue-156-route-test-split

## Purpose
- `handlePostRooms` の lobby 可視性回帰ケースを route 責務ごとに分離し、失敗時の原因切り分けを早くする。
- production behavior を変えずに worker route test の保守性を上げる。

## Non-goals
- 本番ロジック変更
- visibility モデル再設計
- client/shared/docs-design/CI/依存更新

## Fixed decisions
- file naming は `<route-module>.test.mjs`
- test title は `<handler> <observable behavior> <condition>`
- 既存 2 ケースの assertion は等価維持
  - `PUBLIC + auto_match=true` は upsert しない
  - 通常 `PUBLIC` は upsert を維持

## Changes
- `apps/worker/src/routes/matchmaking.test.mjs` から `handlePostRooms` の lobby 可視性 2 ケースと rooms 用 helper を分離する
- `apps/worker/src/routes/rooms.test.mjs` を追加し、`handlePostRooms` の可視性回帰を移す
- `apps/worker/package.json` の worker test 対象へ `src/routes/rooms.test.mjs` を追加する
- route/observable behavior 単位で test title を整理する

## Impact
- Users/runtime: production behavior 変更なし
- Data/compatibility: 変更なし
- Cloudflare: 既存 worker test 実行のみで、構成変更なし

## Target Layers / Files
- layer: worker
- files:
  - `apps/worker/src/routes/matchmaking.test.mjs`
  - `apps/worker/src/routes/rooms.test.mjs`
  - `apps/worker/package.json`

## Validation Plan
- `npm run test:worker`
- `npm --workspace @infinitas/worker run typecheck`
- `npm run lint`
- `npm --workspace @infinitas/worker exec wrangler deploy --dry-run`

## Rollback Plan
- test split 差分をまとめて revert し、従来の `matchmaking.test.mjs` へ戻す

## Commit Split Plan
1. worker route test split
2. validation only

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- execution profile: `Standard`
- Plan Mode: `NO`
- Standard Spawn Gate: `APPLICABLE`
- High-Risk Spawn Gate: `NOT_APPLICABLE`

## Delegation Packet
- task label: `issue-156-route-test-split`
- objective: `handlePostRooms` の lobby 可視性回帰を `rooms.test.mjs` へ分離し、route 単位で失敗箇所を判別可能にする
- in-scope files/layer: worker / `matchmaking.test.mjs`, `rooms.test.mjs`, `package.json`
- non-goals: 本番ロジック変更、visibility 再設計、cross-layer 変更
- forbidden scope: `apps/client/**`, `apps/web/**`, `packages/shared/**`, `docs/design/**`, lockfile/依存更新
- expected output: `matchmaking.test.mjs` から `handlePostRooms` 依存が消え、`rooms.test.mjs` に等価 assertion の 2 ケースが移り、標準 worker test 対象に含まれる
- validation: 上記 Validation Plan を満たす
- escalation: contract-sensitive 化、cross-layer 化、CI/依存変更、仕様判断が必要化した場合

## Replan Gate
- 次のいずれかが発生した場合は Phase C/D を停止し、`WAITING_FOR_HUMAN_DECISION` または `ESCALATION` に戻す
  - 本番ロジックや公開挙動差分が必要になった場合
  - worker 単層を超える変更が必須になった場合
  - CI/依存/契約変更が必要になった場合
