---
name: a-reviewer-who-has-read-the-intent
description: "Reading what a change was trying to do spends the one uncontaminated look at it; pre-register what you expect before looking, and never hand the real reviewer two critiques in a row"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c0c9bd3a-7216-4498-b69a-3d91db4f68d5
  modified: 2026-09-03T21:15:15.263Z
---

Ward Flow, 2026-09-04. A page was rebuilt after three defects were found **by looking at it** that
three of us had missed **by reading the code** — including a blue "current step" eight lines under a
banner saying the journey was over.

## 1. The page comes before the report, and there is exactly one chance

Ward Lead offered to send the finished page **and** the builder's account of it, together.

> **You cannot unread intent.** A reviewer who knows what a page was TRYING to say supplies the
> missing sentence in their own head without noticing, and grades it against its intention rather
> than against what it actually shows.

Same structure as the adoption playbook's own best line — run the contract tests BEFORE you touch
anything, because afterwards _a red you inherited and a red you caused are indistinguishable_. **The
uncontaminated observation is only available before, and it is spent once.**

## 2. ⚠️ Pre-register, because a predicted find and a real one read identically

I had already read every ruling. **So I would be looking FOR the known defects — confirmation-seeking,
the opposite of what the pass was for.** Admitting that afterwards is worthless; the fix has to
precede the look.

**So I wrote down all sixteen things I expected to see, in specific terms, and sent the list before
opening the page.** The rule it creates: **anything found that is on the list is CONFIRMATION and is
labelled so. Only a finding absent from the list is a discovery.**

Without it you hand somebody sixteen confirmations dressed as sixteen findings, **and from where they
sit the two are indistinguishable** — the same shape as [[relayed-numbers-lose-attribution]] and
[[the-question-belongs-to-the-answer]].

⚠️ **And pre-commit to the thing the checklist cannot catch: a page can satisfy every item and still
be worse to read than what it replaced.** Sixteen ticks is not a verdict. **Put the judgement FIRST,
before the checklist** — a verdict placed after a list reads as a caveat to the list.

## 3. ⚠️ Whoever wrote the brief has the MOST compromised read, not the least

Ward Lead realised its own look was weaker than mine: it wrote the brief, made every ruling and found
three defects itself, **so a page doing exactly what it asked will look right to it by construction.**
Seniority runs the wrong way here. **The person who specified the work is the last person who can
judge whether the work is any good** — and that bias is invisible until somebody names the mechanism.

## 4. The negative prior — protecting a cold read and then destroying it by the front door

The real cold read belonged to the owner: the only clinician, and the only person who had read none
of it. **Two reviewers were about to hand him a report each, listing only what was wrong.**

> **A page that is nine-tenths right, described twice in terms of its faults, is a page he opens
> looking for what is wrong with it.** We would have spent the whole exercise protecting his read
> from confirmation bias and then given him a negative prior instead.

**Fix, and the asymmetry matters: a critique is load-bearing and a compliment is not, so the
correction is ONE LINE, not a section.** Balance for its own sake is worse than the negative prior,
because it makes the report harder to weigh. Judgement first, then what is wrong, then one factual
line on what works.

**How to apply: when someone else's read is the one that decides, your job is to keep it usable —
short, wrong-things-first, one line of what works, and never so thorough that their look feels
optional.** Related: [[a-baseline-from-the-subject-vouches-for-it]],
[[check-the-conclusion-that-flatters-the-theme]], [[compliance-without-coverage]].

## Six defects in one night, and not one was found by the person looking for it — 2026-09-06

Ward Flow, tallied with a peer at the end of the session:

    three defects in MY work    found while I was checking THEIRS
    three defects in THEIR work found while they were checking MINE

Concretely: I warned them their `var()` parser risked FALSE POSITIVES; checking whether their fault
was also mine found the opposite fault in my own colour guard — it exempted `rgb(0 0 0 / var(…))`,
raw black. They corrected my `hash-object` note; measuring their correction found MY generalisation
was scoped wrong. My out-of-memory warning made them re-read their own run output and find four
fatals under a diagnosis they had already filed as fork exhaustion.

**Not one of the six was found by more care applied in the same direction.** Every one came from
turning a claim about somebody else's work onto your own — and each time the finding was in the
opposite direction from the one being investigated.

**Why:** you inspect your own work along the axis you were already thinking about, which is the axis
you got right. A peer's defect gives you a NEW axis, and it is free — you have just spent the effort
understanding the mechanism, so asking "do I have this?" costs nothing and lands somewhere you were
not looking.

**How to apply:** whenever you send a peer a defect or a warning, **immediately ask whether your own
work has that shape** — before they reply, because their reply will be about their code. And when
you receive one, the same. The reciprocal check is the cheapest review available and it is the only
one that reliably escapes your own blind spot. Related:
[[a-correction-that-agrees-with-you]], [[check-the-conclusion-that-flatters-the-theme]],
[[a-count-overstated-a-tile-mislabelled]].
