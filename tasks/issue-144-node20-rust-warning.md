# Issue 144 Plan: Node 20 deprecation and Rust warning cleanup

## Objective
- Remove GitHub Actions Node 20 deprecation warnings in this repository workflows.
- Remove the Rust unused variable warning in `apps/client/src-tauri/src/lib.rs`.

## Non-goals
- Large refactors outside the warning fixes.
- Unrelated dependency updates.
- Contract-sensitive changes (FSM/WS/shared model/schema).

## Change Summary
- Update workflow action versions to Node 24 runtime compatible majors.
- Replace Pages artifact upload usage path if it still depends on Node 20 runtime.
- Rename `setup` closure parameter from `app` to `_app` in Tauri entrypoint.

## Impact Scope
- User impact: none expected (CI/runtime warning cleanup only).
- Data/compatibility impact: none expected.
- Cloudflare impact: none expected (no resource topology change).
- Operational impact: GitHub Actions action runtime version updates.

## Target Layers and Files
- Layer: CI/CD workflow
  - `.github/workflows/release-desktop.yml`
  - `.github/workflows/validate-reusable.yml`
  - `.github/workflows/deploy-worker.yml`
  - `.github/workflows/update-worker-chart-master.yml`
  - `.github/workflows/deploy-web-pages.yml`
- Layer: Client (Tauri Rust)
  - `apps/client/src-tauri/src/lib.rs`

## Validation Plan
- Diff checks:
  - `git diff --check`
  - Confirm intended files only are changed.
- Technical checks:
  - `cargo check --manifest-path apps/client/src-tauri/Cargo.toml`
  - Optional local sanity checks for workflow YAML syntax via inspection.
- CI evidence:
  - Confirm no Node 20 deprecation warning in relevant workflow runs after merge.

## Rollback Plan
- Revert this change set in one commit if workflow runtime changes cause failures.
- If only specific workflow fails, rollback that workflow file first and keep Rust warning fix.

## Commit Split Plan
- Single commit is acceptable (all changes are one bounded objective: warning cleanup).

## Delegation Packet Record
- task label: `issue-144-bounded-packet`
- objective: bounded execution steps, validation, risks, escalation criteria
- in-scope: workflows above + `apps/client/src-tauri/src/lib.rs`
- non-goals: broad refactor, unrelated dependency updates
- forbidden scope: contract-sensitive shared/worker protocol changes
- expected output: executable bounded packet with checks
- validation: QUALITY.md universal checks + client rust compile check
- escalation: if contract-sensitive or incompatible workflow change is required
