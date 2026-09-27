# Task 3 inventory report — revision 1

Task ID / brief revision / actual agent model: Task 3 / r1 / gpt-5.6-sol / medium

Status: inventory complete; implementation remains waiting for foundation and Hub acceptance.

Input plan hash / app HEAD: `79A66BFAAF697433D059726F58F5CA29D8AF52AE3364656ABD707DA4A21BFAB9` / `1ef9ed3975078b789e9b5d70b3f000c64edc3809`

Owned output: this report only. Application source was read, not changed.

## Fresh-source correction to the supplied contracts

Both build contracts are stale on one material point. They say the final provenance panel is absent, but current source at the pinned HEAD renders it in both screens:

- overview: `statistics-overview-screen.tsx:424`, `ward-statistics-overview-invented`;
- compare: `statistics-compare-screen.tsx:334`, `ward-statistics-compare-provenance`.

The source also records why its provenance wording intentionally differs from the drawing. Do not rebuild these panels or copy the drawing's contradictory/stale claims. Reconcile the contract documents later in their own ownership scope.

Drawing hashes inspected: overview `56832909A63C4B79B9F01554D4E16B5873B25ED4A90CB9F785F2508060DED55C`; compare `39F2D5EB347DC49DE1AAA907FEC8DA1E0E3B97B846195D4DBF10F57310D08D85`.

## Statistics overview: three-way inventory

### In both drawing and app

- Six panels in the same semantic order: scope; network capacity; admission lifecycle; declines; referrals/beds worklist; provenance.
- Three current capacity figures, four admission-stage rows, the declines-by-reason table, refused/escalated/preparing/open-now figures, three native disclosures, and a visibly labelled invented 30-day trend.
- Honest language distinguishing measured noughts from unavailable measures, the narrower decline population, lack of a network-exhausted state, and the inability to measure preparation duration.
- Current derivations and vocabulary remain authoritative: `unitCapacity`, `openBedsNow`, `admissionStagePosition`, `readDeclinesByReason`, `refusedAndNothingPending`, and `generateDemonstrationSeries`.

### Drawing only presentation/content

- Two-column desktop grouping, the drawing's panel header count badges, the three-value capacity band treatment, table overflow shade, and the drawing's chart container treatment.
- Scope facts for Snapshot and Service scope, plus the shell-owned `qFilter` insertion below the first panel header. These are live shell/context facts, not seed constants; any implementation needs the existing shell source or a foundation-owned seam.
- The drawing's provenance paragraph names service/site/ward/time/shift facts the React screen does not render. It must stay omitted because it would make the screen claim facts about other surfaces.

### App only; retain

- Shared statistics governance banner, synthetic-prototype badge, coordinator-access limitation, back-to-statistics link, section eyebrow/title/subtitle, and all current test IDs.
- More precise scope and decline-attribution prose, categorical failure reported in place, the capacity disclosure, refusal ceiling/escalation disclosure, `openNow` actionability statement, and all missing-data/nought distinctions.
- The custom `DemonstrationChart` disclosure fields and accessible trend description. It is not `WardFigure` and must remain the sole renderer of `DemonstrationSeries`.
- The current provenance panel's screen-scoped claims and deliberate omission of mockup-only facts.

## Statistics compare: three-way inventory

### In both drawing and app

- Six panels in the same semantic order: scope; why two tables; wards table; emergency-departments table; unit chooser; provenance.
- Five ward columns and three department columns in fixed model order, separate populations, chooser links, unranked-order explanation, uniform-column caveats, and honest sideways access to narrow tables.
- Required attribution rules, the unmeasurable sixth ward measure, open-placement meaning for ED counts, and synthetic-data provenance.

### Drawing only presentation/content

- Panel header count badges (`wards`, `departments`, combined chooser count, and provenance instruction), drawing table surfaces, runtime overflow shade and count-suffix treatment, and the shell-owned `qFilter` below the Wards panel header.
- The drawing's provenance claims that ward measures are typed literals and that only department figures are derived. Those claims describe the drawing's `WARDS` array and are false for the React screen, whose ward columns come from `allWardStatistics`; they must not be copied.

### App only; retain

- Shared frame governance/access/back-link content and all current test IDs.
- Expanded, separately testable attribution, decline and double-count explanations; owner-decision note; empty ward/ED states; unresolved-site fallback; and internal links produced by `wardStatisticsHref`/`edStatisticsHref`.
- `CompareTable`'s derived uniform-column note, first-column sticky identity treatment, right-aligned tabular figures, worded unmeasured cells, `hasScrollThreshold`, and the plain-language narrow-screen scroll notice.
- The corrected provenance panel derives its displayed column names from `WARD_COLUMNS` and `ED_COLUMNS`, states that all underlying records are synthetic, and truthfully says the names come from current network tables.

