# リポジトリ構成・責務分割（Ph1）

## 0. 目的
Ph1 実装に向けて、リポジトリ構成・各アプリ/パッケージの責務・依存方向を固定する。  
本ドキュメントは、実装計画書および PR 分割の基礎とする。

---

## 1. 方針
- **monorepo** とする
- クライアント・サーバ・共有型を分離する
- 共有仕様は `packages/shared` に集約する
- UI / ローカル監視 / Worker / DO を責務分離する
- 1PR1目的で実装しやすい構成にする

---

## 2. 想定ルート構成

```text
repo-root/
  apps/
    client/
    worker/
  packages/
    shared/
  docs/
    design/
  scripts/
  .github/
````

---

## 3. apps/client

## 3.1 目的

Tauri 2 + React + TypeScript によるクライアントアプリを配置する。
Windows デスクトップアプリとして動作し、以下を担当する。

* UI表示
* WebSocket通信
* ローカル設定保存
* 音声再生
* ローカル結果保存
* Rust 側 watcher との連携

---

## 3.2 想定構成

```text
apps/client/
  src/
    app/
    pages/
    components/
    features/
    hooks/
    services/
    stores/
    types/
    utils/
  src-tauri/
    src/
      main.rs
      commands/
      watchers/
      parsers/
      models/
      storage/
  public/
  package.json
  tsconfig.json
  vite.config.ts
  tauri.conf.json
```

---

## 3.3 React/TypeScript 側の責務

### pages

画面単位の責務を持つ。

想定:

* `SettingsPage`
* `LobbyPage`
* `RoomPage`

### components

再利用UI部品。

想定:

* PlayerList
* RoomSummary
* TimerView
* RoundStatus
* ErrorDialog
* SourceStatusBadge

### features

画面横断の機能責務。

想定:

* room
* lobby
* settings
* voice
* result-export

### hooks

フロント専用hook。

想定:

* useWebSocket
* useRoomState
* useVoiceQueue
* useSourceStatus

### services

外部接続・永続化・音声など。

想定:

* wsClient
* localSettingsService
* localResultStore
* workerApiClient（HTTP）
* tauriBridge

### stores

状態管理。
Ph1では Zustand を想定。

想定:

* roomStore
* lobbyStore
* settingsStore
* sourceStore

---

## 3.4 Rust 側（src-tauri）の責務

### commands

Tauri command 定義。

想定:

* 設定読取/保存
* watcher開始/停止
* source状態取得

### watchers

ローカルファイル監視。

想定:

* `inf_daken_counter_watcher.rs`
* `inf_notebook_watcher.rs`

### parsers

監視ファイルの解析。

想定:

* `today_update_xml_parser.rs`
* `export_recent_json_parser.rs`
* `records_recent_json_parser.rs`

### models

Rust 側の監視イベント/設定モデル。

### storage

ローカル設定/ローカル結果JSONの保存処理。

---

## 3.5 apps/client の依存

* `packages/shared`
* Tauri APIs
* ローカル watcher（Rust側）

---

## 4. apps/worker

## 4.1 目的

Cloudflare Workers + Durable Objects + KV によるサーバ側を配置する。
Worker は入口、DO はルーム状態管理本体とする。

---

## 4.2 想定構成

```text
apps/worker/
  src/
    index.ts
    routes/
    durable/
    services/
    kv/
    utils/
    types/
  wrangler.toml
  package.json
  tsconfig.json
```

---

## 4.3 Worker 側の責務

### index.ts

* Worker エントリポイント
* ルーティング初期化

### routes

HTTP / WS Upgrade の入口。

想定:

* `rooms.ts`

  * `POST /api/rooms`
  * `GET /api/rooms`
  * `GET /api/rooms/:room_id/ws`

### services

* room 作成補助
* join_code 生成
* cursor pagination
* request validation

### kv

* 公開ロビー用 KV I/O
* 軽量メタ登録/削除
* `expires_at` の扱い

### utils

* エラー整形
* レスポンス生成
* validation補助

---

## 4.4 Durable Object 側の責務

```text
apps/worker/src/durable/
  room-object.ts
  room-fsm.ts
  room-state.ts
  room-timers.ts
  room-broadcast.ts
  room-aggregation.ts
