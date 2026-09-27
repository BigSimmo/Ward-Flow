---
name: right-conclusion-wrong-evidence
description: "A correct conclusion resting on wrong evidence — or on HALF the applicable rule — is fragile; the justification survives a change the real reason would not, and nothing ever goes red"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a59c22f9-a8f9-4da7-99c3-cc84df2abc17
  modified: 2026-09-06T16:31:13.378Z
---

Twice in one evening (2026-09-06), on the Ward Flow work, with two different people:

1. A lead's CSS comment argued _"a ~1.05:1 tint is not a separation — the border was doing it all
   along."_ **True.** Every one of its four supporting ratios was computed against the stylesheet
   that loses on specificity, and every error ran in the direction that strengthened the argument.
2. A builder defended a severity chart as not-colour-alone with _"every dot carries a `<title>`
   with the id and the duration."_ **The chart is sound.** But an SVG `<title>` is a tooltip — a
   sighted reader who cannot separate the hues must hover every dot in turn. The real reason is
   geometric: `x = (waitMinutes / axisMax) * CHART_WIDTH`, so **the dot's position IS the value**,
   with both cutoffs drawn on the axis. Hue is the third encoding, not the first.

**Why it is worse than a plain error:** a wrong conclusion gets argued with. A right one is
accepted, and its justification travels with it unexamined. Nothing downstream ever fails, so the
bad evidence is never pressured — and it keeps reading as sound because the conclusion keeps being
true.

🔴 **The specific danger is asymmetric fragility.** Re-lay that chart with a categorical axis and
the tooltip sentence **stays true and still reads as sufficient**, while the chart has silently
become colour-alone. The stated reason survives a change that the actual reason would not. **A
justification that cannot break when the thing it justifies breaks is not protecting anything.**

**How to apply:** when you agree with a conclusion, check its evidence anyway — agreement is the
condition under which nobody checks. Ask what change would falsify the stated reason, and whether
that is the same change that would falsify the real one; if they differ, write the real one down
beside it. And when correcting someone whose conclusion is right, say so first and clearly — the
target is the reasoning, and conflating the two makes the correction easy to dismiss.
Related: [[a-measurement-is-scoped-to-what-it-measured]],
[[a-fix-that-states-a-falsehood-more-confidently]], [[v2-tokens-beat-globals]],
[[carry-the-antidote-with-the-assertion]].

---

## The sibling: right conclusion, HALF a rule (2026-09-11, Ward Flow Lane C)

The two above rest on _wrong_ evidence. This one rests on **correct evidence that is half of the
applicable rule** — and it is harder to see, because there is nothing wrong to spot.

The build standard's definition of done says a screen's every panel and state is present **"or its
absence is recorded as an owner question — never silently dropped, never quietly added."** Two
prohibitions, one sentence.

Deciding to add a `gender` field to a patient screen that the drawing does not draw, I argued the
**dropping** half at length: the model holds two fields, showing one misrepresents the record, _"the
drawing does not show it"_ would be the dropping failure with a justification attached. **All true.
The conclusion was right and was ruled right.** I never checked myself against the **adding** half of
the same sentence — the half that says log an addition rather than carry it as though the drawing
asked for it. The lead raised it; the fix was to record it as a deliberate addition the owner can
veto knowing it was never drawn.

🔴 **The mechanism, in the lead's words: _a correct conclusion reached through half a rule looks
identical to one reached through all of it._** And the half I reached for was the half that supported
what I had already decided was right — **which it was, and that is what made the omission
invisible.**

**How to catch it:** when a rule is a sentence with two clauses, and you are citing one of them,
**say the other one out loud and check yourself against it too** — especially when the clause you
reached for is the one that supports the thing you already want to do. Related:
[[a-question-that-mentions-cost-has-answered-itself]], [[arguing-for-your-own-file]].

## 2026-09-11 — a note whose CONCLUSION outlives its JUSTIFICATION is worse than one with no reason

I wrote a comment explaining why a CSS token was unusable on a screen: _"that shell is currently
reverted off the line."_ True when written. **The shell mount landed hours later**, and a peer
flagged it rather than letting me keep relying on it.

Re-measured: **the conclusion still held** — the token still resolves to nothing there — but for a
completely different reason. It is declared inside a class that reaches an element only through a
CSS-Modules `composes:`, exactly two files compose it, and the page layout deliberately does not.

🔴 **The surviving conclusion is the dangerous half, and this is the part I had not seen before.** A
reader checking the stated reason finds _"is the shell still reverted?" → no_, concludes the note is
stale, **and reaches for the token** — arriving at the wrong action by correctly noticing the note
had decayed. **A comment with no reason at all would have been safer**, because it would have sent
them to measure.

⚠️ **The tell is grammatical: a justification in the present continuous about a mutable state.**
"is currently", "for now", "until X lands", "while Y is reverted". Those are all pins to a moving
target — [[self-invalidating-pins]] inside a rationale rather than inside a claim.

**The fix is to pin the MECHANISM, never the week's state.** "The scope is applied per component and
this page's layout does not compose it" is a fact about how the system is built and is still true
next month; "the shell is reverted" was a fact about Tuesday. **If the only reason you can give is a
current state, say the reason expires and name what to re-measure.**

Related: [[a-status-claim-about-someone-else-expires]], [[observations-expire]],
[[declared-somewhere-is-not-resolvable-here]], [[a-deferral-whose-reason-expires]],
[[carry-the-antidote-with-the-assertion]].

---

## The corrected lesson applied to yourself, the uncorrected instrument applied to a peer (2026-09-12)

**In ONE message I reported both of these:**

1. My own anti-drift test had made a population error twice — it counted _"every level-2 heading on
   the handover screen"_ as if that were _"every section that prints"_. I named the error, excluded
   the offender by name, and wrote the reason at the filter.
2. A peer's screen claimed the sheet prints _"the four sections"_. **My evidence was a count of
   `styles.sectionHeading` headings: seven.**

🔴 **That is the same wrong population, in the same message, minutes apart.** The peer checked before
acting: `onSheetRowCount` sums exactly four collections, so **four was a true count of the
row-bearing sections and a misleading description of the sheet.** My conclusion was right. My
measurement would not have carried it.

**Why this is the hard case:** a finding that is right with evidence that is wrong **survives the
first check and fails the second**. The reviewer who agrees stops; the reviewer who verifies finds the
claim defensible and drops the whole finding — including the part that was true.

**How to apply:**

1. **When you have just corrected a measurement error in your own work, search the same message for
   the same error.** The lesson arrives attached to the artefact where you found it, not to the habit.
   ⚠️ I had the corrected rule written down in the paragraph above the flawed evidence.
2. **State the population beside the count, always** — "seven `sectionHeading` headings" would have
   exposed the mismatch to me as I typed it; "seven sections" hid it. See
   [[a-measurement-is-scoped-to-what-it-measured]].
3. **When reporting somebody else's defect, verify with the instrument the CLAIM is about**, not the
   one nearest to hand. The claim was about what prints; headings are not what prints.
4. ✅ **And separate the two in the reply you get:** accept the evidence correction fully without
   withdrawing the finding, and say which half survived. Both halves matter and they are not the
   same half.
