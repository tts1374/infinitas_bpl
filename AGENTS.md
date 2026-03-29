## 0. Governance

This project is governed by the following documents:

- `AGENTS.md` (execution constraints)
- `WORKFLOW.md` (planning and PR rules)
- `QUALITY.md` (acceptance criteria)

If any conflict occurs:
1. `AGENTS.md`
2. `WORKFLOW.md`
3. `QUALITY.md`

### Branch
- Default working branch is **`v1`** (not `main`).
- Unless explicitly instructed otherwise, all work/PRs must use **`v1`** as the base branch.

### Execution priority
Primary objective: satisfy the requested change with the **smallest correct diff**.

---

## 1. Execution Policy

Rules:
- Start from the most directly related file(s) only.
- Do not expand investigation unless local evidence is insufficient.
- Do not rewrite, rename, reorder, or broadly refactor unrelated areas.
- Do not stop at “inspection only” when the requested change is local and implementable in the same pass.
- Prefer concrete fixes over broad design exploration unless the task explicitly requests design work.
- Keep all changes within the declared scope unless a minimal justified scope expansion is required.

### 1.1 Search Budget
For the first pass:
- inspect at most **3 files** or perform at most **3 focused searches**
- if the cause is still unclear, expand incrementally
- avoid repository-wide exploration unless clearly necessary

### 1.2 Allowed Default Behavior
Without explicit request, the default is:
- local analysis
- local implementation
- local validation
- concise summary of changed files and verification

### 1.3 Prohibited Default Behavior
Unless the task explicitly requires it:
- no broad architecture review
- no speculative “best practice” rewrite
- no unrelated cleanup
- no formatting-only changes
- no mass search across the repo at the start

---

## 2. Delegation Model

This repository may use specialized sub-agents for planning, implementation, and audit.

Rules:
- The **strategy orchestrator** is the default entry point for non-trivial tasks.
- Delegate **bounded tasks only**.
- Do not give a sub-agent an open-ended “solve the whole issue” instruction unless the task is explicitly scoped that way.
- Reusable workflows should be implemented as **Skills** rather than duplicated in agent prompts.
- Sub-agents must follow the same repository governance documents as the primary agent.

### 2.1 Default routing
Use specialized agents only when they provide clear value.

Examples:
- planning / task decomposition
- client-only implementation
- worker / DO-only implementation
- contract audit
- implementation audit

### 2.2 Responsibility boundary
- Root `AGENTS.md` defines repository-wide execution rules.
- Directory-local `AGENTS.md` files define stronger local invariants for their subtree.
- Sub-agent definitions define role-specific behavior, not repository-wide truth.

### 2.3 Agent definition source of truth
Sub-agent definitions are maintained as execution specs:
- `.codex/agents/*.toml`

Rules:
- `.codex/agents/*.toml` is the **canonical source of truth** for each sub-agent.
- Reviews touching agent definitions must verify `.toml` integrity in mission, scope, inputs, outputs, prohibitions, and success conditions.

### 2.4 Orchestration boundary
Role boundaries are fixed as follows:

- **strategy orchestrator**
  - owns intake classification
  - determines phase routing
  - determines task scale and delegation topology
  - decides whether the task remains local, requires planning, or requires multi-agent handling
  - does not perform open-ended implementation by default when orchestration value is higher than direct editing

- **execution coordinator**
  - turns approved scope into executable bounded tasks
  - determines execution order, dependency order, and integration order
  - prepares implementation-ready task packets for implementers
  - does not redefine product scope, contract intent, or normative design direction on its own

- **implementers**
  - execute the bounded task they are given
  - may propose minimal necessary scope expansion only when local evidence requires it
  - must not silently redefine contract, scope, or architecture

- **contract auditors**
  - audit contract compliance, interface consistency, compatibility, and spec conformance
  - do not perform broad implementation critique unless it directly affects contract correctness

- **implementation auditors**
  - audit implementation quality, completeness, validation adequacy, and unintended diff risk
  - do not redefine normative contract intent unless a clear contract violation is present

### 2.5 Delegation packet requirement
Every delegated implementation or audit task must be bounded and should include, at minimum:

- task identifier or short label
- objective
- in-scope files or layer
- explicit non-goals
- relevant spec sources of truth
- affected layers (`client`, `worker`, `shared`, docs, CI, etc.)
- expected output
- validation expectation
- escalation conditions