```

### room-object.ts

* DO本体
* WebSocket accept
* クライアント接続管理
* メッセージ受信入口

### room-fsm.ts

* RoomState 遷移
* READY_CHECK/PICKING/PLAYING/RESULT/CLOSED 制御

### room-state.ts

* DO内部状態管理
* players / picks / rounds / submissions / deadlines

### room-timers.ts

* READY_CHECK TTL
* round soft TTL
* host skip unlock
* match TTL
* result TTL

### room-broadcast.ts

* ルーム内イベント配信
* snapshot送信
* 状態更新通知

### room-aggregation.ts

* ARENA 配点
* BPL BO3 集計
* RESULT生成

---

## 4.5 apps/worker の依存

* `packages/shared`
* Cloudflare Workers runtime
* Durable Objects
* KV

---

## 5. packages/shared

## 5.1 目的

クライアントと Worker/DO で共有する型・定数・仕様を配置する。

---

## 5.2 想定構成

```text
packages/shared/
  src/
    constants/
    enums/
    models/
    ws/
    room/
    source/
    errors/
  package.json
  tsconfig.json
```

---

## 5.3 内容

### constants

* `07_constants.md` に対応する共有定数
* タイマー値
* join_code 長さ/文字集合
* page size
* metric値
* エラーコード

### enums

* RoomState
* Visibility
* Mode
* WinMetric
* SourceType
* SubmissionStatus
* SkipReason

### models

* RoomSettings
* Player
* ExpectedKey
* FrozenRound
* Submission
* RoomSnapshot
* UnmatchedTitleLog

### ws

* WS message schema
* Client->Server envelope
* Server->Client envelope
* メッセージ種別定義

### room

* FSM関連の共有型
* 集計結果型
* ラウンド状態型

### source

* 監視イベント型
* source設定型
* parser出力型

### errors

* エラーコード定義
* エラーpayload型

---

## 6. docs/design

## 6.1 目的

設計文書を配置する。

想定:

* `01_fsm.md`
* `02_ws_protocol.md`
* `03_data_model.md`
* `04_tech_stack.md`
* `05_screen_list.md`
* `06_source_io_spec.md`
* `07_constants.md`
* `08_repo_structure.md`
* `09_implementation_plan.md`

---

## 7. scripts

## 7.1 目的

開発補助スクリプトを配置する。

想定:

* ローカル起動補助
* lint / format / typecheck 実行
* join_code テスト
* fixture 生成
* source監視テスト

---

## 8. .github

## 8.1 目的

CI/CD 設定を配置する。

Ph1 想定:

* lint
* typecheck
* build
* worker deploy（将来）
* tauri build（将来）

---

## 9. 依存方向

依存方向は以下に固定する。

* `apps/client` -> `packages/shared`
* `apps/worker` -> `packages/shared`
* `packages/shared` -> 外部ランタイム非依存

禁止:

* `apps/client` -> `apps/worker`
* `apps/worker` -> `apps/client`

これにより責務分離を維持する。

---

## 10. 実装上の補足

## 10.1 source監視

* 実体は `apps/client/src-tauri/watchers` に配置
* React 側は watcher 実装詳細を知らず、イベントだけ受け取る

## 10.2 Worker/DO

* Worker は薄く保つ
* 状態・ロジックは Durable Object に寄せる

## 10.3 共通仕様

* RoomState
* WS schema
* 定数
* エラーコード
  は `packages/shared` を正とする

---

## 11. Ph1 で作らないもの

以下はPh1では対象外。

* 認証基盤
* D1/R2 利用
* 複数端末同一プレイヤー統合
* 未同定手動補正UI
* 画像共有
* OBS専用UIの作り込み
* 高度な監査ログ
* 公開ロビーの強化機能