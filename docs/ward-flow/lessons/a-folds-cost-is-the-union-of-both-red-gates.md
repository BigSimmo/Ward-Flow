---
name: a-folds-cost-is-the-union-of-both-red-gates
description: "A merge inherits both branches' known-red gates, and only one side ever holds both lists"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 23c91695-f037-49fb-ac67-80b7c640afa0
  modified: 2026-08-30T12:42:32.592Z
---

I folded another session's branch into the Ward Flow main line to pick up a real defect fix
(conditional React hooks causing silent state loss). I knew that branch had three unfixed
typecheck errors — it had told me — and folded anyway. The main line went red on typecheck.

**Why it happened:** I judged the incoming fix urgent _because it was on the main line_, which was
correct, and let that urgency carry me past a red gate I had been warned about. **A defect's
urgency is branch-relative; a fold is the moment both branches' problems become one branch's
problems, and I only counted the ones I was solving.** The other session put it best: _a fold's
cost is the union of both sides' known-red gates, and only one side ever has both lists._ Neither
party had both facts — that is structural, not carelessness.

**How to apply:** before merging another session's branch, ask it for its current gate state, and
state your own; add the two lists together and decide against the union, not against your half.
If the fold still wins (mine arguably did — it also ended a real data-loss risk, four files that
existed on one never-pushed branch and nowhere else), say plainly which red gates you are
accepting and who owns each.

**And do not green someone else's red gate to tidy the branch.** The owning session was mid-edit;
the "obvious" repair (a cast, an `edId: ""` stub) would have made the branch green and the form
permanently dishonest. Nothing is pushed on Ward Flow, so a red local gate costs nothing
externally while the wrong fix is permanent. Related: [[parallel-chats-and-cross-chat-sync]],
[[observations-expire]], [[a-bypass-that-runs-a-narrower-check]].

## 🔴 A PIN THAT DESCRIBES THE CODE IS GREEN ON EITHER SIDE TAKEN WHOLE. 2026-09-04.

A ward test holds `COVERING_THE_GROUND`, a pinned list of stylesheets known to paint over the shared
page background, and fails when a listed file no longer appears to, or when an unlisted one does.
Two branches diverged **in both directions** — 15 entries against 16, four rows only on mine, five
only on theirs — and the five theirs pinned were exactly my night's adoption work, because **their
line still held the pre-adoption files.**

|                          |                                                        |
| ------------------------ | ------------------------------------------------------ |
| their list + their files | 🔴 **GREEN — and my adoption of five screens is gone** |
| my list + my files       | GREEN, correct                                         |
| their list + my files    | RED ("freed")                                          |
| my list + their files    | RED ("a new screen covers the ground")                 |

⚠️ **Only the MIXED resolutions go red.** The resolution that silently discards a night's work is
green — green precisely because the pin and the files agree with each other while both being the old
thing.

> **A pin that DESCRIBES the code cannot detect a whole-side revert. It only detects disagreement
> between the pin and the code, and a revert takes both.**

**How to apply at a fold:**

- **Diff the pin lists BY NAME in both directions** before resolving anything. `comm -23` and
  `comm -13`, never a count — the two directions mean completely different things and a count hides
  one inside the other.
- **A pin file and the files it describes are ONE decision wearing two hats.** Resolving them
  independently is what produces the green wrong answer.
- ⚠️ **Check whether the other side's version of a file is simply OLDER**, not different. One
  `git show <branch>:<path>` settled this: their copy still carried the local scale I had removed.
  "Their list is stale" and "their files are stale" look identical from the list alone.
- **Say it before the fold.** A fold decision is cheap in advance and expensive to detect after,
  because the evidence afterwards is a green test.

Related: [[publication-branch-overwrites-remote-fixes]], [[squash-merge-lands-a-subset]],
[[ledger-rows-lag-reality]], [[assert-only-about-code-you-opened]].

## 🔴 A FOLD RARELY CREATES A RED. IT REVEALS ONE — AND EVERY REVEALED RED ARRIVES LOOKING LIKE THE FOLD'S FAULT. 2026-09-11.

Six branches folded into one line, zero merge conflicts, typecheck clean. The full suite over the
union: **402 of 402 files ran, 4,731 collected, 4,652 passed, 4 failed.** My working hypothesis was
the interesting one — _a guard from branch X now walks code from branch Y, so no single branch could
have caught it and the FOLD created this._

✅ **I briefed the diagnosers with that hypothesis EXPLICITLY LABELLED AS A HYPOTHESIS TO TEST, and
they refuted it twice.**

