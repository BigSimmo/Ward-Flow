---
name: one-word-two-states
description: "A single label covering two or three states that differ in what somebody must DO — found three times in one night on three Ward Flow screens, each time passing every gate"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 35aa4afb-7d69-48f1-8de8-4f0e0db6b535
  modified: 2026-09-03T18:57:35.743Z
---

**A label is not a name for a value. It is a claim about what the value MEANS, and nothing in a test
suite checks it.** Three instances on three screens in one night, each one green everywhere.

| Screen     | One word        | The states it covered                                                                                                                                                                        |
| ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statistics | **"wait"**      | ward _accepting-to-bed-ready_, community _referral-to-first-contact_ (no bed involved), ED _time held awaiting an inpatient bed_ — **and a single median was computed across all three**     |
| ED home    | **"2 of N"**    | one tile counted **departments**, the tile beside it counted **patients**, in a strip where the other four counted people                                                                    |
| Transport  | **"cancelled"** | an `unwinds` entry `transport_cancelled` = job cancelled and **REPLACED, patient still going**; `TransportJob.cancelledAt` = **patient did not proceed** — ⚠️ **and the screen summed them** |

⚠️ **THE TRANSPORT ONE IS THE CLEAREST HARM: it tells a coordinator that a patient still on their way
has stopped, or that one who is staying is still coming.** Either error sends somebody to the wrong
place, or sends nobody at all.

## Why no gate catches any of them

**Every value is correct.** The counts are right, the timestamps are right, the types check. **Only the
noun is wrong**, and a test asserting `getByText("cancelled")` passes on both meanings. **Three of
these were found by reading the screen and asking what each number was of — never by a failing test.**

## How to find them

- **For every figure, ask "of what?" and "measured from when to when?"** If two figures on one screen
  answer differently and wear the same word, that is the defect.
- ⚠️ **Watch for two states stored in DIFFERENT PLACES that share a display name.** `CANCEL_TRANSPORT`
  writes to `movement.unwinds`; `RECORD_EXAMINATION` writes `cancelledAt`. **Two writers, two meanings,
  one word — and nothing in either file mentions the other.**
- **A subset figure must share its denominator's population.** _14 of 34_ is fine; _2 of 8 departments_
  beside _2 of 9 patients_ is not.

## How to fix it so it cannot come back

**Correcting the words is not enough — words get rewritten.** Make the meaning a typed property and
**derive every rendering from it**:

1. A constant mapping each state key to its sentence.
2. Every figure carries the key; **the label, the axis caption AND the hover text all read that one
   entry**, so ⚠️ **a tooltip cannot disagree with its tile**.
3. Any component computing a comparison or an average **throws** when the set spans more than one key —
   the house pattern already proven by `WardFigureStrip`'s at-most-two-flagged rule.
4. 🔴 **A throw only protects figures that go through the component.** Both superlatives found on the
   statistics screen were **hand-written, in hover text and a headline tile**. So add a static scan
   asserting the superlative words appear in exactly one file — **and prove the scan reads `title`
   attributes, not only visible JSX, or it passes while missing the exact case it exists for.**

## And the disclosure rule that goes with it

**When the data cannot distinguish two states, say what IS recorded — never the friendlier guess.**
Ward Flow's transport screen cannot tell "transport not needed" from "not booked yet": the _need_ is on
the Referral, the _job_ is on the Movement, and the join is written only for ED-destined referrals.
**"No transport recorded" is true in both cases. "No transport needed" asserts something nobody
recorded.**

Related: [[fields-with-no-producer]], [[measure-the-thing-not-a-proxy]],
[[never-produce-a-figure-while-writing]].
