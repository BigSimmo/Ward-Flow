# Task 10 handoff

**Source stable for visual review; final acceptance remains controller-owned.**

Changed the seven Statistics screens: `statistics-screen.tsx`, `statistics-overview-screen.tsx`,
`statistics-compare-screen.tsx`, `statistics-service-screen.tsx`, `statistics-ward-screen.tsx`,
`statistics-community-screen.tsx`, and `statistics-ed-screen.tsx`, plus six page-layout modules:
`statistics-landing-third-edition.module.css`, `statistics-third-edition.module.css`,
`statistics-service-third-edition.module.css`, `statistics-ward-third-edition.module.css`,
`statistics-community-third-edition.module.css`, and `statistics-ed-third-edition.module.css`. Pre-edit copies are in
`.superpowers/sdd/2026-09-13-product-refinement/task-10-before/`. No derivation, calculation, fixture,
engine, global-style or test file changed.

- Landing and overview keep current measures and their population/absence disclosures, with repeated product narration
  reduced. Long technical limits for the refused-so-far and ward-attribution absences remain available in collapsed
  method disclosures. The overview now leads with the whole-network scope rather than a future-tense placeholder.
- Service, ward, community and ED pages retain their existing live measures and stated absences. Their subtitles and
  visible notes now describe the operational population directly; service, ward and ED identity headers expose existing
  record counts without new arithmetic.
- Comparison now opens as **Ward and ED comparisons**, explains the separate-table decision concisely, and preserves the
  required-unit attribution rule, referral-list double-count boundary, missing average-wait measure, fixed-order warning,
  denominator notes and unit chooser. One compact method disclosure now precedes the two real tables.
- Desktop remains a bounded dashboard: long panels keep independent body scrolling and stationary panel headers.
  Short identity, absence and provenance panels shrink to their content instead of inheriting
  fixed blank space; long tables and charts keep their page-specific maximum heights and body scrolling. The landing
  panels apply their height limit to the panel while only the content body scrolls. Phone and print keep document flow.

**Visual evidence inspected:** served HTML drawings and actual live 1440 captures for landing, overview, comparison,
service, ward, community and ED in `.superpowers/sdd/2026-09-13-product-refinement/screens/`. The first live batch was
visually dark despite `light` in three filenames, so those files are before-design evidence only and are not claimed as
light-mode acceptance. Preliminary 1440 light captures of all seven pages exposed long visible method copy, panel-level
scrolling and fixed-height blank panels; these were corrected after those captures. Final 1440 light/dark and
representative 390/820 after-state cells are pending controller capture.

**Checks:** installed Prettier accepts every changed file except `statistics-compare-screen.tsx`; its pre-edit snapshot has
the same existing formatting failure. No tests, typecheck, browser automation, server, Git or provider operation ran in
this worker. The child browser surface was unavailable; the controller supplied served-page captures for direct image
inspection.

**Behavior and controller checks:** no intended state or calculation change. Confirm all existing links and disclosures,
comparison table/chooser access, desktop inner scrolling with fixed panel controls, and natural phone/print flow. Retain
the tested distinction between measured nought, suppressed/missing figures and unmeasured populations.

**Blockers:** final after-state visual cells are pending. The served drawings contain datasets and some historical trends
the working record cannot support; those remain stated absences rather than invented operational figures.
