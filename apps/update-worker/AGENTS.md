## 0. Scope

This file defines execution rules for `apps/update-worker`.

`apps/update-worker` is the updater metadata backend for the desktop application.
It is a Cloudflare Worker, but it is **not** the gameplay Worker/DO runtime.

This subtree is responsible for:
- update metadata serving
- version comparison
- channel-specific update resolution
- updater-facing response shaping
- release/update endpoint behavior

This file supplements:
- root `AGENTS.md`
- `WORKFLOW.md`
- `QUALITY.md`

Application order:
- apply this file as the nearest subtree rule for `apps/update-worker`
- also apply root `AGENTS.md`, `WORKFLOW.md`, and `QUALITY.md`
- this file may **strengthen** subtree constraints
- this file must not weaken repository-wide governance defined by root `AGENTS.md`

---

## 1. Role of apps/update-worker

`apps/update-worker` is responsible for:
- updater endpoint routing
- request parsing and validation for update checks
- version resolution
- channel resolution
- update payload/metadata response shaping
- error response shaping for updater flows

Rules:
- Keep this subtree focused on updater behavior only.
- Do not treat this Worker as a general application backend.
- Do not place gameplay room/lobby/FSM responsibilities here.
- Do not duplicate gameplay contracts from `apps/worker`.
- Keep update decision logic explicit and auditable.

---

## 2. Responsibility Boundary

### 2.1 This subtree owns
This subtree may own:
- update check endpoints
- version parsing/comparison
- release channel selection
- updater response schema
- updater error handling
- signing/reference metadata handling if part of the update response contract

### 2.2 This subtree does not own
This subtree must not become responsible for:
- room lifecycle
- WebSocket gameplay routing
- Durable Object room runtime
- lobby listing
- result aggregation
- source monitoring semantics
- client room-state authority
- general-purpose API expansion unrelated to updates

Rules:
- If a change is about gameplay/session/runtime behavior, it belongs elsewhere.
- If a change is about updater metadata or update response semantics, it belongs here.
- Do not absorb unrelated backend concerns just because this subtree is also a Worker.

---

## 3. Normative References

Update-worker changes must follow the current repository governance and any updater-specific design/README material that exists.

Primary references:
- root `AGENTS.md`
- `WORKFLOW.md`
- `QUALITY.md`
- subtree-local `README.md`
- updater-related release/distribution documentation when relevant

Use additionally when relevant:
- release channel/update distribution conventions defined elsewhere in the repository
- desktop updater integration expectations if documented in client/update materials

Rules:
- Do not change updater behavior from guesswork.
- If response semantics or channel/version rules change, make the intended contract explicit before implementation.
- If updater behavior depends on distribution conventions, confirm those conventions first.

---

## 4. Contract-sensitive Change Rule

Treat the following as contract-sensitive by default:

- updater response shape
- version comparison semantics
- channel resolution semantics
- required request parameters for update checks
- response fields consumed by the desktop updater
- signing/reference metadata returned to the updater
- error codes/messages relied on by updater flows
- compatibility behavior for old client versions

Rules:
- Any updater contract change must be intentional and explicitly scoped.
- Do not silently change response semantics for existing updater consumers.
- If compatibility behavior changes, make the migration/rollout intent explicit.
- Do not leave client and update-worker assumptions partially aligned.

---

## 5. Version and Channel Rules

Version and channel behavior must remain explicit.

### 5.1 Version handling
Rules:
- keep version parsing/comparison semantics explicit
- do not mix lexical and semantic version comparison accidentally
- do not change update eligibility rules implicitly
- if prerelease/stable behavior changes, make that change explicit and reviewable

### 5.2 Channel handling
Rules:
- channel resolution must remain intentional
- do not silently broaden or narrow which releases are considered eligible
- stable/prerelease/dev behavior must remain distinguishable if the updater contract depends on it
- do not let fallback channel behavior become implicit

### 5.3 Compatibility
Rules:
- if older client versions must be rejected, degraded, or redirected, make that behavior explicit
- do not assume all clients understand new response fields immediately
- additive response changes are preferred when possible, but additive does not automatically mean safe

---

## 6. Routing and Response Rules