Do not delegate with only a vague issue title when a concrete bounded packet can be prepared first.

### 2.6 Phase model and transition rule
Use the following repository-wide phases:

- **A — Requirement shaping**
  - from idea / vague issue to specification-ready issue
- **B — Execution planning**
  - from specification-ready issue to execution-ready bounded plan
- **C — Implementation and audit**
  - from bounded plan to reviewable implementation state
- **D — Closure and release preparation**
  - from reviewed implementation result to follow-up shaping, release preparation, and next-cycle improvements

Phase boundaries:

- **A -> B**
  - allowed only when a specification-confirmed state exists
  - practical boundary: an implementation-ready specification comment or equivalent normalized issue update exists
  - must make explicit:
    - fixed decisions
    - pending decisions
    - in-scope / out-of-scope
    - acceptance criteria
    - execution readiness

- **B -> C**
  - allowed only when bounded execution framing exists
  - implementers must be able to start without re-deriving scope or redesigning the task
  - task breakdown belongs to Phase B, not Phase C

- **C -> D**
  - allowed only when implementation, required validation, and required audit outputs are available in reviewable form

Rules:
- Do not bypass unresolved requirement work by jumping from Phase A directly to implementers.
- Do not bypass bounded execution planning by jumping from Phase B ambiguity into Phase C implementation.
- Release execution may be outside repository-phase routing, but release preparation belongs to Phase D.

### 2.7 Agent and Skill responsibility rule
Use the following responsibility split:

- **Agents**
  - own intake, routing, judgment, delegation topology, and bounded handoff framing
- **Skills**
  - own reusable workflows, normalization patterns, and repeated check/transform routines

Rules:
- Do not duplicate stable reusable workflows across multiple agent prompts when they can be represented as Skills.
- Do not use Skills as a substitute for routing or delegation judgment.
- When root governance and Skills already define a stable workflow, prompts should carry only task-specific delta whenever practical.

### 2.8 Delegated write ownership rule
Rules:
- Enforce `1 write scope = 1 owner`.
- While a delegated implementer owns a write scope, the parent agent must not edit that same file/subtree.
- During delegated implementation, the parent agent is limited to read-only coordination work (progress tracking, audit routing, validation planning).
- If delegated execution is delayed or stalled, do not switch the parent agent to direct implementation by default; resolve by wait extension, follow-up instruction, or replacement delegation.
- If parent takeover is exceptionally required, first declare delegation stop and reason, then reassign write ownership explicitly before editing.

---

## 3. System Architecture (Ph1)

### 3.1 Client
- Tauri 2 + React + TypeScript (Vite)
- Local file watching/parsing in Rust
- UI + WS + audio + local storage in TypeScript

### 3.2 Server
- Cloudflare Workers (HTTP entry)
- Durable Objects (Room FSM + timers + aggregation + WS broadcast)
- `LobbyDirectoryDO` is the source of truth for public lobby summaries

### 3.3 Sources (fixed per device)
- SourceType: `inf_daken_counter` / `inf-notebook` / `daken_counter_v3` / `reflux`
- `inf_daken_counter` is legacy/deprecated and may be rejected in disabled configurations

Source is selected before joining a room and MUST NOT be changed while in a room.

---

## 4. Spec Sources of Truth

These design docs are normative. Implementation MUST match them.

- `docs/design/01_fsm.md`
- `docs/design/02_ws_protocol.md`
- `docs/design/03_data_model.md`
- `docs/design/04_tech_stack.md`
- `docs/design/05_screen_list.md`
- `docs/design/06_source_io_spec.md`
- `docs/design/07_constants.md`
- `docs/design/08_repo_structure.md`
- `docs/design/10_regression_guard_addendum.md`

Historical only:
- `docs/design/09_implementation_plan.md` is frozen reference only and is not a normative spec source.

Rules:
- If implementation must deviate, update the relevant design doc(s) first, then implement.
- For local non-contract fixes, do not open unrelated design docs preemptively.
- Do not treat historical notes or old plans as authoritative over current design docs.

---

## 5. Directory-local Rules

More specific execution rules may exist in subtree-local `AGENTS.md` files.

Current local rule entry points:
- `apps/client/AGENTS.md`
- `apps/worker/AGENTS.md`
- `packages/shared/AGENTS.md`

