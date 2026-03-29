## 0. Scope

This file defines execution rules for `apps/web`.

`apps/web` is the static web surface for GitHub Pages.
It is not the desktop client and it is not the gameplay backend.

This subtree is responsible for:
- landing page presentation
- feature/introduction content
- join-page presentation
- deep-link entry assistance
- share/join flow helpers
- static web asset handling
- web-only analytics/helpers related to landing/join flows

This file supplements:
- root `AGENTS.md`
- `WORKFLOW.md`
- `QUALITY.md`

Application order:
- apply this file as the nearest subtree rule for `apps/web`
- also apply root `AGENTS.md`, `WORKFLOW.md`, and `QUALITY.md`
- this file may **strengthen** subtree constraints
- this file must not weaken repository-wide governance defined by root `AGENTS.md`

---

## 1. Role of apps/web

`apps/web` is responsible for:
- landing page rendering
- join page rendering
- deep-link generation
- join entry guidance
- static asset presentation
- web-only interaction for marketing/onboarding/join assistance
- analytics/helpers tied to landing or join flows

Rules:
- Keep this subtree focused on static web presentation and entry assistance.
- Do not treat this app as the authoritative gameplay client.
- Do not treat this app as a general backend surface.
- Keep join/deeplink logic explicit and reviewable.
- Keep user-facing copy aligned with actual desktop-client/runtime capabilities.

---

## 2. Responsibility Boundary

### 2.1 This subtree owns
This subtree may own:
- LP UI
- join-page UI
- deep-link composition
- join parameter parsing/formatting
- landing/join helper utilities
- static asset fallback behavior
- web analytics related to LP/join flows

### 2.2 This subtree does not own
This subtree must not become responsible for:
- room lifecycle truth
- room join authority
- lobby source of truth
- gameplay state machine behavior
- final room-state judgment
- result aggregation
- updater backend behavior
- desktop-client internal room logic

Rules:
- This subtree may guide users into the desktop client.
- It must not replace the desktop client as the authoritative gameplay surface.
- It may assist entry into a room/join flow.
- It must not claim authoritative knowledge it does not own.

---

## 3. Normative References

Web changes must follow the current repository governance and any web/deeplink/join documentation that exists.

Primary references:
- root `AGENTS.md`
- `WORKFLOW.md`
- `QUALITY.md`
- subtree-local README or web-related docs if present

Use additionally when relevant:
- desktop join/deeplink conventions defined elsewhere in the repository
- room/join constraints only as consumed public-facing expectations, not as authority owned here
- landing-page source of truth such as approved mock/wireframe when the task is presentation-driven

Rules:
- Do not change join/deeplink behavior from guesswork.
- Do not present unsupported capabilities as if they are available.
- If web behavior depends on desktop-client expectations, confirm those expectations first.

---

## 4. Contract-adjacent Change Rule

Treat the following as contract-adjacent and review carefully by default:

- deep-link format
- join parameter format
- room/join code handling in web entry flows
- public-facing join guidance tied to actual runtime behavior
- analytics/event naming relied on by web flow analysis
- asset paths that are part of deployed page behavior

Rules:
- These changes may not be gameplay contracts, but they can still break entry flows.
- Any deep-link or join-format change must be intentional and explicitly scoped.
- Do not silently drift from the desktop-side expectations for join entry.
- If a format change affects other layers, surface it as cross-layer impact instead of treating it as LP-only polish.

---

## 5. Landing Page Rules

Landing page behavior is presentation-focused.

Rules:
- keep LP responsibilities limited to explanation, onboarding, and entry guidance
- do not encode authoritative gameplay semantics into the LP
- do not mix unrelated technical controls into user-facing landing content
- keep screenshots/assets/copy aligned with current supported behavior

### 5.1 Content integrity
Rules:
- do not claim unsupported features
- do not leave outdated behavioral claims after desktop/runtime changes
- if feature descriptions depend on implementation changes, update LP copy intentionally

### 5.2 Asset handling
Rules:
- keep asset references stable and explicit
- do not casually break published asset paths
- fallback behavior for missing images/assets must remain intentional, not accidental

---

## 6. Join Page and Deep-link Rules

The join page is an entry-assistance surface, not an authority surface.

Rules:
- join-page logic may help compose or launch a desktop join flow
- join-page logic must not become the source of truth for room validity or room state
- do not present guessed joinability as if it were confirmed
- keep deep-link behavior explicit and auditable

### 6.1 Join parameter handling
Rules:
- parse/format join parameters intentionally
- do not silently accept malformed inputs as if they were valid room entry
- validation may guide the user locally, but must not pretend to be final room/join authority
- if parameters are missing or invalid, fail in a user-clear way

