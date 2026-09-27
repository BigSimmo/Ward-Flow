# Skipped-tests census, 2026-09-12

**Method: source reading, not execution.** Per the task brief's own preference, every skip below
was found by reading the spec/test files that make up each population, not by running either
suite. The browser suite (`npm run test:e2e:ward-journeys`) was **not run** — see "What I did not
reach" at the end. The offline ward suite (`node scripts/run-ward-tests.mjs`) was also not run in
full; single-file source reads only.

Author: Sonnet 5, read-only census. This document is the one file this task was permitted to
write.

---

## Population (a): the twelve ward browser specs

**Population, stated exactly:** the twelve Playwright spec files selected by
`npm run test:e2e:ward-journeys` (`node scripts/run-playwright.mjs --project=chromium-mockups
ui-ward-`), i.e. every `tests/ui-ward-*.spec.ts` file:

    ui-ward-chrome-header.spec.ts, ui-ward-coordinator.spec.ts, ui-ward-discharges.spec.ts,
    ui-ward-forced-colors.spec.ts, ui-ward-management.spec.ts, ui-ward-morning.spec.ts,
    ui-ward-referrals.spec.ts, ui-ward-roles.spec.ts, ui-ward-search.spec.ts,
    ui-ward-statistics-compare.spec.ts, ui-ward-statistics-journey.spec.ts,
    ui-ward-table-thresholds.spec.ts

**Count found: 3 skips, matching the reported "88 passed, 3 SKIPPED, 0 failed."** Every
`test.skip`, `test.fixme`, `describe.skip`, `test.slow`, and conditional-skip pattern
(`if (...) test.skip(...)`, `skipIf`, `browserName`/`process.env` guards) was searched for across
all twelve files. Nothing else was found. No `test.only` and no `test.todo` anywhere in this
population either.

### 1. `tests/ui-ward-forced-colors.spec.ts:306`

```
test.skip("@mockup does re-pointing --ward-border do anything under forced colours?", async ({ page }) => {
```

