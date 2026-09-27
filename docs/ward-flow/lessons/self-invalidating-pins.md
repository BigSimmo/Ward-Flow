---
name: self-invalidating-pins
description: Record a finding together with the thing that will fail when it stops being true, or it becomes folklore
metadata:
  type: feedback
---

Every check that failed us on Ward Flow (2026-08-30) was a claim with nothing attached that could
refute it: a field-set allowlist inspecting an arm no fixture produced, two tests asserting the leak
they should have caught, three model fields nothing could write, a comment naming a note that had
been deleted. **None of them could fail. All of them read as passes.**

The shape that works is a finding recorded _with_ the thing that will contradict it:

- Ward Referrals pinned an intake note ("the suburb is not recorded") to the model fact that made it
  true, so the day the field landed the test sent whoever widened the model to the sentence that had
  just become a lie.
- A test that asserts a known defect is **present**, with the removal steps in its own body, worded
  so it cannot stay green afterwards. The debt cannot be forgotten or quietly inherited.
- `ward-referral-producers.test.ts` reads the model's own field names and requires each to have a
  producer — it generalises past one finding to the whole class, so nobody has to remember.

**Why:** the cost is one red test at the moment the claim expires, arriving with a message saying
which claim and why. The alternative is a comment that decays silently and a screen that looks
correct because the absent branch is a legitimate state.

**How to apply:** when you write a finding, a repair note or an allowlist exemption, ask what would
fail if it stopped being true. If nothing would, attach something. An exemption list needs its own
staleness guard, or the first defect returns wearing the exemption. ⚠️ **Boundary distinction (test scanner
exemption vs ledger allowlist):** Never add a silent test scanner exemption to make a checker green
([[wrong-on-purpose-and-load-bearing]]). A test pin or ledger allowlist is acceptable only when it is
self-invalidating and goes red when the condition expires. Related: [[comments-that-recruit]],
[[checks-that-cannot-fail]], [[observations-expire]], [[the-suite-never-tests-the-absence]].

---

## ⚠️ A DOCUMENT THAT CONTAINS ITS OWN STALENESS WARNING STILL SHIPS STALE

**Added 2026-09-12, measured on my own handover.** Its §12 predicted the exact failure —
_"Ward Lead reported wiring the two orphan gates AFTER my extraction ran. The §4 table may already
be one row out of date."_ 🔴 **The §5 "still open" list then carried two closed rows anyway.**

**Why the warning did not work:** the warning and the figures are written **at different moments and
in different sections**, and only the figures get quoted. A reader lifts the row, never the caveat
three sections away. The author does not re-run the measurement between writing the caveat and
writing the list, because writing the caveat _feels_ like having handled it.

🔴 **One of the two stale rows — "`cc9b45f17c` is still unfolded" — was false against MY OWN HEAD,
settleable by `git merge-base --is-ancestor cc9b45f17c HEAD`.** It had been true when first written,
was carried forward through three handovers, and nobody re-derived it because it was already in a
document. See [[a-status-claim-about-someone-else-expires]] and [[observations-expire]].

**How to apply:** a caveat is not a control. **Re-derive every figure in the same pass that writes
the list it appears in** — not when the caveat was written. If a row cannot be re-derived in that
pass, it does not go in the list; it goes in a "not re-checked" block that carries its own date.
Better still, put the command beside the claim so the reader can settle it in one line
([[carry-the-antidote-with-the-assertion]]).
