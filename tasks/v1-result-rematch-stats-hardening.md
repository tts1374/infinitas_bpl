- 目的
  - PLAYING -> RESULT -> 再戦開始（RETURN_TO_LOBBY/auto rematch）における統計セッション識別を Durable Object 権威で安定化し、順序依存デグレを抑止する。
  - `RESULT_READY` と `ROOM_UPDATED/STATE_SNAPSHOT` の到着順が前後しても、match 境界が崩れない実装へ寄せる。

- 非目的
  - rating 計算式の変更
  - source watcher / parser 仕様変更
  - LobbyDirectoryDO のスキーマ/取得条件変更
  - 依存関係更新

- BASE_SHA
  - `c5c3c42509dced129f9b72a8917fd5c437e6d496`

- 影響範囲（ユーザー / データ / 互換性 / Cloudflare）
  - ユーザー
    - 再戦直後/遅延受信時の統計混線（前試合と次試合の取り違え）が起きにくくなる。
  - データ
    - `RoomStateSnapshot` に match 識別子を追加する（server-authoritative）。
    - client stats archive の session 切替判定を新識別子ベースへ変更する。
  - 互換性
    - 追加フィールドは後方互換にし、欠落時は既存 fallback を維持する。
  - Cloudflare
    - Room DO の snapshot/persistence/hydrate と WS 契約に変更が入る（Worker routing / KV は非対象）。

- 対象ファイル / 対象レイヤ
  - docs: `docs/design/01_fsm.md`, `docs/design/02_ws_protocol.md`, `docs/design/03_data_model.md`（必要最小限）
  - shared: `packages/shared/src/models/room-state-snapshot.ts` ほか関連型
  - worker: `apps/worker/src/durable/room-state.ts`, `apps/worker/src/durable/room-object.ts`, 関連 test
  - client: `apps/client/src/features/stats/stats.ts`, `apps/client/src/services/stats-archive.ts`, `apps/client/src/stores/room-store.ts`（必要最小限）, 関連 test

- 変更点
  - `RoomStateSnapshot` に server-authoritative な現在 match 識別子（例: `current_match_id`）を追加する。
  - DO で `LOBBY/PICKING/PLAYING/RESULT/CLOSED` 各状態の snapshot に識別子を一貫反映し、rematch で確実に更新する。
  - client 側の `match_id` 推測ロジックを縮小し、snapshot 識別子を優先して session 分離する。
  - `RESULT_READY` 遅延到着・`ROOM_UPDATED` 先行・`RETURN_TO_LOBBY` 直後再開の順序ケースを固定する回帰テストを追加する。

- テスト観点
  - [x] worker: `RESULT_READY` 生成前後で snapshot の match 識別子が正しい
  - [x] worker: `RESULT -> LOBBY -> PICKING`（手動/auto rematch）で match 識別子が更新される
  - [x] worker: hydrate 復元時に識別子が維持される（旧データ fallback 含む）
  - [x] client(stats): `ROOM_UPDATED` と `RESULT_READY` の到着順逆転でも前試合と混線しない
  - [x] client(stats): LOBBY未観測の即再戦でも新試合として分離される
  - [x] client(stats): `RETURN_TO_LOBBY` 後は次試合の provisional/authoritative 昇格が正しく働く

- ロールバック方針
  - 追加フィールド参照を feature diff で巻き戻し可能な単位に分ける。
  - 問題発生時は client 側の新参照を先に revert し、DO snapshot 追加は互換フィールドとして残せる構成を維持する。

- コミット分割計画
  - [x] 1. docs（契約変更）更新
  - [x] 2. shared + worker（snapshot 契約と DO 実装）更新
  - [x] 3. client（stats/session 切替）更新
  - [x] 4. worker/client テスト追加と検証
