# Follow-up: run client service tests in CI

## Background
- Issue #184 added client service tests for the in-app match history window.
- Local validation runs `npm --workspace @infinitas/client run test`, but CI currently runs only `test:client-stats`.

## Purpose
- Run the client test command in CI so match history and other registered client regressions are detected continuously.

## Non-goals
- Do not change product behavior.
- Do not rewrite existing tests or broaden the workflow beyond the client test parity gap.

## Acceptance Criteria
- CI runs `npm --workspace @infinitas/client run test`.
- The existing CI validation surface remains green.
- The workflow change is limited to the minimum command insertion needed for parity.

## Target Layers / Files
- layer: CI / client validation
- files: `.github/workflows/*`, `apps/client/package.json`

## Validation
- Run the updated workflow-equivalent commands locally.
- Confirm `npm --workspace @infinitas/client run test` passes.
- Confirm `git diff --check` passes.

## Recommended Execution Mode
- execution profile: Local-Fast
- Plan Mode: NO

## Delegation Hint
- role: execution-coordinator
- spawned: later
- objective: identify the CI workflow insertion point and apply the bounded parity command.
- no-delegate reason: none
