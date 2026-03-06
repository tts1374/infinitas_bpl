# Plan: codex/pr5-5-master-reference

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_pr55_master_reference`
- branch: `codex/pr5-5-master-reference`
- base branch: `v1`
- BASE_SHA: `06b0be55389fbe403abd74d8298c6656853630ce`

## 目的
- `docs/design/09_implementation_plan.md` の PR-5.5 を実装する。
- Durable Object から read-only の譜面マスタを参照し、`pick_chart_key` と BPL random 1 を実譜面ベースで確定できるようにする。

## 非目的
- client の選曲 UI 実装。
- `RESULT_SUBMIT` 以降の PLAYING 集計実装。
- docs/design の規範仕様変更。

## 変更点
- `iidx_all_songs_master` release から Worker 用 read-only snapshot を生成するスクリプトを追加する。
- Worker 配下に譜面マスタの snapshot / loader / resolver を追加する。
- `room-state.ts` で `pick_chart_key` を master から実譜面解決し、重複差し替えと BPL random 1 を master 候補から選ぶ。
- `room-object.ts` から resolver 付き `RoomLobbyState` を初期化する。

## 影響範囲
- ユーザー:
  - `pick_chart_key` から実譜面が解決され、`frozen_rounds` の表示と `expected_key` が master 由来になる。
  - BPL の random 1 がプレースホルダではなく実譜面で確定する。
- データ:
  - Worker バンドルに read-only の譜面 snapshot が追加される。
- 互換性:
  - 既存 `pick_chart_key` 形式は後方互換で受理しつつ、解決結果は master 優先にする。
- Cloudflare resources:
  - Durable Object ロジックと Worker バンドル内静的データのみ変更。KV / DO schema 変更なし。

## 対象ファイル / 対象レイヤ
- `apps/worker/src/durable/room-state.ts`
- `apps/worker/src/durable/room-object.ts`
- `apps/worker/src/master/*`
- `scripts/*`（master snapshot 生成）
- `tasks/codex-pr5-5-master-reference.md`

## テスト観点
- Worker が read-only master snapshot を import できる。
- `pick_chart_key` から active な INFINITAS 譜面を解決できる。
- 同一譜面重複時に未使用候補へ差し替えられる。
- BPL random 1 が未使用の実譜面で確定する。
- `frozen_rounds.expected_key` / `display` が master 由来で埋まる。
- `npm --workspace @infinitas/worker run typecheck`
- `npm run typecheck`

## ロールバック方針
- PR-5.5 差分を revert し、PR-5 のプレースホルダ凍結ロジックへ戻す。

## Commit Plan（コミット分割計画）
1. PR-5.5 plan と Worker 用 master snapshot 導線を追加。
2. Worker master loader / resolver を追加。
3. `room-state.ts` と `room-object.ts` を master 解決へ切り替え。
4. snapshot 生成と typecheck 実行で仕上げる。
