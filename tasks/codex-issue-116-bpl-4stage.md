# codex-issue-116-bpl-4stage

## Purpose
- 既存 BPL（3 STAGE）に加えて、2人が2曲ずつ選曲する BPL 4 STAGE モードを追加する。
- Room の進行、集計、クライアント表示を 4 STAGE 前提で一貫させる。

## Non-goals
- ARENA モードの進行仕様変更。
- 監視ソース I/O（watcher/parser）仕様変更。
- Cloudflare のデプロイ設定、依存関係更新。

## Changes
- 規範 design doc の BPL 仕様を 4 STAGE 追加に合わせて更新する。
- worker の BPL round 構築/進行/集計を 4 STAGE へ対応し、既存 3 STAGE 回帰を防ぐ。
- client のモード表示・ステージ枠・履歴/結果表示を 4 STAGE と整合させる。
- 必要最小限のテストを更新し、BPL 4 STAGE の成立を検証する。

## Impact
- Users: BPL で 4 曲（各プレイヤー2曲）の対戦が可能になる。
- Data: BPL の round 配列長と関連表示データが 4 STAGE 前提になる。
- Compatibility: BPL 進行契約が変更されるため、design doc と実装を同時に整合させる。
- Cloudflare: Durable Object の room 進行ロジックのみ変更（route/KV 契約は変更しない）。

## Target Files / Layers
- Files:
  - `docs/design/01_fsm.md`
  - `docs/design/03_data_model.md`
  - `docs/design/07_constants.md`
  - `packages/worker/src/room-state.ts`
  - `packages/worker/test/*bpl*`（必要最小限）
  - `apps/client/src/pages/RoomPage.tsx`
  - `apps/client/src/components/RoomBPL.tsx`（必要な場合のみ）
- Layers:
  - docs / worker / client（必要なら shared）

## Test Focus
- QUALITY section 1: 対象パッケージの build/lint/test 実行。
- QUALITY section 2: 目的外 diff・encoding/LF ノイズが無いこと。
- QUALITY section 3: BPL の round 進行、終了判定、host 権限、idempotency 影響なしを確認。
- QUALITY section 4: 監視ソース仕様に変更なし（not required）。
- QUALITY section 5: BPL 4 STAGE の最小 E2E 相当（room flow）を確認。

## Rollback Plan
- worker/client の BPL 4 STAGE 変更コミットを revert し、3 STAGE の既存挙動へ戻す。
- docs を同時に revert して仕様と実装の不一致を解消する。

## Commit Split Plan
1. docs: BPL 4 STAGE 契約更新（FSM/Data model/Constants）
2. worker: BPL 4 STAGE round 構築・進行・集計と関連テスト更新
3. client: BPL 4 STAGE 表示・文言・履歴/結果整合
4. tests/chore: 必要最小限の検証調整（分離が必要な場合のみ）

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
