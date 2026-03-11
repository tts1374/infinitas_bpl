# v1-bpl-always-3-stage

## 目的
- BPL モードを BO3 先取終了ではなく、常に 3 STAGE 実施に統一する。

## 非目的
- ARENA モードのラウンド進行変更は行わない。
- WS schema 変更は行わない。

## 変更点
- DO の BPL 終了判定から「2勝先取で RESULT 遷移」を除外し、最終ラウンド終了時のみ RESULT 遷移する。
- worker テストを 3 STAGE 固定仕様へ更新する。
- 設計書（FSM / constants / implementation_plan）の BPL 表記を 3 STAGE 固定へ更新する。

## 影響範囲
- ユーザー: BPL は常に 3 曲実施される。
- データ: BPL の途中終了がなくなり、`incomplete_match` 発生条件が変わる。
- 互換性: 既存 API / payload 互換性は維持。
- Cloudflare: DO の遷移判定のみ変更。

## 対象ファイル / レイヤ
- `apps/worker/src/durable/room-state.ts`
- `apps/worker/src/durable/room-state.test.mjs`
- `docs/design/01_fsm.md`
- `docs/design/07_constants.md`
- `docs/design/09_implementation_plan.md`

## テスト観点
- BPL 2ラウンド終了時に `PLAYING` 継続すること。
- BPL 3ラウンド終了時に `RESULT` へ遷移すること。
- 既存 worker テストが通ること。

## ロールバック方針
- BPL 終了判定を元の BO3 先取終了へ戻す。
- 変更した設計書文言を元に戻す。

## コミット分割計画
1. DO 遷移ロジック変更
2. worker テスト更新
3. 設計書更新
4. 検証

## チェックリスト
- [x] 設計確認（該当 docs/design の確認）
- [x] 影響範囲特定（worker / docs）
- [x] 実装
- [x] テスト
- [x] 回帰確認
- [x] ドキュメント更新
