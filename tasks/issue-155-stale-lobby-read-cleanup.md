# issue-155-stale-lobby-read-cleanup

## Purpose
- 既存の誤登録ロビー entry を `GET /api/lobby` の read path で即時除去し、本来一覧に出ない部屋の誤表示時間を最小化する。

## Non-goals
- visibility モデルの再設計
- migration / batch cleanup
- client/shared/WS/FSM 契約変更
- docs/design の大規模更新

## Fixed decisions
- cleanup trigger は `GET /api/lobby` read path
- RoomDO に internal の lobby eligibility 判定エンドポイントを追加する
- `eligible=false` と `404 ROOM_STATE_LOST` は stale 扱いで remove する
- `5xx` / 通信失敗は fail-open（表示維持）とする
- 公開レスポンス schema は不変とする

## Changes
- `apps/worker/src/services/lobby-directory.ts` にロビー一覧 read path 用の stale cleanup 補助を追加する
- `apps/worker/src/durable/lobby-directory-object.ts` に freshness 条件つき remove を追加し、read path cleanup が newer summary を削除しないようにする
- `apps/worker/src/routes/lobby.ts` で read path cleanup を実行した上で公開ロビー一覧を返す
- `apps/worker/src/durable/room-object.ts` に internal lobby eligibility 判定エンドポイントを追加する
- worker 回帰テストを `apps/worker/src/durable/room-object.test.mjs`、`apps/worker/src/durable/lobby-directory-object.test.mjs`、`apps/worker/src/routes/lobby.test.mjs` に追加する
- `apps/worker/package.json` の標準 test script に lobby route 回帰テストを組み込む

## Impact
- Users/runtime: auto-match 誤登録 entry がロビー一覧に残り続けない
- Data/compatibility: 公開レスポンス schema 変更なし。既存 directory entry を read path で除去するのみ
- Cloudflare: Worker/DO の既存資源内で完結。構成変更なし

## Target Layers / Files
- layer: worker
- files:
  - `apps/worker/src/durable/room-object.ts`
  - `apps/worker/src/durable/lobby-directory-object.ts`
  - `apps/worker/src/services/lobby-directory.ts`
  - `apps/worker/src/routes/lobby.ts`
  - `apps/worker/src/durable/room-object.test.mjs`
  - `apps/worker/src/durable/lobby-directory-object.test.mjs`
  - `apps/worker/src/routes/lobby.test.mjs`
  - `apps/worker/package.json`

## Validation Plan
- `npm run test:worker`
- `npm --workspace @infinitas/worker run typecheck`
- `npm run lint`
- `npm --workspace @infinitas/worker exec wrangler deploy --dry-run`

## Rollback Plan
- read path cleanup と internal eligibility endpoint の差分をまとめて revert し、従来の LobbyDirectory 読み出しのみに戻す

## Commit Split Plan
1. worker 実装: stale lobby cleanup の freshness 条件つき remove と回帰テスト
2. worker test harness: 標準 test script への lobby cleanup 回帰組み込み

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- execution profile: `High-Risk`
- Plan Mode: `YES`
- Standard Spawn Gate: `NOT_APPLICABLE`
- High-Risk Spawn Gate: `APPLICABLE`

## Delegation Packet
- task label: `issue-155-stale-lobby-read-cleanup`
- objective: `/api/lobby` 読取時に stale entry を即時除去し、誤登録 auto-match 部屋を表示しない
- in-scope files/layer: worker / `room-object.ts`, `lobby-directory-object.ts`, `lobby-directory.ts`, `lobby.ts`, `room-object.test.mjs`, `lobby-directory-object.test.mjs`, `lobby.test.mjs`, `package.json`
- non-goals: visibility 再設計、batch cleanup、client/shared/docs-design 変更
- forbidden scope: `apps/client/**`, `apps/web/**`, `packages/shared/**`, `docs/design/**`, lockfile/依存更新
- expected output: stale entry は read path で remove され、正常な PUBLIC LOBBY 部屋の表示挙動は維持される
- validation: 上記 Validation Plan を満たす
- escalation: cross-layer 化、契約変更、CI/依存変更、仕様判断が必要化した場合

## Replan Gate
- 次のいずれかが発生した場合は Phase C/D を停止し、`WAITING_FOR_HUMAN_DECISION` または `ESCALATION` へ戻す
  - shared/client/docs-design の更新が必須化した場合
  - 公開レスポンス schema や WS/FSM 契約変更が必要化した場合
  - `5xx` fail-open 以外の互換方針見直しが必要化した場合
