## 0. Scope

This file defines execution rules for `packages/shared`.

`packages/shared` is the contract boundary between client and worker.
Changes here are **contract-sensitive by default**.

This file supplements:
- root `AGENTS.md`
- `WORKFLOW.md`
- `QUALITY.md`

Application order:
- apply this file as the nearest subtree rule for `packages/shared`
- also apply root `AGENTS.md`, `WORKFLOW.md`, and `QUALITY.md`
- this file may **strengthen** subtree constraints
- this file must not weaken repository-wide governance defined by root `AGENTS.md`

---

## 1. Role of packages/shared

`packages/shared` is the source of truth for shared:
- enums
- constants
- models
- protocol-facing types
- error identifiers
- WS-related types and payload shapes

Rules:
- Keep shared definitions minimal, explicit, and stable.
- Do not place client-local UI concerns here.
- Do not place worker-internal storage-only concerns here unless they are part of an explicit cross-layer contract.
- Do not use `packages/shared` as a dumping ground for convenience-only utilities.
- Do not encode local-only semantics in shared names or models.
- Names and fields in shared must reflect actual cross-layer meaning.

---

## 2. Contract-sensitive Change Rule

Treat the following as contract-sensitive by default:

- `RoomState`
- `CloseReason`
- `SourceType`
- WS message `type`
- WS payload shape
- shared constants that influence behavior across layers
- result-facing models
- snapshot-facing models
- compatibility-relevant schema versioning fields
- identifiers used by both client and worker

Rules:
- Any shared contract change must be intentional and explicitly scoped.
- Do not make one-sided contract changes unless compatibility is explicit and temporary by design.
- If a change is contract-sensitive, check whether the corresponding design docs must be updated first.
- For cross-layer changes, keep the change logically grouped and reviewable.
- Do not rely on “small diff” as evidence that a contract change is low risk.

---

## 3. Design Docs That Must Be Checked

Shared changes must be verified against the normative design docs when relevant.

Primary references:
- `docs/design/01_fsm.md`
- `docs/design/02_ws_protocol.md`
- `docs/design/03_data_model.md`
- `docs/design/06_source_io_spec.md`
- `docs/design/07_constants.md`
- `docs/design/10_regression_guard_addendum.md`

Rules:
- Do not update shared contracts based on guesswork.
- If implementation needs a new enum / payload field / constant, confirm the design source first.
- If the design source is missing the needed change, update the design doc first, then update shared.
- If more than one design doc is affected, keep the contract intent aligned across them before implementing.

---

## 4. Allowed vs Prohibited Changes

### 4.1 Allowed
- additive optional fields with explicit compatibility intent
- clearly scoped enum additions
- constant additions required by current normative docs
- type refinements that reduce ambiguity without breaking consumers
- contract updates implemented together with all affected layers
- explicit compatibility helpers used only to support a staged migration

### 4.2 Prohibited by default
- renaming shared identifiers for style only
- moving symbols across files without strong reason
- mixing unrelated cleanup with contract edits
- broad type rewrites without corresponding design updates
- client-only or worker-only convenience fields added to cross-layer models without justification
- silent breaking changes
- local workaround fields that leak one side’s implementation detail into shared
- “temporary” contract fields without an explicit removal or compatibility story

---

## 5. Compatibility Rule

Shared changes must classify compatibility impact explicitly.

### 5.1 Additive change
Examples:
- optional field addition
- new enum member with compatible handling
- new constant with no behavior break by itself

Rules:
- Prefer additive change when possible.
- Do not assume additive means safe by default.
- Ensure both client and worker can tolerate the new shape.
- Check affected switch logic, serializers, validators, mappers, and display handling for exhaustive assumptions.
- If a consumer must be updated to tolerate the new shape, treat the change as coordinated cross-layer work, not as isolated shared-only work.

### 5.2 Breaking change
Examples:
- required field addition
- enum semantic change
- payload shape replacement
- identifier rename used across layers
- removal of previously consumed field

Rules:
- Breaking changes require explicit design doc updates first.
- Breaking changes require coordinated client / worker updates in the same logical task or a clearly staged compatibility plan.
- Do not leave partial breaking changes in shared.
- Do not merge a breaking shared contract change while consumer compatibility is implicit or unverified.

### 5.3 Schema versioning
If runtime contract shape, local persistence, or snapshot compatibility is affected:
- define whether the change is additive or breaking
- update version handling intentionally when required
- confirm compatibility expectations against design docs before implementation
- do not introduce version fields that are not actually enforced or consumed by the affected layers

---

## 6. Mandatory Update Matrix

The following rules are mandatory.

### 6.1 `SourceType` change
If `SourceType` changes:
- check/update:
  - `docs/design/02_ws_protocol.md`
  - `docs/design/03_data_model.md`
  - `docs/design/06_source_io_spec.md`
  - `docs/design/07_constants.md`
  - `docs/design/10_regression_guard_addendum.md`
  - `QUALITY.md` if validation expectations change
- verify that disabled/deprecated handling remains explicit
- verify that both client and worker acceptance logic remain aligned

### 6.2 `CloseReason` change
If `CloseReason` changes:
- check/update:
  - `docs/design/01_fsm.md`
  - `docs/design/02_ws_protocol.md`
  - `docs/design/07_constants.md` if relevant
  - `docs/design/10_regression_guard_addendum.md`
  - client-side display handling if user-visible behavior changes
- verify that state transition semantics and user-visible handling remain aligned

### 6.3 `RoomState` change
If `RoomState` changes:
- check/update:
  - `docs/design/01_fsm.md`
  - `docs/design/02_ws_protocol.md` if transmitted or reflected in payloads
  - `docs/design/07_constants.md` if relevant
  - `docs/design/10_regression_guard_addendum.md`
  - all state-dependent client and worker usage sites
