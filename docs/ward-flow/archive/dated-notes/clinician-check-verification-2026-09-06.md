# Verifying the clinician check against the code — Ward Verifier, 2026-09-06

## ⚠️ SCOPE, BEFORE ANYTHING ELSE: SEVEN OF SEVENTEEN RULINGS, NOT ALL OF THEM.

**Examined: R1, R2, R5, R6, R8, R9, R12, R13, R15, R16 — ten of seventeen.** R3 was opened far
enough to make one observation, which is marked as an observation and not a finding. **R4, R7, R10,
R11, R14, R17 were not opened at all.**

⚠️ **The ordering of this file is not the ordering of importance.** R16 is first because it
was the assigned question; **R6 below is the finding most likely to cost someone a day**, because a
committed guard now argues against the owner's newest ruling in the owner's own name.

The scope line is at the top rather than at the end because **an earlier report from this role was
read as a complete audit and relayed to the owner before the gap was noticed.** A denominator that
travels beside the conclusions instead of inside them does not travel.

**Method: every claim below is read from source, named by file and line. Nothing was executed.**
Where a claim is structural (a function cannot know X because it is never given X), it says so —
that is stronger than a passing test, not weaker, and the distinction is the point.

---

## Ruling 16 — "the eligibility figures get the strongest protection: sex mix, one-to-one nursing

## capacity, age band"

### The finding, in one sentence

**The three figures the owner named have no staleness protection at all, and the figure he ranked
lowest in the same sentence has all of it.**

### What the model actually carries

`Unit.empty` and `Unit.allocatable` are `CapacityFigure` — `{ value, source, confirmedAt,
staleAfterMinutes }` (`ward-model.ts:331-335`, used at `:378` and `:380`).

⚠️ **Refinement, found after this section was first written and corrected here rather than
left standing.** Only **`allocatable`** is actually confirmable by a ward. `CONFIRM_CAPACITY` writes
it alone, and `empty.confirmedAt` moves only as a side effect of pulling, releasing or discharging a
bed — there is no ward-side event that confirms an empty count (`ward-screen.tsx:205-224`,
`:874-889`). **The screen is honest about this**: it passes `derived` to `WardFreshness` so a feed
timestamp is never rendered in the grammar of a human confirmation, after an earlier version showed
"Confirmed 07:26" for a figure nobody had confirmed. So the sentence below still holds — the bed
counts carry incomparably more protection than R16's three — but the count of genuinely
ward-confirmable figures in this model is **one**, not two. They additionally have an
eligibility gate that fails on staleness (`capacity_freshness`, `ward-eligibility.ts:92-93`, `:225`,
`:465`), a `WardFreshness` "Confirmed HH:MM" cell, and a refresh button.

Ruling 16's three are bare scalars:

| Figure             | Declaration                            | Runtime writers                    | Confirmation time |
| ------------------ | -------------------------------------- | ---------------------------------- | ----------------- |
| Sex mix            | `sexMix: Record<Sex, number>` (`:404`) | 2 (admission `+1`, departure `-1`) | none              |
| One-to-one nursing | `speciallingCapacity: number` (`:406`) | **0** — 24 writes, all fixture     | none              |
| Age band           | `cohort: Cohort` (`:348`)              | **0**                              | none              |

**So the protection is uniform across the three, and it is nil.** This is worth stating plainly
because the predicted failure shape was the opposite: a ruling about a set of three usually reaches
two of them. This one reached none of them, which is a different problem with a different fix.

### Why the inversion matters more than the absence

The owner's own justification ranks them: _"A wrong bed count wastes a phone call; a wrong sex-mix
figure puts someone in an unsafe place."_ **Today the phone call has a freshness gate and the unsafe
place does not.**

### 🔴 The one shipped contradiction — the specialling sentence claims headroom it cannot know

`ward-eligibility.ts:213-217`:

- gate: `pass: !movement.specialling || unit.speciallingCapacity > 0`
- detail: the authored capacity, rendered as the count of slots **available**

A ward authored for 2 with both slots in use passes this gate and reports two slots available. The
reducer then refuses the pull outright on `remainingSpeciallingCapacity(unit, admissions) <= 0`
(`ward-flow-reducer.ts:1345`).

⚠️ **This is structural, not a bug that might not reproduce.** `eligibility(movement, unit, now)`
takes no admissions list (`ward-eligibility.ts:102`), so the sentence it prints **cannot** reflect
remaining capacity under any input whatsoever. The reducer's own comment reaches the same conclusion
independently (`:1326`): the gate _"could say whether a ward had ANY capacity and never whether it
had any LEFT"_.

**It is the exact hazard the capacity screen names and avoids** — that screen prints words rather
than a number when specialling headroom is unknown, because a fabricated value would claim headroom
that does not exist, _"which is the direction that sends a patient to a ward that must refuse them"_
(`capacity-screen.tsx:549-552`). **The screen refuses to fabricate; the eligibility warning
fabricates.**

