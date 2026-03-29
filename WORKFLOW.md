## 0. 基本原則

- 1PR1目的。
- 目的外変更は分離する。
- 変更は常に最小差分を優先する。
- 局所修正は、計画書より実装修正を優先する。
- 状態機械（Room FSM / WS protocol / timers / aggregation）を壊す変更は単独PRで扱う。
- `v1` を基本ブランチとする。
- Agent 定義は **`.codex/agents/*.toml` を正本として更新する**。
- Sub-Agent を使う場合でも、1タスク1目的・最小差分・明示スコープの原則は変わらない。

---

## 1. 実行モード

作業は以下のどちらかで進める。

### A. Local Execution Mode
対象が局所的で、既存仕様や責務分割を変えない変更。

例:
- UI文言修正
- i18n修正
- 局所バリデーション修正
- 小さな表示崩れ修正
- 既存テストの補強
- ローカルなバグ修正（影響範囲が限定的なもの）

この場合:
- `tasks/*.md` は不要
- 長い事前計画は不要
- 直接関連するファイルから着手する
- 実装後に必要な検証だけ行う

### B. Plan Mode
高リスク、複数層、互換性影響、運用影響がある変更。

この場合のみ、実装前に `tasks/<branch-or-pr-name>.md` を作成する。

---

## 2. Plan Mode の必須条件

以下のいずれかに該当する場合は Plan Mode 必須。

- アーキテクチャ変更
- Durable Objects の FSM / タイマー / 集計 / 権限制御変更
- WebSocket message schema 変更（type/payload）
- 監視ソース I/O 仕様変更（`inf_daken_counter` / `inf-notebook`）
- ロビー一覧（`LobbyDirectoryDO`）のスキーマ / 取得 / フィルタ変更
- 保存形式 / 互換性に影響する変更（settings / result snapshot）
- CI / デプロイ変更（Wrangler / Workers / DO）
- 依存関係更新（lockfile含む）
- client / worker / shared をまたぐクロスレイヤ変更
- セキュリティ・再現性・整合性に影響する変更
- docs/design の規範仕様を変更してから実装する必要がある変更
- Sub-Agent の責務境界や委譲方式そのものを変更する場合
- Agent 定義（`.codex/agents/*.toml`）で、役割・入力・出力・禁止事項・成功条件のいずれかに意味差分が入る場合

以下は原則として **Plan Mode 不要**。

- 単一ファイル中心の局所修正
- 既存責務内のバグ修正
- UI表示だけの修正
- 文言、翻訳、軽微なバリデーション変更
- テスト追加のみ（仕様変更を伴わないもの）
- 既存 Agent 定義の誤字修正や説明改善のみで、意味差分がない場合
- `.toml` の意味差分を伴わない軽微な文言修正のみの場合

---

## 3. Plan Mode の記載内容

`tasks/<branch-or-pr-name>.md` には最低限以下を記載する。

- 目的
- 非目的
- 変更点
- 影響範囲（ユーザー / データ / 互換性 / Cloudflare）
- 対象ファイル / 対象レイヤ
- テスト観点
- ロールバック方針
- コミット分割計画

### 記載形式（例）

- [ ] 設計確認（該当 docs/design の確認）
- [ ] 影響範囲特定（client / worker / shared / lobby directory）
- [ ] 実装
- [ ] テスト
- [ ] 回帰確認
- [ ] ドキュメント更新

### 3.1 Multi-agent task の追記事項
Sub-Agent を使う Plan Mode では、上記に加えて以下も記載する。

- 入口担当（通常は `strategy-orchestrator`）
- 実行担当（`execution-coordinator` / implementer / auditor）
- 委譲単位
- 委譲順序
- 各 subtask の完了条件
- 監査の要否
- Blocker / Must fix / Should fix / Note の扱い
- 正本更新の有無（`.toml`）

### 3.2 Phase A 人間判断ゲート
要件整形（Phase A）で人間判断が必要な論点が残る場合は、以下を必須とする。

- `Pending decisions` が1件でもある場合、Readiness は必ず `not ready` とする
- `specification-confirmed issue update` を確定扱いで投稿しない
- その時点で停止し、`Decision Gate (Human Required)` を提示する
- 選択肢は相互排他的な 2〜3 案を提示し、推奨案を明示する
- ステータスは `WAITING_FOR_HUMAN_DECISION` とし、人間の選択が入るまで Stage B へ進めない

