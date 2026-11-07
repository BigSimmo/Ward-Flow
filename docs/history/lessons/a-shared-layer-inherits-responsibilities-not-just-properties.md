---
name: a-shared-layer-inherits-responsibilities-not-just-properties
description: moving a property up into a shared layer leaves behind the media-query responsibilities it carried, and nothing checks
metadata:
  type: feedback
---

When a property moves from many files into one shared layer — usually the right design move — the
shared layer takes the property but NOT the responsibilities the individual files had grown around
it. Nothing checks, and the loss is invisible until someone exercises the missing path.

**Observed 2026-09-04, Ward Flow.** `WardGround` took over painting the page background for every
ward route. `referrals.module.css` had kept an explicit background _specifically_ so its
`@media print` block had something to reset, and documented the failure it was preventing. The
shell had no print block, and `globals.css` resets print backgrounds on `html, body` only — a
div's own background does not inherit that. Result: every ward route would have printed near-black
in dark mode, including handover and morning sheets, which are the ones people actually print. It
survived a full visual QA round, because a print regression is invisible until somebody prints.

**How to apply.** After moving a property up, diff the media queries and pseudo-class rules of the
files it left against the new layer's. The cheap sweep: count `forced-colors`, `@media print`,
`prefers-reduced-motion`, `:focus-visible`, `@supports` on both sides.

⚠️ **But a ratio is not a finding.** Running that sweep gave three candidates and only one
survived: the layer had no interactive elements and no animation, so `:focus-visible` 12-to-0 and
`prefers-reduced-motion` 4-to-0 were nothing. And even the surviving one (`forced-colors` 28-to-0)
only established that the _screens_ cared — not what the _layer_ owes, which needs reading what
those blocks actually do. A count of the shape "screens N, layer 0" is a convincing-looking finding
in every case, including the empty ones. See [[measure-the-thing-not-a-proxy]],
[[establish-the-unit-before-counting]], [[a-working-safeguard-leaves-no-trace]].

## The second loss: the shared layer can also hand a screen's OVERRIDE to the bundler

Same programme, next day, and it is not the same defect — it is the mirror. The first loss was the
layer failing to take on a responsibility. This one is the layer **silently competing with the
screen that still holds it.**

`composes: wardTokens` does not copy declarations; it adds a class to the element. So a screen whose
own `@media (forced-colors: active)` block repoints `--ward-border` now has **two single-class
selectors declaring that token on one element**. They tie, and emitted source order decides — one of
them in a file the screen does not control.

🔴 **THE PART I GOT WRONG, WITHIN THE HOUR, AND IT IS THE MORE USEFUL HALF.** I wrote the tie up as
a live defect across 13 files and committed it to a shared tracker. It is not established. Dev CSSOM
puts the screen stylesheets AFTER the tokens sheet, so on a tie the repoint wins; and the browser
reading that started it turned out to be a probe measuring the element ABOVE the screen, which the
repoint could never reach. **The tie is real; the breakage was not shown.** What I had was a
population and a story, and I shipped the story attached to the number.

⚠️ **Nothing renders differently, which is why nothing catches it.** Both candidate values are
author hexes and the UA force-adjusts both to the same ink. In the finder's words: _"the consequence
is not a visible defect, it is that the mechanism people believe they have is not connected."_
13 files across three branches carry the shape.

**How to apply.** When adopting a shared token layer onto a class, ask what that class ALREADY
declares — not just what it will now inherit. Where a screen must still win, buy it with specificity
rather than order: `.screen.screen { … }` beats one class whatever the bundler emits first (the
repo already does this at `.ckb-v2.dark.ckb-v2`). And prefer a guard over a fix: assert that any
override of a composed token uses a selector that can actually beat the composed layer, because the
broken state is pixel-identical to the working one.

⚠️ **My own contribution to this was a branch-local scan** that reported zero for a file living on
another branch, contradicting a colleague's direct browser reading. It survived only because the
number clashed with something already read. Scan peers' files with `git show <branch>:<path>`.
Related: [[the-artefact-you-search-is-not-the-artefact-that-runs]], [[assert-only-about-code-you-opened]].

## 🔴 The reusable lesson is about the sizing, not the CSS

**A population and a mechanism are two claims, and the population's precision launders the
mechanism.** I measured 13 files across three branches — brace-depth-aware, per-branch, correctly
scoped — and attached to it a story about bundle order I had not measured at all. The table looked
like evidence for the sentence beside it. The finder withdrew the mechanism an hour later; my number
was still right and my document was still wrong.

⚠️ **The tell is that the count did not depend on the mechanism.** I counted a _shape_ — a token
redeclared in a forced-colors block in a file that also composes the token layer. That count is
worth having whichever explanation turns out to be true. The moment a measurement survives every
candidate explanation, it is not evidence for any of them, and writing it directly above one is
where a population becomes a finding.

**How to apply.** Size and diagnose in separate sentences, each carrying its own MEASURED/INFERRED
label. Then ask of the number: _would this change if my explanation were wrong?_ If no, it does not
support the explanation — say so in the document, or the next reader will take the pairing as the
argument. And ⚠️ **a proposed fix inherits the same doubt**: `.screen.screen` was a correct fix for a
tie, cheap and precedented, and applying it to 13 files to fix a mechanism nobody had identified
would have looked exactly like a repair and changed nothing.

Related: [[measure-the-thing-not-a-proxy]], [[relayed-numbers-lose-attribution]],
[[a-correct-diagnosis-that-stops-the-inquiry]], [[deferring-to-a-correction-looks-like-humility]].

**Closed the same night: there was no breakage at all.** With the probe fixed, `--ward-border`
resolves to `CanvasText` through the screen's repoint while un-repointed `--ward-divider` keeps the
author hex — two different resolution paths, so the block demonstrably ran. They paint identically
only because the user agent force-adjusts the hex to the same ink. ⚠️ **And that is the opposite
overreach waiting on the other side:** "no visible difference" is not "the block has no effect", and
whether they diverge under a real user's Windows theme is untested. A shared token layer competing
with a screen's override is still a real hazard to design against; it just was not happening here.
