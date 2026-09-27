# Task 6 Community independent visual review — revision 1

Reviewed the current Community source diff, Task 6 brief and source review, and all twelve frozen `community-r3` app/drawing captures at original detail. No test, browser, server, source, or Git write was performed.

## Actionable findings

### 1. Evidence blocker — all three light app captures start at a displaced document offset

The 390px, 820px, and 1440px light app bitmaps each contain a large blank area at the top, followed by content beginning partway through the page. The corresponding dark app cells begin at the true viewport origin and render coherent geometry. This repeated light-only shape is capture evidence failure, not credible evidence of a Community layout defect.

Recapture all three light app cells from `scrollY === 0` using the same exact CSS viewport and clip convention as the verified 1440px dark cell. Record `window.innerWidth`, `visualViewport.width`/`scale`, `devicePixelRatio`, `scrollX`, `scrollY`, the Community root bounds, and the clip rectangle with each capture. Do not record the light half of the six-cell matrix as accepted from the current files.

### 2. Moderate — the retained sixth figure becomes an orphan tile at 820px

Both 820px app cells lay out five figures across the first row and place “Discharged into the catchment” alone at the start of a second row, leaving most of that row empty and making the standing panel substantially taller. The drawing has five figures and therefore cannot expose this case, but the brief correctly requires all six app-derived figures to remain.

The primitive's third-edition `repeat(auto-fit, minmax(9rem, 1fr))` grid explains the result: five 9rem tracks fit the tablet content width and six do not. Add a Community-scoped tablet treatment that gives the six retained figures a deliberate balanced layout, such as three columns by two rows. Preserve all six labels, values, units, sublines, source order, flagged state, and the existing two-column phone and six-column desktop outcomes. Do not remove the sixth figure or compress its factual text to force drawing parity.

## Source and behavior review

- The current JSX retains the unknown-team branch, all six derived figures, all previously available populations and absence states, the referral queue, attention derivations, admitted/expected-back/other-departures/referral/context sections, links, and full provenance.
- The new “In a bed or holding one” `WardTable` uses real admission IDs as row headings and preserves unit, state, stay, and expected-back labels. The existing admitted-before-bed table remains. Both retain scroll-threshold handling; no source-side field loss was found.
- The team switcher still derives every other destination from `COMMUNITY_TEAM_PAGES`. Its native disclosure and the footer disclosure are marked for the existing print expansion hook; no fabricated team limit or copied drawing count was introduced.
- The clean 1440px dark app cell has the intended six-figure band, queue/attention pairing, and full-width in-bed table. Text remains readable, selected/urgent meaning is carried in words, and no visible horizontal page overflow appears.
- The app's six figures versus the drawing's five, 63 other teams versus four, richer referral/attention/table facts, and different live prototype populations are required engine/content differences rather than visual defects.

## Visual matrix and limits

Viewed at original detail:

- 390px app/drawing, light/dark.
- 820px app/drawing, light/dark.
- 1440px app/drawing, light/dark.

The three dark app cells are coherent at their requested widths. The three light app cells were viewed but are not valid acceptance evidence because of the displaced capture origin described above.

The 390px first viewport proves only the shell/header, governance line, standing-panel header, and upper figure band. It does not visually prove the team-switcher contents, referral and attention sections, tables and their horizontal scrolling, later app-only panels, or footer disclosure. The 820px first viewport reaches the referral panel but does not prove all later sections or footer. The 1440px dark viewport reaches the top of the in-bed table; its later rows, subsequent panels, expanded disclosures, keyboard interaction, print/PDF output, and physical-device behavior remain outside this static image review.

## Accepted departures

- The shell uses the real team name and current route labels, while the drawing uses a generic route title and smaller navigation inventory.
- The complete synthetic-prototype warning remains visible and adds height.
- Current engine populations and source-derived team inventory remain authoritative. No drawing patient, count, date, or team list should be copied into the app.
- Existing unavailable-action explanations, referrals, expected-back detail, other departures, context panels, links, and provenance remain full-width and reachable below the primary working region even where the drawing omits them.

## r4 closure

Both r3 findings are closed in the frozen `community-r4` evidence.

- The 390px, 820px, and 1440px light and dark app captures now start at the document origin. Their per-cell geometry records `scrollX: 0`, `scrollY: 0`, `dpr: 1`, `scale: 1`, no open app dialogs, and the expected 375px, 805px, and 1425px visual widths after the browser scrollbar. The twelve app/drawing images were re-viewed at original detail; no blank capture area or displaced Community content remains.
- Both 820px app captures now arrange the six retained figures as a deliberate three-column by two-row band. The phone remains two columns and desktop remains six columns, with every existing label, value, unit, subline, and state retained.
- `community-phone-table-r4.png` visibly confirms the narrow-screen in-bed table remains a real table with row headings and a horizontal scroller plus the explicit sideways-scroll hint. The controller measured `clientWidth: 343` and `scrollWidth: 720`.

The controller also switched the 63-link team disclosure to Albany and observed its measured empty state, then returned to Midland and observed all nine in-bed rows. Two printable disclosures opened for `beforeprint` and both returned to closed after `afterprint`. These are supplied runtime observations rather than checks repeated in this review.

No further actionable Community visual issue is evident in the r4 matrix. The original first-viewport limits still apply: the phone captures do not prove the entire below-fold page, and static images do not prove keyboard interaction, actual print/PDF output, or physical-device behavior.
