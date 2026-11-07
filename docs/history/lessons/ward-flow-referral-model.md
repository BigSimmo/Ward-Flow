---
name: ward-flow-referral-model
description: "How a patient enters Ward Flow: one referral act raised from two places; and SUPERSEDED 2026-08-30 — every referral IS declinable, the ED notification included, so purpose is what distinguishes them"
metadata:
  node_type: memory
  type: project
  originSessionId: 2b6afefc-3c5d-42e8-9a09-d310ecde7e2f
  modified: 2026-09-03T16:25:16.593Z
---

**Owner's corrections, 2026-08-29**, both replacing a design I had built that was more complicated
and wrong.

**1. An "ED referral" means a psychiatric doctor seeing a patient IN the emergency department.** Not
a department referring outward as a separate front door. Owner: _"which is most common."_ So there
are not four referral types. There is **one act — this person needs to go somewhere — raised from
two places**: a community clinician who has decided someone needs admission, and a psychiatric
doctor who has just assessed someone in an ED.

**2. A referral to an ED lands on that ED's patient board, and the referrer can see their patient
there.** The ED then decides whether to refer onward. Owner: _"referrers will be able to see the
current patient if they have been referred to ED."_ They get their patient, visible, on the board
of the place they sent them to.

## ⚠️ THE PART THIS FILE GOT WRONG — SUPERSEDED BY FD-18, 2026-08-30

This memory used to say _"a referral to an ED is a notification nobody declines"_ and that an
ED-destined referral _"carries no acceptance affordance"_. **That is false and has been since
2026-08-30.** Verified in source, not recalled — `src/components/ward-management/ward-referrals.ts`
around line 165 states the FD-18 correction explicitly:

> the three ED flows are no longer told apart by what they forbid — **every referral is declinable,
> the ward's medical notification included** — so the only thing distinguishing them is **what the
> row is FOR**

So **declinability distinguishes nothing.** The `purpose` axis does, and that file calls showing it
_"a safety rule rather than a presentational preference"_: a declinable row with no stated purpose
is indistinguishable from a bed request, which is the conflation the axis exists to prevent.

**What this cost, on 2026-09-04.** I designed a referral screen carrying the line _"A notification,
not a bed request — nobody declines it"_, straight from this memory. A verifier caught it against
source. It would have promised a clinician that a referral cannot come back declined, when it can.

**The lesson is about memory, not referrals.** A stored fact reflects what was true when written,
and this one was contradicted in the repository four days later while still reading as settled.
Anything from this file that constrains a clinical claim gets re-checked against
`ward-referrals.ts` before it reaches a screen. See [[observations-expire]] and
[[assert-only-about-code-you-opened]].

Related: [[ward-flow-coordinator-overrides-everything]], [[ward-flow-changeable-data-rule]].
