# F01 Capacity phone overflow correction r28

## Scope

- Owned source: `src/components/ward-management/capacity/capacity.module.css` only.
- No engine, shared primitive, component, test, browser, or server changes.

## Diagnosis

At the 390 px viewport, the Capacity column itself measured 347 px wide while the filters and their
containing panel expanded to roughly 1,592 px. The page clips horizontal overflow, which put the
later filter controls outside the reachable viewport. The shared filter primitive already uses a
wrapping flex layout, and the ward table already owns a local horizontal-scroll minimum width. The
missing contract was therefore on the Capacity route's flex child and filter wrappers: they retained
intrinsic width instead of shrinking to the column track.

## Correction

- Added `width: 100%`, `min-width: 0`, and `max-width: 100%` to direct `.columns` children so a panel
  cannot enlarge the phone column from descendant intrinsic width.
- Added local minimum/maximum width constraints to `.filters`.
- Width-bounded the nested WardFilters primitive and explicitly retained `flex-wrap: wrap`, keeping
  every filter action within the panel while preserving the existing match-highlighting behavior.
- Left WardTable sizing and scrolling unchanged, so wide tabular content remains reachable through
  its existing local scroller.

## Evidence

- Before snapshot:
  `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-capacity-phone-overflow-r28/capacity.module.css`
- Before SHA-256: `4CFA422F1CDCFBC626EF948F6A7B3EA0D0022C3133E2153F65638F022DAE614A`
- After SHA-256: `03EBC9D82BBB861498C9D99E0930493209394B36151F93DD9EC4E8176B729813`
- `npx prettier --write src/components/ward-management/capacity/capacity.module.css` — completed;
  file was already formatted.
- `git diff --check -- src/components/ward-management/capacity/capacity.module.css` — passed with
  no output.
- The snapshot comparison contains only the three scoped width/wrapping additions described above.

Tests and browser verification were not run, per controller ownership. Runtime closure still needs a
390 px measurement confirming that the panel matches the column width, all filter buttons are
reachable, and the table scroll remains local.
