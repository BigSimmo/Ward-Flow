---
name: a-correct-diagnosis-that-stops-the-inquiry
description: A true explanation for noise can hide a real defect underneath it; and a retraction is a claim needing the same evidence as an assertion
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2a7fcecc-a0db-4c8c-aa17-566081b0898b
  modified: 2026-09-06T00:04:04.431Z
---

Two failures found on 2026-08-30 measuring formatting drift, both of which felt like rigour.

**A correct diagnosis can terminate the inquiry.** `prettier` reported eight ward files as
changed. Three showed the `1,143c1,143` signature — every line differs — which really does mean
CRLF-versus-LF and not formatting. I classified all three as noise and stopped. One of them,
`tests/ward-data-checker.test.ts`, had 29 lines of genuine drift underneath the line-ending
noise. **A file can be both.** The rule was true; being true is what made it a stopping rule.

**A withdrawal is a claim and needs the same evidence as an assertion.** The count 1175 was
retracted by one session, the retraction endorsed by a second, and I nearly relayed it to the
owner as a correction. Nobody re-measured before striking it. It was struck for being
unverified — which is an argument for measuring it, never an argument for believing its
opposite. Retraction wears the costume of care, so it clears scrutiny an assertion would not.

**Why:** both are cases where the shape of the move signals safety, and the shape is exactly
what is wrong. Same family as an unexpected number in a red assertion being a second defect.

**A third one, same hour, and it took two of us.** I reported a CR count of 597/663/143 on
three extracted blobs. The peer explained it — a shell redirect converting on write — and
derived a rule: "if CR equals the line count exactly, the extraction converted." Persuasive,
mechanical, free. The number was never real; a byte-level re-measure found zero CR. And
CR == line count is not the signature of conversion, it is the signature of **a count that
returns the line count whatever the file contains** — a check that cannot fail, promoted to a
diagnostic, on the day we were both cataloguing that class. Neither of us could have built it
alone: I supplied a number nobody re-took, the peer supplied a mechanism nobody checked, and
each treated the other's half as the verified one. That is a failure mode of two careful
people, not of one careless one.

**A fourth, 2026-09-06, and the framing that finally makes it checkable: A TRUE CAUSE THAT ARRIVES
FIRST CLOSES THE SEARCH FOR THE TRUER ONE.** I told Ward Lead a test batch had dropped five files
because of `fork: Resource temporarily unavailable`. Real, in the output, sufficient. The same file
also held four `FATAL ERROR: … out of memory` lines I never looked for. **Plausibility is what ends
a search, not sufficiency** — and if anyone had tuned fork limits on my report they would have fixed
the wrong thing.

⚠️ **THE TELL, and it is the operational half this note lacked for three instances: the first cause
explained the symptom without explaining its SCALE.** Fork exhaustion drops a process; it does not
obviously drop five files out of forty-seven. When the magnitude does not follow from the mechanism,
there is a second mechanism. **And I found it only because a peer's warning about something else
made me re-read my own output** — which is the third time in one night a defect in my work was found
while I was checking somebody else's, and none of the three by the person looking for it.

**How to apply:** when a signature explains noise, measure underneath it anyway — extract the
committed blob and re-run, rather than reading the working copy. When someone retracts a
finding, ask what they measured; if the answer is "nothing, it was unverified", the finding
stands until someone measures it. Before trusting any zero, **build a control that must be
non-zero and prove the instrument detects it** — "I got zero" and "zero means zero here" are
different claims, and the control is cheap. And when a peer explains your number, remember
they are explaining your number: re-take it before they build on it.

Related: [[measure-the-thing-not-a-proxy]], [[check-the-conclusion-that-flatters-the-theme]],
[[read-the-failure-message]], [[assert-only-about-code-you-opened]].

⚠️ **AND THE SAME NIGHT, THE SAME CLASS FROM THE OTHER SIDE — Ward Verifier's, recorded here because
it is the same mechanism and this file is where it belongs.** Its wrapper reported **exit 0** on a
run that had died with a heap OOM. "It finished" explained the exit code without explaining why the
summary lines were missing — the scale test again, in a different currency.

(Two sessions independently appended this fourth instance to this file within an hour of each other,
from opposite sides of the same event. Merged into one account rather than left as two, which is the
duplication this store is supposed to avoid.)

---

## 🔴 2026-09-07: THE EXPLANATION THAT ARRIVES ALREADY FITTING IS THE ONE TO CHECK HARDEST

`npm run verify:phone-chrome` failed on one spec: `data-phone-scroll-owner` read **"pending"**
instead of "document". Within a minute I had a complete, correct-sounding account:

- `"pending"` **is** that hook's initial `useState` value, before its `requestAnimationFrame`
  effect resolves. Verified by reading the source.
- The machine was running **four heavy jobs** at the time — a dev server, a full vitest population,
  a browser pane, and the gate itself.
- So: a dropped frame under load. **Right hook, right initial state, right conditions.**

**Every part of that was true and the conclusion was wrong.** Re-run on a quiet machine, it
reproduced. 2 for 2. **A failure that survives the quiet run never needed load at all — the load
merely supplied a ready-made excuse to dismiss it.**

### The tell

⚠️ **The explanation fitted on first contact, and fitting is what stops you looking.** A cause that
requires work to construct gets tested; a cause that arrives pre-assembled gets adopted. **The
smoother the fit, the more it deserves the control run.**

### The asymmetry that decides whether to re-run

```
quiet run GREEN   consistent with a flake AND with a real defect that needs load  → evidence, not proof
quiet run RED     the load hypothesis is dead outright                            → proof
```

**So the re-run is worth it in only one direction — but that direction is the expensive one to miss.**
(Ward Builder Four supplied the green branch; the red branch is what actually happened.)

### The same shape, twice in one hour, smaller

I found `TMPDIR` was empty and published that my log reads had "measured nothing". **`TMPDIR` being
empty was TRUE and explained a different symptom** — the logs existed, at `/` instead of the
scratchpad, and every earlier read was sound. **I corrected a sound measurement into an unsound one
and had to correct the correction.** Ward Builder Four did the identical thing with a true CSS
precedence rule applied one step too widely, overturning three findings of which two were fine.

**Before publishing a cause: does it explain THIS symptom, or merely a symptom of this shape?**

Related: [[a-clean-negative-that-measured-nothing]], [[read-the-failure-message]],
[[a-fix-that-states-a-falsehood-more-confidently]], [[observations-expire]].
