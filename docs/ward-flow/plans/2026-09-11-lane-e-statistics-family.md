# Lane E — the statistics family, third edition

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

> **For whoever builds this:** read §0 before §1. §0 is a list of things the third-edition master
> plan states that are **measurably false**, each with the command that shows it. Building to the
> plan's prose without reading §0 costs a day.

**Goal:** bring Statistics, Ward statistics, Community team statistics and Emergency department
statistics onto the third edition — one layout with three variations, not four screens.

**Baseline:** `57e9d81543` (a merge containing the line tip `ee6a30c1e7`). Every figure in this plan
was measured at that SHA. ⚠️ **Re-derive before trusting any of them** — four commits landed while
§0 was being written and one count moved underneath it.

---

## §0 · What the master plan says that is not true

🔴 **Four corrections, each re-measured here rather than relayed.** Ward Lead supplied the first two;
I confirmed both against the tree and refined the second.

### §0.1 Every bare route path in the plan is wrong

The plan writes `/statistics`, `/ward`, `/board`, `/ed`, `/community`. **`src/app/statistics` does
not exist.** All 36 ward routes live under `src/app/mockups/ward-flow/`. The seven statistics routes:

```
statistics/page.tsx            statistics/ward/[unitId]        statistics/community/[teamId]
statistics/ed/[edId]           statistics/overview             statistics/compare
statistics/service/[serviceId]
```

⚠️ **§4.1 of the plan writes the prefix correctly**, so the document contradicts itself. You cannot
repair it by assuming a convention; check each path.

### §0.2 "Available is the only word for a free bed" — the word is **Ready**

§4.14's done-when names a word that does not exist. The visible label is **`"Ready"`**
(`ward/ward-screen.tsx:884, 900`). Building to the plan's wording would introduce a second word for
one state — **the exact defect that rule exists to prevent.**

⚠️ **AND A GREP WILL APPEAR TO CONTRADICT THIS.** `available` exists five times as a `data-state`
attribute value and a CSS selector (`bedChip[data-state="available"]`). **The ruling is about the
WORD a coordinator reads; an internal state token nobody reads may persist.** A vocabulary guard
written as a naive grep over the module would go red on correct code —
`a-guard-that-blocks-its-own-purpose`.

### §0.3 `capacityBreakdown` (D-23) does **not** reach these four screens

Traced rather than assumed. No statistics file reads it. The one candidate edge is inert:
`statistics-derivations.ts` imports from `ward-admissions`, which _is_ a `capacityBreakdown` reader —
but the import is **`import type { Admission }`**, which erases at compile time.

⚠️ **A type-only import is a real edge in an import graph and an absent edge at runtime.**
Reachability that counts it says worry; reachability that ignores it says do not. Only opening the
line settles it. Same family as `reachability-is-not-containment`.

### §0.4 Every line count and every "comes from &lt;file&gt;" claim is suspect

The plan's counts were taken at some earlier tip and have drifted. **Grep the file before believing
any sourcing claim.**

---

## §1 · The plan sizes these wrong in BOTH directions — three restyles and one build

⚠️ **This section said "this is a RESTYLE" in its first draft, and that was the same defect this
plan criticises §4.15 for: a neat framing applied to four screens when it is true of three.** It is
corrected here rather than rewritten silently, because the wrong version is the one a reader would
find easy to believe.

**Three of the four are restyles. Community team statistics is a build** — see §2 and §3a. Measured
at the baseline SHA:

```
src/components/ward-management/statistics/     7,832 lines ts/tsx    2,451 lines CSS
statistics-claims-register.ts alone            2,106 lines
tests/*statistic*                              30 files (28 vitest + 2 Playwright)
```

🔴 **So the risk is regression on working screens with real coverage, not a blank page.** Standing
constraint on this lane, from Ward Lead: **baseline first, at a named SHA, before a line moves.**

### The recorded baseline — collected AND passed AND skipped

```
offline ward suite    386 handed in · 386 ran · 4606 collected · 4531 passed · 75 skipped · 0 failed
statistics suites     28 files · 412 passed · 0 skipped · 0 failed                          exit 0
tsc -p tsconfig.typecheck.json --noEmit                                                     exit 0
ui-ward-statistics*   ran=yes · exit 0 · 4 passed · 0 failed · 0 skipped
```

