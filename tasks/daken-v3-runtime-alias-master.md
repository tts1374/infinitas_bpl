# Runtime Alias Master Fetch (daken v3 / inf-notebook / reflux)

- [ ] 設計確認（既存の alias exact 判定との整合）
- [ ] 影響範囲特定（client / worker / tauri parser）
- [ ] 実装
- [ ] テスト
- [ ] 回帰確認

## 目的
- 打鍵カウンタv3 / inf-notebook / reflux の alias 解決を、クライアント同梱 JSON ではなく worker のランタイムデータから取得する。
- alias は `trim` 後の厳密一致で扱う。

## 非目的
- Room FSM / WS プロトコル / DO 振る舞いの変更。
- 既存の chart search API の仕様変更。
- 監視ソース全体の再設計。

## 変更点
- worker に「alias exact 解決」用の軽量 GET API を追加する。
- worker 側は既存マスタ情報を使って `alias(trim exact) + play_style + difficulty` から `alias_exists` と候補 `title_search_key[]` を返す。
- client の daken v3 照合は、ランタイム API で得た候補に `expected_key.title_search_key` が含まれるかで alias 一致判定する。
- Tauri parser (inf-notebook / reflux) でもランタイム API を使う。
- Tauri parser はメモリキャッシュ（TTL）を持ち、TTL経過時に再取得してマスタ更新へ追従する。
- API 失敗時はキャッシュ済み値または既存静的カタログへフォールバックして挙動維持する。

## 影響範囲
- ユーザー: マスタ更新反映のためのアプリ更新依存が緩和される。
- データ: 永続データ形式の変更なし。
- 互換性: 既存 API は維持し、新規 API 追加のみ。
- Cloudflare: Worker ルート追加（読み取り専用、DO/KV 変更なし）。

## 対象ファイル / 対象レイヤ
- worker:
  - `apps/worker/src/master/chart-master.ts`
  - `apps/worker/src/services/chart-alias-resolver.ts`（新規）
  - `apps/worker/src/routes/chart-aliases.ts`（新規）
  - `apps/worker/src/index.ts`
- client:
  - `apps/client/src/services/worker-api-client.ts`
  - `apps/client/src/stores/source-store.ts`
- tauri parser:
  - `apps/client/src-tauri/src/models/source_watcher.rs`
  - `apps/client/src-tauri/src/watchers/mod.rs`
  - `apps/client/src-tauri/src/parsers/mod.rs`
  - `apps/client/src-tauri/src/parsers/runtime_alias.rs`（新規）
  - `apps/client/src-tauri/src/parsers/notebook.rs`
  - `apps/client/src-tauri/src/parsers/reflux.rs`
  - `apps/client/src-tauri/Cargo.toml` / `Cargo.lock`

## テスト観点
- worker unit: alias exact の 0件/1件/複数候補ケース。
- worker route: 必須クエリ不足時の 400、正常時の 200。
- client typecheck/lint: 追加 API 呼び出しを含めてコンパイル通過。
- tauri build/type check: parser 追加依存を含めてコンパイル通過。
- 実データ確認: `LOVE SHINE / DP / ANOTHER` が `love♥shine` 候補に解決できること。
- TTL再取得: キャッシュ期限後に再取得処理へ入ること（ログ確認）。

## ロールバック方針
- 新規 route の配線を外し、client 側のランタイム呼び出しを削除すれば即時復帰可能。
- tauri parser 側の runtime resolver を外し、静的カタログのみに戻せる。
- 永続スキーマ変更は無いためデータ移行不要。

## コミット分割計画
1. worker: alias exact resolver + API route 追加
2. client: runtime alias 解決呼び出しへ切替
3. tauri parser: runtime alias resolver (TTL cache) 追加
4. 検証・必要最小のテスト調整
