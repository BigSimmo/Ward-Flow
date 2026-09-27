# A ward journey that walked into a redirect, and the guard that now sees it

**Ward Builder Three, 2026-09-08.** Branch `ward/spec-redirect-guard-20260908`, cut from
`codex/task-ward-flow-live-state-20260831` at `05792e7a3f`, merged up to `9add828165`.

**Output: one new guard, `tests/ward-specs-never-navigate-into-redirect-stubs.test.ts`. No repair.**
`origin/main` re-pointed the offending transport cases on 2026-09-06; repeating that fix here is the
duplicated-effort shape that produces no conflict and teaches nobody anything.

⚠️ **The reason originally given for not repairing them — "the merge plan takes main's side on that
file" — is retracted, and the sentence is corrected here rather than footnoted.** Both peers who
briefed this work withdrew it on 2026-09-08. It is a genuine owner decision; see the section below,
because it determines whether this guard is right to be red.

---

## What was wrong

MERGE 03 (owner-approved 2026-09-05) folded the live transport tracker into `MovementsScreen`.
`src/app/mockups/ward-flow/transport/page.tsx` became a bookmark backstop that calls
`redirect("/mockups/ward-flow/movements")`.

`tests/ui-ward-roles.spec.ts` kept navigating there — lines 246 and 272 — and then waiting for
`ward-live-tracker`. Nothing renders that id at the redirect target: it is declared only by
`tracker/live-tracker.tsx`, which `ward-nav.ts` records as "imported by nothing" and a deletion
candidate. **The navigation does not 404. It lands on a different screen and times out on a handle
nothing paints, which is the harder failure to read** — the same reasoning
`ward-links-never-point-at-redirect-stubs.test.ts` was written for.

⚠️ **On this line those two cases are inside `test.describe.skip`, retired 2026-09-06, so they do not
fail today.** The task brief said they were live-failing and that the fix was to take main's side.
Both claims were withdrawn by their own authors on 2026-09-08 once somebody opened the enclosing
`describe` instead of grepping for the test id — Ward Builder Four wrote the brief and retracted it,
Ward Lead confirmed it independently. Main re-pointed all three cases; this line retired two and
re-pointed one. A skip is a decision about whether a test RUNS; it does not repair the navigation,
and un-skipping one revives a broken journey with no warning.

### 🔴 A correction I published here that was itself wrong

**This section said both peers cited the navigations "one line off" at 247 and 273, and that the
second figure looked inherited rather than measured. That was false, and it was an accusation.**

Nobody was off by one. **We were counting different things.** 246 and 272 are the `page.goto` lines;
247 and 273 are the `getByTestId("ward-live-tracker")` waits immediately below them. This guard
prints navigations, so 246/272 is right for what it reports; Ward Builder Four's sentence named the
waits, so 247/273 was right for what it claimed.

⚠️ **The reasoning was sound and that is exactly what made it dangerous.** Two peers differing by
one in the same direction really is usually a relayed figure — the heuristic is good. But **two
correct measurements of adjacent lines are indistinguishable from one measurement relayed with an
error**, and I never established what each number was counting before comparing them. I checked
whether the error was mine before saying it was theirs; the check needed one more step, and skipping
it is what turned a reasonable suspicion into a published claim about someone else's care.

The fix is structural rather than a note: the guard's output now reads `spec goto@246` instead of
`spec:246`, so its locations carry their own population and cannot be compared against a different
one by accident. Retained here rather than deleted, because the deleted version of this leaves no
trace that the accusation was made.

### ⚠️ Retract-in-place permanently defeats any search for the retracted phrase

**If you are sweeping ward documents for withdrawn claims by grepping their text, this section will
give you a hit and it is not a live claim.** Retracting in place means quoting the accusation inside
its own withdrawal, so the words remain. **A presence check cannot distinguish a claim standing from
a claim quoted inside its retraction — both states contain the string.** Read the surrounding
context (`grep -o ".\{300\}<phrase>.\{300\}"`), never the count. Done properly, the more retractions
a record contains, the more hits a naive sweep returns, and the worse the record looks.

**Both directions of this were measured live on 2026-09-08, on these two files, within one hour, by
two people who were each searching carefully:**

|                    | What was searched                         | What it returned | Truth                                                                                                  |
| ------------------ | ----------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| **False absence**  | a line-scoped `grep` for a sentence       | not found        | the sentence wrapped across two lines, and markdown wraps everything — it was in the opening paragraph |
| **False presence** | a wrap-safe count of the retracted phrase | still there      | it was the retraction quoting itself                                                                   |

