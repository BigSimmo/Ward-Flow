# Build contract — Ward and ED comparisons

## 1. DOES IT EXIST? — YES. DO NOT REBUILD.

Built and routed, and already substantially ahead of the drawing in places:

- `src/components/ward-management/statistics/statistics-compare-screen.tsx` (560 lines, `StatisticsCompareScreen`)
- Route: `src/app/mockups/ward-flow/statistics/compare/page.tsx:19` → `/mockups/ward-flow/statistics/compare`
- Chrome: `statistics-section-frame.tsx` (`StatisticsSectionFrame`), section metadata
  `statistics-sections.ts:121` (`id: "compare"`), chooser anchor
  `statistics-sections.ts:67` (`STATISTICS_UNIT_CHOOSER_ID = "choose-a-unit"`)
- Tests already exist: `tests/ward-statistics-compare-two-tables.dom.test.tsx` (478 lines — extensive),
  `tests/ui-ward-statistics-compare.spec.ts` (Playwright, not run by either default loop, per its own
  header comment)
- The file's own header comment (`:22-59`) records its history in detail: two tables were added
  2026-09-05, a rounding/precision defect (`.toFixed(1)` vs raw vs "whole days") was fixed at the
  derivation (`ward-statistics.ts`) rather than on this screen, and a since-superseded stub sentence
  claiming "the comparison itself is not built" was left in place after it went false — a live
  example of the exact defect class this brief's §3 warns about ("a claim with an expiry date and
  nothing connects it to the work that expires it").

## 2. THE DRAWING'S SECTIONS, in order (`docs/ward-flow/mockups/statistics-compare-third-edition.html`)

1. `#scope` "What this section will hold" — line 4684
2. "Why this is two tables and not one" — line 4701
3. "Wards" (`#wardsPanel`) — line 4736
4. "Emergency departments" — line 4763
5. "Choose a ward or emergency department" (`#chooserPanel`) — line 4789
6. "What is invented, and what is real" (footer) — line 4811

Header chrome (search, service-scope menu, activity/tasks/tools drawers, New referral) — lines
4640-4680 — is shell-level, mounted once in `src/app/mockups/ward-flow/layout.tsx`, not this
screen's responsibility. Not read in full past the content-panel block; see LIMITS.

## 3 & 4. Per section: data, derivation, and buildability

| #   | Section                              | Drawing citation                             | App citation                                                           | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope                                | 4689-4696                                    | `section.description` rendered `statistics-compare-screen.tsx:100-104` | IN BOTH. `section.description` (`statistics-sections.ts:121-140`) is a close paraphrase, not word-for-word, of the drawing's scope paragraph, but makes the identical claim (one measure set is impossible; a ward has beds, an ED does not).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | Why two tables                       | 4706-4731                                    | `:106-163`                                                             | **APP ONLY, and more than the drawing.** The drawing states the attributability rule and the two worked examples (declines, referrals-received) as one combined note paragraph (4721-4727). The built screen gives each its own `data-testid`'d paragraph (`ward-statistics-compare-attributability-rule`, `-declines-example`, `-double-count-example`) plus the closing owner-decision note (`:156-161`) — the same content, split and labelled rather than compressed. Nothing here is missing; the app is more thorough. Keep as-is; not touched.                                                                                                                                                                                                                                                                                                                                         |
| 3   | Wards table                          | 4736-4760, `WARDS` array 4878+, headers 5538 | `:165-189`, `WARD_COLUMNS` `:336-431`                                  | IN BOTH for shape (same 5 headers: Ward, Average stay, Blocker recorded, Long stays, Discharge dates — drawing `wardHead` line 5538 matches `WARD_COLUMNS` exactly). **APP ONLY on provenance**: the drawing's `WARDS` array is a hand-typed literal (`avgStay: 6.4`, `blockers: 1`, …, one row per ward) — genuinely invented, disconnected from any model. The app instead computes all four figures live via `allWardStatistics(units, admissions, now)` (`:172-176`) → `wardStatistics()` (`ward-statistics.ts:252-296`), reading `arrivedAt`, `leftAt`, `blockReason`, `stayBand`, `expectedDischargeAt`, `dischargeDateMoves` off live `Admission` records. This is a real, reactive derivation, not a literal — a strictly stronger property than the drawing's own mockup has, and it must not be weakened to match the drawing. See §5 for why this matters to the provenance panel. |
| 3b  | "sixth measure" footnote             | 4755-4759                                    | `:178-187`                                                             | IN BOTH, near word-for-word, plus one extra app sentence ("The single-ward pages state it in full.") — APP ONLY, minor, kept.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4   | EDs table                            | 4763-4785, headers 5559                      | `:191-219`, `ED_COLUMNS` `:436-440`                                    | IN BOTH for shape (3 headers: On the list, Marked urgent, No ward yet, matching exactly) and for derivation — both drawing and app compute these live by filtering open movements per department (drawing `moves.filter(...)` 5561-5580; app `movements.filter(...)` `:199`). Genuinely equivalent; no gap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5   | Chooser                              | 4789-4808                                    | `:227-305`                                                             | IN BOTH. Same two rationale sentences (why the chooser lives here; the list is unranked), same two `<ul>` lists linking to `wardStatisticsHref`/`edStatisticsHref`, same "site code resolves to nothing" degrade-gracefully case (`:268-273`, drawing renders the same fallback via `edShort`-equivalent logic further down the script, not separately re-checked — see LIMITS).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | "What is invented, and what is real" | 4811-4838                                    | **absent**                                                             | 🔴 **DRAWING ONLY. Genuine gap — see §5.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Decorative-only drawing elements found and judged NOT a build gap, matching the precedent set by
`contract-statistics-overview.md` §5 for its own screen's decorative `<dl>`: the `<span class="count">`
badges beside each panel heading ("23 wards", "8 departments", "23 wards, 8 departments", and the
"scroll sideways for the rest" runtime overflow text at `measureTables()` line 5506-5514) are
restatements of counts already visible by reading the table/list beneath them. `WardPanel` already
supports a `count` prop (`ward-panel.tsx:19,26,37-41`) so adding it would be cheap, but it is a
type-size-bearing element on the one screen this brief names as 3px from inverting a pinned
measurement, and it is not a data gap — nothing the badge would show is otherwise unavailable on
the page. Left out; noted here rather than silently dropped.

