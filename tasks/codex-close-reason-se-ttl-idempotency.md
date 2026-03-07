# codex/close-reason-se-ttl-idempotency

## BASE_SHA
- `1da307d9fdaa7a7524ffa922f669bff79348fe83`

## 目的
- `CLOSED` 遷移時の `close_reason` を仕様化し、UI/SE を状態ではなく終了理由で分岐できるようにする。
- TTS ベースのカウントダウン演出を廃止し、絶対時刻ベースの固定 SE 再生へ置き換える。
- DO の deadline / room state / idempotency を storage 復元可能な形へ寄せる。

## 非目的
- 外向き `RoomState` の追加や通常フローでの `RESULT` 復活。
- 監視ソース I/O 仕様の変更。
- 無関係な UI リファクタやデザイン変更。

## 変更点
- shared に `CloseReason`、SE 関連定数、`request_id`、`ROOM_CLOSED`/通知 payload 拡張を追加する。
- worker に room state 永続化、`close_reason` 正規化、`request_id` 冪等化、Alarm 復元、host abort/disconnect 分離を追加する。
- client に SE 再生サービス、`event_id` 再生抑止、`match_found` 間隔制御、`request_id` 送信を追加する。
- docs/design の FSM / WS / data model / constants を実装に合わせて更新する。

## 影響範囲
- ユーザー: 終了理由表示、SE 再生、設定文言が変わる。
- データ: DO storage に room state / request log / event sequence を保存する。
- 互換性: WS payload と snapshot が拡張される。旧 `voiceEnabled` 設定は読み取り互換を維持する。
- Cloudflare: DO storage 復元と Alarm 再同期が増える。KV スキーマは変更しない。

## 対象ファイル / 対象レイヤ
- docs: `docs/design/01_fsm.md`, `docs/design/02_ws_protocol.md`, `docs/design/03_data_model.md`, `docs/design/07_constants.md`
- shared: `packages/shared/src/enums/room.ts`, `packages/shared/src/models/room-state-snapshot.ts`, `packages/shared/src/ws/client.ts`, `packages/shared/src/ws/server.ts`, `packages/shared/src/constants/*`
- worker: `apps/worker/src/durable/room-state.ts`, `apps/worker/src/durable/room-object.ts`
- client: `apps/client/src/services/ws-client.ts`, `apps/client/src/stores/room-store.ts`, `apps/client/src/stores/settings-store.ts`, `apps/client/src/services/*`, `apps/client/src/app/App.tsx`, `apps/client/src/pages/RoomPage.tsx`, `apps/client/src/pages/SettingsPage.tsx`
- assets: `assets/se/*`

## テスト観点
- `ALL_ROUNDS_COMPLETED` では `cancel` が鳴らず、`MATCH_TTL_EXPIRED` では鳴る。
- `match_deadline` が `START_MATCH` 成功時点で初めて確定する。
- 同一 `request_id` 再送で `START_MATCH` / `PICK_SUBMIT` / `RESULT_SUBMIT` / `SKIP_*` / `FORCE_ADVANCE` が二重適用されない。
- reconnect / state sync / 再描画で同一 `event_id` の SE が二重再生されない。
- DO 復元後に deadline / close_reason / result_ready が保持される。

## ロールバック方針
- shared schema 変更、worker 永続化、client SE 置換を論理コミットで分け、必要なら client SE 置換から先に戻せるようにする。

## コミット分割計画
1. docs + shared schema/constant updates
2. worker close-reason/persistence/idempotency
3. client SE playback + request_id wiring
4. verification-only follow-up if needed

## 作業チェック
- [ ] docs/design 更新
- [ ] shared 更新
- [ ] worker 実装
- [ ] client 実装
- [ ] typecheck / build
- [ ] 回帰確認