⚠️ **And the guard looks exactly where the defect is not.**
`tests/ward-screen-eligibility-warning.dom.test.tsx:106` pins the **zero** case, where the wording is
harmless. Nothing pins the authored-2-all-in-use case.

### One more fact about the same figure, flagged not audited

The **referral** arm of the same file does not check specialling at all:
`ward-eligibility.ts:460-462` is `pass: true`, with the detail _"Specialling need is not recorded on
a referral"_.

⚠️ **That sentence is truthful and the gate is honest** — it abstains rather than claiming, which is
the opposite failure from the ward arm above. But it means one-to-one nursing, a figure the owner
placed in his highest-protection set, **is not consulted on the referral path at all**, because
`Referral` has no field to consult. Whether that is a gap or a deliberate boundary is not decidable
from the code, and this pass does not decide it.

### A suspicion I withdraw, recorded because it was wrong for an instructive reason

I carried in an asymmetry: `capacity-screen.tsx` refuses a `?? 0` fallback on sex mix while
`ward-eligibility.ts` uses one at `:106` and `:347`. **It does not survive.** `Record<Sex, number>`
is total, and `RECEIVE_REFERRAL` membership-checks `sex` (the check at `ward-flow-reducer.ts:2472`; its reasoning at `:2411-2417`), so the
eligibility fallback is dead defensive code rather than a permissive path. The screen's refusal was
about a real bug **there** — a wrong key casing that rendered an all-zero sex mix across
twenty-three wards — not about a missing key being representable.

**Two files treating the same expression differently is not by itself an asymmetry in protection.**
The type decides that, and the type had to be opened to know.

### What "degrade to we do not know" runs into here

Absence is not representable for any of the three: the record type is total, and the other two are
non-optional. So a missing sex-mix figure **cannot** read as "no constraint" — it cannot exist.

⚠️ **That is the finding from its other side, not reassurance.** Because absence is unrepresentable,
_"we do not know"_ is **unsayable** for all three — which is what ruling 14 requires and what ruling
15's "show who last confirmed" needs a field to hold. Where the code **can** say it, it does: the
specialling headroom column prints words when the figure is undefined. **The conservative habit
exists and has nothing to hang on for these three.**

### Flagged, NOT audited — a ruling 15 consequence that surfaced on the way

`CONFIRM_CAPACITY` (`ward-flow-reducer.ts:1988-2003`) writes exactly one field: `allocatable`. Not
`empty`, not `sexMix`, not `speciallingCapacity`, not `cohort`. **Two of ruling 16's three figures
cannot be corrected from anywhere in the running application** — no event among the forty-eight
writes them. Ruling 15 asks that correcting a figure from the ward be trivial.

**This needs its own pass before anyone acts on it.** It is recorded here because it was measured
here, not because R15 has been examined.

---

## What this leaves for the owner, and what does not need him

**Needs a ruling:** closing R16 properly means giving sex mix, specialling capacity and age band a
confirmation time and a way for a ward to restate them. **That is a model change of the same size as
ruling 4's `pending` state, not a screen fix.**

**Does not need a ruling:** the specialling detail string at `ward-eligibility.ts:216` states a
number the function cannot know. Correcting it is a truthfulness fix within existing behaviour.

**Nothing in this pass was built.** The register above is a reading, and the remaining sixteen
rulings are unexamined by it.

---

## 🔴 Ruling 6 — the two added hold-up reasons are unbuilt, AND A GUARD ARGUES AGAINST THEM

**Ruling 6 adds two entries: _awaiting legal or Mental Health Act process_ and _awaiting
transport_.** `BED_RELEASE_WAITING_ON` (`ward-model.ts:1008-1014`) still holds **five**. Neither
addition exists.

That alone is ordinary unbuilt work. **This is not ordinary.**

`tests/ward-bed-availability-model.test.ts:40-48` pins the five members by exact value and exact
order, under a docblock reading _"Pinned to the EXACT members in the EXACT owner-approved order, not
to a length"_ and citing the 2026-08-28 decision. **It carries no note that the owner extended the
list on 2026-09-06.**

⚠️ **So the next person to build ruling 6 correctly meets a red test whose comment tells them,
in the owner's name, that these five are the approved list in the approved order.** The guard was
right when written and is now the single most likely thing to reverse a correct change. **A test
expectation is a ruling**, and this one is out of date while reading as authoritative.

**It must be re-pointed in the same commit that adds the two entries**, with its docblock recording
that the ruling changed — the treatment `ward-capacity-sexmix-release.dom.test.tsx` already got
when its own subject was ruled the other way. Re-pointed, never deleted.

## Ruling 8 — unbuilt, with nothing to build on

**Nothing anywhere records when a ward's next round is.** `Unit` has no schedule, day, weekday,
consultant or review field; two independent searches across the whole `ward-management` tree return
nothing. The ruling's point — that _"awaiting ward round"_ can mean Thursday rather than this
afternoon — has no field to become a date in.

## Ruling 9 — built

The coordinator capacity table leads with **Ready** (`capacity-screen.tsx:271`), which is the number
that can take a patient. **Empty is shown separately** on the ward's own screen, as _"Beds empty
right now"_ (`ward-screen.tsx:870-871`), not blended into the headline. Both halves of the ruling
are present.