Rules:
- When working primarily inside one of these directories, obey the nearest `AGENTS.md` in addition to this root file.
- Directory-local rules may strengthen constraints for that subtree, but must not weaken root governance.
- If a task spans multiple subtrees, respect each local `AGENTS.md` for the files being modified.
- If `packages/shared` is modified, treat the task as potentially contract-sensitive by default until proven otherwise.
- If a task spans `client` + `worker` + `shared`, treat it as a cross-layer change even when the code diff is small.

---

## 6. Planning Gate

Planning requirements are governed by `WORKFLOW.md`.

Rules:
- If `WORKFLOW.md` requires Plan Mode, do not implement before the plan is written.
- If `WORKFLOW.md` does not require Plan Mode, do not create a plan file by default.
- Do not escalate a local change into Plan Mode unless there is clear evidence that one of the gate conditions applies.

### 6.1 Lightweight Pre-Execution Note
For non-Plan tasks, keep pre-execution notes minimal:
- target
- intended files
- validation method

Do not produce long planning text for local tasks.

### 6.2 Plan-first principle
When the task is ambiguous, cross-layer, high-risk, or contract-affecting:
- determine the affected layers first
- determine whether design docs must be updated first
- determine whether implementation should be split into multiple logical steps or PRs

### 6.3 Planning and orchestration connection
When planning is required:
- the **strategy orchestrator** decides whether the task enters planning flow
- the planning output must define enough scope for the **execution coordinator** to derive bounded implementation tasks
- implementers must not start from a planning-required task without an approved bounded scope

When planning is not required:
- small local tasks may proceed directly
- however, if the task becomes cross-layer, contract-sensitive, or ambiguous during execution, re-evaluate whether planning is now required

### 6.4 Phase-specific planning rule
Rules:
- Phase A is requirement shaping only.
- In Phase A:
  - do not implement
  - do not start execution planning
  - do not delegate to implementers as a substitute for requirement clarification
- In Phase B:
  - planning output must produce bounded execution framing
  - task breakdown, PR split strategy, and validation expectation belong here
- In Phase C:
  - execute only against approved bounded scope unless minimal justified expansion is required
- In Phase D:
  - focus on closure, release preparation inputs, and next-cycle shaping rather than silent scope reopening

---

## 7. Work Isolation

### 7.1 worktree
- Use `git worktree` for isolated work when starting a new implementation task or PR-sized change.
- 1 worktree = 1 branch = 1 purpose.

### 7.2 Base SHA
- For PR work, record `BASE_SHA` at the start.
- Avoid mid-task rebase/merge unless required for review or conflict resolution.

### 7.3 Git checkpoints
For non-trivial work:
- create a checkpoint before implementation
- create a checkpoint after implementation
- create a checkpoint after audit / final verification if the task is large or risky

These controls should not block lightweight inspection, review, or drafting tasks.

---

## 8. Diff Discipline

- Keep the diff limited to files required for the task.
- If the affected files are obvious and local, start implementation without broad pre-declaration.
- If the task is risky or cross-cutting, declare the intended scope before editing.
- No unrelated formatting, reordering, rename, or generated-file edits.
- Do not edit build artifacts directly (`dist`, generated outputs, lockfile unless dependency update is intended).

### 8.1 Scope Escalation
If additional files become necessary:
- expand only to the minimum additional scope
- state why the expansion is necessary
- keep unrelated changes out

### 8.2 Generated / dependency files
- Do not touch lockfiles unless a dependency update is intended.
- Do not regenerate unrelated outputs.
- Keep machine-generated changes isolated from hand-written logic whenever practical.

---

## 9. Risk Levels

### 9.1 Normal-risk changes
Examples:
- local UI fixes
- text / i18n fixes
- local validation changes
- small client-side logic fixes
- tests for existing behavior

Default behavior:
- no plan file unless `WORKFLOW.md` requires it
- start from local files
- validate locally
- summarize briefly

### 9.2 High-risk changes
Examples:
- Room FSM / timers / aggregation
- WebSocket schema / payload contract
- settings / snapshot compatibility
- monitoring source I/O behavior
- CI/CD / Wrangler / Workers / DO
- dependency updates
- cross-layer changes spanning client / worker / shared
- design-doc-first changes

Required behavior:
- follow `WORKFLOW.md` Plan Mode if applicable
- explicitly list affected layers
- verify against `QUALITY.md` high-risk checks

---

## 10. Validation Rule

Acceptance criteria are governed by `QUALITY.md`.

