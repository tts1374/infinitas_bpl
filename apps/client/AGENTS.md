## 0. Scope

This file defines execution rules for `apps/client`.

`apps/client` contains the Tauri desktop client:
- React / TypeScript UI
- room and lobby interaction
- local settings and local result persistence
- local source integration
- audio playback
- Tauri bridge coordination with Rust-side watchers/parsers

This file supplements:
- root `AGENTS.md`
- `WORKFLOW.md`
- `QUALITY.md`
- `packages/shared/AGENTS.md`

Application order:
- apply this file as the nearest subtree rule for `apps/client`
- also apply root `AGENTS.md`, `WORKFLOW.md`, `QUALITY.md`, and `packages/shared/AGENTS.md` when relevant
- this file may **strengthen** subtree constraints
- this file must not weaken repository-wide governance defined by root `AGENTS.md`

---

## 1. Role of apps/client

`apps/client` is responsible for:
- UI rendering
- room/lobby interaction
- local state management
- WebSocket client behavior
- local settings persistence
- local result / snapshot persistence
- source status display
- audio / voice playback
- Tauri bridge integration

Rules:
- Keep UI concerns in client.
- Keep file watching/parsing in Rust-side watcher/parser layers.
- Keep cross-layer contracts aligned with `packages/shared`.
- Do not re-implement authoritative room-state logic in the client.
- Keep presentation convenience separate from authoritative room semantics.

---

## 2. Normative References

Client changes must follow the current design docs.

Primary references:
- `docs/design/02_ws_protocol.md`
- `docs/design/03_data_model.md`
- `docs/design/05_screen_list.md`
- `docs/design/06_source_io_spec.md`
- `docs/design/07_constants.md`
- `docs/design/08_repo_structure.md`
- `docs/design/10_regression_guard_addendum.md`

Use additionally when relevant:
- `docs/design/01_fsm.md`

Rules:
- If UI behavior changes, confirm screen responsibilities first.
- If client message send/receive behavior changes, confirm WS protocol first.
- If local persistence changes, confirm data model / compatibility expectations first.
- If monitoring/source behavior changes, confirm source I/O spec first.
- If implementation must deviate, update design docs first, then implement.
- If reconnect, resync, fallback rendering, or local recovery semantics change, confirm the relevant design intent first.

---

## 3. Client Responsibility Boundary

### 3.1 Client-owned responsibilities
Client should own:
- rendering and local interaction
- local input validation where appropriate
- WS connection lifecycle on the client side
- local settings persistence
- local snapshot/result persistence
- source availability display
- audio playback and cleanup
- translating structured source events into submission attempts

Rules:
- local validation should be limited to form validity, UI preconditions, user guidance, and clearly local interaction safety
- local convenience checks must not become hidden authority rules
- local optimistic behavior must remain subordinate to server-confirmed state

### 3.2 Not client-owned
Client must not become the authority for:
- room lifecycle truth
- timer authority
- final aggregation truth
- idempotency source of truth
- expected-key acceptance authority
- lobby summary source of truth
- final result truth when server-provided result exists

Rules:
- The server/DO remains authoritative for room state and acceptance decisions.
- The client may optimize presentation, but must not silently redefine server semantics.
- If a rule depends on authoritative room state, timeout state, current round, expected key, host authority, or final acceptance outcome, it must not be decided solely by client convenience logic.

---

## 4. UI Responsibility Rule

Client changes must preserve explicit screen responsibilities.

Rules:
- Do not blur lobby, room, settings, and stats responsibilities.
- Do not expose host-only actions to non-host users.
- Do not hide required state/error information that the screen contract expects.
- Do not add UI behavior that implies unsupported lifecycle semantics.

### 4.1 Room-state rendering
Rules:
- UI must reflect the current room state intentionally.
- State-specific actions must match the allowed behavior for that state.
- `LOBBY`, `PICKING`, `PLAYING`, and `RESULT` behavior must remain distinguishable in UI logic.
- reconnecting, resync-pending, and stale-local states must not be presented as if authoritative state is already confirmed
- temporary local UI state must not masquerade as server-confirmed room truth

### 4.2 Result display
Rules:
- Do not invent result semantics outside server-provided truth.
- If display depends on `RESULT_READY`, treat the payload shape as contract-sensitive.
- If local snapshot fallback is used, make the fallback path explicit rather than implicit.
- server-provided result and local fallback result must remain distinguishable where both may appear relevant
- provisional or fallback display must not be framed as final authoritative outcome

