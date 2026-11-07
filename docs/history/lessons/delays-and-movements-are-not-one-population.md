---
name: delays-and-movements-are-not-one-population
description: Ward Flow — the Delays/Movements fold justification is FALSE. Delays is open-only; the Movements stage board deliberately includes closed movements. They are not two groupings of one list.
metadata:
  node_type: memory
  type: project
  originSessionId: 9196936a-67c8-429f-8951-37f5069dea95
  modified: 2026-09-06T22:21:15.660Z
---

🔴 **THE FOLD'S ENTIRE JUSTIFICATION — "both screens start from the same list, every open
movement, and differ only in how they group it" — IS FALSE. I asserted it to the owner
repeatedly before measuring it.**

**Measured 2026-09-07:**

- `delays/delays-derivations.ts:170,204` — `movements.filter(isOpen)`. Delays is **open-only**.
- `movements/movements-derivations.ts:181` — `journeyStages` has **no `isOpen` filter at all**.
  The stage board deliberately carries **closed** movements so a "did not proceed" stays visible
  with its clock frozen at closure.
- Only `transportLegs` on that screen filters to open.

**So they are two views of two overlapping populations, not two groupings of one list.**

⚠️ **A fold must therefore DECIDE, explicitly, whether the merged worklist carries closed
movements — and either answer takes something away from whoever relies on today's behaviour.**
The codebase already records an incident (`WF-008`) of two counts silently disagreeing once put
on one page. A header strip of "totals" must name the population each total is over.

⚠️ **`movements-screen.tsx:220-221` documents this in a comment, and I read that comment earlier
the same night and half-absorbed it** — I registered that the transport half was scoped to open
and did not notice the stage half beside it was not. **Reading a comment is not sweeping it.**

**Each screen also holds a great deal the other does not** — Delays: waiting-time bands, ranked
one-cause-per-movement, resolved-today handover panel, escalation contact detail, routed actions
to other screens. Movements: all seven stages shown even at zero, the honest "N of M have no
transport leg booked" count, provider and time-since detail, and the only link into the
~2,000-line per-movement workspace, which Delays cannot reach at all.

**The mockup of the folded screen is POORER than either real screen.** Anyone treating it as a
specification builds backwards. Same caution applies to the Capacity mockup (8 columns drawn
against 13 real) and probably Command.

See [[ward-flow-coordinator-overrides-everything]], [[a-written-diagnosis-does-not-sweep]],
[[prove-the-task-is-still-outstanding]], [[a-measurement-is-scoped-to-what-it-measured]].
