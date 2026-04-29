# codex-gpt55-skill-refresh-remaining

## Purpose
- Refresh the remaining repository-local skills to match the GPT-5.5-oriented instruction style introduced in the governance and core skill pass.
- Keep skills outcome-first, judgment-light, and explicit about what evidence or artifact they should return.

## Non-goals
- Do not change product code or runtime scripts.
- Do not alter repository merge, release, or cleanup semantics beyond wording clarity.
- Do not move final ownership decisions from agents or users into skills.

## Current Request Boundary
- Ceiling: implementation ready
- Allowed outputs now: task artifact creation, remaining skill doc edits, required validation
- Forbidden outputs now: unrelated governance rewrites, product implementation, dependency updates
- Next unlock condition: none

## Success Criteria
- All remaining `.codex/skills/*/SKILL.md` files use outcome-first wording where appropriate.
- Skills state clearly that they provide artifacts/checklists/evidence, not agent-level judgment replacement.
- Repository-specific gates and status vocabulary remain intact.

## Stop Condition
- Stop after the remaining repository-local skills are updated and required validation/read-back is complete.

## Allowed Side Effects
- Minimal wording-only edits to the targeted skill files.
- A new scoped task artifact for this follow-up pass.

## Changes
- Update remaining skill overviews, workflows, and guardrails to emphasize expected artifact/evidence output.
- Clarify where each skill must stop and hand judgment back to the calling agent or user.

## Impact
- Users: more consistent behavior across all repository-local skills
- Data: none
- Compatibility: instruction semantics only
- Cloudflare: none

## Target Files / Layers
- Files:
  - `.codex/skills/branch-latest-sync-flow/SKILL.md`
  - `.codex/skills/commit-pr-flow/SKILL.md`
  - `.codex/skills/issue-close-evidence-flow/SKILL.md`
  - `.codex/skills/phase-c-review-response-flow/SKILL.md`
  - `.codex/skills/phase-d-followup-issue-flow/SKILL.md`
  - `.codex/skills/phase-d-release-flow/SKILL.md`
  - `.codex/skills/post-approval-merge-flow/SKILL.md`
- Layers: docs

## Test Focus
- Diff review for preserved repository gates and no scope drift
- `npm run check:agents`
- `npm run check:design-contracts`

## Rollback Plan
- Revert the touched skill docs as one scoped documentation change if validation or workflow readability regresses.

## Commit Split Plan
1. Remaining repository-local skill refresh

## Checklist
- [x] Impact scope identified
- [x] Implementation completed
- [x] Tests completed
- [x] Regression checks completed
