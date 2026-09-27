---
name: adversarial-claims-review
description: "Run an adversarial read of CLAIMS (not code) at the end of a large body of work — three independent runs on 2026-09-12 each found ~6 false claims and ZERO code defects, with every gate green throughout"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c9651754-35b0-4582-8471-bb68a3aa6533
  modified: 2026-09-12T08:22:21.158Z
---

**Owner-approved standing practice, 2026-09-12:** _"Yes I agree to the adversarial review
recommendation… however ensure you avoid excessive review churn… primarily just run it at the end of
a large task or amount of work or as you recommend."_

**Run it before a fold, never per commit** — he named the failure mode himself. Opus, adversarial,
read-only. The veto: the output IS a judgement, and it is the last look before work nobody re-reads.

**Why:** every gate in this repository reads what code DOES. Nothing reads what it SAYS. Three
independent runs the same day — mine over four commits, Lane C's over nine, Ward Verifier's over one
repair — each found **about six false claims and zero code defects**, with every automated check
green throughout.

**The brief that produces this:** _find what is WRONG, and for every assertion name the mutation that
would redden it; if you cannot name one, say so._ Aim it at claims, not code.

## The shapes it finds, all of which I shipped

- **A comment claiming coverage that does not exist** — "the count is already pinned by X". It was
  pinned nowhere. Worse than no comment: it is the reason nobody goes looking.
- **A quotation from a document that document does not contain** — I read a measurement of the APP,
  under a heading saying so, as a quotation of the DRAWING.
- **A claim scoped wider than measured** — "two dead screens" was two of THIRTEEN.
- **A test that proves less than its comment says** — on the seed, the new helper returned the same
  string as the code it replaced, so reverting production kept it green.
- **Fixing the instances a report NAMES and calling that the set.** Do the report's CATEGORIES
  against the whole tree, not its EXAMPLES.

## The paired diagnosis, which is the durable half

- **Generalising from what you were SHOWN** — fix the instance, report it as the set.
- **Completing from what you did NOT look at** — a slice treated as the file.

Same defect, opposite axes. Both produce a TRUE statement at the WRONG WIDTH; both survive every
gate. **Nobody found their own without somebody else.**

**And a finding is a claim** — it inherits every failure mode a claim has, while arriving carrying the
authority of having been found. Verify a correction handed to you, including one against yourself.

See [[hand-picked-test-subsets-ship-red]], [[a-measurement-is-scoped-to-what-it-measured]],
[[writing-the-defect-down-collides-with-the-check]], [[a-status-claim-about-someone-else-expires]].
