# 監視ソースI/O仕様（Ph1）

## 0. 目的
Ph1で対応するローカル監視ソースについて、
入力ファイル、採用フィールド、新規イベント判定、同定処理、異常時の扱いを定義する。

Ph1では以下を前提とする。

- 対応ソースは 2種類
  - `inf_daken_counter`
  - `inf-notebook`
- **1端末1ソース固定**
- ソースは事前設定で選択
- ルーム参加中は変更不可
- 監視方式は **file watcher**
- 監視異常時は `SOURCE_UNAVAILABLE` を表示し、TECHスキップ誘導とする

---

## 1. 共通方針

## 1.1 採用対象
ルームの勝敗判定に使用する値は以下のみ。

- `SCORE` モード:
  - EX SCORE 絶対値
- `MISSCOUNT` モード:
  - miss count / bp

以下は採用しない。

- update差分値のみのスコア
- DJ LEVEL
- CLEAR TYPE
- ランプ
- オプション差による補正

---

## 1.2 同定キー
譜面同定は以下で行う。

- `play_style`
- `difficulty`
- `title_search_key`

### expected_key
```text
(play_style, difficulty, title_search_key)
```

### observed_key
監視ソースから取得した情報を正規化して生成する。

### 採用条件
- `observed_key == expected_key`
- `round_index == current_round_index`
- 当該プレイヤーの当該ラウンドが未確定

これを満たす場合のみ `PLAYED` として採用する。

---

## 1.3 タイトル正規化
`normalize_title_input(raw_title)` を同定処理側で行う。

最低限含む処理:

- Unicode NFKC
- trim
- 連続空白を1つに正規化
- 括弧直前空白除去
  - `Summer Vacation (CU mix)` -> `Summer Vacation(CU mix)`
- 英字小文字化
- 記号の最小正規化

### マスタ参照順
1. `music_title_alias`
2. `music.title_search_key`

解決失敗時:
- `UnmatchedTitleLog` に記録
- 当該ラウンドでは未同定扱い
- Ph1では手動再割当は行わない

---

## 1.4 新規イベント判定
各ソースごとに last_seen を保持し、
**すでに見たイベントを再採用しない**。

Ph1では「現在ラウンドのみ受理（accept_window=0）」であるため、
遅延イベント・過去イベントは採用しない。

---

## 1.5 監視異常
以下は監視異常とみなす。

- ファイルが存在しない
- 読取失敗
- JSON/XMLパース失敗
- 必須フィールド欠落

対応:
- `SOURCE_UNAVAILABLE` 表示
- 自動提出は行わない
- PLAYING中は TECH スキップ誘導

---

## 2. ソース: inf-notebook（リザルト手帳）

## 2.1 使用ファイル
必須:
- `export/recent.json`

補助:
- `records/recent.json`

Ph1では、**勝敗判定の一次ソースは `export/recent.json`** とする。  
`records/recent.json` は補助ログ・デバッグ用途とする。

---

## 2.2 export/recent.json 入力例
```json
{
  "version": "0.19.0.0",
  "count": 20,
  "score": 39398,
  "misscount": 441,
  "updated_score": 10447,
  "updated_misscount": 16,
  "clear": 17,
  "list": [
    {
      "timestamp": "20250729-201348",
      "difficulty": "ANOTHER",
      "music": "Thunderbolt",
      "new": true,
      "score": 2878,
      "misscount": 13,
      "updated_score": 157,
      "updated_misscount": 4,
      "clear": true
    }
  ]
}
```

---

## 2.3 採用フィールド
### 共通
- `timestamp`
- `difficulty`
- `music`

### SCORE モード
- `score`

### MISSCOUNT モード
- `misscount`

### 採用しないフィールド
- `updated_score`
- `updated_misscount`
- `clear`

---

## 2.4 play_style の扱い
`export/recent.json` には play_style が含まれない。  
そのため、ルーム設定の `play_style` を前提に observed_key を構成する。

前提:
- ルームは `SP` または `DP` のどちらか1つに固定
- クライアントは現在参加中ルームの `play_style` を使用する

---

## 2.5 observed_key 生成
```text
play_style = room.play_style
difficulty = export/recent.json.list[].difficulty
title_search_key = normalize_title_input(music)
```

---

## 2.6 新規イベント判定
Ph1では以下を採用する。

