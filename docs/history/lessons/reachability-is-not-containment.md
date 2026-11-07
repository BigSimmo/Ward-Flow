---
name: reachability-is-not-containment
description: "An import graph proves what can be reached; a portal breaks DOM containment without breaking reachability, and both instruments stay silent"
metadata:
  type: feedback
---

Ward Flow, 2026-09-04. The central print reset lives on `.wardTokens`; `.shell` composes it and the
layout wraps every route in `.shell`. I concluded the reset covers every ward route. Two instruments
appeared to confirm it:

    grep -rn createPortal src/components/ward-management/     -> nothing
    import-graph traversal, 1473 files, 4892 edges, controls passing
      -> no ward component reachable from any non-ward app entry

**Both were correct. Both answered a narrower question than the one being asked.**

- The grep was scoped to a **directory**; the question was about a **render path**. The portal was
  two files away, in a shared `Sheet` that renders through `OverlayPortal`.
- The traversal measured **reachability**; the question was about **DOM containment**. **A portal
  breaks containment without breaking reachability** — the import edge is intact, the descendant
  relationship is not.

So `.drawerBody` and everything in the phone drawer sits outside the shell, and the per-file print
block I had just told everyone was redundant is the only thing covering it. **Had anyone tidied
"redundant" blocks on my say-so, the drawer would have printed invisible.**

⚠️ **AND THE STYLESHEET'S OWN COMMENT SAID SO, AND I DISCOUNTED IT.** _"`.drawerBody` in particular
renders through a portal, outside the shell's DOM subtree."_ True, precise, and load-bearing. After
a night of catching true comments applied one step too wide, I had built a reflex that a confident
mechanism comment is probably over-scoped — and applied it to one that was exactly right.

**How to apply:** name the property you actually need before choosing the instrument. _Reachable
from_ / _imported by_ / _rendered inside_ / _a DOM descendant of_ are four different relations, and
a tool answers whichever one it implements, instantly and without flagging the substitution. For any
claim of the form "X covers everything under Y", the disproof is a portal, an `iframe`, a
`position: fixed` escape, or anything else that renders outside its JSX parent — go looking for
those specifically rather than for counter-examples in general.

Related: [[measure-the-thing-not-a-proxy]], [[a-mention-is-not-an-assertion]],
[[a-blanket-fix-is-not-blanket]], [[establish-the-unit-before-counting]],
[[a-true-impossibility-claim-blocks-the-search]].
