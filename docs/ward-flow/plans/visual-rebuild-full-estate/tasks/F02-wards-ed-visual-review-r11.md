# F02 Wards and Emergency department visual review r11

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: independent read-only visual and source review

## Evidence inspected

All eight images were viewed at original detail:

- `wards-app-1440-light-r11.png`
- `wards-mock-1440-light-r11.png`
- `wards-app-390-light-r11.png`
- `wards-mock-390-light-r11.png`
- `emergency-department-app-1440-light-r11.png`
- `emergency-department-mock-1440-light-r11.png`
- `emergency-department-app-390-light-r11.png`
- `emergency-department-mock-390-light-r11.png`

Source inspection was limited to the current Wards and ED component/CSS pairs to distinguish presentation defects from unsupported drawing data. The app's current catalog, counts, populations, mutations, and absence explanations remain authoritative.

## Actionable findings

### P1 — ED row clocks and arrival actions are visually missing

In `emergency-department-app-1440-light-r11.png`, both Expects rows retain the space, border, and 48px geometry for `Mark arrived in department`, but the labels do not paint legibly: each action reads as an empty outlined rectangle. The `Waiting since referral` labels and their `3d 3h waiting` / `2h 31m waiting` values are also extremely faint against white. These are operational facts and mutation controls, so this is more than a drawing mismatch.

The TSX still renders the button text, handler, test ids, and clock values. The affected CSS consumes legacy `--text-heading`, `--text-muted`, and `--text` roles while the final full-estate `.screen` rule composes the canonical shell token layer without the explicit local legacy-role bridge used by the corrected Statistics, Alerts, On-call, Officer, Legal forms, and Ward screens.

Smallest fix: add the page-local canonical bridge on the final ED `.screen` (`--text: var(--ink)`, `--text-heading: var(--ink)`, `--text-muted: var(--muted)`, plus the existing border aliases used by these controls), then explicitly confirm the arrival label and both clock terms paint in light and dark. Do not change the handler or the 48px target.

### P2 — ED still presents legacy list panels instead of the drawing's two working instruments

At 1440 the app opens with `Expects` and `Recently answered` as two unrelated cards. The reference gives the operational area a deliberate left `Needs attention` instrument and right `Department lists` instrument with compact list tabs. The app's explanatory prose dominates the left panel, while the right panel is a short empty-state card; the selected department's useful work is not visually grouped by action versus list-reading purpose.

Smallest maintainable fix: create a page-local presentation wrapper that groups existing actionable populations in a left attention column and the existing read-only populations in a right list column. Use the existing population arrays, order, actions, clocks, and empty states unchanged. A tab treatment may switch only between already-rendered list populations, must retain keyboard semantics and print visibility, and must not manufacture the drawing's sample people or combine distinct engine states into a new derivation.

### P2 — ED switcher and selected identity are disconnected and under-informative

The app renders a full-width horizontal department strip, then a separate large two-line identity card. At 390, the strip and identity consume essentially the whole first content viewport before any department work appears. In the reference the identity is attached directly below the switcher and carries the selected department's existing summary readings, so navigation and the state it selected form one instrument.

The current component already has `expects`, `inbox`, `answeredAll`, movements, and the selected department identity. Smallest fix: attach the selected identity to the switcher surface and add compact chips only for counts already computed by this screen. Keep the current department names and service labels. Do not copy the drawing's wait, breach, or worst-first claims unless an existing authoritative derivation supplies them; current source only derives each switcher card's open-movement count.

### P2 — Wards omits the service-selector scope statement

Both app widths show the shared `All services` control directly above a directory that always contains the full 23-ward network. The reference explicitly says the list always shows the whole network and is not scoped to the service chosen above. Current Wards source contains no equivalent sentence. A reader can therefore reasonably interpret a changed shared service selection as filtering this page even though it does not.

Smallest fix: add one sentence to the existing About/provenance content stating that this directory always shows the whole prototype network and is not filtered by the shared service selection. This adds no metric or behavior and makes the existing scope truthful.

### P2 — Wards directory rows retain spreadsheet dividers instead of ward cards

At 1440 the app's directory is a continuous ruled sheet: ward links touch edge-to-edge and service blocks are broad blue-grey bands. The reference uses four discrete, lightly bordered ward cards with visible gutters under plain service headings. At 390 the app similarly becomes a continuous divided list, while the reference keeps each ward as a distinct link card. The app preserves grouping and reading order, but misses the core card affordance that says each ward is a separate destination.

Smallest fix: keep the current service groups, four-column desktop/one-column phone grid, names, kinds, order, hrefs, and 48px minimums; restore a small grid gap and a local border/radius on each `.wardLink`, remove the adjoining `.wardItem` divider rules, and reduce the service heading from a full-width filled band to the reference's section-label treatment. No capacity figures or ranking should be added.

## Accepted content differences

- `All wards` and the derived `23 wards` count are truthful current route content; the drawing's `no figures on this page` label is not required.
- ED department identity and current RPH data differ from the drawing's JHC sample by design.
- The app's Expects, Referrals, answered referrals, movements, patient entry, and capacity states must remain engine-authoritative. This review does not ask for the drawing's sample urgency records, deadlines, contacts, or counts.
- Full real department and ward names may wrap where the drawing's shorter examples do not.

## Evidence limits

This is a light-theme, two-width, first-viewport comparison. The phone captures do not prove below-fold order, scroll ends, focus treatment, keyboard tab behavior, mutations, print, forced colors, or dark theme. No browser interaction or tests were run. No product source was changed.
