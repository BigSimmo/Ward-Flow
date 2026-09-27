---
name: ward-flow-discharged-not-released
description: "Owner decision 2026-08-30 — the third bed stage is 'discharged', not 'released'; 'released' reads as release from detention"
metadata:
  node_type: memory
  type: project
---

**The third bed stage is `discharged`, not `released`.** Owner decision, 2026-08-30, from his own
unprompted question: _"Is discharged better than released?"_

**Why, and it is a clinical reason rather than a stylistic one.** In mental health "released" carries
a custody meaning — released from an involuntary order, released from detention. That is a different
event from a person going home, and it is the wrong association on a psychiatric board being shown
to a health service.

**What "released" was doing that "discharged" does not.** It described the BED, not the person, and
those genuinely differ: someone can be discharged at 11am and still occupy the bed until transport
comes at 4pm, and a bed can free up with no discharge at all when a person transfers wards. Keep
"release" as the plain verb for what happens to the bed; the stage name is about the discharge.

The stage names were already inconsistent, which is what made this worth changing rather than
tolerating. `BED_RELEASE_STATES`' own doc says _"Each stage says how CERTAIN the discharge is, and
nothing else"_ — and then the third value silently stops describing certainty and starts describing
the furniture. `predicted → confirmed → discharged` is one idea; `predicted → confirmed → released`
is two.

**Scope, measured not estimated:** 35 occurrences of the literal `"released"` across 16 files,
including `ward-flow-reducer.ts` and files owned by three different chats. It must be ONE
coordinated pass — four chats each doing their share is how a value ends up renamed in the screens
and not in the reducer.

**Not yet done** at the time of writing. _(Updated 2026-09-12: The migration to "discharged" has largely landed across the codebase; only 2 legacy test/mock files retain the historical literal)._

Related: [[ward-flow-coordination-state]], [[ward-flow-changeable-data-rule]],
[[ward-flow-referral-model]].
