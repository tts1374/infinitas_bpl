# AGENTS.md

## 0. Governance

This project is governed by the following documents:

- AGENTS.md (execution constraints)
- WORKFLOW.md (planning and PR rules)
- QUALITY.md (acceptance criteria)

If any conflict occurs, **AGENTS.md** takes precedence for execution rules.

### Branch
- Default working branch is **`v1`** (not `main`).
- Unless explicitly instructed otherwise, all work/PRs must use **`v1`** as the base branch.

---

## 1. Execution Policy

Primary objective: satisfy the requested change with the **smallest correct diff**.

Rules:
- Start from the most directly related file(s) only.
- Do not expand investigation unless the local evidence is insufficient.
- Do not rewrite, rename, reorder, or broadly refactor unrelated areas.
- Do not stop at “inspection only” when the requested change is local and implementable in the same pass.
- Prefer concrete fixes over broad design exploration unless the task explicitly requests design work.

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

## 2. System Architecture (Ph1)

### 2.1 Client
- Tauri 2 + React + TypeScript (Vite)
- Local file watching/parsing in Rust; UI + WS + audio + local storage in TS.

### 2.2 Server
- Cloudflare Workers (HTTP entry)
- Durable Objects (Room FSM + timers + aggregation + WS broadcast)
- `LobbyDirectoryDO`（公開ロビー一覧の軽量サマリ正本）

### 2.3 Sources (fixed per device)
- `inf_daken_counter` (today_update.xml)
- `inf-notebook` (export/recent.json; records/recent.json optional)

Source is selected before joining a room and MUST NOT be changed while in a room.

---

## 3. Spec Sources of Truth

These design docs are normative. Implementation MUST match them.

- docs/design/01_fsm.md
- docs/design/02_ws_protocol.md
- docs/design/03_data_model.md
- docs/design/04_tech_stack.md
- docs/design/05_screen_list.md
- docs/design/06_source_io_spec.md
- docs/design/07_constants.md
- docs/design/08_repo_structure.md

Historical only:
- docs/design/09_implementation_plan.md (frozen reference; not a normative spec source)

Rule:
- If implementation must deviate, update the relevant design doc(s) first, then implement.
- For local non-contract fixes, do not open unrelated design docs preemptively.

---

## 4. Planning Gate

Planning requirements are governed by **WORKFLOW.md**.

Rules:
- If WORKFLOW.md requires Plan-mode, do not implement before the plan is written.
- If WORKFLOW.md does not require Plan-mode, do not create a plan file by default.
- Do not escalate a local change into Plan-mode unless there is clear evidence that one of the gate conditions applies.

### 4.1 Lightweight Pre-Execution Note
For non-Plan tasks, keep pre-execution notes minimal:
- target
- intended files
- validation method

Do not produce long planning text for local tasks.

---

## 5. Work Isolation

### 5.1 worktree
- Use git worktree for isolated work when starting a new implementation task or PR-sized change.
- 1 worktree = 1 branch = 1 purpose.

### 5.2 Base SHA
- For PR work, record BASE_SHA at the start.
- Avoid mid-task rebase/merge unless required for review or conflict resolution.

Note:
- These are execution controls for actual implementation work.
- They should not block lightweight inspection, review, or drafting tasks.

---

## 6. Diff Discipline

- Keep the diff limited to files required for the task.
- If the affected files are obvious and local, start implementation without broad pre-declaration.
- If the task is risky or cross-cutting, declare the intended scope before editing.
- No unrelated formatting, reordering, rename, or generated-file edits.
- Do not edit build artifacts directly (`dist`, generated outputs, lockfile unless dependency update is intended).

### 6.1 Scope Escalation
If additional files become necessary:
- expand only to the minimum additional scope
- state why the expansion is necessary
- keep unrelated changes out

---

## 7. Risk Levels

### 7.1 Normal-risk changes
Examples:
- local UI fixes
- text/i18n fixes
- local validation changes
- small client-side logic fixes
- tests for existing behavior

Default behavior:
- no plan file unless WORKFLOW.md requires it
- start from local files
- validate locally
- summarize briefly

### 7.2 High-risk changes
Examples:
- Room FSM / timers / aggregation
- WebSocket schema / payload contract
- settings / snapshot compatibility
- monitoring source I/O behavior
- CI/CD / Wrangler / Workers / DO / KV
- dependency updates
- cross-layer changes spanning client/worker/shared

Required behavior:
- follow WORKFLOW Plan-mode if applicable
- explicitly list affected layers
- verify against QUALITY.md high-risk checks

---

## 8. Cloudflare-specific Execution Rules

### 8.1 Worker vs DO responsibilities
- Worker routes must remain thin (routing + lobby directory access).
- DO owns: FSM, timers, idempotency, expected_key enforcement, aggregation, broadcast.

### 8.2 Idempotency
- Client MUST send `client_msg_id` for every WS message.
- DO MUST de-duplicate by `(player_id, client_msg_id)`.

### 8.3 Lobby (`LobbyDirectoryDO`)
- 公開ロビー一覧の正本は `LobbyDirectoryDO` storage に保持する。
- 一覧は軽量サマリのみを保持し、ルーム本体状態や secrets は置かない。
- 一覧取得時/更新時に TTL 清掃を行い、公開・非満員・`LOBBY`・TTL 未超過のみ返す。

### 8.4 Failure mode
- If DO state is lost, the room is closed with `ROOM_STATE_LOST` and clients show a blocking error dialog.
- Partial results are displayed from local snapshots.

---

## 9. Client-specific Execution Rules

### 9.1 Monitoring
- Monitoring is implemented in Rust (watcher + parser + new-event detection).
- TS layer only consumes structured events and submits via WS when:
  - `observed_key == expected_key`
  - `round_index == current_round_index`
  - player/round not already confirmed

### 9.2 Source failure
- If monitoring fails: show `SOURCE_UNAVAILABLE` and guide TECH-skip.
- No silent fallback (polling fallback is Ph2+ only).

### 9.3 Voice
- Local playback only.
- Clear queued audio and stop current audio on any state transition / room close.

---

## 10. READ / WRITE Protocol (Windows: UTF-8 strict)

Purpose: prevent Windows-specific corruption such as UTF-16 / CP932 / BOM / unintended line-ending drift.

### 10.1 Canonical Encoding Rules
- Text files must be **UTF-8 without BOM**.
- Line endings are **LF** unless a file is explicitly documented otherwise.
- **UTF-16 prohibited**
- **CP932 / Shift_JIS prohibited**

### 10.2 Practical Rule
- Apply strict encoding care when reading/writing files that are being modified.
- Do not force repository-wide encoding checks before local implementation.
- If mojibake or abnormal diff appears, treat it as an encoding defect and fix the source of corruption.

### 10.3 Write Rule
- Always write with explicit UTF-8 (no BOM).
- Prefer atomic write (temp -> replace) when using scripts/tools that support it.
- After writing, verify that `git diff` shows no unintended encoding or line-ending noise.

### 10.4 Tooling Caution
- PowerShell default encoding must not be trusted.
- `Set-Content` / `Out-File` require explicit UTF-8 handling.
- Node / Python must specify encoding explicitly.

### 10.5 Prohibited
- UTF-16 text output
- UTF-8 with BOM
- unintended CRLF/LF drift
