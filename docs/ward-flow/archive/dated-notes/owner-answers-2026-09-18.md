# Owner answers — 18 September 2026

Josh reviewed and ruled on the 18 outstanding questions, architectural decisions, and clinical workflow items for Ward Flow on 18 September 2026. These rulings provide authoritative direction on clinical prioritisation, transport integration, referral lifecycles, and interface standards.

---

## Summary of rulings

| #    | Item                                                                  | Ruling              | Status / Impact                                                                                          |
| ---- | --------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | Non-transport handover progression (`WF-16`)                          | **Yes**             | Approved — departure prerequisite satisfied when no transport needed.                                    |
| 2    | Bed cancellation cancels/prompts linked transport (`WF-37`)           | **Yes**             | Approved — releasing a bed pull cancels or prompts transport cancellation.                               |
| 3    | Involuntary bed matching / zero vacant locked beds (`WF-01`, `WF-10`) | **NO to rejecting** | **CRITICAL CLINICAL RULING** — patients must be waitlisted; 3-tier prioritisation hierarchy established. |
| 4    | Terminal state on referral withdrawal (`WF-13`, `P3-WD`)              | **Yes**             | Approved — withdrawal is terminal; clears queues and resets `acceptedUnitId`.                            |
| 5    | Network-wide search privacy / cross-ward referral lookup (`D-14`)     | **Leave for now**   | Prototyping full system; future role-based logins will govern access.                                    |
| 6    | Community screen transport booking affordance (`ISSUE-P2-88`)         | **Yes**             | Approved — link `Admission` to `Movement` to provide transport affordance.                               |
| 7    | Mobile drawer sheet adaptation (`DRAWER-RESPONSIVE-SHEET`)            | **Approved**        | Responsive full-screen / bottom sheet on viewports <640px.                                               |
| 8    | 44px minimum tap targets (`P2` touch ergonomics)                      | **Approved**        | Enforce 44×44px interactive tap target minimum across mobile/tablet.                                     |
| 9    | ED board table inline legal form dropdown (`ED-FORM-DROPDOWN`)        | **Approved**        | Mockup parity for listbox dropdown directly on `.formPill`.                                              |
| 10   | Patient journey accordion keyboard accessibility                      | **Approved**        | Ensure roving tabindex, Enter/Space toggling, and `aria-expanded` compliance.                            |
| 11   | Global drawer keyboard shortcuts (`SOVEREIGN-KEYBOARD-BUS`)           | **Approved**        | Bind `Shift+T` (Tasks), `Shift+R` (Referrals), `Shift+A` (Activity), and Escape.                         |
| 12   | Referral drawer live capacity binding (`REFERRAL-DRAWER-CAPACITY`)    | **Approved**        | Bind Stage 3 dynamically to live network capacity records.                                               |
| 13   | Community contact information unlinked until verified                 | **Approved**        | Keep community service contact numbers unlinked until verified.                                          |
| 14   | Playwright browser journey test prompt (`test:e2e:ward-journeys`)     | **Approved**        | Prompt created for running browser journey suite in a separate chat.                                     |
| 15   | Visual regression snapshot baseline capture (`npm run test:visual`)   | **Approved**        | Capture baselines for ED (1440px) and sovereign rail across themes.                                      |
| 16   | Design system documentation update (`WARD-FLOW-DESIGN-SYSTEM.md`)     | **Approved**        | Update to 34 screens + standing rules (Rule D5), noting ongoing perfection.                              |
| 17   | Aboriginal cultural safety review                                     | **Defer**           | Stays deferred on task ledger; mandatory pre-clinical gate.                                              |
| 18   | Outside compliance and governance gates                               | **Defer**           | Regulatory and compliance reviews remain deferred during prototype phase.                                |
| Note | Dedicated patient transport section                                   | **Build now**       | Interface for tracking booked transport, logging bookings, CAD numbers, and ETAs.                        |

---

## Rulings and clinical rationale

### 1. Non-transport handover progression (`WF-16`)

- **Ruling**: **Yes** — non-transport handover progression approved.
- **Clinical rationale**: When mental health transfers do not require transport vehicles (such as family transport, walking escorts between adjacent facilities, or internal campus transfers), `HANDOVER_READY` previously dead-ended because it still required an artificial transport booking. In clinical practice, non-vehicular transfers are common. The handover readiness logic must allow `transport.needed === false` to satisfy the departure prerequisite, enabling direct progression to ward arrival.

### 2. Bed cancellation automatically cancels or prompts cancellation of linked booked transport (`WF-37`)

