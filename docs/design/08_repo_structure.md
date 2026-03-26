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
  testdata/
  .github/
```

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
    components/
    debug/
    dev/
    features/
    hooks/
    pages/
    runtime/
    services/
    stores/
    utils/
  src-tauri/
    src/
      commands/
      models/
      parsers/
      watchers/
      lib.rs
      main.rs
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
* `StatsPage`

### components

再利用UI部品。

想定:

* `AppSidebar`
* `ErrorDialog`
* `SourceUnresolvedDialog`

### features

画面横断の機能責務。

想定:

* `stats`
* `settings`

### hooks

フロント専用hook。

想定:

* `useSettingsStore`
* `useRoomStore`
* `useSourceStore`

### services

外部接続・永続化・音声など。

想定:

* `ws-client`
* `worker-api-client`
* `source-submission`
* `voice-announcer`
* `result-archive`
* `stats-archive`
* `tauri-bridge`
* `e2e-observability`

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

* `watchers/mod.rs`（source別 watch 対象解決と manager を集約）

### parsers

監視ファイルの解析。

想定:

* `daken.rs`
* `notebook.rs`
* `reflux.rs`
* `runtime_alias.rs`

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

Cloudflare Workers + Durable Objects によるサーバ側を配置する。
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
  * `GET /api/rooms/:room_id/ws`
  * `GET /api/rooms/:room_id/charts`
* `lobby.ts`

  * `GET /api/lobby`
* `charts.ts`

  * `GET /api/charts`
* `song-packs.ts`

  * `GET /api/song-packs`
* `chart-aliases.ts`

  * `GET /api/chart-aliases/resolve`
* `feedback.ts`

  * `POST /api/feedback`

### services

* room 作成補助
* 譜面検索 / song pack 一覧
* alias exact 解決
* feedback 受付・通知
* request validation
* LobbyDirectoryDO 呼び出し

### utils

* エラー整形
* レスポンス生成
* validation補助

---

## 4.4 Durable Object 側の責務

```text
apps/worker/src/durable/
  room-object.ts
  lobby-directory-object.ts
  room-state.ts
  result-rating.ts
  ws-codec.ts
```

### room-object.ts

* DO本体
* WebSocket accept
* クライアント接続管理
* メッセージ受信入口

### room-state.ts

* DO内部状態管理
* players / picks / rounds / submissions / deadlines
* LOBBY 内 ready 管理 / PICKING / PLAYING / RESULT の進行データ

### result-rating.ts

* rated 可否判定
* ARENA 配点 / BPL・BPL4 集計
* RESULT_READY 用のレーティング情報生成

### ws-codec.ts

* WS envelope の decode/encode 補助

---

## 4.5 apps/worker の依存

* `packages/shared`
* Cloudflare Workers runtime
* Durable Objects

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
    errors/
    models/
    ws/
  package.json
  tsconfig.json
```

---

## 5.3 内容

### constants

* `07_constants.md` に対応する共有定数
* タイマー値
* join_code 長さ/文字集合
* lobby polling 間隔
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
* RoomStateSnapshot
* UnmatchedTitleLog
* SongUnlockSettings / MatchSongUnlockFilter
* ChartSearch / SongPack

### ws

* WS message schema
* Client->Server envelope
* Server->Client envelope
* メッセージ種別定義

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
* `10_regression_guard_addendum.md`
* `09_implementation_plan.md`（historical / frozen）

---

## 7. scripts

## 7.1 目的

開発補助スクリプトを配置する。

想定:

* `build_worker_chart_master.py`
* `run-local-e2e.ps1`
* `start-local-two-clients.ps1`
* `start-daken-counter-v3-mock.ps1`
* `apply-notebook-unresolved-fixture.ps1`
* `verify-notebook-unresolved-dialogs.ps1`
* `scripts/release/*`

## 7.2 testdata

ローカルE2E用 fixture を `testdata/e2e/` に配置する。
source別（reflux / daken_counter_v3 / inf-notebook / mixed）の再現データを保持する。

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

* file watcher 実体は `apps/client/src-tauri/watchers/mod.rs` に配置（`inf-notebook` / `reflux` / legacy `inf_daken_counter`）
* `daken_counter_v3` は React/TS 側 `source-store` が local WebSocket で監視する
* React 側は parser/watcher 実装詳細を知らず、イベントだけ受け取る

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
* 恒久的な alias 学習/管理UI
* 画像共有
* OBS専用UIの作り込み
* 高度な監査ログ
* 公開ロビーの強化機能
