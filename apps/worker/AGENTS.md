## 0. Scope

This file defines execution rules for `apps/worker`.

`apps/worker` contains the Cloudflare Worker entry layer and Durable Object room runtime.
Changes here are high-risk whenever they affect routing, room lifecycle, timers, aggregation, contract handling, lobby visibility, recovery behavior, or state persistence.

This file supplements:
- root `AGENTS.md`
- `WORKFLOW.md`
- `QUALITY.md`
- `packages/shared/AGENTS.md`

Application order:
- apply this file as the nearest subtree rule for `apps/worker`
- also apply root `AGENTS.md`, `WORKFLOW.md`, `QUALITY.md`, and `packages/shared/AGENTS.md` when relevant
- this file may **strengthen** subtree constraints
- this file must not weaken repository-wide governance defined by root `AGENTS.md`

---

## 1. Role of apps/worker

`apps/worker` is responsible for:
- HTTP entrypoints
- WebSocket upgrade entry
- Durable Object room runtime
- lobby summary maintenance
- room-scoped aggregation and result generation
- request validation and server-side error shaping

Rules:
- Keep Worker routes thin.
- Keep stateful room logic inside Durable Objects.
- Keep public lobby summary logic in `LobbyDirectoryDO`.
- Keep cross-layer contracts aligned with `packages/shared`.
- Keep authoritative lifecycle, acceptance, and deadline decisions inside the DO runtime.

---

## 2. Worker vs Durable Object Boundary

### 2.1 Worker responsibilities
Worker should own only:
- HTTP routing
- WebSocket upgrade entry
- request parsing / validation at the edge where appropriate
- room lookup / DO routing
- lobby list retrieval
- stateless helper endpoints

Rules:
- Edge validation must stay limited to syntax, shape, routing preconditions, and clearly stateless checks.
- Do not move room lifecycle, timer, authority, or acceptance logic into Worker routes.
- Do not let Worker routes become a second source of truth for room behavior.
- If a check depends on room state, player authority, expected key, current round, timer state, or acceptance window, it belongs in the DO.

### 2.2 Durable Object responsibilities
Durable Objects own:
- room state persistence
- FSM transitions
- ready / picking / playing / result lifecycle
- timer and deadline management
- idempotency handling
- expected key enforcement
- submission acceptance / rejection
- aggregation and rating-related result generation
- room broadcast
- room-to-lobby summary updates
- recovery and resume behavior after restart / hibernation / reconnect where applicable

Rules:
- The DO is the authoritative execution context for room-scoped behavior.
- Do not duplicate authoritative acceptance logic across helper modules without an explicit reason.
- Keep lifecycle, acceptance, and recovery semantics explicit and auditable.

### 2.3 LobbyDirectoryDO responsibilities
`LobbyDirectoryDO` is the source of truth for public lobby summaries.

Rules:
- store lightweight summaries only
- do not store room secrets or full room bodies there
- clean expired entries on read/update
- only public, non-full, `LOBBY`, non-expired rooms are listable
- keep summary refresh timing explicit
- do not tolerate silently stale summaries when room visibility conditions have changed

---

## 3. Normative References

Worker/DO changes must follow the current design docs.

Primary references:
- `docs/design/01_fsm.md`
- `docs/design/02_ws_protocol.md`
- `docs/design/03_data_model.md`
- `docs/design/07_constants.md`
- `docs/design/08_repo_structure.md`
- `docs/design/10_regression_guard_addendum.md`

Rules:
- If room behavior changes, confirm FSM and protocol first.
- If persisted room fields or lobby summary fields change, confirm data model first.
- If timer behavior changes, confirm constants first.
- If implementation must deviate, update design docs first, then implement.
- If recovery semantics, recreation semantics, or listing semantics change, confirm that the relevant design docs still express the intended behavior.

---

## 4. High-risk Change Rule

Treat the following as high-risk by default:
- Room FSM changes
- timer / alarm / deadline changes
- aggregation or result generation changes
- WebSocket message handling changes
- idempotency changes
- expected key enforcement changes
- lobby summary schema / filtering / TTL changes
- room recreation / generation handling
- compatibility-affecting persistence changes
- DO recovery / resume / reconnect behavior changes
- hibernation-related state assumptions
- `ROOM_STATE_LOST` behavior changes
- contract changes spanning worker / shared / client

Rules:
- Follow Plan Mode whenever `WORKFLOW.md` requires it.
- Do not perform broad local rewrites under the guise of a focused fix.
- Keep risky changes isolated and reviewable.
- Prefer one logical behavior change per PR.
- Do not treat persistence-only or recovery-only changes as low-risk merely because external APIs remain unchanged.