---

## 5. Monitoring / Source Integration Rule

Client source integration is contract-sensitive.

Rules:
- Source is fixed per device and must not change while in a room.
- Monitoring failure must not fail silently.
- Source availability state must remain explicit in the UI.
- Source-specific behavior must remain aligned with `docs/design/06_source_io_spec.md`.

### 5.1 Rust vs TypeScript boundary
Rules:
- file watcher / parser / new-event detection logic belongs to Rust-side layers where specified
- TypeScript consumes structured events and converts them into client-side submission attempts
- do not duplicate parser logic in UI code unless explicitly intended and scoped
- do not invent parser-equivalent meaning from partial source signals in client code
- do not let UI-side heuristics become hidden source protocol

### 5.2 Source failure handling
Rules:
- when monitoring fails, show `SOURCE_UNAVAILABLE`
- guide TECH-skip handling as specified
- do not silently substitute unsupported fallback polling/guessing behavior
- failure, degraded state, and unavailable state must remain distinguishable if the screen contract requires that distinction

### 5.3 Source compatibility / deprecation
Rules:
- treat `SourceType` changes as contract-sensitive
- keep legacy/deprecated behavior explicit
- do not expose disabled source behavior accidentally in normal UI paths
- do not preserve deprecated source affordances in a way that implies supported normal operation

---

## 6. Submission Attempt Rule

The client may attempt submission, but authority remains server-side.

Rules:
- submit only when client-side preconditions are satisfied
- do not intentionally broaden submission conditions beyond spec
- do not hide rejected submissions as if they were accepted
- keep PLAYED / SKIPPED / TIMEOUT semantics distinguishable in local state and UI

### 6.1 Expected key / round alignment
Rules:
- preserve the intent that submissions are tied to the current round
- preserve the intent that observed result data must correspond to the expected target
- do not add fuzzy/relaxed acceptance behavior in client logic unless design docs change first

### 6.2 Duplicate / repeated attempts
Rules:
- repeated local events must not be disguised as distinct successful confirmations
- keep client-side behavior consistent with server-side idempotency and confirmation semantics
- local retries or duplicate observations must not imply multiple accepted authoritative submissions

---

## 7. Local Persistence Rule

Client local storage is compatibility-sensitive.

Rules:
- settings and result/snapshot persistence must remain explicit
- do not introduce persistence shape drift casually
- if persistence compatibility changes, treat it as contract-sensitive work
- schema/version handling must be intentional, not accidental
- stale local data must not silently redefine current UI semantics

### 7.1 Snapshot handling
Rules:
- local snapshots are used for resilience and fallback display
- do not silently discard compatibility-relevant fields
- if snapshot shape changes, confirm design and shared/client usage consistency first
- fallback snapshots must not silently override newer authoritative state
- snapshot recovery and fallback display behavior must remain explicit

### 7.2 Settings handling
Rules:
- keep settings changes local and explicit
- do not mix unrelated settings cleanup with behavior changes
- preserve validation boundaries and save behavior intentionally
- if settings migration is needed, make migration handling explicit rather than relying on accidental defaulting
- unknown or old persisted fields must not cause silent behavior drift

---

## 8. Audio / Voice / Notification Rule

Audio behavior is client-local but still governed by state correctness.

Rules:
- audio playback is local only
- clear queued audio and stop current audio on state transition / room close when required
- do not let stale audio imply stale room state
- do not couple audio sequencing to unsupported hidden lifecycle assumptions
- local audio / voice / SE / notification timing must not become a hidden source of authoritative lifecycle truth
- notification cues must not imply unsupported server-confirmed state

If audio or notification behavior changes user-visible timing/state expectations, check relevant screen/state docs first.

---

## 9. Shared Contract Coordination

Client depends on `packages/shared` and must treat shared changes as contract work, not local implementation detail.

Rules:
- do not introduce client-only interpretation drift for shared enums, constants, or payloads
- if client behavior requires shared contract edits, update shared intentionally and review as cross-layer change
- if `SourceType`, `CloseReason`, `RoomState`, WS payloads, or `RESULT_READY` change, follow shared governance/update matrix
- do not leave partial contract migrations in client code

### 9.1 Audit expectation
For client changes that affect room-state rendering, protocol handling, persistence compatibility, source semantics, or cross-layer contracts:
- treat contract or implementation audit as strongly recommended by default
- if the change is cross-layer, breaking, or changes state-driven behavior materially, do not treat implementer-only completion as sufficient unless the task is explicitly scoped otherwise by repository governance