推奨フォーマット:

```md
### Decision Gate (Human Required)
Decision: <決める項目>

Option A (Recommended):
- 内容:
- 影響:

Option B:
- 内容:
- 影響:

Option C:
- 内容:
- 影響:

Status: WAITING_FOR_HUMAN_DECISION
```

### 3.3 Sub-Agent 解決契約
Sub-Agent 呼び出し時の識別子解決は、`.codex/agents/*.toml` の `name` を唯一のキーとする。

ルール:
- 呼び出しは `name` を指定する（例: `strategy-orchestrator`）
- `name` は kebab-case を必須とする
- `.toml` のファイル名ベースは `name` と一致させる

検証:
- `npm run check:agents` で `name` / ファイル名の整合と snake_case 別名混入を検証する
- CI でも同チェックを必須化する

---

## 4. 初手探索の制限

初手では広く調査しない。

ルール:
- まず直接関連するファイルから確認する
- 初回探索は最大3ファイルまたは3検索を目安とする
- 根拠が不足する場合のみ探索範囲を広げる
- リポジトリ全体の広域探索をデフォルトにしない
- 「まず全部読む」は禁止

---

## 5. コミット方針

### 5.1 Local Execution Mode
- 実装前に詳細なコミット計画を必須としない
- 変更が局所的なら、実装 → 検証 → 要約で進める
- 必要に応じて1〜2論理コミットにまとめる
- 作業途中の未整理コミットを量産しない

### 5.2 Plan Mode
- 実装前にコミット粒度を明示する
- 計画内の1項目 = 1論理コミットを原則とする
- 作業単位が完了したら逐次コミットする
- `git status` は各コミット前にクリーンであること
- 機械生成差分と手動修正を混在させない
- 整形のみの変更は別PR

例:
1. shared型/定数追加
2. DOロジック追加
3. client UI 追加
4. watcher 追加
5. テスト追加
6. ドキュメント更新

### 5.3 Agent 定義変更時のコミット方針
Agent 定義を変更する場合は、原則として以下の順で扱う。

1. `.codex/agents/*.toml` 正本更新
2. 必要なら `AGENTS.md` / `WORKFLOW.md` / `QUALITY.md` の関連更新
3. 整合確認

意味差分を含む場合:
- 正本更新コミットと governance 更新コミットを分けてもよい
- ただしレビュー時に対応関係が明確であること

意味差分を含まない単純同期の場合:
- 1論理コミットにまとめてよい

---

## 6. worktree / ブランチ運用

- 実装タスクやPR作業は `git worktree` による物理分離を推奨する
- 1 worktree = 1 branch = 1 purpose
- 基本ブランチは `v1`
- 高リスク変更やPR作業では BASE_SHA を固定する
- 軽量なレビュー、調査、文面作成では worktree 運用を必須にしない

---

## 7. 差分規律

- 変更対象に必要な差分だけを含める
- 目的外変更を混ぜない
- 無関係な整形・並び替え・リネームを行わない
- 宣言したスコープを越える場合は、なぜ必要かを明示する
- 生成物（`dist` 等）を直接編集しない
- 依存更新の意図がない限り lockfile を触らない

### 7.1 Agent 定義差分規律
Agent 定義変更時は以下を守る。

- `.toml` 側だけで role behavior を増やさない
- `Mission / Inputs / Process / Output / Prohibited / Success condition` の意味整合を崩さない
- 人間可読説明と実行設定で矛盾した model / reasoning / role boundary を残さない

### 7.2 Scope を越える場合
- Agent 変更のつもりが governance 変更に及ぶ場合は、`AGENTS.md` / `WORKFLOW.md` / `QUALITY.md` の更新要否を再判定する
- implementer 変更のつもりが orchestrator / auditor の責務変更に及ぶ場合は、局所修正として処理しない

---

## 8. 検証規律

完了条件は `QUALITY.md` に従う。

特に以下を守る。

- ビルド成功
- Lintエラーなし
- テスト成功
- 不要な依存追加なし
- 変更対象以外に diff が存在しない
- 無関係な整形変更なし
- UTF-8 (no BOM) / LF 逸脱がない

高リスク変更では、必要に応じて以下も確認する。

