# F05 Discharges lower-page visual review r34

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Scope: read-only review of the current Discharges lower-page captures. This is a bounded visual check, not screen Definition-of-Done evidence.

## Evidence inspected

All files were inspected at original detail:

- `discharges-lower-app-390-light-r34.png`
- `discharges-lower-app-390-dark-r34.png`
- `discharges-lower-app-820-light-r34.png`
- `discharges-lower-app-820-dark-r34.png`
- `discharges-lower-app-1440-light-r34.png`
- `discharges-lower-app-1440-dark-r34.png`
- `discharges-phone-before-scroll-app-390-dark-r34.png`
- `discharges-phone-after-scroll-app-390-dark-r34.png`

Controller-supplied runtime evidence establishes that the phone Expected table moved from `scrollLeft=0` to `scrollLeft=197.6`, its scroll container measured `clientWidth=330` and `scrollWidth=543`, and the document width remained 375. The overflow is therefore local to the table rather than page-wide.

## Verdict

No P1 finding. One P2 readability finding remains.

The six viewport/theme cells retain the complete lower grouping and readable provenance: Blocked 2, Confirmed 2, Expected 4, Discharged today 1, and 0 releases outside the four groups. Counts, descriptions, unit/service/expected information, freshness details, and the explanation of excluded releases remain visible. Light and dark surfaces have clear text and boundary contrast. The phone before/after pair demonstrates a visible native scrollbar and successful access to the right-hand Stage and Freshness columns without expanding the document. The lack of release actions on this board is not a defect; those actions are owned by the Ward forms.

## Actionable finding

### P2 — Stage values split inside words at phone and tablet widths

At 390 px after horizontal scrolling, `Expected` renders as `Expect` / `ed`. At 820 px, the Stage column similarly renders `Confirmed` and `Expected` with mid-word breaks. This makes a short, status-defining field harder to scan and is unnecessary because the tables already provide bounded horizontal scrolling.

Smallest fix: keep Stage cell values on one line (for example, `white-space: nowrap`) and give that column its intrinsic minimum width. Allow the existing table scroller to absorb the small width increase. Do not change the values, grouping, or page-level overflow behavior.

## Limits

This review covers the visible lower-page states in the eight named screenshots. It does not verify keyboard scrolling, focus visibility, screen-reader semantics, print output, physical-device behavior, upper-page content, or end-to-end release workflows.
