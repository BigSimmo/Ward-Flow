# F03/F04/F07 independent visual review — r8

Reviewer: `gpt-5.6-sol / medium`. This is an independent screenshot and source-structure review; the reviewer did not author these five surfaces.

## Evidence and limits

All twenty supplied PNGs were viewed at original detail: app and served drawing at 1440px and 390px for Patient search, Patient Now, Raise a referral, Referrals, and Add a patient. Each image is an initial viewport only. It proves the visible panel hierarchy and initial reachability pressure; it does not prove content or controls below the captured fold, interactions, focus order, scrolling to the end, print, dark mode, or forced colours. No page is marked visually verified from these captures.

| Surface          | App 1440 / 390 SHA-256              | Drawing 1440 / 390 SHA-256        |
| ---------------- | ----------------------------------- | --------------------------------- |
| Patient search   | `2586DEFA…EAEB7` / `F2057ECF…931E7` | `D336859E…D066` / `A50587E2…07A1` |
| Patient Now      | `77B62718…FB8A` / `D4EE008B…9124`   | `ADEADC65…D679` / `AA08FE08…9E97` |
| Raise a referral | `CA1FBEE0…A1EF` / `D48E5FE1…F6E8`   | `01AD9101…9993` / `6AE3AA6F…619A` |
| Referrals        | `982A6944…F3C6` / `98BF201E…E96F`   | `08F50459…CD60` / `A89B4D6F…A536` |
| Add a patient    | `712F4728…16ED` / `A08698A1…A2F8`   | `EE97691B…F7DD` / `95022C5F…177E` |

The app's larger movement/referral populations, honest empty selections, FD-23 omissions, and explicit absent-data statements were treated as authoritative differences. They do not explain the layout findings below.

## Findings

### P1 — Patient Now does not present the drawing's current-movement workspace

At 1440px the app opens with tabs and the FD-23 explanation across the upper-right, a detached `What you can do` card at upper-left, and a large identity table beneath. The drawing opens with a single `The person now` band containing identity, current location/owner, wait, movement blockers and actions, then a Journey rail and Now/history workspace. At 390px the app again puts tabs and the omission prose before identity; the referral action and any useful current-status statement are below the captured identity table. The drawing puts the person's current state and blockers first.

The current source confirms this is structural rather than a capture glitch: `person-screen.tsx` renders only patient identity/placement/document tabs plus the referral action, and `person.module.css` places the action beside the tab workspace. There is no current-movement binding to restyle into Journey, blockers or timeline. Do not fabricate those facts. The smallest honest correction is:

1. Put `The person now` identity first at both widths and integrate `Refer Patient` into that panel's action row.
2. Put the tablist and its FD-23 explanation after the identity/action panel.
3. Add an explicit, compact absence line when this route has no authorised current-movement projection.

Matching the drawing's Journey/blocker/timeline regions needs a separately authorised binding from the existing movement engine. Presentation CSS alone cannot truthfully close that gap.

### P1 — Referral register desktop queue is not readable at its assigned width

The app's desktop queue uses the wide legacy table inside roughly half the content width. `Tier 2 · urgent`, `Female`, and `not a ward referral` break across multiple short lines, while the drawing uses compact rich rows and keeps urgency, wait and request facts legible. The right detail panel is an honest empty state until selection, so the missing selected record is a state difference; the compressed queue is not.

The phone app already renders the existing card representation and preserves the same six queued records. Reuse that card list at desktop, or make it the primary queue at all widths, with a bounded internal scroll matching the drawing. Keep the current explicit empty detail until the user selects a referral rather than adding an implicit clinical selection. Preserve the existing urgency ordering note and decided register below the live queue.

### P1 — Referral intake's main hierarchy is reversed relative to the decision workflow

At 1440px the app lays Step 1 and Step 2 in two tall parallel columns and gives the entire right rail to progress, a twelve-field prose summary and governance explanation. The drawing uses a full-width person context, vertically stacked Step 1/2/3 panels, and a working right rail led by `Where to refer` and `Send`. In the app the destination and send work is displaced below the initial viewport by explanatory regions. At 390px the app begins immediately with the generic Step 1 form, while the drawing begins with the linked person context.

The generic app route may legitimately have no `patientId`; that explains the missing named person in this capture, but it should render an explicit `No person linked to this referral` context panel rather than omit the region. Keep the current person-linked branch when a pointer exists. Then stack the step panels in the main column and place the existing destination selection and send status before Progress/record-summary prose in the desktop aside. On phone, retain DOM order as person context, steps, destinations, send, then explanatory summaries so the completion action does not sit after multiple governance cards.

### P2 — Patient search is a sequence of legacy result blocks rather than one bounded search console

At desktop the app shows `No people`, then a separate `49 matches` referral list, then the filters and movement table. The drawing has one bounded Results instrument with tabs/rich rows, the search/refinement panel directly below, and Selected person at right. The app's right empty preview is truthful, but its top edge and height collapse to a small message while the left column continues. On phone the app spends the initial content viewport on the `No people` panel and the first referral rows; the actual filter controls and movement results are pushed substantially further down than in the drawing.

Keep all three engine result populations and the empty preview. Wrap the people/referral/movement subsets in one Results panel, give the result area a bounded internal scroll on desktop, and keep Search directly after it. On phone, put the query/refinement controls before the long result population or add the drawing's compact result facets at the Results header; do not require scrolling through queued-referral rows to change the movement filters. The selected preview should occupy a stable panel height rather than collapsing to a two-line card.

### P2 — Add a patient retains a tall one-field-per-row desktop form

The phone app is structurally close to the drawing: identity panel first, readable labels, full-width controls, and no horizontal overflow in the supplied viewport. Desktop remains disproportionately tall because the four required identity controls and optional Gender control stay in one column; the drawing uses paired Record number/Date of birth and Given name/Family name fields, then its separately governed Sex/Gender row. The app therefore pushes `Where they are coming from`, duplicate status and subsequent guidance below the form while leaving unused width inside the left panel.

Use a two-column desktop grid for the four existing required identity fields and span the Gender control plus its truthful explanation across both columns. Do not add the drawing's required Sex control in this presentation batch: `add-patient.tsx` documents that the current `ADD_PATIENT` model has no Sex input, so that needs a model/behaviour decision. Keep the current one-column phone order. The `Already on the board` panel is correctly placed at upper right; the lengthy governance/provenance material can remain below the primary form and duplicate workflow.

## Recommended bounded implementation batches

1. **Patient Now** — `patients/person-screen.tsx` + `patients/person.module.css`. This is the safest independent batch because it shares no stylesheet with the referral screens. Complete the honest identity/action/tab reordering now; record the movement-workspace binding as a separate functional dependency.
2. **Patient search + Add a patient** — `search/patient-search.tsx`, `search/search.module.css`, `patients/add-patient.tsx`, `patients/add-patient.module.css`. These are disjoint page-local modules but can share one reviewer because both corrections are layout/order only. Preserve typeahead, refusal, duplicate and submission behavior.
3. **Referral register + intake** — one serial writer for `referrals/referral-board.tsx`, `referrals/referral-intake.tsx`, and `referrals/referrals.module.css`. The shared stylesheet and shared card/field selectors are a collision hazard. Switch the register to its existing card representation at desktop, then reorder intake's existing person/step/destination/send regions without changing selection, triage, matching or dispatch logic.

For closure, capture each app/drawing pair again at 1440 and 390 after source freeze, plus one lower-page 390 capture or scripted scroll inventory proving destination/send, search filters, referral detail, duplicate results and Add patient submission feedback remain reachable. Human visual acceptance remains pending.
