# issue-184-match-history-app-window

## Purpose
- Issue #184 を正本として、#110 の外部 OBS 出力を廃止し、対戦履歴を Tauri アプリ内の別ウィンドウで表示する。

## Non-goals
- WS/FSM/shared、統計算出、永続履歴DB、依存、旧生成済み OBS ファイルを変更しない。

## Current Request Boundary
- Ceiling: implementation-ready
- Allowed outputs now: task artifact 作成、C Kickoff、bounded implementation、validation、audit、Phase D handoff
- Forbidden outputs now: 目的外変更、旧生成済み OBS ファイルの削除、明示許可のない commit / PR / Issue close
- Next unlock condition: none

## Changes
- 外部 `match_history.json/html/css/js` 生成と `OBS Output Directory` 設定を削除する。
- #110 の履歴構築ロジックを localStorage ベースで再利用する。
- 固定 label の Tauri 別ウィンドウを作成または再フォーカスする。
- Settings に別ウィンドウ起動と履歴リセットを配置する。
- 旧 settings の `obsOutputDirectory` は無視し、旧生成済みファイルは削除しない。

## Impact
- Users: OBS Browser Source 出力を廃止し、アプリ別ウィンドウへ移行する。
- Data: 起動中セッション履歴のみ。mode ごと直近3試合。
- Compatibility: 旧 settings は読み込み可能。旧 OBS ファイルは更新停止のみ。
- Cloudflare: none

## Target Files / Layers
- Files: client service、専用 view/CSS、Settings、AppBootstrap、Tauri bridge、Rust command/model、旧 OBS assets、visual fixture
- Layers: client UI / localStorage / Tauri bridge / Rust command / settings compatibility

## Test Focus
- lint、root typecheck、client build、client stats test、cargo test/check、Windows desktop smoke、旧 settings 互換、外部ファイル非更新、diff discipline

## Rollback Plan
- app-window 導線を revert し、必要な場合のみ旧 OBS 出力実装を復元する。

## Commit Split Plan
1. Replace OBS external output with the in-app match history window.

## Checklist
- [x] C Kickoff completed before implementation
- [x] Settings compatibility confirmed
- [x] Implementation completed
- [x] Tests completed
- [x] Desktop smoke completed
- [x] Contract audit completed
- [x] Implementation audit completed
- [x] Diff reviewed
