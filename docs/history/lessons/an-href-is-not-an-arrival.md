---
name: an-href-is-not-an-arrival
description: "A link can reach the right screen and silently drop the patient, because the destination reads no URL — assert the arrival, never the href"
metadata:
  type: feedback
---

On 2026-09-06 I replaced a dead `<button>Override a refusal</button>` (no `onClick`, looked live,
did nothing) with a `<Link href="/mockups/ward-flow">`. Strictly better, and I verified it: the guard
required the affordance to have a destination, and it did. **What a coordinator actually got was
_"Select a movement from the priority queue to see its explainable shortlist"_ — right screen, no
patient, 43 people in that queue.**

**The destination read no URL at all.** `CoordinatorScreen`'s selection is `useState` seeded from a
shared context value; `grep useSearchParams` over its directory returns nothing. So **no href could
ever have carried the patient** — the only channel was a context setter the link had to call on the
way out. A link and a working link are different things, and nothing about the href says which one
you have.

**Every DOM test was green before and after.** The guard asked _does this affordance go somewhere_,
which is presence-of-destination — a real attribute, honestly asserted, and one step short of the
claim. It is the same shape as the dead button it replaced: an assertion that stops just before the
thing that matters.

**Why:** I found it by clicking the link in a browser, having already written and mutation-proved a
test that could not see it. Reading either file would not have found it — the defect lives in the
relationship between two files, and each is correct alone.

**How to apply:** when adding or reviewing navigation that carries a subject (a patient, an order, a
record), first check whether the DESTINATION can receive it — `useSearchParams`, a route param, or a
shared store — before assuming the href is the channel. Then assert the **arrival**: render the
receiving side's own input and require it to name the subject, so any mechanism that carries it stays
green and removing the mechanism goes red however live the link looks. Control it both ways — remove
the carrier (must go red by name) _and_ point it at the wrong subject (must also go red, or the guard
only detects that something was set). Related: [[fields-with-no-producer]] (a mechanism nothing
drives), [[tests-that-assert-rendering-not-truth]], and
[[a-property-that-does-not-discriminate]].
