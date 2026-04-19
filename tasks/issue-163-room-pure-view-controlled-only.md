# issue-163-room-pure-view-controlled-only

## Source of Truth
- GitHub Issue `#163` "RoomArena / RoomBPL の pure view 化（controlled-only 化）"

## Purpose
- `RoomArena.tsx` / `RoomBPL.tsx` から dual-mode (`initialStatus` / `controlled`) と component-local mock / mutation を外し、`RoomPage.tsx` から渡される controlled props だけで描画する pure view に寄せる。
- `WAITING / SELECTING / PLAYING / RESULT / CLOSED` の見た目と操作を維持したまま、copy / timer / search / cut-in / fallback action の責務を `RoomPage.tsx` へ一本化する。

## Non-goals
- UI デザイン変更
- `RoomPage` の state 解釈変更
- 新しい standalone dev harness 追加
- `apps/worker/**` / `packages/shared/**` / `docs/design/**` 更新
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
  - stateful GitHub write-back
- next unlock condition: user が明示的に Phase C implementation を許可する

## Fixed decisions
- `RoomArena.tsx` / `RoomBPL.tsx` は controlled props を受け取る pure view とし、component-local の fallback state / timer / mock progression / mutation は削除対象とする。
- `RoomPage.tsx` は visual scenario を含む room presentation の責務オーナーとして、copy feedback、search / cut-in 開閉、擬似進行、action wiring を引き続き保持する。
- `WAITING / SELECTING / PLAYING / RESULT / CLOSED` の表示意味と `RoomPage` の state 解釈は維持し、repo 内参照は controlled-only surface に揃える。
- visual scenario は引き続き `RoomPage.tsx` 経由で成立させ、別ハーネスの追加は行わない。

## Changes
- `apps/client/src/components/RoomArena.tsx` を controlled-only render surface に整理し、`initialStatus` 起点の local state と fallback mutation を除去する。
- `apps/client/src/components/RoomBPL.tsx` を controlled-only render surface に整理し、dual-mode と component-local mock progression を除去する。
- `apps/client/src/pages/RoomPage.tsx` で pure view 化後の props / action ownership を引き受け、ARENA/BPL visual scenario parity を維持する。

## Impact
- Users/runtime: 既存 room UI の見た目と操作を維持したまま、presentation responsibility が `RoomPage` へ一本化される。
- Data/compatibility: worker/shared/public contract 変更なし。repo 内の client component API 整理に留める。
- Cloudflare: 影響なし。

## Target Layers / Files
- layer: client
- files:
  - `apps/client/src/components/RoomArena.tsx`
  - `apps/client/src/components/RoomBPL.tsx`
  - `apps/client/src/pages/RoomPage.tsx`

## Validation Plan
- `npm run lint`
- `npm run typecheck`
- `npm run build:client`
- ARENA/BPL visual scenario で `WAITING / SELECTING / PLAYING / RESULT / CLOSED` parity を確認する
- repo 内の in-scope callsite で dual-mode API 参照が残っていないことを grep / typecheck で確認する

## Validation Surface Note
- reusable validate の基準面は root `npm run lint` + root `npm run typecheck` であり、Issue 記載の workspace-only typecheck より広い面を先に採用する。
- touched files は presentational component / page で、`apps/client` の既存 test entrypoint では直接カバーされないため、`npm run build:client` と visual scenario parity 確認を required evidence とする。
- reusable validate の `test:client-stats` / `test:worker` は repo-wide baseline だが、この task の touched UI surface を直接は検証しない。必要なら implementation turn で root baseline 実行可否と skip reason を残す。

## Rollback Plan
- pure view 化差分をまとめて revert し、`RoomPage.tsx` 側の不足 wiring を見直した上で dual-mode surface を一時復旧する。

## Commit Split Plan
1. `tasks/issue-163-room-pure-view-controlled-only.md` で境界と kickoff ceiling を固定する
2. `RoomArena.tsx` / `RoomBPL.tsx` の controlled-only 化と `RoomPage.tsx` の責務集約を 1 つの bounded 実装差分で行う
3. validation only

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- execution profile: `Standard`
- Plan Mode: `NO`
- Standard Spawn Gate: `APPLICABLE`
- High-Risk Spawn Gate: `NOT_APPLICABLE`
- No-delegate reason: client 単層 / 単一 bounded task / non-contract-sensitive で non-spawn acceptable。加えて current turn ceiling は kickoff-only のため、この turn では implementation spawn を行わない。

## Delegation Packet
- task label: `issue-163-room-pure-view-controlled-only`
- objective: `RoomArena` / `RoomBPL` を controlled-only pure view に寄せ、擬似進行と fallback action の責務を `RoomPage` へ一本化する
- in-scope files/layer: client / `apps/client/src/components/RoomArena.tsx`, `apps/client/src/components/RoomBPL.tsx`, `apps/client/src/pages/RoomPage.tsx`
- non-goals: UI redesign、`RoomPage` state semantics 変更、standalone harness 追加、worker/shared/docs-design/CI/依存更新
- forbidden scope: `apps/worker/**`, `packages/shared/**`, `docs/design/**`, `.github/workflows/**`, lockfile / dependency 更新
- expected output: repo 内の room presentation surface は controlled-only に揃い、`RoomPage` 経由の WAITING / SELECTING / PLAYING / RESULT / CLOSED parity が維持される
- validation: 上記 Validation Plan を満たす
- escalation: `RoomPage` state 解釈変更、cross-layer 化、WS/shared contract 変更、visual scenario contract の再定義、CI/workflow 変更、human decision が必要な仕様差分が発生した場合

## Replan Gate
- pure view 化のために `RoomPage` の state semantics や host/non-host 表示境界を変更する必要が出た場合
- `apps/worker/**` / `packages/shared/**` / `docs/design/**` 更新が必須化した場合
- visual scenario parity を保つために standalone harness 追加や別 surface 導入が必要になった場合
- required validation を満たすために CI/workflow 変更が必須になった場合
