# Discharges, Handover, and Out of area visual review r19

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Mode: independent screenshot review

## Evidence inspected

All 36 current app/mock captures were viewed at original detail under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`:

- `discharges-{app,mock}-{390,820,1440}-{light,dark}-r19.png`
- `handover-{app,mock}-{390,820,1440}-{light,dark}-r19.png`
- `out-of-area-{app,mock}-{390,820,1440}-{light,dark}-r19.png`

The working engine remains authoritative. The app's 43 open movements in Handover are legitimate.
Out of area's five existing groups, 18 records identified as far from home, and 217 records the
ledger cannot partition are retained facts rather than drawing mismatches.

## Current verdict

No P1 visual defect is visible in this r19 matrix. All three app screens have coherent canonical
light and dark surfaces, readable disclosure text, clear section boundaries, and visible prototype
warnings. Desktop panel order broadly follows the drawings while retaining the app's larger real
populations and additional governance explanations.

Three current P2 presentation issues remain.

## Actionable findings

### P2 — Discharges destroys unit-name readability on phone

In both `discharges-app-390-light-r19.png` and
`discharges-app-390-dark-r19.png`, the narrow first table column breaks `FSH Adult Secure` into
fragments including single letters (`Adul` / `t`, `Sec` / `ure`). The paired phone drawings
keep breaks between words. The app also clips later columns beyond the right edge without an
in-view horizontal scroll cue. This makes the primary row identifier harder to scan before the user
even reaches the off-screen facts.

Smallest fix: give the Unit column a word-safe minimum width and keep the table in a genuine
horizontal scrollport on phone, with the existing measured overflow affordance or a persistent
native scrollbar. Do not abbreviate unit names, remove columns, or alter the four discharge groups.

### P2 — Handover hides the destination edge without an immediate overflow affordance

In the 820px light/dark app captures, the rightmost Destination cells are cut at the viewport edge.
At 1440px, the Longest waits table is constrained by the side column and again cuts the Destination
header and cell text at the panel edge. The paired drawings fit their shorter sample values, while
the app's longer engine-authoritative department and destination text needs horizontal access.
No scrollbar or overflow hint is visible near the table header in any affected first viewport; a
bottom-only scrollbar would sit below a long 43-movement sheet.

Smallest fix: retain every movement and full destination string, but expose the table's real
horizontal overflow at its top edge or use a synchronized top scrollbar/visible measured hint.
Reducing safe column minima enough to fit is also acceptable if full names remain readable. Do not
replace the 43-movement population with the drawing's smaller sample.

### P2 — Out of area leaves its summary and later groups behind the long first population at tablet

The 820px app captures show the first `In a bed far from home` group as an unbounded page list:
only four of its 18 records fit in the screenshot and there is no internal list scrollbar. The
paired 820px drawings bound the records panel, expose an internal scrollbar, and place `At a
glance` immediately below it. With the app's larger real population, the current tablet anatomy
pushes the five-group summary and subsequent groups several screens below the first heading.
The 390px captures show the same unbounded start, although a first-viewport phone capture alone
cannot prove the eventual below-fold position.

Smallest fix: at the tablet/stacked breakpoint, bound the records panel to a useful viewport-relative
height with native vertical overflow and a stable scrollbar, as the drawing does. Keep all 18
far-from-home records, ledger order, all five groups, the 217 unbanded explanation, selection
behavior, and print expansion. Avoid independently scrolling the whole page and a nearly
full-viewport inner panel on phone unless keyboard and touch reachability are verified.

## Screen notes

- **Discharges:** the warning leads, group order is Blocked → Confirmed → Expected → Discharged
  today, and the outside-four-groups explanation is visible at desktop. Counts differ from the
  drawing because current state is authoritative.
- **Handover:** Taken-at time, Print, filter scope, Longest waits, sign-off, notes, and print
  explanation retain a clear desktop hierarchy. The full 43-of-43 state is presented plainly.
- **Out of area:** the app clearly labels its invented travel-time rule and the unavailable or
  unseparated ledger populations. The 1440px two-column layout keeps At a glance and provenance
  alongside the record list; the tablet flow causes the P2 above.

## Limits

- These are top-of-page viewport captures. They do not prove the complete below-fold row/group
  population, scroll ends, selection states, sign-off mutation, filtering, or print output.
- No app screenshot demonstrates a selected Out-of-area placement.
- Screenshots do not prove keyboard focus, touch scrolling, forced colors, or screen-reader
  semantics.
- No source inspection, tests, browser interaction, server work, or JSON/progress edits were
  performed for this review.
