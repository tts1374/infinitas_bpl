## Issue
- #149 自動マッチングの条件設定画面で待ち人数を表示する

## 目的
- Auto Match の `CONFIG` 画面で、`mode/play_style/win_metric` 条件に一致する待ち人数を表示する。

## 非目的
- rating 許容幅を使った人数表示
- リアルタイムポーリング表示
- `IN_QUEUE` 画面演出や既存 `candidate_count` 表示仕様の変更

## fixed decisions
- 待ち人数定義は `status=SEARCHING` かつ `mode + play_style + win_metric` 一致件数。
- 取得失敗時は `—` を表示する。
- 更新タイミングは初回表示時と条件変更時のみ（定期ポーリングなし）。

## 変更点
- Worker に waiting-count 取得 API を追加する。
- DO に条件一致件数の集計処理を追加する（stale 清掃後）。
- Client の Queue Status に待ち人数行を追加する。
- Client から waiting-count API を呼ぶ API クライアント関数を追加する。
- 共有型に waiting-count 応答型を追加する。
- `docs/design/03_data_model.md` に API と counting rule を追記する。

## 影響範囲
- ユーザー影響: Auto Match の設定画面で待ち人数が見えるようになる。
- データ影響: 永続データ構造の変更なし（既存チケット走査のみ）。
- 互換性: additive endpoint 追加のみ。既存 endpoint の wire 契約は維持。
- Cloudflare 影響: Worker route/DO の処理追加のみ。リソース追加なし。

## 対象レイヤ / 対象ファイル
- `apps/worker/src/index.ts`
- `apps/worker/src/routes/matchmaking.ts`
- `apps/worker/src/services/matchmaking-do.ts`
- `apps/worker/src/durable/matchmaking-object.ts`
- `apps/worker/src/routes/matchmaking.test.mjs`
- `apps/worker/src/durable/matchmaking-object.test.mjs`
- `apps/client/src/services/worker-api-client.ts`
- `apps/client/src/pages/AutoMatchPage.tsx`
- `packages/shared/src/models/matchmaking.ts`
- `docs/design/03_data_model.md`

## validation plan
- `npm run typecheck`
- `npm run lint`
- `npm run test:worker`
- `npm run typecheck:client`
- `npm run build:client`

## rollback 方針
- waiting-count API の route 追加と client 表示追加をまとめて revert すれば復旧可能。
- 既存 queue ticket API には変更を入れないため、ロールバックは局所的に実施できる。

## commit 分割方針
1. worker/shared/docs: waiting-count API と契約追加
2. client: waiting-count 表示実装

## delegation packet
- server-implementer
  - objective: waiting-count API と DO 集計実装
  - forbidden scope: client UI / Room-Lobby 契約変更
- front-implementer
  - objective: Queue Status への待ち人数表示追加
  - forbidden scope: worker/DO ロジック変更
- contract-auditor
  - objective: route/query/response/shared/docs の整合監査
- implementation-auditor
  - objective: race condition / fallback / 回帰の監査
