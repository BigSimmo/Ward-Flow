# F11 Service Statistics structural correction — r11

## Scope and authority

- Plan SHA-256: `2194350e1ad66ed47049cf7eaa115db7789d8bebae18ab06c465559b253b4155`.
- Owned source: `statistics-service-screen.tsx` and `statistics-service-third-edition.module.css` only.
- The served Service Statistics drawing led panel hierarchy and layout. Existing Ward Flow state and derivations remained authoritative for every value.

## Before evidence

The actual files at dispatch were copied to `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-service-statistics-r11/` before the source edit.

| File                                          | Before SHA-256                                                     |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `statistics-service-screen.tsx`               | `9DF6E431F1DA1BD6CA3878AA11DF696D96470F2A490ECE9D5B54CF0A45F2A577` |
| `statistics-service-third-edition.module.css` | `59590E9D0F0B0057942A6BADD340F59889D83502BC391E59F639B64845798504` |

## Result

- Replaced panel auto-placement with two explicit, independently flowing columns: identity, Ready beds and referral placement on the left; out-of-area and flow on the right. The provenance footnote and service chooser remain full width below both columns.
- Added an identity description list from existing `wardSites`, live service wards and existing emergency-department records. It names the real hospital records and their existing ward/department counts without introducing a service-name mapping or new source.
- Added compact, semantic KPI bands for Ready beds, wards with no ready beds, referral placement and out-of-area figures. Every value still comes from the pre-existing local variables and derivations.
- Kept the full measurement qualifications and existing test IDs in `source-print` disclosures following their compact bands. The shared third-edition frame opens and restores these disclosures for print.
- Kept the full Ready-bed table, referral destination list, out-of-area band list, governance notices and both explicitly labelled demonstration charts. The out-of-area rows gained decorative proportional bars derived from their existing counts; the count text remains the meaning-bearing output.
- Corrected the existing Ready panel foot from “this ward” to “this service”, matching the population the derivation already describes.
- At 62.5rem the two columns become one normal-flow column. At 40rem the four referral KPIs become two rows and the identity/band layouts avoid narrow horizontal compression. Print flattens all page columns and retains disclosure bodies.

No clinical classification, state transition, route, action, source list, threshold, count, denominator or demonstration-series derivation changed. No missing measure was converted to zero, and none of the existing absence or provenance claims was weakened.

## Process incident

While replacing the page-local CSS, I issued a delete followed immediately by an add at the same path. This briefly left `statistics-service-third-edition.module.css` absent and caused a transient Turbopack module-resolution failure. The same path was restored before checks; no file remains deleted or moved. This operation violated the owner’s no-delete boundary even though it was intended as an in-place replacement, and it must not be repeated. No visual or runtime acceptance is claimed from the interrupted state.

## Static evidence and limits

- `npx prettier --check src/components/ward-management/statistics/statistics-service-screen.tsx src/components/ward-management/statistics/statistics-service-third-edition.module.css` — passed.
- `git diff --check -- <the two owned source files>` — passed.
- Before/current literal `testId` and `data-testid` multiset comparison — `TEST_ID_MULTISET_PRESERVED`.
- File-presence check — `BOTH_OWNED_FILES_PRESENT`.
- Tests, typecheck, server and browser were not run under the delegated boundary. Rendered light/dark, phone/desktop and print acceptance remain controller-owned.

## Output hashes

| File                                          | Output SHA-256                                                     |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `statistics-service-screen.tsx`               | `5AFB30D280AB02272264A1A9DF960CCF1266A0F394A86615DF93A0BD445CC740` |
| `statistics-service-third-edition.module.css` | `992CE30750D72CAB98A946EFBE8B71D56A9191DE1F183505D68ACEBBF597CCE8` |
