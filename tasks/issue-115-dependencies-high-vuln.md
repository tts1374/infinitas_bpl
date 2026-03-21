# issue-115-dependencies-high-vuln

## Purpose
- Resolve high severity vulnerabilities detected after dependency installation.
- Keep the fix to the smallest dependency and lockfile diff that removes high findings.

## Non-goals
- No feature work or behavior changes outside dependency vulnerability remediation.
- No broad refactor, formatting-only edits, or unrelated package upgrades.
- No changes to FSM, WebSocket protocol schema, monitoring I/O contracts, or Cloudflare runtime configuration.

## Changes
- Record current high vulnerability paths from `npm audit --json`.
- Apply the minimum direct dependency/version adjustments required to remediate high findings.
- Regenerate lockfile only as required by those dependency updates.

## Impact
- Users: no expected functional changes.
- Data: none.
- Compatibility: package versions may shift within compatible ranges needed for security fixes.
- Cloudflare: no intended runtime/config changes; validate worker/client still build.

## Target Files / Layers
- Files:
  - `package.json` (if direct dependency pin/range changes are needed)
  - `package-lock.json`
  - `apps/*/package.json` (only if audit shows direct dependency action is needed in a workspace package)
- Layers:
  - dependency management / build tooling

## Test Focus
- `npm audit --audit-level=high` returns no high vulnerabilities.
- Build/lint/test pass for the repository scripts.
- Diff remains limited to dependency/lockfile changes required for remediation.
- UTF-8 (no BOM) and LF integrity preserved.

## Rollback Plan
- Revert dependency and lockfile changes as one unit if regressions appear.
- Re-run audit and baseline build to confirm rollback restores previous state.

## Commit Split Plan
1. Apply minimal dependency and lockfile updates to remove high vulnerabilities.
2. Confirm verification outputs and finalize any small follow-up pin adjustments required for passing checks.

## Checklist
- [x] Design doc alignment confirmed (not required for this dependency-only fix)
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
- [x] Documentation updates completed (not required)