⚠️ **The wrap-safe fix for the first cannot fix the second; they need opposite instruments.** And a
third variant appeared in the same hour: two people counted `"appears to have inherited"` (0 hits,
correct) and `"inherited"` (1 hit, also correct) and briefly read the disagreement as one of them
being wrong. **Four times in one session, two parties measured different things and the difference
looked like an error by one of them.** Establish what is being counted before comparing two counts.

⚠️ **AND A FIFTH: THE PUBLISHED COMMAND WAS NOT THE COMMAND RUN.** Confirmed against my own
transcript after Ward Lead asked — they quoted my command back rather than characterising it, and
declined to guess which I had executed. I ran
`grep -c "looks inherited\|appears to have inherited"` and wrote it up as `grep -c "inherited"`.
Both returned 1 at that moment, so nothing downstream was wrong, **and that is the whole danger: a
paraphrased command is only detectable on the day its two versions disagree.** Everything downstream
reasons from the published one, so a check nobody can reproduce is not evidence, however carefully it
was run. **Publish the exact string, in the same breath as the number.**

🔴 **THE COMMON FACTOR ACROSS ALL FIVE IS SHARPER THAN "COUNT THE SAME THING", AND IT IS WARD LEAD'S:
in every one, both parties held a TRUE statement, and the contradiction was manufactured entirely by
the two statements being about different things** — different lines, different moments, different
strings, different commands. Five apparent contradictions between careful people, zero actual errors,
each costing a message round to dissolve. **A programme running five parallel chats generates these
continuously**, and the cheap defence is not more care: it is saying what was measured, exactly,
beside the number.

🔴 **These are this guard's own failure modes, not trivia about a document.** It is a text scanner.
Its comment-stripping exists because a route file can discuss `redirect(` in prose (false presence);
its `stripComments` newline preservation exists because collapsing text moved every line number
(a wrong location, which is a false absence at the place the reader looks). The two controls at the
top of the test file are exactly these two directions.

## 🔴 This guard takes a side in an open owner decision

Settled between three chats on 2026-09-08, after both peers who briefed this work retracted the
premise they briefed it on. The ward master line **retired** the transport cases by skipping them;
`origin/main` **re-pointed** them at Movements. Both are defensible edits, so which survives the
merge is **Josh's ruling**, not a mechanical take-main's-side.

The two outcomes are not symmetric for this guard:

| Ruling                | What happens to this guard                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------- |
| main's re-point wins  | the navigation is gone; it goes green on its own                                            |
| the retirement stands | the navigation is still written down; it stays **red forever** on something the owner chose |

**The second case is a guard reddening on correct work**, which is how guards get switched off. The
answer if it happens is a `PARKED` entry for those two findings — the same mechanism the morning case
already uses — and **never** widening the rule or deleting the file.

The position this guard holds is that **a skip decides whether a test runs; it does not repair the
navigation**, and un-skipping revives it silently. Ward Lead endorses that independently. It is a
real position and it may lose. Losing it would not be evidence it was wrong to hold.

## Why nothing caught it

`ward-links-never-point-at-redirect-stubs.test.ts` holds exactly this property and derives it well —
stubs come off the route files, not a maintained list, so a new stub is covered the day it lands. It
walks `src/app/mockups/ward-flow` and `src/components/ward-management` **for the links**.

**It does not walk `tests/`.** An in-app link into a stub is caught; a spec's own `page.goto` into
one is invisible. The population a guard walks is the thing to check, not its assertion.

## What the new guard asserts

> After navigating to a redirect stub — **by `page.goto` or by clicking a real `<Link>`** — a ward
> spec may not wait for a **test id or accessible name** that the redirect **target** cannot render.

The property is about the handles, not the navigation, and that distinction is doing real work.
`ui-ward-management.spec.ts:375` navigates to `/queue` **on purpose** and says so: it asserts only on
shared `ClinicalRail` chrome that `DelaysScreen` mounts too. That test is correct and stays green. A
guard that reddened it would be reddening correct work, and those get widened until they mean nothing.

Both sides come off disk — stubs from the route files, renderable ids from the target's own
transitive import closure (seeded with the layouts on its path, because ward chrome lives there).

## Proof it can fail, and proof it can pass

