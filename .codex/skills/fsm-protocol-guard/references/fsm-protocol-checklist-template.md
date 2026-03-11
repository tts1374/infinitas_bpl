# FSM/Protocol Checklist Template

Use this template for pre-implementation gating or high-risk review.

```markdown
## Mode Decision

Mode: Plan Mode
Reason:
- <matched risk trigger>

Plan file:
- tasks/<branch-or-pr-name>.md

## Invariant Impact

- INV-01: preserved | changed
  - Note: <impact summary>
- INV-02: preserved | changed
  - Note: <impact summary>

## Required Validation

- [ ] QUALITY section 1 (technical checks)
- [ ] QUALITY section 2 (diff checks)
- [ ] QUALITY section 3 (FSM/Protocol checks)
- [ ] QUALITY section 4 (source I/O checks, if touched)
- [ ] QUALITY section 5 (E2E checks, if touched)

## Execution Results

- <check>: pass | fail | not run
  - Evidence: <one-line proof>

## Residual Risks

- <risk from failed/not-run checks or None>
```

## Notes

- Do not start implementation until Plan artifact exists.
- If contract behavior changes, update `docs/design/*` first.
- Keep scope minimal and avoid unrelated refactors.
