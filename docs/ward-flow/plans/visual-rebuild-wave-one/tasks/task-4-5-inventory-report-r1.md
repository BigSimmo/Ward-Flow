Task 4/5 source inventory — 2026-09-12

Scope: source-only preparation. Read the Lane A plan (`docs/ward-flow/plans/2026-09-1x-lane-a-command-delays-movement-capacity.md`), current screen components/styles, and served-drawing source HTML. No application edits, tests, browser, server, provider, Git, or claim changes.

## Command

Drawing: `docs/ward-flow/mockups/command-third-edition.html`.

Three-way inventory:

- Drawing and app: page title `Command`; Emergency department pressure; Priority queue; Statewide flow; exception/register tabs; Explainable shortlist / Referral placement; prototype disclosure and shell chrome.
- Drawing-only presentation targets: the drawing’s exact five-panel order and panel geometry (`Emergency department pressure`, `Priority queue`, `Statewide flow`, exception tabs, shortlist), compact legend/diagram treatment, and its precise responsive hierarchy. These need rendered comparison; source alone cannot certify fidelity.
- App-only behaviour/content to preserve: queue Patients/Referrals tablist and counts; movement/referral selection; department filter; exception toggle and four register surfaces (Declines, Override register, Exceptions, Refused actions); flow node buttons and measured overflow note; shortlist candidate eligibility/gate explanations; urgency/legal-status changes; release-pull and cancel-transport forms; referral placement state; escalation/refusal records; governance/prototype wording; fixed phone action row and existing shell drawer controls.

Owned source/style set: `src/components/ward-management/coordinator/coordinator-screen.tsx`, `coordinator.module.css`, `pressure-strip.tsx`, `priority-queue.tsx`, `flow-diagram.tsx`, `exception-drawer.tsx`, `shortlist-panel.tsx`. Exact anchors/selectors include `.screen`, `.main`, `.body`, `.regionGrid`, `.pressureStrip`, `.queueRegion`, `.queueTabs`, `.queueList`, `.diagramRegion`, `.diagramScroll`, `.registersRegion`, `.shortlistRegion`, `.shortlistBody`, `.shortlistActionRow`; test IDs include `ward-coordinator-body`, `ward-queue-tab-*`, `ward-queue-row-*`, `ward-diagram-scroll`, `ward-diagram-unit-*`, `ward-coordinator-registers`, `ward-shortlist-*`, `ward-referral-placement-*`.

Focused contract: `tests/ward-command-third-edition.dom.test.tsx` (panel order, exceptions placement, shortlist title, diagram state words, queue tabs). Existing behavioural contracts remain required when their owned interaction is changed.

Stale claims: older handover prose saying shared Service/Activity/Tools controls are absent is contradicted by the current mounted `shell/ward-bar.tsx` and the wave plan; do not recreate a second header. The lane plan’s “five panels” wording is the drawing’s top-level order; `Referral placement` is a shortlist retitle, not a sixth panel, and the exception content is a tabbed region.

## Delays

Drawing: `docs/ward-flow/mockups/delays-third-edition.html`.

Three-way inventory:

- Drawing and app: `Delays`; `Who is holding people up`; `Waiting`; `What the blocker is`; `Escalations and resolved` with Escalations/Resolved today tabs; selected-person detail; `What is invented and what is real`; prototype badge and shell chrome.
- Drawing-only presentation targets: exact three-column/region arrangement, owner strip and blocker group visual hierarchy, tabbed register geometry, compact selected-person panel and footer disclosure style. The mockup’s independent scrollers are a layout target, while the app’s documented scroll decision bounds only the person list and cause/register columns.
- App-only behaviour/content to preserve: `Worth your attention`; `Delays with no named person`; open-only waiting population; one-blocker-per-person derivation; deadline/form wording; selected-person state and detail facts; escalation/refusal explanations; `Release the bed` and `Override a refusal` links; coordinator navigation with focus movement; reconciliation/prototype disclosures; no fabricated blocker or duration.

Owned source/style set: `src/components/ward-management/delays/delays-screen.tsx`, `delays.module.css`; retain `delays-derivations.ts`. Exact selectors/classes include `.screen`, `.main`, `.pageTitle`, `.prototypeBadge`, `.ownerStrip`, `.personList`, `.causePanel`, `.tabsPanel`, `.tabbar`, `.detail`, `.attention`, `.noPerson`, `.disclosure`; test IDs include `ward-delays-page`, `ward-delays-nobody-waiting`, `delays-owner-*`, `delays-cause-*`, `delays-detail-empty`, `delays-detail-*`, `delays-blocker`, `delays-escalation`, `delays-release-pull-*`, `delays-override-*`.

Focused contracts: `tests/ward-delays-third-edition.dom.test.tsx` (drawing panel names/order, tabs, selected-person headings and wording); `tests/ward-delays-screen.dom.test.tsx`; add the targeted `ward-delays-*` files only when the changed path affects their deadline, resolved-outcome, breached-clock, legal, or empty-state guarantees.

Stale claims: the Lane A plan’s earlier statement that Delays had no app equivalent for `What the blocker is` is superseded by the current component, which renders that panel. Its D2 proposed replacement wording is unsafe: the current legal-deadline sentence names the form and is contract-tested; preserve that wording unless Ward Lead changes the ruling.

Visual status: no visual verification has been performed. Human acceptance remains pending. If a decision outside this source inventory is required, stop and hand it back.
