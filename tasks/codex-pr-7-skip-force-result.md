# Plan: codex/pr-7-skip-force-result

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_pr7`
- branch: `codex/pr-7-skip-force-result`
- base branch: `v1`
- BASE_SHA: `76d9af1636e4c686f8e9cb7da0e89faad07c9f6f`

## 目的
- `docs/design/09_implementation_plan.md` の PR-7（SKIP / FORCE_ADVANCE / RESULT 集計）を実装する。
- Durable Object 上で `SKIP_SELF`、`SKIP_HOST_ASSIGN`、`host_skip_unlock_seconds`、`FORCE_ADVANCE`、ARENA/BPL 集計、`RESULT_READY` を成立させる。

## 非目的
- クライアント UI / watcher 実装。
- docs/design の規範仕様変更。
- PR-8 以降の画面表示詳細やローカル保存強化。

## 変更点
- `room-state.ts` に自分 SKIP、4分経過後のホスト代理 SKIP、強制進行、ARENA/BPL 集計と RESULT payload 生成を追加する。
- `room-object.ts` に `SKIP_SELF` / `SKIP_HOST_ASSIGN` / `FORCE_ADVANCE` ハンドラ、`FORCE_ADVANCE_APPLIED` / `RESULT_READY` 配信、alarm の RESULT close を追加する。
- 必要であれば shared の snapshot / WS 型へ RESULT 表示用の最小構造を追加する。

## 影響範囲
- ユーザー:
  - 自分の未確定ラウンドを `UNOWNED | TECH | OTHER` 理由付きで SKIP できる。
  - ラウンド開始から 240 秒経過後、ホストが未確定プレイヤーへ代理 SKIP を付与できる。
  - ホストの `FORCE_ADVANCE` で未確定者が `TIMEOUT` となり次ラウンドまたは RESULT へ進む。
  - RESULT で ARENA/BPL の集計済み結果を受け取れる。
- データ:
  - DO メモリ上の round confirmed、submitted_by、result summary が更新される。
- 互換性:
  - 既存 FSM / WS schema の範囲で拡張し、破壊的変更は避ける。
- Cloudflare resources:
  - Durable Object の WS 制御と alarm 運用のみ変更。

## 対象ファイル / 対象レイヤ
- `apps/worker/src/durable/room-state.ts`
- `apps/worker/src/durable/room-object.ts`
- `packages/shared/src/models/*` または `packages/shared/src/ws/*`（必要時のみ）
- `tasks/codex-pr-7-skip-force-result.md`

## テスト観点
- `SKIP_SELF` は PLAYING 中の当該ラウンド未確定本人のみ成功する。
- `SKIP_HOST_ASSIGN` はホストのみ、4分経過後かつ target 未確定のときのみ成功する。
- `FORCE_ADVANCE` はホストのみ成功し、未確定者を `TIMEOUT` にする。
- ARENA は順位に応じて `2/1/0` 配点、同点同順位・順位飛ばしで集計される。
- BPL は BO3 の各ラウンド勝者に 1 勝を付与し、先に 2 勝または終了時点の勝ち数で結果が決まる。
- `RESULT_READY` が RESULT 遷移時に返り、`npm --workspace @infinitas/worker run typecheck` と `npm run typecheck` が通る。

## ロールバック方針
- PR-7 差分を revert し、PR-6 の PLAYING 基本進行に戻す。

## Commit Plan（コミット分割計画）
1. PR-7 plan 追加（本ファイル）。
2. `room-state.ts` に skip / force advance / result aggregation を追加。
3. `room-object.ts` と必要最小限の shared 型を更新。
4. typecheck 実行と最終調整。

## 検証結果
- 未実施
