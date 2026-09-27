# Task 3 Statistics overview and compare implementation — revision 2

Date: 2026-09-13  
Worker: `statistics_inventory` / `gpt-5.6-sol` / medium  
Plan hash: `9ECE16E99228AF0B4053D7C6ED75CF694354EE9BBCBA9D0EC48A20F55573201E`  
App HEAD at dispatch: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`

## Outcome

The overview and compare screens now opt in to `StatisticsSectionFrame`'s `third-edition` path and share a new content-only CSS module. The overview uses two independent desktop columns in the drawing's semantic grouping and a single column below 1000px. Compare remains one full-width ordered stack. Both retain their existing engine derivations, routes, test IDs, disclosures, missing-data language and provenance claims.

The new module contains no legacy `--text-*` references. Shared frame, panel and table presentation stays in the existing opt-in foundation seam; this module does not override frame classes or import legacy content CSS.

## Changed paths and hashes

- `src/components/ward-management/statistics/statistics-overview-screen.tsx` — `B8D487C3EDD930F067418849A76D806CC0C7F08A106D56EC64616A7AD1EE6690`
- `src/components/ward-management/statistics/statistics-compare-screen.tsx` — `8489A91A4A6E5E1E5E057BBA23CBC707EBDB90ED543358E2412B842C779D4F8A`
- `src/components/ward-management/statistics/statistics-third-edition.module.css` — `21B07824FCD8A4978CF3EE8BD3A36622E46D2EF2B6BAB63E2A12BB4B0D60A40B`
- `tests/ward-statistics-compare-two-tables.dom.test.tsx` — `58FDEB029D6A187CEAD188B3B2A38D155590242351B6E583C810D22CF604A775`

The single test edit is a proven-stale source assertion: its threshold guard read `.compareWardTable` and `.compareEdTable` from the legacy stylesheet after the screen moved those selectors to the new owned module. Only the stylesheet path changed; no assertion was weakened.

Input hashes matched the brief before editing: overview `E247F2FAFA86C37FDA3BF457372605FE35FBD83EA504DB5DAC8F949D9B756733`; compare `3D843791170D45A9A06B43E5331C9ADFCA51DA307397A5C56F4858AD3F420CA9`.

## Implemented presentation

- Overview groups scope, capacity and lifecycle in the left desktop column, with declines, referrals/worklist and provenance in the right. Each column flows independently so a tall disclosure does not stretch the opposite column's row.
- Truthful panel counts use values already computed by the screen: open movements, ready beds, admissions, declines, refused/pending work, ward/department/chooser counts and the provenance reading label.
- Capacity is presented as a three-cell band using the current `capacity.ready`, `capacity.empty` and `capacity.allocatable` values. Each value now carries a visible explanation sourced from the screen's existing governed prose, including Ready's per-unit minimum definition. The stage and decline tables retain every existing row and add the drawing's totals rows using existing counts.
- Tables retain their existing horizontal availability, thresholds, sticky identity columns, tabular numeric alignment, unmeasured wording and plain-language sideways-scroll notice. The compare tables locally merge their threshold wrapper into the enclosing panel at wide widths, then restore the strong wrapper boundary at 40rem and below where the fixed table widths can overflow.
- Native disclosures retain 48px targets, focus indicators and reduced-motion handling. The overview now uses the repository's established `usePrintableDisclosures` hook and `source-print` marker to open all three disclosures for print and restore each prior open state afterwards. Chooser links retain full-card 48px targets and visible focus.
- Compare keeps all five ward columns and all three department measures in fixed model order, followed by the chooser and corrected provenance panel.

## Retained app-only behavior and content

The shared synthetic governance banner, coordinator-access limitation, back link, accessible section heading/subtitle and prototype badge remain. All existing detailed attribution explanations, decline-population caveats, nought-versus-absence distinctions, empty states, unresolved-site fallback, owner-decision language, demonstration-chart disclosure, actionability statement, navigation helpers and `choose-a-unit` anchor remain unchanged.

No derivation, fixture, seed, ranking, filter, screen prop, action or route changed. `DemonstrationChart` remains the only renderer of its generated series and uses the foundation-owned marker-scoped typography correction.

## Design departures and reasons

- The drawing's page-local scope filter is omitted because no functioning statistics scope filter exists. Adding one would create an unwired claim; service selection remains shell-owned.
- The drawing's fixed Snapshot and Service scope facts are omitted because the React screen has no owned source for those shell facts.
- The drawing's overview provenance paragraph names fixed service/site/ward/time facts the screen does not render; the app keeps its screen-scoped truthful provenance instead.
- The compare drawing's claim that ward figures are typed while department figures are derived is false for this screen. The app retains the corrected statement that both table populations derive from synthetic current state and only network naming is real.
- The opted-in frame retains app-only governance, access, back-link and heading content above the panels. The controller accepted and owns a compact third-edition frame treatment; the legacy frame path remains unchanged.

## Drawing evidence read

The served HTTP drawing captures were viewed at original resolution before content styling:

- overview desktop `stats-overview-drawing-1440-light.png` — `7F16E1B5641FB559DBE4589209B6D5C790AEDDF0B2CEB4C5CA95EBC7C99D6507`
- overview phone `stats-overview-drawing-390-r4.png` — `06C4557312A7370038EA4AF898A44250B155E646A6F747940A817FF4880BFC53`
- compare desktop `stats-compare-drawing-1440-light.png` — `BAAF292ED322986211F0C45DB143AECF8D534DA5881AEC2D3A59B77C387B731F`
- compare phone `stats-compare-drawing-390-r4.png` — `D5449F610AA3211CEE7951356E017D02FD90FFBDD067CD531A20693C2D40228B`

The earlier same-name 390px captures were rejected because `captureBeyondViewport: true` distorted the drawing into a vertical desktop rail inside a phone raster. Only the corrected `r4` phone captures inform this implementation.

## Verification boundary

Worker source checks after the independent-review correction: changed-path `git diff --check` clean; the certified module contains zero `--text-*` references; all 24 distinct `styles.*` classes used by the two screens are declared in the new module. Prettier wrote the two source files and new module. Source inspection confirms the three overview disclosures carry `source-print`, the hook is mounted once at the screen boundary, and the compare border override is limited to panel-child tables that carry the existing scroll-threshold data attribute.

No tests, application server or browser run was performed by this worker, per the brief. The controller owns the focused four-file test run, all six width/theme app cells, shared panel/table typography evidence, forced-colours/print checks and legacy-consumer isolation sample.

Runtime visual acceptance and human design acceptance remain pending. Computed print expansion and restoration also remain pending controller evidence; the worker verified the source mechanism only. The supplied images prove drawing geometry only; they do not prove the implementation matches it.
