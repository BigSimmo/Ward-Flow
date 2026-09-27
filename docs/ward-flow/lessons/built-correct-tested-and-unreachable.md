---
name: built-correct-tested-and-unreachable
description: "A control that is built, correct, fully tested and has no production caller — two P1 clinical safeguards in this repo are in that state, and every green test looks identical to a working one"
metadata:
  node_type: memory
  type: reference
  originSessionId: c186bff2-76e5-4e1f-b211-8b26b7fbdcab
  modified: 2026-09-10T17:44:36.175Z
---

Two P1 clinical safeguards in this repository are **built, correct, fully tested, and never called**:

    #B16HW8            Caring Contacts message-content controls — validateGovernedMessage
                       has no production caller
    genderEligibility  Ward Flow, 2026-09-11 — the owner's ruling that gender decides the bed.
                       ELIGIBILITY_GATES has no "gender" member; placement runs on recorded sex.

**Why it survives:** the tests call the function **directly**, they pass, and nothing anywhere asks
whether production does. So the suite is green, the model is right, the review approves — and the
safeguard does nothing. **"Built, correct, fully tested" and "in force" are different states**, and
only a reader who checks the call sites can tell them apart.

**Related but not the same as [[fields-with-no-producer]]**: that is a value nothing can _write_;
this is a decision nothing _asks for_. Mirror images, failing identically — green everywhere.

## The trap when you find one

🔴 **A deliberate absence and an oversight are the same shape in a grep.** Ward Flow's gender gate is
uncalled **on purpose**: wiring it would have forced fabricating a gender for every movement nobody
recorded one for, or newly failing most of the seeded fixture. The refusal was correct. **A lane that
found the uncalled export inferred neglect and was wrong** — which is why the argument has to live in
a decision record a grep will not lose, not only in the code.

**So: check for a caller before trusting a safeguard, and check for a written argument before
"fixing" one that has none.** Both halves. See [[the-suite-never-tests-the-absence]],
[[a-working-safeguard-leaves-no-trace]], [[compliance-without-coverage]].