**Stated reason** (file's own head comment, `tests/ui-ward-forced-colors.spec.ts:219-299`): the
test's control assertion — that manipulating `--ward-border` moves the rendered border colour in
ordinary colours before testing whether it moves under forced colours — **failed against the
production build** ("`CONTROL FAILED: re-pointing --ward-border did not move the border even in
ordinary colours`"), most recently re-run and still unresolved on 2026-09-11. The file states
plainly this is "**PARKED, AND SKIPPED DELIBERATELY — THE CONTROL FAILED, SO THERE IS NO
VERDICT**," names four things established by two re-runs, and states a fix ("a `void
el.offsetHeight` reflow") that is explicitly **unverified**.

**Classification: ① deliberately and permanently skipped, reason still true.** The reason is
current (last touched 2026-09-11, one day before this census) and internally consistent: the file
itself states the investigation is still open and nothing has since resolved it. This is not a
finding — it is the correct response to an unresolved measurement.

### 2 & 3. `tests/ui-ward-morning.spec.ts:97-141` and `tests/ui-ward-morning.spec.ts:175-227`

Both wrapped in `test.describe.skip(...)` **and** carry a redundant runtime
`test.skip(true, MORNING_PAGE_SKIP_REASON)` inside the test body (lines 108 and 180) — belt and
braces, not a conditional in the risky sense, since the condition is the literal `true`.

```
MORNING_PAGE_SKIP_REASON =
  "MERGE 02 (owner-approved 2026-09-05) unmounted MorningPage: /mockups/ward-flow/morning now only "
  "redirects to /mockups/ward-flow/capacity, which does not render this page's headline, figure grid "
  "or print layout. morning-page.tsx's own doc comment forbids retargeting this spec at "
  "CapacityScreen or re-mounting MorningPage pending the owner's ruling on spec D9. Component-level "
  "coverage continues in tests/ward-morning-page.dom.test.tsx and tests/ward-morning-print.test.ts."
```

**Stated reason:** `MorningPage` was unmounted by an owner-approved merge on 2026-09-05;
`/mockups/ward-flow/morning` is now only a redirect stub. Retargeting the spec at `CapacityScreen`
is explicitly forbidden pending an open owner ruling (spec D9).

**Classification: ① deliberately and permanently skipped (pending an owner ruling), reason still
true** — the route genuinely still redirects and D9 is still open, as far as this census could
verify by reading the code. **But see Finding 1 below: the reason's own closing sentence is
false.**

---

## Population (b): the offline ward suite

**Population, stated exactly:** every `tests/ward-*.test.ts` / `tests/ward-*.test.tsx` file — the
default file set of `node scripts/run-ward-tests.mjs` when given no arguments (no `package.json`
script wraps this command; it is invoked directly). **423 files exist today** (measured
`ls tests/ward-*.test.ts tests/ward-*.test.tsx | wc -l`), consistent with the reported growth from
387 to 422.

**Count found: exactly 75 skipped tests, matching the reported count precisely — not an estimate.**
Found across **12 files**, all `describe.skip(...)` blocks (no `test.skip`/`it.skip` on individual
cases in this population, no `test.only`, no `test.todo`). Every one of the twelve traces to the
same event: **owner ruling of 2026-09-06, "the eleven replaced ward screens are finished with,"**
recorded in `docs/ward-flow/retired-coverage-record-2026-09-06.md` and
`docs/ward-flow/unreachable-ward-screens-2026-09-06.md` (both confirmed to exist on disk).

| #   | File : line                                        | `describe.skip` title                                               | Cases                    | Declared reason (from `tests/ward-component-reachability.test.ts`'s own `DECLARED_UNREACHABLE` list) |
| --- | -------------------------------------------------- | ------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | `tests/ward-community-figures.dom.test.tsx:54`     | `"CommunityFigures"`                                                | 4                        | "transitively dead — reached only from community-home"                                               |
| 2   | `tests/ward-community-scope.dom.test.tsx:63`       | `"CommunityHome — the coordinator's scope switch"`                  | 5                        | "/community renders CommunityIndex instead"                                                          |
| 3   | `tests/ward-community-team-hub.dom.test.tsx:136`   | `"CommunityTeamHub — the community role's own, restricted landing"` | 4                        | "/community/[teamId] renders CommunityScreen instead"                                                |
| 4   | `tests/ward-community-teams-table.dom.test.tsx:89` | `"CommunityTeamsTable"`                                             | 5                        | "transitively dead — reached only from community-home"                                               |
| 5   | `tests/ward-device-claim-reason.dom.test.tsx:183`  | `"a retired board's stated reason for not being a medical device"`  | **3** (not 8 — see note) | "/escalation redirects to /delays" (`EscalationBoardPage` only)                                      |
| 6   | `tests/ward-ed-home.dom.test.tsx:59`               | `"EdHome"`                                                          | 12                       | "/ed/[edId] renders EdScreen instead"                                                                |
| 7   | `tests/ward-ed-service-bands.dom.test.tsx:52`      | `"EdServiceBands"`                                                  | 5                        | "reached only from ed-home"                                                                          |
| 8   | `tests/ward-escalation.dom.test.tsx:79`            | `"EscalationBoardPage"`                                             | 6                        | "/escalation redirects to /delays"                                                                   |
| 9   | `tests/ward-morning-page.dom.test.tsx:112`         | `"MorningPage"`                                                     | 20                       | "MERGE 02 — /morning redirects to /capacity"                                                         |
| 10  | `tests/ward-morning-tour-paused.dom.test.tsx:61`   | `"the guided tour is paused"`                                       | 2                        | same MERGE 02 declaration (mounts `MorningPage` directly)                                            |
| 11  | `tests/ward-morning-tour.dom.test.tsx:160`         | `"MorningTour"`                                                     | 7                        | "MERGE 02 — reached only from morning-page"                                                          |
| 12  | `tests/ward-tracker-leg-badge.dom.test.tsx:82`     | `"live tracker leg badges"`                                         | 2                        | "/transport redirects to /movements" (`live-tracker.tsx`)                                            |

**4+5+4+5+3+12+5+6+20+2+7+2 = 75.** Exact.

**Note on row 5:** `ward-device-claim-reason.dom.test.tsx` is the one file in this population that
is **not** a whole-file skip. It carries two `describe` blocks: a live, unskipped
`describe("a live board's stated reason...")` (5 cases, exercises `ReferralBoard`, which is not
retired) and the `describe.skip` at line 183 (3 cases, exercises `EscalationBoardPage`, which is
retired). The file's own header explains this was a deliberate correction made on 2026-09-07,
after an earlier whole-file skip had silently switched off medical-device-claim coverage for the
**live** referral board along with the retired escalation board — see Finding 2 below, which is
this file's own account of exactly the defect class this census was asked to hunt for.

**Every one of the 12 skips above is guarded by `tests/ward-component-reachability.test.ts`**,
which is itself **not skipped** (confirmed: no `.skip` anywhere in that file) and actively asserts
that no declared-unreachable module has become reachable, and that no declaration is stale. Its own
`DECLARED_UNREACHABLE` list carries exactly these modules (`morning-page.tsx`, `morning-tour.tsx`,
`escalation-board.tsx`, `live-tracker.tsx`, `community-home.tsx`, `community-team-hub.tsx`,
`community-figures.tsx`, `community-teams-table.tsx`, `ed-home.tsx`, `ed-service-bands.tsx`), and
the file's own comments show it has actually gone red and been corrected before (the
`statistics-primitives.tsx` entry, deleted when that component came back into use).

**Classification for all 12: ① deliberately skipped, with a stated reason that this census's
reading found still true, and actively monitored by a live guard.** This is the best-supported
kind of skip in this census — not merely asserted, but structurally checked.

---

## The one conditional skip found anywhere in either population

`tests/ward-travel-bands.test.ts:243`:

```ts
it.skipIf(!TRAVEL_BANDS_ARE_INVENTED)(COMPLETENESS_GUARD_TITLE, () => { ... });
```

**This is not currently skipped and is not part of either count above.**
`TRAVEL_BANDS_ARE_INVENTED = true` today (confirmed at
`src/components/ward-management/ward-travel-bands.ts:49`), so `!true = false` and the test runs.

**Why it is named anyway:** this is exactly the shape the task brief calls dangerous — a
conditional skip whose condition could quietly become permanent. It is flagged here because it is
built in a way that defuses that exact danger, and is worth the owner seeing as a model: the
test's own **title** is computed from the same flag (`COMPLETENESS_GUARD_TITLE`, lines 79-81), so
the day `TRAVEL_BANDS_ARE_INVENTED` flips to `false`, the reporter will show a **renamed** test
reading `"SKIPPED — no completeness guard: TRAVEL_BANDS_ARE_INVENTED is false, so the bands are no
longer marked invented"` rather than the same name silently going quiet. Not a finding — the one
place in 423 files where the ④ failure mode is structurally prevented rather than merely risked.

**Classification: N/A (not currently skipped).** Recorded for completeness per the brief's
instruction to name every conditional skip found, regardless of its current branch.

---

## 🔴 Findings — ③ and ④, and one thing worse than either

Neither population contains a classic ③ (skipped for a reason nobody recorded) or ④ (a
conditional skip whose condition silently became permanent) by the letter of those definitions —
every skip found has a recorded, current-as-far-as-verified reason. **But three cross-references
inside these very files claim redundant coverage exists elsewhere, and two of the three are false.**
This is not a skip that lacks a reason; it is a skip whose reason **overstates what survives it**,
which is arguably worse, because it reads as reassurance rather than as a gap.

### Finding 1 — `tests/ui-ward-morning.spec.ts`'s stated redundancy is half wrong

`MORNING_PAGE_SKIP_REASON` (quoted in full above, `tests/ui-ward-morning.spec.ts:71-76`) ends:
**"Component-level coverage continues in `tests/ward-morning-page.dom.test.tsx` and
`tests/ward-morning-print.test.ts`."**

- `tests/ward-morning-print.test.ts` — confirmed active, no skip anywhere in the file (checked
  every `describe`/`it` in it). This half is true.
- `tests/ward-morning-page.dom.test.tsx` — **also `describe.skip`** (row 9 in the table above, all
  20 cases). This half is **false**. `MorningPage`'s headline, its figure grid, its governance
  banner, and everything else that is not print output currently has **zero executing coverage
  anywhere in the repository** — not in the browser, not at the component level.

The most likely explanation, from the dates involved: the browser spec's comment
(`tests/ui-ward-morning.spec.ts`, dated 2026-09-06 in its own header) and the dom test's skip
(`tests/ward-morning-page.dom.test.tsx`, same 2026-09-06 retirement event) were almost certainly
written on the same day, by the same ruling — but the cross-reference was never checked against
its own target after the target was itself retired.

### Finding 2 — `tests/ward-morning-tour-paused.dom.test.tsx` makes the identical mistake

Lines 40-42: **"`tests/ward-morning-tour.dom.test.tsx` still exercises the tour itself by mounting
it directly, so the feature stays covered while it is switched off."**

`tests/ward-morning-tour.dom.test.tsx` is row 11 above — **also `describe.skip`** (all 7 cases).
The claimed redundancy does not exist; nothing currently exercises `MorningTour`'s behaviour.

### Finding 3 — `tests/ward-morning-tour.dom.test.tsx`'s own internal argument is now contradicted by its own wrapper

The file's own comment (lines 130-134), written when the tour was merely "paused" and
`MorningPage` was still reachable: **"Skipping this file would have been the easy alternative and
the wrong one: a skipped test is a check that cannot fail, so the tour would rot silently... The
complement to this file is `tests/ward-morning-tour-paused.dom.test.tsx`... Together they say: the
tour works, and it is switched off."** The file is now wrapped in `describe.skip` at line 160 — the
exact outcome this comment argued against — with no note reconciling the two. Both comments are
still in the file, disagreeing with each other, and a reader hitting the inner one first would
believe this suite is live.

**Net effect of all three:** the Morning-family retirement is honestly recorded at the outermost
layer (the 2026-09-06 ruling, the reachability guard, the retired-coverage-record doc all agree and
are current) but the **inner reassurances that something else still covers the gap have not been
updated to match**, and two of them are now actively wrong. This is squarely the brief's target —
not a skip lacking a reason, but a skip whose stated safety net is no longer there.

### Minor note, not a finding: a stale "fixme" reference with no code behind it

`tests/ui-ward-coordinator.spec.ts:119-122` — a comment says **"these stay fixme so the gap is
visible in the runner"** — but no `test.fixme(` or `describe.fixme(` call exists anywhere in this
file or any of the twelve browser specs (checked explicitly). Either the fixme was already
resolved and the comment never cleaned up, or it was never implemented as described. Either way it
does not affect the 3-skip count for population (a), since nothing actually skips because of it —
named here only because the brief asked for every reference to a skip mechanism, live or stale.

---

## ② — tests that could simply run now

**None found.** Every skip in both populations traces to a condition this census's reading found
still true (a route still redirects, a component is still unreached, an investigation is still
open). No skip's stated blocking condition appears to have already passed.

---

## What I did not reach

- **The browser suite was not executed.** `npm run test:e2e:ward-journeys` takes a machine-wide
  lock per the brief's warning, and this census was built entirely from a source reading, which the
  brief said to prefer. I did not clear running it with you, and did not run it. Everything about
  population (a) — including the exact "88 passed" figure — is taken from the task brief's own
  statement of the prior run's result, cross-checked only by literal skip-call counting (which
  landed on exactly 3, matching). I did not independently re-derive the "88" or verify 0 failures.
- **I did not run any part of the offline ward suite either**, including the single guard file
  `tests/ward-component-reachability.test.ts` — I read it, but did not execute it to confirm it is
  currently green. Its own comments describe at least one occasion where it correctly went red, so
  it is not a guard that has never fired; I did not re-verify it fires correctly today.
- **I did not audit test bodies for early-return-style silent skips** (e.g., an `if (condition)
return;` at the top of an `it()` body that would make a test pass vacuously without vitest ever
  reporting it as "skipped"). I did a light grep for this pattern across the whole offline
  population and found only loop-internal early-returns inside AST-walking/search helper
  functions, not whole-test-body guards — but I did not read every one of the roughly 30 hits in
  full, and this is a materially different defect class from what the brief asked me to classify
  (it wouldn't move the "75 skipped" count at all, since vitest wouldn't call it a skip).
  If you want that population also enumerated, it needs a separate pass.
  ⚠️ **Not run against you — reported as unreached, per the brief.**
- **I did not verify the 88/91 arithmetic for population (a) against an independent test-case
  count.** Counting literal `test(` declarations across the twelve files gives an ambiguous total
  (87-89 depending on how the two in-body `test.skip(true, ...)` calls are counted), which does not
  cleanly resolve to 91 (88+3). I judged this immaterial to the task — the skip count itself (3)
  is unambiguous and matches exactly — but I am flagging that I did not reconcile the total test
  count and am not asserting 91 as a verified figure.
- **I did not check whether any Ward Flow test files outside the `tests/ward-*` / `tests/ui-ward-*`
  naming convention exercise Ward Flow code** (e.g., a hypothetical `tests/wf-*.test.ts`). A quick
  `ls tests/wf-*` returned nothing, so I believe the naming convention is exhaustive, but I did not
  do a broader content-based search (e.g., grep for `ward-management` imports in every non-`ward-`
  test file) to rule this out completely.
- **I did not confirm the growth claim "387 to 422 files" against git history** — I only confirmed
  today's count (423) and took the historical figures as given by the task brief.

---

## Summary for the report

- **Population (a):** 3 skips, across the twelve `tests/ui-ward-*.spec.ts` files selected by
  `npm run test:e2e:ward-journeys`. All classification ①. Not run this session.
- **Population (b):** 75 skips, across 12 of the 423 files matching `tests/ward-*.test.ts(x)` (the
  default file set of `node scripts/run-ward-tests.mjs`, not run this session). All classification
  ①, all traced to the single 2026-09-06 owner ruling, all guarded by a live, unskipped
  reachability test.
- **No ③ (unrecorded reason) and no ④ (conditional skip gone permanent) found in either
  population**, by the strict definitions in the brief.
- **Three findings that matter more than a bare ③/④ would have:** two false "still covered
  elsewhere" cross-references (Findings 1 and 2) and one internally self-contradicting file
  (Finding 3), all in the Morning family, all traceable to the same 2026-09-06 event outrunning an
  earlier comment that was never revisited.
- **No ②** — nothing found whose blocking condition has already passed.
- One conditional skip (`ward-travel-bands.test.ts:243`) exists but is not currently exercised and
  is well-built against the exact danger the brief describes.