- FSM/Protocol 検証
- 監視ソース検証
- 最低限のE2E
- DO state loss / lobby listing / expected_key enforcement / idempotency

### 8.1 Agent 定義変更時の検証
Agent 定義変更時は、通常の差分検証に加えて以下を確認する。

- `.toml` の定義が一意である
- 役割境界が root `AGENTS.md` と矛盾しない
- `name` / `description` / `model` / `model_reasoning_effort` / `developer_instructions` が `.toml` 正本で整合している
- 禁止事項や成功条件が `.toml` 側で脱落していない
- `.toml` にだけ存在する新しい判断ルールがない

### 8.2 Multi-agent 実行時の検証
Sub-Agent を使った実行では、必要に応じて以下も確認する。

- 委譲 packet が bounded である
- 返却物に completion status がある
- 監査結果が severity 分類されている
- Blocker が未解決のまま完了扱いされていない
- Must fix の扱いが明示されている
- broader follow-up が現タスクへ無断混入していない

---

## 9. PR本文テンプレート

PRには以下を含める。

- 目的
- 変更点
- 非変更点
- 影響範囲（ユーザー / データ / 互換性 / Cloudflare）
- テスト内容
- 回帰確認項目

高リスク変更では追加で以下を含める。

- ロールバック方針
- 互換性影響の有無
- Cloudflare resources 影響
- docs/design 更新有無

### 9.1 Agent / governance 変更時の追加項目
Agent 定義や統治文書を変えるPRでは、追加で以下を含める。

- `.toml` 正本更新有無
- 役割境界変更の有無
- 既存 Agent への影響
- 試運転要否
- 導入順（例: 4役先行 → auditor 追加）

---

## 10. 完了条件（ワークフロー観点）

- 計画が必要な変更では、計画通りの差分のみ存在する
- Local Execution Mode では、要求に必要な最小差分のみ存在する
- 目的外変更がない
- QUALITY基準を満たす
- `git status` がクリーンである

### 10.1 Agent 定義更新の完了条件
Agent 定義更新は、以下を満たしたときに完了とする。

- `.toml` 正本が更新済み
- root `AGENTS.md` と責務境界が矛盾していない
- 関連する `WORKFLOW.md` / `QUALITY.md` の更新要否を確認済み
- レビュー可能な差分説明がある

### 10.2 Multi-agent タスクの完了条件
Sub-Agent を使うタスクは、以下を満たしたときに完了とする。

- 必要な委譲結果が全て返却済み
- required audit がある場合、その結果が返却済み
- Blocker が未解決でない
- Must fix を残す場合は、スコープ見直しまたは明示的 defer がされている
- completion / blocked / escalation の状態が明示されている

---

## 11. 初期試運転手順

Sub-Agent 運用の初期試運転は、以下の順で行う。

### 11.1 第1段階
まず以下の4役のみで回す。

- `strategy-orchestrator`
- `execution-coordinator`
- `front-implementer`
- `server-implementer`

目的:
- intake 判定が安定するか
- bounded task 化が安定するか
- implementer が勝手にスコープ再定義しないか
- execution coordinator の分割粒度が妥当か

### 11.2 第2段階
次に監査2役を追加する。

- `contract-auditor`
- `implementation-auditor`

目的:
- 監査観点が重複しすぎないか
- severity 分類が機能するか
- implementation 結果を監査で閉じられるか
- broader follow-up を別建てに分離できるか

### 11.3 試運転向けタスク条件
初回試運転タスクは以下を満たすものを選ぶ。

- 小〜中規模
- `client` または `worker` の片側中心、または軽い cross-layer
- shared breaking change を含まない
- FSM / timer / lifecycle の中核変更を含まない
- 成功条件が明文化しやすい
- 実装後に差分・検証・監査が追いやすい

避けるもの:
- Room FSM 改変
- WS contract 変更
- settings / snapshot 互換変更
- source I/O 仕様変更
- CI/CD 変更
- Agent 基盤自身の大改修と同時実装

### 11.4 運用開始可の判定
以下を満たしたら運用開始可とみなす。

- 入口担当が安定して判定できる
- execution coordinator が bounded task を安定生成できる
- implementer の返却物が reviewable
- auditor の返却物が severity 分類される
- `.toml` 正本ルールで破綻しない
- 完了 / blocked / escalation の判定が揺れない
