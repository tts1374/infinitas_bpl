# WORKFLOW.md

## 0. Purpose

この文書は、Phase運用と Plan Mode ゲートを定義する。

設計方針:
- **Phase** はライフサイクル管理
- **Plan Mode** は実行前ゲート
- 両者は直交運用する（`PhaseA = Plan Mode` にはしない）

---

## 1. Phase Model (A/B/C/D)

- **A — Requirement shaping**
  - アイデア/曖昧要求を仕様確定可能な形に整える
- **B — Execution planning**
  - 仕様を bounded 実行計画に落とす
- **C — Implementation and audit**
  - bounded 実装 + 必要監査 + 必要検証
- **D — Closure and release preparation**
  - follow-up 抽出、次サイクル化、リリース準備入力整理

---

## 2. Plan Mode Gate

Plan Mode は「実装前に計画成果物を必須化するゲート」。

### 2.1 Plan Mode 必須条件
次のいずれかに該当する場合は Plan Mode 必須:
- アーキテクチャ変更
- Worker/DO の FSM / timer / aggregation 変更
- WS schema (`type/payload`) 変更
- source I/O 仕様変更
- lobby summary schema/filter 変更
- settings/snapshot 互換影響
- CI/CD / Wrangler / Workers/DO 構成変更
- 依存更新（lockfile 含む）
- client/worker/shared を跨ぐ変更
- docs/design の規範仕様を先に更新すべき変更
- Sub-Agent の責務境界/委譲方式変更
- `.codex/agents/*.toml` の意味差分（role/input/output/prohibited/success）

### 2.2 Plan Mode 省略候補
原則として省略可能:
- 単一ファイル中心の局所修正
- 既存責務内のバグ修正
- 文言/UI 表示のみ修正
- 仕様変更を伴わないテスト追加
- `.toml` の誤字修正など意味差分なし変更

---

## 3. Execution Profiles

### 3.1 Local-Fast (A-lite -> C)
適用:
- 局所・低リスク
- bounded 実装が自明

ルール:
- Phase A は最小確認のみ（A-lite）
- Phase B を省略可
- Plan Mode 不要

### 3.2 Standard (A -> B -> C)
適用:
- 中規模、または影響範囲が複数ファイル

ルール:
- A で仕様境界確定
- B で bounded packet 化
- C で実装/検証

### 3.3 High-Risk (A -> B[Plan必須] -> C[監査必須] -> D)
適用:
- contract-sensitive 変更
- cross-layer 変更
- 互換影響や運用影響が大きい変更

ルール:
- Plan Mode 必須
- 監査（contract/implementation）を必須化
- D で follow-up と release input を分離

---

## 4. Phase Exit Criteria

### 4.1 A -> B
必須:
- `fixed decisions`
- `pending decisions`
- `in-scope / out-of-scope`
- `acceptance criteria`
- `execution readiness`

判定:
- pending decision が残る場合は `NOT_READY`
- 人間判断待ちは `WAITING_FOR_HUMAN_DECISION`

### 4.2 B -> C
必須:
- implementer が再解釈なしで開始できる bounded packet
- 依存順/検証期待が明示されている

### 4.3 C -> D
必須:
- 実装結果が reviewable
- required validation 完了
- required audit 完了
- 状態が `COMPLETE/BLOCKED/ESCALATION` で明示

---

## 5. Plan Artifact (Plan Mode 時)

Plan Mode では `tasks/<branch-or-pr-name>.md` を作成する。

最低限の記載:
- 目的
- 非目的
- 変更点
- 影響範囲（ユーザー/データ/互換性/Cloudflare）
- 対象レイヤ/対象ファイル
- validation plan
- rollback 方針
- commit 分割方針
- delegation packet（必要時）

---

## 6. Delegation Workflow

- 入口は通常 `strategy-orchestrator`
- 仕様整形が必要なら `spec-designer`
- 実行分割が必要なら `execution-coordinator`
- 実装は `front/server-implementer`
- 監査は `contract/implementation-auditor`
- 閉じ処理は `improvement-analyst`

ルール:
- 委譲は必要時のみ
- 非委譲時は理由を明示
- open-ended 指示は禁止

---

## 7. PR / Closure Rules

PR 本文には次を必須で含める:
- 目的
- 変更点
- 非変更点
- 影響範囲
- 検証内容
- 回帰確認

高リスク変更では追加:
- rollback 方針
- 互換影響
- Cloudflare resources 影響
- docs/design 更新有無

Issue クローズ時:
- `docs/issue_close_evidence_template.md` の証跡を必須記載

---

## 8. Agent Definition Workflow

- `.codex/agents/*.toml` が正本
- `name` は kebab-case / filename と一致
- `npm run check:agents` をローカル/CIで必須
- 旧 role 名の互換 alias は作らない