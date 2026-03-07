## 目的

- `Settings` 画面を `C:\work\infinitas_arena\wireframe` の Mock に合わせて再構成する。
- 左サイドナビを含む `App` 骨格を Mock ベースの見た目へ更新する。
- 設定モデルを拡張し、音量・ミュートと監視元ディレクトリ指定を扱えるようにする。

BASE_SHA: `bd741bc9a4f14e0aec16c27a628e769ed4f669f9`

## 非目的

- Room / Lobby / Stats 全面の完全リデザイン
- Worker / Durable Objects / WebSocket schema の変更
- 監視ソースのパース仕様変更

## 変更点

- `apps/client` に Mock 用 UI 依存を追加する。
- `App.tsx` のヘッダー/サイドナビ構造を Mock ベースへ差し替える。
- `SettingsPage.tsx` を Mock レイアウトへ差し替え、既存設定項目を必要最小限で再配置する。
- `settings-store.ts` に音量・ミュート・監視元ディレクトリを追加し、既存保存データとの互換を維持する。
- 必要に応じて Tauri 側にディレクトリ選択コマンドを追加する。
- watcher 起動時はディレクトリ指定から実ファイルパスを導出する。

## 影響範囲

- ユーザー: Settings 画面とアプリ全体のナビ見た目が変わる
- データ: localStorage の settings 保存形式が拡張される
- 互換性: 既存 settings を壊さない移行が必要
- Cloudflare: 影響なし

## 対象ファイル / 対象レイヤ

- client: `apps/client/src/app/App.tsx`
- client: `apps/client/src/pages/SettingsPage.tsx`
- client: `apps/client/src/stores/settings-store.ts`
- client: `apps/client/src/stores/source-store.ts`
- client: `apps/client/src/services/tauri-bridge.ts`
- client: `apps/client/src/styles.css`
- client tauri: `apps/client/src-tauri/src/*`
- client deps: `apps/client/package.json`, ルート `package-lock.json`

## テスト観点

- [ ] client typecheck が通る
- [ ] client build が通る
- [ ] Tauri Rust 側がコンパイル可能
- [ ] 既存 settings が読み込める
- [ ] source ごとにディレクトリ指定から watcher 対象パスが正しく導出される
- [ ] ルーム参加中の source 変更ロックが維持される

## ロールバック方針

- UI 変更と settings 拡張を単一ブランチ内で戻す
- 互換問題があれば新規追加フィールドを無視し、従来 `sourcePaths` 読み込みへ戻す

## コミット分割計画

- [ ] UI 依存と Tauri ブリッジ準備
- [ ] settings モデル拡張と watcher 入力変換
- [ ] App / Settings UI の Mock 反映
- [ ] ビルド・型検証
