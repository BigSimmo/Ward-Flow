---
name: a-comment-that-predicts-an-edit-elsewhere
description: A comment naming the exact future edit works only if the person making it opens that file — and the tempting edit was in a different one
metadata:
  type: feedback
---

A reducer comment, written months earlier when a role was added:

> _"`community_team` has no acting role yet; when one arrives it joins this map rather than
> widening the lists."_

**It arrived.** Somebody had written down **the exact edit that would be needed and the condition
under which it would be needed** — and the change was still one careless commit away from being
missed, because **the tempting edit is in a different file.** A ruling says "let community teams
decline"; the obvious move is to add `community` to the role list. The comment predicting that
lives beside the _ownership map_, which the builder had no reason to open.

⚠️ **And the failure would have been silent and permissive:** `answerableBy.community` was `"any"`,
and `"any"` **skips the ownership check entirely** — so the role addition alone would have let a
community team decline a **psychiatric ward's** bed, recorded as a legitimate refusal.

> **A comment can only warn the person who opens its file. If the edit it predicts will be made
> somewhere else, the warning needs to live where the edit happens — or be a guard.**

**How to apply:**

- Writing a note about a future change: put it **where that change will be typed**, not where the
  reasoning lives. If those differ, put it in both, or make it a test.
- Receiving a ruling that names one list: **ask what else is keyed by the same value** before
  editing. Two lists one line apart with identical contents for months is the shape.
- Sibling: [[comments-that-recruit]] (a comment naming another file decays when that file changes)
  and [[a-written-diagnosis-does-not-sweep]].

**Companion tool limit found the same hour:** the mutation harness's exactly-once `--find` **cannot
address one of two byte-identical code paths.** Duplicated logic is common and is precisely where a
control matters most; the control was run by hand with the same guarantees rather than by
contorting the source to suit the tool. See [[caught-and-survived-are-not-equally-strong]].
