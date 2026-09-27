---
name: a-comment-that-quotes-the-string-it-removes
description: "A comment naming the false string it just removed makes that string appear twice, so an anchor-based restore refuses — and a silenced refusal ships the mutant; the better the comment, the more certainly it collides"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a59c22f9-a8f9-4da7-99c3-cc84df2abc17
  modified: 2026-09-07T07:42:06.451Z
---

2026-09-07, Ward Flow. I removed a false stamp — a ward row rendering `"Never confirmed"` about a
bed nobody had confirmed — and wrote a comment above it explaining exactly why that string was
wrong. Then I mutation-tested the new guard by putting `"Never confirmed"` back, and issued the
restore.

**The restore ABORTED.** The mutator refuses any anchor that does not appear exactly once, and by
then `"Never confirmed"` appeared **twice**: the mutant, and my own comment quoting it. I had
redirected the restore's output to `/dev/null`, so the refusal was silent. **I committed the
mutant — the false string shipped inside the commit that removed it.**

⚠️ **The better the comment, the more certainly it collides.** A comment that names the string, the
mechanism and the reason is exactly the comment that makes the string non-unique. **Documenting a
removed string and mutating that string are in direct tension, and nothing warns you.** The safety
property (refuse unless the anchor is unique) is what converts a well-documented fix into an
unrestorable one.

**Why:** three compounding failures, none of them the tool's:

1. **The apply step printed to the terminal; the restore printed to a bin.** A guard that refuses
   loudly is worth nothing once you have closed its mouth. Never `>/dev/null` a restore.
2. **I verified with the wrong file.** I ran a _neighbouring_ suite, read "8 passed", and took it as
   reassurance about the file I had just mutated. See [[hand-picked-test-subsets-ship-red]].
3. **I checked `git status` after the first mutation and not the second.** The habit fired once and
   then stopped, which is worse than never having it — one clean check reads as a clean session.

**How to apply:** after every mutation round, re-run **the test file you mutated**, and grep the
source for the mutant string with a stated expected count. Prefer a floor of the shape _"this
string must appear exactly N times, all of them prose"_ over a bare restore-and-trust. And when a
comment must quote a string you may later mutate, mutate a **longer anchor** that includes
surrounding code, so the prose can never match it.

🔴 **It was caught only because the failure was an ASSERTION and not a timeout.** The same run
carried a known load-dependent timeout in an unrelated file; had I read "2 failed" as the familiar
flaky pair, this ships. The tell was the received text — the NEW note beside the OLD stamp, which
is only possible if one edit landed and the other did not. Related:
[[restoring-a-mutated-file]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[read-the-failure-message]], [[a-comment-can-satisfy-a-guard]].

⚠️ **This turned out to be one of THREE shapes of the same collision in one evening** — a guard
reporting a post-mortem as the bug, this restore refusing, and an absence check satisfied by the
prose explaining the fix. See [[writing-the-defect-down-collides-with-the-check]] for the class.
