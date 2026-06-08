# issue-183-remove-web-spectate

## Purpose
- Issue #183 に基づき、アプリ版観戦モード完成後に Web 観戦ページを削除する。

## Non-goals
- アプリ版観戦モードの追加・修正は行わない。
- Landing / Join / deeplink の意味変更は行わない。

## Current Request Boundary
- Ceiling: blocked until `tasks/issue-183-app-spectator-mode.md` is COMPLETE
- Allowed outputs now: app spectator completion後の Web spectate removal
- Forbidden outputs now: app spectator 完成前の Web spectate removal、join/deeplink 意味変更
- Next unlock condition: app spectator implementation/audit/validation が COMPLETE

## Changes
- `apps/web` の `/spectate` entry、page、test、snapshot、Vite entry から spectate-only surface を削除する。
- `/join` と landing の entry/build は維持する。
- Web copy が Web 観戦ページへ誘導している場合は、app 観戦導線に合わせて最小修正する。

## Impact
- Users: Web 観戦ページは提供終了し、アプリ観戦へ集約される。
- Data: なし。
- Compatibility: Web `/spectate` は削除される。desktop/app runtime contract は変更なし。
- Cloudflare: GitHub Pages build surface の entry が減るのみ。

## Target Files / Layers
- Files: `apps/web/vite.config.ts`, `apps/web/spectate/index.html`, `apps/web/src/pages/Spectate.tsx`, `apps/web/src/pages/Spectate.test.tsx`, spectate snapshot/entry
- Layers: web

## Test Focus
- spectate entry の参照が残っていないこと。
- landing/join build が通ること。
- `npm run typecheck:web`, `npm run build:web`, `npm run test:web` if applicable
- root `npm run lint`, `npm run typecheck`

## Rollback Plan
- Web spectate removal commit を revert すれば `/spectate` を復元できる。

## Commit Split Plan
1. remove web spectate surface after app spectator completion

## Checklist
- [x] App spectator task COMPLETE confirmed
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
