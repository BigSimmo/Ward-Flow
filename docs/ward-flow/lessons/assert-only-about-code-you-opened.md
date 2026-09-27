---
name: assert-only-about-code-you-opened
description: "Four wrong assertions in one day from trusting documents over code — including one about history, which no amount of reading the current file can check"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9e69b934-3b65-4d9c-b7db-667ef076f769
  modified: 2026-08-29T01:40:43.783Z
---

2026-08-29. In a single session, four confident claims about Ward Flow turned out to be
statements about a _document_ rather than the code. Of the first three, two were the Phase 8 chat's
and one was mine, and every one was caught the same way: the other party opened the code instead of
accepting the claim. The fourth, below, is the exception that matters — no one could have caught it
by opening the code, because it was a claim about history.

**The rule: assert only about code you have opened.** A document is evidence of what someone
intended at the time they wrote it, never of the current state.

The three shapes, all of which look like knowledge:

1. **"X must be told" is not evidence X has not been told.** The ward board plan carried an
   instruction to relay a decision to Phase 8. I relayed it as outstanding. It had been relayed
   hours earlier, acted on (`a7abb6c73`), and confirmed with the owner — the _plan_ was simply
   stale. Phase 8's words, worth keeping: "A document saying someone must be told is not evidence
   they have not been told."
2. **"No overlapping files, the merge should be clean"** — the handover said it; `git merge-tree
--write-tree` reported three add/add conflicts. One dry-run merge, writes nothing, settles it.
3. **A grep is a proxy, not the thing.** Grepping Phase 8's module for `arrivedAt` returned 8 hits
   and looked like a contradiction. Opening them showed a doc comment recording the removal plus a
   _different_ record's field. Reporting the grep would have been a false alarm about a correct
   claim. See [[measure-the-thing-not-a-proxy]].

**The two cheap checks that did all the work here:**

- `git merge-tree --write-tree <branchA> <branchB>` — a real merge, nothing written, exact conflict
  list. Use before ever describing a fold as clean or dirty.
- `git rev-parse <branch>:<path>` — resolves if the file exists on that branch. Settles "does the
  other branch own this file" in one command.

**And the defect this uncovered, which is the reason it matters.** Of the three conflicting files,
one was the structural test guarding the field set of another. Resolving both in the same direction
deletes the fields _and_ the assertion that they must exist — a green suite that agrees with itself
and is wrong. The check and the thing it checks must never be resolved together.

## The fourth shape, found later the same day and the worst of them

4. **A claim about HISTORY cannot be checked by reading the current file.** I told two sessions and
   the owner that a "22 units" figure had spread between the code and two plans without anyone ever
   counting it — the day's theme, stated crisply. It was false. `ward-sites.ts` genuinely held 22
   units until this programme's own earlier phase added the 23rd (`5401a7121`, two days before).
   Every stale comment had been **correct when written**. Nothing propagated uncounted; the fixture
   grew and the prose describing it did not.

**The tell, in hindsight:** every other check that day worked by opening the current file, and this
claim was the one where that could not possibly settle it. `git show <ref>:<path>` and a count at two
old commits answered it in seconds, and none of three sessions ran it before the claim reached the
owner.

**The rule that generalises past this project: a conclusion that flatters the day's theme is the one
to check hardest, and it is the one you will check last.** It arrives already agreeing with
everything else you have learned, so it never triggers the suspicion an odd finding would. Both other
sessions repeated it onward before anyone tested it — one of them to the owner.

**Corollary worth its own line:** a stale record and a false record are different failures with
different fixes. A test comment recording "measured 2026-08-25 across all 22 units: 337 eligible
pairs" is _honest_ about an old measurement. Renumbering the 22 to 23 without re-measuring converts
it into a lie. Where a figure is dated, re-measure or leave it — never tidy it.

## Two more coordinates that decay, found the same day

5. **`git merge-tree` is blind to a working tree.** It compares committed tips, so a "clean, only three
   conflicts" answer describes a version of the branch in which another session's uncommitted edits do
   not exist. Two sessions quoted it as authoritative all day; four shared files were being edited the
   whole time. **Re-run it only against committed tips, and confirm both working trees are clean at
   that moment** — a clean merge-tree over a dirty tree is not a clean merge, and nothing in the output
   says which one you got.
6. **A line number is a coordinate in a moving file.** I cited `tests/ward-nav.test.ts:261` as
   authoritative while another agent was editing it; the committed file had it at 240. It is the part
   of a citation that looks most precise and decays fastest. **Cite by content, or pin the version.**

Together with #4, one shape three ways in a single day: a disagreement about **when** a file said
something, **where** a route exists, and a check silently answering about **a different state of the
world** than the one asked. All three presented as disagreements about fact.

