# issue-162-lobby-read-cleanup-service-thin-route

## Source of Truth
- GitHub Issue `#162` "lobby read cleanup の service 化で route を thin に戻す"

## Purpose
- `GET /api/lobby` の observable behavior を維持したまま、read path cleanup orchestration を route から service 層へ寄せる。
- `routes/lobby.ts` を一覧取得と response 返却中心の thin route に戻し、worker 内の責務境界を明確にする。

## Non-goals
- cleanup policy の変更
- public response schema の変更
- DO / shared 契約変更
- lobby visibility モデルの再設計
- CI workflow / dependency / lockfile 変更

## Current Request Boundary
- current request ceiling: `A〜C Kickoff まで`
- allowed outputs now:
  - requirement shaping
  - bounded task artifact 作成
  - Phase C kickoff artifact
- forbidden outputs now:
  - product implementation diff
  - commit / push / PR / release
  - Issue / PR への stateful write-back
- next unlock condition: user が明示的に Phase C implementation を許可する

## Fixed decisions
- `routes/lobby.ts` は request を受けて service helper を呼び、HTTP response を返す thin route に戻す。
- stale 判定、conditional remove、best-effort cleanup orchestration は worker service 層が担う。
- `eligible=false` と `404 ROOM_STATE_LOST` は stale 扱い、`5xx` / transport failure は fail-open という #155 後の observable behavior を維持する。
- stale room は cleanup remove が失敗しても同一 response からは除外したままにする。
- 回帰観点は `apps/worker/src/routes/lobby.test.mjs` を維持し、route / service の責務境界が読み取れる形にする。

## Changes
- `apps/worker/src/services/lobby-directory.ts` に read path cleanup orchestration を担う helper を追加し、`listLobbyDirectoryRooms` / `fetchRoomLobbyEligibility` / `removeLobbyDirectoryRoom` を service 内で束ねる。
- `apps/worker/src/routes/lobby.ts` は新 helper を呼ぶ薄い構成へ整理し、route 側から stale 判定と cleanup orchestration を外す。
- `apps/worker/src/routes/lobby.test.mjs` は observable behavior を固定したまま、service 化後も回帰観点が維持されるよう必要最小限の更新に留める。

## Impact
- Users/runtime: `/api/lobby` の observable behavior は維持しつつ、worker 内の route / service 責務境界が明確になる。
- Data/compatibility: public response schema、DO 契約、shared contract 変更なし。
- Cloudflare: 既存 Worker / DO 資源内で完結し、構成変更なし。

## Target Layers / Files
- layer: worker
- files:
  - `apps/worker/src/routes/lobby.ts`
  - `apps/worker/src/services/lobby-directory.ts`
  - `apps/worker/src/routes/lobby.test.mjs`

## Validation Plan
- `npm run lint`
- `npm run typecheck`
- `npm run test:worker`
- `npm --workspace @infinitas/worker exec wrangler deploy --dry-run`

## Validation Surface Note
- PR CI の validate surface は `.github/workflows/validate-reusable.yml` の `npm run lint` + `npm run typecheck` + `npm run test:worker` であり、issue 記載の workspace-only typecheck より root `typecheck` の方が広い。
- `wrangler deploy --dry-run` は reusable validate の `full` profile でのみ走るため、worker touched change として local で追加実行する前提にする。
- 今回は `routes/lobby.test.mjs` を触るが、`apps/worker/package.json` の標準 `test` script に既に含まれているため、explicit extra test command は不要。

## Rollback Plan
- service 化差分をまとめて revert し、`routes/lobby.ts` に残っている現行 orchestration へ戻す。

## Commit Split Plan
1. `tasks/issue-162-lobby-read-cleanup-service-thin-route.md` を追加して scope / validation / kickoff 境界を固定する
2. worker service / route / route test の責務整理を 1 つの bounded 実装差分で行う
3. validation only

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- execution profile: `Standard`
- Plan Mode: `NO`
- Standard Spawn Gate: `APPLICABLE`
- High-Risk Spawn Gate: `NOT_APPLICABLE`
- No-delegate reason: worker 単層 / 単一 bounded task / public schema・DO・shared contract 変更なしで non-spawn acceptable。現リクエスト ceiling も kickoff-only のため、この turn では implementation spawn を行わない

## Delegation Packet
- task label: `issue-162-lobby-read-cleanup-service-thin-route`
- objective: `/api/lobby` の read path cleanup orchestration を service 化し、observable behavior を変えずに `routes/lobby.ts` を thin に戻す
- in-scope files/layer: worker / `routes/lobby.ts`, `services/lobby-directory.ts`, `routes/lobby.test.mjs`
- non-goals: cleanup policy 変更、public schema 変更、DO/shared/docs-design/CI/依存更新
- forbidden scope: `apps/client/**`, `apps/web/**`, `packages/shared/**`, `apps/worker/src/durable/**`, `docs/design/**`, `.github/workflows/**`, lockfile/依存更新
- expected output: read path cleanup の orchestration は service 層へ移り、route は list fetch と response 返却中心に整理される。`/api/lobby` の observable behavior と stale exclusion semantics は維持される
- validation: 上記 Validation Plan を満たす
- escalation: cleanup policy 見直し、public schema/DO/shared contract 変更、cross-layer 化、CI/workflow 変更、human decision が必要な仕様差分が発生した場合

## Replan Gate
- 次のいずれかが発生した場合は Phase C/D を停止し、`WAITING_FOR_HUMAN_DECISION` または `ESCALATION` に戻す
  - route thin 化のために cleanup policy 自体を変更する必要が出た場合
  - `apps/worker/src/durable/**`、`packages/shared/**`、`docs/design/**` の更新が必須化した場合
  - public response schema や lobby visibility semantics の見直しが必要になった場合
  - required validation を満たすために CI/workflow 変更が必須になった場合