## Ruling 13 — the flow is built, and two of its three answers go nowhere

_"Nurse in charge, at handover, under a minute"_ is built as a panel: **Confirm today's numbers**,
one-tap _"Confirm both bed counts — nothing has changed"_, and a running _"N of 3 confirmed
today"_ (`ward-screen.tsx:849-861`).

⚠️ **Of the three things it lets a nurse confirm, one writes to the model.** The panel's own
comment states it (`:205-224`): `allocatable` dispatches `CONFIRM_CAPACITY` and genuinely moves the
figure; **`empty` and `constraints` update a `useState` Set that resets on every mount.** The code is
candid about this rather than concealing it, and the chips were reworded so none of them claims a
fact about the day or the ward's history that session state cannot know.

### 🔴 And this is where rulings 13, 15 and 16 meet

**The third question is _"anything limiting intake"_, and the comment says plainly: there is no such
field on `Unit` at all.**

Sex mix, one-to-one nursing capacity and age band **are** what limits intake. So the handover panel
already asks the nurse in charge the exact question ruling 16 is about, once a day, in under a
minute — **and has nowhere to put the answer.**

⚠️ **That is the constructive finding of this whole pass.** Closing ruling 16 does not need a
new screen or a new habit: the screen exists, the habit is the one the owner said would actually
happen, and what is missing is a field and an event behind a question already on the page.

## Ruling 15 — partly built, and the good half shows what the missing half would cost

`allocatable` has the full treatment: a confirmation time, a `source` that distinguishes a feed from
a ward, a confirming role rendered as `NUM <ward>`, and a `WardFreshness` cell that refuses to render
a derived figure as a human confirmation. `empty` honestly abstains. **R16's three figures have no
`source` field at all**, so nothing could distinguish a ward's statement from a seeded value even if
a timestamp were added.

## A wording leak, small and worth one line

`ward-flow-reducer.ts:2293` rejects with _"cannot move release … from discharged to released"_.
**The third stage was ruled `discharged`, not `released`, on 2026-08-30.** The old word survives in a
rejection a coordinator can be shown. One word, two states.

## Ruling 1 — built

`BED_RELEASE_STATES` is `["expected", "confirmed", "discharged"]` (`ward-model.ts:984`), and
`RELEASE_BED` rejects only a release already `discharged` (`ward-flow-reducer.ts:2292-2293`). **A bed
can therefore go from `expected` straight to `discharged`**, which is exactly the optional middle
stage the owner asked for. Nothing forces a `confirmed` step.

---

## Ruling 12 — nothing has acted on it, which is the correct state

The ruling agreed a principle without naming the figure, and the record says _"Open — do not guess
which"_. **No commit deletes a figure citing it, and no figure has gone missing.** Checked because a
withdrawn question is exactly the shape somebody treats as an exemption; here nobody has.

⚠️ **This is a clean result from a search, not from a census.** I did not build the list of
figures with no reader that would let the owner answer the question. **That census is the useful
next piece of work on R12** — the mirror of the existing no-producer census — and it does not
need a ruling to start.

## Ruling 2 — the meaning is carried in the model, and the board does not overclaim

_"`confirmed` means the treating team has DECIDED. It does NOT mean it will definitely happen."_

The distinction is explicit in the code's own reasoning: `ward-board.tsx:635-637` records that an
unset `dischargeConfirmedAt` means **nobody has decided**, never that anybody decided against, and
the discharge board's grouping comment turns on a prediction versus a DECIDED one
(`discharge-board.tsx:313`). **Nothing found states or implies certainty.**

⚠️ **What the board does not do is gloss the word.** The group heading is the bare label
`"Confirmed"` (`discharge-board.tsx:33`). That is the owner's own word and is not wrong; whether a
coordinator reads it as _decided_ or as _certain_ is a question about a reader, and **this pass
cannot answer it from the source.** Recorded as a limit of the method, not as a defect.

## Ruling 5 — not separately checkable

The five reasons were confirmed as matching how a ward talks, and ruling 6 then extended the same
list. **The list's state is reported under R6 above**; there is nothing R5 asserts that R6's
evidence does not already cover.

## Observation, not a finding — ruling 3's second half

Ruling 3 has two halves: a confirmed discharge can still reverse, **and the board must show that.**

**The first half is built and correctly scoped.** `REVERT_BED_RELEASE` exists, and it is dispatched
from exactly one place — `ward-screen.tsx:606`, the ward's own screen — with an actor
allowlist restricting it to the ward role (`ward-flow-events.ts:1088`). A coordinator cannot reverse
a ward's discharge, which is right.

**The second half I could not confirm.** A targeted search for reversibility wording on the
discharge board and the ward board returned nothing. ⚠️ **That is a few phrasings not
matching, which is not the same as an absence** — the screens were not read end to end. **Do not
record R3 as unbuilt on the strength of this paragraph.** It is a pointer to where somebody should
look, and R3 was not in this pass's brief.
