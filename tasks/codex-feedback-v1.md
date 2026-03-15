# Feedback Send Feature v1 (Plan Mode)

## 目的
- 設定画面上部右側の補助カードからフィードバック送信フォームを開けるようにする。
- `POST /api/feedback` を実装し、`bug/feature` は GitHub Issue、`other` は KV に保存する。
- 全件で Discord webhook 通知を行い、deploy workflow で Worker secret 注入を追加する。

## 非目的
- エラー時専用導線の追加
- 添付機能（ログ/画像）・返信機能・管理画面
- D1 保存・高度な重複判定・FAQ/既知不具合候補表示
- 目的外 UI 改善や広範なリファクタ

## 変更点
- client: Settings 上部右側に補助アクションカードと送信フォームを追加
- client: 種別別入力、最小バリデーション、送信中多重送信防止、成功/失敗メッセージ
- client: Worker への `POST /api/feedback` 呼び出し追加（client 情報自動付与）
- worker: `/api/feedback` ルート実装（検証/サニタイズ/文字数上限/簡易レート制限）
- worker: `bug/feature` は GitHub Issue 作成、`other` は KV 保存
- worker: 保存成功後 Discord 通知（失敗は非致命、ログに記録）
- infra: worker env/binding 反映、deploy workflow に secret put 手順追加

## 影響範囲
- ユーザー: 設定画面にフィードバック送信導線とフォームを追加
- データ: `other` は `FEEDBACK_KV` に `feedback:{timestamp}:{random}` で保存
- 互換性: 既存 API/WS 契約には影響しない（新規 HTTP エンドポイント追加）
- Cloudflare: Worker vars/secrets/binding と GitHub Actions deploy フローに影響

## 対象ファイル / レイヤ
- client: `apps/client/src/pages/SettingsPage.tsx`（必要に応じて related service/type）
- worker: `apps/worker/src/index.ts`, `apps/worker/src/routes/*`, `apps/worker/src/types/*`, `apps/worker/src/utils/*`
- worker config: `apps/worker/wrangler.toml`
- CI: `.github/workflows/deploy-worker.yml`

## テスト観点
- UI: 種別切替で必須入力が変わる、送信中ボタン無効化、成功/失敗表示
- API: 必須・上限チェック、種別分岐、失敗時レスポンス形式
- 保存: `other` の KV key/value 形式、`bug/feature` の Issue title/label/body
- 通知: 保存成功後のみ実行、通知失敗が API 成功を阻害しない
- rate limit: 1分3回制限、同一 payload 短時間連投抑止
- deploy: secret put 実行後に deploy

## ロールバック方針
- フロント導線を戻すことで UI 影響を即時撤回可能
- Worker ルートを無効化/巻き戻しで送信機能を停止可能
- deploy workflow の secret put 手順のみ個別差し戻し可能

## コミット分割計画
1. client UI + 送信クライアント実装
2. worker `/api/feedback` 実装（検証・保存分岐・通知・レート制限）
3. worker config + deploy workflow secret 注入 + 必要テスト

## 実行チェックリスト
- [ ] 設計確認（既存 worker route 規約・settings 画面構造）
- [ ] 影響範囲特定（client / worker / CI）
- [ ] 実装
- [ ] テスト
- [ ] 回帰確認
- [ ] ドキュメント更新（必要最小限）
