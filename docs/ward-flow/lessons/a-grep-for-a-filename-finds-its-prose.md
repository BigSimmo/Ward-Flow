---
name: a-grep-for-a-filename-finds-its-prose
description: Grepping a module name returns the comments discussing it — and prose accumulates precisely around modules somebody decided to stop using
metadata:
  type: feedback
---

A guard named five ward modules as having no importer. Checking whether it had invented them,
Ward Verifier grepped each module name across `src/` and **got confident importer lists** —
`ward-screen.tsx` for one, three statistics screens for another.

**Every one was a mention in a comment.** The guard stripped comments and was right; the
verification did not and was wrong. ⚠️ **One step from reporting a working guard as broken.**

> **A grep for a filename finds the prose that discusses it — and prose is exactly what
> accumulates around a module somebody once decided to stop using.** The dead module is the one
> most likely to be _talked about_ in comments: why it was replaced, what superseded it, what not
> to do with it.

**So the signal is inverted where it matters most:** the more thoroughly a module's retirement was
documented, the more importers a naive search appears to find.

**How to apply:**

- **Strip comments before any reachability or usage search.** A guard that does this beats a
  verification that does not — trust the instrument over the ad-hoc check, or make the check match.
- **Verify a guard's output with the guard's own method, not a weaker one.** Disagreement between a
  careful instrument and a casual grep is evidence about the grep.
- Companion in the same session: a **static count of `it(` blocks** reported 79 cases where running
  the files reported **82** — one file held 8, not 5. **A static count is a proxy for what runs**,
  and it erred in the direction that understated the problem.

Related: [[measure-the-thing-not-a-proxy]], [[a-comment-can-satisfy-a-guard]],
[[a-clean-result-from-measuring-nothing]], [[read-what-the-guard-reports-not-its-source]].
