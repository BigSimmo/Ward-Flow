# Unreachable ward screens — 2026-09-06

**Eleven ward components cannot be reached from any of the 33 ward routes.** Measured two independent
ways, which agree. Nothing was changed by this investigation.

## What is unreachable, and why

**Five merges replaced screens. The old routes now redirect to the replacements. The old components
are still in the tree, still tested, and no coordinator can open any of them.**

| old route               | now                       | orphaned component                                     |
| ----------------------- | ------------------------- | ------------------------------------------------------ |
| `/morning`              | redirects to `/capacity`  | `morning/morning-page.tsx`, `morning/morning-tour.tsx` |
| `/escalation`           | redirects to `/delays`    | `escalation/escalation-board.tsx`                      |
| `/transport`            | redirects to `/movements` | `tracker/live-tracker.tsx`                             |
| `/exceptions`, `/queue` | redirect to `/delays`     | — (already counted above)                              |
| `/community`            | renders `CommunityIndex`  | `community/community-home.tsx`                         |
| `/community/[teamId]`   | renders `CommunityScreen` | `community/community-team-hub.tsx`                     |
| `/ed/[edId]`            | renders `EdScreen`        | `ed/ed-home.tsx`                                       |

**Three more are dead by association rather than by replacement**, and the distinction matters
because the fix is different:

- `community/community-figures.tsx` and `community/community-teams-table.tsx` — referenced **only** by
  `community-home.tsx`, which is itself unreachable. **Transitively dead**: they would come back to
  life if their parent did.
- `statistics/statistics-primitives.tsx` (`StatFootnote`) — a shared primitive referenced by
  **nothing at all** in `src/`. Not a replaced screen; **plain unused code**, and the only one of the
  eleven that is.

## How it was measured, and the two mistakes on the way

**Static** — every ward `.tsx`, every exported component, every JSX tag, closed transitively from the
entry component of all 33 `page.tsx` files **and the ward `layout.tsx`**.

> ⚠️ **The first run said 14 and three were false.** It seeded only from `page.tsx` and missed
> `layout.tsx`, which renders `WardFlowProvider`, `WardGround` and `WardShellHeader` — so the graph
> reported the provider that every screen depends on as unreachable. **An obviously-wrong entry in a
> list is worth more than a plausible one: it is the only reason the missing edge was found.**

**Runtime** — all 33 routes crawled in a browser, checking whether any of the eleven modules' CSS
classes ever paint. **None does.**

> 🔴 **The first crawl reported `routes crawled: 0 of 33` and every module as "never painted".** The
> dev server was down, so every navigation failed — and the output was a clean, complete confirmation
> of the hypothesis, produced by measuring nothing. **A negative result from a probe that ran zero
> iterations is indistinguishable from a negative result that means something.**
>
> ⚠️ **The re-run therefore carries positive controls**: `capacity`, `delays` and `ward-record-row`
> are known-live and the probe must report them as RENDERED. It does — on `/capacity`, `/delays`,
> `/movements` and, usefully, on `/morning`, `/escalation` and `/transport`, which is the redirects
> working. **The eleven negatives only mean something because those three positives came back.**

## What it costs — and this is the part that matters

**13 test files render an unreachable component. 82 test cases live in those files.**

> ⚠️ **CORRECTED 2026-09-06 FROM 79, BY RUNNING THEM.** The table below was counted from the
> source and undercounted `ward-device-claim-reason.dom.test.tsx` by three — 8 cases, not 5. Every
> other row matched exactly when each file was executed and its own reported total read back.
> **A static count of `it(` blocks is a proxy for what runs**, and it was wrong in the direction
> that understates the problem. The figure in circulation was 79; it is 82.

| cases | file                                      | renders                      |
| ----: | ----------------------------------------- | ---------------------------- |
|    20 | `ward-morning-page.dom.test.tsx`          | `MorningPage`, `MorningBody` |
|    12 | `ward-ed-home.dom.test.tsx`               | `EdHome`                     |
|     7 | `ward-morning-tour.dom.test.tsx`          | `MorningTour`                |
|     6 | `ward-escalation.dom.test.tsx`            | `EscalationBoardPage`        |
|     5 | `ward-community-scope.dom.test.tsx`       | `CommunityHome`              |
|     5 | `ward-community-teams-table.dom.test.tsx` | `CommunityTeamsTable`        |
|     8 | `ward-device-claim-reason.dom.test.tsx`   | `EscalationBoardPage`        |
|     5 | `ward-ed-service-bands.dom.test.tsx`      | `EdServiceBands`             |
|     4 | `ward-community-figures.dom.test.tsx`     | `CommunityFigures`           |
|     4 | `ward-community-team-hub.dom.test.tsx`    | `CommunityTeamHub`           |
|     2 | `ward-morning-tour-paused.dom.test.tsx`   | `MorningPage`                |
|     2 | `ward-statistics-primitives.dom.test.tsx` | `StatFootnote`               |
|     2 | `ward-tracker-leg-badge.dom.test.tsx`     | `LiveTracker`                |

**These 82 cases pass forever and describe screens nobody can open.** A reader counting green ticks
concludes the ED home screen, the morning handover and the escalation board are covered. They are
covered; they are simply not reachable.

> 🔴 **This is the same defect as `ward-mode-workspace-reachability`, one level up.** That guard
> existed because seven test files rendered `WardModeWorkspace` modes no route reached — 42 tests
> standing over dead screens. **It watches modes. Nothing watches components**, and the component-level
> version is nearly twice the size.

