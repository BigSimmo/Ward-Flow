---
name: two-dots-answers-a-question-nobody-asked
description: git diff HEAD branch reports the SYMMETRIC difference — 170 files and twelve fake conflicts where a merge would write one file; it is wrong the moment it is typed and never goes stale
metadata:
  node_type: memory
  type: feedback
  originSessionId: d9f6d3ee-6105-489f-896e-5c1538d8238d
  modified: 2026-09-18T17:27:47.632Z
---

**2026-09-19.** A peer checked whether a fold would collide with in-flight work using
`git diff --name-only HEAD <branch>` — **two dots, between two diverged tips.** The ward line was 65
commits ahead, so that reported the **symmetric difference of both directions**: ~170 files,
including `ward-flow-reducer.ts`, `ward-model.ts` and `ward-board.tsx`. **Twelve overlapped the
dirty list.**

🔴 **Every number in it was real. It answered a question nobody had asked.** What a merge actually
WRITES is `HEAD...branch` — three dots, changes on the branch since the merge base. That was **one
file, zero overlap.** Same tree, same moment, two commands, opposite conclusions.

## The tell

**A diff between two diverged branches is symmetric. A merge is not.**

- `HEAD...branch` (three dots) — **what the merge brings.** Overlap, scope, conflict prediction.
- `HEAD..branch` (two dots) — which commits are on the branch and not here. Counting only.
- `git diff HEAD branch` — the symmetric difference. ⚠️ **Almost never the question, and the more
  the two have diverged the more convincingly wrong it looks.**

## Why it is worse than a stale reading

[[observations-expire]] covers three severities of a measurement going out of date. This is not one
of them:

- Those manufacture false **comfort** (or a false finding) from stale data. This manufactures
  **ALARM** from fresh data — it would have stopped a safe fold and produced twelve fabricated
  conflicts to report to a colleague.
- 🔴 **It does not go stale. It is wrong the moment it is typed and stays wrong**, so re-measuring
  never catches it. The only defence is knowing which question the command answers.

## And the clause that makes the fold rule usable

✅ **A merge FROM a branch does not move that branch.** After folding, the source branch still points
where it did, so a session working there sees nothing change underneath it. "Do not fold another
chat's branch" is usually stated without this, and two sessions each declined a safe fold for a
hazard the operation does not have. What you must not do is move or rewrite their branch — merging
it into your line is not that.

Related: [[a-measurement-is-scoped-to-what-it-measured]], [[differs-is-not-owns]],
[[git-queries-that-answer-instead-of-erroring]], [[compare-against-merge-head-not-the-branch-name]].