- `export/recent.json.list[]` の末尾から新しい順に確認
- `timestamp` を last_seen として保持
- `timestamp > last_seen_timestamp` のものだけ新規候補とする

候補が複数ある場合:
- 新しいものから順に見て
- `observed_key == expected_key` を満たす最初の1件を採用

---

## 2.7 records/recent.json の扱い
`records/recent.json` は以下用途に限定する。

- 補助ログ
- オプション表示
- 同定確認補助
- デバッグ

### records/recent.json から使用してよい情報
- `play_side`
- `option`
- `music`
- `difficulty`

### 勝敗判定には使わない
- `update_score`
- `update_miss_count`

理由:
- 差分値であり、絶対値として使えないため

---

## 3. ソース: inf_daken_counter（打鍵カウンタ）

## 3.1 使用ファイル
必須:
- `today_update.xml`

---

## 3.2 today_update.xml 入力例
```xml
<Results>
  <item>
    <lv>10</lv>
    <title>GHEL NAGARAJA</title>
    <difficulty>DPH</difficulty>
    <lamp>EXH-CLEAR</lamp>
    <score>+2064</score>
    <opt>OFF / OFF</opt>
    <bp>3</bp>
    <notes>1110</notes>
    <score_cur>2064</score_cur>
    <score_pre>0</score_pre>
    <rank>AAA</rank>
    <scorerate>92.97</scorerate>
  </item>
</Results>
```

---

## 3.3 採用フィールド
### 共通
- `title`
- `difficulty`

### SCORE モード
- `score_cur`

### MISSCOUNT モード
- `bp`

### 採用しないフィールド
- `score`（差分文字列。例 `+2064`）
- `lamp`
- `rank`
- `opt`
- `scorerate`

---

## 3.4 difficulty の変換
`today_update.xml` の `difficulty` は以下のような略記で入る。

例:
- `SPN`
- `SPH`
- `SPA`
- `SPL`
- `DPN`
- `DPH`
- `DPA`
- `DPL`

これを以下へ変換して observed_key を作る。

- `play_style`
- `difficulty`

例:
- `DPH` -> `play_style=DP`, `difficulty=HYPER`

---

## 3.5 observed_key 生成
```text
play_style, difficulty = parse_chart_difficulty(xml.difficulty)
title_search_key = normalize_title_input(title)
```

---

## 3.6 新規イベント判定
Ph1では以下を採用する。

### fingerprint
```text
(title_search_key, parsed_difficulty, score_cur, bp)
```

### last_seen
- 上記 fingerprint を保持
- 同一 fingerprint の再検出は無視

ファイル更新時:
- 最新 `item` を読み取る
- fingerprint が未確認なら新規候補
- `observed_key == expected_key` なら採用

---

## 4. ソース設定UIとの対応

## 4.1 設定値
- `inf_daken_counter`
- `inf-notebook`

## 4.2 制約
- 1端末1ソース固定
- ルーム参加中は変更不可

## 4.3 監視対象パス
### inf_daken_counter
- `today_update.xml`

### inf-notebook
- `export/recent.json`
- 必要なら `records/recent.json`

---

## 5. 採用フロー（共通）

### 5.1 ラウンド開始時
- ルームから `ROUND_BEGIN(expected_key)` を受信
- クライアントは監視を継続
- `round_soft_ttl` の起点は **START音声時**

### 5.2 監視イベント検出時
1. ソースごとの新規イベント判定
2. observed_key 生成
3. `observed_key == expected_key` を確認
4. 勝敗モードに応じた `metric_value` 抽出
5. `RESULT_SUBMIT` を送信

### 5.3 採用失敗時
- key mismatch: 採用しない
- metric欠落: 採用しない
- parse失敗: `SOURCE_UNAVAILABLE` 扱い

---

## 6. 未同定時の扱い
未同定（title解決失敗）は以下とする。

- そのイベントは提出しない
- `UnmatchedTitleLog` に記録
- ラウンドが進行した場合は最終的に
  - 本人SKIP
  - ホスト代理SKIP
  - TIMEOUT
  のいずれかで確定

Ph1では未同定を手動補正して再投入する機能は持たない。

---

## 7. 将来拡張余地
Ph2以降で以下を追加可能。

- `records/recent.json` の補助利用強化
- source自動診断
- file watcher + polling のフォールバック
- 未同定タイトルの管理UI
- 複数ソース対応の統合ログ
- 監視中の詳細デバッグ表示
