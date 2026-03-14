# codex-design-fsm-doc-align

## Purpose
- Align governance, design docs, and minimal shared/worker types with the current intended v1 room-flow contract.
- Remove obsolete `READY_CHECK` state semantics from current contracts while preserving only explicit legacy compatibility where still needed.
- Clarify that host-side forced finalization is represented by `FORCE_ADVANCE`, and do not silently change `SKIP_HOST_ASSIGN` behavior without matching implementation intent.

## Non-goals
- Do not introduce a new room-flow behavior beyond the current intended v1 contract.
- Do not refactor unrelated worker/client architecture.
- Do not expand into source I/O or rating behavior changes unless required by contract cleanup.

## Base
- Base branch: `v1`
- Base SHA: `0bb71a1ca4dfa1b7f15ff8854d7c0dc532e929be`
- Worktree: `C:/work/infinitas_arena/infinitas_bpl__design_fsm_doc_align`
- Branch: `codex/design-fsm-doc-align`

## Changes
- Update governance/design docs so `01-08` are the active spec source and `09_implementation_plan.md` is frozen or retired as historical material.
- Align design terminology with code where intended: `START_MATCH`, `GET /api/lobby`, `RoomStateSnapshot`, `LOBBY`-internal ready management.
- Remove current-contract references to `READY_CHECK` from lobby visibility/status semantics and shared/worker types if they are no longer part of the intended v1 model.
- Decide and implement the minimal safe handling for `result_ttl` / `result_deadline` based on current code usage.
- Document forced-finalize behavior around `FORCE_ADVANCE` and keep `SKIP_HOST_ASSIGN` contract consistent with implementation unless an explicit behavior change is made.

## Impact
- Users: Clarifies room-flow behavior and prevents UI/protocol drift before release.
- Data: May change shared snapshot/persistence shape if `result_deadline` or legacy `READY_CHECK` compatibility is removed.
- Compatibility: Pre-release only, but shared types and worker persistence need careful alignment.
- Cloudflare: Worker/DO contract and lobby summary behavior may be touched; routes stay thin.

## Target Files / Layers
- Files:
  - `AGENTS.md`
  - `docs/design/01_fsm.md`
  - `docs/design/02_ws_protocol.md`
  - `docs/design/03_data_model.md`
  - `docs/design/04_tech_stack.md`
  - `docs/design/05_screen_list.md`
  - `docs/design/06_source_io_spec.md`
  - `docs/design/07_constants.md`
  - `docs/design/08_repo_structure.md`
  - `docs/design/09_implementation_plan.md`
  - `packages/shared/src/models/lobby-room-summary.ts`
  - `packages/shared/src/models/room-state-snapshot.ts`
  - `apps/worker/src/durable/lobby-directory-object.ts`
  - `apps/worker/src/durable/room-object.ts`
  - `apps/worker/src/durable/room-state.ts`
- Layers: worker, shared, docs

## Invariant Impact
- INV-01: preserved
  - Note: Worker routes remain thin; DO remains responsible for room flow.
- INV-02: changed
  - Note: Design contract will be aligned from `LOBBY -> READY_CHECK -> ...` to the intended 5-state model where ready is managed inside `LOBBY`.
- INV-03: changed
  - Note: Timer semantics will be clarified around lobby ready management and possible removal of unused result timer fields.
- INV-06: preserved or tightened
  - Note: Host authority language will be clarified so `FORCE_ADVANCE` remains the forced-finalize path unless `SKIP_HOST_ASSIGN` is intentionally implemented.

## Test Focus
- `QUALITY.md` section 1 and 2
- `QUALITY.md` section 3 because FSM/protocol/shared-contract files are touched
- Targeted shared/worker tests covering lobby visibility/status and force-advance behavior
- UTF-8 no-BOM / LF-safe diff check

## Rollback Plan
- Revert this branch as one isolated change set.
- If shared/worker type cleanup proves unsafe, keep behavior-alignment in docs/governance only and restore the removed fields/types before merge.

## Commit Split Plan
1. Freeze or retire obsolete planning/governance references and align design docs to the intended current contract.
2. Apply the smallest shared/worker cleanup needed to match the updated contract and keep tests green.

## Checklist
- [ ] Design doc alignment confirmed
- [ ] Impact scope identified
- [ ] Implementation completed
- [ ] Tests completed
- [ ] Regression checks completed
- [ ] Documentation updates completed
