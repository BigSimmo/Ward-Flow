# F01/F02 Movements and Wards visual closure r26

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: independent screenshot review; no source, browser, test, or canonical evidence writes

## Evidence reviewed

All 24 original-detail PNGs under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/` were viewed:

- `movements-{app,mock}-{390,820,1440}-{light,dark}-r26.png`
- `wards-{app,mock}-{390,820,1440}-{light,dark}-r26.png`

These are viewport captures. The phone Movements captures end in **Worth your attention**, and the
phone Wards captures end at the start of **All wards**. They do not establish below-fold diagram,
ranked-list, complete directory, internal-scroll-end, or action-menu rendering.

## Verdict

No current P1 or P2 visual defect is visible in the 24 reviewed cells.

### Movements

- **Primary action closure:** `Record a decision` is visible and contained at 390, 820 and 1440 in
  both themes. At phone it follows the compact tools row without clipping; at tablet and desktop it
  sits in the shared action row with a stable painted size. This closes the r16 missing-action image
  finding.
- The supplied interaction evidence says activating it announces the existing not-wired message.
  That matches the deliberate D-16 implementation in
  `src/components/ward-management/shell/ward-bar.tsx:660`–`668`; this review does not invent a
  decision destination or treat the absence of one as a visual defect.
- The shared palette is coherent in light and dark. KPI labels and values, urgent attention pills,
  diagram strokes, endpoint cards, the coordination well, and the ranked `Carried now` panel remain
  legible. No body-level horizontal overflow is visible.
- The app retains the real 43-open / 19-corridor population and a denser engine-authoritative
  schematic than the drawing's sample. At 820 the diagram continues beyond the captured right edge;
  the paired drawing does the same. At 1440 the app exposes the ranked rail and its own vertical
  scrollbar. These are not treated as clipping defects.
- Controller evidence that WF-315 opens the real record sheet and Escape closes it supplies a
  bounded action/focus journey outside these static images. This report does not extend that result
  to the remaining attention rows or lower ranked-list links.

### All wards

- **Primary action closure:** `New referral` is visible and contained in all six app cells. The
  supplied interaction evidence confirms its existing two real menu destinations, Emergency
  department and Community team. The screenshots show only the closed trigger, so menu geometry is
  not claimed from this matrix.
- **Wide card closure:** the current app renders three columns at 820 and four columns at 1440,
  matching the drawing's responsive density and closing the earlier one-column-sparser finding.
  Long names including `East Metropolitan Youth Unit (EMyU)` fit without collision or truncation.
- At 390 the About panel intentionally precedes the directory and occupies a similar amount of the
  initial viewport in the drawing. Because no ward card is visible in either phone first viewport,
  phone card wrapping and the final service groups remain unreviewed rather than accepted.
- Light and dark surfaces, card borders, service headings, synthetic-prototype warning, body copy,
  active navigation, and shared controls remain readable. The app's 23 real catalogue entries,
  `All wards` route label, absence of bed-state figures, and explicit whole-network scope are
  behavior/content adaptations rather than palette or layout defects.

## Remaining evidence boundary

This r26 matrix closes the two historical header-primary findings and the Wards tablet/desktop card
width finding. It does not close the lower Movements schematic/ranked-list scroll range, the phone
ward-card layout, the final Wards service groups, or either screen's complete keyboard and action
journeys. No source, CSS, test, server, browser, `screen-verification.json`, or `PROGRESS.md` file was
changed or run during this review.