- **Ruling**: **Yes** — bed cancellation automatically cancels or prompts cancellation of linked booked transport.
- **Clinical rationale**: Releasing or cancelling a bed reservation (`RELEASE_PULL`) must automatically cancel or prompt the cancellation of any linked booked transport job. Leaving an active ambulance or transport booking after a bed has been cancelled causes severe operational waste, dispatches transport crews for unavailable beds, and risks patient arrival at wards with zero capacity to receive them.

### 3. CRITICAL CLINICAL RULING: Involuntary bed matching and zero vacant locked bed handling (`WF-01`, `WF-10`)

- **Ruling**: **NO to rejecting wards with 0 vacant locked beds. Patients often need to be waitlisted!**
- **Clinical rationale**: It is clinically incorrect to hide or reject wards from referral matching simply because they have zero currently unoccupied locked beds. In real psychiatric bed coordination, patients requiring secure/locked inpatient care frequently need to be waitlisted for a bed in their home catchment rather than immediately diverted out-of-catchment or rejected from the triage queue. A ward with zero current vacancies must remain selectable so coordinators can queue referrals, hold priority candidates, and manage bed flow as discharges occur.
- **Prioritisation hierarchy**:
  1. **1st: In catchment capacity** — Wards in the patient's home catchment that currently have available beds.
  2. **2nd: Available with beds** — Alternative out-of-catchment or general services that have available beds.
  3. **3rd: In catchment with no beds** — Wards in the patient's home catchment with zero current bed vacancies (allowing waitlisting and proactive queue management).

### 4. Terminal state on referral withdrawal (`WF-13`, `P3-WD`)

- **Ruling**: **Yes** — terminal state on referral withdrawal.
- **Clinical rationale**: `WITHDRAW_REFERRAL` must be a definitive terminal state that cleanly removes the referral from active triage queues and prevents subsequent decision events from acting on it. On post-acceptance withdrawals (`P3-WD`), the engine must cleanly reset `acceptedUnitId` (or void the accepted assignment) so withdrawn records do not display an accepted ward name or retain ghost allocations in the UI.

### 5. Network-wide search privacy and cross-ward referral lookup (`D-14`)

- **Ruling**: **Leave network-wide search privacy for now** — building full system; future role-based logins will govern access.
- **Clinical rationale**: While prototyping the complete integrated system across all screens and services, do not prematurely restrict cross-ward referral lookups or enforce narrow default-deny privacy gates that fragment visibility between wards and patient search. Granular clinical permissions, tenant isolation, and visibility rules will be governed by future role-based authentication when production access controls are introduced.

### 6. Community screen transport booking affordance (`ISSUE-P2-88`)

- **Ruling**: **Yes** — community screen transport booking affordance (link admission to movement).
- **Clinical rationale**: The engine already supports community place transport booking and cancellation (`BOOK_TRANSPORT`, `CANCEL_TRANSPORT` with `actingPlaceId`), but the community screen's "bed pulled" list was historically `Admission`-based without a direct `movementId`. Linking `Admission` to `Movement` provides the required identifier to wire transport booking affordances directly on the community screen, supporting the phone booking workflow.

### 7. Mobile drawer responsive sheet adaptation (`DRAWER-RESPONSIVE-SHEET`)

- **Ruling**: **Approved** — mobile drawer sheet.
- **Clinical rationale**: On small smartphone viewports (<640px), the 48rem Referral Drawer width exceeds screen dimensions. Adapting the right-hand sheet to a 100vw full-screen or bottom-sheet drawer with swipe-to-dismiss gesture and background scroll locking ensures clinicians can access the placement engine reliably on handheld devices without horizontal clipping.

### 8. Minimum 44px touch / tap targets (`P2` touch ergonomics)

- **Ruling**: **Approved** — 44px tap targets.
- **Clinical rationale**: Interactive controls with sub-44px dimensions (such as 99×28px triggers or compact table actions) cause misclicks and user frustration in high-tempo clinical environments. Enforcing minimum 44×44px interactive tap target bounds ensures reliable operation on tablet and mobile touchscreens.

### 9. ED board table inline legal form dropdown (`ED-FORM-DROPDOWN` / `ED-FORM-POPOVER`)

- **Ruling**: **Approved** — ED inline legal form dropdown.
- **Clinical rationale**: Implementing the Third-Edition mockup's interactive listbox dropdown (`data-form-open`, `aria-haspopup="listbox"`, `ul.formMenu`) on the `.formPill` element in `ed-screen.tsx` gives clinicians instant 1:1 access to assign or reassign statutory forms directly from the board row, achieving full parity with `emergency-department-third-edition.html`.

### 10. Patient journey accordion keyboard accessibility

