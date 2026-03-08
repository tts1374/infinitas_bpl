# Plan: codex-public-lobby-browser-design

## 目的
- 公開ロビー一覧を `PUBLIC` のみ掲載に変更する
- `UNLISTED` を仕様から削除する
- 公開ロビー一覧の取得を「KV候補 + DO照会」で定義し、人数表示と満員判定の正確性を担保する

## 非目的
- client / worker / shared 実装変更
- WebSocket schema 変更
- Room FSM の状態遷移変更
- 監視ソース I/O 変更

## 変更点
- visibility 仕様を `PUBLIC | PRIVATE` に整理
- 公開ロビー一覧は `PUBLIC` かつ `LOBBY` 候補のみを対象にする
- KV は `public_lobby_candidate` を持つ公開ロビー候補インデックスとして扱う
- 一覧 API は KV で候補取得後、ページ内 room DO を参照して `room_state` / `players.length` / `settings.max_players` を導出し、表示項目を確定する
- DO 参照失敗時は一覧全体を失敗させず、人数表示を `-- / --` とする

## 影響範囲
- ユーザー: 公開ロビー一覧の掲載条件、人数表示、満員表示、アクティブ件数の意味が変わる
- データ: 公開ロビー KV スキーマと visibility の規範定義が変わる
- 互換性: `UNLISTED` 前提の後続実装は見直しが必要
- Cloudflare: KV 一覧と DO 参照の責務分割を明文化する

## 対象ファイル / 対象レイヤ
- `docs/design/01_fsm.md`
- `docs/design/03_data_model.md`
- `docs/design/04_tech_stack.md`
- `docs/design/05_screen_list.md`
- `docs/design/07_constants.md`

## テスト観点
- 公開ロビー掲載条件が `PUBLIC` のみに統一されている
- `UNLISTED` が規範仕様から除去されている
- KV は候補インデックス、DO は詳細状態の正とする責務が一貫している
- 一覧 API の DO 参照失敗時の扱いが明記されている

## ロールバック方針
- docs 差分を巻き戻し、visibility と公開ロビー一覧を従来仕様に戻す

## コミット分割計画
1. Plan task 追加
2. design docs 更新

## 実施ステップ
- [ ] 設計確認（公開ロビー / visibility / KV責務）
- [ ] docs/design 更新
- [ ] 差分整合性確認