| Control                                                                      | Result                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| The real estate                                                              | 🟢 clean — **the red was DISCHARGED 2026-09-09, not tidied** (see below) |
| `ui-ward-discharges.spec.ts` — navigates only to live routes                 | 🟢 green                                                                 |
| Synthetic: goto `/transport`, wait for `ward-live-tracker`                   | 🔴 reports 1                                                             |
| Synthetic: same navigation, wait re-anchored on `ward-movements-page`        | 🟢 reports 0                                                             |
| Movements' closure is non-empty and contains its own root id                 | 🟢                                                                       |
| An id arriving via a `testId` prop is collected                              | 🟢                                                                       |
| Comment stripping keeps a URL, drops a real comment, drops prose `redirect(` | 🟢                                                                       |
| Line numbers survive a block comment                                         | 🟢                                                                       |
| A parked entry still matches something                                       | 🟢                                                                       |
| A parked entry cannot absorb a neighbouring defect                           | 🟢                                                                       |

**Added 2026-09-08 with the click and accessible-name arms:**

| Control                                                                       | Result       |
| ----------------------------------------------------------------------------- | ------------ |
| Click a link whose label resolves to a stub, then wait for the retired handle | 🔴 reports 1 |
| Click a link whose label resolves to a live route                             | 🟢 reports 0 |
| Wait on a name the redirect target cannot expose                              | 🔴 reports 1 |
| Wait on `"Who is being carried"`, a real Movements panel                      | 🟢 reports 0 |
| `"New referral"` resolves to `/referrals/new`, not a neighbour's href         | 🟢           |
| A name used as `filter({ has: … })` feeding a `toBeHidden()`                  | 🟢 ignored   |
| A `toBeHidden()` on the retired handle itself                                 | 🟢 ignored   |

**The fourth row is the one that matters most and the one a guard is usually shipped without.** Being

## 🔴 The red is gone, and how it went matters more than that it went

**Updated 2026-09-09 by Ward Lead, at the author's request; the author had resumed but could not
reach this file while another chat held the worktree.** The proof table above said RED on
`ui-ward-roles.spec.ts:246` and `:272`. **That is now false, and it was false in the dangerous
direction** — the next reader runs the guard, gets green, and must decide whether the guard broke or
the defect was fixed, which is the broken-and-never-worked-are-identical shape this report is about.

**What happened: the master line merged `origin/main` and the owner-level decision was taken.** This
line had RETIRED the three live-tracker cases with `describe.skip`; `main` had RE-POINTED them at
the Movements transport panel. Main's re-point was taken, on the argument that a skip leaves the
broken navigation still written down and un-skipping it revives it silently. The navigation is gone,
so the guard goes green by itself — which is exactly the first row of this report's own asymmetry
table. **No parked entry was needed and none was added.**

⚠️ **THE ASYMMETRY TABLE OFFERED TWO OUTCOMES AND THE REAL ONE WAS A THIRD.** It framed the
choice as main's re-point winning OR the retirement standing. Neither happened alone: this line also
carried a Movements dark/forced-colours/print block that `main` does not have, so **either side-pick
would have dropped real coverage.** The resolution was hunk by hunk — main's re-point plus this
line's extra block. A binary framing excluded the answer.

🔴 **AND A BLIND UNION BROKE IT FIRST.** Taking both sides wholesale left an unclosed
`describe.skip` wrapping main's block. **Typecheck caught it; reading it did not.** A union of two
good versions is not automatically a good version, and the thing that caught it was a gate rather
than care.

**Verified after, by the author on the merged line and independently here: 13 tests, 13 passed.**
That count is the meaningful shape rather than a bare green — four of the thirteen are synthetic
controls that construct a defect and assert the guard REPORTS it, so a guard that had gone inert
would have failed those four while the real assertion went quiet. All thirteen passing means the
detector still fires AND the estate is clean.

⚠️ `ward-live-tracker` still appears once in `ui-ward-roles.spec.ts`, at line 216, **inside
the doc comment recording this history**. It is not a live wait, and the guard strips comments, so it
is correctly invisible. A bare `grep -c` there returns 1 and reads as though the defect survived.
**Read the match, not the count.**

`ui-ward-morning` remains PARKED pending owner ruling D9, and its parked-entry control still passes,
which requires that exemption to still match a live finding. Only transport is discharged.

---

red on `ui-ward-roles.spec.ts` only proves the file can fail. A guard hard-wired to redden on _any_
navigation into a stub produces exactly that same red — and then stays red through the repair, and
gets switched off. Only the re-anchored synthetic separates the two.

Run it directly: `npx vitest run tests/ward-specs-never-navigate-into-redirect-stubs.test.ts`.
**`test:focused` cannot select it** — that selects by import graph, and a guard that reads source as
text imports nothing, so a focused run reports success having never run it.

