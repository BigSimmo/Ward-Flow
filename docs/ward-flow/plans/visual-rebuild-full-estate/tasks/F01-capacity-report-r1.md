# F01b Capacity implementation report — revision 1

## Scope

- Plan SHA-256: `2194350e1ad66ed47049cf7eaa115db7789d8bebae18ab06c465559b253b4155`.
- Input manifest: `F00-inputs-r1.json`; baseline HEAD `1ef9ed3975078b789e9b5d70b3f000c64edc3809`.
- Source ownership was limited to `capacity-screen.tsx` and `capacity.module.css`.
- No shell, bar, shared primitive, token, derivation, engine, test, drawing, browser, server or Git work was performed.

## Three-way inventory

### Shared by drawing and current application

- Capacity scope and the four bed-kind mismatch rows plus their all-kinds total.
- The whole-network bed map and the full ward-capacity table.
- Ready, held, occupied, locked, freeing, release-stage, sex-mix, specialling, Mental Health Act and freshness facts sourced from the current engine.
- Synthetic-data governance and the boundary that Capacity describes aggregate supply and demand rather than choosing a destination for a person.

### Drawing presentation adopted

- The page opts into `data-ward-design="third-edition"` and the canonical `wardShellTokens` composition.
- The mismatch table remains the single semantic/data source but is laid out visually as the drawing's five-cell band: four bed kinds and the aggregate cell, with words, signed gap, inputs and explanation together.
- The bed map now leads the main content row, with the real operational summary panels grouped beside it.
- The complete Wards panel follows at full width so its fifteen columns receive the available width before horizontal scrolling.
- A three-part footer now carries `Every figure here is invented`, `What is real`, and `Reconciled to Command`, followed by the aggregate-placement boundary.
- The mounted bar owns the visible page title; the local h1 and subtitle remain available to assistive technology.

### Application-only behavior retained and adapted

- `Ready now`, including the locked/open split and pending-preparation qualifier, remains visible in the summary column.
- `Worth your attention` and `Beds freeing today`, including the beyond-today exclusion, remain visible in that same column rather than being deleted to copy the drawing's smaller summary.
- Every ward row and all fifteen existing columns remain. Health-service folds, highlight-only chips, exact match counts and per-ward refresh actions are unchanged.
- Chip selection still highlights and never removes a ward. No service selector, search, bulk request, bed hold or local New referral control was invented.
- Bed map rendering and derivations were not changed.

## Deliberate deviations and limits

- The drawing's page-local Service selector is represented by the shared shell and was outside this lease.
- The drawing's text filter, grouping toggle and bulk request were not substituted for the current approved highlight chips, always-present health-service folds and per-ward refresh actions. Replacing those controls would change behavior rather than presentation.
- The current semantic mismatch table is styled into a band rather than replaced by a duplicate card structure. This preserves its rows, test identifiers and table relationships while avoiding two cosmetic copies of the same engine facts. Its obsolete horizontal-scroll hint and `34rem` floor are removed because the responsive band itself now fits in two columns; the existing test that demands two Capacity scroll hints and the static width registry need a narrow controller-owned contract update to expect only the Wards table's hint and `40rem` floor.
- The existing `64rem` page breakpoint is reused for the map/summary and five-cell mismatch layouts; below it the band uses the drawing's two-column layout. No new shared breakpoint contract was introduced.
- The ward table keeps its established `40rem` minimum and natural no-wrap headers, so all fifteen retained columns remain horizontally reachable without introducing a new width token.
- Exact visual agreement, actual overflow, dark mode, forced colors and printed pagination remain pending controller evidence. No visual acceptance is claimed from source inspection.

## Output fingerprints

- `src/components/ward-management/capacity/capacity-screen.tsx`
  - input: `a3068364dba46357bfb092f2f8001b84ba9df6b79847b23c549e04930287b580`
  - output: `d7462a66079b696e283fe269a39ae04fcf0324e3aed1cbc4bdac889a2bc2fb29`
- `src/components/ward-management/capacity/capacity.module.css`
  - input: `81a9d86d6d273c415eb277603313dcc0986a72c98d391d8d30edd244e9b32a5b`
  - output: `e0f6ab1c4120a2990dcd0b116f543023ead20c458672115196879254f3ff3c62`

## Verification and requested controller checks

- Source-only syntax parse: TypeScript `transpileModule` returned `TSX_PARSE_OK`; PostCSS parse returned `CSS_PARSE_OK`.
- Tests were not run by instruction.
- Minimal named controller set:
  - `tests/ward-capacity-screen.dom.test.tsx`
  - `tests/ward-capacity-bed-map.dom.test.tsx`
  - `tests/ward-capacity-network-fold.dom.test.tsx`
  - `tests/ward-capacity-network-row-de-emphasis.test.ts`
  - `tests/ward-capacity-derivation-agreement.test.ts`
  - `tests/ward-capacity-reconciliation.test.ts`
  - `tests/ward-capacity-zero-spelling.dom.test.tsx`
  - `tests/ward-prototype-disclosure.test.ts`
  - `tests/ward-primitives-shared.test.ts`
  - `tests/ward-table-min-width.test.ts` (update Capacity's exact width multiset from `34rem, 40rem` to `40rem`)
- Served comparison remains required at 390, 820 and 1440 pixels in light and dark, including horizontal ward-table reachability, chip highlighting, service folding, refresh control, below-fold footer, forced colors and print.
