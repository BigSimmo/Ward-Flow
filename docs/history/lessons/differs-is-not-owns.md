---
name: differs-is-not-owns
description: "A branch that is behind differs from master exactly as a branch that is ahead does; a blob comparison cannot tell the two apart, and neither can git diff A..B"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78a1f8ba-8ebd-47af-9e6c-674b54499d41
  modified: 2026-09-11T05:23:17.398Z
---

Ward Flow, 2026-09-05. I refused to fix a typecheck error because
`claude/ward-builder-community-route` was unfolded **and** held a different blob of the file, so I
routed it to that chat. Two true facts, one conclusion that does not follow. The branch was 31
commits **behind**; its differing blob was master's own blob one commit earlier. Nobody owned the
file. Ward Lead ran an independent blob comparison, reached the same answer, and told me "two
methods, same owner" — **two methods measuring the same wrong thing.**

    commits UNIQUE to the branch that touch the file:  0   (all six live branches)
    branch blob  d173674c6  =  master's blob at 958827a45
    master blob  63797d03e  =  master's blob at d7905eb69

⚠️ **And my first correction had the same defect.** I re-measured with
`git diff <tip>..<branch> -- <path>`, which reports the file as changed for a branch 255 commits
behind, and printed a confident "1" for two branches with **zero** unfolded commits. An endpoint
diff is symmetric; ownership is not.

**Why:** the worktree rule I was following — _"never edit a file that exists on the other live
branch"_ — is stated in terms of a file's existence or difference, which is cheap to check and
answers the wrong question. What makes a file somebody's is **an unmerged commit of theirs touching
it**, and a branch with 0 unfolded commits contributes nothing by definition, however far its blobs
have drifted.

**How to apply:**

    git rev-list --count <master-tip>..<branch> -- <path>     # 0 = they own nothing here

Run that per branch before declining to touch a file, and before routing work to somebody. Say
"differs" only about blobs and "owns" only about unique commits — the words are not interchangeable
and I used them as if they were. When a differing blob turns out to equal an older master blob of
the same path, that is proof of staleness, not of competing work.

Related: [[assert-only-about-code-you-opened]], [[a-correction-that-agrees-with-you]],
[[agreeing-checks-with-one-blind-spot]], [[establish-the-unit-before-counting]],
[[a-control-must-test-the-premise-not-the-measurement]].

---

## 🔴 2026-09-07: NOT MINE ≠ UNFIXED. The same file, the same night, one step further along.

I found `check:design-system-contract` red on `statistics-v4.module.css`, established **correctly**
via the per-branch reflog that the commit was not mine, and then reported to Ward Lead that it was
an **unfixed** defect _"whoever you fold next inherits."_

**It had already been fixed on the lead line, by `d63e836ef`. I was simply behind.**

    git log --oneline $LEAD..HEAD -- <file>     →  empty     ← I read this as "nobody changed it"
    git log --oneline HEAD..$LEAD -- <file>     →  d63e836ef ← never ran until it was too late

⚠️ **Two independent errors, and each alone was survivable.**

1. **Authorship and status are different questions and I tested only one.** "Not mine" is evidence
   about _who_, and I spent it on _whether it is still open_. A defect somebody else introduced is
   precisely the kind most likely to have been fixed by somebody else already — so "not mine"
   weakly predicts **fixed**, and I took it as predicting the opposite.
2. **An empty `A..B` means "nothing on MY side," never "nothing changed."** One range operator, and
   a closed defect reads as an open one. This is [[differs-is-not-owns]]'s asymmetry again from the
   other end: there an endpoint diff was too symmetric, here a range was too directional and I
   forgot which way it pointed.

**How to apply:** before reporting any defect you did not write as outstanding, run the range **both
ways**, and when a fold is in question run `git merge-tree --write-tree <lead> HEAD` and read the
merged blob — it answers "does folding me regress this" directly, instead of by inference. Mine
kept the token; there was nothing to route.