---

## 10. High-risk Change Rule

Treat the following as high-risk by default:
- room-state-driven UI behavior changes
- WS message send/receive contract changes
- source monitoring / source availability behavior changes
- local snapshot/settings compatibility changes
- reconnect / resync / local recovery behavior changes
- result display semantics changes
- audio or notification behavior tied to room lifecycle
- cross-layer changes spanning client / worker / shared

Rules:
- Follow Plan Mode whenever `WORKFLOW.md` requires it.
- Keep high-risk client changes isolated and reviewable.
- Do not fold broad UI cleanup into contract-sensitive work.
- Do not treat fallback/recovery-only behavior changes as low-risk merely because transport contracts are unchanged.

---

## 11. Validation Expectations

Client changes are not complete without validation appropriate to risk.

Minimum expectations:
- client build / typecheck succeeds
- relevant UI/state logic compiles cleanly
- no stale imports/usages remain
- no unrelated diff remains

For high-risk changes, additionally validate as relevant:
- room-state-specific UI behavior
- host/non-host action visibility
- source failure handling
- submission attempt behavior
- local persistence compatibility
- reconnect / resync / stale-state suppression
- result display semantics
- audio/notification cleanup on state transition / room close

Refer to:
- root `AGENTS.md`
- `QUALITY.md`

If a client change affects source behavior, room-state behavior, reconnect/resync behavior, or compatibility, do not call it complete without the corresponding validation.

### 11.1 Change-to-validation expectation
If the change affects one of the following areas, the corresponding validation is mandatory:

- room-state-driven UI change
  - validate per-state rendering, allowed actions, and host/non-host visibility

- submission attempt behavior change
  - validate rejection handling, duplicate/retry behavior, and current-round alignment

- source integration change
  - validate unavailable/degraded handling, TECH-skip guidance, and deprecated-source visibility where relevant

- persistence change
  - validate compatibility, migration/default handling, and stale-data behavior

- result display or fallback change
  - validate authoritative vs fallback distinction and user-visible semantics

- reconnect / resync / recovery change
  - validate stale-state suppression, temporary-state handling, and resynchronization behavior

- audio / notification change
  - validate cleanup, timing, and non-implication of unsupported lifecycle truth

### 11.2 Validation evidence rule
Validation should not be reduced to type-only success when state semantics changed.

Rules:
- if user-visible state behavior changed, include behavior-oriented validation evidence
- if fallback/recovery behavior changed, validation must cover those scenarios explicitly
- if source failure handling changed, validation must cover unavailable-path semantics explicitly

---

## 12. Diff Discipline for apps/client

Rules:
- keep UI changes scoped to the affected screens/components/services
- avoid broad state-store rewrites unless required
- separate display-only changes from contract behavior changes when practical
- avoid broad component reshuffling during focused behavior work
- keep semantic behavior changes easy to audit in diff

### 12.1 Preferred change shape
Prefer:
1. update the smallest necessary UI/state/service surface
2. update shared contracts if required
3. update affected usage sites
4. validate
5. summarize UI / protocol / persistence impact explicitly

---

## 13. Documentation Rule

When client behavior changes, the change summary must state:
- what user-visible behavior changed
- whether WS / shared / persistence / source contracts were affected
- whether the change is additive or breaking
- which design docs were checked/updated
- what validation was performed

Do not leave reviewers to infer UI/state risk from implementation diff alone.

### 13.1 Reviewable summary expectation
For non-trivial client changes, the summary should also make visible:
- whether authoritative vs temporary/local state presentation changed
- whether reconnect / resync / fallback behavior changed
- whether persistence compatibility windows or migrations remain
- whether source failure/deprecation behavior changed

---

## 14. Completion Rule

An `apps/client` task is complete only when:
- client responsibility boundaries remain clean
- UI/state/source behavior is intentionally preserved or explicitly updated
- shared/persistence impact is explicit
- required design docs are checked/updated
- validation appropriate to the risk level is complete
- no unrelated client churn remains

### 14.1 Not complete yet
An `apps/client` task is not complete if any of the following is true:
- client convenience logic now implies authoritative behavior it does not own
- result/fallback behavior changed but authoritative vs provisional distinction was not checked
- persistence behavior changed but compatibility/migration handling was not checked
- source failure/deprecation behavior changed but unavailable/degraded paths were not checked
- reconnect/resync behavior changed but stale-state suppression was not checked
- required audit was expected but not returned