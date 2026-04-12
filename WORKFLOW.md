# WORKFLOW.md

## 0. Purpose

この文書は、Phase運用と Plan Mode ゲートを定義する。

設計方針:
- **Phase** はライフサイクル管理
- **Plan Mode** は実行前ゲート
- 両者は直交運用する（`PhaseA = Plan Mode` にはしない）

### 0.1 Entry Protocol

新規着手時は、実作業の前に最低限次を固定する:
- `Stage`
- `affected layers`
- `contract-sensitive` 該当有無
- `execution profile` (`Local-Fast / Standard / High-Risk`)
- `Plan Mode` 要否
- 適用した root/local `AGENTS.md`
- `Spawn Gate` 適用結果
- `No-delegate reason`（非委譲時のみ）

ルール:
- 入口判定を省略したまま実装/再計画へ進まない
- `Issue` / `tasks/*.md` / design docs が正本指定されている場合、Entry Protocol でその正本を明記する
- Entry Protocol の出力は短くてよいが、後続の Phase 判断を再現できる粒度で残す

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

### 6.1 Standard Spawn Gate

適用条件:
- `execution profile = Standard`

次のいずれかに当てはまる場合は `execution-coordinator` を委譲候補として扱う:
- 2レイヤ以上にまたがる
- bounded task が曖昧
- 実装が 2 task 以上へ分割される
- 検証が typecheck/lint 以外へ広がる

次の条件をすべて満たす場合のみ non-spawn で進行可:
- 単一レイヤ
- 単一 bounded task
- contract-sensitive ではない
- ローカル検証で完結する

ルール:
- non-spawn で進行する場合は `No-delegate reason` を必ず残す
- 実行中に cross-layer 化や契約影響が判明したら `High-Risk` に再分類する

### 6.2 High-Risk Spawn Gate

適用条件:
- `execution profile = High-Risk`

必須:
- Phase B を完了し、bounded packet を確定する
- 実装担当を委譲する
  - client 変更あり: `front-implementer`
  - worker 変更あり: `server-implementer`
  - 両方あり: 両方
- 監査担当を委譲する
  - `contract-auditor`
  - `implementation-auditor`

ルール:
- 必須ロール未委譲のまま `COMPLETE` を返してはならない
- 例外的に non-spawn とする場合は `ESCALATION` とし、理由を明示する

### 6.3 C Kickoff Gate

Phase C 開始前に次を必ず出力する:
- 実行プロファイル再判定
- Spawn Gate 適用結果
- `delegation execution record`
  - `role`
  - `spawned: yes/no`
  - `objective`
  - `no-delegate reason`（`no` の場合）

ルール:
- C Kickoff 出力完了まで Phase C 実装を開始してはならない
- 必須ロール未委譲の場合は `BLOCKED` で停止する
- Plan成果物がない場合は、C Kickoff 冒頭で `A-lite` 合意サマリを再掲して境界を固定する
- ひな型が必要な場合は `docs/c_kickoff_comment_template.md` を使用してよい

### 6.4 Replan Gate

次のいずれかが発生した場合は Phase C/D を停止し、Phase A/B へ戻す:
- 新たな contract-sensitive 変更が必要
- in-scope 外への拡張が必須
- `Blocker` / `Must fix` 解消に仕様判断が必要
- 互換方針 / 依存 / CI 変更が必要

ルール:
- 戻し時の状態は `ESCALATION` または `WAITING_FOR_HUMAN_DECISION` を明示する
- 合意が得られるまで Phase C/D を再開しない

### 6.5 Phase D Follow-up Protocol

Phase D で follow-up を起票または起票準備する場合は、優先度だけで終わらせず `Issue-ready artifact` まで整える。

最低限の記載:
- 背景
- 目的
- 非目的
- acceptance criteria
- target layer/files
- validation
- `execution profile` 推奨
- `Plan Mode` 推奨
- kickoff-ready な `delegation execution record` または `No-delegate reason`

ルール:
- 今サイクル外へ出す項目は、次スレッドでそのまま Phase A/B を再開できる粒度にする
- ひな型が必要な場合は `docs/issue_ready_followup_template.md` を使用してよい

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
- Milestone 管理 Issue では同テンプレ内の「Milestone監査ログ（Issue↔PR対応表）」を併記する
- follow-up を別Issue化した場合は、Issue 本文または起票コメントに `Issue-ready artifact` 相当の境界情報を残す

---

## 8. Agent Definition Workflow

- `.codex/agents/*.toml` が正本
- `name` は kebab-case / filename と一致
- `npm run check:agents` をローカル/CIで必須
- 旧 role 名の互換 alias は作らない
