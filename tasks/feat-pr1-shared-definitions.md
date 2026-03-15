# Plan: feat/pr1-shared-definitions

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_arena`
- branch: `feat/pr1-shared-definitions`
- base branch: `v1`
- BASE_SHA: `845314d4ea457c2f2b33549508c78ec78f1b4aa4`

## 目的
- `docs/design/09_implementation_plan.md` の PR-1 を満たす shared 定義を固定する。
- client / worker が同一の型・定数・WS schema・error code を参照できる状態にする。

## 非目的
- Worker の HTTP/WS ルート実装（PR-2以降）。
- Durable Object の FSM/タイマー/集計ロジック実装（PR-3以降）。
- Client UI / watcher / parser 実装（PR-8以降、PR-9以降）。

## 変更点
- `packages/shared` を新規作成。
- enums を追加（RoomState, Visibility, Mode, WinMetric, SourceType, Submission系）。
- constants を追加（07_constants.md 相当の固定値）。
- models を追加（RoomSettings, ExpectedKey, FrozenRound, Submission, RoomStateSnapshot ほか）。
- ws schema を追加（message types, client/server envelope, payload map）。
- errors を追加（Ph1 error codes）。
- ルート TypeScript 設定を追加し、`npm run typecheck` を実行可能化。
- client/worker から shared import の最小スモークファイルを追加。
- 設計書の source 命名揺れを `inf_daken_counter | inf-notebook` に統一。

## 影響範囲
- ユーザー:
  - 実行機能の変更はなし（基盤定義のみ）。
- データ:
  - 永続データ形式の変更はなし。
  - shared 型定義の追加により後続PRの参照先が固定される。
- 互換性:
  - 既存実装なしの初期段階のため破壊的影響はなし。
  - ただし後続PRは本PRの型・定数に依存する。
- Cloudflare resources:
  - Workers / Durable Objects / KV の設定変更なし。
  - デプロイ資産への直接影響なし。

## 実装方針（対象ファイル単位）
- `packages/shared/src/constants/*`:
  - 設計 `07_constants.md` を単純マッピングし、マジックナンバーを排除。
- `packages/shared/src/enums/*`:
  - 文字列リテラル union を `as const` で定義し、厳密型を提供。
- `packages/shared/src/models/*`:
  - `03_data_model.md` と `02_ws_protocol.md` の最小共通モデルを型化。
- `packages/shared/src/ws/*`:
  - message type 一覧、envelope、payload map を分離し client/worker 共有化。
- `packages/shared/src/errors/*`:
  - Ph1 error code を一元化。
- `packages/shared/src/index.ts`:
  - 各ドメインのエクスポート窓口を統合。
- `apps/client/src/shared-smoke.ts`, `apps/worker/src/shared-smoke.ts`:
  - shared import のコンパイル可能性を確認する最小参照を追加。
- `package.json`, `tsconfig.base.json`, `tsconfig.json`:
  - workspace typecheck の最小基盤を構築。
- `docs/design/02_ws_protocol.md`, `docs/design/03_data_model.md`:
  - source 命名不整合を設計先行で修正。

## テスト観点
- PR-1内で実施:
  - `npm run typecheck` 成功。
  - client/worker の shared import 解決確認。
  - WS message/payload 型整合性のコンパイル確認。
- E2E観点（後続PRで通し検証する項目）:
  - 2人 ARENA: create -> ready -> pick -> play -> result。
  - 2人 BPL(BO3): create -> ready -> pick -> play -> result。
  - 監視2ソース（inf_daken_counter / inf-notebook）で expected_key 一致時のみ採用。
  - TIMEOUT（round soft ttl）と FORCE_ADVANCE の挙動。

## ロールバック方針
- 問題発生時は `feat/pr1-shared-definitions` の当該コミットを revert し、shared 導入前状態へ戻す。
- 影響が設計差分のみの場合は docs 変更を先に revert し、実装差分は別コミットで追随。
- 依存先PRが出た後に巻き戻す必要がある場合は、後続PRを一時停止して shared 型を再調整する。

## Commit Plan（コミット分割計画）
1. workspace/tsconfig の最小基盤追加。
2. `packages/shared` の constants/enums/errors/models/ws 追加。
3. client/worker の shared import スモーク追加。
4. source 命名不整合の設計修正。
5. typecheck 実行結果確認と最終調整。
