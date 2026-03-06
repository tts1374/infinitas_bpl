# FSM設計（Ph1 / Cloudflare Workers + Durable Objects）

## 0. 前提（実装基盤）
- ルーム = 1 Durable Object（以下 DO）
- Worker は HTTP/WS の入口（ルーティングのみ）。FSMはDO内で完結。
- ルーム一覧（公開ロビー）は Cloudflare KV に軽量保存する（DOに負荷を寄せない）。
- 先着順・時刻基準は DO の `Date.now()` を正とする（単一実体なので整合が取れる）。

## 1. 識別子
- `room_id`: UUID（表示・参照用）
- `durable_object_id`: `idFromName(room_id)` のように room_id から決定（安定ルーティング）
- `join_code`: 任意（短い文字列）。公開/非公開に関わらず設定可能。

## 2. 用語
- ルーム: 対戦セッション単位（DOインスタンス）
- ホスト: ルーム作成者（固定。落ちたら解散）
- プレイヤー: 参加者（最大4）
- ラウンド: PLAYING中の1譜面単位（譜面リストのindex）

## 3. ルーム状態（RoomState）
- `LOBBY`
- `READY_CHECK`
- `PICKING`
- `PLAYING`
- `RESULT`
- `CLOSED`

### 状態遷移（概要）
- ルーム作成完了時に `READY_CHECK` を開始する（新規作成フローでは `LOBBY` に留まらない）
- `LOBBY` -> `READY_CHECK`（互換用。ホスト操作）
- `READY_CHECK` -> `PICKING`（ホスト `START`。条件: players>=2）
- `PICKING` -> `PLAYING`（DOが確定譜面リストを凍結して遷移）
- `PLAYING` -> `PLAYING`（全員確定で次ラウンドへ）
- `PLAYING` -> `RESULT`（全ラウンド消化 or match_ttl到達）
- `RESULT` -> `CLOSED`（ホスト解散 or result_ttl到達）
- 任意状態 -> `CLOSED`（ホスト切断/終了、ready_check_ttl超過）

## 4. タイマー（固定値 / DOが管理）
- `ready_check_ttl = 20min`（READY_CHECK開始から。超過で解散）
- `round_soft_ttl = 5min`（各ラウンド開始から。超過で未確定者をTIMEOUT確定）
- `host_skip_unlock_seconds = 240s`（ラウンド開始から4分経過後にホスト代理SKIP可）
- `match_ttl = 30min`（PICKING開始またはPLAYING開始から。どちら基準かは実装で1つに固定）
- `result_ttl = 5min`（RESULT開始から。超過でCLOSED）
- `rejoin_cooldown = 10s`（退出後の同一ルーム再入室抑止。クライアント/UI側でも表示）

## 5. ルーム作成設定（RoomSettings / Ph1）
- `visibility`: `PUBLIC | UNLISTED | PRIVATE`
- `join_code`: string|null
- `mode`: `ARENA | BPL`
- `win_metric`: `SCORE | MISSCOUNT`
- `play_style`: `SP | DP`
- `level_filter`: `ANY | LV8_10 | LV10 | LV11 | LV12`
- `room_comment`: string
- `max_players`: `2 | 3 | 4`

### 公開ロビー（KV）
- `visibility != PRIVATE` のルームはロビーに掲載（KVへ登録）
- KVには「軽量メタ」だけを保存（詳細状態はDOが保持）
  - room_id, join_code有無（値は保存しない）, mode, play_style, level_filter, win_metric, room_comment, max_players, created_at, expires_at
- ルーム終了（CLOSED）時にKVから削除

## 6. LOBBY（参加・設定閲覧）
- 参加/退出は自由（最大 `max_players`）
- ホストのみ `READY_CHECK` を開ける
- `visibility=PRIVATE` の場合は join_code必須（入口のWorkerで弾くか、DOで弾くかを統一）
- Ph1 の通常 create フローではルーム作成直後に `READY_CHECK` へ遷移済みであり、画面滞在は想定しない

## 7. READY_CHECK（開始準備）
### ルール
- `players < 2` の間は `START` 押下不可（ホストUIでdisabled、DOでも拒否）
- `ready=false` の参加者が 1 人でもいる間は `START` 押下不可（ホストUIでdisabled、DOでも拒否）
- `START` はホストのみ（確認ダイアログなしで可）
- READY_CHECK中は参加・退出可能（最大 `max_players`）
- `ready_check_ttl` 超過: `CLOSED`（解散）

