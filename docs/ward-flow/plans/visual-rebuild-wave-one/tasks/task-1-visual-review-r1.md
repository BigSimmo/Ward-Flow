# Task 1 final shared-shell visual review — revision 1

Date: 2026-09-12  
Scope: independent visual review of the shared Ward rail and bar only. The Hub body is excluded from this verdict. Human acceptance remains pending.

## Evidence inspected

All twelve final PNGs under `.superpowers/sdd/2026-09-12-visual-rebuild-wave-one/` were viewed at original detail as six app/drawing pairs:

- 390px light: `hub-final-app-390-light.png` / `hub-final-mockup-390-light.png`
- 390px dark: `hub-final-app-390-dark.png` / `hub-final-mockup-390-dark.png`
- 820px light: `hub-final-app-820-light.png` / `hub-final-mockup-820-light.png`
- 820px dark: `hub-final-app-820-dark.png` / `hub-final-mockup-820-dark.png`
- 1440px light: `hub-final-app-1440-light.png` / `hub-final-mockup-1440-light.png`
- 1440px dark: `hub-final-app-1440-dark.png` / `hub-final-mockup-1440-dark.png`

Controller-supplied interaction evidence also establishes that the narrow global search keeps a real 48px input, expands the same input from 48px to 323px at 820px, and receives focus directly. The More pages sheet focuses its first item and Escape returns focus to its trigger.

## Verdict

No P0–P2 shared-shell visual finding remains in the supplied cells. The rail and bar are ready for human review, subject to the evidence boundary below.

## Concrete observations

- **390px:** The rail becomes a readable wrapped route index, the active Search hub route remains visibly distinct, and the More pages trigger keeps the additional app routes reachable without horizontal clipping. The bar wraps into a title/search row and a controls row; all visible controls remain separated and no control or label is cut off. The reconciliation absence remains visible before the bar. Light and dark preserve the same geometry and readable boundaries.
- **820px:** The responsive rail occupies three route rows plus the reconciliation line, while the bar remains a single controls row. This is taller than the drawing because the app retains more real routes and their labels, but it remains orderly, fully readable and free of visible horizontal overflow. The compact global search leaves enough room for service, Activity, Tasks and Tools, and the supplied focus evidence confirms that expansion uses the same input rather than an overlapping second control.
- **1440px:** The desktop rail and bar retain the drawing's overall proportions. The rail scrolls independently when its full real route set exceeds the viewport; its shift absence, route groups, reconciliation absence, invented-data disclosure and close control remain readable. The bar fits route title, prototype mark, universal search, service selector and secondary actions on one line without overlap in either theme.
- **Theme parity:** Light and dark pairs retain the same layout, grouping and control boundaries. Text, muted copy, selected-route treatment, badges and hairlines remain legible in the supplied images; no theme-specific clipping or collapsed region is visible.
- **Overflow:** Each long result area and the desktop rail exposes its own scrollbar. The page viewport shows no horizontal scrollbar, clipped bar action, or route label escaping its container in any supplied cell.

## Justified deviations from the drawing

- The app retains additional real routes behind `More pages` at narrow widths and uses real route labels rather than reducing the navigation to the drawing's sample set.
- The app uses 48px interactive targets, which makes the wrapped narrow shell slightly taller than the drawing.
- The shift card states that no shift schedule is held instead of inventing the drawing's shift state; the narrow shell omits the card while retaining the truthful reconciliation absence.
- The global search remains available in the bar alongside the directory screen because the two searches have different scopes. At narrow widths it collapses to the real focusable magnifier field and expands in place.
- Hub has no New referral primary action because the current primary-action engine does not resolve one for this route; adding the drawing's control would violate D-16.
- The reconciliation line truthfully reports that reconciliation is unavailable on this page rather than borrowing the drawing's positive state.

## Evidence boundary

This review judges only the supplied static shell captures plus the controller-reported narrow-search and More pages focus behavior. It does not claim Hub-body acceptance, physical-device behavior, forced-colour appearance, print output, or human acceptance. No source, tests, browser session or server was changed or run by this reviewer.
