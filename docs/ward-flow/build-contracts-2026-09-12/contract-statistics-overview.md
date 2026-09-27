# Build contract — Statistics: statewide / across-all-services overview

## 1. DOES IT EXIST? — YES. DO NOT REBUILD.

Built and routed:

- `src/components/ward-management/statistics/statistics-overview-screen.tsx` (462 lines) — `StatisticsOverviewScreen`
- Route: `src/app/mockups/ward-flow/statistics/overview/page.tsx` → `/mockups/ward-flow/statistics/overview`
- Chrome: `src/components/ward-management/statistics/statistics-section-frame.tsx` (`StatisticsSectionFrame`) + `statistics-disclaimers.tsx` (`SyntheticFiguresDisclaimer`, `CoordinatorAccessDisclaimer`)
- Section metadata: `src/components/ward-management/statistics/statistics-sections.ts:115` (`id: "overview"`)
- Tests already exist: `tests/ward-statistics-overview-parked.dom.test.tsx`, `tests/ward-statistics-sections.dom.test.tsx`, `tests/ui-ward-statistics-journey.spec.ts`

It covers all five body panels the drawing draws, and the prose is near word-for-word identical to the drawing in most panels (compare `statistics-overview-screen.tsx:127-171` capacity panel to drawing lines 4974-5002; `:255-283` declines "who this count misses" + "precedent" paragraph to drawing lines 5060-5081; `:299-336` worklist panel to drawing lines 5082-5116).

## 2. THE DRAWING'S SECTIONS, in order (`docs/ward-flow/mockups/statistics-overview-third-edition.html`)

1. `#overviewScope` "What this section will hold" — line 4945
2. "Capacity across the network, right now" — line 4974
3. "Where admissions sit in the bed lifecycle" — line 5003
4. "Declines by reason across the network" — line 5038
5. "Referrals waiting on a decision, and beds pending" — line 5082
6. "What is invented, and what is real" (footer, whole-page provenance panel) — line 5117

Header chrome (search, service-scope menu, activity/tasks/tools drawers, New referral / Export) — lines 4824-4941 — is shell-level, not section content: it matches `WardBar`/`WardRail`, mounted once in `src/app/mockups/ward-flow/layout.tsx`, not per-screen. Not this screen's responsibility; out of scope here.

## 3 & 4. Per section: data, derivation, and buildability

| #   | Section                                           | Field / derivation                                                                                                                                                          | Verdict                                                                                                                                                 |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope                                             | `section.description` (`statistics-sections.ts`)                                                                                                                            | Built (`:117-125`). Drawing's `<dl>` "Snapshot" / "Service scope" facts (line 4966-4970) are NOT rendered — minor, decorative, not a data gap (see §6). |
| 2   | Capacity                                          | `unitCapacity(unit, bedReleases).available`, `unit.empty.value`, `unit.allocatable.value`, summed — `networkCapacity()` in the screen file, backed by `ward-derivations.ts` | Built (`:127-171`), genuine counts, real (not invented)                                                                                                 |
| 3   | Bed-lifecycle stages                              | `admissionStagePosition(admission)` (`ward-derivations.ts`/`statistics-derivations.ts`) tallied per admission — `admissionStageTallies()`                                   | Built (`:174-200`), genuine counts, real                                                                                                                |
| 3b  | "Trend" line under stages                         | 🔴 **UNBUILDABLE as a real measurement.** `generateDemonstrationSeries` (`statistics-demonstration.ts`), rendered only via `DemonstrationChart`                             | Correctly built as **labelled invented demonstration data**, never presented as measured (see §4 below)                                                 |
| 4   | Declines by reason                                | `readDeclinesByReason(movements)` → `statistics-decline-reporting.ts` / `statistics-derivations.ts`, tallied over `Movement.declines`, fixed `DECLINE_REASONS` vocabulary   | Built (`:206-283`), genuine counts, real, reported-in-place on a malformed reason (owner ruling 2026-09-07)                                             |
| 5   | Worklist: refused, escalated, preparing, open-now | `refusedAndNothingPending(movements, units, now)`, `bedsPendingPreparation`, `openBedsNow` (`ward-bed-availability.ts`)                                                     | Built (`:299-336`), genuine counts, real                                                                                                                |
| 6   | "What is invented, and what is real" footer       | Would be a derived `figureRows` list, same pattern as `statistics-community-screen.tsx:283-295`                                                                             | 🔴 **NOT BUILT on this screen.** See gap below.                                                                                                         |

Declines-per-ward: explicitly **not attempted**, matching the drawing's own text (drawing 5060-5081 = screen `:275-283`) — the referral-side record can only name a ward on acceptance, not decline, and the ED-movement-side decline list describes a different population. Both text sources agree this is an owner decision, not a build gap.

## 5. GAP — the one real difference from the drawing

🔴 **The drawing's sixth section, "What is invented, and what is real," is drawn but not built on this screen.** `statistics-community-screen.tsx:280-284` records, in its own comment, that this panel is shared by the drawing family but that "this screen [community] has never had it, nor have two of its three siblings" — confirming by the builders' own account that `overview` is one of the un-built siblings. Grep confirms: the heading text exists nowhere in `statistics-overview-screen.tsx`.

