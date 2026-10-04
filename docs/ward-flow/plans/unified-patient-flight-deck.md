# Unified Patient Now flight deck

Task: patient dossier and movement workspace unification, 4 October 2026.
Repository: BigSimmo/Ward-Flow. Local implementation on `codex/unified-patient-flight-deck`,
based on the supplied main-history snapshot `d37ec24`. No provider publication or deployment.

Patient Now remains the master layout: identity, clinical readiness, seven-stage journey and
Now / History / Community / Details / Documents. The Now view switches locally between
Clinical overview and Transit operations. Coordinate placement and each journey panel's
Review stage actions focus and scroll to the local operational workspace.

`patient-transit-operations.tsx` reads provider movements, units, admissions, the demo clock,
rejections and permission-scoped audit outcomes. It contains cohort-filtered ward eligibility,
referral selection, explicit ward-placement checks where required, acceptance, pull/hold clocks,
transport phone-booking facts, handover/provider/vehicle/collection milestones, arrival, release,
reasoned stage corrections and confirmed whole-search withdrawal. Existing cockpit exception
handlers and paper-authority controls are reused through its embedded mode.

The existing reducer contract is authoritative. Prompt labels map to the actual events:

| UI action                     | Reducer event / actor                                        |
| ----------------------------- | ------------------------------------------------------------ |
| Refer to wards                | `REFER_TO_UNITS` / coordinator                               |
| Accept bed                    | `ACCEPT_IN_PRINCIPLE` / ward                                 |
| Pull / release                | `PULL_PATIENT`, `RELEASE_PULL` / coordinator                 |
| Record booking                | `BOOK_TRANSPORT` / sending ED team                           |
| Handover ready                | `HANDOVER_READY` / ED                                        |
| Provider / vehicle milestones | `TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE` / officer         |
| Mark moving                   | `PATIENT_COLLECTED` / officer                                |
| Confirm arrival               | `PATIENT_ARRIVED` / receiving ward with matching unit ID     |
| Step back                     | `STEP_BACK_STAGE` / coordinator, enumerated mandatory reason |
| Withdraw search               | `WITHDRAW_REFERRAL` / coordinator                            |

Role values retain the prototype's existing simulated actor model; they are not authentication.
A stage correction preserves held beds and booked jobs. The existing explicit release and
transport exception controls unwind those resources. No reducer or legal-form rules changed.
Missing clinical facts remain unrecorded, and no clinical history was fabricated to fill the tabs.

Both `/people/[patientId]` and legacy `/movements/[movementId]` render Patient Now using their
actual requested ID. Malformed IDs preserve the governed missing state. The explicit
`?view=governed` / `?view=legacy` dossier remains supported. Movement links from other screens
need no rewrite. The legacy movement route's shell title also reads Patient Now.

## Local verification

```sh
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit --incremental false
npx vitest run tests/ward-patient-flight-deck.dom.test.tsx tests/ward-patient-now-screen.dom.test.tsx tests/ward-patient-now.dom.test.tsx tests/ward-patient-transport-section.dom.test.tsx tests/ward-workflow-actions.dom.test.tsx tests/ward-flow-reducer.test.ts tests/ward-eligibility.test.ts tests/ward-movement-stage-changes.test.ts tests/ward-movement-step-back-reducer.test.ts tests/ward-transport-need-vs-booked-job-2026-09-25.test.ts tests/ward-transport-not-needed.test.ts tests/ward-patient-now-no-invented-forms.test.ts tests/ward-flow-data-boundary.test.ts tests/ward-css-token-references-resolve.test.ts
npm run ensure
# Use the URL printed by ensure; the capture script checks /api/local-project-id.
FLIGHT_DECK_CHROMIUM=/usr/bin/chromium node scripts/ward-flow/capture-patient-flight-deck.mjs <ensure-url> <output-dir>
```

`FLIGHT_DECK_CHROMIUM` is optional if Playwright's Chromium is installed. The capture script is
local-only and performs the full referral-to-arrival workflow at 1440, 820 and 390 pixels. It
creates viewport screenshots, full-view screenshots, an HTML gallery and a JSON evidence
manifest. Full-view captures expand scroll containers only for the image; viewport captures
preserve the app's actual scrolling. Captures cover the five dossier tabs, both Now views,
shortlist and history filters, journey accordion panels, booking and correction forms,
arrival/document dialogs, the governed dossier and legacy movement route.

The local evidence folder also contains an axe-core result for the new transit deck at all three
sizes, focus handoff and visible button dimensions. These checks cover the new deck; they are
not a certification of the whole existing application.

## Compact visual refinement — 4 October 2026

The subsequent owner request replaces the expansive header with a curved navy identity band,
a compact four-part snapshot and a local next-action toolbar. `patient-flight-header.tsx` is a
presentation component; Patient Now supplies its identity and movement facts from shared state.
The operational modules use rounded surfaces, smaller gaps and side-by-side ward review and
dispatch on desktop. The duplicate metrics deck is visually removed because the snapshot
already supplies those facts. On narrow screens dispatch appears before the shortlist and the
journey remains available through an accessible disclosure.