🔴 **And the fix I nearly volunteered would have been right for the wrong reason.** The real defect
was that `--duration-fast` becomes `0ms` under `prefers-reduced-motion`, so the literal `120ms`
animated for a reader who had asked the OS for no animation — an accessibility defect wearing a
style-ratchet's clothing. Substituting the token without reading `d63e836ef`'s reasoning would have
produced an identical diff and learned none of it. **A correct patch is not evidence you understood
the bug.**

⚠️ **This went out in the same message where I corrected myself for asserting a mechanism I had not
checked.** Writing the lesson does not arm it; the correcting frame is where I am least suspicious
of my own claims, which is exactly the finding in [[reflog-answers-whose-commit]] about relaying a
remembered figure inside a correction. Related: [[assert-only-about-code-you-opened]],
[[git-queries-that-answer-instead-of-erroring]], [[observations-expire]],
[[a-correct-diagnosis-that-stops-the-inquiry]].

## Three direction-inversions in one afternoon, each cheap to check and none checked. 2026-09-09, Ward Lead.

All three were stated confidently, all three were wrong about WHICH WAY a relation ran, and each was
caught by a peer rather than by me.

1. **Cause.** "The merge changed package-lock.json and left your install behind." The merge changed
   it by **zero lines**; the lockfile last moved three days earlier. The check was one
   `git show --stat <merge> -- package-lock.json`. Two sessions measured it before I did.
2. **Ownership — AND SEE THE CORRECTION BELOW, WHICH MATTERS MORE THAN THE ENTRY.** I told
   Ward Builder Three that running an install in `ward-builder-three` would be "writing into a
   folder you own", and that I was asking rather than assuming because _they_ were idle. The BRANCH
   was mine — cut by me that morning, holding my agent's commit.
3. **Scope.** "Nothing you have measured in that tree today is trustworthy." A stale `node_modules`
   cannot affect a `git show`, a `merge-base`, or a shell demonstration. Only the one vitest run was
   in question, and its owner had already said so.

⚠️ **The tell they share: each was a claim about a RELATION — caused-by, belongs-to,
affects — asserted from one side only.** A relation has two ends and reads plausibly from either,
so fluency is no evidence at all. **Name both ends and check the one you did not start from.**

🔴 And note what made these expensive rather than embarrassing: **a wrong direction sends the
WORK to the wrong place.** #1 sent three sessions hunting a merge; #2 nearly had a peer trespass into
my tree while I waited for them; #3 would have had good measurements re-run. See
[[a-measurement-is-scoped-to-what-it-measured]] and [[reflog-answers-whose-commit]].

## 🔴 CORRECTION TO §2 ABOVE, SAME DAY, AND THE FIRST VERSION WOULD HAVE CAUSED THE HARM IT WARNED ABOUT

I first wrote that `git branch --show-current` "would have said so" — i.e. that one command
settles who a worktree belongs to. **Ward Builder Four rejected that and was right.**

**There are TWO axes and they are independent:**

    who owns the BRANCH checked out here     git branch --show-current
    who is ATTACHED to this DIRECTORY        the session list (cwd + isRunning)

I owned the branch. **Ward Builder Three's session had that folder as its cwd and was LIVE while we
were discussing it.** `npm ci` deletes and rebuilds the whole dependency folder, so the hazard is a
process holding that tree — and **a live session in a folder whose branch you own is exactly as
dangerous as one whose branch you do not.** The branch answers a question about history; the risk is
about right now.

⚠️ **AND MY PRE-FLIGHT WAS NO BETTER, WHICH I ONLY FOUND BY TESTING IT AFTERWARDS.** I
filtered running processes on `CommandLine -like '*ward-builder-three*'` and got nothing, and
reported the tree unheld. **`Win32_Process` carries no working-directory field at all.** A `vitest`
or `npm` process started _inside_ that folder has no path in its command line, so that filter could
not have seen the exact thing it was written to see. A confident all-clear from a filter that was
structurally incapable of returning a hit — see [[a-clean-negative-that-measured-nothing]].

