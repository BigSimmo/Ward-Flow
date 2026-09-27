# F13 Ward Answer populated visual review r22

Date: 2026-09-13
Scope: visual comparison of all twelve populated Ward Answer r22 captures at 390, 820, and 1440px in light and dark themes. Review covers the header, navigation, answer controls, request panel, populated facts, and eligibility-gate presentation. The known lower landing withheld-notice correction is excluded.

## Evidence reviewed

- `ward-answer-populated-app-390-light-r22.png`, `ward-answer-populated-mock-390-light-r22.png`
- `ward-answer-populated-app-390-dark-r22.png`, `ward-answer-populated-mock-390-dark-r22.png`
- `ward-answer-populated-app-820-light-r22.png`, `ward-answer-populated-mock-820-light-r22.png`
- `ward-answer-populated-app-820-dark-r22.png`, `ward-answer-populated-mock-820-dark-r22.png`
- `ward-answer-populated-app-1440-light-r22.png`, `ward-answer-populated-mock-1440-light-r22.png`
- `ward-answer-populated-app-1440-dark-r22.png`, `ward-answer-populated-mock-1440-dark-r22.png`

## Findings

- **Reference-only limitation — 1440px mock toolbar clips the rightmost action.** In both `ward-answer-populated-mock-1440-light-r22.png` and `ward-answer-populated-mock-1440-dark-r22.png`, the `Confirm beds` control begins at the far right edge and is cut off by the viewport. The app captures do not show this because the real engine action set ends at `New referral`. This is a limitation of the reference capture/action set, not an application P2 or a requested mockup edit.
- **No other current P1/P2 visual defect found.** At 390 and 820px the navigation rows, active Wards state, controls, populated request facts, and gate rows remain contained and readable. The light/dark pairs preserve legible text, borders, status colors, and panel separation. The app/mock differences in counts, request records, actions, and sidebar content are treated as intentional data/behavior differences.

## Limits

PNG inspection does not prove keyboard traversal, focus visibility after interaction, hit-area dimensions, disclosure state changes, print output, or lower-page/journey coverage. No source, browser, test, or verification-record changes were made.
