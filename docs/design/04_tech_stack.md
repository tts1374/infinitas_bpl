# 技術選定メモ（Ph1）

## 0. 目的
beatmania IIDX INFINITAS 向け対戦アプリの Ph1 実装にあたり、
技術スタック・責務分離・実装方針を固定する。

Ph1 では以下を重視する。

- ローカルファイル監視との親和性
- WebSocket によるルーム同期
- FSM/状態管理の明確化
- AI コーディング資産の多さ
- Windows デスクトップアプリとしての現実性
- 低コストでの試験運用

---

## 1. 採用技術

### 1.1 クライアント
- **Tauri 2**
- **React**
- **TypeScript**
- **Vite**

### 1.2 サーバ
- **Cloudflare Workers**
- **Durable Objects**
- **LobbyDirectoryDO（Durable Object）**

### 1.3 共通
- **TypeScript**
- 共通型は `packages/shared` に配置

---

## 2. 採用理由

### 2.1 Tauri 2 + React + TypeScript を採用する理由
- Flet よりも一般的で、AI コーディング資産が豊富
- React/TypeScript は UI 実装・状態管理・型共有に向く
- デスクトップアプリとして軽量
- ローカルファイル監視を Rust 側へ分離できる
- 将来的な UI 作り込みにも対応しやすい

### 2.2 Cloudflare Workers + Durable Objects を採用する理由
- 少人数・低トラフィックで無料枠から試しやすい
- ルーム単位の状態管理と Durable Object のモデルが相性良い
- WebSocket を用いたリアルタイム同期に対応できる
- EC2 常駐よりも初期コストを抑えやすい
- 「ルーム = 1DO」として FSM を素直に実装できる

### 2.3 LobbyDirectoryDO を採用する理由
- 公開ロビー一覧の正本を DO storage に集約し、反映遅延を抑制できる
- KV の最終整合依存を排除し、ルーム更新と一覧反映を同一 DO 契約で扱える
- TTL 清掃と表示条件フィルタを一覧正本側で一元管理できる

---

## 3. 非採用技術と理由

### 3.1 Flet
- AI コーディング資産が少ない
- UI の一般性・将来拡張性で React 系に劣る
- 今回はメジャー技術へ寄せる方針とする

### 3.2 Electron
- React/TypeScript 資産は豊富だが、Tauri より重い
- Ph1 の要件では Tauri の方が「あるべき論」に近い
- ただし、将来必要なら再検討余地はある

### 3.3 AWS Lambda + API Gateway
- 前資産では採用していたが、今回はルームFSM・タイマー・常時接続管理が主役
- 今回は Durable Objects の方が設計に適する
- Lambda + DynamoDB + WebSocket 管理は構成が複雑化しやすい

### 3.4 EC2 常駐サーバ
- Ph1 では低コスト試行を優先
- 後から移行可能な設計にしておけば、初手の常駐VMは不要

---

## 4. 責務分離

## 4.1 クライアント（Tauri）
クライアントは以下の責務を持つ。

- UI表示
- WebSocket 接続
- ローカル設定保存
- ローカル結果保存（JSON）
- 音声再生
- 監視対象ファイルの変更検知
- 監視データの解析結果をフロントへ通知

### Rust 側の責務
- file watcher
- JSON/XML 読み取り
- 新規イベント判定
- フロントエンドへのイベント通知

### React / TypeScript 側の責務
- 画面描画
- 状態管理
- WebSocket 通信
- 音声通知
- ローカル設定UI
- ローカル保存JSONの管理

---

## 4.2 サーバ（Cloudflare）
サーバは以下の責務を持つ。

### Worker の責務
- HTTP エンドポイント提供
- WebSocket Upgrade の入口
- room_id に応じて DO へルーティング
- 公開ロビー一覧の取得（LobbyDirectoryDO 取得 + TTL 清掃 + フィルタ）

### Durable Object の責務
- ルーム状態の保持
- FSM 遷移
- LOBBY 内 ready 管理 / PICKING / PLAYING / RESULT 制御
- タイマー管理
- 提出受理
- expected一致判定
- FORCE_ADVANCE（未確定者の強制 `TIMEOUT` 確定）
- `SKIP_HOST_ASSIGN` は予約メッセージとして保持するが、現行v1では無効
- 結果集計
- ルーム内ブロードキャスト
- 一覧要約（`LobbyRoomSummary`）の生成と `LobbyDirectoryDO` への通知
- `ttlStartedAt` を含む寿命起点の維持

### LobbyDirectoryDO の責務
- 公開ロビー一覧の正本保持（storage 永続化 / constructor 復元）
- 一覧取得時と更新時の TTL 清掃
- 表示条件（公開・非満員・LOBBY・TTL 未超過）のフィルタ
- `upsertRoom` / `removeRoom` による RoomDO からの更新受理

---

## 5. ソース監視方針

Ph1 では **2ソース対応** とする。

### 対応ソース
- `inf_daken_counter`
- `inf-notebook`

### 制約
- **1端末1ソース固定**
- ソースは事前設定で選択
- ルーム参加中は変更不可

### 監視異常時
- `SOURCE_UNAVAILABLE` を表示
- TECH スキップ誘導とする

---

## 6. 認証なし運用方針

Ph1 では認証を導入しない。

### player_id
- 端末ローカル生成 UUID
- 初回起動時に生成し永続保存

### display_name
- ローカル保存
- 重複許容

---

## 7. join_code 方針

### 仕様
- 長さ: 8
- 文字集合: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- 自動生成: 可
- 手入力: 可
- 比較時: 大文字化して比較
- 重複時: 再生成

---

## 8. room_comment 方針

### 仕様
- 最大 80文字
- 改行なし
- 空文字可

---

## 9. WebSocket 運用方針

### ping/pong
- `PICKING/PLAYING` 中のみ、ホストクライアントから 20秒ごとに PING
- 2回無応答相当を切断検知の目安とする

### 切断
- プレイヤー切断時は状態更新
- ホスト切断時はルーム解散

---

## 10. ローカル保存方針

### 保存対象
- プレイヤー設定
- ソース設定
- player_id
- display_name
- ローカル保存された結果JSON

### 結果保存
- ラウンド確定ごとに `RoomStateSnapshot` を保存
- JSON 形式のみ
- OBS出力用HTMLや結果表示は JSON から生成する

---

## 11. Cloudflare 環境構成（Ph1）

- Workers: 1
- Durable Object Namespace: 2（RoomDO / LobbyDirectoryDO）
- D1: 使用しない
- R2: 使用しない
- Queue: 使用しない

---

## 12. 将来拡張時の移行前提

将来的に以下へ移行可能なように設計する。

- Cloudflare Paid Plan
- 別ホスティング（EC2/ECS等）
- 認証導入
- D1/外部DB導入
- 公開ロビー強化
- UI強化
- BPL BO5
- 画像生成/共有機能

Ph1 ではこれらを見越しつつも、最小構成で実装する。
