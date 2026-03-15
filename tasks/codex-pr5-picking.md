# Plan: codex/pr5-picking

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_arena_pr5_picking`
- branch: `codex/pr5-picking`
- base branch: `v1`
- BASE_SHA: `08dd9c805197e9e59e3082f88ab095b0ace5a4fe`

## 目的
- `docs/design/09_implementation_plan.md` の PR-5（PICKING）を実装する。
- Durable Object 上で `PICK_SUBMIT`、先着順保持、重複解決、`frozen_rounds` 生成、`PICKING -> PLAYING` 遷移を成立させる。

## 非目的
- `RESULT_SUBMIT` 以降の PLAYING 集計や TTL 運用（PR-6 以降）。
- client UI / watcher 実装。
- docs/design の規範仕様変更。

## 変更点
- `room-state.ts` に PICK 提出状態、受理時刻、重複解決、凍結ラウンド生成、初回 `ROUND_BEGIN` 開始を追加する。
- `room-object.ts` に `PICK_SUBMIT` の payload 検証、`PICK_ACCEPTED` / `PICK_REJECTED` / `PICK_FROZEN` / `ROUND_BEGIN` 配信を追加する。
- `START_MATCH` 成功時に PICKING 用の内部状態を初期化し、BPL は 2 人開始のみ許可する。

## 影響範囲
- ユーザー:
  - READY_CHECK 後に各プレイヤーが 1 譜面ずつ指名できる。
  - 同一譜面の後着指名は DO 側で別 key に差し替えられる。
  - 全員の指名完了時に凍結リストと初回ラウンド開始が配信される。
- データ:
  - DO メモリ上の `picks` / `frozen_rounds` / `current_round` が更新される。
- 互換性:
  - 既存 WS schema の範囲で実装し、shared の破壊変更は行わない。
- Cloudflare resources:
  - Durable Object ロジックのみ変更。

## 対象ファイル / 対象レイヤ
- `apps/worker/src/durable/room-state.ts`
- `apps/worker/src/durable/room-object.ts`
- `tasks/codex-pr5-picking.md`

## テスト観点
- `START_MATCH` 後に `PICKING` へ遷移する。
- 各プレイヤーが 1 回だけ `PICK_SUBMIT` できる。
- 同一譜面重複時に後着のみ差し替えられる。
- ARENA で参加人数分の `frozen_rounds` が生成される。
- BPL で 3 ラウンド固定の `frozen_rounds` が生成される。
- 凍結後に `PLAYING` と `current_round` が開始される。
- `npm --workspace @infinitas/worker run typecheck`
- `npm run typecheck`

## ロールバック方針
- PR-5 差分を revert し、PR-4 の READY_CHECK 実装へ戻す。

## Commit Plan（コミット分割計画）
1. PR-5 plan 追加（本ファイル）。
2. `room-state.ts` に PICKING 状態遷移と凍結ロジックを追加。
3. `room-object.ts` に PICKING メッセージ処理を追加。
4. typecheck 実行と最終調整。

## 検証結果
- `npm ci`
- `npm --workspace @infinitas/worker run typecheck`
- `npm run typecheck`
