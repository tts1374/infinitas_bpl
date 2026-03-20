# song-disambiguation-chart-id

## Purpose
- 同一 `title_search_key` を持つ別曲（例: `SHOOTING STAR` / `Shooting Star`）を、選曲と進行で区別可能にする。

## Non-goals
- Room FSM / timer 挙動の変更。
- CI / deploy / dependency 変更。
- Datasource パーサの大規模仕様変更。

## Changes
- Worker master 生成で重複キーを全除外せず、譜面ごとの安定識別子（`chart_id`）を保持する。
- Worker の chart 解決・検索・pick 解決を `chart_id` 優先に拡張する（既存キー互換を維持）。
- Shared 型に `chart_id` を追加し、client/worker 間で識別子を受け渡す。
- Room の round 表現と client の表示解決を `chart_id` 対応にする。
- 監視結果送信は既存 `title_search_key` マッチを維持しつつ、`chart_id` が取れる経路では優先利用する。

## Impact
- Users: 同名異曲の選曲が可能になる。表示曲名/難易度の取り違えリスクを低減。
- Data: worker master JSON の形式追加（`chart_id` 追加）。
- Compatibility: WS/HTTP は後方互換を保ち、旧クライアント入力の解決を維持。
- Cloudflare: Worker/DO ロジック変更あり（FSM遷移仕様は不変）。

## Target Files / Layers
- Files:
  - `scripts/build_worker_chart_master.py`
  - `apps/worker/src/master/chart-master.ts`
  - `apps/worker/src/durable/room-state.ts`
  - `apps/worker/src/durable/room-object.ts`
  - `packages/shared/src/models/*.ts`（chart/expected key/snapshot 関連）
  - `apps/client/src/services/worker-api-client.ts`
  - `apps/client/src/pages/RoomPage.tsx`
  - `apps/client/src/services/source-submission.ts`
- Layers: `client` / `worker` / `shared` / docs

## Test Focus
- 技術的検証: `npm run lint` / client `typecheck` / worker `typecheck` / tauri `cargo check`
- 差分検証: 目的外差分なし、UTF-8 (no BOM) / LF 整合
- FSM/Protocol: pick->freeze->round の `chart_id` 解決整合、既存 pick key 互換
- 監視ソース: `observed_key == expected_key` と `chart_id` 併用時の受理整合
- E2E: `reflux/reflux` と mixed の最低回帰

## Rollback Plan
- `chart_id` 利用箇所を feature fallback（`title_search_key` 解決）へ戻す。
- master 生成を旧ロジックに戻して再生成し、worker/client を同時ロールバック。

## Commit Split Plan
1. master 生成ロジック更新（`chart_id` 追加、重複全除外撤廃）
2. shared 型 + worker chart 解決の `chart_id` 対応
3. room-state/room-object の pick/round 解決互換対応
4. client API/Room UI/source-submission の `chart_id` 対応
5. テスト・ドキュメント更新（ローカルE2E確認）

## Checklist
- [ ] Design doc alignment confirmed (if required)
- [ ] Impact scope identified
- [ ] Implementation completed
- [ ] Tests completed
- [ ] Regression checks completed
- [ ] Documentation updates completed (if required)
