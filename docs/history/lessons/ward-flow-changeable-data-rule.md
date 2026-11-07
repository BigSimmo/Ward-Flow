---
name: ward-flow-changeable-data-rule
description: "Ward Flow — the owner will replace every invented figure with real ones and the real world changes too; all changeable data must have ONE editable home, with the bed-count coupling as the worked example"
metadata:
  node_type: memory
  type: project
  originSessionId: db884133-9f0b-4227-abb1-8e177a1270e4
  modified: 2026-08-29T04:55:24.836Z
---

**Owner instruction, 2026-08-29, stated twice and widened the second time:**

> "The number of beds will change later... it is only example data for now. I will tell you the
> exact number of beds for every ward at a later date so make it easy to edit and add the correct
> number at a later time."

> "Implement a rule across the project for all data that may be liable to change i.e. wards,
> distances, options, names of locations, bed numbers etc... make it very easy to edit and change
> these parts so they can be edited in the future when I put in real parts, and also to allow real
> parts changing in real life as well... i.e. building another hospital or more beds."

**So there are TWO change events to design for, not one.** The first is a one-off swap of invented
data for real data. The second is permanent: a ward opens, a ward closes, a hospital is built, a
bed count moves. A design that survives only the first is not enough.

## The rule

**One place per fact.** Every changeable real-world fact — a hospital, a ward, a bed count, a
distance, a catchment, a location name, an option in a pick-list — is written in exactly ONE place.
Everything else derives from it. Adding a hospital means adding one block; changing a bed count
means changing one number.

**Screens read facts, screens never state them.** A pre-existing convention in this project
("network facts live in five seed files only") and it must extend to every changeable kind. A
hospital name in a heading, a bed number in a sentence, a ward id in a component are all leaks.

## Why this is not already true — the worked example, confirmed 2026-08-29

Changing one unit's `beds` in `ward-sites.ts` from 20 to 26 is **not one edit**. The same record
also hand-states `empty`, `allocatable`, `held`, `blocked` and `sexMix` (two numbers), and
`ward-admissions-seed.ts` lists the occupants one line each — and its own doc comment requires the
occupants to agree EXACTLY with that unit's `sexMix`. So one number becomes roughly seven edits
across two files, and missing one makes the app disagree with itself silently.

**The genuine tension, which must not be hand-waved.** The seed deliberately does NOT derive itself
from `sexMix`, and says so in its own comment: a fixture that derived itself from the number it is
checked against could never disagree with it, and the check would be a
[[checks-that-cannot-fail]]. So "just derive everything" is the obvious answer and it is partly
wrong. Any redesign must say which numbers are authored and which are derived, and keep a real
check between them.

## How to apply

1. **Before hand-authoring any figure, ask where its one home is.** If it does not have one, that
   is the bug, not the figure.
2. **When you add a fixed pick-list, check what adding a sixth entry breaks** — an exhaustive
   `switch`, a `Record<>` keyed by `string` rather than the union (which compiles and renders
   `undefined`, see [[checks-that-cannot-fail]]), a count assertion, a per-option CSS class.
3. **Prefer a test that asserts a PROPERTY over one that asserts a COUNT.** "23 units" turns the
   owner adding a hospital into a red suite with a confusing message; the count assertions that
   protect something real should stay and say in their failure message exactly what else to update.
4. **When the owner supplies real numbers, he sends a plain list.** Getting them into shape is our
   job, never his — do not ask him to format anything.

## Scheduling constraint at the time of writing

The files holding this data (`ward-sites.ts`, `ward-admissions-seed.ts`, `ward-distance.ts`) exist
on more than one live branch, so they are contested and the change lands at the fold rather than
immediately. Design it ready; do not edit them from a session that does not own them. See
[[ward-flow-coordination-state]] and [[parallel-chats-and-cross-chat-sync]].

Related: [[ward-flow-verification-lessons]], [[ward-flow-ledger-system]].
