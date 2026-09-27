# Closed rail visual review r20

Date: 2026-09-13
Scope: source-only visual comparison of the twelve supplied closed-rail r20 PNGs. Review limited to header/rail presentation, clipping, spacing, and visible control treatment at 390, 820, and 1440px in light and dark themes. The previously reported lower landing withheld-notice issue is excluded.

## Evidence reviewed

- `closed-rail-app-390-light-r20.png`, `closed-rail-mock-390-light-r20.png`
- `closed-rail-app-390-dark-r20.png`, `closed-rail-mock-390-dark-r20.png`
- `closed-rail-app-820-light-r20.png`, `closed-rail-mock-820-light-r20.png`
- `closed-rail-app-820-dark-r20.png`, `closed-rail-mock-820-dark-r20.png`
- `closed-rail-app-1440-light-r20.png`, `closed-rail-mock-1440-light-r20.png`
- `closed-rail-app-1440-dark-r20.png`, `closed-rail-mock-1440-dark-r20.png`

## Findings

- **No current P1/P2 visual defect found in the reviewed scope.** At 1440px the closed rail remains a compact icon/label column with labels visibly contained. At 820px the responsive header/rail wraps into readable rows without visible clipping; at 390px the compact navigation rows and active Statistics treatment remain within the viewport. Light and dark captures retain readable text, borders, badges, and active-state contrast.
- App and mock captures intentionally differ in record counts, labels, and page content. Those content differences were not treated as rail defects.

## Limits

This is image evidence only. It does not prove keyboard traversal, focus-ring visibility after interaction, pointer target dimensions, nested scrolling, print output, or lower-page/journey coverage. No browser, source, or test changes were made.