The Worker route layer should stay thin and focused.

Rules:
- keep route logic minimal
- keep version/channel decision logic in dedicated library code where practical
- keep response formatting centralized where practical
- do not scatter updater response semantics across unrelated modules
- do not mix transport concerns with unrelated business expansion

### 6.1 Response shaping
Rules:
- updater-facing responses must be explicit, stable, and reviewable
- error responses must not become inconsistent across equivalent failure paths
- fields that the updater depends on must not be renamed or repurposed casually

### 6.2 Request validation
Rules:
- validate request shape and required inputs explicitly
- reject malformed update requests intentionally
- do not rely on hidden defaults for contract-relevant parameters unless the default is explicit by design

---

## 7. Allowed vs Prohibited Changes

### 7.1 Allowed
- bounded update endpoint behavior changes
- explicit channel/version rule adjustments
- additive response fields with clear compatibility intent
- response/error handling cleanup that preserves updater semantics
- tests strengthening version/channel/update behavior coverage

### 7.2 Prohibited by default
- broad Worker-generalization work
- gameplay/backend feature expansion unrelated to updates
- silent response schema changes
- version comparison rewrites without explicit contract intent
- channel behavior drift caused by incidental refactor
- mixing unrelated cleanup with updater contract changes

---

## 8. Validation Expectations

Update-worker changes are not complete without validation appropriate to the risk level.

Minimum expectations:
- build/typecheck succeeds where applicable
- updater-related tests succeed where applicable
- no unintended diff remains
- route and library usage remain internally consistent

For contract-sensitive changes, additionally validate as relevant:
- version comparison behavior
- channel selection behavior
- response shape stability
- malformed input/error-path handling
- compatibility behavior for existing updater consumers

### 8.1 Change-to-validation expectation
If the change affects one of the following areas, the corresponding validation is mandatory:

- version comparison logic
  - validate representative version ordering cases
- channel resolution logic
  - validate stable/prerelease/dev selection behavior as applicable
- response shape
  - validate required fields and compatibility expectations
- error handling
  - validate equivalent failure paths and updater-visible semantics
- compatibility behavior
  - validate old/new client assumptions explicitly where relevant

### 8.2 Validation evidence rule
Do not treat typecheck alone as sufficient when updater semantics changed.

Rules:
- if version/channel behavior changed, include behavior-oriented validation evidence
- if response shape changed, include contract-oriented validation evidence
- if compatibility behavior changed, include explicit scenario validation

---

## 9. Diff Discipline for apps/update-worker

Rules:
- keep changes scoped to updater routes/lib/types/tests
- separate response-contract changes from internal cleanup when practical
- avoid broad refactors during focused updater behavior work
- keep semantic behavior changes easy to audit in diff
- do not touch unrelated deployment/configuration files unless the updater task requires it

### 9.1 Preferred change shape
Prefer:
1. update the minimum version/channel/response surface
2. update affected tests/usages
3. validate
4. summarize updater contract impact explicitly

---

## 10. Documentation Rule

When updater behavior changes, the change summary must state:
- what updater behavior changed
- whether response/version/channel semantics changed
- whether the change is additive or breaking
- what compatibility impact exists
- what validation was performed

Do not leave reviewers to infer updater contract impact from diff alone.

### 10.1 Reviewable summary expectation
For non-trivial update-worker changes, the summary should also make visible:
- whether response fields changed
- whether old client behavior is affected
- whether release-channel behavior changed
- whether rollout assumptions or compatibility windows remain

---

## 11. Completion Rule

An `apps/update-worker` task is complete only when:
- updater responsibility boundaries remain clean
- version/channel/response behavior is intentionally preserved or explicitly updated
- compatibility impact is explicit
- validation appropriate to the risk level is complete
- no unrelated backend churn remains

### 11.1 Not complete yet
An `apps/update-worker` task is not complete if any of the following is true:
- response semantics changed but compatibility impact was not checked
- version/channel behavior changed but scenario validation is missing
- malformed-input/error-path behavior changed but updater-visible handling was not checked
- gameplay/backend responsibilities leaked into this subtree
- required rollout/compatibility intent remains implicit