| red                         | what the measurement said                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a stale panel name (×2)     | the rename and the stale query shipped in **ONE commit**. `git diff <c>^ <c> -- <test file>` is **EMPTY** — never touched, never run, already wrong                    |
| a fixture read past a guard | the allow-list commit is a **direct ancestor** of the commit adding the call site. `git merge-base A B` returned **A exactly**. Both coexisted, red, inside one commit |
| a provenance sentence       | ✅ genuinely the fold's — guard on one parent, sentences on the other, neither branch ever held both files                                                             |

⚠️ **Three of four predated the fold. Had I briefed "the fold created this" as a premise instead of a
hypothesis, I would have written three wrong attributions into three commit messages** — and each
would have read as measured, because the surrounding numbers were.

**The test that settles it, and it is cheap:** `git diff <commit>^ <commit> -- <the failing test
file>`. Empty means the test was already wrong when that commit was made and the branch never ran
it. And `git merge-base A B` returning `A` means there was only ever one line of history — no fold
could have been involved.

### 🔴 A NEW FILE IS INVISIBLE TO EVERY BRANCH BUT ITS OWN

**The second fold brought in a new component with two violations of a guard that had been green on
its author's branch all night.** ⚠️ **Not a lapse: the guard ran, and the file it would object to did
not exist anywhere the guard ran.** A branch's green says nothing about a file that only exists on
another branch — so **a new file's first honest gate is the fold**, and its author cannot produce
one earlier.

**This is an argument for folding OFTEN, not for anyone being more careful.** A lane that adds files
should expect its first real verdict at the fold and should not read the fold's red as a criticism.

### ✅ THE CHEAP TELL FOR THE RENAME CLASS, WHICH NOBODY USED

**A rename's blast radius is every file that spells the old name.** Before committing one:

    grep -rn "<the exact string you removed>" tests/

**One second.** It would have caught the stale panel name, which instead survived a commit, four
folds, and a hand-picked five-file subset reporting 98 passing assertions. **Third occurrence on
this project of a named subset shipping a red** — see [[hand-picked-test-subsets-ship-red]]. **A
subset is chosen from what the author believes the change touches, which is the same belief that
produced the change.**

## 🔴 A THIRD SHAPE, 2026-09-12 — THE RED THAT EXISTED ON NEITHER SIDE

**Not inherited. CREATED — by folding half of a pair.**

A peer lane added a model FIELD in one commit (`167a0340e9`) and, in a second commit
(`3d06fc0f88`), answered the five enumerating guards that field trips: a permissions duplicate, a
reachability `KNOWN_UNREACHABLE` entry, a re-anchor `INSTANT_FIELDS` entry, and two claim-register
citations. **I folded the first without the second.** My next full sweep went red on five checks in
files belonging to nobody in my lane.

⚠️ **Both branches were green. The union was not.** The union-of-red rule above does not predict
this: there was no red on either side to inherit. **A field and the answers to the guards it trips
are one change wearing two commits, and taking either alone manufactures a failure.**

**The same pair caught the lead chat a few hours earlier, costing a twelve-minute suite run
discovering something already fixed.** Two agents, same night, same pair.

### ✅ What made it cheap was refusing to fix it

**I held off repairing all five because they were other lanes' files, and reported instead.** That
instinct was worth more than the diagnosis: **five good-faith fixes written here would have been a
second, divergent answer to each of five guards, and the next fold would have had to reconcile two
correct repairs.** ⚠️ **A red in a file you do not own is a question, not a task** — and the
cheapest possible answer, "is there a commit I have not folded?", is the one to ask first.

### How to apply

- **Before diagnosing a post-fold red, ask whether the peer has a LATER commit you skipped.**
  `git merge-base --is-ancestor <their-fix> HEAD` answers it in one second and costs nothing when
  the answer is no. Do this BEFORE reading the failure, not after.
- **When you publish a field, event or type that trips enumerating guards, say in the commit message
  that the answer is a separate commit and name it.** A fold is done by somebody reading SHAs, not
  reading your intent.
- **Verify the peer's "it is already fixed" yourself** — it is a status claim about someone else, and
  those expire ([[a-status-claim-about-someone-else-expires]]). One `--is-ancestor` on their SHA and
  one on yours.

Related: [[a-status-claim-about-someone-else-expires]], [[read-the-failure-message]],
[[a-merge-of-a-branch-name-is-a-claim-about-a-moving-target]], [[gate-wrappers-mask-exit-codes]],
[[not-an-ancestor-is-not-unfolded-work]].
