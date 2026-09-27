# Invented-figure markers, the non-statistics screens — interim, 2026-09-09

Ward Builder Four, worktree `D:/Worktrees/Database/ward-builder-four`, branch
`ward/invented-figure-markers-20260909` cut from the master line at `0aa2b7cfd4` (confirmed at the
moment of cutting). Never pushed.

**Status: ONE screen measured of sixteen. This is an interim record, published because the first
measurement changes the shape of the task.**

Ruling being applied: `owner-decisions-2026-09-09.md` §2, reading A — _every sentence whose job is
to disclose provenance must carry the marker in itself._

---

## 🔴 1. I told Ward Lead the defect's mechanism could not occur outside statistics. That was wrong.

I searched for the **component** (`StatFootnote`), found it defined in
`statistics/statistics-primitives.tsx` and used only in `statistics/statistics-service-screen.tsx`,
and concluded the heading-over-items shape was confined to statistics. Ward Lead adopted that
framing and wrote it back to me as confirmed.

**The shape occurs at `hub/hub-screen.tsx:900`, hand-rolled in JSX:**

```jsx
<h3>What is invented</h3>
<p>Every bed figure … is invented for this prototype …</p>
```

**Searching for the component answered "which files import `StatFootnote`". The question was "where
does a provenance heading sit above separate prose".** Same class as the site-index-quoted-as-a-line-
number this morning: a search by mechanism cannot find a hand-rolled instance of the same shape.

A heading-level search (`<h1-6>` containing invented/synthetic/placeholder) finds **exactly one**
outside statistics — the one above. That search is the right one and is recorded here so the next
person runs it instead of the component search.

---

## 2. That block is COMPLIANT in text

Every sentence in it carries its own marker and is true read alone:

- _"Every bed figure — ready to admit, vacant but not yet cleared, and out of service — **is invented
  for this prototype** and reflects no real hospital's state."_
- _"The {totals.community} community team names are **invented too**…"_
- _"The 'needs attention' list is worked out from those **same invented figures**…"_

No change was needed and none was made.

---

## 🔴 3. It is UNGUARDED, and the guard that looks like it covers this checks something else

Measured by mutation, which is the only probe here that cannot return a false clean — three earlier
attempts to _find_ the guard by searching all failed their own controls (one matched doc comments,
one matched variable names, one had no working positive control at all).

**Mutation:** _"is invented for this prototype and reflects no real hospital's state"_ →
_"is drawn from the current state of the network this morning"_. The marker removed; an invented
figure now stated as measured fact — the exact fault the ruling exists to prevent.

**Result:**

```
tests/ward-hub-screen.dom.test.tsx                    22 passed
22 governance / disclosure / prototype test files    219 passed
```

**Nothing reddened.** Including `tests/ward-prototype-disclosure.test.ts`, whose name reads as
though it covers precisely this.

**Why it does not.** That guard is well built — it walks the ward routes, floors itself against
vacuity (`routes.length > 20`, `screens.length > 15`), refuses to be satisfied by a comment, and
reports unresolvable components rather than skipping them. But its assertion is
`disclosesWithin(renders, …)`: **does this screen render a `prototypeBadge` governance banner.**

> It guards **presence of a banner per SCREEN**. It cannot see the **content of a sentence**.

⚠️ **THIS IS THE RULING'S OWN DEFECT ONE LEVEL UP.** The statistics fault was _true of the LIST,
false of the ENTRY_. This is _true of the SCREEN, false of the SENTENCE_. Same shape, different
altitude — and the screen-level guard passing is exactly what makes the sentence-level fault
invisible.

---

## 4. What this implies for the task, and why it is a hand-back rather than a plan

If the other fifteen screens are also banner-guarded-but-sentence-unguarded — **not yet measured** —
then the missing coverage is likely **one guard, not sixteen**: an assertion that every sentence
inside a provenance block carries a marker, walking the same route population the existing guard
already walks safely.

**That is a different piece of work from sixteen per-screen fixes, and it is not mine to choose.**
Ward Lead's instruction was to report the unguarded count and decide then; this record exists so the
decision is made on the shape as well as the number.

---

## 5. Corrections to the brief, measured

| claim                                          | measured                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "67 rendered lines across 17 screens"          | 67 lines across **32 files**; the 17 is a different grep's file count. Ward Lead has accepted this and the unit is FILES. |
| the starting grep is the population            | **8 files it misses entirely** in my scope (9 repo-wide; the ninth is under `statistics/`). Use the union.                |
| every hit is a disclosure                      | `coordinator-screen.tsx:215` — _"left out rather than invented"_ — is a design note about a control.                      |
| `ed-psychiatry-hub:779` reads a list container | withdrawn by Ward Lead; fixed 2026-09-05.                                                                                 |

## 6. Not done

Fifteen screens unmeasured. **Recorded as UNEXAMINED, not compliant** — the three states the brief
names, plus the fourth it did not (compliant-but-unguarded), are identical in a count.