### 6.2 Deep-link handling
Rules:
- deep links must reflect approved desktop-client entry expectations
- do not broaden deep-link semantics beyond what the desktop client supports
- do not hide fallback behavior or failure-to-open conditions if they materially affect the user flow

### 6.3 Join guidance
Rules:
- user guidance must reflect what actually happens after handoff to the desktop client
- do not imply that the web page itself has joined the room
- do not imply authoritative room-state knowledge unless such knowledge is genuinely available and intended

---

## 7. Analytics / Helper Rules

Analytics and helper utilities are allowed only as support for LP/join flows.

Rules:
- analytics must remain subordinate to the user-facing flow, not define it
- do not let analytics logic become a hidden dependency for correct join behavior
- analytics/event naming changes should remain explicit if downstream reporting depends on them
- helper utilities must not become a dumping ground for cross-layer logic

---

## 8. Allowed vs Prohibited Changes

### 8.1 Allowed
- bounded LP UI changes
- bounded join page/deeplink changes
- explicit join guidance improvements
- asset/fallback hardening
- analytics/helper improvements tied to LP/join flows
- web-only tests/validation strengthening

### 8.2 Prohibited by default
- gameplay state logic expansion
- authority-like room validation claims
- hidden deep-link format changes
- broad web-app generalization unrelated to LP/join scope
- mixing unrelated cleanup with join/deeplink semantics
- turning the web app into a partial gameplay client

---

## 9. Validation Expectations

Web changes are not complete without validation appropriate to the risk level.

Minimum expectations:
- build/typecheck succeeds where applicable
- page entry points remain consistent
- no unintended diff remains
- asset/path usage remains internally consistent

For contract-adjacent changes, additionally validate as relevant:
- deep-link composition behavior
- join parameter parsing/formatting behavior
- invalid/missing input handling
- deployed path/asset behavior
- LP/join copy accuracy where behavior claims changed

### 9.1 Change-to-validation expectation
If the change affects one of the following areas, the corresponding validation is mandatory:

- landing-page presentation/content
  - validate visible content and asset/path integrity
- join-page behavior
  - validate parameter parsing, invalid-input handling, and handoff behavior
- deep-link behavior
  - validate composed link format and fallback/failure handling where relevant
- analytics/helper behavior
  - validate that join/landing behavior does not depend on analytics success
- asset/fallback behavior
  - validate missing/broken asset handling explicitly if touched

### 9.2 Validation evidence rule
Do not treat build success alone as sufficient when entry-flow behavior changed.

Rules:
- if join/deeplink behavior changed, include behavior-oriented validation evidence
- if copy changed in behavior-sensitive areas, validate it against actual supported flow
- if asset/fallback behavior changed, validate the affected visible paths explicitly

---

## 10. Diff Discipline for apps/web

Rules:
- keep changes scoped to LP/join/deeplink/helpers/assets/tests as needed
- separate copy/content changes from join/deeplink semantic changes when practical
- avoid broad component reshuffles during focused entry-flow work
- keep semantic user-flow changes easy to audit in diff
- do not edit generated outputs unless the task explicitly requires it

### 10.1 Preferred change shape
Prefer:
1. update the minimum LP/join/deeplink surface
2. update affected helpers/assets/tests
3. validate
4. summarize entry-flow impact explicitly

---

## 11. Documentation Rule

When web behavior changes, the change summary must state:
- what user-visible web behavior changed
- whether landing content, join flow, or deep-link behavior changed
- whether the change is additive or breaking for the entry flow
- whether any desktop/runtime expectation was assumed
- what validation was performed

Do not leave reviewers to infer entry-flow risk from diff alone.

### 11.1 Reviewable summary expectation
For non-trivial web changes, the summary should also make visible:
- whether deep-link format changed
- whether join guidance changed
- whether invalid-input behavior changed
- whether analytics/helper behavior changed in a user-visible way

---

## 12. Completion Rule

An `apps/web` task is complete only when:
- LP/join responsibilities remain clean
- join/deeplink behavior is intentionally preserved or explicitly updated
- user-facing guidance remains aligned with actual supported behavior
- validation appropriate to the risk level is complete
- no unrelated web churn remains

### 12.1 Not complete yet
An `apps/web` task is not complete if any of the following is true:
- the page now implies authority it does not own
- deep-link or join parameter behavior changed but entry-flow validation is missing
- invalid-input handling changed but user-visible behavior was not checked
- LP copy now claims unsupported behavior
- unrelated gameplay/backend responsibility leaked into this subtree