# codex-issue-121-allow-leggendaria

## Purpose
- 個人設定として LEGGENDARIA 許可/不許可を追加し、マッチ候補抽選の全経路へ一貫適用する。

## Non-goals
- LEGGENDARIA 以外のフィルタ条件や選曲ロジック全体の再設計は行わない。
- 監視ソース I/O 仕様や Cloudflare リソース構成は変更しない。

## Changes
- クライアント設定に `allowLeggendaria: boolean` を追加し、初期値を `false` にする。
- 設定 UI から切り替え可能にし、入室中は変更不可（disabled）にする。
- `ROOM_JOIN` capability に設定値を含め、DO 側 player 情報へ保持する。
- `START_MATCH` 時点で `include_leggendaria = players.every(player => player.allow_leggendaria)` を確定する。
- `searchCharts` / ランダム抽選 / 重複差し替え再抽選 / BPL 3曲目ランダムへ同一フィルタを適用する。
- 必要なテストを更新し、マッチ開始後の設定変更が当該マッチへ反映されないことを担保する。

## Impact
- Users: 設定画面で LEGGENDARIA 許可を制御できる。全員許可時のみ候補に出る。
- Data: クライアント設定と room 内 player capability に新規 boolean が追加される。
- Compatibility: WS capability に新規フィールド追加（後方互換は既存デフォルト `false` で維持）。
- Cloudflare: Durable Object のマッチ候補フィルタ確定ロジックに変更が入る。

## Target Files / Layers
- Files:
  - `apps/client/src/**/*settings*`
  - `apps/client/src/**/*room*`
  - `apps/worker/src/**/*room*`
  - `packages/shared/src/**/*protocol*`
  - `docs/design/02_ws_protocol.md`（契約記述差分が必要な場合）
- Layers: client / worker / shared / docs

## Test Focus
- QUALITY 1: 型チェック・lint・関連テストの成功
- QUALITY 2: 差分が目的範囲に限定され、UTF-8 no BOM / LF を維持
- QUALITY 3: FSM/Protocol 観点で START_MATCH 時固定化と経路一貫性を確認
- QUALITY 4: 監視ソース I/O 未変更のため対象外
- QUALITY 5: E2E は今回未実施の場合、残余リスクを明記

## Rollback Plan
- 追加フィールドとフィルタ条件を元に戻し、旧来の候補抽選条件へ戻す。
- 必要時は設定 UI のトグル表示を一時的に無効化する。

## Commit Split Plan
1. 設定/プロトコル型の追加（client/shared）
2. DO 抽選ロジックと経路適用 + テスト更新
3. 必要時の設計ドキュメント更新

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
