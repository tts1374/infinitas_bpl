# Plan: codex/pr-6-playing-basic

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_arena_pr6_playing_basic`
- branch: `codex/pr-6-playing-basic`
- base branch: `v1`
- BASE_SHA: `26995f726b66736c25ce25b9d97f0973a46b88dc`

## 目的
- `docs/design/09_implementation_plan.md` の PR-6（PLAYING 基本進行）を実装する。
- Durable Object 上で `RESULT_SUBMIT`、`current_round`、`round_soft_ttl`、`match_ttl`、`accept_window=0`、初回採用のみを成立させる。

## 非目的
- `SKIP_SELF` / `SKIP_HOST_ASSIGN` / `FORCE_ADVANCE` / `RESULT_READY`（PR-7 以降）。
- クライアント UI / watcher 実装。
- docs/design の規範仕様変更。

## 変更点
- `room-state.ts` に PLAYING 用の提出採用、expected 一致判定、ラウンド完了判定、soft ttl / match ttl の進行ロジックを追加する。
- `room-object.ts` に `RESULT_SUBMIT` の payload 検証、`PLAYER_ROUND_CONFIRMED` / `ROUND_ENDED` / 次ラウンド `ROUND_BEGIN` / `ROOM_UPDATED` 配信と DO alarm 運用を追加する。
- PICKING から開始済みの `ROUND_BEGIN` を前提に、PLAYING から RESULT への最小遷移を成立させる。

## 影響範囲
- ユーザー:
  - 当該ラウンドの `expected_key` と一致した提出だけが初回採用される。
  - mismatch や重複提出は拒否される。
  - `round_soft_ttl` 超過で未提出者が `TIMEOUT` になり次ラウンドへ進む。
  - `match_ttl` 超過で未確定者を `TIMEOUT` にして `RESULT` へ遷移する。
- データ:
  - DO メモリ上の `current_round`、`frozen_rounds.started_at`、確定済み submission 情報、`result_deadline` が更新される。
- 互換性:
  - 既存 shared schema の範囲で実装し、破壊的変更は行わない。
- Cloudflare resources:
  - Durable Object alarm と PLAYING ロジックのみ変更。

## 対象ファイル / 対象レイヤ
- `apps/worker/src/durable/room-state.ts`
- `apps/worker/src/durable/room-object.ts`
- `tasks/codex-pr-6-playing-basic.md`

## テスト観点
- `RESULT_SUBMIT` は `room_state=PLAYING` かつ `round_index == current_round_index` のときのみ通る。
- `observed_key != expected_key` は採用されない。
- 同一プレイヤーの 2 回目以降の提出は採用されない。
- 全員確定で `ROUND_ENDED` 後に次ラウンド `ROUND_BEGIN` または `RESULT` へ遷移する。
- `round_soft_ttl` 超過で未確定者が `TIMEOUT` になる。
- `match_ttl` 超過で進行中ラウンドも含めて未確定者を `TIMEOUT` にして `RESULT` へ遷移する。
- `npm --workspace @infinitas/worker run typecheck`
- `npm run typecheck`

## ロールバック方針
- PR-6 差分を revert し、PR-5.5 の PICKING -> 初回 `ROUND_BEGIN` 実装へ戻す。

## Commit Plan（コミット分割計画）
1. PR-6 plan 追加（本ファイル）。
2. `room-state.ts` に PLAYING 提出とタイマー進行ロジックを追加。
3. `room-object.ts` に `RESULT_SUBMIT` 処理と alarm 配信を追加。
4. typecheck 実行と最終調整。

## 検証結果
- `npm ci`
- `npm --workspace @infinitas/worker run typecheck`
- `npm run typecheck`
