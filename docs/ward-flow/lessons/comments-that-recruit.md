---
name: comments-that-recruit
description: "A comment naming another file as an example decays when THAT file changes, and nothing local ever fails — it points readers at a pattern that no longer exists"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 23c91695-f037-49fb-ac67-80b7c640afa0
  modified: 2026-08-30T03:01:19.978Z
---

2026-08-30, Ward Flow. Owner decision OD-4 made the shift handover page read live instead of
freezing at mount. A comment in a **different** file, `tests/ward-escalation.dom.test.tsx`, said:

> This board is deliberately NOT frozen, unlike the shift handover — the opposite assertion of
> `ward-handover.dom.test.tsx`'s freeze test. If a future edit added a `useState` freeze here
> (copying the handover pattern without the reasoning), this goes red.

Both halves died with that change. The handover reads live too, and its freeze test was replaced by
its inverse. **Nothing in the escalation file changed, so nothing there could fail.**

## Two kinds of stale comment, and they are not the same severity

- **Misinforming:** says something false. Costs one reader one moment.
- **RECRUITING:** says _"do it like that one over there."_ Costs every reader after it, **and the copy
  looks correct because it matches a real precedent.** The damage compounds instead of sitting still.

A recruiting comment that has decayed is worse than no comment, because it converts a reader's
diligence — going to look at the named example — into the mechanism of the error.

## Why it is invisible

**A cross-file reference decays when the OTHER file changes, not when this one does.** There is no
diff on the recruiting comment at the moment it becomes wrong. Same shape as a guard made vacuous by
a legitimate refactor ([[checks-that-cannot-fail]]) — the thing that broke is not the thing that
changed — but expressed in prose, where no test can reach it.

## Practical form

**When changing or removing a pattern, grep for prose that names it**, not just for code that calls
it. Test ids, function names, file names and phrases like "unlike", "same as", "the opposite of",
"see X for why". Rename in the comments in the same commit, or the reference outlives the referent.

And when writing one: naming another file as an example is **load-bearing**. Prefer stating the
reason inline over pointing at somewhere the reason currently lives.

Related: [[checks-that-cannot-fail]], [[check-the-conclusion-that-flatters-the-theme]],
[[observations-expire]], [[assert-only-about-code-you-opened]].
