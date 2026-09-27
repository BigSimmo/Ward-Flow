---
name: a-plausible-author-is-not-an-author
description: "Scope-matching identifies a plausible author, never the author — I published the correction and then made the same error twice in one day, nearly causing another tool's work to be destroyed"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d9f6d3ee-6105-489f-896e-5c1538d8238d
  modified: 2026-09-18T10:26:05.056Z
---

**Twice in one day, 2026-09-18, and the second time was after I had written the correction down and
sent it to someone else.**

1. **`ward-nav`'s community route moved "0 of 64" to "1 of 64".** My own task had just pointed the
   hub at the 64 real community teams, and 64 was the number that task produced. Obvious. `git blame`
   put the new concrete href in `ward-flow-sign-in-data.ts:312`, another tool's file.
2. **Twenty-two files appeared in my worktree.** Their paths matched two of a peer session's
   subagents' declared scopes **exactly**. I told the peer so, with mtimes attached. The peer had
   killed all three agents at 18:07 and the writes continued for another seventeen minutes; the
   newest was a `:focus-visible` accessibility fix in nobody's brief, in files that were never in
   the scope I had assigned them to.

🔴 **Scope-matching is pattern-matching wearing a measurement's clothes.** The mtimes were real, the
paths were real, and the conclusion was still invented. Publishing the right method to someone else
does not inoculate you against it on the next question — see
[[a-written-diagnosis-does-not-sweep]].

## What it nearly cost

The peer, building on my attribution, asked the owner for permission to discard eight of the files
as "only my own agents' unverified edits." ⚠️ **Had he agreed on that description, another tool's
work would have been destroyed, and the peer's captured patch would have been the only copy.** It
was withdrawn only because the peer re-measured its own claim instead of defending it.

## How to apply

- ✅ **The only instruments that answer authorship: `git blame` on the exact line the failure names,
  the reflog, a process listing.** [[reflog-answers-whose-commit]], [[read-the-failure-message]].
- 🔴 **For an UNCOMMITTED file, none of them can — and "I cannot establish who wrote this" is the
  correct, complete answer.** Do not fill that gap with the most plausible candidate.
- ⚠️ **Never describe work as someone's when asking permission to destroy it.** The permission is
  granted against your description, not against the thing. If the description is a guess, say so in
  the request or do not make the request.
- **Killing an agent does not stop the writes you blamed on it** — check whether they continue
  afterwards. That single test would have caught this in two minutes.

Related: [[a-measurement-is-scoped-to-what-it-measured]], [[assert-only-about-code-you-opened]],
[[subagents-write-into-the-parent-worktree]] (a real hazard, and NOT what happened here),
[[observations-expire]].
