# Ward Flow route-count claims — audit against `34b8a9d7e`, 2026-09-07

**Read-only.** No source file, test, or existing document was edited by this audit. This is a new
file only.

## What I ran

1. Re-derived the ground truth independently, without trusting the brief's numbers:
   - `git ls-tree -r --name-only 34b8a9d7e src/app/mockups/ward-flow | grep -E '/page\.tsx$'` → listed
     every `page.tsx` file in that ref's tree.
   - `git show 34b8a9d7e:<path>` on each of the 35 files, grepped for `redirect(`.
   - Read the **full contents** of every file that matched, at that ref, to confirm each `redirect()`
     call is unconditional — not gated by `if`/`switch`/a ternary.
2. Identified the ref's place in history: `git log -1 34b8a9d7e`, `git log -1 --format=%P 34b8a9d7e`,
   `git merge-base --is-ancestor` in both directions against `HEAD`.
3. Grepped `docs/ward-flow/**`, `docs/superpowers/plans/**`, `docs/ward-flow-context.md`,
   `docs/archive/ward-management-mode-map.md`, `src/components/ward-management/**`, and `tests/ward-*` for
   numeric route-count phrasing, then read each hit in its surrounding context and checked the
   file's own git history for when the number was written and whether it was true then.
4. Read `tests/ward-nav.test.ts`, `tests/ward-landmarks.test.ts`, and the `PINNED` table in
   `tests/ward-route-component-binding.test.ts` **both** at ref `34b8a9d7e` (via `git show`) **and**
   as currently checked out in this working tree (`HEAD`), because the two turned out not to be the
   same commit (see below).
5. Ran three test files read-only (`npx vitest run`, no `--update`, nothing written) to check a
   suspicion raised by a stale declared-orphan list, since a static read could not settle whether a
   guard was actually red. Also ran `tests/ward-nav.test.ts` + `tests/ward-landmarks.test.ts` +
   `tests/ward-route-component-binding.test.ts` together as a sanity check on `HEAD`.

## 🔴 The working tree is NOT ref `34b8a9d7e` — this changes what "currently" means

