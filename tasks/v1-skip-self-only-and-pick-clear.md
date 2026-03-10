# v1-skip-self-only-and-pick-clear

## 目的
- RESULT -> LOBBY -> PICKING の再遷移時に `PICK MUSIC` 入力値が残る問題を解消する。
- SKIP 操作を「自身のみ可能」に統一し、他者（HOST含む）への代理 SKIP を不可にする。

## 非目的
- WebSocket message schema の変更
- round 集計ロジックや勝敗判定ロジックの変更
- force advance 仕様の変更

## 変更点
- `PICK MUSIC` モーダル表示開始時に検索入力・絞り込み入力をクリアする。
- クライアントUIから `skipHostAssign` 呼び出しを削除し、`skipSelf` のみ実行する。
- Worker で `SKIP_HOST_ASSIGN` を拒否し、自己 SKIP のみ許可する。
- 規範仕様ドキュメント（FSM）を現行仕様に合わせて更新する。

## 影響範囲
- ユーザー: PICK MUSIC の入力が毎回初期化される
- 互換性: 旧クライアントからの `SKIP_HOST_ASSIGN` は `INVALID_STATE` として拒否される
- Cloudflare: DO 権限制御（SKIP_HOST_ASSIGN の扱い）を変更

## 対象ファイル / 対象レイヤ
- Client:
  - `apps/client/src/pages/RoomPage.tsx`
- Worker:
  - `apps/worker/src/durable/room-object.ts`
- Docs:
  - `docs/design/01_fsm.md`
  - `docs/design/07_constants.md`（必要時注記）

## テスト観点
- PICKING 画面遷移時に検索入力（keyword / diff / level）が空で表示される
- 自分以外のスロットに対する SKIP 操作が送信されない
- `SKIP_HOST_ASSIGN` が Worker 側で拒否される

## ロールバック方針
- `RoomPage` の入力初期化 effect と `onMockSkip` 変更を戻す
- `room-object` の `SKIP_HOST_ASSIGN` 拒否を戻す
- docs を元に戻す

## コミット分割計画
1. client UI 修正（PICK MUSIC クリア + self skip only）
2. worker 制御修正（SKIP_HOST_ASSIGN 拒否）
3. docs 更新

## 実行チェックリスト
- [x] 設計確認（FSM, constants）
- [x] 影響範囲特定（client / worker）
- [x] 実装
- [x] テスト
- [x] 回帰確認
- [x] ドキュメント更新