### 「4募集→2開始」要件
- `max_players` は募集枠/検索用
- 実際の人数確定はホスト `START` 時点の参加者数で確定
- `START` 実行で以後参加不可（席ロック）。退出は可能（退出者は以後TIMEOUT扱い）

## 8. PICKING（指名・凍結）
### 8.1 指名ルール
- 各プレイヤーは 1譜面指名（`pick_chart_key`）
- 指名は DO の受信時刻（DOが付与）で先着順
- 同一譜面重複は許可しない
  - 重複検出時、後着の枠だけ DO が同フィルタで「未使用譜面」を抽選し差し替え
- 確定後に「凍結リスト（frozen_rounds）」を全員へ配布し、以後変更不可

### 8.2 凍結リスト構築
- ARENA: 参加人数 = ラウンド数（各自1譜面）
- BPL: BO3固定
  - 2人想定: `P1指名 + P2指名 + ランダム1`（同フィルタ、未使用から抽選）
  - Ph1暫定: DO内に譜面マスタを持たない間は、ランダム枠に一意なプレースホルダ expected_key を割り当てる
- 凍結時に各ラウンドへ `expected_key` を確定して埋める
  - `expected_key = (play_style, difficulty, title_search_key)`

## 9. PLAYING（ラウンド進行）
### 9.1 ラウンド確定状態（PlayerRoundState）
各ラウンドで各プレイヤーは次のいずれかに到達したら確定:
- `PLAYED`（リザルト採用）
- `SKIPPED`（本人 or 条件解禁後のホスト代理）
- `TIMEOUT`（round_soft_ttl超過 or FORCE_ADVANCE）

### 9.2 expected一致（誤採用防止）
- 各ラウンドに `expected_key` を保持
- 受理するリザルトは `observed_key == expected_key` のみ
- 許容窓: `accept_window_rounds = 0`（当該ラウンドのみ）

### 9.3 提出採用（初回のみ）
- 1ラウンドにつき 1プレイヤーの採用は「初回のみ」
- 既に `PLAYED/SKIPPED/TIMEOUT` のプレイヤーからの追加提出は拒否（ログには残してよいが勝敗に使わない）

### 9.4 代理SKIP（悪用防止）
- `round_started_at + host_skip_unlock_seconds` 以降
- 未確定者に対してのみホストが `SKIP` を付与可能
- SKIP理由は必須: `UNOWNED | TECH | OTHER`
- 代理付与ログを結果に残す（付与者ID/時刻）

### 9.5 強制進行（FORCE_ADVANCE）
- ホストのみ
- クライアントは確認ダイアログ必須
- DOは未確定者を全員 `TIMEOUT` として確定し次ラウンドへ（最終ならRESULTへ）

### 9.6 タイムアウト処理
- `round_soft_ttl` 到達で未確定者は `TIMEOUT`
- `match_ttl` 到達で進行中ラウンドも含めて未確定を `TIMEOUT` 確定し `RESULT` へ遷移
- `RESULT` 遷移後は提出を受理しない

### 9.7 離脱
- PLAYING開始後の新規参加は不可
- PLAYING中に退出したプレイヤーは、その時点で未確定なら `TIMEOUT`、以後のラウンドも `TIMEOUT` として扱う
- ホスト切断: 即 `CLOSED`

## 10. RESULT（集計）
### 10.1 勝敗指標
- `win_metric=SCORE`: EX SCOREが大きいほど勝ち
- `win_metric=MISSCOUNT`: misscount(bp)が小さいほど勝ち
- `SKIPPED/TIMEOUT` の値:
  - SCORE: 0
  - MISSCOUNT: 9999

### 10.2 ARENA配点（方針A）
- rank1: 2pt
- rank2: 1pt
- rank3/4: 0pt
- 同点は同順位、順位飛ばしあり（競技標準）
  - 例: 2人同率1位 → 2,2,0,0

### 10.3 BPL（BO3）
- 各ラウンド勝者が1勝
- 先に2勝で勝利
- 同点（SCORE同値 / MISSCOUNT同値）は「勝ち数加算なし」
- BO3終了時に同勝ち数なら総合引き分け

## 11. CLOSED（解散）
- `RESULT` から `result_ttl` 超過で `CLOSED`
- ホスト操作で即 `CLOSED` も可
- 部分結果は各クライアントのローカル保存（snapshot）で表示可能とする
- `CLOSED` 遷移時にKVのロビー情報を削除する
