---
name: a-faithful-fold-creates-a-new-contradiction
description: "Preserving each merged screen's behaviour exactly can still produce a false statement, because the merge puts two honest-but-different counts on one page for the first time"
metadata:
  node_type: memory
  type: project
  originSessionId: c06395db-f0c8-4004-a0a4-bd5e339098ce
  modified: 2026-09-05T11:41:11.814Z
---

**Ward Flow Movements, found 2026-09-05 by reading one number on the rendered page. Live on master
(`ef771c84d`) at the time of writing.**

The merged Movements page shows **`WF-008` under "Accepted, awaiting bed", with a journey clock
reading 2h 35min and still counting.** That patient **self-discharged from the ED and the movement
was closed 20 minutes before the anchor** — `closure.outcome: "did_not_proceed"`, reason _"Patient
self-discharged from ED before transport was arranged"_. **Nothing on the row says so.** They are
counted among "6 people" and render identically to the five who are genuinely still waiting.

## Why every individual decision was correct

```
journeyStages()   groups by `stage` only, no isOpen filter
                  -> 50 moves across 7 groups
transportLegs()   called with movements.filter(isOpen)
                  -> "8 of 43 open moves"
```

**Both match the screens they replaced.** `MovementsView`/`stageSummaries` never filtered by
`isOpen`; `LiveTracker` always did. I preserved each and **wrote the reasoning into the doc comment
at the time** — _"introducing a filter the folded screen never had would be a behaviour change, not
a fold."_ That is correct about the fold and wrong about the result.

🔴 **THE DEFECT IS CREATED BY ADJACENCY, NOT BY EITHER BEHAVIOUR.** Before the merge, 50 and 43
lived on two pages nobody saw together, so neither was a claim about the other. **The merge made
them one page, and the page now contradicts itself** — 50 at the top, 43 at the bottom, and the
7-move difference (6 arrived + WF-008) explained nowhere.

## How to apply

**When folding screens, the fold-faithfulness test is not sufficient.** "Each half behaves as it
did" passes while the combination states something neither half stated. **Ask instead: does any
figure on the merged page now sit beside a figure computed over a different population?** If yes,
either reconcile them or say on the page why they differ.

⚠️ **AND THE ROW-LEVEL HALF IS THE CLINICAL ONE.** A closed movement rendered with a live,
still-incrementing clock is a **false statement about a patient** — it says someone is waiting for a
bed who has already left. That was true of the old board too, so the merge did not create it; **the
merge made it legible, which is the only reason it was found.** The fix is to MARK the row, never to
filter it away: that a move was abandoned is exactly what a board of this kind is for.

**The wording on that row is clinical and belongs to the owner or a charge nurse, not to me.**

## The shape, stated generally

Same family as [[a-measurement-is-scoped-to-what-it-measured]]: each derivation was sound and its
sentence was written wider than its evidence once a second derivation stood next to it. Also
[[an-absence-promoted-to-a-headline]] — the page makes a claim by juxtaposition that no line of code
makes.

**A comment recording WHY a behaviour was preserved is not a check that preserving it was right.**
Mine read as a decision already reviewed. See [[comments-that-recruit]] and
[[a-comment-can-satisfy-a-guard]].

Related: [[tests-that-assert-rendering-not-truth]] — 59 DOM tests passed over this page.
[[ward-flow-verification-lessons]].
