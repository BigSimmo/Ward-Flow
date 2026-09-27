# F04/F07 visual review r19

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: independent screenshot review

## Evidence inspected

All 24 current app/mock captures were viewed at original detail under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`:

- `referral-intake-r19` at 390, 820, and 1440 pixels in light and dark themes
- `referrals-r19` at 390, 820, and 1440 pixels in light and dark themes

The review treats the working engine as authoritative. The app's unlinked, unanswered intake state,
six queued referrals, initial unselected detail, and additional `Recently decided` section are not
drawing defects. The mockup's populated referral and selected seven-item triage list are comparison
states, not requested app data.

## Current verdict

No P1 visual defect is visible in the 24 r19 captures. Intake now has coherent light and dark
surfaces, readable controls and states, a bounded destination column, paired desktop fields, and a
single-column phone flow without horizontal clipping. The previous Home Region stretch is not
present. Referral board also has coherent theme contrast and preserves the unselected detail state
and `Recently decided` content without forcing a selection.

## Actionable finding

### P2 — the 820px queue viewport cuts through its last visible row

In both `referrals-app-820-light-r19.png` and
`referrals-app-820-dark-r19.png`, the bounded `Queued (6)` panel ends through the third visible
row: the row's second line sits against or behind the lower panel edge. The same boundary is clean in
the paired 820px mockups, where the queue also exposes a visible internal scrollbar. The r19 app
captures show no persistent scroll cue, so the cutoff reads as clipped content rather than a
deliberately scrollable six-record region.

Smallest fix: give the bounded queue a little more bottom space or scroll padding so a row is never
partially hidden at its resting position, and retain a visible vertical scroll affordance at the
tablet breakpoint. Keep all six records, their current order, the independent queue scroll, the
following `Recently decided` section, and the initial no-selection state.

## Limits

- These are first-viewport screenshots. They do not prove below-fold intake questions,
  destinations, Send behavior, the remaining queued/decided records, or footer disclosures.
- No selected referral state appears in the app matrix, by design, so detail and decision controls
  were not visually assessed here.
- Screenshots do not prove keyboard focus, internal scroll operation, validation, mutation behavior,
  print, forced colors, or screen-reader semantics.
- No source inspection, browser interaction, tests, or JSON/progress edits were performed for this
  review.
