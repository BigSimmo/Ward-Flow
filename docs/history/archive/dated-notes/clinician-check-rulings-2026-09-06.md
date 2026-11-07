# The clinician check — the owner's answers, 2026-09-06

**The check happened.** All seventeen questions answered. This file is the ruling record; the
questions are in `clinician-check-questions.md`.

⚠️ **These are owner rulings on a clinical model, not preferences.** A test expectation that
encodes one of them carries its date and this file's name in a trailing comment, so a merge
resolver meets the ruling on the line rather than in a document they may not open.

---

## The three stages — KEPT, with the middle one optional

| #     | Ruling                                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Option (c): keep three stages, make the middle one optional.** Do not force a `confirmed` step for a patient who never had one. |
| **2** | **`confirmed` means the treating team has DECIDED. It does NOT mean it will definitely happen.**                                  |
| **3** | **A confirmed discharge can still reverse, and the board must show that.** Owner: _"Still possible to reverse."_                  |

## 🔴 4 · A NEW BED STATE: `pending`

> **Owner, verbatim:** _"No... the bed goes to Holding or whatever the equivalent is until the bed
> is ready. I think it is Pending. The bed goes to pending during this time."_

**A bed is NOT usable the moment the patient leaves.** Between the patient leaving and the bed
being ready it occupies a distinct state, which he names **`pending`**.

⚠️ **This is a model change, not a wording change.** Measured 2026-09-06: `pending` does not exist
as a bed state anywhere. What exists is `bedsPendingPreparation` — a _derived figure_ and a
_sentence beside Ready_. **He has asked for a state.** Whoever builds it must establish whether the
derived figure becomes the state, or whether the state is new and the figure derives from it.

**And it interacts with the 2026-09-01 ruling, which is NOT reversed:** a bed being prepared blocks
the pull rather than reducing the ward's number, because the ward has not changed what it can
staff. **A `pending` state must not silently become a subtraction.**

## What you are waiting on

| #     | Ruling                                                                                                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5** | The five reasons match how a ward actually talks. Confirmed.                                                                                                                                    |
| **6** | 🔴 **ADD TWO: _awaiting legal or Mental Health Act process_ and _awaiting transport_.** Owner: _"Add those two."_ A fixed clinical list, extended by the owner — no agent may alter it further. |
| **7** | **Option (b): keep exactly ONE hold-up, defined as _the one that will take longest_. Say so on screen**, or a reader will think the others are unknown.                                         |
| **8** | **Record when the next ward round is, per ward.** Consultant rounds run on set days, so _"awaiting ward round"_ can mean Thursday, not this afternoon. Turns a vague wait into a date.          |

## The figures

| #      | Ruling                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9**  | **Lead with the number that can take a patient today. Show empty separately.**                                                                                                   |
| **10** | **Rename `Blocked`.** Owner: _"Yes to your recommendation of unavailable."_ ⚠️ **See the note below — the live label is not what the question described.**                       |
| **11** | 🔴 **A bed on leave is NOT one you would offer.** Show it as information, never as availability. The live label is `Leave (usable)`, which asserts the opposite and must change. |
| **12** | **Delete the figure nobody uses.** ⚠️ **He agreed the principle; the figure was not named.** Open — do not guess which.                                                          |

### ⚠️ Note on 10, because the question described a label that does not exist

I put the question as _"does `Blocked` mean anything to you"_, arguing that a _blocked bed_ reads as
blaming a patient. **The live label is `BED_RELEASE_BLOCKED_FIGURE_LABEL = "Blocked releases"`** —
about discharges being held up, not beds being unavailable. **So "Unavailable" is the wrong
replacement for that string.** The ruling stands; the target needs re-putting to him.

## Keeping it true

| #      | Ruling                                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **13** | **Nurse in charge, at handover, under a minute.** If it does not belong to handover it will not happen.                                                                                                     |
| **14** | **Degrade to "we do not know", never to a confident wrong number.** Show the time it was last confirmed.                                                                                                    |
| **15** | **Make correcting it from the ward trivial, and show who last confirmed** — so a wrong number carries a name and a time rather than looking authoritative.                                                  |
| **16** | 🔴 **The eligibility figures get the strongest protection: sex mix, one-to-one nursing capacity, age band.** A wrong bed count wastes a phone call; a wrong sex-mix figure puts someone in an unsafe place. |

## 🔴 17 · IT IS A CONVENIENCE, NOT A SOURCE OF TRUTH — OPTION (A)

**Owner chose (a): it stays a convenience, and a "confirm with the ward" step goes on any placement
action.**

⚠️ **This is the ruling that bounds every other one.** It is explicitly NOT the source of truth,
so a coordinator is expected to ring. **The hazard it settles is drift: a good board becomes the
source of truth without anybody deciding it has.** He has decided it has not.

**What it obliges:** a placement action must prompt to confirm with the ward. **What it does not
license:** treating any figure as unimportant. It bounds the CLAIM, not the care.

---

# Later the same day — three further owner decisions

