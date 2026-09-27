# Task 7 Bed board independent review — revision 1

Source review covers `task-7-brief-r2.md`, `task-7-report-r1.md`, the Task 6–7 inventory, and the current Board TSX/CSS diff. The served 1440px and 390px light drawings were viewed at original detail. The application matrix has not yet been supplied, so visual acceptance remains pending. No test, browser, server, or source edit was performed.

## Actionable source findings

### 1. Important — a filter can hide the selected tile while leaving its detail open

Each filter button changes only `bedFilter`. Selection remains in `selectedKey`, `selectedTile` is still resolved from the unfiltered `tiles`, and the selected `<li>` becomes `hidden` when it does not match. The detail panel therefore continues to describe a bed that is no longer present in the visible board. Escape then tries to return focus to that hidden tile through `tileDomId`, which cannot provide a visible focus target.

When applying a filter that excludes the selected tile, close the detail without scheduling focus return to the hidden tile; focus can remain on the filter button the user just activated. Alternatively, keep the selected tile visibly present and make the shown/count wording account for it. Preserve stable admission-key selection, toggle-off behavior, and the current print restoration of filtered tiles.

### 2. Important — inactive tab panels are still unreachable in print

The final third-edition print block sets `.flowPanel[hidden] { display: block; }`, but the earlier print block sets `.flowColumn { display: none !important; }`. Because every tabpanel is inside `.flowColumn`, revealing the child cannot overcome the hidden ancestor. The rule intended to expose inactive panels on paper is therefore ineffective.

The daily sheet is not a complete substitute for those panels: it receives aggregate incoming/outgoing counts and destinations, but it does not carry every visible row fact such as incoming sex/home region and bed-gone wording, or outgoing reporter/blocker details. This conflicts with the brief's requirement that tab switching preserve every fact, including print access.

Choose one print representation deliberately. If the three flow panels are the retained representation, override the old ancestor hide with a later `.flowColumn { display: flex !important; }`, keep the tablist hidden, and reveal every panel. If the daily sheet is to remain the sole print representation, it must first be proven to carry every retained panel fact and the dead child-reveal rule should be removed. Avoid printing two incomplete or contradictory representations.

### 3. Important — the mandatory “not a medical device” warning is not visible on screen

The Board still renders `Synthetic prototype — not a medical device`, but the third-edition block applies the visually-hidden treatment to `.prototypeBadge`. The shared bar visibly says only “Synthetic prototype”; its longer “Not a medical device and not clinical decision support” wording is in a `title` attribute, which is hover-dependent and is not a visible replacement for the mandatory warning. The rail disclosure says the figures are invented but also omits the medical-device warning.

Keep the complete warning visibly available in the Board content, using a compact treatment that does not recreate a large duplicate page header. The current screen-reader and print exposure should remain. Hiding the duplicate `h1` is separate and remains correct because the local heading preserves the screen's accessible name.

## Correct source behavior retained

- The four filters are derived from existing tile and occupant state. They keep every tile mounted and use an explicit zero-result sentence; print restores filtered `<li>` elements.
- All three orders sort a copy of `tiles`, retain source order as the deterministic tie-break, and preserve the original tile keys/test identities. No bed number or floor-plan meaning is introduced.
- The three tabs implement the roving-tabindex pattern. Arrow Left/Right wrap, Home/End select the endpoints, the newly active tab is focused, each tab controls a mounted labelled tabpanel, and click activation uses the same state.
- Selection remains keyed by the real admission/class key rather than by presentation index. Tile activation toggles selection, Escape is scoped to the board zones, and ordinary close returns focus to the opening tile when it remains visible.
- All five tile states and their warning words remain present. Occupied tiles retain sex, home region, stay band, expected-date state and ED-away wording; pending-preparation, constraint, designation, diagnosis qualification, occupancy reconciliation, action/refusal wording, legend, provenance, print-only people list, and daily sheet remain in source.
- Change ward uses the controller-owned `wardBoardHref` helper, marks the current unit, and lists live units without pretending the shared service selector filters them.

## Drawing evidence and pending limits

- `board-drawing-1440-light.png` shows the intended compact ward strip, navigation/switcher row, nine-cell fact band, work band, filtered bed grid, docked selected record, and flow-tab hierarchy.
- `board-drawing-390-light.png` establishes the in-flow narrow shell and the stacked ward-strip/navigation start. It is a first-viewport capture and does not prove the bed grid, selected record, flow panels, disclosures, or print behavior below the fold.

The app's ten facts, `On leave`, full warnings, richer selected record, explicit unavailable actions, and unsupported locked/open bay absence are expected engine/content departures. No visual verdict will be recorded until the controller supplies the requested application light/dark matrix.

## r4 visual review

All twelve frozen `board-r4` app/drawing images were viewed at original detail, with all twelve geometry sidecars. The 390px and 820px app cells are coherent in both themes: the full not-a-medical-device warning is visible; the ward strip, navigation and ten retained facts stay readable; the 820px work band precedes the bed-grid heading; all 20 beds are accounted for; and the `210 days` tile heading has visible separation between its value and unit. Engine-derived RPH content, the 23-link live ward list, ten facts including `On leave`, and the absence of unsupported locked/open bay assignments and fabricated quiet-shift content are accepted departures from the FSH drawing.