Rules:
- Every change requires technical validation and diff validation.
- Additional validation is mandatory when the affected area requires it:
  - FSM / protocol validation
  - source validation
  - E2E or equivalent scenario validation
- Do not declare completion without evidence appropriate to the risk level.

### 10.1 Minimum expectation
Unless explicitly impossible or out of scope, validate:
- build / typecheck success where applicable
- lint success where applicable
- tests relevant to the change
- no unintended diff outside the declared scope

### 10.2 High-risk expectation
For high-risk or contract-affecting changes, validate according to `QUALITY.md` for the affected area before calling the task complete.

### 10.3 Audit severity convention
When audit roles are used, findings should be classified consistently:

- **Blocker**
  - task is not complete
  - merge/review should not proceed until fixed or explicitly re-scoped

- **Must fix**
  - task is materially incomplete or unsafe in current form
  - should be corrected within the same bounded task unless scope is explicitly revised

- **Should fix**
  - important improvement with non-trivial value
  - may be completed in the same task or intentionally deferred

- **Note**
  - informational observation, follow-up idea, or non-blocking concern
  - does not block completion by itself

---

## 11. Contract-sensitive Change Rule

Treat the following as contract-sensitive:
- FSM / RoomState
- WS message type / payload
- shared enums / constants / models
- snapshot / settings compatibility
- source I/O acceptance rules
- lobby summary schema / filtering behavior

Rules:
- If a change touches a contract-sensitive area, check whether the corresponding design docs must be updated first.
- If a contract-sensitive change spans client / worker / shared, keep the change logically grouped and auditable.
- Do not make one-sided contract changes unless the compatibility story is explicit and intentional.

Detailed local contract rules may be further defined in `packages/shared/AGENTS.md`.

---

## 12. Read / Write Protocol (Windows: UTF-8 strict)

Purpose: prevent Windows-specific corruption such as UTF-16 / CP932 / BOM / unintended line-ending drift.

### 12.1 Canonical Encoding Rules
- Text files must be **UTF-8 without BOM**.
- Line endings are **LF** unless a file is explicitly documented otherwise.
- **UTF-16 prohibited**
- **CP932 / Shift_JIS prohibited**

### 12.2 Practical Rule
- Apply strict encoding care when reading/writing files that are being modified.
- Do not force repository-wide encoding checks before local implementation.
- If mojibake or abnormal diff appears, treat it as an encoding defect and fix the source of corruption.

### 12.3 Write Rule
- Always write with explicit UTF-8 (no BOM).
- Prefer atomic write (temp -> replace) when using scripts/tools that support it.
- After writing, verify that `git diff` shows no unintended encoding or line-ending noise.

### 12.4 Tooling Caution
- PowerShell default encoding must not be trusted.
- `Set-Content` / `Out-File` require explicit UTF-8 handling.
- Node / Python must specify encoding explicitly.

### 12.5 Prohibited
- UTF-16 text output
- UTF-8 with BOM
- unintended CRLF/LF drift

---

## 13. Completion Rule

A task is complete only when:
- the requested scope is satisfied
- the diff is minimal and intentional
- required validation has been performed
- no unrelated changes remain
- the branch / worktree is in a reviewable state

If the change reveals a broader issue:
- do not silently expand scope
- either justify the minimal necessary expansion
- or stop at the clean local fix and report the broader follow-up separately

### 13.1 Multi-agent completion rule
When a task uses delegated implementation and/or audit roles, the task is complete only when all required bounded outputs have been returned and evaluated.

Rules:
- delegated implementation output alone does not imply task completion
- if required audit was part of the task shape, implementation is not complete until the required audit result is returned
- unresolved **Blocker** findings prevent completion
- unresolved **Must fix** findings prevent completion unless the task scope is explicitly revised and the deferral is made visible
- broader follow-up items should be separated from the bounded task result rather than silently absorbed into the current scope

### 13.2 Reviewable return format
A delegated bounded task should return, at minimum:

- what was changed or reviewed
- files or layers touched
- validation or audit performed
- open findings, if any
- whether the bounded task is complete, blocked, or requires escalation

A task is not reviewable if the returned result omits completion status or material open risks.

### 13.3 Phase-D closure expectation
When work has reached post-implementation closure:
- separate bounded task completion from broader follow-up opportunities
- capture technical debt and next-cycle items explicitly
- prepare release-impact inputs explicitly when relevant:
  - release scope candidate
  - version-impact framing
  - release-note input
- do not silently treat release preparation as implementation scope expansion
