# Q004 Task 4a — Capacity source handoff

Implemented in the existing local task checkout, 2026-09-13. Source-only handoff, not visual acceptance. No Git, browser, server, provider, tests, deletion, shared or domain operations performed.

## Owned files and preserved inputs

- `src/components/ward-management/capacity/capacity-screen.tsx`
- `src/components/ward-management/capacity/capacity.module.css`
- `src/components/ward-management/capacity/bed-map.tsx`
- `src/components/ward-management/capacity/bed-map.module.css`

All four pre-edit dirty inputs were copied, preserving relative paths, beneath `.superpowers/sdd/2026-09-13-product-refinement/task-4a-before/`. No ownership additions were needed. This report is the only additional task output.

Read README, Q004 Task 4, corrected Task 3 design, task brief, visual rubric, pertinent design-standard accessibility/table/layout rules, and installed Next client-boundary documentation. Applied frontend-design guidance within the drawing's existing type/palette rather than creating new tokens. Viewed all five controller-supplied PNGs: Capacity reference, selected Ward, Discharges, table and live before at 1440/light.

## Changes

- Restrained service header bands and separators frame the existing map. All real beds, square states, preparation patterns and service groups remain. Entire ward clusters are native-button selectable, with keyboard focus and selected styling.
- Compact mismatch metrics retain their original derivations, accessible numeric labels and bed-group definition disclosure. Removed the surface-band/product explanation.
- Top line identifies the latest actual ward-confirmation instant as demo data. It is not a live-feed claim.
- Network starts with compact Ready now and a Beds freeing / Attention tab switcher. Existing shortfalls, preparation warning, freeing horizon exclusion and confirmation highlighting remain. Every statewide ward remains present under highlighting.
- Map selection, table ward button/row click and freeing-ward button open a Ward / Discharges sidebar. Ward facts include capacity, sex mix/designation, specialling, MHA authorisation, missing/ unsettled states and attributed confirmation freshness. Existing coordinator update action has request feedback. Back-to-network restores the previous focus target where still connected.
- Discharges consumes approved `readDischargeRecords`, `openDischargeRecord` and `readDischargeRecord` methods, with the actual declared coordinator role used consistently. Only an explicit record click opens an audit receipt. Detail reads are guarded on every render; the sidebar is keyed by world generation, actor and ward, so stale DTO/handle selection cannot cross a reset or scope change. Record list and detail show only the guarded identity projection; no screen identity join exists.
- Anonymous `bedReleases` render separately from the guarded admission projection. The existing derived `row.freeing` remains the only headline count: the two record lists are never added together. No new discharge write appears on this coordinator screen.
- Table retains all 15 existing fact/action columns, with grouped bands, stronger ward/site hierarchy, aligned numeric cells, compact update buttons and real sorting (ward name, ready count, oldest confirmation). Groups start expanded to match the drawing, retain user folds and honest service totals, and the bounded table shrinks when content is shorter.
- Desktop map/sidebar retain independent panel body scroll with fixed tabs/title/footer. The table has its own scroll body and fixed controls. Narrow view and print release desktop bounds.

## Deliberate deviations

- Retained all real statewide services/wards and current derivations rather than the drawing's fictional counts, missing services or patient identities.
- Added owner-requested compact Network tabs rather than three tall stacked blocks.
- Retained existing 15 operational table columns rather than dropping supported facts to copy the drawing. Horizontal table scrolling remains inside the panel.
- Ward groups now start expanded, as in the drawing. Explicit folds still work. No unsupported bulk update action was invented.
- Sidebar records use actual linked/unlinked/unresolved status; no fabricated mockup people, UMRNs or discharge identities.
- Latest confirmation is the maximum current ward confirmation timestamp, explicitly labelled. It does not imply every ward was confirmed at that time.
- The horizon caveat says releases are outside today, matching the existing helper's actual day-not-equal predicate rather than claiming every excluded release is after today.

## API status and checks

The domain worker's provider APIs are present and consumed directly. No substitute API or type cast was introduced. Confirmation feedback uses the existing refresh request `at` field. Destination labels use the existing `LEAVING_DESTINATIONS` vocabulary.

`node node_modules/prettier/bin/prettier.cjs --write` over the four owned source files completed successfully. TypeScript `transpileModule` syntax inspection reported **0 syntax errors** for both TSX files before the final focus/label refinement; the final source also parsed successfully through Prettier. This is syntax/format evidence, not type or behaviour proof.

Controller-owned checks remain unrun: type validation, focused domain/DOM cases, six viewport/theme comparisons, keyboard/runtime/print checks and visual score. No screen completion claim is made.

## Focused integration cases

1. Map and table ward selection show the matching title/data; enter/space selection, arrow/home/end tabs, Escape and back controls preserve useful focus. Detail back restores its record opener.
2. Sidebar scroll leaves title/tabs/footer visible at 1440; narrow and print flow have no clipped action/data. Table folds shrink its panel rather than leaving a blank lower body.
3. Filters highlight without removing any statewide ward or changing bed totals. Table sort reorders only within the original service groups.
4. Coordinator update appends one request and shows its actual timestamp without changing capacity.
5. Guarded linked, legacy anonymous and unresolved discharge cases render honestly; no identity inferred from anonymous releases. Header totals remain existing derivations with no list-count addition.
6. Detail opening creates one deliberate access request; rendering, tabs, filters and list browsing do not. Reset, scenario change, stale link and selected-ward change cannot display an old guarded detail.
7. Recheck existing capacity count/preparation, confirmation provenance, empty-service and missing-data cases. The intentional default-open groups and shortened operational copy may need precise DOM assertion updates by the controller.

## Bounded review correction — 2026-09-13

Read `task-4a-review.md` and inspected the exact R1/R2 paths. Viewed the controller's actual `capacity-refined-light-1440.png`, which confirms the Beds freeing labels were flush against the panel edge.

Three corrections only, within `capacity-screen.tsx` and `capacity.module.css`:

- R1: print hides only action/navigation text buttons in Ward identity and record detail. Network freeing-ward buttons retain their operational names beside the printed counts.
- R2: Back to network schedules focus restoration in an effect after the Network branch commits. A stable freeing-button ID resolves its remounted node; still-connected map/table openers remain usable, with the focusable Network heading as a safe fallback if the original opener is gone.
- Controller visual finding: the freeing list now has an explicit 0.875rem inline inset, matching its section title/Ready now, with the existing inset focus outline retained.

Both modified files parsed and formatted successfully through the local Prettier command. No tests, browser or server operations were run. Controller print, focus and screenshot rechecks remain outstanding; no other redesign was made.
