# Task 9 handoff

**Source stable for consolidated review; no visual acceptance claim.**

Changed `governance-registers.tsx`, `governance-third-edition.module.css`, and only `GovernanceView`/necessary imports in `ward-management-modes.tsx`. Pre-edit copies are in `.superpowers/sdd/2026-09-13-product-refinement/task-9-before/`. No domain edits.

- Captured-session register has category/outcome/review filters, real counts, keyboard tabs/rows, explicit selection, all seven typed event categories, immutable detail facts, and review history. Administrative review dispatches the selected generation/current displayed review count; confirmation requires the resulting audit attempt and review. Reset remounts the local workspace; changing selection/tab/filter clears feedback.
- Legacy override/change facts and page-local search access remain separate from captured reviewable events. Existing effectiveness arithmetic/sample suppression remains in an optional tab. Exported panels/helpers retain compatible signatures. No patient-link reads, backfilled history, fictional reviewer, role switch, or freeform review reason was added.
- Drawing hierarchy retained: register left, event detail and review/history right. Desktop bodies scroll independently with review controls outside the scroll; phone uses natural stacked flow; print removes controls/scroll limits. Narrative cards/sample trail were replaced by operational content and a concise expandable synthetic/device boundary.

**Checks:** two TSX files parsed with zero syntax diagnostics; three owned source files formatted using installed Prettier. No tests, typecheck, browser, server, Git, or provider operations. Actual six-view evidence and focused behavioral checks remain controller-owned.

**High-value cases:** empty session; all category/outcome filters including mixed/refused/stale; keyboard select; record reviewed/follow-up then confirm actual history; stale review refusal; review-of-review disabled; denied API; reset clears selection; legacy/effectiveness populations remain separate; long discharge facts/history keep review controls reachable; live movement/ward links only when uniquely present.

**Blockers:** none known from source inspection. Referral IDs have no invented detail route; available movement/ward routes and captured-event inspection are used. Existing old assertions denying review functionality will require the controller's planned updates.
