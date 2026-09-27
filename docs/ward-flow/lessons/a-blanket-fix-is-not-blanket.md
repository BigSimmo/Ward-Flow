---
name: a-blanket-fix-is-not-blanket
description: "A catch-all fix has its own precedence and loses to the more specific members — and the ones it misses are the structured ones holding the data"
metadata:
  type: feedback
---

Ward Flow printed near-white text on white paper in dark mode, because rules declared
`color: var(--text)` on elements they owned and an ancestor cannot override a declaration made
on the element itself. The per-file print reset covered `.screen` only, so ~20 files were still
broken. I argued for a catch-all instead of enumerating selectors — **an enumerated list is the
defect regenerating** — and that argument was right. The catch-all I chose was wrong.

    .table td              (0,1,1)   class + type
    .screen, .screen *     (0,1,0)   class + universal, which contributes nothing

Measured through a real cascade implementation, with the reset placed LAST in source order:

    wildcard on .table td   rgb(244, 246, 248)   NEAR-WHITE — still broken
    wildcard on plain span  rgb(0, 0, 0)         black — works
    important on .table td  rgb(0, 0, 0)         black — works

**Why:** a wildcard _feels_ like it ends the enumeration problem, so it stops the question. But
`*` adds no specificity, so the catch-all sits at the BOTTOM of the precedence order among the
things it is meant to catch. It beats bare elements and loses to every compound selector.

⚠️ **AND THE MEMBERS IT LOSES TO ARE THE STRUCTURED ONES.** `.table td`, `.table th`,
`.clockRow dd`, `.auditList li`, `.timeline span`. Plain spans get fixed; tables and lists —
where the data is — do not. **A spot-check on any single-class element prints black and the fix
looks confirmed.** The printed page then shows black headings and invisible rows, which reads as
a list with nothing in it rather than as a broken page.

**How to apply:** verify a blanket fix on its WORST member, never its nearest one — the most
deeply-selected, most compound instance you can find. And when reaching for a catch-all, ask what
its precedence is _relative to the things it is catching_; "applies to everything" and "wins
against everything" are different claims and only the second one is the fix.

The corroboration was already in my own printed output before I read it as a signal:
`coordinator.module.css` **already** used `color: CanvasText !important` in its print block.
Somebody had hit this fight and solved it, and the evidence was sitting in a column I had
scanned for something else.

⚠️ **AND A CUSTOM PROPERTY LOSES A SECOND WAY, WHERE SPECIFICITY NEVER ENTERS IT.** A repoint like
`@media (forced-colors: active) { .screen { --ward-border: var(--border) } }` was recorded as
settled — "the repoint applies" — on the strength of one screen-level token measured on one screen.
Two ways it fails to reach the tree:

    SPECIFICITY  --ward-border on .screen (0,1,0) loses to the same property set on
                 .screen .panel (0,2,0) or .table td (0,1,1).      same as the print defect
    PROXIMITY    a custom property resolves at the element where it is USED, against the
                 NEAREST ancestor defining it. ANY redefinition between .screen and the
                 consumer defeats the repoint — at EQUAL OR LOWER specificity.

**The second has no analogue in the ordinary-property case**, so specificity reasoning does not
even detect it, and there is no conflict for anyone to notice. A conclusion measured on one token
on one screen is a conclusion about that token on that screen.

**How to apply:** "the override applies" is a claim about a SET of elements. Say which set, and
measure the member furthest from the declaration — not the one nearest it.

Prefer the repair that is robust to your own uncertainty: `!important` produces the right result
whether or not the specificity reading is correct.

Related: [[a-written-diagnosis-does-not-sweep]], [[a-property-set-on-the-element-itself]],
[[a-property-that-does-not-discriminate]], [[measure-the-thing-not-a-proxy]],
[[a-test-co-authored-with-the-code]].
