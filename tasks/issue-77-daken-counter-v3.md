# issue-77-daken-counter-v3

## Purpose
- 監視対象に `打鍵カウンタv3`（`daken_counter_v3`）を追加し、`today_updates` スナップショットを既存の結果取り込み共通経路へ合流させる。

## Non-goals
- 旧打鍵カウンタ互換対応は行わない。
- Worker/DO 側プロトコルや保存経路の新設は行わない。
- 目的外のUI改修や広域リファクタは行わない。

## Changes
- `SourceType` と設定モデルに `daken_counter_v3` とポート設定（既定 `8767`）を追加し、設定UIで選択/入力できるようにする。
- LOBBY入場でローカルWebSocket接続、PLAYING開始時に接続確認、離脱時切断のライフサイクルを追加する。
- `today_updates` 受信データを厳格パースし、LOBBYでは採用せず、PLAYING中のみスナップショット差分を既存共通経路に投入する。
- 差分/重複防止（履歴上限付き）・`difficulty` 未知値破棄・`battle == 1` 破棄・JSON不正耐性を追加する。

## Impact
- Users: 設定画面で新監視対象とポート設定が利用可能になる。
- Data: ローカル設定に監視ソース種別とポートが追加される。
- Compatibility: 旧打鍵カウンタ設定は利用対象外として扱う。
- Cloudflare: なし（clientローカル実装のみ）。

## Target Files / Layers
- Files:
  - `packages/shared/src/enums/source.ts`
  - `apps/client/src/stores/settings-store.ts`
  - `apps/client/src/pages/SettingsPage.tsx`
  - `apps/client/src/stores/source-store.ts`
  - `apps/client/src/services/source-submission.ts`
  - 必要に応じて `apps/client/src/services/*` / `apps/client/src/stores/*` の局所ファイル
- Layers: client / shared

## Test Focus
- 技術的検証: client build, lint, 変更箇所ユニットテスト（可能な範囲）
- 監視ソース検証: LOBBY非採用、PLAYING差分採用、接続失敗時警告、無効メッセージ破棄、重複防止
- 差分検証: 目的ファイル限定、不要整形なし、UTF-8 no BOM / LF維持

## Rollback Plan
- `daken_counter_v3` の選択肢追加と受信処理差分を単純revertし、既存 `inf-notebook` / `inf_daken_counter` のみへ戻す。

## Commit Split Plan
1. shared/client 設定モデルと設定UIに `daken_counter_v3` + ポート設定を追加
2. WebSocket受信/差分取り込みロジックを既存共通経路へ統合し、検証コードを追加

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
