# Plan: codex/pr4-ready-check

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_pr4_ready_check`
- branch: `codex/pr4-ready-check`
- base branch: `v1`
- BASE_SHA: `076ad15906af181a8cd9e28610a3de200a2596c3`

## 目的
- `docs/design/09_implementation_plan.md` の PR-4（READY_CHECK）を実装する。
- Durable Object 上で開始準備フェーズ、開始ガード、READY 状態同期、20分 TTL 解散を成立させる。

## 非目的
- PICKING/PLAYING/RESULT の進行、ラウンド構築、集計実装（PR-5以降）。
- WebSocket schema や shared 型の大幅変更。
- クライアント UI 実装や watcher 実装。

## 変更点
- DO 内状態に `READY_CHECK` 用の遷移と deadline 管理を追加。
- `READY_CHECK_OPEN` をホスト限定で受理し、`ready_check_deadline` を設定する。
- `READY_SET` で参加者の ready 状態を更新し、全員へ反映する。
- `START_MATCH` をホスト限定かつ `players >= 2` かつ `room_state=READY_CHECK` のときのみ受理する。
- `ready_check_ttl` 超過時にルームを `CLOSED` へ遷移させ、解散を通知する。
- READY_CHECK 中の join/leave を維持しつつ、状態スナップショットへ deadline を反映する。

## 影響範囲
- ユーザー:
  - ホストが LOBBY から READY_CHECK を開始できる。
  - READY 状態が全員に同期される。
  - 2人未満では START が拒否される。
  - 20分放置でルームが解散する。
- データ:
  - KV スキーマ変更なし。
  - DO メモリ上の room state/timer のみ変更。
- 互換性:
  - 既存 HTTP API は変更しない。
  - shared schema は既存定義の利用に留め、破壊変更は入れない。
- Cloudflare resources:
  - 追加リソースなし。
  - DO ロジックのみ変更。

## 対象ファイル / 対象レイヤ
- `apps/worker/src/durable/room-state.ts`
- `apps/worker/src/durable/room-object.ts`
- 必要最小限で `tasks/codex-pr4-ready-check.md`

## テスト観点
- `READY_CHECK_OPEN` はホストのみ成功する。
- `READY_SET` が自分の ready 状態を更新し、`ROOM_UPDATED` と `READY_STATUS_CHANGED` が送られる。
- `START_MATCH` は READY_CHECK 中かつ 2人以上のときのみ成功する。
- `players < 2` では `START_MATCH_REJECTED` または `ERROR` で拒否される。
- READY_CHECK 開始後 20分超過で `ROOM_CLOSED` が配信される。
- `npm --workspace @infinitas/worker run typecheck`

## ロールバック方針
- READY_CHECK ロジックに問題がある場合は PR-4 差分を revert し、PR-3 の LOBBY 状態へ戻す。
- ルーム close 挙動に問題がある場合は timer/close 周りのみ個別切り戻しできるよう局所差分に留める。

## Commit Plan（コミット分割計画）
1. PR-4 plan 追加（本ファイル）。
2. `room-state.ts` に READY_CHECK 状態・ガード・deadline 管理を追加。
3. `room-object.ts` に READY_CHECK メッセージ処理と timeout close を追加。
4. typecheck 実行と最終調整。