- **Ruling**: **Approved** — journey accordion keyboard accessibility.
- **Clinical rationale**: The interactive 7-stage presentation bedflow milestone accordion on the patient details / Patient Now screen must be fully keyboard accessible (supporting Enter/Space toggling, `aria-expanded`, visible focus outlines, and roving tabindex), conforming to assistive technology standards and keyboard-driven clinical workflows.

### 11. Global drawer keyboard shortcuts (`SOVEREIGN-KEYBOARD-BUS`)

- **Ruling**: **Approved** — drawer shortcuts.
- **Clinical rationale**: Binding global access keys (`Shift+T` for Tasks, `Shift+R` for Referral Drawer, `Shift+A` for Activity) with standard Escape dismissal and focus restoration provides rapid, keyboard-first navigation for bed flow coordinators managing acute admissions across multiple facilities.

### 12. Referral drawer live capacity binding (`REFERRAL-DRAWER-CAPACITY`)

- **Ruling**: **Approved** — referral drawer live capacity.
- **Clinical rationale**: Binding Stage 3 of `ward-referral-drawer.tsx` dynamically to live network capacity records (`useWardCapacity()` / `CAPACITY_RECORDS`) ensures unit recommendations reflect real-time male/female acute bed availability across East Metro, North Metro, South Metro, and WACHS, preventing referrals to units with zero capacity when alternative beds exist.

### 13. Community contact information unlinked until verified

- **Ruling**: **Approved** — leave community contact unlinked until verified.
- **Clinical rationale**: Community mental health service contact phone numbers and email links should remain plain unlinked text until verified against genuine, confirmed Western Australia health directories, preventing clinicians from dialing dummy or incorrect telephone numbers during urgent clinical coordination.

### 14. Playwright browser journey test prompt (`test:e2e:ward-journeys`)

- **Ruling**: **Approved** — browser journey test prompt created for running in a separate chat.
- **Clinical rationale**: Running the 12 browser-level Playwright specs (`npm run test:e2e:ward-journeys`) requires dedicated execution against the running dev server. Isolating this browser journey suite in a separate execution prompt ensures end-to-end user journeys are verified without blocking or colliding with ongoing development worktrees.

### 15. Visual regression snapshot baseline capture (`VISUAL-SNAPSHOTS-SOVEREIGN`, `ED-VISUAL-SNAPSHOTS`)

- **Ruling**: **Approved** — visual snapshots baseline capture.
- **Clinical rationale**: Automated visual regression snapshots in Playwright (`npm run test:visual`) lock in pixel-perfect visual standards for the ED board table at 1440px desktop breakpoint and the third-edition sovereign navigation rail across collapsed (72px) and open (264px) states and theme variants.

### 16. Design system documentation update (`WARD-FLOW-DESIGN-SYSTEM.md`)

- **Ruling**: **Approved** — update design system document to 34 screens + standing rules, noting ongoing design perfection.
- **Clinical rationale**: Update `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` to reflect the full active 34-screen estate and standing rules (specifically Rule D5: no calculated statutory countdowns, clinician-typed expiries, independent ED clocks, manual bed release), explicitly acknowledging that design perfection is continuous across screens.

### 17. Aboriginal cultural safety review

- **Ruling**: **Defer** — cultural safety review stays deferred.
- **Clinical rationale**: Aboriginal cultural safety review remains deferred on the task ledger per owner instruction. It is preserved as a non-negotiable, mandatory pre-clinical hard gate before the system is ever deployed with real patient data.

### 18. Outside compliance and governance gates

- **Ruling**: **Defer** — outside compliance/governance gates stay deferred.
- **Clinical rationale**: External statutory and regulatory reviews (TGA medical device classification, Clinical Safety Officer sign-off, Privacy Officer review, WA Mental Health Act legal counsel, and formal catchment sign-off) stay deferred during the prototype phase; recorded as high-priority production release gates.

---

## Added note: Dedicated patient transport section

- **Ruling / Instruction**: **Build a dedicated patient transport section flagging booked transport, marking transport as booked, entering the CAD transport number, and recording the quoted ETA.**
- **Clinical rationale**: Builds upon the 17 September transport booking ruling (booking in Ward Flow logs a phone booking made to transport dispatch; it is never an automatic in-app vehicle dispatch). Providing a dedicated patient transport section in the interface enables clinicians and coordinators to:
  1. Clearly flag and track all patients with booked or pending transport across the network.
  2. Record the action of booking transport via an explicit "Transport booked" control.
  3. Enter the official Computer-Aided Dispatch (CAD) transport booking reference number.
  4. Record the quoted estimated time of arrival (ETA), keeping ED, ward, and community teams coordinated on patient transfer timing and eliminating offload uncertainty.
