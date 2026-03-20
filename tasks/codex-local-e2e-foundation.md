# codex-local-e2e-foundation

## Purpose
- INFINITAS Arena にローカル専用 E2E 実行基盤を追加し、2クライアント同時起動・監視経路・証跡取得を再現可能にする。
- 代表シナリオとして Reflux/Reflux のフル進行と、打鍵カウンタv3/リザルト手帳の混在互換を自動実行できるようにする。

## Non-goals
- CI workflow 追加やリリースフロー変更は行わない。
- Worker/DO の FSM・WebSocket schema・LobbyDirectory 契約は変更しない。
- datasource 本体仕様の変更や parser 大規模改修は行わない。

## Changes
- `apps/client` に E2E モード設定注入（環境変数）を追加し、profile/datasource/watch/runtime/log の分離実行を可能にする。
- E2E モード限定の構造化ログ（JSONL）と runtime state dump 取得経路を追加する。
- 2クライアント起動、fixture 投入、ログ/状態待機、失敗時証跡保存を行うローカル実行スクリプトを `scripts` に追加する。
- `testdata/e2e` に datasource 別 fixture（reflux / daken_counter_v3 / inf-notebook / mixed）を配置し、代表正常系と unresolved_alias 異常系の足場を作る。
- 代表 E2E（Reflux/Reflux）と混在互換 E2E（daken_counter_v3 + inf-notebook）を追加する。
- ローカル実行手順を README かテスト向けドキュメントに追記する。

## Impact
- Users: 開発者がローカル Windows 環境で再現性のある E2E を実行できる。
- Data: E2E 実行時のみ runtime 配下にログ・dump・fixture 証跡を出力する。
- Compatibility: 通常起動は無変更、E2E 環境変数指定時のみ追加機能が有効になる。
- Cloudflare: なし（client / scripts / testdata 中心）。

## Target Files / Layers
- Files:
  - `apps/client/src/runtime/*`
  - `apps/client/src/services/*`
  - `apps/client/src/stores/*`
  - `apps/client/src-tauri/src/commands/*`
  - `apps/client/src-tauri/src/lib.rs`
  - `scripts/*e2e*`
  - `testdata/e2e/**/*`
  - `README.md` または `docs/testing/*`
- Layers: client / scripts / testdata（必要最小限で shared）

## Test Focus
- 技術的検証: client build, lint, 対象テスト成功
- 監視ソース検証: Reflux / daken_counter_v3 / inf-notebook の fixture 実投入経路確認
- E2E検証: Reflux/Reflux 代表シナリオ + mixed 互換シナリオ + unresolved_alias 足場
- 差分検証: 目的ファイル限定、不要整形なし、UTF-8 no BOM / LF 維持

## Rollback Plan
- E2E 関連差分（モード注入、内部観測、スクリプト、testdata、ドキュメント）をまとめて revert し、通常起動経路のみへ戻す。

## Commit Split Plan
1. client に E2E モード注入と profile/datasource/watch/runtime/log 分離を追加
2. E2E モード限定の構造化ログと runtime state dump を追加
3. scripts に 2クライアント起動/fixture投入/待機/証跡保存ユーティリティを追加
4. testdata/e2e を datasource 別に整理し、mixed と unresolved_alias 足場を追加
5. 代表 E2E 2本（Reflux/Reflux, mixed）を実装
6. ローカル実行手順ドキュメントを更新し、検証結果を反映

## Checklist
- [ ] Design doc alignment confirmed (if required)
- [ ] Impact scope identified
- [ ] Implementation completed
- [ ] Tests completed
- [ ] Regression checks completed
- [ ] Documentation updates completed (if required)
