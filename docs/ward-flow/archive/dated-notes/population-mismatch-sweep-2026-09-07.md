# Population-mismatch sweep — ward screens outside statistics

**2026-09-07. Handed over, not acted on.** Fourteen findings from one read-only Opus sweep.

---

## ⚠️ READ THIS BEFORE ACTING ON ANY ROW

**I have verified NONE of these myself.** They are one agent's report. Tonight this exact
distinction cost four sessions several hours: a subagent's summary of a test failure was relayed
onward, two mechanisms and an escalation were built on top of it, and **nobody had opened the actual
output**. When the log was finally read, it disproved the explanation everyone had agreed on.

**A subagent's summary is a claim about output, not the output.**

So: **confirm each finding at source before changing anything.** The sweep was briefed to cite by
content rather than line number, to name the seed record or reducer path that makes a finding
reachable, and to say plainly when something is latent. It did all three, which makes each row
checkable — but checkable is not checked.

---

## Why this is a programme and not a task

The eight statistics findings closed today were all one shape: **a fluent sentence naming a narrower
or wider population than the number beside it.** Invisible to every gate — not a wrong number, not a
type error, not an unresolved token — so lint, `tsc` and the whole suite were green before and after
each fix.

This sweep points the same instrument at every ward screen _outside_ statistics and returns fourteen.
That is a body of work with its own shape, not a tail to tonight's.

### The cross-cutting observation, which is the most useful thing in the report

**Findings 1, 2, 5 and 10 are all cases where the correct derivation ALREADY EXISTS in this
codebase, with a comment explaining the exact harm, and a second screen calls the wrong one.**

    openBedsNow                    vs  availableNow
    blockingGate                   vs  candidateReason
    remainingSpeciallingCapacity   vs  unit.speciallingCapacity

⚠️ **The repair is a call-site change, not new logic — but the SENTENCE has to change with it**,
because in every case the sentence asserts the property the wrong function does not have.

**This is the same class Ward Builder Four named today** (two derivations of one population, agreeing
by accident of the seed) and the same class as the four separate implementations of
`min(allocatable, empty)` — see `tests/ward-ready-has-one-arithmetic.test.ts`. Three sessions found
it independently within hours, in three different areas. **Someone understood the risk each time,
wrote it down, and the writing did not travel.**

---

## The fourteen, as reported

Ranked by the agent's assessment of clinical consequence. **Direction** is which way the error runs.

### Reachable in today's seed

| #   | Screen                                              | The claim                                                          | Why reported false                                                                                                                                                                                                   | Direction                                                              |
| --- | --------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `ward/ward-screen.tsx`                              | Ready is "always one you can fill this minute"                     | ✅ **VERIFIED, AND NARROWER THAN FIRST REPORTED — see the correction below.** The word `always` is false whenever any bed is pending; the pull is NOT refused on this ward today. Seed `WR-008` on `arm-adult-open`. | Overstates fillable beds — 2 Ready, 1 actually fillable                |
| 2   | `flow-diagram.tsx`, `ward-management-network.tsx`   | "for each one that cannot take this person, the single reason why" | Shows the FIRST failing gate; `allocatable_bed` is last and is the one gate no reason overrides. `blockingGate` exists to fix this and is used on only one screen.                                                   | **Makes a dead end look purchasable with a recorded reason**           |
| 4   | `delays-screen.tsx`, `ed-home.tsx`, `ed-screen.tsx` | "patients physically present in an emergency department"           | Population is `!closure && stage !== "arrived"`, which admits `handover_ready` and `moving` — _"a vehicle has collected the patient"_. Clocks keep running, inflating the danger band. Seeded `WF-005`, `WF-006`.    | Overstates department pressure and wait length                         |
| 6   | `ward/ward-screen.tsx`                              | "Held … is not a bed pulled for a named patient"                   | `PULL_PATIENT` decrements `allocatable` and leaves `empty`, so every pull raises `held` by one.                                                                                                                      | Understates commitment — a ward thinks it can offer a bed that is gone |
| 11  | `board/ward-board.tsx`                              | _(a missing sentence, mirror of 1)_                                | `derivedBedReleases` hard-codes `preparing: false`, so the "still being made ready" branch is unreachable and the board prints a bare "2 ready beds" where two other screens say one is being cleaned.               | Same ward, same instant, three screens, one silent                     |
| 13  | `delays-screen.tsx`                                 | "Every delay recorded today belongs to somebody"                   | The model cannot represent an unattached delay at all, so the panel can never be non-empty. Reads as a completed scan returning zero.                                                                                | Reassuring rather than actionable — a fabricated zero                  |

### Reachable at runtime, not in the seed

