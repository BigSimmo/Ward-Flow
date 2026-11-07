---
name: a-mockup-can-re-commit-a-closed-defect
description: "A drawing is not just an incomplete proposal — it can put back a defect the product already found, fixed and documented, with none of the product's protections, and published"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a59c22f9-a8f9-4da7-99c3-cc84df2abc17
  modified: 2026-09-06T22:47:27.400Z
---

2026-09-07, Ward Flow. An audit of my own two published mockups against the screens they replace
found four claims the product **deliberately refuses to make**, each with a written reason in the
code. Two of the four were defects the product had **already closed**:

1. 🔴 **A privacy leak, twice.** The drawing said _"WF-297 withdrawn from this ward — accepted at
   RPH Adult Secure first"_, naming the ward that won the patient. `ward-screen.tsx` refuses to
   render exactly that under ruling FD-23, and its comment says: _"the exact fact FD-23 forbids a
   ward-facing surface to reveal, arriving through `withdrawnReferrals`, the field that exists to
   PROTECT this ward. **The most dangerous leak was inside the safeguard.** A structural guard
   cannot see this: `reason` is a permitted field carrying a forbidden VALUE."_
2. **Invented identity.** The drawing numbers every bed tile 01–18. The app refuses in four places:
   an `Admission` records the unit and **never a bed**, so _"numbering these would invent an
   identity nothing in the model holds, and a ward would read it as real."_

Plus a promise the app cannot keep (_"a rule that refuses a referral records the refusal"_ —
false for the three non-overridable gates) and a real calendar date beside invented figures.

**Why:** a mockup lives outside the repository. **None of the product's gates, tests, reviews or
guards run on it** — and the fixes those guards protect are invisible to whoever draws the next
version, because a fix leaves no trace in the drawing. So a defect can be found, repaired,
documented as uncatchable-by-any-gate, and then **re-published in a derivative artefact the owner is
actively looking at.** Worse, the owner approves it, because what he is shown is the drawing.

**How to apply:** before building from a drawing, audit it **against the real screen in one
direction — what does the drawing FORGET?** Rank findings `SAFETY` (a non-colour channel, a scoping
or privacy rule, a staleness signal, a "not known" convention, a print behaviour) above content and
cosmetics. Then ask the reverse once: **does the drawing state anything the product cannot do?**
A promise a screen cannot keep is worse than an omission. **Read the refusals in the code — the
comments explaining why something is NOT rendered are the highest-value thing to read before
drawing a replacement**, and they are exactly what a redesign never consults.

⚠️ **Two independent instances in one evening (mine, and a peer's Capacity drawing that had 8
columns against a real 13) is a pattern, not luck.** Related:
[[the-same-words-true-on-one-screen-and-false-on-another]], [[right-conclusion-wrong-evidence]],
[[a-written-diagnosis-does-not-sweep]], [[fields-with-no-producer]].
