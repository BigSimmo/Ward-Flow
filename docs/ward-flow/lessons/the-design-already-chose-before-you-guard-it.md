---
name: the-design-already-chose-before-you-guard-it
description: "Three independent places doing the same thing is a design decision already made — find it before commissioning a guard to enforce it, because a shape that cannot be broken beats a check that notices it was."
metadata:
  node_type: memory
  type: feedback
  originSessionId: c9651754-35b0-4582-8471-bb68a3aa6533
  modified: 2026-09-10T19:02:24.746Z
---

Ward Flow, 2026-09-11. A guard was commissioned to catch a number reaching a screen-reader
announcement **without the invented-figure marker that says it is not real**. Before it was written,
three unconnected places turned out to have already solved the same problem the same way:

    ShellFigure = { value, noun }   the noun travels WITH the number, one value
    longestVal                      the wait carries its SITE, never a bare duration
    Notice                          the sentence is stored, never re-derived from parts

**Nobody had connected them.** Three authors, three modules, one shape: **a figure is never
separable from the words that make it mean something.**

🔴 **A guard catches a separation after someone writes it. A type that cannot be separated stops it
being written.** So the question to ask first is not _"what should the guard assert?"_ but **"has
this codebase already refused to allow the thing, somewhere I have not looked?"**

⚠️ **The pattern says where to look. It does not say the answer is easy.** Here the open case is an
_announcement_ — a composed sentence, not a value object — and a known trap (a live region
re-announcing on every keystroke) still stands against the naive version. **Finding the pattern
narrowed the question from "invent a guard" to "can this one case take the shape the other three
already have"; it did not answer it.**

**How to use it:** when about to specify a check, grep for the property being checked as a _shape_
rather than as a violation — a paired type, a value that carries its qualifier, a stored sentence.
Three independent instances are not a coincidence; they are a decision the design made before
anybody wrote it down.

Related: [[fields-with-no-producer]], [[a-shared-decision-is-not-a-behavioural-property]],
[[a-structural-guarantee-is-invisible-behaviourally]], [[checks-that-cannot-fail]].
