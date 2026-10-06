# Design Review: Decisions queue

Reviewed against: DESIGN_BRIEF.md
Philosophy: Apple-like precision, crisp colour, compact nested modules
Date: 6 October 2026

## Screenshots Captured

| Screenshot | Breakpoint | Description |
| --- | --- | --- |
| `screenshots/review-decisions-desktop-1280.png` | Desktop (1280×800) | Full Bunbury page, Decisions tab |
| `screenshots/review-decisions-panel-desktop-1280.png` | Desktop (1280×800) | Queue only |
| `screenshots/review-decisions-tablet-768.png` | Tablet (768×1024) | Full page after the board stacks |
| `screenshots/review-decisions-panel-tablet-768.png` | Tablet (768×1024) | Queue only, one column |
| `screenshots/review-decisions-mobile-375.png` | Mobile (375×812) | Full page |
| `screenshots/review-decisions-panel-mobile-375.png` | Mobile (375×812) | Queue only |
| `screenshots/review-decisions-wide-1440.png` | Wide (1440×900) | Full page |
| `screenshots/review-decisions-panel-wide-1440.png` | Wide (1440×900) | Queue only |
| `screenshots/review-decisions-dark-mode-desktop-1280.png` | Desktop, dark theme | Full page with `data-theme="dark"` |
| `screenshots/review-decisions-panel-dark-mode-desktop-1280.png` | Desktop, dark theme | Queue only |
| `screenshots/review-decisions-hover-accept-desktop-1280.png` | Desktop | Accept button hovered |
| `screenshots/review-decisions-due-now-desktop-1280.png` | Desktop | Due now filter |

> All screenshots are in `.design/decisions-queue/screenshots/`.

## Summary

Colour is back without repainting the cards. Group rails, icons, status chips and slate action buttons carry the signal. Titles stay ink and the panels stay neutral. The biggest remaining gap is control size: actions are 26px and filter segments are 28px, which is the compact size already chosen, and it is under a 44px touch target.

## Must Fix

None. No broken queue, no horizontal page overflow, and no contrast failure on the measured ink, brick Due chip, or slate button.

## Should Fix

1. **Touch targets stay small.** Accept, Sign off, Confirm rollup and Clear are 26px tall. Filter segments are 28px. See [`screenshots/review-decisions-panel-mobile-375.png`](screenshots/review-decisions-panel-mobile-375.png). _Fix: keep the compact look on desktop. On widths under 720px, raise the row and segment hit area to 44px without growing the type._
2. **Due now leaves a short left column.** Hiding Leave opens a gap beside the lower departure rows. See [`screenshots/review-decisions-due-now-desktop-1280.png`](screenshots/review-decisions-due-now-desktop-1280.png). _Fix: leave it. Stretching Intake to fill that gap would put empty space inside a card._

## Could Improve

1. **Long bed labels truncate.** “Orla Oxleyburn (bed not recorded)” ellipsises on a phone. The row does not overflow the screen. _Suggestion: keep the ellipsis. A second line would break the one-line row._
2. **The queue is desktop-first.** Breakpoints use `max-width`. _Suggestion: leave the cascade. The 960px rule now stacks the board, which is what 768px needed._
3. **Body type is 13px, not 16px.** That matches the ward 12px floor and the brief. _Suggestion: do not raise it only on this tab._

## Responsive check

| Viewport | Page overflow | Board | Notes |
| --- | --- | --- | --- |
| 375×812 | 0px | One column | Filters fit. Names ellipsise. |
| 768×1024 | 0px | One column | Summary is 2×2. Rows are readable. |
| 1280×800 | 0px | Two columns | Staffing, Intake and Leave share the left. Departures is on the right. |
| 1440×900 | 0px | Two columns | Same structure, wider cards. |

Sticky ward chrome did not cover the queue. No modal is on this tab.

## What Works Well

- Status colour is small and consistent: green Ready and Done, amber Blocked, brick Due, slate actions. The card fill does not pick up those colours. See [`screenshots/review-decisions-panel-desktop-1280.png`](screenshots/review-decisions-panel-desktop-1280.png).
- Titles, times and names use 13px and 12px only. Weight is 600 for titles and 500 for names.
- Dark theme follows the shell tokens. Actions become the light slate accent, and the rails stay visible. See [`screenshots/review-decisions-panel-dark-mode-desktop-1280.png`](screenshots/review-decisions-panel-dark-mode-desktop-1280.png).
- Hover darkens the slate button. Focus still uses the accent outline. Icons are hidden from assistive technology. The filter buttons keep their names.
