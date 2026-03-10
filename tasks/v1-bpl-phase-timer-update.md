# v1-bpl-phase-timer-update

## 目的
- PLAYINGフェーズの時間配分を `MUSIC_SELECT=60秒`、`PLAY_START=15秒`（開始時刻=75秒）に変更する。

## 非目的
- フェーズ種別や状態遷移自体の追加・変更は行わない。
- RESULT/LOBBYなど他タイマー仕様は変更しない。
- WSスキーマ変更は行わない。

## 変更点
- sharedタイマー定数の秒数更新。
- クライアント演出（カウント開始秒）を新しい秒数に整合。
- 規範ドキュメント `docs/design/07_constants.md` の該当値更新。

## 影響範囲
- ユーザー: PLAYING中の表示カウント/開始タイミングが延長される。
- データ: なし。
- 互換性: WS payload互換性への影響なし。
- Cloudflare: DOのタイマー判定に新定数が適用される。

## 対象ファイル / レイヤ
- `packages/shared/src/constants/timers.ts`（shared）
- `docs/design/07_constants.md`（docs）

## テスト観点
- 型チェック（client/workerを含む全体）成功。
- workerテスト成功（タイマー関連の回帰なし）。
- 既存UIでPLAYING表示のフェーズラベル/残秒が不整合にならないこと。

## ロールバック方針
- 定数値を旧値（45/55系）へ戻し、ドキュメント値も同時に戻す。

## コミット分割計画
1. shared定数更新
2. docs更新
3. 検証結果反映

## チェックリスト
- [x] 設計確認（該当 docs/design の確認）
- [x] 影響範囲特定（client / worker / shared）
- [x] 実装
- [x] テスト
- [x] 回帰確認
- [x] ドキュメント更新
