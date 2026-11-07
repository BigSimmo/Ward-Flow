---
name: fields-with-no-producer
description: A model field nothing can write passes every gate and shows as a legitimate empty state on screen
metadata:
  type: feedback
---

Three Ward Flow model fields landed in one night with nothing that could write them — `edId` +
`purpose`, then `triagedAt` (2026-08-30). The only event that creates a `Referral` had no such field,
so the value could reach the model only on a hand-authored fixture.

**Why it is invisible:** it typechecks, its tests pass against fixtures, and it reads as complete in
the model. The one thing that reveals it is a screen rendering the absent branch forever — and
"not in department yet" for every patient looks exactly like correct handling of a legitimate case,
not like a feature with no data. A thing built before its input exists cannot be built wrong, only
empty, and empty is indistinguishable from working.

**How to apply:** when adding a field to a model, name the event that writes it before writing the
field, and seed at least one fixture that exercises the present branch. Guard it structurally rather
than by list: read the type's own field names and require each to be written by the creating event,
with an explicit exception list naming the event that does write it — plus a second test keeping that
list from becoming a graveyard of renamed fields. Related: [[self-invalidating-pins]],
[[the-suite-never-tests-the-absence]], [[measure-the-thing-not-a-proxy]].

## Three variants, and the middle one has no owner

Ward Flow, 2026-08-31. The same blindness has three shapes, found by different people:

```
no producer         the field cannot be written at all
producer, no case   the field CAN be written and no seeded row does it   <- hardest
neither             the guard inspects an arm no fixture produces
```

⚠️ **The middle one is the worst, because everything its owner owns is green and correct.** The
derivation was right, both branches were written, both were unit-tested with hand-made objects, and
typecheck was clean — and half of it could not reach a screen, because **nothing in a derivation, its
unit tests or the compiler looks at what the SEED actually contains.** It has no natural owner: the
derivation's author sees green, the fixture's author is not thinking about branches, and the screen's
author sees a legitimate-looking state. It surfaced only because a peer read two surfaces at once and
noticed one of two labels had never once appeared.

⚠️ **And the near-miss is what would have hidden it indefinitely.** One fixture DID carry the field,
which made the case look covered while being the opposite shape. **A fixture that exercises a field
is not a fixture that exercises a branch.** Two of three shapes present reads as coverage, and the
missing one is invisible _because_ the other two are there.

⚠️ **AND THE SAME PERSON MAKES BOTH HALVES, HOURS APART.** I built a union so a patient of no fixed
abode could be referred, and then seeded no referral that used it — so the label rendered on no
screen. The fix and its own missing fixture are the same defect one layer apart. **Finishing a fix
and populating a fixture are different acts of attention, and nothing connects them until a guard
does.** Not carelessness; structure.

**How to apply:** for any derivation with a branch, assert that the SEED reaches each branch, not
merely that hand-made objects do. Put one shape on one fixture row so each is nameable, and pin the
branch that was missing rather than all of them.

## The mirror image: a declared thing with NO CONSUMER — 2026-09-04

Everything above is about a field nothing can **write**. The same defect runs the other way and is
harder to see, because the thing exists, is correct, and is simply never **read**.

**Measured on Ward Flow.** A CSS consolidation added two design tokens to a shared layer. I reported
them as unused and filed it as a style note — scope creep in a change described as a merge. **I aimed
it at the wrong one of the two.**

- `--ward-divider` — genuinely incidental, and two files began consuming it within hours.
- `--ward-ground` — ⚠️ **the one token expressing the whole approved design direction: panels
  floating on a ground instead of white on white. Declared, consumed by nothing.**

> ⚠️ **A DECLARED, UNCONSUMED THING IS THE MIRROR OF A FIELD WITH NO PRODUCER. It looks supported,
> it passes every gate — and the design silently reverts to the thing it was meant to replace.**

**Why no gate catches either direction:** a field with no writer renders as a legitimate empty state;
a token with no reader renders as the old appearance. **Both are indistinguishable from "working"
unless somebody asks what is supposed to consume it.**

**How to apply:**

- **For anything newly declared in a SHARED layer, ask what reads it, not just what declares it.**
  Report the answer even when it is "nothing yet" — that is a finding, not a footnote.
- **Weight it by what the thing MEANS, not by how it looks in a diff.** Two unused tokens looked
  identical to me. One was vocabulary; one was the entire visual direction. **The tell is not usage
  count, it is whether the thing is the sole expression of a decision somebody made.**
- The same question closes both directions: **name the producer and name the consumer.** A thing
  with neither is not supported, however green the suite.

## And state the commit, so the finding can expire instead of being re-litigated

My "neither is used" measurement was true at `a138ea14a` and false hours later once `--ward-divider`
acquired two consumers. ⚠️ **Because it was reported WITH its commit, the reviewer could say "right
then, the world moved" instead of treating me as wrong.** An undated measurement of a moving system
cannot be retired gracefully — it can only be contradicted. See [[observations-expire]].

---

## The fourth instance, and it is the worst: `LegalForm.dueAt` (2026-09-07)

**`dueAt` is a statutory deadline. Nothing in the reducer can write one.** Measured, with a control:

    grep -c "dueAt"                ward-flow-reducer.ts   0
    CONTROL — same search shape:   "^\s+stage:"          12
                                   "^\s+at:"             10
                                   "^\s+legalForm:"       1

The only `legalForm` write copies an entry from `SELECTABLE_LEGAL_FORMS`, and **none of those five
entries carries a `dueAt`**. So every deadline in the system comes from the seed, and **a patient
raised while somebody is actually using the prototype can never have a legal clock at all** — eight
files read the field, including the breached-deadline count, the delays screen, the priority queue,
the shortlist and the console.

🔴 **A severity inversion was fixed on that field the same night — and that corrected code path can
only ever be exercised by seeded patients.**

⚠️ **WHAT MADE IT INVISIBLE IS THAT EVERY SURFACE HANDLES THE ABSENCE IMPECCABLY.** The model comment
is emphatic — _"never invent a fallback for an absent `dueAt`, never let it read as 'clear' or 'not
yet due', render its absence explicitly"_ — and the console duly prints _"no deadline recorded"_.
**A careful absence is indistinguishable from a careful absence that is the only possible state.**
Good handling of an empty case is what hides an empty case that can never be full.

**The control is the transferable part.** The finder's first control (`formedAt\s*[:=]`) also
returned zero, which would have made the `dueAt` zero meaningless: **a blank from a broken search
looks exactly like a blank from a real absence.** A negative is only a finding once the method has
been shown to produce a positive.

⚠️ **And do not fix this kind by computing the value.** Deriving `dueAt` from a per-code statutory
interval is the tempting shape and **it encodes a claim about the Mental Health Act in code** — the
same model comment records an authored `dueAt` once being put on a Form 1A _"on the strength of an
unverified figure"_ and removed. Ask the owner to name the interval, or capture it as an input.

Related: [[the-suite-never-tests-the-absence]], [[a-clean-negative-that-measured-nothing]],
[[compliance-without-coverage]], [[an-absence-promoted-to-a-headline]].
