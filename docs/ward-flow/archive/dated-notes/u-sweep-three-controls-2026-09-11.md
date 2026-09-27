# The §U sweep, re-run with one control per state — and a pre-registered prediction

**Ward Verifier, 2026-09-11.** Ward Lead's two additions, both adopted: **pre-register the expected
shape before reading a number**, and **a three-state sweep needs three controls.**

Its challenge was exact and correct: **"you reported 0 DISAGREE and nothing proved the probe could
ever return one. A zero from an arm with no control is not a measurement."**

## 1 · The prediction, written before the run

    AGREE       MOST. Reason: the documented idiom — a disabled control carries an
                sr-only reason AND a title tooltip with the same sentence; 14 such
                pairs measured across 4 routes.
    ONE SILENT  EXACTLY 1 — the Activity button. The only candidate that survived
                the idiom refinement.
    DISAGREE    0 — but UNINFORMATIVE until the synthetic control passes. If the
                control fails, the arm is reported UNMEASURED, never zero.

    FALSIFIERS: AGREE 0 again ⇒ the probe is wrong, not the codebase.
                ONE SILENT > 1 ⇒ something new; inspect every one.
                synthetic DISAGREE undetected ⇒ the DISAGREE result is void.

## 2 · The three controls — all three pass

    ONE-SILENT  ", reconciliation not available"          -> ONE-SILENT   PASS
    AGREE       "WF-003 was already examined."            -> AGREE        PASS
    DISAGREE    synthetic, injected then removed          -> DISAGREE     PASS
    synthetic cleanly removed afterwards: true

**The DISAGREE control is synthetic by necessity — the codebase contains no true disagreement, which
is the very thing under test.** A pair was injected into the live DOM at runtime:

    <p>Two beds are available on this ward</p>
    <span class="sr-only">No beds are available on this ward</span>

**classified DISAGREE, then removed, and its removal confirmed by re-running the classifier.** No
source file was touched.

🔴 **So the zero below is now a MEASURED zero.** Previously it was a number from an arm that had
never been shown able to produce anything else.

## 3 · The result

    routes 36 declared · 36 measured · 0 errors
    distinct absence carriers   15
      AGREE        13
      DISAGREE      0        <- now measured, not assumed
      ONE-SILENT    2
      RECONCILE    15 = 15

**AGREE went from 0 to 13** — the run-2 figure that was implausible on its face is now the predicted
shape. ✅ **The prediction held for two arms of three, which is the point of writing it down.**

## 4 · 🔴 THE FALSIFIER FIRED — ONE-SILENT came back 2, not the predicted 1

**And that is the pre-registration working.** I had committed in advance to inspecting every one.

**The second is `ward-console-confirm-unavailable`, and it is a FALSE POSITIVE I had already run to
ground by hand** in the previous pass: the visible panel beside it reads _"Confirm a destination —
Not built yet. Which record a confirmation writes, and in whose name, is a decision the owner still
holds — so this control is deliberately inert and says so rather than being hidden."_

⚠️ **The automatic classifier still cannot see that, for the two independent reasons Ward Lead
identified:** the `title` wording differs from the `sr-only` wording, **and** the span is a **sibling
referenced by `aria-describedby`**, so a host-based check finds nothing.

> 🔴 **Two independent causes of one miss is the shape that defeats a fix — repair either alone and
> the element is still missed, and the repair looks correct.**

**So the true one-silent count is ONE, and the classifier's figure is TWO. The difference is a known
limit of the instrument, not a finding.** **Reported as the classifier's number with the correction
attached, rather than silently corrected — the raw figure is what another run will reproduce.**

## 5 · What is still not covered

**Unchanged from the first sweep and still binding:** default render only — **a refusal that appears
only after an action was not exercised**; one viewport; nothing about what a screen reader announces.
**~340 absence strings exist across ~75 files; this run classified 15 distinct carriers.** **The gap
is unwalked, not passed.**
