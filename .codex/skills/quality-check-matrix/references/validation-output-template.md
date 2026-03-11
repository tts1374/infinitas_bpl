# Validation Output Template

Use this template for status reporting.

```markdown
## Validation Plan

Required now:
- [ ] <check 1>
- [ ] <check 2>

Not required:
- <conditional check group>: <reason>

## Execution Results

- <check>: pass | fail | not run
  - Evidence: <one-line result>
- <check>: pass | fail | not run
  - Evidence: <one-line result>

## Residual Risks

- <risk from any failed or not-run check, or `None`>
```

## Notes

- Keep the checklist aligned to changed areas only.
- Do not report checks outside scope as mandatory.
- Keep evidence concise and factual.