**How to apply.** Before an install or any wholesale dependency rebuild in a worktree that is not
the one you are typing in: **check the SESSION LIST for a session whose cwd is that folder, and ask
that session.** Do not substitute the branch, and do not substitute a process-name grep. Neither can
answer it. And note the peer's all-clear is scoped to _itself_ — Three said so explicitly:
_"a clear from me is not a clear for the tree."_

🔴 **The general form, and it is the reason this correction is longer than the entry:** when
you catch yourself in an error and write down the cheap check that would have caught it, **verify
that the check actually answers the question** — or the lesson ships a false remedy, which is
worse than shipping no lesson. Mine would have told the next reader to rebuild dependencies under a
live agent on the strength of a branch name.

### The absence does not announce itself, because SIX impostors are present — and they live on TWO LAYERS. Verified three times, 2026-09-09.

Ward Builder Four verified my claim; I verified theirs and found a sixth; Four then found why they
had missed it, which broke my countermeasure. **Everything with a working-directory-shaped name:**

    LAYER 1 — the CIM/WMI schema itself  (Get-CimClass Win32_Process).CimClassProperties
      ExecutablePath          string   -> C:\Program Files

odejs
ode.exe (the BINARY)
WorkingSetSize uint64 -> 37953536 (BYTES)
PeakWorkingSetSize uint32 -> memory
MaximumWorkingSetSize uint32 -> memory
MinimumWorkingSetSize uint32 -> memory

    LAYER 2 — synthesised by PowerShell on top of the object, NOT in the schema
      Path            ScriptProperty   -> C:\Program Files

odejs
ode.exe (the BINARY again)

⚠️ **`Path` IS NOT A WMI FIELD.** `(Get-CimClass Win32_Process).CimClassProperties.Name
-contains 'Path'` is **False**; `-contains 'ExecutablePath'` is **True**. So _"Win32_Process has a
Path"_ is true at the PowerShell surface and false at the WMI level — anyone querying WMI from
another language, or reading the class docs, will not find it. **Say which layer, or the entry
misleads.** (Same two-axes problem as branch-versus-session above, one hour apart.)

🔴 **THE ENUMERATION HOLE, AND IT DEFEATS THE COUNTERMEASURE I WROTE.** I had recorded:
_"a name-based check on a property list is not a check — read a VALUE from it once."_ That is
insufficient. **A value check only audits the members you enumerated; it cannot audit the
enumeration.**

    Get-Member -MemberType Property    (singular)  -> 5 hits, Path ABSENT
    Get-Member -MemberType Properties  (plural)    -> 6 hits, Path present
    Path's actual MemberType                       -> ScriptProperty

`-MemberType Property` excludes ScriptProperty. **Four's pattern `Dir|Path|Cwd|Work` matched `Path`
perfectly well and never saw it, because it was filtering a list `Path` was not in.** And I only
found the sixth because my default happened to be the plural, inclusive form — **not better
method, a different default.**