The original three source findings are closed in the current implementation. Excluded selection clears without returning focus to a hidden tile, all three mounted flow panels and filtered tiles have an explicit print restoration path, and the complete warning is visibly present. Controller-supplied runtime evidence additionally covers 20 retained tiles during filtering, focus remaining on the excluding filter, Arrow Right/End/Home across the three tabs, Confirmed `1` / Expected `2` basis, and 23 Change ward links including the actual FSH heading.

### Important — the selected desktop layout collapses the primary board column

Both 1440px app captures show the selected record as a roughly 758px-wide panel beginning near the middle of the content area, while the whole left region below the fact band is blank. `Needs you this shift`, the bed-grid heading, filters and tiles are absent from the initial selected-state desktop view. The paired drawings keep the work band and bed grid in the main column beside a narrow selected-record aside. This is a real app layout failure rather than an engine-content difference: both app geometry records prove a 1440px viewport, 1425px visual width, 236px rail, DPR 1, scale 1 and scroll origin zero.

The final CSS creates a two-column layout at `board.module.css:2968-2975` and assigns the detail to column 2 with the bare `.detail` selector at `:3003-3007`. The older 84rem rule still assigns `.zonesOpen .detail` to column 3 at `:1016-1017`. That higher-specificity selector wins even though it appears earlier. It creates an implicit third track; the selected panel's max-content width consumes the available space and the clipped `.gridColumn` collapses out of view.

Override the selected form in the final layout rule, for example by pairing `.detail, .zonesOpen .detail { grid-column: 2; ... }`, so the selected record occupies the intended 22rem aside and the main grid column remains visible. Verify the corrected 1440px selected state in both themes, including the work band's top alignment with the aside and the full 20-tile board below it. The narrower one-column ordering should remain unchanged.

## Final print-restoration source check

The latest narrow print correction is structurally sound. Tailwind's base-layer `[hidden]:where(:not([hidden=until-found])) { display: none !important; }` cannot be beaten by the earlier unlayered normal `display` rules. The final print block now restores `.flowPanel[hidden]` and `.bedSlot[hidden]` with `display: block !important` / `display: flex !important` inside the same `@layer base`. Within that layer, the scoped class-plus-attribute selectors outrank Tailwind's attribute selector. The existing later `.flowColumn { display: flex !important; }` also restores the ancestor while the tab list remains hidden. This should expose all three mounted flow panels and all filtered bed slots in print without changing screen appearance.

This is source reasoning only. The controller's match-media and computed-style check remains the runtime proof, and actual print/PDF output remains outside this review.

## r4 matrix limits and verdict

Every r4 geometry sidecar records `scrollX: 0`, `scrollY: 0`, DPR 1, scale 1 and no open app dialog. App visual widths are 375px, 805px and 1425px. The 390px first viewport reaches only the ward strip and upper facts; the 820px first viewport reaches the first bed row; neither proves later flow panels, selected detail, disclosures or footer. Static images do not prove keyboard focus, scroll ends, forced colours or print.

Six-cell verdict: changes requested for the selected desktop grid cascade above. No other actionable design mismatch, document overflow or theme-specific defect was found in the r4 matrix.

## r5 narrow closure

The selected desktop grid defect is closed. The affected 390px dark, 820px dark, 1440px dark and 1440px light app captures were viewed at original detail against the unchanged r4 references.

- At 1440px the left grid is again visible at 773px wide, beginning with `Needs you this shift` and the bed-grid heading. All 20 beds remain accounted for, the selected 210-day tile is visible, and the selected record occupies the intended 352px right aside beginning at x1049. The work band and aside align at the top in both themes, with no implicit middle track, clipped main column or new document overflow.
- The 390px and 820px dark captures preserve the established narrow ordering and show no screen-layout regression. Controller computed evidence confirms the selected detail resolves to column 1 with order 2 at both widths; its below-fold position is not visible in these first-viewport captures.
- The final paired selectors now override the legacy selected-state specificity in both directions: `.detail, .zonesOpen .detail` assigns desktop column 2, while the narrow rule resets both forms to column 1 and order 2. The prior cascade cause no longer survives in the final branch.

A separate behavior audit found that the `Nobody due out` filter had counted empty tiles as quiet beds. The current predicate now requires `tile.kind === "occupied"`, a present occupant and `occupant.expectedDays === null`; the supplied count therefore falls from five to the two occupied admissions that actually have no expected date. This correction matches the filter's person-focused label without changing tile layout. Controller-owned tests cover the no-date case along with persistent selection and active-heading visibility.

The print source finding is also closed by runtime evidence supplied by the controller. Under direct print `matchMedia`, all 20 bed slots and all three flow panels compute as visible, the `.flowColumn` ancestor computes flex, and the daily sheet computes block. The base-layer scoped `!important` restoration therefore defeats Tailwind's base-layer hidden rule as intended. Actual PDF rendering remains a separate unverified surface.

Final affected-cell verdict: no further actionable issue. The full-matrix limitations recorded above still apply; this closure does not repeat the unchanged cells or controller-owned focus, scroll-end and print-output journeys.
