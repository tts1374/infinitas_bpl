# issue-177-round-result-transition

## Purpose
- Issue #177 の「Round Result が 10 秒で切り替わらず、次ラウンドの IN PLAY 相当タイミングまで残る」現象を調査・修正する。
- 各曲後 Round Result は `ROUND_RESULT_SECONDS=10` 相当の lead-in 後、次ラウンドの `MUSIC SELECT` 表示へ切り替わることを保証する。

## Non-goals
- Issue #170 の picking countdown 差分を主対象にしない。
- PICKING TTL、WS schema、shared constants、Worker FSM は Replan Gate なしに変更しない。
- room screen redesign はしない。
- 縦モニター全画面を仕様要件化しない。再現ヒントとして扱う。

## Current Request Boundary
- Ceiling: implementation ready after this artifact exists and C Kickoff is completed.
- Allowed outputs now: task artifact, C Kickoff, bounded implementation, audit, validation, Phase D summary.
- Forbidden outputs now: commit, PR, release, unrelated refactor.
- Next unlock condition: none.

## Changes
- `RoomPage.tsx` の Round Result / MUSIC SELECT / PLAY START / IN PLAY 判定を確認し、10秒境界で確実に切り替わる client-only 修正を行う。
- `clockNowMs` tick が `round_started_at` 境界を跨いだ時に stale 表示を残さないようにする。
- Round Result が IN PLAY 到達まで残る regression fixture を追加する。
- 既存 #170 countdown behavior は維持する。

## Impact
- Users: 各曲後の Round Result が想定どおり約10秒で次曲の選曲表示へ進む。
- Data: なし。
- Compatibility: schema/payload 変更なしの予定。
- Cloudflare: なしの予定。

## Target Files / Layers
- Files: `apps/client/src/pages/RoomPage.tsx`, focused client room phase tests.
- Conditional files: `apps/worker/**`, `packages/shared/**` は Replan Gate 後のみ。
- Layers: client. worker/shared は条件付き。

## Test Focus
- `current_round.round_started_at` が現在時刻+10秒の時、10秒未満は Round Result、10秒以後は MUSIC SELECT。
- `round_started_at + ROUND_PLAY_BEGIN_AT_SECONDS` まで Round Result が残らない。
- tall/vertical viewport fixture でも phase 判定が layout に依存しない。
- #170 の no-fallback picking countdown tests が維持される。

## Rollback Plan
- client 修正と focused tests を revert する。data migration rollback は不要。

## Commit Split Plan
1. Client Round Result transition fix and focused regression tests.

## Delegation Packet
- task label: issue-177-round-result-transition
- objective: Round Result が 10 秒で MUSIC SELECT へ切り替わらず IN PLAY 付近まで残る現象を解消する。
- success criteria: Round Result は lead-in 中のみ表示される。MUSIC SELECT/PLAY START/IN PLAY の境界が tests で確認できる。契約・定数・WS payload は変えない。
- in-scope files/layer: client room presentation and focused tests.
- non-goals: picking wait countdown 主修正、Worker/shared schema/timer 変更、UI redesign。
- forbidden scope: TTL/constants 変更、WS payload 変更、generated artifacts、lockfile 変更。
- allowed side effects: focused client tests、必要最小の helper 抽出。
- expected output: implementation diff、validation results、audit findings/status。
- validation: `npm run lint`, `npm run typecheck`, `npm --workspace @infinitas/client run test`, `npm run test:client-stats`, `npm run test:worker`, `npm run check:design-contracts`, `git diff --check`.
- continue-without-escalation boundary: client-only phase composition / clock tick 修正。
- escalation: Worker lead-in authority、shared constants、WS contract、Tauri windowing 仕様変更が必要な場合。
