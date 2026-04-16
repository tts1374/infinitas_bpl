# AGENTS.md

## 0. Governance

本リポジトリの統治文書は次の3つ。

- `AGENTS.md` (責務境界 / 委譲契約 / 完了判定)
- `WORKFLOW.md` (Phase運用 / Plan Modeゲート / PR運用)
- `QUALITY.md` (検証マトリクス / 受け入れ基準)

競合時の優先順位:
1. `AGENTS.md`
2. `WORKFLOW.md`
3. `QUALITY.md`

ブランチ規約:
- 既定のベースブランチは `v1`
- 明示指示がない限り、作業/PR のベースは `v1`

基本原則:
- 目的達成に必要な最小差分を優先
- 目的外変更を混ぜない
- 実装・監査・要約は reviewable な粒度で返す

---

## 1. Responsibility Boundary

### 1.1 文書責務
- `AGENTS.md`: 役割境界、委譲契約、完了判定
- `WORKFLOW.md`: Phase A/B/C/D と Plan Mode の運用
- `QUALITY.md`: 検証の必須項目とリスク連動要件

### 1.2 ディレクトリローカル規約
- `apps/client/AGENTS.md`
- `apps/worker/AGENTS.md`
- `packages/shared/AGENTS.md`

ルール:
- 対象サブツリーではローカル規約を追加適用
- ローカル規約は root を弱めてはならない

### 1.3 Agent / Skill 分離
- Agent: ルーティング、判断、委譲、監査判定
- Skill: 再利用可能な定型ワークフロー

ルール:
- 判断ロジックを Skill に移譲しない
- 定型処理を Agent 個別プロンプトへ重複実装しない

### 1.4 Scope / Norm Anchoring

ルール:
- user が `Issue` / `PR` / `tasks/*.md` / design docs を正本指定した場合、その文書をスコープ境界の起点として扱う
- 正本指定がある場合、派生論点や関連改善で勝手に scope を広げない
- design docs が期待動作を既に定義している場合、意図変更でない限り docs 追加より実装整合を優先する
- docs 更新が必要なのは、仕様自体を変えるとき、または現行 docs が実態と食い違っていると確認できたときに限る

### 1.5 Sticky User Constraints

ルール:
- 同一スレッドで user が明示した制約、順序、必須 skill、spawn 要求、禁止事項、修正指摘は、明示的に解除されるまで sticky hard constraint として扱う
- user が同じ制約を再度指摘した場合、その制約は「見逃してはいけない運用ルール」に格上げし、以後の Phase / delegation / validation / close に持ち越す
- sticky constraint は、後続の Entry Protocol / delegation packet / validation plan / close plan に影響する場合、出力へ再掲または織り込む
- ローカル判断や慣例で sticky constraint を黙って上書きしない。成立不能なら `BLOCKED` / `ESCALATION` を返す

---

## 2. Sub-Agent Model (固定8役)

公開 Sub-Agent セット:
- `strategy-orchestrator`
- `spec-designer`
- `execution-coordinator`
- `front-implementer`
- `server-implementer`
- `contract-auditor`
- `implementation-auditor`
- `improvement-analyst`

役割境界:
- `strategy-orchestrator`: 入口判定、Phase分類、チーム形状決定
- `spec-designer`: 要件整形、仕様正規化、実行準備判定
- `execution-coordinator`: 実行分割、依存順、bounded packet 化
- `front/server-implementer`: 各担当レイヤの bounded 実装
- `contract/implementation-auditor`: 契約整合 / 振る舞い品質監査
- `improvement-analyst`: Phase D の優先度整理と次サイクル化

禁止:
- implementer が仕様再定義を行うこと
- auditor が実装主担当へすり替わること
- coordinator が product scope を再定義すること

---

## 3. Delegation Contract

委譲は常に bounded task で行う。

用語:
- `delegation execution plan`: spawn 前の実行意図。対象 role、ownership、spawn 条件、検証予定を示す計画情報
- `delegation execution record`: spawn/no-spawn を実際に確定した後の実行記録。`spawned: yes` の場合は agent id / ownership / status を含める

ルール:
- 将来の spawn 意図や future tense の作業予定を `delegation execution record` と呼ばない
- `delegation execution record` は実際に確定した yes/no と、その時点の根拠を持つ
- user が spawn を要求した場合、plan の提示だけで代替しない。実際に spawn するか、できない理由で `BLOCKED/ESCALATION` を返す

Delegation packet 必須項目:
- `task label`
- `objective`
- `in-scope files/layer`
- `non-goals`
- `forbidden scope`
- `expected output`
- `validation`
- `escalation`

運用ルール:
- 「必要時に委譲、非委譲理由を明示」を原則とする
- vague な issue title のみで委譲しない
- 委譲結果は `COMPLETE/BLOCKED/ESCALATION` を必須で返す

---

## 4. Write Ownership

- `1 write scope = 1 owner` を強制
- delegated 実装中、親は同一スコープを書き換えない
- 親は read-only の進行管理/監査調整に限定
- takeover が必要な場合は、停止宣言と再割当を先に明示

---

## 5. Contract-sensitive Boundary

以下は contract-sensitive として扱う:
- `RoomState`
- `CloseReason`
- `SourceType`
- WS message `type/payload`
- shared enums/constants/models
- snapshot/settings compatibility
- lobby summary schema/filtering

規範参照:
- `docs/design/01_fsm.md`
- `docs/design/02_ws_protocol.md`
- `docs/design/03_data_model.md`
- `docs/design/06_source_io_spec.md`
- `docs/design/07_constants.md`
- `docs/design/10_regression_guard_addendum.md`

ルール:
- 必要なら design docs を先に更新
- client/worker/shared を跨ぐ場合は互換方針を明示
- one-sided 変更は明示的互換戦略なしでは不可

---

## 6. Completion Judgment

### 6.1 状態語彙 (統一)
- `READY`
- `NOT_READY`
- `WAITING_FOR_HUMAN_DECISION`
- `COMPLETE`
- `BLOCKED`
- `ESCALATION`

### 6.2 監査 severity (統一)
- `Blocker`
- `Must fix`
- `Should fix`
- `Note`

### 6.3 完了条件
タスク完了は次を満たすときのみ:
- 依頼スコープを満たす
- 差分が最小かつ意図的
- `QUALITY.md` 必須検証が完了
- 目的外差分がない
- delegated 必須出力が返却済み
- 未解決 `Blocker` がない
- 未解決 `Must fix` は明示的な再スコープ/延期がある

---

## 7. Diff Discipline

- 無関係な整形、リネーム、並び替えは禁止
- lockfile は依存更新意図がある場合のみ変更可
- 生成物の直接編集はしない
- 追加スコープが必要なら最小拡張 + 理由明示

---

## 8. Agent Definition Source of Truth

- 正本は `.codex/agents/*.toml`
- Agent 定義更新時は `npm run check:agents` を必須実行
- `.toml` の意味差分がある場合、必要に応じて `AGENTS.md` / `WORKFLOW.md` / `QUALITY.md` も同時更新
