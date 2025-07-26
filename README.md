# INFINITAS Online Battle Tool

**beatmania IIDX INFINITAS のオンライン対戦を、少しだけ快適にするためのツールです。**

「INFINITAS打鍵カウンタ（OBS WebSocket版）」のデータを利用し、  
**自動で対戦相手とのスコア共有＋OBS表示** を行うことができます。

## 主な機能

- **スコア共有**  
  対戦相手と自動でスコアを共有します。

- **OBSへの自動表示**  
  スコア結果をOBS上に自動で表示します。  
  配信や画面共有で便利に使えます。

---

## 依存ツールについて

本ツールは  
[INFINITAS打鍵カウンタ（OBS WebSocket版）](https://github.com/dj-kata/inf_daken_counter_obsw) の出力データ（`today_update.xml`）または、
[inf-notebook](https://github.com/kaktuswald/inf-notebook/wiki)の出力データ（`records/recent.json`）を利用します。

必ず事前にこちらのツールを導入し、動作する状態にしてからご利用ください。

---

## 導入方法

1. [リリースページ](https://github.com/tts1374/infinitas_bpl/releases)から、  
   **`INFINITAS_Online_Battle.zip`** をダウンロードしてください。
2. ZIPファイルを解凍し、任意の場所に保存してください。

---

## 使い方

### アプリの起動

1. 解凍したフォルダ内の  
   **`INFINITAS_Online_Battle.exe`** を起動します。
2. 以下の情報を入力してください。
<img width="1174" height="883" alt="image" src="https://github.com/user-attachments/assets/02df03bf-3db1-4c27-beaa-ef0cfa87b1bd" />

| 項目 | 説明 |
|-------|-------|
| **DJ NAME** | 表示する名前を入力します。半角英数字・記号で**6文字以内**にしてください。 |
| **ルームパスワード** | 対戦者同士で事前に決めたパスワードを入力します。**半角英数のみ**対応。ルームパス生成で自動生成することもできます。 |
| **モード選択** | 以下から選択できます：<br>・アリーナモード<br>・BPLバトルモード<br>・アリーナ(BP)モード<br>・BPL(BP)モード |
| **定員** | アリーナモードの場合、参加人数（最大4人）を入力します。BPLバトルの場合は2人対戦固定なので入力不要です。 |
| **リザルト設定** | 「INFINITAS打鍵カウンタ」または「リザルト手帳」から選択できます。ご使用のツールに合わせて設定してください。 |
| **リザルトファイル選択** | INFINITAS打鍵カウンタを選択の場合：「INFINITAS打鍵カウンタ（OBS WebSocket版）」のフォルダ内にある `today_update.xml` を選択してください。<br> リザルト手帳を選択の場合：「inf-notebook」のフォルダ内にある `records/recent.json` を選択してください。<br> **注意！** 必ずrecords内にあるrecent.jsonを選択してください！他のファイルを選択すると正しく動きません。|

3. 全員の準備が整ったら「対戦開始」を押してください。

---

### アプリ中の操作について

- 対戦データにマウスカーソルを合わせる（ホバーする）と、操作用のボタンが表示されます。

- **自分のスコアをまだ投稿していない場合**は「スキップ」ボタンが表示されます。  
  楽曲を持っていない場合などに使用できます。  
  ※スキップすると、その対戦は「自動的に負け」として記録されるのでご注意ください。

- **自分のスコアをすでに投稿している場合**は「削除」ボタンが表示されます。  
  対戦データ全体が削除され、対戦相手のスコアも同時に消去されます。  
  ※他のプレイヤーの結果も消えるため、削除は慎重に行ってください。
  
<img width="1176" height="851" alt="image" src="https://github.com/user-attachments/assets/9cc8124d-ab3d-4f02-a4d0-5f81f3ee6352" />

---

### OBSの設定

1. OBSのシーンに**ブラウザソース**を追加します。
2. 以下の設定を行ってください。
<img width="715" height="595" alt="OBS" src="https://github.com/user-attachments/assets/4a8405d4-fd5e-4dd8-a073-61de590d12d9" />

| 項目 | 設定内容 |
|-------|-------|
| **ローカルファイル** | **ON** |
| **ファイル** | ダウンロードしたフォルダ内の `bpl_battle.html` を指定してください。 |
| **その他の設定** | デフォルトのままでOKです。 |

---

## 更新情報

### 2025/07/26 v0.2.0 リリース

- **バグ修正**
  - 対戦結果を削除した際、STAGE番号（表示順）が正しくなくなる問題を修正しました。

- **新機能**
  - **リザルト手帳**のデータに対応しました。  
    外部ツールのスコアデータを読み込んで、対戦に利用できるようになりました。
  - **対戦結果画面のデザインを改善**しました。  
    視認性を向上させ、見やすく整った表示になっています。

---

## 問い合わせ・連絡先

[@_2ten on X (旧Twitter)](https://x.com/_2ten)

---

### 注意事項

- 本ツールは非公式のファンツールです。  
- ご利用は自己責任でお願いします。

## クレジット

本ツールは、以下のツールを利用して動作しています。

- [INFINITAS打鍵カウンタ（OBS WebSocket版）](https://github.com/dj-kata/inf_daken_counter_obsw)
  
  出力データの利用<br>
  作者：かた様 → [https://x.com/cold_planet_](https://x.com/cold_planet_)

- [inf-notebook](https://github.com/kaktuswald/inf-notebook/wiki)

  出力データの利用、マスタデータの利用<br>
  作者：わると様 → [https://x.com/kaktuswald](https://x.com/kaktuswald)
  
- デザイン担当
  
  しののめかれん → [https://x.com/sk_Lotus](https://x.com/sk_Lotus)
  
ライセンスは **Apache License 2.0** に基づき使用しています。