## Two defects the guard had, found by its own controls

1. **Comment stripping collapsed block comments to a single space**, renumbering every line below.
   `spec:line` locations are this file's entire output; the two transport findings were reported 61
   and 71 lines above where they are. A finding pointing at innocent code is worse than no finding —
   the reader looks, sees nothing wrong, and learns to discount the guard. Block comments are now
   replaced by their own newlines, with a regression control.
2. **Ids arriving through a `testId` prop were invisible.** Eleven ward components render
   `data-testid={testId}`, and the id is written at the call site 70 times as `testId="ward-…"`.
   Without that arm every panel and table handle in the estate would have been reported as
   unrenderable — a false positive, which is the direction that gets guards deleted.

## The third finding, and the one exemption

Sweeping the whole estate turned up a case **not in the brief and not flagged anywhere**:

> `tests/ui-ward-morning.spec.ts:41` navigates to `/morning`, which redirects to `/capacity`, and
> waits for `ward-morning-page`.

Every word of that is true, **and it is not a repair anybody may make today.** `morning-page.tsx` and
the spec both record an owner ruling: `MorningPage` is **parked, not retired**, pending owner
question **D9** (whether the morning board and the shift handover still owe each other a cross-link
once folded). Both say in as many words not to delete the component, not to re-point these tests at
`CapacityScreen`, and not to re-mount it — each pre-empts the decision instead of waiting for it.
`origin/main` carries the same skip and the same reasoning, and `CapacityScreen` renders neither the
headline, nor the per-site figure grid, nor the print layout, so there is nothing to honestly
re-point at.

So it carries a `PARKED` entry, **keyed on the whole finding** — spec, stub route, and the exact ids
waited for. Change any of them and it stops matching and the finding returns. Two controls hold it
honest: one fails if the entry stops matching anything (a stale exemption is indistinguishable from a
working one by looking), one fails if it absorbs a different defect in the same spec.

**The transport findings are not the same case and are not exempted.** Their property survived onto
Movements and main re-pointed them. Same shape, different disposition; collapsing the two would have
been the easy mistake.

🔴 **Never exempt a whole spec, and never exempt "skipped blocks" as a class.** That would make the
guard blind to every future defect anybody switches off, which is the one thing it exists to see.

---

## 🔴 What this guard cannot see

Stated here because a guard whose honest limit is unwritten gets quoted later as proof of something
it never checked. Each entry says which way it errs: **missed defect** is survivable, **false
positive** is what gets a guard deleted.

1. **Only literal `page.goto("/…")`.** A route built from a variable or a constant is skipped
   entirely. No ward stub is reached that way today, and dynamic `[segment]` routes cannot be stubs,
   but a constant like `TRANSPORT_HREF` passed to `goto` would be invisible. _Missed defect._ The
   sibling link guard resolves `href={CONST}` constants and this could borrow that.
2. ~~**Only navigation by `goto`.**~~ 🟢 **CLOSED 2026-09-08.** A click on a real `<Link>` is now a
   navigation too: `ward-nav.ts` carries `{ id, href, label }`, so **23 link labels resolve to
   routes** and `getByRole("link", { name: "…" }).click()` is checked exactly like a `goto`. Residue
   below (12).
3. ~~**Only test ids.**~~ 🟢 **CLOSED 2026-09-08 for `getByRole(…, { name })`.** `WardPanel` renders
   `aria-label={title}` and its heading from one `title` prop, so a literal `title="Who is being
carried"` is a renderable NAME the same way `testId="…"` is a renderable id. This was the arm that
   would not have caught main's re-pointed Movements tests. **`getByText` and raw CSS selectors
   remain outside** — see (13).
4. **Reachability follows type-only imports**, so the renderable set is a superset of what a browser
   paints. _Missed defect, never an invented one_ — every verdict reported is true under the stricter
   runtime rule.
5. **A fully computed id** — `data-testid={someExpression}` with no literal anywhere reachable — is
   not in the renderable set. _False positive risk._ The `testId` prop arm closes the common case;
   an id assembled from fragments would still slip through.
6. **Prefix matching is generous**: an awaited id is accepted if it shares a prefix either way with
   any renderable id. This exists for `[data-testid^="ward-tracker-row-"]` families. A genuinely
   missing id that happens to prefix-match an unrelated one would pass. _Missed defect._
7. **Only `tests/ui-ward-*.spec.ts`.** A ward journey living in a differently named spec is not
   walked.
