# Commit Checklist Template

Use this output shape when applying the skill.

```markdown
## Commit Gate

Mode: <Plan Mode | Local Execution Mode>
Task file: <tasks/... or N/A>
Selected plan item: <item text or N/A>

## Pre-Commit Checks

- Scope matches selected item: pass | fail
- Out-of-scope files present: no | yes
- Generated/manual mix in one commit: no | yes
- Unrelated formatting-only changes: no | yes
- Unintended lockfile/dependency changes: no | yes

## Commit Decision

Decision: allow | block
Reason:
- <short reason>

## Commit Result

Commit: <hash or not committed>
Summary: <what was committed>

## Next Step

- Next allowed item: <next plan item or done>
```

## Notes

- If blocked, list exact files causing the block.
- Keep one logical unit per commit in Plan Mode.
