# 実装計画書（Ph1）

## 0. 目的
Ph1 の実装範囲、作業順序、PR 分割、完了条件を定義する。  
本計画は以下の設計文書を前提とする。

- `01_fsm.md`
- `02_ws_protocol.md`
- `03_data_model.md`
- `04_tech_stack.md`
- `05_screen_list.md`
- `06_source_io_spec.md`
- `07_constants.md`
- `08_repo_structure.md`

---

## 1. Ph1 のゴール

Ph1 の完成条件は以下とする。

- Tauri 2 + React + TypeScript クライアントが起動できる
- Cloudflare Worker + Durable Object + KV が動作する
- ロビー作成・一覧取得・入室ができる
- READY_CHECK -> PICKING -> PLAYING -> RESULT の一連の遷移が成立する
- ARENA / BPL（3 STAGE）が動作する
- SCORE / MISSCOUNT の勝敗判定が動作する
- `inf_daken_counter` / `inf-notebook` の両ソースで監視提出ができる
- expected一致による採用制御ができる
- TECH / UNOWNED / OTHER / TIMEOUT が反映される
- 強制進行、ホスト代理SKIPが動作する
- ローカル結果JSON保存ができる
- DO状態喪失時にエラーダイアログと解散が成立する

---

## 2. 実装方針

## 2.1 基本方針
- 1PR1目的
- 共有仕様を先に固定し、各層へ展開する
- Worker は薄く、DO にロジックを寄せる
- watcher と UI は分離する
- 先に「最小で動く縦切り」を通し、後から監視・演出・UIを厚くする

## 2.2 優先順位
1. 共有型 / 定数
2. Worker / DO の最小起動
3. FSM とロビー
4. PICKING / PLAYING / RESULT
5. クライアント最小UI
6. ローカル watcher
7. 音声通知 / エラーダイアログ / 保存強化

---

## 3. 作業フェーズ

### フェーズA: 基盤
- monorepo 作成
- package manager / build / typecheck 設定
- `packages/shared` 整備
- Tauri クライアント雛形
- Worker 雛形
- Wrangler 設定
- KV / DO namespace 定義

### フェーズB: サーバ中核
- `POST /api/rooms`
- `GET /api/rooms`
- `GET /api/rooms/:room_id/ws`
- DO 接続管理
- ROOM_JOIN / LEAVE
- LOBBY / READY_CHECK
- START_MATCH
- KV ロビー登録 / 削除

### フェーズC: ゲーム進行
- PICK_SUBMIT
- 重複解決
- PICK_FROZEN
- ROUND_BEGIN
- RESULT_SUBMIT
- SKIP_SELF
- SKIP_HOST_ASSIGN
- FORCE_ADVANCE
- round_soft_ttl / match_ttl / result_ttl
- RESULT 集計

### フェーズD: クライアントUI
- 設定画面
- ロビー一覧
- ルーム画面
- エラーダイアログ
- source 状態表示
- ローカル設定保存

### フェーズE: 監視ソース
- Rust watcher 基盤
- `inf-notebook` 対応
- `inf_daken_counter` 対応
- parser
- 新規イベント判定
- observed_key 生成
- WS への提出連携

### フェーズF: 仕上げ
- 音声通知
- ローカル結果JSON保存
- DO状態喪失時の復帰/解散
- 手動テスト
- 最低限の自動テスト
- ドキュメント補完

---

## 4. PR 分割案

## PR-0: ワークスペース基盤
### 目的
monorepo の骨格と開発基盤を作る。

### 対象
- `apps/client`
- `apps/worker`
- `packages/shared`
- package manager 設定
- typecheck / lint / format

### 完了条件
- install できる
- client / worker / shared がビルド通る
- CI最小（typecheck/lint）が通る

---

## PR-1: shared 定義
### 目的
全体の共有型・定数・WS schema を先に固定する。

### 対象
- RoomState
- RoomSettings
- ExpectedKey
- FrozenRound
- Submission
- RoomStateSnapshot
- WS envelope
- message type
- error code
- constants

### 完了条件
- `packages/shared` の型が参照可能
- client / worker の双方で import できる
- `07_constants.md` 相当がコード化される

---

## PR-2: Worker 入口 + ルーム作成/一覧
### 目的
HTTP API と KV 一覧を作る。

### 対象
- `POST /api/rooms`
- `GET /api/rooms`
- join_code 生成
- KV put/delete
- expires_at 運用
- cursor / limit=10

### 完了条件
- ルーム作成できる
- 一覧取得できる
- PRIVATE は一覧に出ない
- expired room は一覧から除外される

---

## PR-3: DO 接続管理 + LOBBY
### 目的
WS 接続と LOBBY を成立させる。

### 対象
- WS upgrade
- DO ルーティング
- ROOM_JOIN / ROOM_LEAVE
- ROOM_JOIN_ACCEPTED / REJECTED
- ROOM_UPDATED
- host 判定
- max_players / room_full 判定

### 完了条件
- クライアントが room_id で接続できる
- 参加/退出ができる
- host 固定が成立する
- 同一 room に複数人接続できる

---

## PR-4: READY_CHECK
### 目的
開始準備フェーズを実装する。

### 対象
- READY_CHECK_OPEN
- READY_SET
- START_MATCH
- `players >= 2` ガード
- ready_check_ttl
- 解散

### 完了条件
- ホストのみ READY_CHECK 開始できる
- READY 状態が全員に反映される
- `players < 2` では START 不可
- 20分タイムアウトで解散する

---

## PR-5: PICKING
### 目的
選曲と凍結を成立させる。

### 対象
- PICK_SUBMIT
- 先着順
- 重複検出
- 後着差し替え
- frozen_rounds 生成
- ARENA / BPL の round 構築

