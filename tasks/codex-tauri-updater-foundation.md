# codex-tauri-updater-foundation

- BASE_SHA: `e689d49c7c771b0ae001627e619b2caeaaae8625`

## 目的

- Tauri 2 公式 updater plugin をクライアントに導入し、起動時のみ更新確認する基盤を追加する。
- 更新ありのときは通常画面へ進ませず、専用モーダルと進捗表示を経て install まで進める。
- 更新確認、ダウンロード、適用の失敗時は現行バージョンで通常起動へフォールバックする。

## 非目的

- Cloudflare Worker / KV / R2 の更新配信実装
- GitHub Actions や配布自動化
- beta/stable 分離、強制アップデート、min supported version
- 設定画面からの手動更新確認
- Windows コード署名証明書の導入

## 変更点

- [ ] Tauri updater plugin の依存追加と Rust 側登録
- [ ] capability / permission と `createUpdaterArtifacts` を含む Tauri 設定追加
- [ ] 公開鍵と update endpoint を 1 箇所で差し替え可能な設定面に整理
- [ ] 起動時 updater state machine / service / hook の追加
- [ ] 通常起動前の Startup Gate とキャンセル不可モーダル、進捗 UI の実装
- [ ] check / download / install 失敗時のログとフォールバック動線の実装

## 影響範囲

- ユーザー: アプリ起動時に更新確認が挟まり、更新ありの場合のみブロッキング UI が表示される
- データ: 永続データ形式への変更なし
- 互換性: 既存アプリ起動フローに updater 判定が追加されるが、失敗時は現行版で継続する
- Cloudflare: 今回は未実装。後続 PR で差し替えられる endpoint 受け口のみ整備する

## 対象ファイル / 対象レイヤ

- client frontend (`apps/client/src/**`)
- Tauri config / capability (`apps/client/src-tauri/**`)
- client package manifest (`apps/client/package.json`)
- 必要に応じてルート lockfile

## テスト観点

- updater endpoint 未設定または未接続でも通常起動できる
- 更新なしのとき通常起動する
- 更新ありのときキャンセル不可モーダルと進捗表示が出る
- check / download / install の各失敗でエラー文言後に通常起動する
- 型チェック、lint、クライアント build / Rust compile が通る

## ロールバック方針

- updater 導入差分を丸ごと戻し、既存の直接起動フローへ復帰する
- Tauri plugin / capability / config 追加を削除して起動フローを元に戻す

## コミット分割計画

- [ ] Tauri updater plugin と設定面の追加
- [ ] フロントエンド起動ゲートと updater UI / 状態管理の追加
- [ ] 検証と必要最小限の補足ドキュメント更新
