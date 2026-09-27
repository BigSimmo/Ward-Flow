---
name: a-line-number-is-a-different-number-in-every-tree
description: "A file:line citation is not a weak anchor that drifts — it resolves differently in every worktree, so three chats get three true answers and none is wrong."
metadata:
  node_type: memory
  type: feedback
  originSessionId: c9651754-35b0-4582-8471-bb68a3aa6533
  modified: 2026-09-10T14:55:11.836Z
---

A `file.ts:123` citation in a plan, brief or handover is **not an anchor that drifts within some
tolerance**. In this repository it is a **different number in every tree**, all of them correct.

Measured 2026-09-10: one assertion the third-edition master plan placed at **1687** was **1649** on
Ward Builder Two's branch and **1698** on the master line. Three true answers.

**Why:** ~150 worktrees, several live branches, and every chat measuring in its own checkout. A
citation is only valid in the tree that produced it, and nothing marks which tree that was.

**Why:** my own Lane A plan carried eight such citations, and the two most load-bearing — the
corrections telling a fresh implementer that two spec tasks were already built — were anchored to
numbers that would be wrong in that implementer's tree. The correction would have looked like the
error.

**How to apply:** cite a **name** — a function, component, exported symbol, test case, heading. If a
line number is genuinely needed, name the SHA it was measured at in the same breath. When you
receive one, re-find by name before acting; when you write one, replace it before committing.

Related: [[observations-expire]], [[self-invalidating-pins]],
[[a-measurement-is-scoped-to-what-it-measured]], [[assert-only-about-code-you-opened]].
