# issue-172-icon-update

## Purpose
- Replace the current INFINITAS Arena icon with the Issue #172 attached icon.

## Non-goals
- Do not change UI layout, copy, OGP images, app versioning, package metadata, Tauri config paths, web routing, or generated build outputs.

## Current Request Boundary
- Ceiling: implementation-ready only after this artifact exists and C Kickoff is completed in a later turn.
- Allowed outputs now: task artifact creation, C Kickoff, bounded icon replacement, validation, PR/closure preparation if separately requested.
- Forbidden outputs now: expanding branding work beyond the two tracked ICO targets, changing runtime behavior, changing protocols/contracts, or editing generated outputs.
- Next unlock condition: C Kickoff confirms this artifact as source of truth and implementation authorization is present.

## Changes
- Replace `apps/client/src-tauri/icons/icon.ico` with `C:\Users\tts13\Downloads\BMQ78S_f.ico`.
- Replace `apps/web/public/assets/icons/logo.ico` with the same provided ICO.
- Preserve existing paths referenced by `apps/client/src-tauri/tauri.conf.json`, `apps/client/src-tauri/tauri.test.conf.json`, and web HTML entrypoints.

## Impact
- Users: updated desktop/web icon.
- Data: none.
- Compatibility: no runtime data or protocol compatibility impact.
- Cloudflare: none.

## Target Files / Layers
- Files: `apps/client/src-tauri/icons/icon.ico`, `apps/web/public/assets/icons/logo.ico`.
- Layers: client, web.

## Test Focus
- Confirm both target ICO files match the provided source icon by hash.
- Confirm existing icon references still point to those files.
- Run `npm run lint` and `npm run typecheck`.
- Record any skipped build/test commands with rationale if not run.

## Rollback Plan
- Revert the two ICO file replacements.

## Commit Split Plan
1. Replace desktop and web icon assets for Issue #172.

## Delegation Packet
- task label: issue-172-icon-update
- objective: replace the desktop and web icon assets with the Issue #172 provided ICO.
- success criteria: both target ICO files match the source ICO; references remain unchanged and valid; validation is recorded; no unrelated diff.
- in-scope files/layer: `apps/client/src-tauri/icons/icon.ico`, `apps/web/public/assets/icons/logo.ico`; client/web asset layer.
- non-goals: runtime behavior, protocols, config path changes, OGP assets, generated outputs.
- forbidden scope: worker/shared changes, design docs, dependency/lockfile changes, broad branding redesign.
- allowed side effects: binary content replacement of the two target ICO files only.
- expected output: concise implementation summary, validation commands/results, residual risks if any.
- validation: hash/read-back checks, reference search, `npm run lint`, `npm run typecheck`.
- continue-without-escalation boundary: continue only while the change remains a two-file ICO replacement.
- escalation: stop if conversion/generation/config changes or additional asset surfaces become necessary.
