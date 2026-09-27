---
name: breakpoint-swaps-are-unreachable-by-every-gate
description: jsdom never evaluates @media and the Playwright specs assert content not layout — so a phone/desktop layout swap can break with every gate green
metadata:
  node_type: memory
  type: reference
  originSessionId: c06395db-f0c8-4004-a0a4-bd5e339098ce
  modified: 2026-09-04T21:57:29.549Z
---

**A CSS breakpoint swap is invisible to BOTH test loops in this repo, in both directions.**
Measured 2026-09-05 on Ward Flow.

- **jsdom does not evaluate `@media`.** So no `.dom.test.tsx` can ever see which of two layouts is
  showing. Assertions pass identically whether the phone card list or the desktop table is visible.
- **The Playwright specs assert column containment and row content, never WHICH layout is showing.**
  Checked, not assumed, on all three boards.

**The defect this let through:** migrating `<div className={styles.tableScroll}>` to `<WardTable>`
without passing `wrapperClassName`. `WardTable` puts the _primitive's_ `tableScroll` on the wrapper,
so the board's own local `.tableScroll` stopped reaching the DOM — and each board hides one layout
with `@media (max-width: 40rem) { .tableScroll { display: none } }` **in its own stylesheet**. That
rule silently stopped matching. At 375px: seven scroll wrappers `display: block` while all seven
card lists were `display: grid` — **a sideways-scrolling table and a full stacked card list, both at
once**, on three boards.

⚠️ **The tell I had and did not use: I changed which class lands on a DOM node and never looked at
the DOM at phone width.** Same lesson as the "waiting waiting" defect found by rendering the screen.
**A migration feels like it moves nothing, which is exactly why it needs the look.**

## What to do instead

**Guard the WIRING, not the rendering** — it is the half that can be known statically:
_a board whose stylesheet hides `.tableScroll` at a breakpoint must hand that class to every
`<WardTable>` it renders._ That is `tests/ward-table-phone-swap.test.ts` (Builder Three, 2026-09-05).

⚠️ **Write an exemption's REASON, never its symptom.** Escalation is exempt "because it declares no
`.tableScroll` rule" — the symptom, which stops being true the day somebody adds one. The reason is
**it has no second layout at all** (no `.cardList` in either the stylesheet or the component,
verified). Testing an exemption with the check that would break it is how you tell the two apart.

**A prop documented for the one case somebody hit reads as not needed by the cases they didn't.**
`wrapperClassName` existed for `search.module.css`'s print override, so three callers who needed it
for a breakpoint swap read past it. That is a defect in the primitive's affordance.

Related: [[a-property-set-on-the-element-itself]], [[the-artefact-you-search-is-not-the-artefact-that-runs]],
[[ward-journeys-run-in-neither-loop]], [[compliance-without-coverage]].

---

## A breakpoint can be an owner decision wearing the costume of a magic number (2026-09-06)

The hub's stylesheet used `68rem` three times, off the registered scale. An agent snapped all three
to `64rem` and **argued it well**: the neighbouring screen makes the same decision at 64, a shared
scale exists so screens agree, and it checked the result by eye at three widths and found the switch
clean. It landed.

🔴 **`68rem` IS WHERE THE OWNER'S OWN "2/3 SEARCH, 1/3 GLANCE" SPLIT COLLAPSES TO ONE COLUMN.** So
the number was not a stray value — it was the width at which an instruction he gave stops applying,
on a screen he had looked at. **Nothing in the value distinguishes a considered choice from an
arbitrary one**, and the brief that produced the error said _"prefer snapping if an existing rung is
within a hair"_ — 4rem is not a hair.

Reverted; `68` is now a registered rung, and the registration comment keeps the mistake visible,
because **the reasoning that produced the 64 is the reasoning the next person will produce.**

**How to apply: before snapping any breakpoint, token or magic number to a neighbouring rung, find
out whether a human chose it.** `git log -S` the value, or read the rule it guards and ask what
changes on each side. ⚠️ **A layout proportion an owner asked for by name is a decision, not a
style** — and the only visible symptom of getting it wrong is that the design changes at a different
width, which no gate measures and no screenshot at a fixed width shows.

Related: [[a-blanket-fix-is-not-blanket]], [[a-guard-that-defends-a-superseded-ruling]],
[[an-absence-promoted-to-a-headline]], [[a-measurement-is-scoped-to-what-it-measured]].

---

## ⚠️ 2026-09-07: THE SYMMETRY. This file argues "go and look", and looking is exactly half of it.

One Ward Flow night produced defects of both kinds, and **the two sets do not overlap at all.**

**Caught ONLY by looking at the screen** — every gate green: a sticky panel that never stuck; two
bar segments painting the same colour because one token aliased another; a print stylesheet that
dropped all 41 rows because the rows were `<button>`s and `globals.css` hides buttons.

**Caught ONLY by a gate, or by reading a diff against its own prose** — the screen was correct in
every one of these five: a comment asserting the wrong mechanism for a fix that worked; a
`line-height: 1` where `--ward-leading-none` was defined as exactly `1`; a `120ms` literal that
looked identical but ignored `prefers-reduced-motion`; a governance suffix stripped from a label; a
count printed from filtered results where a network figure belonged.

🔴 **In all five, the pixels were right and the words about them were wrong.** No amount of looking
finds those — there is nothing to see. And in the first three, the words were impeccable and the
layout was broken.

**How to apply:** treat "I looked at it" and "the gates are green" as covering **disjoint** classes,
never as one another's evidence. After a change, ask which kind it was: if it moves a class onto a
DOM node, changes a breakpoint, or touches print/forced-colors — **render it**. If it states a
reason, a count, a mechanism, a token value, or a label — **have something read it as text**, and
re-derive any claim before relaying it. ⚠️ **The most dangerous defect is the one whose rendered
output is perfect**, because the natural check confirms it and stops the inquiry — see
[[a-correct-diagnosis-that-stops-the-inquiry]] and [[rendered-output-hides-why-a-value-is-constant]].

Related: [[tests-that-assert-rendering-not-truth]], [[looking-at-the-screen-misattributes]],
[[the-same-words-true-on-one-screen-false-on-another]], [[a-comment-can-satisfy-a-guard]].