| #   | Screen                 | The claim                                                                                 | Why reported false                                                                                                                                                                                               | Direction                                                                        |
| --- | ---------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 3   | `handover-page.tsx`    | "declined by every unit it was referred to"                                               | `referredUnitIds` holds only OPEN referrals; `ACCEPT_IN_PRINCIPLE` empties it. **A patient who HAS a bed can appear under "Placement gone wrong".**                                                              | Makes placement look worse than it is                                            |
| 5   | `movements-screen.tsx` | "no transport leg booked yet … nothing to say about a vehicle that has not been arranged" | `BOOK_TRANSPORT` writes no timestamps, so a just-booked job lands here; `CANCEL_TRANSPORT` replaces the job with a fresh untimestamped one, so does a cancelled one.                                             | Understates arranged transport, immediately after the coordinator arranges it    |
| 7   | `capacity-screen.tsx`  | "expected to free up after today, deliberately not counted in any figure above"           | Day **inequality** catches past days too, and past-dated releases **are** counted above.                                                                                                                         | Moves overdue discharges — the ones most needing chasing — into a "later" bucket |
| 8   | `shortlist-panel.tsx`  | "Every ward in the network"; and "No eligible destination is currently available"         | The list is the offerable subset; and the escalation prompt gates on `verdict.eligible` where `needsNoRecordedReason` is the correct test.                                                                       | **Invites escalation while ordinary referral is still open**                     |
| 10  | `ward-board.tsx`       | "Only N can be watched one-to-one"                                                        | Uses the ward's AUTHORED specialling capacity, never subtracting beds already staffed that way. `remainingSpeciallingCapacity` is what the reducer refuses on.                                                   | Overstates headroom — sends a specialling patient to a ward that must refuse     |
| 9   | `officer-screen.tsx`   | "every job on record has arrived"                                                         | The list also empties when a movement CLOSES. A journey that ended without arriving — seeded reason _"self-discharged from ED before transport was arranged"_ — is reported as an arrival.                       | Asserts completion                                                               |
| 12  | `discharge-board.tsx`  | "excluded — expected beyond tonight"                                                      | Since the `tomorrow` band was added this means `daysAhead >= 2`; a release expected tomorrow morning is beyond tonight and is **not** excluded.                                                                  | Stale label after a band was inserted                                            |
| 14  | `morning-page.tsx`     | "People waiting for a bed"                                                                | Counts every queued referral, including one whose only destination is an ED for **psychiatric review** — an opinion, not a bed. ⚠️ **Dead screen** (route redirects), but the label and derivation are exported. | Would carry the defect to any screen picking them up                             |

---

## ✅ Finding 1 — verified at source, and the severity corrected DOWNWARD

**2026-09-07, by Ward Builder Four, checked independently by me.** This is the first row anybody
confirmed, and confirming it moved it.

**What holds.** The contradiction is real and live. On `arm-adult-open` these render together:

    ward-screen.tsx:1292   "…cannot admit into it yet"
    ward-screen.tsx:1298   "…so this figure is always one you can fill this minute"

🔴 **What does NOT hold, and I stated it wider than the evidence.** The original row said "the
reducer refuses the pull", and I repeated that to the owner as _"on the screen where pressing Pull
will refuse"_. **It does not refuse.** Measured:

    arm-adult-open      empty 3, allocatable 2  ->  Ready = min(2,3) = 2
    WR-008              preparing: true          ->  pending = 1
    openBedsNow         max(0, 2 - 1) = 1
    ward-flow-reducer.ts:1495   refuses only when `pending > 0 && openBedsNow <= 0`

`openBedsNow` is 1, not 0, so **a pull on that ward succeeds today.** The reducer refuses only when
EVERY free bed is pending; one of two is not every.

**The true defect is the word `always`.** "Always one you can fill this minute" is false whenever
`pendingPreparation > 0` — live on that ward, where 2 are Ready and only 1 is fillable now. Still an
overstatement of fillable beds in the dangerous direction, to a reader about to press Pull. **It is
not "the pull will be refused", which is what the original wording invites.**

⚠️ **Why this correction is worth more than the finding.** A report that overstates its own
consequence gets discounted wholesale the moment somebody checks it — and the narrower version is
the one that survives review. **Treat every remaining row as carrying the same risk:** the sweep's
reasoning was sound here and its consequence sentence was not, which is precisely why the header
says confirm at source before acting.

---

## Screens the sweep checked and found CLEAN

Recorded so an unexamined screen and a clean one do not look the same:

`out-of-area-board` (both sentences exact against `outOfAreaLedger`) · `escalation-board` ·
`hub-screen` + `hub-derivations` · `tracker-derivations` · `ward-index` · `patient-search` ·
`record-preview` · `person-screen` · `add-patient` · `referral-board` · `ward-standing-strip` ·
`pressure-strip` · `priority-queue` · `exception-drawer`.

One residual noted on `ward-management-console.tsx`: the destination lede _"Every ward that was asked
has answered"_ ignores `withdrawnReferrals` — same root cause as finding 3, latent in the seed.

---

## Suggested order, if this is picked up

1. **Findings 1, 2 and 4 first.** All three are live in the seed and all three point a coordinator
   at a wrong action — filling a bed that cannot be filled, recording an override that will be
   refused, sending help to a department that has already handed over.
2. **Then the call-site family (1, 2, 5, 10) together**, because they share a repair shape and a
   single guard could cover all four: _a screen may not re-derive what a helper already computes._
3. **Then the rest**, which are latent or lower-consequence.

⚠️ **Findings 1, 6 and 11 all concern `ward/ward-screen.tsx` and `board/ward-board.tsx`, which
belong to Ward Builder Four**, who has asked for the raw rows and said they would rather have a
wrong finding than a missed one. Send them unfiltered.
