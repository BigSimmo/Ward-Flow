---
name: ward-flow-coordinator-overrides-everything
description: "Ward Flow — a JUDGEMENT about the patient is overridable with a recorded reason; a FACT about the world is not. 9 suitability gates in SUITABILITY_GATES are overridable, fail-closed by construction; allocatable_bed is absolute."
metadata:
  node_type: memory
  type: project
  originSessionId: c0c9bd3a-7216-4498-b69a-3d91db4f68d5
  modified: 2026-09-06T22:18:29.443Z
---

🔴 **CORRECTED 2026-09-07. THIS FILE'S OLD HEADLINE — "the coordinator can override every
eligibility rule" — IS FALSE AND CAUSED HARM.** A chat acted on it, read a mockup's honest
_"Cannot take this person"_ as contradicting the principle, and had it replaced with _"Needs an
exception recorded"_ everywhere — so a published mockup told a reader they could override _"there is
no bed"_. **The old file flagged the boundary as unruled and the description line asserted the
absolute version; the description is what gets read.**

**The rule, measured in `ward-flow-reducer.ts:~737`, in its own words:**

> _"A judgement about the patient is overridable by a named human with a recorded reason; a fact
> about the world is not. **No reason typed into a form creates a bed.**"_

**Fail-closed by construction, and this is the load-bearing part:** a gate is overridable ONLY by
appearing in `SUITABILITY_GATES`. Anything unclassified refuses outright, so a gate added later is
non-overridable by default — never "anyone with a dropdown can".

**The split, computed 2026-09-07 from `ELIGIBILITY_GATES` (12) minus `SUITABILITY_GATES` (9):**

- **Overridable (9):** age, authorisation, capacity_freshness, cohort, forensic, legal_status,
  security, sex_designation, sex_mix.
- ⚠️ **CORRECTED 2026-09-12 — THE THREE-ITEM LIST BELOW WAS TRUE AND IS NOW WRONG IN ALL THREE
  PLACES.** It read: _"NOT overridable (3): `allocatable_bed`, `specialling`, `prior_decline`."_
  - `specialling` **became OVERRIDABLE on 2026-09-12** by owner ruling — a recorded reason now
    answers it, on his reasoning that the placement happens anyway under pressure and a gate nobody
    can pass stops the admission being WRITTEN DOWN rather than stopping the admission.
  - `prior_decline` moved to a THIRD category, `INFORMATIONAL_GATES`, which needs **no written
    reason at all** — more permissive than overridable, not less.
  - A thirteenth gate, `acuity`, was added, so the arithmetic that produced the three no longer
    holds either.
  - 🔴 **`allocatable_bed` IS STILL ABSOLUTE.** _"No reason typed into a form creates a bed."_ It is
    the only member of the original three still where this note put it.

  🔴 **AND THE WAY THIS WENT STALE IS THE LESSON.** The list was DERIVED — `ELIGIBILITY_GATES` minus
  `SUITABILITY_GATES` — which is exactly what this file tells you to do instead of copying. **A
  derived list is still a snapshot.** It aged the moment a gate moved, silently, and it was found by
  somebody auditing the store rather than by anything failing. **Derive it again, now, in the file:
  `SUITABILITY_GATES` in `ward-flow-reducer.ts` is the list; anything absent from it refuses
  outright unless `INFORMATIONAL_GATES` names it.**

⚠️ **`capacity_freshness` moved INTO the overridable set by owner ruling 2026-09-02** — a stale
count is information, not a wall — **and the narrow reading is explicit: it buys past a stale count,
never past `allocatable_bed`.**

⚠️ **The reducer's own doc comment naming the non-overridable set is STALE** (it says
"allocatable_bed, capacity_freshness and specialling" — wrong on two of three). **Derive the split
from the two arrays; do not quote that sentence.**

**Why refusals are accountability rather than blocks, which still stands:** an override that is
refused becomes a phone call, and the placement then happens outside the system where nothing is
recorded. A bed coordinator at 3am with a patient who must go somewhere is a real situation. **The
purpose of a refusal is to capture the decision, not to prevent it** — for the nine. For the three,
the refusal is the point.

**Multi-ward referral (owner chose option 2):** the suitable wards proceed; the unsuitable one is
held back unless a reason is given for it.

Briefs: `docs/ward-flow/engine-gate-implementation-brief.md`,
`docs/ward-flow/the-engine-enforces-nothing.md`,
`docs/ward-flow/archive/dated-notes/owner-rulings-2026-09-02-staleness-and-legal-status.md`.

See [[ward-flow-referral-model]], [[ward-flow-changeable-data-rule]],
[[a-written-diagnosis-does-not-sweep]], [[no-longer-compresses-to-never]].