The initial Now view is transit operations for an open movement and clinical context for a
completed/closed journey. Explicit Now-view choices remain available. “Live bedflow” means an
open synthetic movement with neither a closure nor the arrived stage, not a live EHR connection.
The header status is announced by a live region; the local rail says LIVE BEDFLOW or NOT IN LIVE
BEDFLOW. Arriving or withdrawing a referred bed search updates both labels from reducer state.

A patient without a linked movement receives `patient-record-overview.tsx`, a compact hub for
recorded identity, address, legal status, GP, catchment, history and documents. Its shortcuts open
and focus the existing dossier tabs. Unsupported community coordinator, medication, telephone
and outpatient-review claims were removed from the record-only rail. Catchment is explicitly
separated from proof of active care. Withdrawal remains disabled when no ward referral exists.

Verification covers 276 tests in ten focused suites, including arrival/withdrawal live-status
changes, record-only navigation, referral/placement/transport actions and reducer constraints.
The current visual capture includes both live and inactive records at 1440, 820 and 390 pixels.

For Patient Now at tablet widths, the existing shell Menu carries navigation and shift context,
so the expanded shift/search chrome no longer consumes the top half of the viewport. Desktop
navigation and other screens retain their existing layouts. Automated axe checks of the patient
page found no WCAG 2/2.1 AA violations for live and record-only views at the three target sizes;
this is local automated evidence, not certification of the complete application.

## Dossier tabs and tracker refinement — 4 October 2026

The next owner iteration keeps the compact curved visual framework and restructures the contents
of all five tabs. `patient-dossier-tabs.tsx` owns the four secondary panes and their scoped styles;
`patient-clinical-summary.tsx` owns the Now clinical overview. History has searchable, filterable,
sortable episode cards and an actual reducer stage-change log, replacing the fixed-year diagram.
Community separates catchment and GP records from confirmed follow-up, with source-derived
coordination contacts. Details groups patient identity, care facts and movement context, counts
unrecorded fields and supports a missing-information filter. Documents combines recorded legal
forms with provider-uploaded metadata, with search, authority/transfer filters and expandable
source details. Binary files are not invented or retained by this metadata-only prototype.

`patient-tracker-facts.tsx` keeps the destination, actual admission bed state, hold countdown,
active transport/CAD/ETA and medical clearance visible beside every tab. Its seven-stage graphic
and stage nodes distinguish recorded transitions from the current stage and unrecorded stages.
Secondary tabs put these operational facts ahead of the stage list. Inactive records retain the
explicit inactive sidebar. Opening coordination returns to the local Now controls.

The ward shortlist now has a name search. Once a destination is accepted, dispatch precedes the
network eligibility reference in both DOM and visual order. Successful stage and transport
milestones focus the next-action heading; typing or ticking the demo clock does not steal focus.
The clearance dialog now records the treating team's explicit cleared/not-cleared outcome via
`RECORD_MOVEMENT_MEDICAL_CLEARANCE`, only after an outcome and confirmation are supplied. It
does not simulate a request or notification. Escape/close/save restore focus to the opener.

All facts continue to derive from the patient record or shared Ward Flow state. The reducer,
legal checks, role constraints and route behaviour are unchanged. Sparse history remains sparse;
unrecorded clinical facts, document expiry, community allocation and contacts stay explicit.

Local completion evidence: 285 tests passed across 12 focused suites, TypeScript and scoped ESLint
passed, and the new capture checks 30 live/inactive tab states with axe at 1440, 820 and 390 pixels.
The screenshot set includes 57 view/filter/dialog states and 125 images. Automated checks found
no relevant WCAG 2/2.1 AA violations, browser runtime errors or horizontal viewport overflow.
The local gallery and logs are in `/workspace/artifacts/ward-flow-perfected-tabs`; no publication
or deployment occurred.

```sh
npx vitest run tests/ward-patient-dossier-tabs.dom.test.tsx tests/ward-patient-flight-deck.dom.test.tsx tests/ward-patient-now-screen.dom.test.tsx tests/ward-patient-now.dom.test.tsx tests/ward-patient-transport-section.dom.test.tsx tests/ward-workflow-actions.dom.test.tsx tests/ward-flow-reducer.test.ts tests/ward-eligibility.test.ts tests/ward-movement-stage-changes.test.ts tests/ward-movement-step-back-reducer.test.ts tests/ward-transport-need-vs-booked-job-2026-09-25.test.ts tests/ward-transport-not-needed.test.ts
npm run ensure
FLIGHT_DECK_CHROMIUM=/usr/bin/chromium node scripts/ward-flow/capture-patient-dossier-tabs.mjs <ensure-url> <output-dir>
```

Viewport images preserve the actual app scrolling. Full images expand scroll containers only
for capture. Desktop workspace images crop the native tracker and active pane so the tab layouts
can be compared without repeating the identity header. Browser evidence is synthetic only.
