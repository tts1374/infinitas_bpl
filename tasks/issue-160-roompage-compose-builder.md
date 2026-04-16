# issue-160-roompage-compose-builder

## Purpose
- `RoomPage` に残る ARENA/BPL の non-contract-sensitive compose props 組み立てを helper / builder へ寄せ、差分ズレ回帰リスクを下げる。
- `roomStatus` / `roundCount` / `resultTimer` の既存意味を変えずに、client-only の reviewable な整理へ留める。

## Non-goals
- `roomStatus` / `roundCount` / `resultTimer` / `CloseReason` の意味変更や共通化
- `RoomArena.tsx` / `RoomBPL.tsx` の presentational contract 変更
- worker/shared/docs-design/依存更新
- UI デザイン変更

## Fixed decisions
- `roomStatus` / `resultTimer` / `roundCount` は引き続き `RoomPage.tsx` で導出し、builder へ opaque input として渡す
- 共通化対象は non-contract-sensitive compose 領域のみに限定する
- 新規 helper は `apps/client/src/features/room/room-page-compose.ts` に置く
- テストは `apps/client/src/features/room/room-page-compose.test.ts` を追加し、workspace script は増やさない

## Changes
- `apps/client/src/features/room/room-page-compose.ts` を追加し、ARENA/BPL 共通の compose 入力から shared props を組み立てる internal helper と `buildArenaControlledProps` / `buildBplControlledProps` を実装する
- `apps/client/src/pages/RoomPage.tsx` で ARENA/BPL の controlled props 組み立てに builder を使い、mode 固有 payload のみを inline に残す
- `apps/client/src/features/room/room-page-compose.test.ts` を追加し、copy flags / lobbyTimer / action wiring / optional `onRemakeStage` を中心に builder の回帰を固定する

## Impact
- Users/runtime: 表示・操作挙動は維持したまま、`RoomPage` の重複 compose ロジックを縮小する
- Data/compatibility: 変更なし
- Cloudflare: 影響なし

## Target Layers / Files
- layer: client
- files:
  - `apps/client/src/pages/RoomPage.tsx`
  - `apps/client/src/features/room/room-page-compose.ts`
  - `apps/client/src/features/room/room-page-compose.test.ts`

## Validation Plan
- `npm --workspace @infinitas/client run typecheck`
- `npm run lint`
- `npm --workspace @infinitas/client exec tsx --test src/features/room/room-page-compose.test.ts src/features/room/presentation-shared.test.ts`
- `npm --workspace @infinitas/client exec tsx --test src/dev/visual-scenarios.test.ts`
- ARENA/BPL visual scenario で `WAITING / SELECTING / PLAYING / RESULT / CLOSED` の copy feedback / lobby timer / disable flags / action wiring parity を確認する

## Rollback Plan
- `room-page-compose.ts` 導入差分をまとめて revert し、`RoomPage.tsx` 内の従来 compose 実装へ戻す

## Commit Split Plan
1. `tasks` artifact と builder / test 追加
2. `RoomPage.tsx` の builder 適用
3. validation only

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- execution profile: `Standard`
- Plan Mode: `NO`
- Standard Spawn Gate: `APPLICABLE`
- High-Risk Spawn Gate: `NOT_APPLICABLE`

## Delegation Packet
- task label: `issue-160-roompage-compose-builder`
- objective: `RoomPage` の ARENA/BPL non-contract-sensitive compose props を builder へ抽出し、現行挙動を維持する
- in-scope files/layer: client / `RoomPage.tsx`, `room-page-compose.ts`, `room-page-compose.test.ts`
- non-goals: contract-sensitive derivation 変更、presentational contract 変更、worker/shared/docs-design/依存更新
- forbidden scope: `apps/worker/**`, `packages/shared/**`, `docs/design/**`, `apps/client/src/components/RoomArena.tsx`, `apps/client/src/components/RoomBPL.tsx`, lockfile/依存更新
- expected output: `RoomPage.tsx` の shared compose 部が builder 利用へ置換され、mode 固有差分のみ inline に残る
- validation: 上記 Validation Plan を満たす
- escalation: `roomStatus` / `roundCount` / `resultTimer` / `CloseReason` の意味変更、cross-layer 化、controlled prop contract 拡張、仕様判断が必要化した場合

## Replan Gate
- 次のいずれかが発生した場合は Phase C/D を停止し、`WAITING_FOR_HUMAN_DECISION` または `ESCALATION` に戻す
  - contract-sensitive derivation の意味変更が必要になった場合
  - `apps/worker` / `packages/shared` / `docs/design/*` の更新が必要になった場合
  - presentational contract 拡張なしでは parity を維持できない場合
