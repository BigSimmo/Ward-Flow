# Which capacity figures actually render — 2026-09-06

**Ruling 12 asked which of the six capacity figures would never be used. The owner agreed the
principle and named no figure, so it stands open.** This measures the half that can be measured:
**which of them render on a screen a coordinator can reach, and on how many.**

⚠️ **This is deliberately NOT the question Ruling 12 asks.** _"Renders nowhere"_ is a fact; _"nobody
would use it"_ is a clinical judgement and stays with the owner. **A figure rendered on six screens
nobody reads is a different problem from one rendered nowhere**, and this document only speaks to the
second.

Measured by crawling **all 33 ward routes** in a browser and matching each figure as it is actually
rendered — its label immediately followed by its number. Positive control: ward chrome detected on
33 of 33 routes, so the crawl ran.

## The result

| figure           | rendered label     | routes | where                                                         |
| ---------------- | ------------------ | -----: | ------------------------------------------------------------- |
| `confirmedToday` | `Confirmed`        |  **5** | `/`, `/capacity`, `/discharges`, `/morning`, `/ward/[unitId]` |
| `availableNow`   | `Ready`            |  **3** | `/`, `/board/[unitId]`, `/ward/[unitId]`                      |
| `expectedToday`  | `Expected`         |  **2** | `/`, `/ward/[unitId]`                                         |
| `held`           | `Held`             |  **2** | `/`, `/ward/[unitId]`                                         |
| `blockedToday`   | `Blocked releases` |  **1** | `/ward/[unitId]`                                              |
| `onLeave`†       | `On leave`†        |  **1** | `/ward/[unitId]`                                              |

† **Measured as `leaveUsable` / `Leave (usable)`, and superseded the same day.** Owner ruling 11
(2026-09-06) removed `LeaveBed.usable`, so the field was renamed and — unlike `blockedToday`, whose
label alone moved — its MEANING changed with it: it counted the flagged-usable subset of leave beds
and now counts every bed on leave. **The footprint below is unaffected** (same one route, same one
chip), which is the only property this census claims about it; the count it prints on that route is
not the same measurement it was when this table was captured.

**No figure renders nowhere.** All six reach at least one screen, so none is a "renders nowhere"
candidate — which was the strongest fact this measurement could have produced, and it did not.

**What it does produce is a footprint.** `Discharges held up` and `On leave` appear on **exactly
one screen each**, the per-ward page. By render footprint they are the two thinnest of the six. **That
is a fact about the screens, not an argument about the figures**, and the owner's question is still
the one that decides it.

## 🔴 The six never appear together anywhere a coordinator can go

`ward-management-modes.tsx` renders all six as a labelled card set inside
`data-testid="ward-capacity-view"`. **That testid appeared on 0 of 33 routes.** It is the
`WardModeWorkspace mode="capacity"` view — the mode whose last test was retired on 2026-09-06 as
unreachable.

⚠️ **So the only place the six exist as a SET is a screen no route reaches.** Everywhere they are
reachable they appear individually, in twos and threes.

> 🔴 **BUT "NO LONGER EXISTS" IS NOT "NEVER EXISTED", AND THE FIRST VERSION OF THIS SECTION INVITED
> THE SECOND READING.** Verified from history after it was relayed onward as _"a screen he has never
> seen"_: at `9a8fb1353`, the commit immediately before MERGE 02, **`/capacity/page.tsx` rendered
> `<WardModeWorkspace mode="capacity">` and `ward-management-modes.tsx` carried all six labels — both
> true at the same commit.**
>
> **The card set entered on 2026-08-26 (`ea5482b93`, Phase 5); the route stopped rendering it on
> 2026-09-05 (`bf563af9f`, MERGE 02).** So **all six were on one screen at
> `/mockups/ward-flow/capacity` for roughly ten days, ending the day before this census.** Whether
> anyone looked is not knowable from here — **but a question about the six as a group is a question
> about a screen that existed until yesterday, not one that never existed.**
>
> ⚠️ **A LITERAL GREP OF THAT COMMIT FINDS FIVE OF THE SIX, NOT SIX — AND THE MISSING ONE IS NOT
> MISSING.** `Blocked releases` renders through the constant `BED_RELEASE_BLOCKED_FIGURE_LABEL`
> (`ward-derivations.ts`), so a search for the literal string sees `Ready`, `Confirmed today`,
> `Expected today`, `Held` and `Leave (usable)` and stops. **Anyone re-verifying this window will get
> five and conclude the set was incomplete.** It was not: measured at `9a8fb1353`, five labels are
> literal and the sixth is the constant, whose value is `"Blocked releases"`. **Measure the thing,
> not a proxy — a label rendered through a constant is invisible to a search for its text.**
>
> ⚠️ **The original sentence was true and still travelled wider than its evidence.** "Anyone
> reasoning about the six as a group is reasoning about a screen that no longer exists" reads as
> though the group were never real. **The window is the missing half, and its absence is what let the
> claim grow by one step in the retelling.**

## Ruling 11 — the blast radius of `Leave (usable)`

**A bed on leave is not one a ward would offer, so the label asserts the opposite of the truth.**
Every occurrence in `src/`, with comments separated from code:

| site                            | reachable?                        | seen by a coordinator?                                               |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `ward/ward-screen.tsx:1063`     | reachable                         | ✅ **yes — `/ward/[unitId]`, the only one**                          |
| `ward-management-modes.tsx:598` | file reachable, **branch is not** | ❌ inside `ward-capacity-view`, 0 routes                             |
| `ward-morning-rollup.ts:50`     | label map                         | ❌ its only consumer for this key is `morning-page.tsx`, unreachable |

**One screen carries the wrong clinical claim.** Not three, and the difference matters: a repair has
one user-facing site to correct and two more to keep consistent.

⚠️ **Four test files assert the label** — `ward-screen.dom`, `ward-morning-rollup`,
`ward-capacity-view.dom` and `ward-morning-page.dom`. **The last two stand over unreachable surfaces**,
so a rename done only where a coordinator can see it will still go red in two files that describe
screens nobody can open.

## What this does not say

**Nothing here recommends removing a figure or changing a label.** Ruling 11's label is the owner's
wording to settle and Ruling 12's question is his to answer; this is the render side only, produced
so that whoever answers is choosing against measured facts rather than an impression.
