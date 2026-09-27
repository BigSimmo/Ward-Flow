# Network, Ward Statistics, and Tasks visual review

Date: 2026-09-13
Scope: all 36 current originals: Network r20 (12), Ward Statistics r20 (12), Tasks r19 (12), app/mock at 1440/820/390 in light/dark. Viewport image review only.

## Findings

- **P1 — Network r20 flow unit rows have text collisions at desktop.** In the app flow map, unit names/capabilities from adjacent compact rows visibly overlap (for example SCGH/Graylands and the Adult/Older Adult labels), and long “being made ready” copy collapses into a narrow vertical strip. This makes the live unit labels and state figures unreadable. The smallest safe CSS correction is to keep the compact row form but give each row a nonzero text track: set the capability/name track to `min-width: 0` and either place the capability on its own full-width line or ellipsize it within its own track; keep the existing bed-state row as a separate full-width horizontal scroller. Do not hide derived labels or change the unit grid's real data.

- **No current P1/P2 found in Ward Statistics.** The r20 Ward app and drawing retain the identity band, KPI/table structure, discharge and clinically-ready panels, and dark/light contrast. The 390 cells show the upper identity/KPI region cleanly; lower tables/charts remain outside the captured viewport.

- **No current P1/P2 found in Tasks.** The app's four derived work items and the drawing's richer notices/work list are legitimate model/data differences. The drawer remains readable at all viewed widths/themes, with controls and row text fitting the panel. The task row navigation close behavior is a separate interaction check and is not claimed by these static images.

## Evidence

Viewed originals:

- `network-{app,mock}-{1440,820,390}-{light,dark}-r20.png`
- `statistics-ward-{app,mock}-{1440,820,390}-{light,dark}-r20.png`
- `tasks-{app,mock}-{1440,820,390}-{light,dark}-r19.png`

All 36 filenames were present and reviewed. This evidence covers captured viewport regions only. Lower-page content, full journeys, focus/keyboard, print, forced-colors, physical-device behavior, and hosted behavior remain unverified. No DOD completion claim is made.
