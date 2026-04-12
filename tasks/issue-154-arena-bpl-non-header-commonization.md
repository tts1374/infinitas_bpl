# issue-154-arena-bpl-non-header-commonization

## Purpose
- ARENA/BPL のヘッダ以外に残る同型実装を共通化し、保守コストと差分ズレ回帰リスクを下げる。
- 既存の見た目・挙動を維持したまま、client 内の util/hook/component へ段階的に集約する。

## Non-goals
- 見た目の大幅変更。
- `RoomPage` の `roomStatus/roundCount/resultTimer` 導出統合（contract-sensitive 領域）。
- worker/shared/docs-design への変更、依存更新。

## Scope
1. `Song` / `HistoryItem` 型の共通化（ARENA/BPL）。
2. 難易度バッジ変換（class/label）共通化。
3. join code マスク処理共通化。
4. クリップボードコピー + 2秒フィードバック共通hook化。
5. Lobby カウントダウン + 時刻フォーマット共通化。
6. RESULT 10秒タイマー共通hook化。
7. 決定カットイン演出 + 検索モーダルゲート共通コンポーネント化。
8. `RoomPage` の `playerStatus` / `playerMetrics` 生成ロジック共通 builder 化。

## Impact
- Users/runtime: UI表示は維持（非機能の重複削減）。
- Data/compatibility: 変更なし。
- Cloudflare resources: 影響なし（client-only）。

## Target Files / Layers
- Layer: client
- Main targets:
  - `apps/client/src/components/RoomArena.tsx`
  - `apps/client/src/components/RoomBPL.tsx`
  - `apps/client/src/pages/RoomPage.tsx`
  - `apps/client/src/components/**` または `apps/client/src/features/**` の新規共通化ファイル

## Validation Plan
- `npm --workspace @infinitas/client run typecheck`
- `npm run lint`
- 影響テスト実行（client 既存テスト + 追加ユニットテスト）
- visual scenario で ARENA/BPL の `WAITING/SELECTING/PLAYING/RESULT/CLOSED` 表示回帰確認

## Rollback Plan
- 共通化コミットを単位でrevertし、`RoomArena.tsx` / `RoomBPL.tsx` / `RoomPage.tsx` 直書き実装へ戻す。

## Commit Split Plan
1. 共通 util/type/hook の追加（型・badge・mask・copy・timer）。
2. RoomArena/RoomBPL への適用（cut-in と search modal gate 含む）。
3. RoomPage の playerStatus/playerMetrics builder 共通化。
4. テスト追加と回帰確認。

## Phase / Spawn Decision
- Phase A: `READY`
- Phase B: `READY`
- 実行プロファイル: `Standard`（single-layer だが複数 bounded task・検証拡張あり）
- Plan Mode適用: `NO`（contract-sensitive 変更なし、cross-layer 変更なし）
- Standard Spawn Gate: `APPLICABLE`
- High-Risk Spawn Gate: `NOT_APPLICABLE`

## C Kickoff (Pre-Implementation Gate)
- Re-judged execution profile: `Standard`
- Spawn Gate result:
  - Standard Spawn Gate: `APPLICABLE`（複数 bounded task + 検証拡張あり）
  - High-Risk Spawn Gate: `NOT_APPLICABLE`（contract-sensitive/cross-layer 変更なし）
- delegation execution record:
  - role: `execution-coordinator`
  - spawned: `yes`
  - objective: Issue #154 の quick-win + medium を実装可能な bounded task へ分割し、依存順と検証項目を固定する
  - no-delegate reason: N/A
  - role: `front-implementer`
  - spawned: `no`
  - objective: client 内共通化の実装（B1-B4）
  - no-delegate reason: 本スレッドで 1 write scope = 1 owner を維持し、親エージェントが単独で実装予定
  - role: `implementation-auditor`
  - spawned: `no`
  - objective: 実装後の回帰監査（B5）
  - no-delegate reason: Phase C 実装未着手のため、監査は実装完了後に実行
- C kickoff status: `READY`

## Bounded Tasks (Phase B Output)
1. `B1-common-primitives`
   - `Song/HistoryItem`、difficulty badge、join-code mask、countdown formatter、copy/result timer hook を client 共通モジュールへ抽出。
2. `B2-arena-adoption`
   - `RoomArena.tsx` に B1 を適用（cut-in / search modal gate 共通化含む）。
3. `B3-bpl-adoption`
   - `RoomBPL.tsx` に B1 を適用。
4. `B4-roompage-builder`
   - `RoomPage.tsx` の `playerStatus/playerMetrics` 導出を共通 builder に抽出。
5. `B5-validation-audit`
   - typecheck/lint/tests/visual scenario で回帰検証。

## Replan Gate
- 次のいずれかが発生した場合、Phase C を停止して Phase A/B へ戻す:
  - contract-sensitive な状態導出統合が必要化
  - in-scope 外の cross-layer 変更が必須化
  - Must fix 解消に仕様判断が必要化