## 🔴 RULING 4 IS ANSWERED: OPTION (c). The qualifier stays; no `pending` state is built.

**He was told, before deciding, that there are no beds in this model** — a `Unit` carries counts
(`beds`, `empty`, `blocked`, `held`), there is no `Bed` type and no bed identifier anywhere, and the
ward board's own grid keys an occupied bed by **the patient in it** and every empty one by a loop
index. **A bed is only a distinct thing while somebody is in it.**

**So "the bed goes to pending" had no referent, and the choice was put to him without option names:**
does a ward keep a fourth count at handover, or does the system start tracking individual beds?

**Decision: neither. Keep what shipped 2026-09-06** — the eight screens that render a Ready figure
now also state _"N still being made ready"_. **It is a description, not a state, and that is
deliberate.**

⚠️ **The two arguments that moved it:** the handover panel already asks three questions and **only
one of them is recorded**, so a fourth ask would be added to a form that is already half-broken; and
ruling 13 says this must take under a minute. **Tracking individual beds remains the honest model
and is the largest change in Ward Flow's history — deliberate work for another day, not a side
effect of this ruling.**

**And the 2026-09-01 non-subtraction rule is untouched and now doubly load-bearing:** a bed being
prepared blocks the pull, it does not reduce the ward's number.

## ✅ RULING 16 IS AUTHORISED TO BE BUILT — and it is smaller than first sized

**Sex mix, one-to-one nursing capacity and age band get a confirmation time AND a source.**

⚠️ **Both, or neither: they have no `source` field at all, so a timestamp alone could not tell a
ward's statement from a seeded value.**

**It is not a new screen and not a new habit.** The handover panel already asks _"anything limiting
intake?"_ — which **is** these three — once a day, under a minute. **The question is on the page and
has nowhere to put the answer.** Of the three things that panel asks, only `allocatable` reaches the
model; the other two go into a `useState` Set that resets on mount.

**Context that makes this the priority it is:** today the figure with every protection is the **bed
count**, which he ranked lowest in the same sentence that ranked these three highest. _The phone
call has a freshness gate and the unsafe place does not._

## ✅ THE ELEVEN UNREACHABLE SCREENS: FINISHED WITH

**The 79 test cases that describe them are to be retired**, with what they covered recorded.

⚠️ **THE COMPONENTS THEMSELVES ARE NOT DELETED BY THIS DECISION.** This repository forbids removing
an exported symbol on a _"nothing imports it"_ basis, and **three of tonight's findings were defects
held in place by unreachability** — which is more fragile than a live defect, not less. **A deletion
needs its own written argument.** What this ruling closes is the false coverage, which is the actual
harm: _79 cases pass forever and describe screens nobody can open, and a reader counting green ticks
converts that into confidence._

### Confirmed 2026-09-06, second time of asking: **_"Yes retire the 82 tests"_**

⚠️ **He was asked twice, and the second ask was correct.** Ward Verifier declined to retire 82
passing checks on the coordinator's relay of the first answer — **a truthful relay and a laundered
one are identical in the recipient's inbox**, and retiring ward work sits inside the protected-work
rule. **It cost one message and blocked nothing:** the actual harm, those cases being read as
coverage of live screens, was closed the same afternoon by a reachability guard that fails in both
directions.

**The number is 82, not the 79 in earlier circulation** — corrected by running the files rather than
counting `it(` blocks in source, with the whole difference isolated to one file (5 by source, 8
actual) and every other row matching. **Confirmed by a second instrument, vitest's JSON reporter.**

🔴 **THE COMPONENTS ARE STILL NOT DELETED BY THIS.** He retired the _tests_. This repository forbids
removing an exported symbol on a _"nothing imports it"_ basis, and **three of the day's findings were
defects held in place by unreachability** — which is more fragile than a live defect, not less. **A
deletion needs its own written argument.**

---

## ✅ `CANCEL_TRANSPORT` ROLE WIDENING — PROMOTED HERE 2026-09-06, from a register row

**Owner, on whether a community team may cancel a transport:**

> _"Yes they can if discharging a patient. Often patients don't need a ward bed but do need
> community follow-up."_

**This was a real ruling with his own words** — but it was recorded only as a row in
`assignment-register.md`, which is where **my dispatch decisions** live, not his. Ward Builder Two
asked to be shown its source and was right to: **a builder should not have to trust a relay for a
role-permission change.** It is promoted here so the answer sits where somebody looks for a ruling.

## 🔴 AND ITS NEIGHBOUR, WHICH IS THE OPPOSITE CASE: THE `!unit.forensic` CLAUSE

**There is no ruling.** No quote, no date, nothing in any ward document. My register carried it as
_"authorised 2026-09-06"_ — **my word, not his.**

⚠️ **The danger was not the row on its own.** Ward Builder Two's structural-gap test correctly stated
the clause _"needs the owner's authorisation"_; my row appeared to record that it had been given.
**Two individually accurate documents, read together, authorised a clinical change nobody
authorised** — and forensic status decides whether a bed can be offered to a particular patient.

