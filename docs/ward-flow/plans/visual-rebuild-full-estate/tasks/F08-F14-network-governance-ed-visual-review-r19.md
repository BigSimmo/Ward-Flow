# Network, Governance, and Emergency Department visual review r19

Date: 2026-09-13
Scope: read-only inspection of all 36 current r19 originals (app/mock, 1440/820/390, light/dark) for Network, Governance, and Emergency Department. This is source-independent visual evidence only.

## Findings

- **P2 — Network app flow instrument remains materially looser than the drawing at 1440 and 820.** The app's ED nodes are tall rectangular cards with several lines of text and the inpatient unit cards likewise carry full state copy; the drawing uses compact node/swatches and tighter aligned columns. The app diagram therefore consumes substantially more vertical space before the Placement workspace. The independent scroll/overflow instrument is present and usable, so this is density/panel-form drift rather than a broken interaction. The 390 captures show only the pressure/flow lead-in, so the lower instrument is not visually evidenced at phone width.
- **No current P1/P2 found in Governance.** The app's empty override/detail state and absence wording differ from the populated drawing, but this is the required truthful behavior when the current model has no review status/records; treating the drawing's review counters or decisions as data would be misleading. Mobile controls wrap and the six-cell explanatory section continues below the viewport without visible clipping. Light and dark contrast remained legible.
- **No current P1/P2 found in Emergency Department.** At all viewed widths/themes, the department strip, selected-department context, Needs attention panel, and Department lists retain the drawing's panel types and spacing. The r19 captures visibly preserve the tab strip; the separately verified interaction selected 'Still to be moved' and ArrowLeft returned 'Recently answered', so no tab omission is reported. RPH versus JHC selection and the app's context-specific title are runtime data differences, not fabricated-content defects. The 390 app title ellipsizes within the header without viewport overflow.

## Evidence and limits

Viewed originals:

- network-{app,mock}-{1440,820,390}-{light,dark}-r19.png
- governance-{app,mock}-{1440,820,390}-{light,dark}-r19.png
- emergency-department-{app,mock}-{1440,820,390}-{light,dark}-r19.png

Review covers the captured viewport tops only; lower-page content, full journeys, keyboard/focus behavior, print, forced-colors, and physical-device behavior remain unverified. This report does not establish DOD completion.
