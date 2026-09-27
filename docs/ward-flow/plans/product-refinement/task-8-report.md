# Task 8 — operational registers

## Result

- **Delays:** kept the drawing-matched owner, blocker, register and selected-record structure; shortened instructions and the unrepresented ward-wide-delay explanation.
- **Transport officer:** added a compact origin-to-destination line and surfaced the recorded provider alongside escort and form facts. Existing job selection, progress and all four action gates remain unchanged.
- **Handover:** made the existing scope control a compact filter bar with the active scope and included/excluded counts. The header now shows the provider clock as the update date/time; existing high-yield columns, urgent-outside-filter safety list, sign-off and print action remain.
- **Out of area:** retained the ledger-derived groups, combined-unbanded limitation, selection and placement facts while reducing explanatory prose.
- **On-call, Alerts and Legal forms:** added dense live summary strips and clearer page hierarchy. Missing roles/contact details, named alert conditions, legal deadline/no-deadline separation and safety qualifications remain visible or available in their existing disclosures.

No derivation, engine, data, roster, command or clinical-rule source changed.

## Files

- `src/components/ward-management/delays/delays-screen.tsx`
- `src/components/ward-management/officer/officer-screen.tsx`
- `src/components/ward-management/officer/officer.module.css`
- `src/components/ward-management/handover/handover-page.tsx`
- `src/components/ward-management/handover/handover-third-edition.module.css`
- `src/components/ward-management/out-of-area/out-of-area-board.tsx`
- `src/components/ward-management/on-call/on-call-screen.tsx`
- `src/components/ward-management/on-call/on-call.module.css`
- `src/components/ward-management/alerts/alerts-screen.tsx`
- `src/components/ward-management/alerts/alerts.module.css`
- `src/components/ward-management/legal-forms/legal-forms-screen.tsx`
- `src/components/ward-management/legal-forms/legal-forms.module.css`

Dirty inputs were copied before editing to `.superpowers/sdd/2026-09-13-product-refinement/task-8-before/`.

## Visual evidence

The implementer browser surface was unavailable, so the controller captured the served drawing and live route from the verified project server. I inspected these 1440-wide inputs:

- `.superpowers/sdd/2026-09-13-product-refinement/screens/delays-reference-batch-light-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/delays-before-batch-light-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/officer-reference-batch-light-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/officer-before-batch-light-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/handover-reference-batch-light-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/handover-before-batch-light-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/out-of-area-reference-batch-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/out-of-area-initial-batch-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/on-call-reference-batch-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/on-call-initial-batch-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/alerts-reference-batch-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/alerts-initial-batch-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/legal-forms-reference-batch-1440.png`
- `.superpowers/sdd/2026-09-13-product-refinement/screens/legal-forms-initial-batch-1440.png`

The live inputs visibly rendered the dark theme despite some filenames, so they are design inputs only and are not accepted light-theme cells. They showed the revised Out-of-area and Legal Forms hierarchy working at 1440, and exposed unnecessary empty full-height regions on On-call and Alerts; those regions were changed to content-driven desktop height. Final after cells remain controller-owned and must be added only after inspection.

## Deliberate deviations and checks

- Drawing fixture totals were not copied into live screens; every count remains computed from provider data.
- Officer keeps every authorised action and gate rather than reducing the card to one drawing action.
- Out-of-area does not invent near-home/no-arrival breakdowns or catchment teams.
- On-call does not invent names, numbers, pagers or addresses.
- No local tests, typecheck or browser interaction were run by this implementer; the controller owns the single consolidated checks and final visual cells.
