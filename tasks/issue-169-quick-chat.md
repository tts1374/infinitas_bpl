# issue-169-quick-chat

## Purpose
- Add room-scoped quick chat where players compose short preset-part comments and share the latest room messages.

## Non-goals
- No arbitrary free-text chat.
- No global lobby/public chat.
- No favorites tabs, unlock progression, seasonal rotation, Twitter integration, or moderation tooling.
- No lobby summary schema/filter change.

## Current Request Boundary
- Ceiling: implementation ready after C Kickoff in this Phase C-D turn.
- Allowed outputs now: this task artifact, C Kickoff, delegation execution records, implementation, validation, audit, and closure summary.
- Forbidden outputs now: scope expansion beyond Issue #169 quick chat without Replan Gate.
- Next unlock condition: none after C Kickoff records actual delegation execution.

## Changes
- Add shared quick-chat phrase IDs/catalog, message item type, max composed length 20, and recent history limit 30.
- Add WS contract for player quick-chat post and accepted/broadcast update.
- Store bounded recent quick-chat items in RoomDO state and include them in authoritative room sync.
- Add client room UI for phrase-part selection, preview, submit, recent message display, and per-player speech bubbles in LOBBY/PICKING.
- Align the client UI with the wireframe under `C:\work\infinitas_arena\wireframe`, including kana-order phrase tabs, block-based deletion, `Chat / Logs` footer integration, and BPL bubble clipping avoidance.
- Update design docs for WS protocol, data model, screen behavior, and constants.

## Impact
- Users: room participants can send preset quick chat before/during picking.
- Data: RoomDO persisted state gains bounded quick-chat history.
- Compatibility: additive WS/snapshot fields only; old clients ignore unknown snapshot fields, but new clients need new server support.
- Cloudflare: no new resources.

## Target Files / Layers
- Layers: shared, worker, client, docs.
- Files: packages/shared contract/constants; apps/worker RoomState/RoomObject tests and handlers; apps/client RoomPage/store/presentational tests; docs/design protocol/data/screen/constants.

## Quick Chat Catalog
- Max composed message length: 20 characters.
- Recent history limit: 30 messages.
- Composer stores selected phrases as an ordered `string[]`, displays them as selected blocks, deletes one selected phrase block at a time, and validates/sends the joined display string with `join('')`.
- Initial catalog tabs are kana-order based, not usage-based. Keep this order and grouping unless Phase A/B is reopened.

### あ行
- お願いします
- ありがとう
- お疲れさま
- いきます
- あれ
- あの
- あんな
- いい感じ
- いけそう
- 惜しい
- 熱い
- うれしい
- 面白い

### か行
- これ
- ここ
- 今回
- この
- こんな
- かなり
- きっと
- 曲
- 鍵盤
- 高速
- きつい
- 更新
- 勝ち
- 環境不調
- ごめん
- がんばる
- がんばります
- 決めたい
- 悲しい
- 根性
- が
- から
- けど
- かも
- かな？
- か？
- 休憩

### さ行
- すみません
- それ
- そこ
- さっき
- その
- そんな
- そろそろ
- 勝負
- 再戦
- 皿曲
- ソフラン
- 初見
- 集中
- スコア
- 自己ベ
- 準備OK
- 先どうぞ
- そして
- した
- します
- したい
- しよう
- しましょう

### た行
- 次
- どの
- ちょっと
- たぶん
- 対戦
- 次も
- 楽しみ
- 低速
- 得意
- 挑戦
- チャンス
- で
- と
- では
- です
- ですか？
- ですね
- だ！
- だな

### な行
- ナイス
- なんとか
- 苦手
- 伸びそう
- 伸ばしたい
- の
- なぁ

### は行
- 本気
- フルコン
- 募集
- 減らしたい
- は

### ま行
- めっちゃ
- もう
- まだ
- まさか
- もう一回
- むずい
- ミスカン
- 負け
- 未所持
- 待って
- 任せます
- 目指す
- ミラクル
- も
- ます

### や行
- よろしく
- やばい
- 予感

### ら行
- 了解
- 例の
- ラスト
- ランダム
- 冷静に
- 連続

### わ行
- わくわく

### 記号・英数字
- CN
- BP
- EXスコア
- 1st
- substream
- 2nd
- 3rd
- 4th
- 5th
- 6th
- 7th
- 8th
- 9th
- 10th
- RED
- HS
- DD
- GOLD
- DJT
- EMP
- SIRIUS
- RA
- Lincle
- tricoro
- SPADA
- PENDUAL
- copula
- SINOBUZ
- CANNON
- Rootage
- HEROIC
- BISTRO
- CastHour
- RESIDENT
- EPOLIS
- Pinky
- ！
- ？
- …
- ♪

