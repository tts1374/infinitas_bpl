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
[INFINITAS打鍵カウンタ（OBS WebSocket版）](https://github.com/dj-kata/inf_daken_counter_obsw) の出力データ（`today_update.xml`）を利用しています。

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
<img width="1261" height="706" alt="image" src="https://github.com/user-attachments/assets/4090926a-3321-4de6-95a2-45b6a76295f6" />

| 項目 | 説明 |
|-------|-------|
| **DJ NAME** | 表示する名前を入力します。半角英数字・記号で**6文字以内**にしてください。 |
| **ルームパスワード** | 対戦者同士で事前に決めたパスワードを入力します。**半角数字のみ**対応。 |
| **モード選択** | 以下から選択できます：<br>・アリーナモード<br>・BPLバトルモード<br>・アリーナ(BP)モード<br>・BPL(BP)モード |
| **定員** | アリーナモードの場合、参加人数（最大4人）を入力します。BPLバトルの場合は2人対戦固定なので入力不要です。 |
| **リザルトファイル選択** | 「INFINITAS打鍵カウンタ（OBS WebSocket版）」のフォルダ内にある `today_update.xml` を選択してください。 |

3. 全員の準備が整ったら「対戦開始」を押してください。

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

- **2025/07/17**  
  **v0.1 リリース**

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
  
  作者：かた様 → [https://x.com/cold_planet_](https://x.com/cold_planet_)

ライセンスは **Apache License 2.0** に基づき使用しています。