## The trigger, which is why this keeps working on careful people

A peer put the mechanism better than I had it. You check a claim **because something about it feels
loose**. A claim that fits the pattern you are already hunting feels right, so it never trips the
trigger — and sails through the one mind most primed to catch it. Two sessions demonstrated this on
themselves in one afternoon, in opposite directions, while both warning others about it.

**Keep the list of real findings short and true.** A list of five verified "checks that cannot fail" is
worth something because every entry can be believed; a sixth that turns out to be guarded costs more
than it adds. Value is precision, not length.

## Asserting about someone else's reading is its own failure

**Refined 2026-08-29 by the session that made the error, correcting a version of it I had written
that was too generous to them.**

I had summarised a disagreement as: each of us was right about the file as it stood when we read it,
the file changed in between, and **nobody misread anything**. The first two clauses are true. The
third is false, and the false comfort is the problem.

**The version difference explains the discrepancy. It does not explain what was done with it.** The
other session did not say "we may be reading different versions" — it told me my claim described
something that _was never there_, and dismissed the consequence I had drawn from it. That is an
assertion about **my reading**, made without checking when I read it, and **it would have been wrong
even if the file had never changed.** The file changing is what made the error discoverable, not what
caused it.

**So there are two distinct failures and only one of them is about versions:**

1. Reading a current file and describing a different moment — fixed by citing the commit.
2. **Asserting about what another person saw** — not fixed by citing anything, because it is a claim
   about someone else's evidence that you have not examined. The fix is to say "we may be reading
   different versions, which did you read?" rather than "that was never there."

**Why the distinction is worth keeping:** a lesson that overstates its own innocence is the one people
learn to skip. "Cite the commit" is the right rule; "nobody misread anything" is a slightly too
comfortable reason for it, and comfortable reasons do not survive contact with the next disagreement.

Related: [[read-the-failure-message]], [[run-the-test-before-prescribing-the-fix]],
[[parallel-chats-and-cross-chat-sync]], [[ledger-rows-lag-reality]].

## A commit that RECORDS a decision looks exactly like one that IMPLEMENTS it

2026-08-29, found by auditing my own plan against the code rather than by being challenged — which
is why it had survived being read several times.

I wrote into a plan that a screen's frozen view _"is ALREADY GONE and this is NOT open"_, citing
commit `e43f3f8f8`: **"Ward board: the frozen morning view is dropped, everything is live"**.

`git show --stat e43f3f8f8` → **37 insertions in one design document. No code.** The freeze is still
present and is still the default view.

**The commit message is entirely truthful about its own subject.** A decision _was_ taken to drop the
freeze. I read a true statement about a decision as a statement about the code, and nothing in the
message distinguishes the two — **a decision-recording commit and an implementing commit have the
same message shape**, because both describe the change in the present tense.

**The rule: `git log` proves a decision was made. Only `git show --stat`, or the file itself, proves
anything shipped.** One extra flag, and it is the difference between a plan that tells someone not to
do work that was never done.

**And the second-order cost is the one that bites:** my plan then instructed the builder _not to
restore the freeze_ — so the error did not merely fail to schedule the work, it **actively told
someone the work was finished.** A wrong "done" is worse than a missing "todo", because nobody audits
a completed item.

**Ledger corollary:** any decision register needs a status distinction between _decided_ and
_implemented_, or a recorded decision silently reads as shipped work.

## Which artefact can carry the answer: a tree cannot say WHY, silence cannot say WHETHER

2026-08-30, same file and same hour, two sessions made mirror-image errors about
`ward-diagnosis.ts`. A peer read the tree, saw the diagnosis field on the admission side only,
and called it "built backwards" — **inferring intent from work in motion, which has the exact
shape of a wrong build**. I waited for an announcement that the module had landed, when one
`git cat-file -e` would have shown it already had — **inferring absence from silence**.

Neither was a bad search. **We each read a source that cannot carry the answer.** A tree records
state, so it cannot say why something is half-done. Silence records nothing, so it cannot say
whether something happened. Both questions are about EVENTS, and the artefact that records
events is the log.

**How to apply:** for "why is this like this", `git log -S <symbol>` and read the commit message.
For "has this landed yet", `git cat-file -e <ref>:<path>` — never wait to be told. Re-running the
same search harder confirms a wrong answer rather than exposing it.

## ⚠️ A CONSTANT'S TARGET MUST BE RESOLVED, NEVER INFERRED. 2026-09-04.

I predicted a colleague's branch had three broken test locators. Reasoning: they had renamed a CSS
class in four screens, and the register's locators used the old name — so the locators must point at
those four screens and must now find nothing.

