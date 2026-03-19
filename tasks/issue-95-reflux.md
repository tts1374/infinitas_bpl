# issue-95-reflux

## Purpose
- Reflux が出力する `latest.json` と `tracker.tsv` を取り込み、既存の結果送信フローへ統合する。
- Reflux 由来の未解決譜面を既存 `unresolved_alias` 導線に載せ、`source=Reflux` を表示可能にする。

## Non-goals
- Worker/DO のWS契約やFSMの仕様変更は行わない。
- 既存 `inf-notebook` / `inf_daken_counter` の取り込み仕様を変更しない。
- Reflux 以外の外部ツール追加や設定画面の広域リファクタは行わない。

## Changes
- 設定モデル/設定UIに Reflux 用ディレクトリ設定（`Reflux.exe` 同居フォルダ指定）を追加し、`latest.json` / `tracker.tsv` の存在検証を実装する。
- Reflux `latest.json` 監視処理を追加し、短時間待機 + 安全読込 + 重複送信抑止（内容ハッシュ主判定）を実装する。
- `tracker.tsv` の全読込キャッシュと更新時再読込を実装し、ベストスコア/ベストBPを譜面単位で解決する。
- `title` 優先 + `title2` フォールバック、`diff` 変換表による譜面同定、`playtype` 不一致時警告ログを実装する。
- 未解決ケースを既存 `unresolved_alias` 連携へ接続し、UI/内部データ双方で `source=Reflux` を扱えるようにする。
- 必要な単体テスト/既存テスト更新を追加する。

## Impact
- Users: Reflux フォルダを設定するだけでリザルト取り込みが可能になる。
- Data: 設定保存データに Reflux フォルダ情報が追加される可能性がある。
- Compatibility: 既存設定読込互換を維持しつつ新規設定項目を追加する。
- Cloudflare: なし（client / shared 中心）。

## Target Files / Layers
- Files:
  - `packages/shared/src/enums/source.ts`
  - `apps/client/src/stores/settings-store.ts`
  - `apps/client/src/pages/SettingsPage.tsx`
  - `apps/client/src/stores/source-store.ts`
  - `apps/client/src/services/*`（監視/パーサ/送信統合の局所差分）
  - `apps/client/src/components/*`（`unresolved_alias` 表示が必要な場合のみ）
  - `apps/client/src/**/*.test.ts`（追加/更新）
- Layers: client / shared

## Test Focus
- 技術的検証: client build, lint, 変更箇所テスト
- 監視ソース検証: latest.json 監視、重複抑止、JSON破損耐性、tracker.tsv 再読込
- 同定検証: title/title2 フォールバック、diff 変換、playtype 不一致警告継続
- 未解決検証: unresolved_alias 連携と `source=Reflux` 表示
- 差分検証: 目的ファイル限定、不要整形なし、UTF-8 no BOM / LF 維持

## Rollback Plan
- Reflux 追加差分（設定・監視・パーサ・UI表示）を一括revertし、既存2ソースのみ運用へ戻す。

## Commit Split Plan
1. shared/client の設定モデルとUIに Reflux 設定を追加し、入力検証と永続化を実装
2. Reflux 監視/パース/同定/ベスト値解決を既存送信経路へ統合
3. unresolved_alias 表示拡張とテスト整備

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (if required)