---

## 5. FSM and Lifecycle Rules

Worker/DO implementation must preserve the room lifecycle contract.

Rules:
- room lifecycle is owned by the DO, not the Worker route layer
- do not bypass formal room states with ad hoc flags
- do not introduce hidden transition paths outside the defined FSM
- `RESULT -> LOBBY` reset must clear prior match volatile state intentionally
- `CLOSED` handling must preserve explicit close reason behavior
- any new close reason must be treated as a contract-sensitive change

### 5.1 Generation and room identity
Rules:
- `room_id` is stable room identity
- `generation` distinguishes recreated generations
- do not conflate generation rollover with a new unrelated room
- recreation behavior must stay explicit and auditable
- generation rollover must not leave stale public listing state behind
- reconnect or rejoin behavior across generations must remain explicit

### 5.2 Match identity
Rules:
- current match identity must be handled intentionally
- do not reuse stale match-scoped state across matches
- result payload generation must be tied to the correct match lifecycle
- dedupe / acceptance / result state must not leak across logically distinct matches unless explicitly designed

---

## 6. Timer and Deadline Rules

Timer handling belongs to the DO and must remain explicit.

Rules:
- do not scatter timer semantics across unrelated modules
- all deadline semantics must remain consistent with normative constants
- do not change timer start points implicitly
- `ttlStartedAt` semantics for lobby listing must remain explicit
- `updatedAt` must not become a hidden TTL source of truth

### 6.1 Lobby TTL
Rules:
- lobby expiry uses the correct lobby-ready TTL semantics
- public list filtering must respect non-expired `LOBBY` only
- listing eligibility and lobby expiry must not diverge silently in code paths

### 6.2 Match TTL
Rules:
- match expiry must remain tied to the intended match lifecycle start
- timeout resolution must not silently skip result consistency handling
- match timeout behavior must remain distinguishable from ordinary round completion

### 6.3 Picking / round deadlines
Rules:
- picking timeout behavior must remain explicit
- round timeout and forced advancement behavior must remain distinguishable in code and result semantics
- deadline expiry handling must not silently broaden acceptance windows

---

## 7. Idempotency and Acceptance Rules

### 7.1 Idempotency
Rules:
- client messages must be de-duplicated by `(player_id, client_msg_id)`
- do not weaken idempotency handling without explicit design update
- do not mix request-level idempotency and message-level idempotency accidentally
- dedupe lifetime must remain intentional across room continuation, match reset, recreation, and room close
- if hibernation/recovery can occur, idempotency expectations across recovery boundaries must remain explicit

### 7.2 Submission acceptance
Rules:
- expected-key enforcement belongs to authoritative server logic
- do not broaden acceptance windows implicitly
- current-round-only acceptance must remain explicit unless design docs change
- timeout / skip / played states must remain distinguishable in stored and emitted results
- acceptance decisions must be derivable from authoritative room state, not inferred from client assumptions

---

## 8. LobbyDirectoryDO Rules

`LobbyDirectoryDO` is contract-sensitive.

Rules:
- keep lobby records lightweight
- only store the fields necessary for listing and TTL filtering
- keep update timing explicit
- remove closed rooms
- do not let public list behavior drift from the normative visibility rules

### 8.1 Listing behavior
Only rooms satisfying the intended public listing rules may be returned.

### 8.2 Summary schema
If summary fields change:
- confirm whether `03_data_model.md` must change
- confirm whether list consumers must change
- treat it as a contract-sensitive update

### 8.3 Update timing
Lobby summary updates must remain intentionally triggered.

Rules:
- do not rely on incidental writes to keep summaries fresh
- room visibility-affecting changes must update or clear listing state explicitly
- recreation, closure, lobby return, and visibility/filter changes must not leave stale summaries behind

---

## 9. Recovery / Failure Mode Rule

Recovery behavior is contract-relevant whenever the room cannot safely continue with authoritative state.

### 9.1 `ROOM_STATE_LOST`
`ROOM_STATE_LOST` is fixed contract behavior.

Rules:
- if DO state cannot be recovered or required state is missing, treat it as `ROOM_STATE_LOST`
- do not silently continue from corrupted state
- do not downgrade `ROOM_STATE_LOST` into a generic close
- preserve the contract that clients show a blocking error dialog
- preserve the contract that partial results fall back to local snapshots

If `ROOM_STATE_LOST` behavior changes, update design docs first.

