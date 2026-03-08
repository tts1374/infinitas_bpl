- 目的
  - v1 の rated/unrated 判定を Durable Object 側で厳格化し、`RESULT_READY.payload.summary` に rated 判定結果とレート適用有無を明示する。
- 非目的
  - レーティング計算式自体の変更
  - 監視ソース I/O 仕様の変更
  - ロビー/KV 仕様の変更

- BASE_SHA
  - `d01e0d747b5782842cd45cbd05a22800c44761a4`

- 変更点
  - `RESULT_READY` の shared schema と design docs に rated 判定結果を追加する。
  - worker の result 集計時に strict rated 判定を一元化し、`skip/timeout/force advance/missing/mismatch/incomplete/conflict` を unrated とする。
  - client 側の結果表示/統計取り込みで DO 提供の rated 結果を優先し、unrated でも結果保存と表示が成立するようにする。
  - 関連テストを追加し、最低限の回帰確認を行う。

- 影響範囲
  - ユーザー
    - 結果画面で rated/unrated と理由が明示される。
    - 一部これまで rated 扱いだったケースが unrated になる。
  - データ
    - `RESULT_READY.payload.summary` に追加フィールドが入る。
    - ローカル stats archive は DO 判定を反映してレート更新可否を決める。
  - 互換性
    - 既存クライアントが summary 追加フィールドを無視できる前提。
    - 既存保存データはフィールド欠損を許容する必要がある。
  - Cloudflare
    - DO の集計ロジックと WS payload が変わる。KV 変更はなし。

- 対象ファイル / 対象レイヤ
  - worker: `apps/worker/src/durable/room-state.ts`, 関連テスト
  - shared: `packages/shared/src/ws/server.ts` など `RESULT_READY` 型定義
  - client: 結果表示/統計取り込みの関連箇所
  - docs: `docs/design/02_ws_protocol.md`, `docs/design/03_data_model.md` など必要最小限

- テスト観点
  - [ ] 全員提出・全 round 正常完了時のみ rated
  - [ ] missing submission で unrated
  - [ ] `SKIPPED` 1件で unrated
  - [ ] `TIMEOUT` 1件で unrated
  - [ ] `FORCE_ADVANCE` で unrated
  - [ ] mismatch/conflict/incomplete で unrated
  - [ ] unrated でも `RESULT_READY` が生成され、rating fields は null
  - [ ] client 側で DO 判定が stats に反映される

- ロールバック方針
  - `RESULT_READY` summary 追加と strict rated 判定をまとめて revert し、既存の local stats 推定ロジックに戻す。

- コミット分割計画
  - [ ] docs/shared schema 更新
  - [ ] worker strict rated 判定実装
  - [ ] client/stats 反映
  - [ ] テスト追加と検証
