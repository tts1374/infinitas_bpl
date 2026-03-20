# v1-reconnect-window-20s-player-already-connected

## 目的
- 一時切断時の再接続成功率を上げるため、ホスト再接続猶予を 20 秒へ延長する。
- `PLAYER_ALREADY_CONNECTED` を一時エラーとして扱い、再接続を継続できるようにする。
- 再接続失敗時に、ユーザーへ明確な終端導線（再試行 / 一覧に戻る）を提供する。

## 非目的
- WebSocket schema の追加変更（期限時刻の新規 payload 追加など）
- ロビー一覧 API の仕様変更
- host 権限や FSM の責務分割変更

## 変更点
- `REJOIN_COOLDOWN_SECONDS` を `10` -> `20` に変更。
- `ROOM_JOIN_REJECTED: PLAYER_ALREADY_CONNECTED` 受信時に即失敗せず、再接続ウィンドウ内で再試行。
- 再接続中の接続詳細を「残り秒数」付きで表示。
- 再接続ウィンドウ超過時に、`再試行` と `一覧に戻る` を選べるダイアログを表示。

## 影響範囲
- ユーザー: 一時切断からの復帰しやすさが向上
- データ: 永続化フォーマット変更なし
- 互換性: WS schema 変更なし
- Cloudflare: DO の host reconnect grace タイマー挙動が 20 秒基準になる

## 対象ファイル / 対象レイヤ
- Shared constants:
  - `packages/shared/src/constants/timers.ts`
- Worker FSM tests:
  - `apps/worker/src/durable/room-state.test.mjs`
- Client reconnect/UI:
  - `apps/client/src/stores/room-store.ts`
  - `apps/client/src/components/ErrorDialog.tsx`
  - `apps/client/src/app/App.tsx`
- Design docs:
  - `docs/design/01_fsm.md`
  - `docs/design/07_constants.md`

## テスト観点
- host 切断後 20 秒未満では `HOST_DISCONNECTED` クローズにならない
- 20 秒超過で `HOST_DISCONNECTED` クローズになる
- `PLAYER_ALREADY_CONNECTED` 受信時に自動再試行される
- 再接続失敗時に「再試行 / 一覧に戻る」導線が表示される

## ロールバック方針
- `REJOIN_COOLDOWN_SECONDS` を 10 秒へ戻す
- `PLAYER_ALREADY_CONNECTED` の再試行処理を削除して従来挙動へ戻す
- 追加 UI 導線を削除して従来ダイアログへ戻す

## コミット分割計画
1. 定数と設計ドキュメント更新（20 秒化）
2. worker テスト調整
3. client 再接続制御と終端導線 UI 追加