### 完了条件
- 各プレイヤーが1譜面指名できる
- 同一譜面重複時に DO 側で解決される
- 凍結リストが配信される

---

## PR-5.5: read-only 譜面マスタ参照
### 目的
DO から read-only の譜面マスタを参照できるようにし、凍結譜面を実譜面ベースで確定できるようにする。

### 対象
- `iidx_all_songs_master` release の取り込み経路
- server 側 read-only 参照データの配置
- DO からの譜面/曲参照
- `pick_chart_key` の実譜面解決
- BPL random 1 の実譜面選出
- `expected_key` / display の master 由来確定

### 完了条件
- DO が read-only マスタを参照できる
- `pick_chart_key` から実譜面を解決できる
- BPL random 1 が実譜面ベースで確定できる
- `frozen_rounds.expected_key` と display が master 由来で埋まる

---

## PR-6: PLAYING 基本進行
### 目的
ラウンド進行と提出の骨格を作る。

### 対象
- ROUND_BEGIN
- RESULT_SUBMIT
- current_round 管理
- round_soft_ttl
- match_ttl
- accept_window=0
- expected一致判定
- 初回のみ採用

### 完了条件
- expected一致した提出だけ採用される
- mismatch は弾かれる
- round_soft_ttl 超過で TIMEOUT になる
- match_ttl 超過で RESULT へ遷移する

---

## PR-7: SKIP / FORCE_ADVANCE / RESULT 集計
### 目的
ラウンド確定手段と結果集計を完成させる。

### 対象
- SKIP_SELF
- SKIP_HOST_ASSIGN
- host_skip_unlock_seconds
- FORCE_ADVANCE
- ARENA 配点
- BPL 3 STAGE 集計
- RESULT_READY

### 完了条件
- 自分で SKIP できる
- 4分経過後にホスト代理SKIPができる
- 強制進行が動く
- ARENA / BPL の結果が表示可能な形で返る

---

## PR-8: クライアント最小UI
### 目的
Ph1 最小の画面操作を可能にする。

### 対象
- SettingsPage
- LobbyPage
- RoomPage
- WebSocket client
- roomStore / settingsStore / lobbyStore
- ErrorDialog

### 完了条件
- 設定保存できる
- ロビー一覧を見られる
- ルーム作成/参加できる
- RoomState ごとに画面が切り替わる

---

## PR-9: Rust watcher 基盤
### 目的
Tauri Rust 側で file watcher と parser 基盤を作る。

### 対象
- watcher start/stop
- source path 設定
- parser interface
- event bridge（Rust -> React）

### 完了条件
- sourceごとの watcher を起動できる
- 変更イベントが React 側へ届く

---

## PR-10: inf-notebook 対応
### 目的
`inf-notebook` から提出できるようにする。

### 対象
- `export/recent.json` parser
- last_seen timestamp
- observed_key 生成
- SCORE / MISSCOUNT 抽出
- RESULT_SUBMIT 連携

### 完了条件
- notebook ソースで自動提出できる
- expected一致時のみ採用される
- parse失敗で SOURCE_UNAVAILABLE 扱いになる

---

## PR-11: inf_daken_counter 対応
### 目的
`inf_daken_counter` から提出できるようにする。

### 対象
- `today_update.xml` parser
- difficulty 略記変換
- fingerprint 判定
- observed_key 生成
- SCORE / MISSCOUNT 抽出
- RESULT_SUBMIT 連携

### 完了条件
- daken_counter ソースで自動提出できる
- expected一致時のみ採用される
- parse失敗で SOURCE_UNAVAILABLE 扱いになる

---

## PR-12: 音声通知 / ローカル保存 / 最終仕上げ
### 目的
Ph1 体験を成立させる。

### 対象
- Stage 音声
- countdown 音声
- START 音声
- 状態遷移時の音声停止
- ラウンドごとの RoomStateSnapshot ローカル保存
- ROOM_STATE_LOST ダイアログ
- 手動検証補助

### 完了条件
- 音声が仕様通り鳴る
- 状態遷移時に音声キューが破棄される
- 部分結果がローカル保存される
- DO状態消失時に解散/ダイアログが動く

---

## 5. 実装順序の推奨

### 先行実装
- PR-0
- PR-1
- PR-2
- PR-3
- PR-4
- PR-5
- PR-5.5
- PR-6
- PR-7

ここまでで、UI無しでも「ルーム進行ロジック」がほぼ成立する。

### 次点
- PR-8
- PR-9
- PR-10
- PR-11

ここで実際にプレイ提出まで通る。

### 最後
- PR-12

---

## 6. テスト方針

## 6.1 手動テスト（必須）
- 2人で ARENA 開始
- 2人で BPL 開始
- START 不可条件 (`players < 2`)
- PICK 重複差し替え
- expected mismatch 不採用
- round_soft_ttl TIMEOUT
- host 代理SKIP（4分前後）
- FORCE_ADVANCE
- host切断で解散
- SOURCE_UNAVAILABLE
- ROOM_STATE_LOST

## 6.2 自動テスト（優先）
### Worker/DO
- join_code 生成
- KV一覧フィルタ
- state transition
- expected一致判定
- ARENA配点
- BPL集計

### Rust parser
- export/recent.json parsing
- today_update.xml parsing
- title normalize
- difficulty 変換
- fingerprint 判定

---

## 7. 完了判定（Ph1 Done）
以下が満たされたら Ph1 完了とする。

- 2人でルーム作成から結果表示まで通せる
- 両ソースで提出が通る
- SCORE / MISSCOUNT 両方で勝敗が取れる
- ARENA / BPL が成立する
- 強制進行 / 代理SKIP / TIMEOUT が動く
- ローカル保存された結果を再表示できる
- ロビー作成/一覧/参加が実用レベルで成立する
