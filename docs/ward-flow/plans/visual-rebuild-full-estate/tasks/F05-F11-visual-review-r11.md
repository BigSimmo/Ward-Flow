# F05/F11 Statistics r11 visual review

Date: 2026-09-13
Reviewer: Codex Luna
Scope: 16 original served app/mock images for Ward, Emergency Department, Community and Service statistics at 1440px and 390px light. Image-only review of visible viewport tops.

## Findings

**P1 — Ward and ED body copy is effectively invisible in the light app.** In `statistics-ward-app-1440-light-r11.png`, the ward identity, Beds now prose and several explanatory lines render near-white on white. The same failure is visible in `statistics-ed-app-1440-light-r11.png` for the identity and “What can be measured” prose. This is a shared StatisticsSectionFrame/text-token regression: restore the canonical readable text token for all body, explanatory and absence copy in the scoped statistics panels, while retaining the light/dark token split. The issue is also visible in the 390 Ward/ED app captures where the first content card is reached.

**P1 — Ward top-level information architecture materially differs from the drawing.** The app starts with a generic “Back to statistics”/coordinator preamble, then places Beds now beside Occupancy over the window. The drawing’s visible top starts with the ward identity/date scope, followed by the Beds now KPI/table and Discharge planning panel. Reorder the existing truthful sections so identity and scope lead, then the Beds KPI/table and Discharge planning; do not invent discharge values or remove the existing absence/provenance statements. This is visible at both 1440 and 390 app widths.

**P1 — ED top-level information architecture materially differs from the drawing.** The app’s visible first content after the preamble is a generic department identity followed by “What can be measured” and a band table. The drawing leads with the department identity/date scope and a KPI strip containing waiting now, longest wait, median, breached and over-24-hours, followed by band/list/chart panels. Preserve current engine-derived values and absence language, but move the existing KPI structure ahead of secondary explanatory panels.

**P2 — Community app loses the drawing’s KPI-first hierarchy in the visible top.** The app shows the Albany identity/explanation card and then begins Caseload; the drawing’s corresponding top visibly pairs team identity with discharge/first-contact metrics and then the caseload/time panels. The app’s long explanatory text is also near-white on white in the 1440 capture, reducing readability. Fix the shared body text token and expose the existing truthful metric panels in the drawing order without fabricating team history or case facts. The 390 app’s identity card is readable but starts later than the drawing because of shared shell/preamble reserves.

**P2 — Service app has the same hierarchy and text risk, at lower severity.** The app begins with service identity and then Ready beds; its body copy in the identity and ready/referral panels is visibly washed out in the 1440 capture. The drawing leads with the service identity/scope and ready-bed KPI/table plus referral/out-of-area panels. Retain the current population and “not a measurement” caveats while applying the shared readable text token and aligning the first visible panel order.

## Limits

Only the supplied 1440/390 light app/mock viewport tops were reviewed. Dark, 820px, lower-page sections, responsive journeys, keyboard/focus, print and forced-colours remain unverified. No source, tests, browser or server files were changed.
