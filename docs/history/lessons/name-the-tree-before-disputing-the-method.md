---
name: name-the-tree-before-disputing-the-method
description: 'Two chats counting "the same thing" got different answers and argued about method for three exchanges; both measurements were correct, for different commits — one merge-base call settled it'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 99a23426-c7b5-442f-8067-f5ed285ac016
  modified: 2026-09-12T04:17:53.851Z
---

When two agents count the same thing and get different answers, **establish they are looking at
the same commit before disputing anyone's method.** In a repo where several chats hold several
worktrees and nobody pushes, "the tree" is not a shared noun.

2026-09-12: I counted token occurrences inside CSS comments and said four; the verifier said four
too, from a different composition; the true figure in my tree was five. Three exchanges went on
whose counting was broken. `git merge-base --is-ancestor <introducing-commit> <their-HEAD>` settled
it in one call: the file carrying the disputed occurrence was committed _after_ their tree was
taken. **Both measurements were correct. Neither method was broken.** Neither of us asked the cheap
question — I went to "you missed a block", they went to "you misclassified declarations as prose".

**Why:** a measurement is a claim about one commit, and these files change nightly. A figure relayed
without its tree is unfalsifiable by the recipient, who will reasonably test it against their own and
conclude you counted badly. See [[observations-expire]] and
[[a-measurement-is-scoped-to-what-it-measured]].

**How to apply:**

- Quote the commit beside any count relayed to another chat. A number without a SHA invites this.
- On a discrepancy, run `merge-base --is-ancestor` BEFORE writing a word about method.
- ⚠️ A correct measurement underneath does not excuse a sentence written wider than it — it is what
  makes the wider sentence persuasive. Measuring your own tree soundly, then asserting _their_ figure
  is wrong, is two acts; the second has no basis in the first.
- ⚠️ Escalating from "our numbers differ" to "you misclassified" is a separate decision, not a
  consequence. It does not evaporate when the discrepancy is explained.

**The related trap, same night:** a correction that lands _in your favour_ is the one nobody audits —
in both directions. I under-counted a peer's errors out of generosity and was corrected for it; they
had earlier credited me with a better fix than I had made. See [[a-correction-that-agrees-with-you]].
**Praise that describes work better than the work deserves is the same defect as a wrong count; it
just does not feel like one.**
