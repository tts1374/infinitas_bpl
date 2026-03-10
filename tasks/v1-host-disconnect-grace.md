# v1-host-disconnect-grace

## 目的
- 一時的な WebSocket 異常切断（例: code 1006）でホストが即時離脱扱いになり、ルームが意図せず `CLOSED` になる事象を防ぐ。

## 非目的
- ホスト権限の移譲仕様追加
- WebSocket プロトコル変更
- lobby/KV スキーマ変更

## 変更点
- `HOST_ABORTED`（明示的退出）は即時クローズを維持。
- `HOST_DISCONNECTED`（非明示切断）は `REJOIN_COOLDOWN_SECONDS` の猶予を設ける。
- 猶予内にホスト再接続で継続し、猶予超過時のみ `HOST_DISCONNECTED` でクローズ。
- DO のタイマー処理に「ホスト再接続猶予超過クローズ」を追加。
- 規範仕様ドキュメントを実装に合わせて更新。

## 影響範囲
- ユーザー: 一時切断時の意図しないルーム解散を抑制
- データ: 永続フォーマット変更なし（既存フィールドで運用）
- 互換性: WS message schema 変更なし
- Cloudflare: DO のタイマー分岐追加（FSM 挙動変更あり）

## 対象ファイル / 対象レイヤ
- Worker FSM:
  - `apps/worker/src/durable/room-state.ts`
  - `apps/worker/src/durable/room-object.ts`
- Worker tests:
  - `apps/worker/src/durable/room-state.test.mjs`
- Design docs:
  - `docs/design/01_fsm.md`
  - `docs/design/07_constants.md`

## テスト観点
- ホスト `HOST_ABORTED` は即時クローズされる
- ホスト `HOST_DISCONNECTED` 直後は即時クローズされない
- 猶予内に再接続した場合はクローズされない
- 猶予超過時に `HOST_DISCONNECTED` でクローズされる

## ロールバック方針
- `room-state.ts` / `room-object.ts` のホスト切断猶予ロジックを戻し、即時クローズ挙動に復帰する。
- 併せて design docs を元仕様へ戻す。

## コミット分割計画
1. FSM 実装変更（host disconnect grace + DO timeout close）
2. テスト追加
3. design docs 更新

## 実行チェックリスト
- [x] 設計確認（`docs/design/01_fsm.md`, `docs/design/07_constants.md`）
- [x] 影響範囲特定（worker FSM / timer / tests）
- [x] 実装
- [x] テスト
- [x] 回帰確認
- [x] ドキュメント更新