**The countermeasure, both halves required (Ward Builder Four's repair):**

> **Enumerate WITHOUT a member-type filter, then read a value.** `Get-Member` bare, never
> `Get-Member -MemberType Property` — a synthesised member is exactly the kind that carries the
> seductive name.

🔴 **AND "THEN PRINT A VALUE" IS NOT ENOUGH EITHER — I WROTE THAT AND IT IS FALSE HERE.**
Ward Verifier broke it. Printing catches only the obviously-wrong TYPE:

    WorkingSetSize  -> 37953536                            printing CATCHES it
    Path            -> C:\Program Files

odejs
ode.exe printing does NOT — a real path
ExecutablePath -> C:\Program Files
odejs
ode.exe
Path -eq ExecutablePath -> True <- THE tell

**`Path` yields a genuine absolute filesystem path, so reading it proves nothing.** The property
exists, returns a value, and the value is exactly the shape you were hoping for. The only thing that
exposes it is that **it is byte-identical to a property whose meaning you already know.**

> **Reading a value proves a property EXISTS; only a KNOWN ANSWER proves it MEANS what you think.**
> Compare a suspect property against one whose meaning you already have, on a subject whose answer
> you can predict. — Ward Verifier

That is the positive-control principle — which I had been applying to test sweeps all day —
working one level down, on a single property. **I did not think to apply my own rule to the
instrument I was auditing with.**

**How to apply.** A process's working directory is NOT available from `Win32_Process` on either
layer, nor from `CommandLine`, which holds only what was typed. To learn which directory a session
is operating in, use the session list (cwd) or ask the session.

## 🔴 A DIFF AGAINST THE WRONG BASE READS AS VANDALISM. 2026-09-11, Ward Lead, one command from a false accusation.

Reviewing a 42-file shell-mount branch before folding it, I diffed it against **the line's tip** and read:

    42 files, 367 insertions, 840 deletions
    tests/ward-nav.test.ts   -235
    six removed tests, the first named "…(anti-vacuity floor)"

I was composing the finding — _a worker deleted this morning's guards, and did not record the
reduction the repo requires_ — when I checked the merge base. **It is `b8b6c21576`, which PREDATES
the task-7 fold those tests arrived in.** They were never on that branch to remove.

    base    34 cases      mount added   0 cases   (its +49/-16 rewrote bodies, added none)
    line    40 cases      task 7 added  6 cases
    merged  40 cases      union intact, nothing lost

⚠️ **`git diff A B` between two DIVERGENT tips reports the other side's ADDITIONS as this side's
DELETIONS.** The endpoint diff is symmetric (this file's founding lesson) — but the _reading_ is not,
because a deletion is an accusation and an addition is not.

🔴 **What made it nearly fatal is that the false story was more compelling than the true one.** The
figures were large, the losses were test-shaped, and the single most alarming test name — the one
with "anti-vacuity floor" in it — sorted to the top of the list. **A wrong base does not produce
noise; it produces a coherent, specific, well-evidenced narrative about someone else's conduct.**

### 🔴 I REPEATED IT FOUR HOURS LATER, AND THE SECOND TIME IT REACHED THE OWNER

Same day. I sized the **entire remaining programme** with the same command and told Josh
**"twelve of the sixteen screens are built but unmerged."**

    git diff --name-only <line>..<lane> | grep -c '^src/'   ->  52 · 44 · 59
    from each branch's own merge-base                       ->   1 ·  1 · 12

The lanes were 88–124 commits **behind**, so the line's own work — most of it mine, from that day —
counted as theirs. ⚠️ **`--name-only | grep -c` counts files correctly. The RANGE was the lie**, which
is why the command survives inspection.

🔴 **THE NEW LESSON, AND IT IS THE IMPORTANT HALF: a FLATTERING number gets less scrutiny than an
alarming one.** The morning's bad range alleged vandalism by a colleague and I verified it before
sending. The afternoon's alleged that the project was nearly finished — and I relayed it twice,
unchecked, and allocated four chats on it. **Same defect, same day, opposite emotional valence,
opposite amount of checking.**

Caught by the lane it described, which measured its own branch and said so. ⚠️ **Its account of the
mechanism was wrong** — it assumed I had misread a `+52` line-count column — **and I had to correct
the correction.** Being caught is not the same as being explained.

**How to apply.** Before reading ANY diff as a record of what somebody did:

    git merge-base <theirs> <yours>      # then diff from THAT, never from your tip

**And apply it hardest when the answer is good news.** A number that says the work is nearly done is
a number about to be repeated to somebody who will plan around it.

And before reporting removed tests, reconcile the three counts — base, each side's additions, the
merge — until they add up. If they add up, nothing was lost and the diff was lying about direction.
Related: [[not-an-ancestor-is-not-unfolded-work]],
[[compare-against-merge-head-not-the-branch-name]], [[a-status-claim-about-someone-else-expires]],
[[arguing-for-your-own-file]].