- verify that lifecycle, rendering, and guard conditions remain aligned

### 6.4 WS message `type` or payload shape change
If WS message `type` or payload shape changes:
- check/update:
  - `docs/design/02_ws_protocol.md`
  - `docs/design/03_data_model.md` if model semantics are affected
  - `docs/design/10_regression_guard_addendum.md`
  - all client and worker producers/consumers
- classify the change as additive or breaking explicitly
- verify tolerant parsing or coordinated rollout as appropriate

### 6.5 `RESULT_READY` or related result model change
If `RESULT_READY` or related result models change:
- check/update:
  - `docs/design/02_ws_protocol.md`
  - `docs/design/03_data_model.md`
  - `docs/design/10_regression_guard_addendum.md`
  - all client and worker usage sites
- verify that result generation, transport, and rendering remain aligned

### 6.6 Snapshot-facing model change
If snapshot-facing or persistence-facing shared models change:
- check/update:
  - `docs/design/03_data_model.md`
  - `docs/design/10_regression_guard_addendum.md`
  - any version-handling logic
  - affected persistence readers/writers
- classify additive vs breaking explicitly
- verify backward/forward compatibility expectations intentionally

### 6.7 Shared constants change
If cross-layer constants change:
- check/update:
  - `docs/design/07_constants.md`
  - any directly dependent design docs
  - affected validation expectations in `QUALITY.md` if behavior coverage changes
- verify that dependent logic remains aligned across layers

### 6.8 Cross-layer identifier change
If identifiers used by both client and worker change:
- check/update:
  - the relevant normative design docs
  - all producers/consumers, serializers, mappers, and tests
- do not treat identifier rename as local cleanup
- classify compatibility impact explicitly

These update rules are derived from the regression guard rules and are not optional.

---

## 7. Cross-layer Coordination Rule

When a change in `packages/shared` affects client and worker:

- do not update only one side and leave the other silently stale
- define the intended rollout shape:
  - same-task coordinated update
  - explicitly staged compatibility update
- ensure affected imports/usages are updated consistently
- keep the change auditable by minimizing unrelated diff

### 7.1 Ownership expectation
By default:
- a shared contract proposal may originate from worker or client work
- but the final shared change must be reviewed as a cross-layer contract change, not as a local implementation detail
- the coordinating owner must make the compatibility story explicit before the task is considered complete

### 7.2 Staged rollout rule
If the change is intentionally staged:
- define which side becomes tolerant first
- define the temporary compatibility window
- define the eventual cleanup condition
- do not leave staged compatibility permanent by accident

### 7.3 Audit expectation
For shared contract changes:
- treat contract review as strongly recommended by default
- if the change is breaking, cross-layer, or touches protocol/FSM/source/persistence semantics, treat contract audit as required unless the task is explicitly scoped otherwise by repository governance
- additive vs breaking classification must be visible in the change summary

---

## 8. Validation Expectations

Shared changes are not complete without validation appropriate to the risk level.

Minimum expectations:
- typecheck/build remains valid for affected layers
- no unused / stale contract members are introduced
- no unintended diff exists

For contract-sensitive changes, additionally verify as relevant:
- WS protocol alignment
- FSM/result model alignment
- source acceptance alignment
- compatibility handling
- all affected consumers updated

Refer to:
- root `AGENTS.md`
- `QUALITY.md`

If the change affects FSM / protocol / source / compatibility, do not call it complete without the corresponding high-risk validation.

### 8.1 Matrix-linked validation expectation
If a change matches an entry in the mandatory update matrix:
- perform validation that matches that contract surface
- do not stop at type-only validation when behavior semantics are affected
- verify consumer alignment, not just shared compilation success
- include the validation evidence in the change summary

### 8.2 Additive-change validation expectation
For additive shared changes:
- verify tolerant handling on both sides
- verify that no exhaustive logic breaks on unknown/new values
- verify that optional fields are safe in serialization, parsing, and rendering paths

### 8.3 Breaking-change validation expectation
For breaking shared changes:
- verify all affected consumers in the same logical task or staged plan
- verify compatibility handling explicitly
- verify that old assumptions are removed or guarded intentionally

---

## 9. Diff Discipline for shared

`packages/shared` should have especially strict diff discipline.

Rules:
- keep symbol changes as small as possible
- avoid file-wide type churn
- avoid broad “cleanup while here”
- separate mechanical moves from semantic contract changes when practical
- do not reorder exports or identifiers unless required

### 9.1 Preferred change shape
Prefer:
1. add / adjust the minimum contract surface
2. update all affected usage sites
3. validate
4. summarize the contract impact explicitly

---

## 10. Documentation Rule

When shared contract changes are made, the change summary must state:

- what contract changed
- whether it is additive or breaking
- which layers are affected
- which design docs were checked/updated
- what validation was performed

Do not leave reviewers to infer contract impact from diff alone.

### 10.1 Reviewable summary expectation
For non-trivial shared changes, the summary should also make visible:

- whether the rollout is same-task or staged
- whether contract audit was performed or intentionally omitted
- whether compatibility windows or cleanup follow-up remain

---

## 11. Completion Rule

A `packages/shared` task is complete only when:

- the shared contract change is minimal and intentional
- the compatibility impact is explicit
- required design docs are checked/updated
- affected client / worker usage sites are updated or intentionally staged
- validation appropriate to the risk level is complete
- no unrelated contract churn remains

### 11.1 Not complete yet
A `packages/shared` task is not complete if any of the following is true:

- additive vs breaking classification is missing
- consumer tolerance is assumed but not checked
- a staged rollout exists but the compatibility window is undefined
- only one side was updated without an explicit compatibility story
- required design-doc updates were skipped
- required contract audit was expected but not returned