## Wireframe Design Handoff
- Wireframe source: `C:\work\infinitas_arena\wireframe`.
- Reference files inspected: `src/components/QuickChat.tsx`, `src/components/RoomArena.tsx`, `src/components/RoomBPL.tsx`.
- `QuickChat` phrase category tabs must use kana-order groups: `あ行`, `か行`, `さ行`, `た行`, `な行`, `は行`, `ま行`, `や行`, `ら行`, `わ行`, `記号・英数字`.
- `QuickChat` composer state must keep selected phrase blocks as an array rather than a plain string, because the delete/backspace control removes one selected phrase block per click.
- The displayed preview may render each selected phrase as a small block/chip, while validation and send use the joined string. The joined string must remain non-empty and `<= 20` characters.
- The floating `QuickChat` widget is available only in the room waiting/selecting phases that correspond to product `LOBBY`/`PICKING`.
- Accepted messages must appear in the room chat log and as a per-player speech bubble. The wireframe uses local `setTimeout` to clear bubbles after 5 seconds; production should derive show/hide from RoomDO/store message state and client-side expiry timers, not rely on mock-only local message creation.
- Arena layout: show each player's speech bubble near the player icon, visually below/right of the icon area, with `min-w-max` and `max-w-[240px]` style behavior so 20-character messages do not clip and longer display text wraps safely if future limits change.
- BPL layout: do not place bubbles inside the player card frame because the card uses fixed height/overflow clipping. Render bubbles at the parent player-column level with absolute positioning: 1P expands toward the lower right, 2P expands toward the lower left.
- BPL layout must match Arena's footer organization: put the `Chat / Logs` panel and `Start Match`/`READY` action below the 1st-Final STAGE display area.
- Remove the old right-sidebar `Room Chat` block in BPL when the footer `Chat / Logs` panel is introduced.
- The `MessageSquare` icon is used for `Chat / Logs` and the quick-chat affordance; production code should use the existing app icon library/import pattern.

## Test Focus
- Root lint/typecheck.
- Worker tests for validation, duplicate handling, bounded history, reconnect snapshot, spectator read-only post rejection.
- Client tests for kana-order category rendering, phrase-block deletion, compose limits, disabled states, message rendering, speech-bubble placement state, and standard test entrypoint inclusion.
- Client visual/manual checks for Arena bubble non-clipping, BPL bubble placement outside card overflow, and BPL `Chat / Logs` footer replacing the old sidebar room-chat block.
- Design contract check if docs/constants contracts are updated.

## Rollback Plan
- Revert the additive quick-chat WS/types/state/UI/docs commit; no migration is required because history is bounded and non-authoritative for gameplay.

## Commit Split Plan
1. Shared/worker/docs contract and RoomDO behavior.
2. Client UI/store integration and tests.

## Delegation Packets

### server-implementer
- Objective: implement shared/worker/docs quick-chat contract and RoomDO authoritative behavior.
- Success criteria: valid posts in LOBBY/PICKING are stored/broadcast, invalid posts reject, history is capped at 30, spectator posts are rejected, no lobby summary schema change.
- In-scope files/layer: packages/shared, apps/worker, docs/design.
- Non-goals: client UI implementation, free-text chat, lobby listing changes.
- Forbidden scope: dependencies, CI, gameplay FSM/timer authority changes beyond quick-chat allowed-state guard.
- Allowed side effects: additive shared types/constants, additive persisted RoomDO field, additive design docs.
- Expected output: implementation summary, changed paths, tests run or reasons not run.
- Validation: worker tests plus root typecheck/lint readiness.
- Continue-without-escalation boundary: additive WS/snapshot fields only.
- Escalation: breaking schema, lobby summary/filter change, free-text/moderation requirement, dependency/CI change.

### front-implementer
- Objective: implement client quick-chat composer/history using the shared catalog and room store send path.
- Success criteria: users can compose preset parts from kana-order tabs, delete one selected phrase block at a time, preview <=20 chars, submit only in LOBBY/PICKING, view recent history, see per-player speech bubbles, and see disabled/error states.
- In-scope files/layer: apps/client.
- Non-goals: worker/shared contract changes except adapting to already-defined exported types.
- Forbidden scope: source parser changes, stats changes, lobby listing changes, dependency updates.
- Allowed side effects: additive UI/state/tests.
- Expected output: implementation summary, changed paths, tests run or reasons not run.
- Validation: relevant client tests and typecheck readiness.
- Continue-without-escalation boundary: consume additive quick-chat contract only.
- Escalation: missing shared API, need for free-text input, or room-state semantics change beyond display/send gating.

### contract-auditor
- Objective: audit WS/snapshot/shared/docs compatibility and cross-layer contract drift.
- Success criteria: no unplanned one-sided contract change, no lobby summary schema change, additive compatibility and design docs align.
- In-scope files/layer: packages/shared, apps/worker, apps/client quick-chat usage, docs/design.
- Non-goals: implementing fixes unless explicitly reassigned.
- Forbidden scope: product scope expansion.
- Allowed side effects: read-only audit output.
- Expected output: COMPLETE/BLOCKED/ESCALATION with findings.
- Validation: review diff and test evidence.
- Continue-without-escalation boundary: notes/should-fix only.
- Escalation: Blocker/Must fix contract issue.

### implementation-auditor
- Objective: audit behavior quality, scope discipline, and validation evidence.
- Success criteria: required behavior is covered, no unrelated diff, high-risk validation gaps are visible.
- In-scope files/layer: all quick-chat touched files.
- Non-goals: implementing fixes unless explicitly reassigned.
- Forbidden scope: product scope expansion.
- Allowed side effects: read-only audit output.
- Expected output: COMPLETE/BLOCKED/ESCALATION with findings.
- Validation: review diff and executed checks.
- Continue-without-escalation boundary: notes/should-fix only.
- Escalation: Blocker/Must fix behavior or validation issue.

## Replan Gate
- Return to Phase A/B if implementation requires lobby schema/filtering changes, arbitrary text/moderation policy, breaking snapshot changes, dependency/CI changes, or gameplay FSM/timer authority changes.