8. **Dormancy is lexical.** A helper defined above a skipped block reads ACTIVE even when only
   skipped tests call it — `ui-ward-morning.spec.ts` is exactly that. The label is advisory and
   over-states urgency rather than under-stating it; no finding is ever dropped because of it.
9. **It proves nothing about whether the redirect target's screen is correct** — only that the handle
   the spec waits for exists somewhere reachable from it.
10. **`test:focused` will not select it.** See above. A focused run's silence is not a pass.

### Added 2026-09-08, when the two arms above were built

11. **Only POSITIVE waits are judged.** A `toBeHidden()`, a `not.toBeVisible()`, a
    `toHaveCount(0)`, and a name used inside `filter({ has: … })` are all skipped. This is correct
    for this guard's property — a hidden assertion on a locator matching nothing passes rather than
    hanging — but it means **a vacuous negative assertion is invisible here**. One existed:
    `ui-ward-management.spec.ts` built a header locator filtered on a heading `"Priority queue"` that
    `/delays` does not render, then asserted something inside it was hidden. It passed because the
    locator matched nothing, and the spec's own comment said so without treating it as a defect.
    **That is a checks-that-cannot-fail problem, not a walks-into-a-redirect problem** — so this
    guard excluded it and routed it instead of fixing it. 🟢 **Ward Lead repaired it on 2026-09-09**,
    re-anchoring on the count the test's own name claims and proving the new assertion can fail by
    expecting 2. **The limit itself stands** — the example is gone, the blind spot is not.
    _Different defect class, not a miss._
12. **A link label that does not resolve is skipped, never guessed.** Two in the ward specs today:
    `"Ward Flow"` (the layout brand link) and `"Morning bed state"` — the latter because that label
    no longer exists in `ward-nav.ts` at all, so **that click would fail to find its link rather than
    land on a stub**, which is a loud failure this guard is not for. Labels built from a variable,
    a template, or a regex (`name: /^Referral board\b/u`) are likewise skipped. _Missed defect._
13. **`getByText` and raw CSS selectors are still unattributed.** Panel and heading names are covered
    by (3); arbitrary body text is not, and matching it would mean resolving every JSX text node.
    _Missed defect._
14. **The click arm's red case is injected, not natural.** No ward label can reach a redirect stub,
    because the sibling `ward-links-never-point-at-redirect-stubs.test.ts` fails the moment one does
    — so this arm has **no real defect to demonstrate itself on, by construction**. Its proof uses an
    injected destination map. That is deliberate: an arm only ever observed returning nothing is
    indistinguishable from one wired up wrong. **If that sibling guard is ever weakened or deleted,
    this arm becomes the only thing standing between a spec and a click into a stub.**

## Routing

The `ui-ward-morning.spec.ts` finding is **not** an action for anyone: it is parked on owner ruling
D9 and the exemption records that. If D9 lands, either `/morning` stops being a stub — in which case
the entry stops matching on its own — or the coverage is re-pointed, in which case delete the entry
alongside the re-point. Do not guess which.

No source file under `src/app/mockups/ward-flow/` or `src/components/ward-management/` was touched,
and no ward spec was edited.

## Gates run

- `npx vitest run tests/ward-specs-never-navigate-into-redirect-stubs.test.ts` — 9 tests, 8 pass,
  1 red by design.
- `npx tsc --noEmit` and `npx eslint` — clean on this file.
- **The full Playwright suite was NOT run.** It is a heavy exclusive gate and other ward sessions
  are live; running it would have blocked them. No browser-level claim in this document rests on a
  Playwright run — every statement above is a static read of the source.

---

## ⚠️ A limit this guard has, added 2026-09-10 — found by somebody else's failing test

> **This guard only judges waits following a REDIRECT-STUB navigation. The same defect on a live
> route is invisible to it.**

**Ward Builder Three's own words, committed by Ward Lead because they had been told to stop and a new
commit is not stopping.**

**How it surfaced:** Ward Verifier's chromium run failed at `ui-ward-roles.spec.ts:559` —
_"a spec waits for a test id the screen does not render"_, **which is this guard's exact property.**
But `/ed/peel-ed` is a **live** route, so this guard never looks at it. **The defect class is wider
than the guard.**

⚠️ **And the limits section is a population like any other.** This one was written from the cases its
author happened to trip over, not from an enumeration of the class — the same omission Ward Builder
Four found in their own limits section the same afternoon, independently. **When you write "what this
does not prove", enumerate the class; do not list the instances you hit.**
