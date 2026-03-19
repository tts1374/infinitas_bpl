# codex-issue-99-notebook-summary-recent-mismatch

## Purpose
- Fix Issue #99 by preventing `inf-notebook` auto-submit when `records/summary.json` and `export/recent.json` are inconsistent for the same timestamp.

## Non-goals
- Do not change Room FSM / DO behavior.
- Do not change WebSocket schema or payload contracts.
- Do not change source watcher event transport or monitored file list.
- Do not change chart alias catalog format.

## Changes
- Tighten `inf-notebook` parser resolution so single-candidate `recent` is accepted only when summary/recent consistency checks pass.
- Treat summary/recent mismatch as unresolved (non-observation) to block auto-submit.
- Add/update parser unit tests for mismatch reject and valid-match accept behavior.

## Impact
- Users: Avoids accidental carry-over score submission from previous song when source files are out of sync.
- Data: Reduces false positive `RESULT_SUBMIT` generation from watcher input.
- Compatibility: No protocol/schema compatibility impact.
- Cloudflare: None (client-side Tauri parser scope only).

## Target Files / Layers
- Files:
  - `apps/client/src-tauri/src/parsers/notebook.rs`
- Layers:
  - client (Tauri Rust watcher/parser)

## Test Focus
- QUALITY section 1 (technical): targeted parser test execution.
- QUALITY section 2 (diff): intended file-only diff and encoding/line-ending safety.
- QUALITY section 4 (source I/O): verify mismatch does not produce observation while valid data still produces observation.
- Not required: QUALITY section 3 (FSM/Protocol), section 5 (E2E) because no FSM/WS/DO contract changes.

## Rollback Plan
- Revert this task’s commit(s) to restore previous parser behavior.
- If needed during release triage, disable watcher auto-submit by stopping source watcher in client settings as temporary operational workaround.

## Commit Split Plan
1. Implement parser consistency guard and related logic updates.
2. Add/update parser tests proving mismatch block and valid-match pass.

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [ ] Tests completed
- [ ] Regression checks completed
- [x] Documentation updates completed (if required)

### Notes
- `cargo test notebook_parser` could not run in this environment because Tauri build script failed while loading plugin permissions from an external path (`C:\\work\\infinitas_arena\\infinitas_bpl\\...`).