## 5. GAP — the one real difference from the drawing, and why it is not a simple copy

🔴 **The drawing's sixth section, "What is invented, and what is real," is drawn but not built on
this screen** — confirmed by grep: the heading text appears nowhere in `statistics-compare-screen.tsx`.
This is the same gap `contract-statistics-overview.md` found on its own sibling, and
`statistics-community-screen.tsx:283-284` names it directly in its own comment: "the drawing carries
[this section] and this screen has never had it, nor have two of its three siblings." `compare` is
one of those two.

**The template to follow is `statistics-community-screen.tsx:295-360`**, per that file's own
established discipline: the disclosed figure list must be _derived from the same array the table
renders_, never hand-typed, because a typed list goes stale the moment a column changes — which has
already happened once on this exact page (`Empty-bed time` removed 2026-09-05, per this file's
own comment `:368-402`).

🔴 **The drawing's own provenance text is internally inconsistent, and copying it verbatim would put
a false claim on the screen.** Its first paragraph (4818-4822) says **every** figure — all four ward
measures and all three department counts — is invented and describes no real person, bed, or
referral. Its third paragraph (4830-4835) then contradicts that: it says the department counts "are
read from the network's own open movements … so they change with that data" (i.e., real, live) while
"the four ward measures cannot be derived the same way: this prototype keeps no admission history, so
they are invented figures rather than counts of anything on the page."

That third paragraph is true of the **drawing's own mock data** — `WARDS` (line 4878+) is a hand-typed
literal array, so in the drawing the ward figures genuinely are typed-in numbers with no live
derivation behind them. **It is false of the built screen.** As found in §4 row 3 above,
`wardStatistics()` (`ward-statistics.ts:252-296`) computes all four ward figures from live `Admission`
fields by the same kind of derivation the department counts use — not a literal. The extensive
fix-history comments in that same file (`:44-61` precision fix 2026-09-06, `:159-179`,
`:182-220` incoherent-record handling 2026-09-01/07) are the record of that derivation being built out
correctly, after whatever this drawing paragraph was written against.

**Resolution:** the built provenance panel states the first paragraph's claim (which is true of the
running code — every figure describes a synthetic prototype, none is a real person, bed, or referral)
and the "what is real" identity claim (ward, hospital, and department names, read from the network's
own tables, not typed — true and rendered on this exact page, in both tables and the chooser). It does
**not** carry the drawing's third paragraph, because asserting it would state something false about
this screen's own code, which the honesty rule (brief §5) forbids regardless of which document a false
claim originated in. This is recorded here rather than silently dropped, per §3's instruction to report
anything deliberately not carried forward, with its reason.