⚠️ **The runner never prints a skipped line.** It prints `collected`, `passed`, `failed`, and closes
with _"OK — all 386 handed-in file(s) ran, 4531 test(s) passed."_ **The 75 exists only by
subtraction.** That is why "0 failed" has been quoted all day without it. **Record all three, every
time.**

### 🔴 The browser tier does not vouch for content here

| spec                                               | what it asserts                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ui-ward-statistics-compare.spec.ts:38`            | the **compare** screen keeps every row's identity — _not one of this lane's four_ |
| `ui-ward-statistics-journey.spec.ts:100, 138, 151` | the statistics screens are **reachable and readable on a phone**                  |

**Across all four of this lane's screens the browser tier checks that they load and are readable, and
nothing about what they say.** The 28 vitest files carry the entire content load.

⚠️ **Do not quote a green browser run as though it vouched for a figure.** On Lane C the browser spec
was the tier that saw what no unit test could; **that does not transfer here.** Each task below takes
its baseline from the vitest suites and treats the browser tier as a layout check only.

---

## §2 · Where drawing and built screen differ, neither wins automatically

**Ruling (Ward Lead, this lane):** Q-13 proved a drawing can be the stale artefact, and three further
drawing defects were routed to Ward Mockups within an hour of this plan — **one of which re-commits
an owner ruling the app already complies with.** The drawings are not a settled authority right now.
**The burden is on the change, either way.**

### The tell for who decides

> **Would a coordinator act differently?** If yes it is a different question being asked of the same
> data, and it is Ward Lead's to settle. If no it is wording, and it is this lane's.

_Declines by reason_ → _Where the pressure is_ is **not a rename.** It is a different question.

### The measured gap, per screen

**Statistics (top).** Drawing: _Across all services · Flow over time · Where the pressure is ·
Emergency departments · Community teams · Referrals for a bed_. Built headings: _Beds pending · Empty
beds that were not offered · Declines per ward · Declines by reason · Blocked discharges by blocker_.
`statistics-sections.ts` already carries _"Across all services"_, so the two are **partly**
reconciled and nobody finished it.

**Ward statistics.** Drawing has 7 sections; three map onto built ones under different names (_Beds
now_ ≈ _Bed capacity right now_, _Occupancy over the window_ ≈ _Occupancy and readiness over time_,
_Length of stay_ ≈ _Average length of stay_). **Absent from the build:** _Admissions and discharges ·
Discharge planning · Clinically ready, not yet gone · Referrals into this ward_.

⚠️ **Those four are not uniformly new questions.** `statistics-derivations.ts` already exports
`declinesByReason`, `blockedDischargesByReason`, `bedsBeingPrepared`, `referralToBedJoin`,
`pullToArrival`; `readyToLeaveCannot` exists. **Derivation-present / section-absent is presentation
and is this lane's. No derivation at all is a new question and is Ward Lead's.** Classify each with
the grep beside it; never assert the split.

**Community team statistics.** 🔴 **NOT A RESTYLE. Plan it as a build.** The screen has **3** panels
(_This team, in figures · Where this team sits · What this page cannot see_) against the drawing's
**7 sections / 12 `<h2>`** — measured two ways by two chats, and **either count leaves four to nine
sections that do not exist to be restyled.** **245 lines against ward's 628 and ED's 634.**

⚠️ **§4.15 Task 1 says, verbatim, _"Restyle; add the real team switcher (§6.18)."_** _Restyle_ is how
a planner SIZES a task and it tells a builder to change how existing panels look. **It pre-answers
§2's classification wrongly for its own screen.** ✅ **Neither a staleness sweep nor a symbol sweep
found this — counting panels against the drawing did.**

⚠️ **Two of its drawn sections read adjacent to the cross-reference D-17 closed** — _People currently
in a hospital bed_ especially. **Do not build either without a ruling.**

**Emergency department statistics.** Closest of the three; _Wait time band by band · Waiting now ·
Comparison across departments_ map onto built sections.

---

## §3 · The absence vocabulary — one family, four wordings

The drawing states the rule precisely, and it is a three-way distinction, not two:

> _A nought is a figure where it is measured and none where it is a state. A count of people waiting
> reads **none** in italic; a measured quantity such as beds ready keeps its **0**, so it can be
> compared down the column. **Neither ever stands for not tracked.** Where a figure could not be
> taken at all, the caption beside it says so._

**The distinction is already built and already correct in one place.**
`statistics-compare-screen.tsx` carries all three and a `cannotBeFormed` helper, with its own record
of the incident that produced it: twelve of twenty-three wards had nobody ready-to-leave-but-blocked —
**good news** — and it rendered as _"none"_, which read as _"we have nothing for you"_. Fixed
2026-09-05. It also documents the third case: **0 of 0 is undefined, not zero.**

🔴 **`cannotBeFormed` is used by that one screen and by none of this lane's four.** Each of the four
expresses the same idea in its own words — `cannot be measured`, `cannot see`, `not enough data to
compute`.

⚠️ **This is the fourteen-absence-phrasings problem inside one family of four screens that share a
layout.** It is a genuine reconciliation and it is this lane's — **but it is a READING job, not a
find-and-replace.** Ward-wide there are at least fourteen distinct forms (`Not recorded` ×14,
`Nothing outstanding` ×16, `Not tracked here` ×8, `Not yet requested` ×5, `Not stated` ×4, `Not
known` ×3, and more), and **some are genuinely different states.** Collapsing them is
`one-word-two-states` in reverse.

⚠️ **AND A CORRECTION, RECORDED BECAUSE IT SHOWS THE FAILURE MODE.** This plan's author reported that
the community screen had _no_ expression of the third state. **False.** It says `cannot see`; the
search pattern said `cannot be`. **A pattern narrower than the thing it was looking for, reported as
an absence.** Check the words on the screen before recording a gap.

---

## §3a · The rulings, and the one that came back

**D-36 to D-39 (Ward Lead, 2026-09-11).** Recorded here because §2's classification is what they
settle, and a reader who classifies without them will re-open decisions already made.

### 🔴 D-36 split three ways once its own condition was tested

D-36 ruled _Referrals into this ward_ and _Referrals into the team_ **presentation**, conditional on
confirming the derivation answers the drawing's question. **It does not, for the ward.**

The drawing asks for an **accepted share**. A share needs referrals RECEIVED by the ward as its
denominator, and `referralToBedJoin` yields what reached a bed — the numerator. **The denominator
does not exist, by design:**

```
ReferralDestination, psychiatric_ward arm
    kind · sex · secureBedNeeded · involuntaryBedNeeded · highAcuityNursingNeeded    ← no unit id
