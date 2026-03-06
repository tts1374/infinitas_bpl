# Plan: codex/room-ready-pick-list

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl__codex_room_ready_pick`
- branch: `codex/room-ready-pick-list`
- base branch: `v1`
- BASE_SHA: `197440077129a503974a1332a0523223f1b13131`

## 目的
- ルーム作成直後の初期状態を `READY_CHECK` に変更する。
- `READY=NO` の参加者がいる間は `START_MATCH` を拒否する。
- `PICKING` で選曲候補を検索・ページング表示できる UI/API を追加する。

## 非目的
- WebSocket message schema の追加・変更。
- PLAYING / RESULT / watcher の仕様変更。
- ロビー一覧（KV）の仕様変更。
- 既存ルーム作成フォームや設定項目の再設計。

## 変更点
- design docs を更新し、通常フローを `READY_CHECK -> PICKING -> PLAYING -> RESULT -> CLOSED` とする。
- DO 初期化時に `READY_CHECK` と `ready_check_deadline` を設定する。
- `START_MATCH` に「参加者 2 人以上」加えて「参加中プレイヤー全員 ready=true」のガードを追加する。
- `PICKING` 用の chart search API を worker に追加し、room 設定の `play_style` / `level_filter` で事前フィルタした結果を返す。
- chart master 生成スクリプトと生成物を更新し、`title_qualifier` / `artist` / `genre` を検索対象に含める。
- client の `RoomPage` に、difficulty / level / keyword 検索と 10 件ページング付きの選曲候補一覧を追加する。

## 影響範囲
- ユーザー:
  - ルーム参加直後から READY 操作が可能になる。
  - 未 READY の参加者がいると開始できない。
  - `pick_chart_key` を直接手入力しなくても候補一覧から選曲できる。
- データ:
  - KV スキーマ変更なし。
  - worker の chart master 生成 JSON に検索用フィールドを追加する。
- 互換性:
  - 既存 WS schema は維持する。
  - HTTP API は chart search の追加のみで、既存 `/api/rooms` は維持する。
- Cloudflare:
  - DO/FSM ロジック変更あり。
  - worker の read-only API 追加あり。

## 対象ファイル / 対象レイヤ
- `docs/design/01_fsm.md`
- `docs/design/05_screen_list.md`
- `tasks/codex-room-ready-pick-list.md`
- `apps/worker/src/durable/room-state.ts`
- `apps/worker/src/durable/room-object.ts`
- `apps/worker/src/master/chart-master.ts`
- `apps/worker/src/master/generated/iidx-song-master.json`
- `apps/worker/src/services/*`
- `apps/worker/src/routes/*`
- `apps/worker/src/index.ts`
- `packages/shared/src/*` の chart search 型定義に必要な最小差分
- `apps/client/src/services/worker-api-client.ts`
- `apps/client/src/pages/RoomPage.tsx`

## テスト観点
- create -> join 直後の `room_state` が `READY_CHECK` で、deadline が設定されている。
- `READY=NO` の参加者が 1 人でもいると `START_MATCH` が拒否される。
- 全参加者 READY かつ 2 人以上で `START_MATCH` が成功する。
- chart search は room の `play_style` / `level_filter` を強制し、difficulty / level / keyword で絞り込める。
- chart search は 10 件単位でページングできる。
- 既存の `PICK_SUBMIT` は一覧選択経由でも成功する。
- `pnpm --filter @infinitas/shared typecheck`
- `pnpm --filter @infinitas/worker typecheck`
- `pnpm --filter @infinitas/client typecheck`

## ロールバック方針
- FSM に問題があれば DO 側差分を revert し、作成直後 `READY_CHECK` を元に戻す。
- chart search に問題があれば新規 API と UI をまとめて revert し、既存の手入力運用へ戻す。
- 生成 master に問題があれば生成スクリプト変更と JSON 更新をまとめて切り戻す。

## Commit Plan（コミット分割計画）
1. plan / design docs 更新。
2. DO 初期状態と `START_MATCH` ガード修正。
3. chart master search API と shared 型追加。
4. client の PICKING UI 追加。
5. master 再生成と検証。

## 検証結果
- [x] `npm ci`
- [x] `npx tsc --noEmit -p packages/shared/tsconfig.json`
- [x] `npm --workspace @infinitas/worker run typecheck`
- [x] `npm --workspace @infinitas/client run typecheck`
- [x] `npm --workspace @infinitas/client run build`
- [x] `npx wrangler deploy --dry-run`
