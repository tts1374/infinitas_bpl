# issue-182-special-thanks-credit

## Purpose
- Add the Issue #182 icon/image creator credit to the official landing page below the FAQ area.
- Display `Special Thanks`, creator name `Lotus*`, and X/Twitter link `https://x.com/LotusRoad_`.

## Non-goals
- Do not change desktop client behavior.
- Do not change worker/backend/shared contracts.
- Do not change join/deeplink behavior.
- Do not update dependencies, lockfiles, CI, deployment config, or generated outputs.
- Do not add unrelated landing-page copy cleanup.

## Current Request Boundary
- Ceiling: implementation-ready after this artifact exists and C Kickoff is completed in the next C-D turn.
- Allowed outputs now: task artifact creation, C Kickoff, bounded implementation, validation, and handoff/PR preparation when explicitly requested in that later turn.
- Forbidden outputs now: implementation before this artifact exists and before C Kickoff.
- Next unlock condition: create this task artifact, then run C Kickoff.

## Changes
- Add a landing-page credit block below the FAQ section.
- Include the visible label `Special Thanks`.
- Include creator name `Lotus*`.
- Link the X/Twitter entry to `https://x.com/LotusRoad_`.
- Preserve existing FAQ content, page order, footer links, and entry-flow behavior.

## Impact
- Users: official page shows the icon/image creator credit.
- Data: none.
- Compatibility: none.
- Cloudflare: none.

## Target Files / Layers
- Files: `apps/web/src/components/sections/FaqSection.tsx` and/or a new adjacent landing section imported by `apps/web/src/pages/Landing.tsx`.
- Layers: web.

## Test Focus
- `npm run lint`
- `npm run typecheck:web`
- `npm run build:web`
- Visible content check for placement below FAQ and exact link target.
- Diff check for unrelated changes and UTF-8/no BOM/LF preservation.

## Rollback Plan
- Revert the added credit block/component and any import from the landing page.

## Commit Split Plan
1. Add Issue #182 Special Thanks credit to the web landing page.

## Delegation Packet
- task label: issue-182-special-thanks-credit
- objective: add the Issue #182 creator credit below FAQ on the official landing page.
- success criteria: exact name/link visible; placement below FAQ; web validation passes; no unrelated diff.
- in-scope files/layer: apps/web landing page presentation files only.
- non-goals: no desktop, worker, shared, contracts, deploy, dependency, or generated-output changes.
- forbidden scope: join/deeplink semantics, gameplay/backend authority, unrelated page redesign.
- allowed side effects: minimal web source edits and validation artifacts/caches only.
- expected output: implementation summary, validation results, and any residual risk.
- validation: lint, web typecheck, web build, visible content/link check, diff discipline.
- continue-without-escalation boundary: styling may follow existing FAQ/landing patterns without product reinterpretation.
- escalation: stop if new legal wording, assets, deployment, cross-layer behavior, or contract-sensitive changes are required.

## Checklist
- [x] C Kickoff completed before implementation.
- [x] Impact scope identified.
- [x] Implementation completed.
- [x] Tests completed.
- [x] Regression checks completed.
- [x] Documentation updates completed only if required.