`HEAD` in this worktree is `493cf8182` ("fix(ward-flow): my own token guard reddened correct work by
searching prose"). `34b8a9d7e` is a **merge commit on a sibling branch** — `git merge-base --is-ancestor`
returns false in both directions; their merge-base is `9f6ea8913`. `HEAD`'s own parent is `9f6ea8913`
itself (one of `34b8a9d7e`'s two parents, the "four statistics screens" branch) — so this working tree
holds one of the two branches the fold combined, not the fold's result, and not the other branch either.

This matters for the whole audit: **the documents I was asked to check live in this working tree**
(`HEAD`), not at `34b8a9d7e`. So there are three different numbers in play, and I've kept them
separate rather than collapsing them:

| Where                                                                           | `page.tsx` total | redirect-only | renderable |
| ------------------------------------------------------------------------------- | ---------------: | ------------: | ---------: |
| **Ref `34b8a9d7e`** (the brief's stated ground truth, a merge of both branches) |           **35** |         **6** |     **29** |
| **This working tree, `HEAD` = `493cf8182`** (one parent branch, not the merge)  |               34 |             6 |         28 |
| `34b8a9d7e`'s other parent, `166b76c05` (not checked out anywhere I can see)    |               34 |             6 |         28 |

## The three ground-truth numbers, re-derived independently

Against `34b8a9d7e`:

- **`page.tsx` files under `src/app/mockups/ward-flow`: 35.** (I counted by listing and reading the
  output, not trusting a `wc -l`.)
- **Files containing `redirect(`: 6** — `constellation`, `escalation`, `exceptions`, `morning`,
  `queue`, `transport`. I read all six in full. Every one is a single unconditional
  `redirect("...")` call with no `if`/`switch`/ternary anywhere in the file — genuinely redirect-only,
  not something that redirects on some inputs and renders on others.
- **Renderable routes: 35 − 6 = 29.**

**This matches the numbers given in the brief exactly (35 / 6 / 29).** I did not find a different
answer, so there is no "the code wins" correction to make here — the brief's ground truth held up
under independent re-derivation.

For completeness, I also traced _why_ it's 35 and not 34: `34b8a9d7e` merges `9f6ea8913` (adds
`statistics/service/[serviceId]`, "four statistics screens" — 34 routes) with `166b76c05` (adds `hub`,
"the search hub" — 34 routes). Both parent branches independently went from a 33-route baseline to
34 by adding one route each; the merge combined both additions, landing on 35. Neither new route is a
redirect, so renderable moves 27 → 29 in the same step. The merge commit's own title says this in
one line: _"the search hub, and the route count both branches said was 34."_

## Test-literal check (read at `34b8a9d7e`, then again at `HEAD`)

| File                                                        | At ref `34b8a9d7e`                                                                                                                                                                                    | At `HEAD` (`493cf8182`)                                                                                                                                                                                       | Agrees with `34b8a9d7e` ground truth (35/29)?                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/ward-nav.test.ts`                                    | `wardFlowRoutes.length` → `toBe(35)`; `RENDERABLE_ROUTES.length` → `toBe(29)`                                                                                                                         | `wardFlowRoutes.length` → `toBe(34)`; `RENDERABLE_ROUTES.length` → `toBe(28)`                                                                                                                                 | **Yes, at the ref.** At `HEAD` it correctly asserts `HEAD`'s own different, self-consistent state (34/28) — not wrong, just a different commit. |
| `tests/ward-landmarks.test.ts`                              | `wardFlowRoutes.length` → `toBe(35)`; `RENDERABLE_ROUTES.length` → `toBe(29)`                                                                                                                         | `wardFlowRoutes.length` → `toBe(34)`; `RENDERABLE_ROUTES.length` → `toBe(28)`                                                                                                                                 | **Yes, at the ref.** Same caveat as above for `HEAD`.                                                                                           |
| `tests/ward-route-component-binding.test.ts` `PINNED` table | 35 keys, of which 6 map to a `"redirect:..."` string → 29 non-redirect. No exact literal is asserted (`files.length` only needs `toBeGreaterThan(25)`), but the table's own shape is exactly 35/6/29. | 34 keys (no `hub` entry) at `HEAD`'s current tree — I did not re-read this file at `HEAD` in full since the two test-literal files already answered the "do they agree" question; see "What I did not check." | **Structurally yes, at the ref.**                                                                                                               |

Ran together at `HEAD`: `npx vitest run tests/ward-nav.test.ts tests/ward-landmarks.test.ts
tests/ward-route-component-binding.test.ts` → **3 files passed, 156 tests passed.** `HEAD` is
self-consistent on its own 34/28 numbers; nothing here is broken _at `HEAD`_.

🔴 **One title in `tests/ward-landmarks.test.ts` is wrong at `34b8a9d7e` itself, independent of
anything in this working tree.** Line 220's `it()` title reads:

> `"finds every known page.tsx under src/app/mockups/ward-flow: 34 (28 renderable + 6 redirect-only)"`

but the assertion two lines above the closing brace is `expect(wardFlowRoutes.length).toBe(35)`. The
comment block directly above the assertion is unusually self-aware about exactly this failure mode —
it narrates the whole merge collision ("35, AND NEITHER SIDE OF THIS CONFLICT SAID 35... Both
branches said 34, both counted the disk correctly before their own change, and both were right
alone") and even names the general trap ("A count in a title is prose: nothing recomputes it and
nothing can go red on it") — but the fix that landed corrected the comment trail and the assertion
and missed the one string a person actually reads when scanning test output. The sibling test's title
two tests later ("RENDERABLE_ROUTES has exactly 29 entries") was updated correctly and matches. This
is not a claim I'm inferring from prose; both strings are quoted verbatim above from `git show
34b8a9d7e:tests/ward-landmarks.test.ts`.

## 🔴 The one finding worth the whole audit: a census conclusion has already gone false, and I could prove it, not just suspect it

`tests/ward-component-reachability.test.ts` (present in `HEAD`, this working tree — no merge
required to see this) declares `src/components/ward-management/statistics/statistics-primitives.tsx`
as permanently unreachable:

```
{
  module: "src/components/ward-management/statistics/statistics-primitives.tsx",
  why: "referenced by nothing in src/ at all",
},
```

This declaration is sourced from `docs/ward-flow/unreachable-ward-screens-2026-09-06.md`, which
names `statistics-primitives.tsx` (`StatFootnote`) as "the only one of the eleven that is" "plain
unused code... referenced by nothing at all in `src/`" — measured against "all 33 ward routes" on
2026-09-06.

**That's no longer true, and it isn't a merge-fold problem — it's already true in this working
tree.** `src/components/ward-management/statistics/statistics-service-screen.tsx` — the screen
behind the _other_ branch's new route, `statistics/service/[serviceId]`, which **is already in
`HEAD`** (it's the "four statistics screens" branch `HEAD` descends from) — imports and renders
`StatFootnote`:

```
import { StatFootnote } from "@/components/ward-management/statistics/statistics-primitives";
...
      <StatFootnote
```

I ran the guard rather than just asserting this from a static read, since "is it actually red" and
"looks like it should be red" are different claims:

```
npx vitest run tests/ward-component-reachability.test.ts
```

Result: **2 of 4 tests fail, right now, at `HEAD`:**

- `declares every orphan a test renders...` — fails: `ward-standing-strip.tsx` is now rendered by a
  test but reached by no route and undeclared (a separate, smaller drift — not part of this audit's
  scope, flagged only because the same run surfaced it).
- `holds no stale declaration, so a screen coming back reddens its own marking` — fails with:
  > _these components ARE reachable from a route now, so declaring them unreachable is a false
  > statement about the tests that render them... `statistics/statistics-primitives.tsx (declared
unreachable because: referenced by nothing in src/ at all)`_

This is exactly the danger class the brief asked me to flag loudly: **a number used as evidence for a
conclusion, where the population moved and the conclusion didn't get re-checked.** The "33 routes"
census undercounted even before the fold (a route was added same-day, 2026-09-06, per
`ward-landmarks.test.ts`'s own comment trail) that made one of its eleven "orphan" findings wrong —
and the repo's own guard has already caught it, independent of anything I measured. This is not a
prediction; it is a currently-red assertion I read the output of.

## Every route-count claim found, with verdict

Legend: **TRUE** = accurate now. **AGED** = accurate when written, dated or clearly time-scoped, has
since moved, not a defect. **STALE** = present-tense, no date, a reader today would act on it, and
it's wrong — a defect. **UNVERIFIABLE** = I could not check it without a live crawl/build I did not
run.

| Location                                                                      | Claim                                                                                                      | Verdict                                                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ward-flow/assignment-register.md:171` and the table above it (~163–172) | "33 `page.tsx` files on disk" (labelled "Master"); same table's "At the fold" column says 35/29            | **TRUE**                                                                                         | This is not a stale one-shot claim — it's an explicit before/after comparison table, dated 2026-09-06, that predicts the fold's outcome as 35 total / 29 renderable. My independent derivation at `34b8a9d7e` confirms the "at the fold" prediction exactly. The 33 is correctly labelled as the pre-fold baseline, not asserted as current.                                                                                                                                                                                                                                                                                                                                                                                 |
| `docs/ward-flow/adoption-fanout-2026-09-04.md:24`                             | "32 routes, 55 components"                                                                                 | **AGED**                                                                                         | Framed inside a "measured rather than remembered" section, dated 2026-09-04, adjacent to "Measured on `a49876051`". The argument it supports ("every screen already exists, this is adoption not creation") doesn't depend on the exact count — true whether it's 32 or 35. Low stakes.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `docs/ward-flow/capacity-figure-render-census-2026-09-06.md:12,14`            | "crawling all 33 ward routes"; "33 of 33 routes" (positive control)                                        | **AGED, and this is the brief's own example case**                                               | Dated 2026-09-06, explicitly a live-crawl measurement. The two new routes (`hub`, `statistics/service/[serviceId]`) were never crawled. I checked statically whether either imports `ward-management-modes.tsx` or references `data-testid="ward-capacity-view"` or any of the six capacity-figure names — neither does. So the specific "0 of 33" conclusion at line 45 (below) likely still holds as "0 of 35," but I did not run a browser crawl to confirm it, and the document's own denominator is now wrong on its face.                                                                                                                                                                                              |
| same doc, line 45                                                             | "`data-testid="ward-capacity-view"` ... appeared on 0 of 33 routes"                                        | **AGED, evidence-for-conclusion — flagged, not falsified**                                       | Same reasoning as above. Static check says the two new routes don't touch this testid, so I have moderate confidence "0 of 35" would also hold, but this is not the live re-crawl the document's own method requires, and I did not run one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `docs/ward-flow/community-redesign-handover-2026-09-05.md:77`                 | "19 of about 30 routes"                                                                                    | **AGED**                                                                                         | Dated 2026-09-05, deliberately hedged ("about"), and reports a fraction of what was _checked_ (19 named routes), not a claim about the unchecked remainder. The "zero found" conclusion is scoped to the 19 actually visited, not extrapolated to all routes, so the stale denominator doesn't undermine the finding.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `docs/ward-flow/design/prototypes/DESIGN-LANGUAGE.md:4`                       | "Around 22 routes exist"                                                                                   | **STALE — a real defect**                                                                        | No date attached to this specific number (the nearby "owner chose this direction on 2026-09-03" dates a decision, not the route count). This file is the standing design-system reference — `CLAUDE.md` explicitly tells builders to read it "before any UI building," so it is read as current, today, not as history. 22 vs. the true 35 is a 37% understatement, in a document builders are told to trust right now.                                                                                                                                                                                                                                                                                                      |
| `docs/ward-flow/fd23-bypasses-2026-09-01.md:61`                               | "all 35 routes are one click from a ward screen"                                                           | **STALE, and the match to today's true number (35) is coincidental — worth flagging on its own** | I checked the actual route count at the commit when this file was last touched (`b11dbc364`, 2026-09-02): **31 `page.tsx` files**, not 35. The route count has moved through 31→32→33→34→35 since, and by coincidence the count from the merge I was asked to audit lands back on the same digit this 2026-09-01 document guessed (or miscounted) wrong. Reading "35" today and concluding this document was right would be exactly backwards — it was wrong when written and has been wrong continuously since; only the specific number it landed on happens to match now. The underlying structural claim (no role gating, one flat nav list reaches every screen) doesn't depend on the exact figure and is unaffected.  |
| `docs/ward-flow/figures-with-no-reader-2026-09-06.md:19`                      | "131 of them reachable from the 33 ward routes"                                                            | **AGED**                                                                                         | Dated 2026-09-06, denominator context for a 150-file scan, not itself the finding (the finding is about which model fields/functions have readers). Two new routes could in principle add readers for previously-unread figures, but I did not re-run the scan; flagged under "what I did not check" rather than resolved.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/ward-flow/unreachable-ward-screens-2026-09-06.md:3,41,108,153`          | "all of the 33 ward routes" / "all 33 routes crawled" (four occurrences)                                   | **AGED, and this is the one that already broke a live guard** — see the dedicated section above  | The `statistics-primitives.tsx` orphan claim sourced from this document is demonstrably false right now, confirmed by a red test run, independent of the merge fold.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `docs/ward-flow/ward-mono-survey-2026-09-06.md:79`                            | "Never renders on any of the 33 routes"                                                                    | **AGED, low risk**                                                                               | The declarations listed under this heading were already ruled on and built (checkmarked, with commit hashes, in the same document's "What was ruled, and what was built" table) — the CSS was already removed regardless of the exact route count, so the stale denominator doesn't threaten an open conclusion.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tests/ward-component-reachability.test.ts:10`                                | "eleven ward components sit outside the import graph of all 33 ward routes"                                | **STALE, code-comment version of the same claim**                                                | Dated ("Measured 2026-09-06") but stated as a live docblock fact at the top of a currently-running test file. One of the eleven is no longer true, as shown above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md:38`          | "asserts exactly one `<h1>` per route across 31 routes"                                                    | **AGED**                                                                                         | Dated 2026-09-04 plan document, cites a specific test line as of that date. Plans are point-in-time design records; nothing here suggests a reader today is meant to treat the count as current.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `docs/superpowers/plans/2026-09-04-ward-flow-screens-community-and-ed.md:167` | "the shell covers ten screens or all 31 routes"                                                            | **AGED**                                                                                         | Same reasoning — dated plan, describes an unresolved scope question as of 2026-09-04, not a current fact.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `docs/ward-flow-context.md:166`                                               | "There are 32 routes in total (31 renderable + 1 redirect-only), pinned by `tests/ward-landmarks.test.ts`" | **STALE — a real defect, and wrong on two axes, not one**                                        | No date near this line; stated as flat present-tense fact in what is meant as a living orientation document. I checked the commit that last touched this file (`538e2bc13`, 2026-09-05 12:59 UTC) against the commit that introduced the MERGE 01 redirects (`e31c9c46`, 2026-09-05 16:17 +0800 ≈ 08:17 UTC) — the doc's correction commit predates the redirect merges by about 4 hours, so "1 redirect-only" was momentarily true when written and has been wrong ever since (it's 6, not 1, and has been since the same afternoon). The total (32) is also now wrong (35). This is the more dangerous of the two errors here, because "1 redirect-only" undercounts by 5 even independent of the later route-count drift. |
| `docs/archive/ward-management-mode-map.md:3,13,59`                            | "32 routes (31 renderable + 1 redirect-only)"; "24 routes... complete the 32-route sandbox"                | **AGED, explicitly self-flagged — not a defect**                                                 | The document's own second line reads: _"Status (2026-09-02): superseded... Kept as the pre-sandbox design record."_ A reader is told, before reaching the number, not to treat this as current. Numerically it has the same two errors as `ward-flow-context.md` above, but the document warns about its own staleness where the other one doesn't.                                                                                                                                                                                                                                                                                                                                                                          |

## What I did not check

- **I did not run a live browser crawl of the two new routes** (`hub`, `statistics/service/[serviceId]`)
  against `ward-management-modes.tsx`'s `data-testid="ward-capacity-view"` or the six capacity-figure
  render counts in `capacity-figure-render-census-2026-09-06.md`. I checked statically (import/text
  search) that neither new route's source references that testid or those figure names, which makes
  the census's specific "0 of 33" conclusion likely still hold as "0 of 35" — but "likely" is not
  "confirmed," and a static search cannot rule out an indirect render path the way the document's own
  browser-crawl method can.
- **I did not re-run `figures-with-no-reader-2026-09-06.md`'s 150-file/36-figure scan** to see whether
  either new route's screen gives a reader to a figure the census found unread. Flagged as a
  possibility, not resolved.
- **I did not re-read the full `PINNED` table in `tests/ward-route-component-binding.test.ts` at
  `HEAD`** (only at `34b8a9d7e`) — the two test-literal files (`ward-nav.test.ts`,
  `ward-landmarks.test.ts`) already answered the "does `HEAD` agree with the ref" question
  consistently (34/28, self-consistent, matching each other), so I judged a third confirming read at
  `HEAD` to be redundant with the vitest run I already did (156/156 passing at `HEAD`).
- **I did not check `34b8a9d7e`'s other parent branch, `166b76c05`,** on disk anywhere — I don't know
  if it exists as a checkout on this machine, and it wasn't necessary for the audit (the merge ref
  itself was the stated ground truth).
- **I excluded route-count claims that are not about Ward Flow's own route set** — e.g., "40 routes"
  (owner-scope, sitewide), "30 routes" and "39 routes" (sitewide UX/scroll sweeps in
  `docs/archive/**` and `docs/outstanding-issues.md`), "42 route handlers" and "21 routes" (Care Plan,
  unrelated feature) found during the broad grep. These use "routes" in the same word-sense but
  describe a different population (the whole site, or a different feature), so they are out of scope
  for a Ward Flow route-count audit and I did not verify them.
- **I did not investigate the `ward-standing-strip.tsx` reachability failure** the vitest run
  surfaced as a side effect — it's a real, currently-red finding in the same test file, but it is not
  a route-count claim and is outside this audit's brief. Naming it here so it isn't lost, not
  resolving it.
- **I did not check whether any other document outside `docs/` and the two component/test
  directories named in the brief carries a route-count claim** — e.g., PR descriptions, commit
  messages beyond the ones I opened for dating purposes, or anything under `docs/superpowers/specs/`
  not already surfaced by the grep.
