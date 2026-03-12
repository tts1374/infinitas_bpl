# v1-inf-notebook-unresolved-case-dialogs

## Purpose
- `inf-notebook summary diff processed` 後に発生する未解決ケースを握りつぶさず、1件ずつダイアログ表示する。
- `unresolved_alias` は DO 送信前に停止し、今回限りの強制登録のみ許可する。

## Non-goals
- Worker / DO の WS schema や FSM の変更は行わない。
- alias 学習・恒久保存は行わない。

## Changes
- 監視差分処理サイクル完了時に未解決ケース表示イベントをキュー化し、1件ずつダイアログ表示する。
- `unresolved_alias` は「現在ラウンド登録先」と「受信リザルト解釈結果」の不一致確認 UI を出し、承認時のみ現在ラウンド譜面へ今回限りで登録する。
- `resolved_partial` / `ambiguous_recent` は登録不能通知ダイアログのみ表示し、DO 送信しない。
- `unresolved_alias` 承認・スキップ結果を必要ログ（`expected_target`, `parsed_result`, `mismatch_reason`, `user_accepted`）として残す。

## Impact
- Users: 未解決ケースの理由と結果が明示され、誤登録を抑止できる。
- Data: `unresolved_alias` の誤送信を防ぎ、承認時のみ限定的な登録を許可する。
- Compatibility: 既存 WS schema / 保存形式への互換性影響なし。
- Cloudflare: なし（client 側の送信前制御と UI 追加）。

## Target Files / Layers
- Files:
  - `apps/client/src/services/source-submission.ts`
  - `apps/client/src/features/result/*`（既存の未解決ケース表示/ダイアログ実装箇所）
  - `apps/client/src/store/*`（必要時: ダイアログキュー管理）
- Layers: client（TS/UI）

## Test Focus
- 技術的検証: client 側 typecheck/lint/test。
- 差分検証: 目的外差分なし、UTF-8 no BOM / LF 維持。
- 監視ソース検証（該当）:
  - `unresolved_alias` で DO 送信前に停止する。
  - 承認時のみ現在ラウンド譜面へ今回限り登録される。
  - `resolved_partial` / `ambiguous_recent` は登録不能通知のみとなる。
  - 同一サイクルで複数対象があっても 1件ずつ表示される。

## Rollback Plan
- 未解決ケースキューとダイアログ分岐を差し戻し、既存の送信フローへ戻す。

## Commit Split Plan
1. 未解決ケースイベントキューと `unresolved_alias` 承認フロー実装
2. `resolved_partial` / `ambiguous_recent` 通知ダイアログ実装と検証

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [ ] Documentation updates completed (if required)
