---
name: half-a-fix-can-be-worse-than-none
description: "Two survivable defects can become fatal when one is repaired; fixing the text colour while the background stayed dark printed black on black"
metadata:
  type: feedback
---

Ward Flow print defect, 2026-09-04. Dark mode is a class on `<html>` that survives printing, so
themed tokens keep their dark values on paper. Two consequences, each survivable alone:

    text    color: var(--text)          near-white   -> invisible on white paper
    surface background: var(--surface)  near-black   -> a big black rectangle, wasteful

I fixed the text: `color: CanvasText !important`. Verified in Chromium. Committed. Measured
afterwards, in the same engine:

    card background  rgb(23, 26, 29)   still dark — nothing resets backgrounds
    card text        rgb(0, 0, 0)      forced black by my fix
    => BLACK ON DARK, invisible

**Before the fix, that text was near-white on a dark card: ugly, wasteful, READABLE. After it,
gone.** The two defects were compensating. Repairing one removed the compensation.

⚠️ **Neither half is wrong. The combination is.** No review of the fix in isolation catches it,
because the fix is correct; and no review of the background in isolation catches it, because the
background was survivable until the moment the text changed.

**And the verification could not see it.** I checked text colour, on a white page, because text
colour was what I had fixed. **The property I changed and the property that broke were different
properties** — so a thorough check of my own change was guaranteed to pass.

**How to apply:** when fixing one half of a rendering pair (colour/background, size/overflow,
z-index/position), ask what the OTHER half is doing right now, and whether the broken state was
survivable only because of it. Then measure the PAIR in the engine, not the property you touched.
Look for compensating defects before declaring a partial fix safe.

Corollary that saved information here: use `background-color`, never the `background` shorthand.
The shorthand wipes `background-image`, and the blocked/held/past bed states are hatch patterns —
a state distinction, not decoration.

Related: [[a-blanket-fix-is-not-blanket]], [[tests-that-assert-rendering-not-truth]],
[[a-property-set-on-the-element-itself]], [[a-fix-that-states-a-falsehood-more-confidently]].

## 2026-09-07 — REAL MITIGATION AIMED AT THE WRONG CLAIM, and the twin that was missed

Two shapes from one night, both in code whose comments were unusually good.

**1. A mitigation that is genuine and defends the wrong thing.** The ward home rendered
`Confirmed 09:12` against a bed somebody had merely FLAGGED as expected. A reviewer said nothing on
screen explained it. That was unfair — a note directly beneath said _"that stamp is the bed flagged
most recently — not a statement that this list is complete."_ **The note is real mitigation. It
disclaims COMPLETENESS. The false claim was CONFIRMATION.** So the defect stood, and the presence of
a careful-sounding caveat made it _less_ likely to be re-examined.

⚠️ **When you find a caveat under a suspect claim, name which claim it disclaims before crediting
it.** A caveat aimed one inch to the left reads, to everyone including its author, as the claim
being handled.

**2. The twin, again.** A test loosened its POSITIVE assertion off a reworded label and left the
NEGATIVE twin pinning the removed word — so the half that guarded the defect became unfalsifiable
while the file looked repaired. Then the repair for a _different_ instance reached the leave row and
not the release row, **directly beneath the paragraph explaining why that string had been removed.**

🔴 **Three times in one night a correct-looking rationale sat over code contradicting it, and twice
the missing half was the twin of the half that was fixed.** The corrected form is what a reviewer's
eye lands on; the uncorrected twin is a line or two away and reads as already handled.

**How to apply:**

1. **A fix to an assertion is not done until its opposite-polarity partner is checked** — positive
   and negative, present and absent, populated and empty, each row kind of a pair.
2. **Grep the removed string, not the added one.** _"What must be ABSENT afterwards"_ is checkable;
   _"which version wins"_ is not. Two greps returning 0 survive the fold, whoever performs it.
3. **Distrust a fix most where the comment is best.** Good prose above a line is what stops the next
   reader checking it.