Community's version is the template to follow, and it carries its own hard lesson worth repeating here: **its provenance list is derived from the same array the panel renders (`figureRows`), never hand-typed**, and it deliberately claims real-vs-invented **only for what that screen itself renders** — a "what is real" claim about facts the page doesn't show is "a second source about somebody else's screen." The overview screen would need its own `figureRows` (capacity, stage counts, decline counts, refused/escalated/preparing counts, and the demonstration trend — all invented; nothing on this particular screen is real data to disclose as real, unlike community's real catchment-team names).

No other section-level gap found. The scope panel's missing `<dl>` "Snapshot"/"Service scope" facts (drawing line 4966) are decorative restatements of information the shared header chrome (clock, service menu) already carries elsewhere on the page; they are not a distinct data need and not flagged as a build gap.

## 4 (restated). WHAT CANNOT BE BUILT HONESTLY — checked per the brief's binding constraint

The brief's decisive constraint (near-zero discharge history) bears on exactly one candidate on this screen: the admissions-per-day trend under "Where admissions sit in the bed lifecycle." **Actual population available: zero real days of admission history** — the reducer keeps only the current picture, "no record of which day any past admission began survives to the next render" (screen `:110-113`, drawing line 5030-5033, identical wording). This does **not** support a real trend, and the build does not claim one: it is generated as `DemonstrationSeries` via `generateDemonstrationSeries`, structurally unrenderable by anything except `DemonstrationChart` (type is unreachable outside its own module without a cast — `statistics-demonstration-chart.tsx:17-24`), and the screen's own prose states plainly, inline, before the chart: "The trend below is demonstration data, not a measurement" (screen `:216-219`, drawing lines 5030-5036, matching). This is the correct, already-adopted resolution — not something to design around, and nothing here proposes inventing further data.

No other over-time, comparative, "last month," or rate-per-period figure appears anywhere in this drawing's five content panels. Capacity, stage tallies, decline tallies, and the worklist counts are all point-in-time counts of current state, not comparisons across periods, so the history constraint does not touch them.

## 6. Owner decisions binding this screen (`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md`)

- **The changeable-data rule** (line 170): "every invented figure carries its own marker, and nothing may be built that only works for the seed." Satisfied: the one invented figure (the trend) carries an inline sentence-level marker, not just a heading, matching the disclosure-in-the-sentence standard discussed at length around D-8 (lines 545-583) — the marker must attach to the invented thing itself, in the sentence, not only under a section heading. The screen and drawing both do this correctly for the trend.
- **Capacity "Ready" = `min(allocatable, empty)`**, owner ruling 2026-09-04, applied identically here (screen `:436-461` comment) — no drawing/ruling conflict.
- **Beds-pending count = beds the patient has already left, not every bed carrying the flag** — owner ruling 2026-09-07 (screen `:96-104`) — matches drawing's worklist prose exactly.
- **No drawing/ruling contradiction found.** The one un-built section (provenance footer) is an omission, not a contradiction — nothing in the drawing there conflicts with a ruling; it simply has not been built for this sibling screen yet, same as two of its three peers as of the community screen's own comment.

## Catcher per section (what would go red if rebuilt wrong)

- Scope: `tests/ward-statistics-sections.dom.test.tsx` pins the two shared disclaimer sentences whole (not by substring).
- Capacity/stages/declines/worklist: `tests/ward-statistics-overview-parked.dom.test.tsx` — proves every numeral is either recomputed independently from the same reducer state or sits inside the `DemonstrationChart` wrapper (the one sanctioned exception).
- Trend: type-level guard — `DemonstrationSeries` is unreachable outside `statistics-demonstration.ts` without a cast, plus `tests/ward-statistics-demonstration.test.ts` (per that module's own header).
- End-to-end reachability: `tests/ui-ward-statistics-journey.spec.ts`.
- A rebuilt provenance footer would need its own new catcher (none exists yet, because the panel doesn't exist) — the pattern to copy is `statistics-community-screen.tsx`'s own testid (`ward-statistics-community-provenance`) and its derived-list discipline; a hand-typed figure list there would be undetected drift the way `statistics-disclaimers.tsx`'s header describes for the earlier two-copies incident.

## LIMITS of this reading

- Did not read `ward-model.ts`, `ward-admissions.ts`, `ward-referrals.ts`, `ward-sites.ts`, or `ward-catchment.ts` directly — relied on the built screen's own imports and doc comments, which cite `ward-derivations.ts`/`statistics-derivations.ts`/`ward-bed-availability.ts` functions by name; did not independently verify those functions' internals.
- Did not run any test, and did not start a server (per hard constraint) — "already covered" verdicts for tests rely on filenames and the screen file's own comments describing what those tests assert, not on executing them.
- Did not read the full 9,535-line drawing file; read the `<style>`/masthead block and the full content-panel block (lines 4800-5140+) plus a grep pass over the rest for section markers. The remaining ~4,400 lines are script/interaction code for the shared shell chrome (search popovers, activity/tasks/tools drawers) and were not read in full — I judged this out of scope because it is shell-level, not this screen's own five panels, based on `statistics-section-frame.tsx`'s own comment that the frame "adds no controls" beyond the back-link.
- Did not open `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-09.md` in full, only grepped it; the "changeable-data rule" full text lives in a personal memory note (`ward-flow-changeable-data-rule.md`) not present in this repo checkout, so its wording is inferred from the one repo-visible summary line and the related D-8 ruling, not read verbatim.
- Did not verify the "five departed admissions network-wide" / "roughly eighteen wards with zero discharge record" figures myself against live seed data — took them as given by the brief.