ReferralAddressing
    acceptedUnitId?        ← the unit that ANSWERED, never the one addressed
```

**A referral is never addressed to a named ward.** Same fact Lane C's _"offers no way to address a
referral to a named ward"_ guard rests on, and `statistics-claims-register.ts:251` states it from the
other side: _"`acceptedUnitId` is the ONLY field on this record that can name a unit."_

⚠️ **The asymmetry is the trap:**

| drawn section              | destination arm carries | verdict                            |
| -------------------------- | ----------------------- | ---------------------------------- |
| _Referrals into this ward_ | nothing                 | 🔴 **not derivable — Ward Lead's** |
| _Referrals into this ED_   | `edId`                  | ✅ presentation                    |
| _Referrals into the team_  | `teamName`              | ✅ presentation                    |

**Three near-identical titles across three sibling screens that share a layout; two are presentation
and one is impossible.** Reasoning by analogy from either sibling — the natural move on a
"one build, three variations" family — **ships a share with an invented denominator.**

### D-37 · _Clinically ready, not yet gone_ — presentation

`readyToLeaveCannot` exists. 🔴 **Carry the ruling that governs the phrase: "ready" means a ready BED
and a patient ready to LEAVE, and a guard on the word cannot tell them apart.** The heading must make
the subject explicit.

### 🔴 D-38 · _People currently in a hospital bed_ on community statistics — a privacy threshold

**The aggregate is not what D-17 closed** — that forbade a claim about one identified person. A count
is legitimately useful to a team.

⚠️ **But the count identifies at small N.** A team with four open cases, one in hospital, renders
**"1"** — and to anyone who knows that caseload, that is the person named. **An aggregate is only an
aggregate above a threshold, and a small community team is exactly where this screen is thinnest.**

**RULING: show the count only where it cannot single somebody out; below that, state the absence in
the "not enough data to compute" family** — which already exists here and means _computable but too
thin to publish_, which is this case exactly. **The threshold number is the owner's, not this lane's.**

### D-39 · _Contacts_ and _Time to first contact_ — HELD, build neither

The drawings put _"Contacts are not recorded in this prototype"_ on the same screen as a panel named
_Time to first contact_. **Two panels about contacts, one denying they exist and one promising a
measurement of them.** Anything built there inherits the contradiction.

---

## §3b · Traps that will bite the classification greps

⚠️ **Every one of these returns a real number whose meaning is unrelated. All were caught by reading
the hit, never by counting it.**

- **`contact`** — §4.15's _"the model holds no contact records"_ is TRUE. But `ward-model.ts:982` has
  `escalation?: { at; triedUnitIds; contact: string }` — an escalation's contact **person**. A
  builder checking the claim reads a real hit and calls the claim false.
- **`catchment`** — listed as not built, appears across six community modules. What is not built is
  **inferring team membership from catchment**, which is an owner's ruling, not absent code.
- **`\b` against a hyphen** — `var\(--ward-border\b[^)]*\)` sweeps in `--ward-border-strong`.
  **Two tokens, re-pointed separately by the forced-colors blocks (22 and 8), counted as one.** This
  plan's author did exactly that and reported 337 where the figure was 252.
- **A `**` glob in a git pathspec** does not recurse as a shell glob does. It silently matches a
  subset and returns a smaller, plausible, wrong number.
- 🔴 **`dailyFlow` really is new** — zero hits in all of `src/`. ⚠️ **So the cheap inverse heuristic,
  "assume anything the plan calls new already exists", also fails.** `corridorCounts` was already
  built and `dailyFlow` is not, two sections apart. **Check each, every time.**

### And the rule the evening earned four times

🔴 **A targeted grep can only confirm what you already expect; its silence is never evidence.**
Every absence this plan's author reported and later withdrew was found by a pattern narrower than the
thing it looked for. **What caught them was ENUMERATION — printing the headings, listing the
exports — not a better search.** Enumerate first, then search.

⚠️ **The same applies to a clean trigger.** A staleness threshold passed on sections that were wrong
in four dimensions, because it detects one mechanism and returns green on every other. **A green
instrument means "the one thing I check is fine", never "this is fine".**

---

## §4 · Task shape

**One task per screen, in this order**, because each later screen inherits the vocabulary decisions
of the earlier ones:

1. **The absence vocabulary** — reconcile the four screens' wording to the three-way distinction,
   adopting `cannotBeFormed` where the state is genuinely _cannot be formed_. No layout change.
   Catcher: the existing 28 suites, plus a new guard asserting each of the four screens uses one
   vocabulary. **This first, so later tasks do not each invent a wording.**
2. **Statistics (top)** — the section reconciliation, wording half only; anything failing the §2 tell
   goes to Ward Lead before it is built.
3. **Ward statistics** — as above, plus the derivation-present/section-absent classification.
4. **Emergency department statistics** — the closest fit; smallest task.
5. **Community team statistics** — 🔴 **last, and it is a BUILD, not a restyle.** Four to nine
   sections do not exist. ⚠️ **Two of its drawn sections are already ruled and must not be built as
   drawn:** _People currently in a hospital bed_ needs D-38's small-N threshold, which is the
   owner's; _Contacts_ and _Time to first contact_ are HELD under D-39 while the drawing contradicts
   itself about whether contacts exist at all. **Expect this task to stop for rulings, and size it
   as a build when it is scheduled.**

### Every task ends the same way

```bash
node scripts/run-ward-tests.mjs                       # record collected AND passed AND skipped
npx tsc -p tsconfig.typecheck.json --noEmit           # never the base config; it reads stale .next types
node scripts/ward-flow/check-text-size-floor.mjs      # no new sub-12px text
```

⚠️ **Never put a gate behind a pipe.** Redirect to a file, read `$?` on the next line, then read the
file. Three false greens today came from a status that belonged to something other than the thing
measured, and a Playwright refusal prints one line and no test output — so **check for a `passed`
count, never for the absence of `failed`.**

⚠️ **In ward CSS, never spell the 10px or 11px token names, not even in a rationale — name the pixel
size.** The floor ratchet counts token names inside comments, so a note recording that the floor was
honoured is counted as breaking it.

**Not built by this lane:** any section failing the §2 tell; any change to `capacityBreakdown`; any
deletion of a `forced-colors` block.