**Not built, verified rather than assumed:** `networkHasCohort` does not carry the clause, and the
two `!unit.forensic` hits in `ward-eligibility.ts` are pre-existing and unrelated.

**OPEN, and it is a clinical question: should a forensic unit be excluded from ordinary bed
matching?** Nobody may build it until he answers. The register now says **NOT AUTHORISED** in the
status column, and rule 5 there forbids the word "authorised" in that column ever again.

---

## ✅ THE COORDINATOR SEES CONFIRMED AND HELD-UP RELEASES AGAIN — ruling 2026-09-06, built the same hour

**Owner, asked whether a reduction found by a failing browser test was intended:**

> _"Yes the coordinator should still see confirmed and blocked releases."_

**What had happened.** MERGE 02 (`bf563af9f`, 2026-09-05) folded the bed-state view and the morning
board into one Capacity screen and cut the per-ward figures from six — Ready · Held · Confirmed ·
Expected · Blocked · Occupied — to three: **Ready · Locked · Freeing**.

🔴 **Measured, not inferred: `ward-capacity-bed-states-*` existed nowhere in `src/`, and neither did
`ward-capacity-headline-blocked-releases`. So a release's stage stopped reaching the coordinator
entirely — per-ward AND in the headline.** A ward could confirm a discharge, or record one as held
up, and the person allocating beds saw neither. The ward screen showed it and it stopped there.

**How it was found, which is the part worth keeping.** By `tests/ui-ward-discharges.spec.ts` — one of
ten browser journeys **no gate has ever run**, because Ward Flow is never pushed and every lane that
runs them is a pull-request lane. It walks a release from flagged → confirmed → blocked → discharged
and asserts the coordinator's board moves with it, without a reload. ⚠️ **It was one of eight red on
its first-ever run, and the temptation was to read all eight as stale selectors.** Five were. This
one was reporting a product change.

**What was built:** two columns on the network table, `Confirmed` and `Discharges held up`, both
labels taken from their declared constants (`bedReleaseStateLabels.confirmed`,
`BED_RELEASE_BLOCKED_FIGURE_LABEL`) rather than typed, and both counts `undefined` — rendering as
_"Not tracked here"_ — when no release list is supplied, never `0`.

**Two judgements made in building it, stated because they were mine and not his:**

1. **Neither figure is filtered to today, unlike `Freeing` beside them.** `Freeing` answers a
   question about a day; these answer a question about a state. ⚠️ **On held-up discharges a day
   filter would actively harm** — a discharge stuck since Tuesday is the most important row on the
   board, and the longer it is stuck the further outside "today" it sits. A figure that drops the
   worst cases as they worsen is worse than no figure.
2. **`Expected`, `Held` and `Occupied` were NOT restored** in the first pass. He ruled on confirmed
   and blocked, and a test is not the place to decide a third figure belongs on a clinical screen.

## ✅ AND THEN ALL SIX — second ruling, same day

> _"Yes add expected, held and occupied back too."_

**The board now carries the full six per ward: Ready · Held · Confirmed · Expected · Discharges held
up · Occupied.**

### 🔴 ADDING THE OTHER FOUR EXPOSED A DEFECT IN HOW I BUILT THE FIRST TWO

**I counted `confirmed` and `blocked` with my own loop over the release list, and told the owner I
had deliberately not scoped them to today — with an argument for it.** Building the remaining four
meant reading `capacityBreakdown()`, which **already computed `confirmedToday`, `expectedToday`,
`blockedToday`, `held` and `excludedBeyondToday`**, and which the WARD screen already renders.

⚠️ **So my figures were a second source of truth for the same clinical numbers, and they disagreed:
mine were unscoped, the canonical ones are scoped by `releaseBand`.** The same ward would have shown
one number on its own screen and a different one on the coordinator's board. **Two disagreeing
figures are worse than either rule, and the argument I gave for my scoping was an argument for a
divergence I had not noticed I was creating.**

**And the canonical function was right about something I got right only by luck:** it counts a
**blocked-but-confirmed** bed as confirmed, with its own comment recording why — the 2026-08-28
defect where marking a stuck discharge blocked dropped the ward's confirmed count, so the figures
improved at the moment the ward got stuck.

**All six now read from `capacityBreakdown()` / `unitCapacity()`. Nothing on this board counts
releases itself.** `held` and `occupied` read only `Unit`, so they are always a number — there is no
"nobody told this screen" state for them and rendering one would be a false claim about reporting.

### ⚠️ OPEN, AND DELIBERATELY NOT SETTLED BY CHOOSING A FORMULA

**These figures are scoped to today, so a discharge held up since Tuesday falls outside the band and
is not in that ward's held-up count.** The screen states `excludedBeyondToday` separately, so it is
not hidden — but as a lump, not as _"this ward has one stuck since Tuesday"_.

**Should a discharge held up for days keep counting in its ward's held-up figure?** That is a
question about what a bed coordinator needs to see, not about a derivation, and it is with the owner.
