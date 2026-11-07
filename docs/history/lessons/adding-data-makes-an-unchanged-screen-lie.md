---
name: adding-data-makes-an-unchanged-screen-lie
description: A hard-coded sentence is true only for the rows that exist; adding a row of a new kind makes a component that changed by not one character start stating a falsehood
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5e393ec4-f01a-41a0-b49b-d6c9d0bca57b
  modified: 2026-09-05T17:10:55.417Z
---

2026-09-06, Ward Flow. `community-ratified-aliases.ts` holds service merges **a person signed**.
`community-screen.tsx` rendered, hard-coded:

> **"A person has ruled that this team and X are one service."**
> **"Decided by {decidedBy} on {decidedOn}, after being shown each spelling and the suburbs it routes."**

Both were simply TRUE, because every row was the owner's. Then I added two rows I decided myself
under a blanket autonomy grant. **Without touching one character of the component, the page began
telling a clinician that a named human had signed a merge nobody had seen.**

**Why this is not an ordinary stale-comment bug.** The sentence was never wrong when written, no
test could have been wrong, and the diff that broke it contains no rendering code at all — it is a
data file. **Nothing in the changed file looks like a UI change, so nothing prompts you to open the
UI.** The reviewer sees rows added to a table; the falsehood is a join away.

## How to apply

- **Before adding a row to any table, find every sentence rendered ABOUT that table** and ask
  whether it is true of the KIND of row you are adding. Grep the consumers, don't reason about them.
- **When a table gains a second kind of member, make the kind a REQUIRED typed field**, never
  optional and never inferred from a free-text name. Optional lets a new row inherit the old kind by
  saying nothing — the direction that silently manufactures the stronger claim.
- **Then make the screen switch on it**, and guard that the two kinds render _differently_. Checking
  only that the new kind avoids forbidden words passes on a page that says nothing at all.
- **Attribution is the highest-risk case.** A page naming a human as the author of a clinical
  judgement is the one sentence where a wrong row is not a cosmetic defect. Related:
  [[false-attribution-manufactures-corroboration]], [[a-relayed-approval-is-not-an-approval]].

## 🔴 The field added to prevent a fabricated signature could fabricate one

The mutation that flipped one row's `decidedByKind` from `"agent"` to `"person"` — **one word** —
left all seventeen tests green. Every other check trusted the field.

Whether a person really decided is a fact about the world; **no test reaches it.** What is reachable
is whether the entry's two _independently written_ provenance fields agree — the kind, and the
decider's NAME. A cross-check between them fires on a one-word slip, and defeating it now requires
rewriting the name too, which is no longer an accident.

**A guard cannot stop a deliberate forgery. It can make sure one is never a slip.** And I only found
it because I mutated my own new field instead of reading it. Related:
[[a-property-that-does-not-discriminate]], [[run-the-mutation-before-relaying]],
[[a-guarantee-that-holds-one-direction]], [[fields-with-no-producer]].
