# Plan: codex/pr-8-client-min-ui

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_pr8_client_ui`
- branch: `codex/pr-8-client-min-ui`
- base branch: `v1`
- BASE_SHA: `ee7fb47eceaa75dc1b3fc8180b6c6bdbd7741f96`

## 目的
- `docs/design/09_implementation_plan.md` の PR-8（クライアント最小UI）を実装する。
- `apps/client` に Tauri 2 + React + TypeScript + Vite の最小起動構成を追加し、Settings/Lobby/Room/ErrorDialog、HTTP/WS 接続、ローカル store を成立させる。

## 非目的
- Rust watcher / parser 実装（PR-9以降）。
- 音声通知、ローカル結果JSON保存、ROOM_STATE_LOST復帰強化（PR-12以降）。
- Worker / DO / shared の契約変更。

## 変更点
- `apps/client` に Vite + React の最小起動構成、Tauri 2 の最小 `src-tauri` 雛形、ビルド設定を追加する。
- `SettingsPage`、`LobbyPage`、`RoomPage`、`ErrorDialog` と、それらを支える `settingsStore`、`lobbyStore`、`roomStore`、HTTP client、WebSocket client を実装する。
- ルーム作成 / 一覧取得 / 参加 / READY_CHECK / START / PICK / SKIP / FORCE_ADVANCE / STATE同期など、既存 Worker/DO 契約で扱える操作を最小UIから実行できるようにする。
- クライアント用依存関係と root typecheck 対象を追加し、client build / typecheck が通る状態にする。

## 影響範囲
- ユーザー:
  - ローカル設定保存、ロビー一覧確認、ルーム作成/参加、RoomState ごとの画面遷移が可能になる。
- データ:
  - ブラウザ/Tauri 側 localStorage に設定と接続先情報を保存する。
- 互換性:
  - Worker/DO/shared の既存 schema をそのまま利用し、互換性変更は行わない。
- Cloudflare:
  - 新規リソース変更なし。既存 HTTP / WS API を client から利用するのみ。

## 対象ファイル / 対象レイヤ
- `apps/client/**`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tasks/codex-pr-8-client-min-ui.md`

## テスト観点
- client の typecheck / build が通る。
- root `npm run typecheck` が client の `.tsx` を含めて通る。
- ロビー一覧取得、ルーム作成、join 後の `ROOM_JOIN_ACCEPTED` / `ROOM_UPDATED` で store が更新される。
- `RoomState` ごとに `RoomPage` の表示と操作が切り替わる。
- エラー系 server message が `ErrorDialog` に表示される。

## ロールバック方針
- PR-8差分を revert し、`apps/client` を PR-7 時点の最小 smoke 状態へ戻す。

## Commit Plan（コミット分割計画）
1. PR-8 plan 追加（本ファイル）。
2. client scaffold と依存追加（React/Vite/Tauri、tsconfig/build設定）。
3. settings/lobby/room/error dialog と HTTP/WS/store 実装。
4. build/typecheck 検証と最終調整。

## 検証結果
- [x] `npm install`
- [x] `npm --workspace @infinitas/client run typecheck`
- [x] `npm --workspace @infinitas/client run build`
- [x] `npm run typecheck`
- [ ] `cargo check`
  - この実行環境では `cargo` コマンド自体が存在せず、Tauri Rust 側のコンパイル確認は未実施。
