# Plan: codex/stats-screen

## 作業宣言
- worktree: `C:\work\infinitas_arena\infinitas_bpl_stats`
- branch: `codex/stats-screen`
- base branch: `v1`
- BASE_SHA: `a170a7b34ab91448100f910fe2fd6b469eb6f761`

## 目的
- 対戦結果と自己成績を可視化する統計画面を client に追加する。
- `matches` / `match_games` / `play_results` / `personal_bests` をローカル保存し、後から再集計できる基盤を入れる。
- Elo（1500開始 / K=24 / DRAW=0.5）による系列別内部レートをマッチ単位で更新し、曲別勝率・安定度集計を追加する。

## 非目的
- Cloudflare のルーム FSM や KV ロビー挙動そのものの仕様変更。
- 監視ソース watcher/parser の入出力仕様変更。
- 既存 Room/Lobby/Settings 以外の大規模 UI リデザイン。
- 依存関係追加や lockfile 更新。

## 前提 / 仮定
- 曲識別は `ExpectedKey` から再構成する `chart_id`（`SP|DP::DIFFICULTY::title_search_key`）を永続IDとして扱う。
- `PRIVATE` ルームは保存対象だがレート更新対象外とする。
- レート履歴はマッチ単位、曲別勝率は `match_games` 単位、安定度は `play_results` 単位で分離する。
- BPL は 1 対 1 のマッチ結果で 1 回だけレート更新する。
- ARENA は最終順位から pairwise 擬似対戦を作り、自分のレートだけをマッチ終了時に 1 回更新する。

## 変更点
- `docs/design` に統計画面とローカル統計保存の記述を追加する。
- worker/shared の最小差分で `source_meta` を round/result 集計に残し、EX/BP を client が取得できるようにする。
- client に統計アーカイブサービス、BPL 用 Elo 純関数、ARENA pairwise 擬似対戦純関数、ランキング/履歴/安定度の集計関数を追加する。
- 各曲確定時に `match_games` / `play_results` / `personal_bests` を更新し、マッチ確定時に `matches` を更新してレートを再計算する。
- `StatsPage` とナビゲーションを追加し、ARENA/BPL・SP/DP フィルタ、マッチ履歴、曲別勝率、安定度を表示する。
- 純関数層の unit test を追加する。

## 影響範囲
- ユーザー:
  - 統計画面で系列別レート、直近マッチ勝敗、曲別勝率、安定度を確認できる。
  - `PRIVATE` を含む自己プレイ結果が安定度へ反映される。
- データ:
  - client のローカル保存領域に統計アーカイブを追加する。
  - worker の round/result 集計 payload に `source_meta` を含める。
- 互換性:
  - additive な payload 拡張に留め、既存 client の room 進行を壊さない。
  - ローカル統計アーカイブは schema version を持つ。
- Cloudflare:
  - DO の round confirmation/result aggregation にのみ最小変更が入る。

## 対象ファイル / 対象レイヤ
- `docs/design/02_ws_protocol.md`
- `docs/design/03_data_model.md`
- `docs/design/05_screen_list.md`
- `apps/worker/src/durable/**`
- `packages/shared/src/models/**`
- `packages/shared/src/ws/**`
- `apps/client/src/app/App.tsx`
- `apps/client/src/pages/**`
- `apps/client/src/services/**`
- `apps/client/src/stores/**`
- `apps/client/src/styles.css`
- `apps/client/package.json`
- `apps/client/tsconfig*.json`
- `tasks/codex-stats-screen.md`

## テスト観点
- レート:
  - ARENA_SP 更新で ARENA_DP が変化しない。
  - BPL と ARENA が混線しない。
  - PRIVATE でレートが変化しない。
  - 初回対象マッチが 1500 開始になる。
  - BPL がマッチ単位で 1 回だけ更新される。
  - ARENA がマッチ単位で 1 回だけ更新される。
  - ARENA の pairwise 擬似対戦が順位通りに評価される。
  - 途中終了でレート更新されない。
- ARENA順位決定:
  - 合計ptで順位決定される。
  - 合計pt同点時に EX総和で決まる。
  - EX総和も同じ場合に結果確定時刻順で決まる。
  - それでも同じなら同順位になる。
- 勝率ランキング:
  - 3 戦未満の譜面が表示されない。
  - `ARENA/BPL/SP/DP` が混在しない。
  - `chart_id` ベースで集計が安定する。
- 安定度:
  - 直近 20 件・重複ありで計算される。
  - PRIVATE が含まれる。
  - 自己ベスト未保持曲が除外される。
- UI:
  - データ不足文言が出る。
  - 未計測レートが `--` になる。
  - 履歴が `W/L/D` になる。
  - ラウンド詳細が表示される。
- 検証コマンド:
  - `npm --workspace @infinitas/client run typecheck`
  - `npm --workspace @infinitas/client run build`
  - `npm run typecheck`
  - 統計 unit test コマンド

## ロールバック方針
- `codex/stats-screen` 差分を revert して、統計画面と payload 拡張をまとめて戻す。

## Commit Plan（コミット分割計画）
1. plan/docs 更新。
2. worker/shared の `source_meta` 保持追加。
3. client の統計アーカイブ・集計ロジック追加。
4. 統計画面 UI 追加。
5. unit test / build / typecheck 調整。

## 検証結果
- [ ] `npm --workspace @infinitas/client run typecheck`
- [ ] `npm --workspace @infinitas/client run build`
- [ ] `npm run typecheck`
- [ ] 統計 unit test コマンド
