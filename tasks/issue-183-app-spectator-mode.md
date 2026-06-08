# issue-183-app-spectator-mode

## Purpose
- Issue #183 に基づき、既存 spectator WS contract を使ったアプリ版観戦モードを追加する。

## Non-goals
- WS schema / shared model / Worker spectator authority は変更しない。
- Web 観戦ページ削除は `tasks/issue-183-remove-web-spectate.md` で扱う。

## Current Request Boundary
- Ceiling: implementation ready after C Kickoff
- Allowed outputs now: task artifact creation and C Kickoff in the next C〜D turn
- Forbidden outputs now: C Kickoff 前の実装、actual delegation execution record なしの実装、scope 外変更
- Next unlock condition: 後続 C〜D ターンで C Kickoff を出力し、Spawn Gate を満たすこと

## Changes
- `apps/client` に観戦用 view / entry button / Room ID + Join Code form / read-only live display / disconnect を追加する。
- app spectator connection は `ROOM_JOIN.payload.session_kind="SPECTATOR"` を送信し、player/source/capability payload を送らない。
- Web 観戦ページの状態表示ロジックを参考に、client-local helper/component として必要最小限に移す。
- 観戦中は room/player store の player join state と混同しない。

## Impact
- Users: アプリ内で観戦でき、Web 観戦導線に依存しなくなる。
- Data: 永続データ変更なし。
- Compatibility: 既存 spectator contract の消費のみ。schema 変更なし。
- Cloudflare: Worker resource/config 変更なし。

## Target Files / Layers
- Files: `apps/client/src/app/App.tsx`, `apps/client/src/components/AppSidebar.tsx`, `apps/client/src/services/ws-client.ts` または新規 client-local spectator service/component/test
- Layers: client

## Test Focus
- spectator join payload が `session_kind="SPECTATOR"` であること。
- PRIVATE join_code が送信され、空欄時は省略されること。
- accepted/update/snapshot/result/reject/error/closed の表示更新。
- read-only 操作導線が表示されないこと。
- `npm run lint`, `npm run typecheck`, `npm --workspace @infinitas/client run test`, `npm run build:client`

## Rollback Plan
- 追加した app spectator view/entry/service/test を revert すれば既存 player room flow へ戻せる。

## Commit Split Plan
1. app spectator mode implementation and tests

## Checklist
- [x] Design doc alignment confirmed
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
