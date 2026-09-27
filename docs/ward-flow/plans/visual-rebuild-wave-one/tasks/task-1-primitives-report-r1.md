# Task 1 primitive and statistics-frame helper report — revision 1

Task ID / brief revision / actual agent model: Task 1 bounded primitive helper / r1 / gpt-5.6-sol / medium

Status: implemented; source/static inspection complete; controller-run tests and actual-consumer visual acceptance pending.

Input plan hash / app HEAD: `79A66BFAAF697433D059726F58F5CA29D8AF52AE3364656ABD707DA4A21BFAB9` / `1ef9ed3975078b789e9b5d70b3f000c64edc3809`

## Changed files and SHA-256

- `src/components/ward-management/ward-panel.module.css` — `47EB6B4D6E7711D547E5959120936CCAD0A27AF5B5083A2A837BDAAD5AC845A1`
- `src/components/ward-management/ward-figure.module.css` — `EB3A982FBE0D555C8556470C072B156223FEFD67973A7B352CB5F867E40A4A91`
- `src/components/ward-management/ward-table/ward-table.module.css` — `70AAE6893E139B72B61B973EA2EF6877FEA5951398A29A3E6E1869A2E80E5BB0`
- `src/components/ward-management/statistics/statistics-section-frame.tsx` — `5C814AA12000003E199F5335E904C4B5D8C108661823CDE1C53F748780AB9D73`
- `src/components/ward-management/statistics/statistics-section-frame-third-edition.module.css` — `E996B54B853753876BA3ABA0F8FDB683DE47099EF9485C94D0F32404C5540BDB`
- `src/components/ward-management/statistics/statistics.module.css` — `D35C73204A124FE957BB4F2245ED9ABA990F69DEF387F4EEC5EB179D5E502F6D`
- `docs/ward-flow/build-contracts-2026-09-12/AGENT-BRIEF-COMMON.md` — `269C9D63FF6D58EC2E2DC8E61C16AF37573403B572E9F8971BA9200052E9B418`
- `docs/ward-flow/plans/visual-rebuild-wave-one/tasks/task-1-primitives-brief-r1.md` — `7B783FFB20105838B4CDF60959F8C25FC10926918A71D232B1F94658D1D6AEA1`

This report is the final owned task document and is intentionally not included in its own pre-write hash list.

## Implemented compatibility seam

- `StatisticsSectionFrame` now accepts optional `design?: "third-edition"`.
- Only the explicit value composes the new frame classes and emits `data-ward-design="third-edition"`. Omission keeps the original class expressions and React omits the undefined data attribute.
- The new frame root locally composes canonical `wardShellTokens` from `src/app/ward-flow-shell-tokens.module.css`. It does not import Task 3's future content stylesheet.
- The opted-in frame root now paints canonical `--ground`, completing its half of the marker-scoped ground seam. In print it resets that owned paint to `Canvas` and its root ink to `CanvasText`; the unchanged legacy frame print rule still resets every nested element, so dark-theme surfaces and text remain visible on paper.
- The frame's banner, badge, navigation, eyebrow, title, subtitle and access notice have explicit third-edition classes using `--t-N` and third-edition material roles. The dedicated module contains no `--text-*` reference.
- The component imports the legacy frame module first and the third-edition module second, matching the installed Next.js CSS ordering contract.

## Primitive opt-in branches

- `WardPanel`: the marker-scoped `.panel` branch rebinds legacy aliases on the element that composes `wardTokens`, then applies third-edition surface, edge, lift and radius. Header, title, count and blurb receive exact third-edition nested rules.
- `WardFigure`: `.figureStrip` and `.figure` receive the marker-scoped role rebinding. Labels, numeric/prose values, units, subtext and flagged state use the third-edition scale/material while retaining the existing digit-based numeric modifier and maximum-two-flags component behavior.
- `WardTable`: `.tableScroll` receives same-element role rebinding. Scroll notice, table body, headers, row headers, cells and hover states receive marker-scoped type/material rules. Existing containment, min-width, sticky caller overrides, tabular numeric classes, `hasScrollThreshold`, `data-overflowing`, and print rules remain in place.
- `DemonstrationChart`: after the controller approved a narrow ownership expansion, marker-scoped `.prototypeBadge`, `.chartCaption` and its nested `b` rule override explicit legacy descendant declarations. No chart logic, markup, geometry or other statistics selector changed.