⚠️ **A further 8 files, 86 cases, only MENTION these components** — `ward-nav.test.ts` and
`ward-landmarks.test.ts` name them as route data, not as subjects. **Those are not the same claim and
are not counted above.** A first pass that counted mentions gave 165, which would have overstated
this by more than double.

## What is NOT concluded here

**None of this says the code should be deleted.** Three different situations are in that list — a
replaced screen whose route redirects, a component orphaned with its parent, and one genuinely unused
primitive — and they do not share a remedy. `docs/agents/dead-code-deletion.md` governs any removal,
and the owner has not been asked whether these screens are finished with or parked.

**The actionable finding is the test coverage, not the components.** 82 cases reporting green about
screens no coordinator can reach is a false assurance today, whatever is eventually decided about the
code underneath them.

## The fourth question: reachable in principle, but never actually rendered?

Ward Lead asked for the gap between _reachable_ and _painted_, on the grounds that a single
"unreachable" count hides it. **Measured across all 33 routes: the gap is empty.**

|                                                                     |              |
| ------------------------------------------------------------------- | -----------: |
| reachable components                                                |           52 |
| measurable at runtime — own CSS module (18) or a `data-testid` (31) |       **49** |
| undetectable by any crawl                                           |            3 |
| **painted**                                                         | **49 of 49** |
| **reachable but never painted**                                     |        **0** |

**48 paint on page load. One — `referrals/referral-match.tsx` — paints only after a coordinator
selects a queued referral**, which is an interaction, not an unreachable condition: 24 of its 33
markers appear the moment one is clicked.

**The three that no crawl can speak about are correct to be invisible**: `ward-flow-provider.tsx`
renders no DOM of its own, and `ward-sidebar-content.tsx` and `statistics/statistics-disclaimers.tsx`
carry neither a stylesheet nor a test id. **That is 3 of 52 unmeasured and it is stated rather than
rounded away.**

### ⚠️ The first version of this answer had five findings and four were my probe's fault

The first pass took **the first `data-testid` in each file** as its marker. In this codebase that is
very often a _conditional_ one — `-unknown-patient`, `-unresolved`, `-suburb` — so its absence means
**"that state did not occur"**, not "the component never rendered". Re-probing with **every** marker
each file can emit resolved four of the five immediately: `shortlist-panel`, `referral-intake`,
`statistics-ed-screen` and `statistics-ward-screen` all paint, on the routes you would expect.

**A probe built from the first thing you find measures the first thing you find.**

### ⚠️ And the click that settled the fifth failed the first time, silently

The selector was guessed (`ward-referral-queued`), matched nothing, and the click ran against an empty
locator. **The script reported `NONE FOUND — the click below proves nothing`, which is the only reason
the resulting zero was not read as confirmation.** The working selector
(`ward-referral-board-card-select-`) was taken from the rendered page rather than from memory.

**Three times in this investigation a probe returned a clean negative that meant nothing** — twice
because the dev server was down mid-crawl, once because the selector matched no elements. **Every one
of those negatives agreed with the hypothesis being tested.**

---

## Update, 2026-09-06 — the coverage is now declared, and four more dead modules turned up

**`tests/ward-component-reachability.test.ts` holds the property.** It closes the import graph from
all 33 routes plus `layout.tsx` and fails in **both** directions: a test rendering a newly orphaned
component reddens `declares every orphan`, and an orphaned screen becoming reachable again reddens
`holds no stale declaration` and names the entry to delete. **Both were proved by mutation, not
assumed** — removing a declaration was caught, and adding one import of `EdHome` to the live
`/ed/[edId]` route was caught by exactly the staleness assertion, naming `ed-home` and
`ed-service-bands` together. Both restores byte-identical.

Ten of the thirteen test files also carry a file-level pointer. **The three `morning/` files do not**
— Ward Builder Three holds them, and the guard declares the module instead, which marks the
coverage without editing a file somebody else is working in.

⚠️ **The first version of that guard walked every ward module and named five false orphans.**
`ward-contention.ts`, `tracker-derivations.ts`, `ed-home-derivations.ts`,
`ward-referral-visibility.ts` and `statistics-claims-register.ts` are all imported by tests and
reached by no route — **and flagging them was wrong, because a logic module tested directly is not
a test standing over a screen nobody can open.** The guard was narrowed to `.tsx`.

**But four of those five are genuinely dead, and this census missed them because it counted
components:**

| module                          | state                                                          |
| ------------------------------- | -------------------------------------------------------------- |
| `ward-contention.ts`            | no importer in `src/` at all — like `statistics-primitives`    |
| `statistics-claims-register.ts` | mentioned in three statistics screens' prose, imported by none |
| `tracker-derivations.ts`        | imported only by `live-tracker.tsx`, itself unreachable        |
| `ed-home-derivations.ts`        | imported only by `ed-service-bands.tsx`, itself unreachable    |
| `ward-referral-visibility.ts`   | imported only by the two unreachable `community/` screens      |

⚠️ **These are NOT the same finding and must not be added to the 82.** They are dead code, not
false coverage, and `docs/agents/dead-code-deletion.md` governs any removal. **They are recorded
here because the search for them exists now and will not be repeated by accident.**

⚠️ **And the way they surfaced is worth keeping.** Checking whether the guard had invented them,
a `grep` for each module name across `src/` returned confident importer lists — `ward-screen.tsx`
for `ward-referral-visibility`, three statistics screens for `statistics-claims-register`. **Every
one of those was a mention in a comment.** The guard strips comments and was right; the verification
did not and was wrong. **A grep for a filename finds the prose that discusses it**, and prose is
exactly what accumulates around a module somebody once decided to stop using.