No other section-level gap found.

## 4 (restated). WHAT CANNOT BE BUILT HONESTLY

Nothing on this screen was found that cannot be built honestly. Every figure this screen renders is
either:

- a live count filtered from `movements`/`admissions` state (department table, ward table), or
- static identity data read from `ward-sites.ts` (ward/site/department names), or
- a fixed prose paragraph making no numeric claim (the "why two tables" panel, the chooser
  rationale, the "sixth measure" note).

There is no trend, average-over-time, or comparative-to-history figure on this screen (unlike the
overview screen's admissions-per-day trend, which required `DemonstrationChart`). Nothing here needed
that treatment.

## 6. Owner decisions binding this screen (`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md`)

- **Ruling E15 (no colour encodes a threshold)** — already satisfied and pinned by
  `tests/ward-statistics-compare-two-tables.dom.test.tsx:143-150` ("encodes no threshold in a colour").
- **Never rank or sort units** — both drawing and app state this explicitly and neither table sorts;
  pinned by the same test file's "keeps the caller's ordering" and "adds no sorting" cases
  (`:156-167`, `:468-477`).
- **The changeable-data rule** (every invented figure carries its own marker) — the new provenance
  panel this contract adds is itself the marker for the four ward measures and three department
  counts; before this change, that marker existed only inline where absence was worded per-cell
  (`cannotBeFormed`, `:332-334`), never as a whole-page disclosure. No conflict; this closes the gap
  rather than creating one.
- No drawing/ruling contradiction found beyond the provenance-paragraph inconsistency already
  covered in §5, which is a drawing self-contradiction, not a ruling conflict.

## Catcher per section (what would go red if rebuilt wrong)

- Two-tables shape, column sets, no blank cells, no colour thresholds, ordering, uniform-column
  detection, right-alignment scoping, rounding, null-vs-zero wording, and the two-column-width pins:
  all already pinned by `tests/ward-statistics-compare-two-tables.dom.test.tsx` (478 lines, 20+ cases)
  — extended, not replaced, by this task; see the new provenance-panel cases added to that file.
- End-to-end reachability and narrow-width pinned-header behaviour: `tests/ui-ward-statistics-compare.spec.ts`
  (Playwright; not run by this agent per the common brief §7, and not selected by either default loop
  per that file's own header comment).
- The new provenance panel: extended cases in `tests/ward-statistics-compare-two-tables.dom.test.tsx`
  that (a) assert the panel renders, (b) read every header out of `WARD_COLUMNS`/`ED_COLUMNS` via the
  rendered table DOM (not a typed list) and require the panel to name each one, and (c) assert the
  panel does not carry the drawing's disproved third paragraph (no claim that any one figure category
  is more "real" than another).

## LIMITS of this reading

- Did not read the drawing's shared shell-chrome script (header search, service menu, activity/tasks/
  tools drawers, roughly lines 1-4680 and 4839-9471) beyond a targeted grep for section headings and
  the two data-build functions (`render()`, `table()`, `uniformNote()`) — judged out of scope on the
  same basis `contract-statistics-overview.md` used for its sibling: shell-level chrome mounted once
  in the layout, not per-screen.
- Did not independently re-verify `wardStatistics()`'s arithmetic against the seed data; took the
  extensive in-file comment history in `ward-statistics.ts` (dated 2026-09-01 through 2026-09-07) as
  a truthful record of what the function does, rather than re-deriving it from `ward-admissions-seed.ts`
  myself.
- Did not run any test before writing this contract, and did not start a server (per the common
  brief's hard constraint on this task). "Already covered" verdicts for the existing 478-line test
  file rely on reading its assertions, not executing them, prior to making my own change.
- Did not check the chooser's exact fallback wording against the drawing's `edShort()`/site-fallback
  script line-by-line; confirmed both branches exist (named site vs. "no site" case) in both drawing
  and app, not that the fallback prose is character-identical.
- Did not check `tests/compare-catalog.test.ts` or `tests/ui-ward-statistics-compare.spec.ts` by
  running them; the former was opened and found to belong to an unrelated "compare" feature
  (differential-diagnosis term comparison, `src/components/compare`), not this screen, and is not
  cited above as covering it.