### 9.2 Recovery expectations
Rules:
- persisted state shape changes must consider recovery behavior explicitly
- hibernation or restart paths must not assume in-memory state that is not reconstructable
- reconnect handling must remain consistent with authoritative lifecycle state
- recovery logic must not silently invent lifecycle progress that did not occur

---

## 10. Shared Contract Coordination

`apps/worker` depends on `packages/shared` and must treat shared changes as contract work, not local implementation detail.

Rules:
- do not introduce worker-only interpretation drift for shared enums, constants, or payloads
- if a worker change requires shared contract edits, update shared intentionally and review it as cross-layer change
- do not leave partial shared migrations in worker code
- if `SourceType`, `CloseReason`, `RoomState`, WS payloads, or `RESULT_READY` change, follow the update rules defined by shared/local governance

### 10.1 Audit expectation
For worker changes that affect lifecycle, protocol, timer, recovery, or cross-layer contracts:
- treat contract or implementation audit as strongly recommended by default
- if the change is cross-layer, breaking, or affects authoritative lifecycle behavior, do not treat implementer-only completion as sufficient unless the task is explicitly scoped otherwise by repository governance

---

## 11. Validation Expectations

Worker changes are not complete without validation appropriate to risk.

Minimum expectations:
- worker build / typecheck succeeds
- no stale route / DO imports remain
- no unrelated diff remains

For high-risk changes, additionally validate as relevant:
- FSM transition behavior
- timer / deadline behavior
- idempotency handling
- expected key enforcement
- host authority behavior
- public lobby filtering and TTL behavior
- recovery / reconnect handling
- `ROOM_STATE_LOST` handling
- result payload generation consistency

Refer to:
- root `AGENTS.md`
- `QUALITY.md`

Do not mark worker lifecycle changes complete without the corresponding high-risk validation.

### 11.1 Change-to-validation expectation
If the change affects one of the following areas, the corresponding validation is mandatory:

- FSM / lifecycle change
  - validate intended transitions, reset points, and blocked/invalid paths

- timer / deadline / TTL change
  - validate start points, expiry handling, forced advancement behavior, and listing impact where relevant

- lobby summary / listing change
  - validate visibility filtering, stale summary removal, and TTL behavior

- idempotency / acceptance change
  - validate duplicate / replay scenarios, acceptance boundaries, and current-round enforcement

- recovery / persistence / `ROOM_STATE_LOST` change
  - validate restart or recovery assumptions, fallback behavior, and non-corrupted failure handling

- result generation change
  - validate result consistency for the intended lifecycle path

### 11.2 Validation evidence rule
Validation should not be reduced to type-only success when behavior semantics changed.

Rules:
- if behavior changed, include behavior-oriented validation evidence
- if recovery or timeout logic changed, validation must cover those scenarios explicitly
- if public visibility changed, validation must cover list output semantics explicitly

---

## 12. Diff Discipline for apps/worker

Rules:
- keep route-layer changes thin and intentional
- separate protocol changes from unrelated cleanup
- separate lobby summary changes from unrelated room logic when practical
- avoid broad file churn in DO modules unless required
- keep semantic behavior changes easy to audit in diff

### 12.1 Preferred change shape
Prefer:
1. update the smallest necessary route / DO surface
2. update shared contracts if required
3. update affected consumers
4. validate
5. summarize lifecycle / protocol impact explicitly

---

## 13. Documentation Rule

When worker behavior changes, the change summary must state:
- what behavior changed
- whether FSM / protocol / data model / constants were affected
- whether the change is additive or breaking
- which design docs were checked/updated
- what validation was performed

Do not leave reviewers to infer lifecycle risk from implementation diff alone.

### 13.1 Reviewable summary expectation
For non-trivial worker changes, the summary should also make visible:
- whether authoritative behavior moved between Worker and DO
- whether recovery / reconnect behavior changed
- whether public listing behavior changed
- whether compatibility windows or staged rollout remain

---

## 14. Completion Rule

An `apps/worker` task is complete only when:
- Worker vs DO responsibility remains clean
- lifecycle / timer / lobby behavior is intentionally preserved or explicitly updated
- shared contract impact is explicit
- required design docs are checked/updated
- validation appropriate to the risk level is complete
- no unrelated worker / DO churn remains

### 14.1 Not complete yet
An `apps/worker` task is not complete if any of the following is true:
- authoritative acceptance logic drifted into Worker routes
- lifecycle behavior changed but transition/reset validation is missing
- timer behavior changed but start-point / expiry validation is missing
- lobby visibility behavior changed but listing validation is missing
- recovery assumptions changed but restart / reconnect / failure handling was not checked
- shared impact is implicit rather than explicit
- required audit was expected but not returned