# F11 Emergency department statistics visual review r27

Date: 2026-09-13  
Reviewer: `/root/hub_inventory`  
Scope: supplied-image review only; no source, browser, server, test, or canonical verification-record changes.

## Evidence inspected

I viewed all 22 supplied PNGs at original detail:

- Paired current first-viewport matrix: `statistics-ed-current-{app,mock}-{390,820,1440}-{light,dark}-r27.png` (12 images).
- Current band and waiting panels: `statistics-ed-bands-app-{390,820,1440}-{light,dark}-r27.png` (6 images).
- Current phone disclosures: `statistics-ed-{about,absences}-app-390-{light,dark}-r27.png` (4 images).

## Verdict

No current P1 or P2 visual defect is evident in the supplied regions.

- The previously reported route-chrome issue is closed at 820 px and 1440 px in both themes: **Emergency department statistics** is fully visible and **Export the figures** remains visible as the primary action. The supplied evidence does not alter its existing D16 announcement-only behavior.
- At 390 px, the route title truncates in the constrained bar in the same general manner as the served reference, while the full Export label and its button remain visible. The header controls wrap without causing page-level horizontal overflow.
- Department tabs are contained in a deliberate horizontal scroller at 390 px and remain fully available across the wider captures. The app's real RPH-specific figures differ from the drawing's sample all-departments state; that content difference is not treated as a design defect.
- The five wait-band rows remain readable at every width. Labels, filled tracks, stated zero/`none` values, table rules, and supporting explanation retain usable contrast in light and dark themes. The 390 px table fits its panel without cell clipping or page overflow.
- The **Waiting now** figure and its 24/48-hour guides remain contained at 390, 820, and 1440 px. The wider layout leaves open space where the engine truthfully provides absence explanations instead of the drawing's invented history; no content is clipped or visually detached.
- The phone **About the figures on this page** and **What else is not measured here** captures are prose-dense by necessity, but headings, emphasis, paragraph spacing, borders, and foreground/background contrast remain legible in both themes. No text escapes the cards.

## Evidence limits

The current paired matrix proves only the captured starting department and viewport region. The supplied images do not independently prove keyboard tab operation, focus treatment, Export announcement behavior, the full lower waiting table, disclosure open/close mechanics, print, forced colours, or scroll ends. The reported RPH-to-Peel data update is controller evidence rather than something the static captures alone can establish.
