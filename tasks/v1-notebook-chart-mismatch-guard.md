# v1-notebook-chart-mismatch-guard

## 目的
- inf-notebook の観測値が現在ラウンド曲と不一致の場合、誤送信を防ぐ。

## 非目的
- ソース監視方式の刷新は行わない。
- Worker/WS schema 変更は行わない。

## 変更点
- `source-submission.ts` の inf-notebook fallback 条件を厳格化し、`title_search_key` 不一致時は送信しない。
- 誤登録を誘発する fallback ログ出力を抑止（条件を満たすときのみ）。

## 影響範囲
- ユーザー: 異曲結果の誤送信が抑止される。
- データ: 誤った ROUND_CONFIRMED 発生確率が下がる。
- 互換性: 既存 schema 互換性への影響なし。
- Cloudflare: なし（client 側送信条件のみ）。

## 対象ファイル / レイヤ
- `apps/client/src/services/source-submission.ts`（client）

## テスト観点
- 型チェック/ESLint 成功。
- inf-notebook 単一観測で `play_style/difficulty` は一致しても `title_search_key` 不一致なら送信しない。

## ロールバック方針
- fallback 判定変更を元に戻す。

## コミット分割計画
1. source-submission の判定修正
2. 検証結果反映

## チェックリスト
- [x] 設計確認（該当 docs/design の確認）
- [x] 影響範囲特定（client / source watcher）
- [x] 実装
- [x] テスト
- [x] 回帰確認
