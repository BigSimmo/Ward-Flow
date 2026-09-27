# Task 3 independent review — Statistics overview and compare

Date: 2026-09-13  
Review scope: Task 3 r2 brief/report; current overview, compare and content-module diff; the controller-owned third-edition frame seam and marker-scoped panel/table/chart branches.  
Evidence boundary: source review plus the initial 1440px light app/drawing pairs. No tests, server or browser work was run. The 390px, 820px, dark, forced-colours and print cells remain pending.

## Actionable findings

### 1. Important — the opted-in frame retains the obsolete phone-bar reserve

`statistics-sections.module.css:367-370` gives every legacy frame root `padding-top: var(--spacing-ward-phone-bar)` below 40rem. That reserve belonged to the removed fixed phone bar. The new shared third-edition rail reflows in normal document flow below 1000px, but `statistics-section-frame-third-edition.module.css:128-138` does not reset the inherited padding. Both rebuilt Statistics screens will therefore gain an extra legacy phone-bar-height blank band at 390px, on top of the in-flow shared shell.

The same opt-in class should explicitly reset the retired local frame geometry: make the third-edition `.screen` a single content block, reset its padding, and reset `.main`'s inherited `grid-column: 2`. The zero-width implicit first track is visually harmless in the current 1440px capture, but retaining it leaves the new path coupled to a layout it is intended to replace. Keep these resets in the opt-in module so unmarked Statistics routes preserve the legacy frame unchanged.

### 2. Important — closed disclosures are not actually expanded for print

The overview keeps three native `details` disclosures at `statistics-overview-screen.tsx:180`, `:318` and `:405`. The only new print rule is `.revealBody { display: block !important; }` at `statistics-third-edition.module.css:351-353`. In current Chromium, a closed native `details` element also hides its contents through the user-agent `::details-content` visibility mechanism, so forcing the child div to block does not open the disclosure. Neither rebuilt screen nor their frame uses the repository's existing `usePrintableDisclosures` before/after-print pattern.

Use that established hook at the overview screen boundary, or add an equally proven open-and-restore mechanism. Preserve the interactive closed state after printing. The implementation report's claim that the disclosure bodies are print-expanded should remain pending until the controller verifies the computed print state; an actual PDF is separate evidence.

### 3. Moderate — the capacity band drops the drawing's visible explanations

The initial overview capture confirms that `statistics-overview-screen.tsx:171-178` renders only three labels and values in the capacity band. The drawing also places a short explanation under each value, including the essential definition that Ready is the smaller of empty and allocatable for each unit. In the app, that definition exists only inside the closed disclosure at `:180-193`; the paragraph above says that the two feed counts produce three figures but does not state the formula. A reader scanning the panel therefore sees `27 Ready`, `40 empty` and `27 allocatable` without the relationship that makes the first number interpretable.

Keep the full caveat disclosure, but surface the existing short definition with the Ready figure and add equally source-backed captions for Empty and Allocatable. This is a presentation move of already-governed meaning, not a new calculation. The band can use a three-item structure rather than the current two-row `dl` auto-flow if that is needed to keep each label, value and caption together.

### 4. Moderate — compare tables render a second heavy frame inside each panel

The initial compare capture shows a dark rectangular border immediately inside the Wards panel, unlike the drawing's table rows flowing directly from the panel header. `CompareTable` always passes `hasScrollThreshold` at `statistics-compare-screen.tsx:589`; the shared wrapper consequently adds a 2px border at `ward-table.module.css:92-94`, while the enclosing `WardPanel` already supplies the panel edge. The negative inline margin at `statistics-third-edition.module.css:52-55` aligns the wrapper but does not remove the nested frame.

Retain horizontal overflow, the sticky identity column and the plain-language narrow-screen notice. For these two panel-contained tables, suppress or visually merge the standing wrapper border at wide widths and restore a clear scroll boundary where the table can actually overflow. Do not remove the shared affordance globally; this is a local composition issue between the opted-in table and panel.

## Retention review

No source-level loss was found in the screen content or behavior. Overview retains the three capacity derivations, all four lifecycle rows, all seven decline-reason rows including noughts, the declined-population caveat, the referrals/pending worklist, demonstration chart, withheld-figure explanations and page-scoped invented/unknown provenance. Compare retains its separate ward and ED populations, the ward identity plus four supported ward measures, the ED identity plus three measures, null-versus-zero wording, fixed model order, sticky identity columns, chooser links, missing-site fallback and corrected provenance.

The omitted scope filter, snapshot and service facts remain justified: no screen-owned working filter or truthful local source exists, and service selection stays shell-owned. The extra governance banner, access warning and back link account for the app's taller pre-panel frame and are required retained content rather than design drift. Seed count differences between drawing and app are engine-authoritative.

The canonical token roles are otherwise coherent. The two screen roots opt in explicitly, the new content module has no `--text-*` dependency, numeric cells keep the mono role, prose and labels use body/display roles appropriately, and unmarked frame/primitive consumers remain outside every new marker-scoped branch. The panel count's body face is the foundation's recorded deliberate treatment for mixed prose/numeric content.

## Visual evidence inspected

- `stats-overview-app-r1-1440-light.png` against `stats-overview-drawing-1440-light.png`
- `stats-compare-app-r1-1440-light.png` against `stats-compare-drawing-1440-light.png`

These establish the two-column overview grouping, full-width compare ordering, retained content and the two visible misses above. They do not establish responsive, theme, focus, forced-colours or print acceptance.
