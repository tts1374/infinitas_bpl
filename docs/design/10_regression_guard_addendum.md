# 回帰防止追補仕様（Ph1）

## 0. 目的
本追補は、`docs/design/01-08` のうち回帰を起こしやすい契約境界を最小差分で補強する。

対象:
- Source 契約
- `ROOM_STATE_LOST` 失敗モード
- `RESULT_READY` payload 形状
- ローカル保存の互換/移行ルール

## 1. Source 契約（固定）

### 1.1 SourceType 列挙
`SourceType` の受理列挙値は次で固定する。
- `inf_daken_counter`
- `inf-notebook`
- `daken_counter_v3`
- `reflux`

### 1.2 運用プロファイル
- 1端末1ソース固定。
- ルーム参加中の source 変更は禁止。
- `inf_daken_counter` は legacy/deprecated とし、運用有効化しない構成では `ROOM_JOIN` を拒否できる。
- legacy source の有効/無効を切り替える場合は、`02/03/06/07` と `QUALITY.md` を同一PRで更新する。

## 2. `ROOM_STATE_LOST` 契約（固定）

- `CloseReason` に `ROOM_STATE_LOST` を含める。
- DO が復元不能または必須状態欠落を検知した場合は、`ROOM_STATE_LOST` を返却/通知する。
- `ROOM_STATE_LOST` ではクライアントはブロッキングダイアログを表示する。
- `ROOM_STATE_LOST` では部分結果の表示はローカル snapshot を正とする。

## 3. `RESULT_READY` payload 最小スキーマ（固定）

`RESULT_READY.payload` は以下を最低限満たす。

- `summary`
  - `match_id`
  - `mode`
  - `win_metric`
  - `total_rounds`
  - `completed_rounds`
  - `winner_player_ids`
  - `is_draw`
  - `is_rated`
  - `rated_block_reason`
  - `rating_before`
  - `rating_after`
  - `rating_delta`
- `per_round.rounds[]`
  - `round_index`
  - `expected_key`
  - `display`
  - `round_started_at`
  - `played`
  - `winner_player_ids`
  - `results[]` (`player_id/status/metric_value/reason/submitted_at/submitted_by/source_meta`)
- `per_player.players[]`
  - `player_id`
  - `display_name`
  - `rounds[]`
  - モード別集計（ARENA: `total_points` 等、BPL: `round_wins` 等）

## 4. 互換/移行ポリシー（固定）

- ローカル保存は `schema_version` を必須とする。
- `schema_version` の互換ルール:
  - 加法的変更（optional追加）は同一バージョン内で許容。
  - 破壊的変更はバージョンを上げる。
- 読み込み側は「現行 + 直前」のみサポートし、それ以前は空アーカイブへフォールバックする。
- 移行不能データは破棄せず、少なくとも読み込み失敗を検知できるログを残す。

## 5. 整合更新ルール（固定）

以下の変更は同一PRで更新する。
- `SourceType` 変更: `02/03/06/07` + `QUALITY.md`
- `CloseReason` 変更: `01/02/07` + client 表示仕様
- `RESULT_READY` 変更: `02/03` + shared 型 + worker/client 利用箇所