**They point at a FIFTH file I never opened.** `renderedIn: STATISTICS_SCREEN` resolves to
`statistics-screen.tsx`, which their branch had NOT renamed. All three locators find exactly one
occurrence. **Their test is green and correctly so — two coherent states at different boundaries,
not one broken one.**

> **The claim rested entirely on where a named constant pointed, and I inferred that from the
> surrounding work instead of reading the `const` line.** One grep would have settled it.

⚠️ **Flagging it as "predicted, not run" limited the damage but is not a substitute.** It cost a
colleague a measurement instead of costing the other branch a wild goose chase. **A caveat makes a
wrong claim cheaper, never right.**

## 🔴 REFS REACH EVERYTHING; ONLY THE WORKING TREE IS EXCLUSIVE

I had said I could not check another session's branch "without checking it out, which is not mine to
do." **False, and it stopped me measuring something I could have measured.** A guard that reads its
subject from a PATH can be simulated entirely from refs:

```
git rev-parse <branch>:<path>          # blob identity, for byte-comparison across branches
git show <branch>:<path>               # full content, no checkout, no worktree touched
git merge-tree --write-tree A B        # the merged tree, then git cat-file -p <tree>:<path>
```

**That last one answers "what would the merge actually produce" without performing it** — and
"no conflict" is NOT "consistent": two files can auto-merge from opposite sides into a combination
neither branch ever had. **Read the blob out of the merge-tree result and check the pairing.**

Same shape as: before calling a mutation too risky, check whether the thing under test is a pure
function. **Twice in one night I called something unreachable that a cheaper tool reached.**

Related: [[unreachable-over-which-paths]], [[identical-work-produces-no-conflict]],
[[observations-expire]], [[a-mention-is-not-an-assertion]].

## 🔴 2026-09-05 — RIGHT CONCLUSION, FALSE MECHANISM. The most dangerous way to be wrong.

Correcting a peer's ruling, I wrote: _"`empty` is exactly what `openBedsFree` reads, and
`openBedsFree` is what my `ready` is built from."_ **Every clause of that chain is false.**

```
ready          = lockedBedsFree(unit) + openBedsFree(unit)
openBedsFree   = max(0, unit.allocatable.value - lockedBedsFree(unit))
lockedBedsFree = max(0, min(unit.allocatableLocked, unit.allocatable.value))
                 -> every field is `allocatable`. `empty` appears NOWHERE.
```

**And the conclusion I drew from it was correct anyway**, by a chain neither of us had:
`RELEASE_BED` is _"the only event that raises both figures"_ — `allocatable.value` AND
`empty.value` in the same handler. So the event that creates the discrepancy does move `ready`,
just not the way I said.

⚠️ **Nothing downstream failed, because the conclusion held.** A wrong mechanism supporting a right
answer produces no red test, no contradiction, and no reason for anyone to look — and it goes into
the record as reasoning somebody may later build on. **A false premise under a true conclusion is
worse than a false conclusion**, which at least gets caught.

**How it happened: I reasoned about the chain instead of opening the three functions.** They are
four lines long and were one `sed` away. The plausibility of "free beds come from the empty count"
was doing the work that reading should have done.

⚠️ **The peer nearly let it through, and said so: my conclusion was the one THEY already wanted, so
the cheapest move available was to accept the mechanism because they liked where it landed.** See
[[a-correction-that-agrees-with-you]] — this is that failure from the other side, and it only did
not happen because they checked a claim they were inclined to believe.

**The rule: when you assert that A feeds B, open A. Every time. Especially when the conclusion is
one you or your reader already wants.**

## When the artefact is UNREACHABLE, the finding must be a question. 2026-09-06.

A peer described a guard they had written. From the description I concluded it walked an empty
population and would pass vacuously, and sent that as a finding with a red flag. **Their file
already asserted the row count and the named file — the floor was there before I asked for it.**

I then checked whether I could have read it: `git log --all` found the test in **no commit on any
branch**, and it was not on disk. It was uncommitted in their worktree. **So I could not have
opened it, and that is exactly the circumstance in which an assertion is unfalsifiable by the
person making it.**

**Why this is worse than the ordinary version:** normally "I did not open it" is a lapse I could
have fixed by opening it. Here there was nothing to open, so no amount of diligence would have
converted the guess into a fact — **and the only correct move was to change the grammar.** "Does it
assert a row count?" costs one line, cannot be wrong, and gets the same answer.

The peer's framing — _"a floor omitted from a summary is indistinguishable from a floor that is not
there"_ — is true and is not the whole of it. **It remains my job to notice which of those two I am
looking at, and unreachability is the signal.**

**How to apply:** before writing a finding, ask whether the artefact is reachable. If it is, open
it. **If it is not, the sentence becomes a question — and say why: "I cannot read this, so:".**
Related: [[a-clean-negative-that-measured-nothing]], [[compliance-without-coverage]].