## Legacy consumer isolation

- All original primitive and frame rules remain unchanged and continue to apply when no marked ancestor exists.
- Every new primitive rule begins with `[data-ward-design="third-edition"]`; no existing screen emits the marker until a screen worker explicitly passes the new design prop or otherwise adopts the marker under its own authorised scope.
- Ward, service, ED and community statistics callers omit `design` and therefore retain their existing frame classes and legacy `--text-*` path.
- The marker-scoped `statistics.module.css` correction cannot affect the statistics home or untouched section routes because those roots do not carry the marker.

## App-only retention and deliberate departures

- Kept all frame content and behavior: governance wording, synthetic badge, coordinator-access limitation, back link, section metadata, title fallback, test IDs and children are unchanged.
- Kept all primitive markup contracts: accessible panel regions/headings, prose/numeric figure split, flagged-state semantics, table scroll wrapper/notice, and print reset behavior.
- Kept `panelCount` in the body face with tabular numerals rather than applying the drawing's blanket mono face. The existing slot often carries prose, and the plan explicitly requires numeric and prose treatments not to collapse into sample-digit styling. The 12px third-edition size and muted role still apply.
- Kept the existing threshold border for `hasScrollThreshold`; the new measured-overflow shade is additive on `data-overflowing="true"`. Removing the standing cue before a real caller supplies measured overflow would reduce the existing affordance during the compatibility stage.
- No DemonstrationChart geometry or data disclosure was changed; only the explicit legacy type/color declarations that defeated root migration were corrected.

## Common-brief amendment

The obsolete absolute prohibition on `--t-N` screen use now states the commissioned rule: only a marked rebuilt root that locally composes canonical `wardShellTokens` may use the scale. It records the three §4.4 acceptance conditions and explains why primitive same-element rebinding is required. The unmarked unresolved-variable failure remains documented.

## Checks and evidence

- `git diff --check -- <eight assigned source/brief paths>` — `SCOPED_DIFF_CHECK_CLEAN` for tracked diffs. No application test, browser job, server, typecheck, build, provider or Git write was run; the controller owns execution.
- Static source query — `FRAME_MODULE_NO_LEGACY_TEXT_TOKENS`.
- Independent-review ground correction — inspected the inherited `statistics-sections.module.css` print wildcard before adding the narrower third-edition root reset; no nested print selector or legacy default path changed.
- Installed documentation read: `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, CSS Modules and ordering/merging sections.

Visual evidence: none. This implements the compatibility seam but does not establish that computed values or appearance match on a real route. Panel, figure and table evidence must use actual consumers; Hub renders none of these primitives. The statistics pair can exercise panel/table later, Community is the first in-wave `WardFigure` consumer, and the overview can exercise the marker-scoped DemonstrationChart branch.

Human acceptance: pending.

Open findings / shared-file requests: no further source ownership request. The controller should include a default-frame isolation assertion and a marked-frame marker/class assertion in its focused test selection, then use real consumer computed styles for `--t-0`, panel title/count, figure label/value, table header/body, and DemonstrationChart caption before accepting the foundation.

Next action and intended recipient: controller reviews this scoped diff, runs the focused foundation checks, and supplies the implemented seam to the Hub acceptance pilot. Screen workers should not opt in until that recipe is accepted.

Controller correction: model label verified against the original spawn arguments (gpt-5.6-sol, medium, fork_turns none); the earlier generic GPT-6 persona label was inaccurate.
