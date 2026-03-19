# codex-issue-99-notebook-summary-recent-mismatch

## Purpose
- Fix Issue #99 by preventing `inf-notebook` auto-submit when `records/summary.json` and `export/recent.json` are inconsistent for the same timestamp.

## Non-goals
- Do not change Room FSM / DO behavior.
- Do not change WebSocket schema or payload contracts.
- Do not change source watcher event transport or monitored file list.
- Do not change chart alias catalog format.

## Changes
- Keep `inf-notebook` single-candidate `recent` behavior contract-compliant (`resolved_full`) even when OCR metadata mismatches.
- Restrict summary/recent mismatch handling to warning-only diagnostics (no reject path based on `recent.music` / `recent.difficulty`).
- Add client-side stale replay guard for `inf-notebook` auto-submit:
  - reject auto-submit when notebook timestamp is not newer than the previous submitted timestamp for the same `room_id + player_id`.
  - keep parser contract unchanged.

## Impact
- Users: Avoids accidental carry-over score submission from previous song when source files are out of sync.
- Data: Reduces false positive `RESULT_SUBMIT` generation from watcher input.
- Compatibility: No protocol/schema compatibility impact.
- Cloudflare: None (client-side Tauri parser scope only).

## Target Files / Layers
- Files:
  - `apps/client/src-tauri/src/parsers/notebook.rs`
  - `apps/client/src/services/source-submission.ts`
- Layers:
  - client (Tauri Rust watcher/parser + TS auto-submit path)

## Test Focus
- QUALITY section 1 (technical): targeted parser test execution.
- QUALITY section 2 (diff): intended file-only diff and encoding/line-ending safety.
- QUALITY section 4 (source I/O): verify unique timestamp candidate remains accepted and OCR metadata mismatch is warning-only.
- Not required: QUALITY section 3 (FSM/Protocol), section 5 (E2E) because no FSM/WS/DO contract changes.

## Rollback Plan
- Revert this task’s commit(s) to restore previous parser behavior.
- If needed during release triage, disable watcher auto-submit by stopping source watcher in client settings as temporary operational workaround.

## Commit Split Plan
1. Align parser behavior with source I/O contract for unique recent candidate handling.
2. Add stale replay guard in auto-submit path without OCR-key-based rejection.

## Checklist
- [x] Design doc alignment confirmed (if required)
- [x] Impact scope identified
- [x] Implementation completed
- [ ] Tests completed
- [ ] Regression checks completed
- [x] Documentation updates completed (if required)

### Notes
- `cargo test notebook_parser` could not run in this environment because Tauri build script failed while loading plugin permissions from an external path (`C:\\work\\infinitas_arena\\infinitas_bpl\\...`).
