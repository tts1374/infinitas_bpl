# v1-bpl-third-random-level-range

BASE_SHA: `01e60ada720fb3b99f145274869374defe9f8d64`

## 目的
- BPL の 3 曲目ランダムを、1 曲目・2 曲目の選曲レベルの最小値〜最大値（両端含む）で抽選する。

## 非目的
- ARENA のラウンド構築ロジックは変更しない。
- WebSocket の message type / payload schema は変更しない。
- level_filter UI や入力フローは変更しない。

## 変更点
- 設計書 `docs/design/01_fsm.md` の BPL ランダム 1 曲ルールを新仕様へ更新する。
- `chart-master` のランダム抽選オプションに「レベル範囲（min/max）制約」を追加する（未指定時の既存挙動は維持）。
- `room-state` の BPL 3 曲目生成で、1・2 曲目レベルから min/max を算出して範囲内抽選を強制する。
- worker テストを更新し、新仕様（3 曲目レベル範囲）を検証する。

## 影響範囲
- ユーザー: BPL 3 曲目ランダムのレベル帯が、両者の選曲レベル範囲に収まる。
- データ: ルーム結果形式・保存形式に変更なし。
- 互換性: API / WS 契約の互換性は維持。
- Cloudflare: Durable Object 内の凍結ラウンド構築ロジックのみ変更。

## 対象ファイル / 対象レイヤ
- `docs/design/01_fsm.md`
- `apps/worker/src/master/chart-master.ts`
- `apps/worker/src/durable/room-state.ts`
- `apps/worker/src/master/chart-master.test.mjs`
- `apps/worker/src/durable/room-state.test.mjs`
- レイヤ: worker / docs

## Invariant 影響
- INV-01: preserved（Worker/DO 責務分離は維持）
- INV-02: preserved（状態遷移列は変更なし）
- INV-03: preserved（タイマー値・遷移条件は変更なし）
- INV-04: preserved（expected_key 強制は変更なし）
- INV-05: preserved（idempotency 変更なし）
- INV-06: preserved（host 権限境界変更なし）
- INV-07: preserved（KV ロビー変更なし）
- INV-08: preserved（DO state loss 振る舞い変更なし）
- INV-09: preserved（監視 submit 条件変更なし）

## テスト観点
- QUALITY 1: worker の型/テストが通ること。
- QUALITY 2: 目的外差分、文字コード/改行逸脱がないこと。
- QUALITY 3: BPL 3 曲目の凍結ラウンド構築が新仕様で成立し、既存遷移（PICKING->PLAYING->RESULT）を壊さないこと。
- QUALITY 4: 対象外（監視ソース I/O 変更なし）。
- QUALITY 5: 対象外（今回ローカルではユニット検証まで）。

## ロールバック方針
- `room-state` の BPL 3 曲目選出を従来の同フィルタ全体ランダムに戻す。
- `chart-master` の追加オプション呼び出しを削除する。
- 設計書の該当文言を旧仕様へ戻す。

## コミット分割計画
1. 設計書の仕様更新（BPL 3 曲目ランダム条件）
2. worker 実装変更（chart-master / room-state）
3. テスト更新と実行結果反映

## チェックリスト
- [x] 設計確認（該当 docs/design の確認）
- [x] 影響範囲特定（worker / docs）
- [x] 実装
- [x] テスト
- [x] 回帰確認
- [x] ドキュメント更新
