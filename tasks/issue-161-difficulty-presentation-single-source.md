# issue-161-difficulty-presentation-single-source

## Purpose
- client 内で difficulty presentation の正本を 1 つにまとめ、Room UI と search modal が同じ定義を参照するようにする。
- 既存の difficulty 値契約は維持したまま、presentation helper / 定数の重複だけを整理する。

## Non-goals
- difficulty 値そのものの契約変更
- `packages/shared/**` / `apps/worker/**` / `docs/design/**` 更新
- 検索条件や Room 表示仕様の再設計
- CI workflow / lockfile / dependency 変更

## Fixed decisions
- canonical source は `apps/client/src/features/room/presentation-shared.ts` に置く
- 既存 export の `getDifficultyBadgeLabel` / `getDifficultyBadgeClass` は維持し、canonical metadata を参照する wrapper にする
- `apps/client/src/pages/RoomPage.tsx` は local difficulty switch を廃止し、shared lookup で short id と class を得る
- `apps/client/src/components/SongSearchModalView.tsx` は local `DIFFICULTIES` を廃止し、shared metadata を filter button / list chip に使う
- `apps/client/src/components/RoomArena.tsx` / `apps/client/src/components/RoomBPL.tsx` は直接編集しない

## Changes
- `apps/client/src/features/room/presentation-shared.ts` に canonical difficulty metadata と lookup helper を追加する
- `apps/client/src/pages/RoomPage.tsx` の local difficulty switch / id conversion を shared helper 利用へ寄せる
- `apps/client/src/components/SongSearchModalView.tsx` の local `DIFFICULTIES` を shared metadata 参照へ置換する
- `apps/client/src/features/room/presentation-shared.test.ts` を更新し、mapping と fallback を固定する

## Impact
- Users/runtime: 表示・検索挙動は維持したまま、difficulty presentation の参照元を一本化する
- Data/compatibility: 変更なし
- Cloudflare: 影響なし

## Target Layers / Files
- layer: client
- files:
  - `apps/client/src/features/room/presentation-shared.ts`
  - `apps/client/src/features/room/presentation-shared.test.ts`
  - `apps/client/src/pages/RoomPage.tsx`
  - `apps/client/src/components/SongSearchModalView.tsx`

## Validation Plan
- `npm run lint`
- `npm run typecheck`
- `npm --workspace @infinitas/client exec tsx --test src/features/room/presentation-shared.test.ts`

## Validation Surface Note
- CI reusable validate の基準面は root `lint` + root `typecheck` のため、workspace-only typecheck ではなく root command を採用する
- touched test file は `apps/client/tsconfig.json` で除外され、`.github/workflows/validate-reusable.yml` でも未実行のため、explicit local test command を追加面として残す
- CI workflow 自体を広げる変更は今回 scope 外とする

## Rollback Plan
- canonical metadata 導入差分をまとめて revert し、`RoomPage.tsx` / `SongSearchModalView.tsx` の従来ローカル定義へ戻す

## Commit Split Plan
1. task artifact と canonical difficulty helper / test 更新
2. `RoomPage.tsx` / `SongSearchModalView.tsx` の shared 参照化
3. validation only

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- execution profile: `Standard`
- Plan Mode: `NO`
- Standard Spawn Gate: `APPLICABLE`
- High-Risk Spawn Gate: `NOT_APPLICABLE`
- No-delegate reason: client 単層 / 単一 bounded task / non-contract-sensitive で、Standard Spawn Gate 上 non-spawn acceptable

## Delegation Packet
- task label: `issue-161-difficulty-presentation-single-source`
- objective: difficulty presentation の正本を client 内で一本化し、Room UI と search modal の参照元を揃える
- in-scope files/layer: client / `presentation-shared.ts`, `presentation-shared.test.ts`, `RoomPage.tsx`, `SongSearchModalView.tsx`
- non-goals: difficulty 値 contract 変更、shared/worker/schema 変更、UI redesign、CI/依存更新
- forbidden scope: `packages/shared/**`, `apps/worker/**`, `docs/design/**`, `.github/workflows/**`, lockfile/依存更新
- expected output: canonical metadata 1 箇所から Room UI / search modal / existing badge helper が difficulty 表示情報を取得し、既存挙動を維持する
- validation: 上記 Validation Plan を満たす
- escalation: difficulty 値 contract 変更、cross-layer 化、CI/workflow 変更、仕様判断が必要化した場合

## Replan Gate
- canonical 化のために difficulty 値 contract や `CHART_DIFFICULTIES` の意味変更が必要になった場合
- `packages/shared/**` / `apps/worker/**` / `docs/design/**` 更新が必要になった場合
- 既存 fallback 挙動維持ができず、表示仕様の再決定が必要になった場合
- required validation を満たすために CI/workflow 変更が必須になった場合