## Isolated Task 3 content selectors

Create `statistics-third-edition.module.css` only after the foundation/Hub recipe is accepted. Both screens should import this module for their content selectors and pass `design="third-edition"` to the foundation-owned frame. The module must contain no `--text-*` reference and must not import or edit the frame stylesheet.

Selectors required from current `statistics-sections.module.css` usage:

- shared by the pair: `.panelBody`, `.body`, `.note`;
- compare only: `.subHeading`, `.emptyNote`, `.unitList`, `.unitItem`, `.unitLink` plus hover/focus, `.unitName`, `.unitKind`, `.compareWardTable`, `.compareEdTable`, their sticky first-column rules, their scoped numeric-cell rules, `.num`, and `.unmeasured`.

Selectors required by overview from current `statistics-v4.module.css` usage:

- `.kv` with its `dt`/`dd` rules;
- `.reveal`, summary/open/focus/chevron rules, `.revealBody`, and sibling/body spacing;
- `.dtable` with only the header/body/numeric/hover/footer/tone rules actually reached by the two overview tables, plus `.n` as scoped by `.dtable`.

Do not move or alter the shared definitions in either legacy module: `statistics-screen.tsx`, ward, ED, service and community statistics screens still consume `statistics-sections.module.css`; ED and other untouched screens still consume `statistics-v4.module.css`. Copying entire legacy modules would violate the task boundary and preserve old-scale rules inside the certified stylesheet.

`DemonstrationChart` independently consumes `.chartWrap`, `.chartSvg`, `.chartCaption`, and `.prototypeBadge` from `statistics.module.css`. Task 3 does not own that component or module. If the accepted primitive recipe does not reach its old-scale caption/badge typography under the opted-in overview root, return an exact request to the foundation/controller instead of adding an out-of-scope override.

## Nested primitive acceptance the Hub cannot provide

Source inspection found no `WardPanel`, `WardFigure`, `WardTable`, or `data-ward-primitive` consumer under `hub/`, so Hub cannot validate any of these shared primitive branches.

- Panel: overview renders six `WardPanel`s and compare renders six. These are the first Task 3 checks for panel surface and heading typography. Neither current screen passes `count`; adding the drawing's truthful derived counts would also make this pair a real `panelCount` consumer. Otherwise the count branch must be accepted on a different real wave consumer, such as Delays.
- Table: overview renders two `WardTable`s (stage and declines); compare renders two through `CompareTable` (wards and departments). These are real acceptance consumers for wrapper, header/cell typography, sticky identity, scroll threshold and phone overflow behavior.
- Figure: neither screen renders `WardFigure`/`WardFigureStrip`. Overview's `DemonstrationChart` is a separate primitive marker and cannot certify `WardFigure`. The first actual in-wave `WardFigure` consumer found is `community/community-screen.tsx`; foundation acceptance for that branch must use that Task 6 screen rather than a demonstration page.

## App-only retention checklist for implementation

- Keep all derivations, arrays, screen props, routing helpers, anchor `choose-a-unit`, test IDs, disclosures, empty/error states, and provenance sentence structure unchanged unless a visual wrapper requires markup movement.
- Preserve every column at phone widths. Keep a visible and truthful overflow affordance and the sticky identity column; do not hide clinical fields for fit.
- Preserve legacy frame behavior for ward, service, ED and community statistics routes by opting in only these two roots.
- Preserve focus-visible states, minimum tap size on chooser links/disclosures, print behavior, fixed model order, and non-ranking language.
- Do not add calculations, seed data, service filtering semantics, or claims copied from the mockups' fixed sample world.

Checks: no tests, browser jobs, server commands or provider calls run; prohibited by the inventory brief. Plan hash was re-read and matched the issued brief. Source inspection is not visual proof.

Visual evidence: none. The drawings were inspected as source only. Required served comparison cells and human acceptance remain pending.

Open findings / shared-file requests:

- Foundation/controller must decide the existing shell mechanism for the drawing's `qFilter` placement; Task 3 owns no shell file.
- Foundation must cover `DemonstrationChart` typography if its descendant declarations defeat root tokens.
- Build-contract provenance-gap statements should be refreshed outside Task 3 implementation ownership.

Next action and intended recipient: controller accepts this inventory, completes the foundation/Hub pilot, then dispatches Task 3 implementation against the frozen `design="third-edition"` frame and primitive recipe.

Controller correction: model label verified against the original spawn arguments (gpt-5.6-sol, medium, fork_turns none); the earlier generic GPT-6 persona label was inaccurate.
