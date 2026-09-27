---
name: a-status-claim-about-someone-else-expires
description: "routed not fixed, fixed not folded, assigned not accepted — a sentence describing ANOTHER party's state is true when written and false the moment they act, with no expiry date and nothing that goes red"
metadata:
  node_type: memory
  type: feedback
  originSessionId: f606abe8-feca-4f85-a2e1-0ec2f70e5c18
  modified: 2026-09-10T09:30:30.387Z
---

**Three times in three days, all in my own text, and I had written the warning about it before
committing all three.**

| What I wrote                                         | What was true shortly after                    |
| ---------------------------------------------------- | ---------------------------------------------- |
| "routed, **not fixed**"                              | the peer fixed it within the hour              |
| "fixed, **not yet folded**" (3 clauses, 2 documents) | the integrator folded it                       |
| "subtract **exactly one** canary"                    | the instrument was widened underneath the rule |

**Why:** These are not measurements of my own work — they are **claims about somebody else's
state**, and the other party acting is exactly what makes them false. **They carry no expiry date,
nothing recomputes them, and no gate can go red**, because nothing in the repository knows the
sentence was ever conditional.

**Why it matters more than ordinary staleness:** a stale number invites a re-measure. **A stale
status claim invites ACTION** — a reader chases a defect that is closed, re-fixes what is fixed, or
skips folding something already folded. And the neighbouring failure is the same shape one step
along: **an assignment recorded as though it were an acceptance**, which reserves ground nobody is
working and reads as coverage. A peer withdrew exactly such a self-assignment when told.

**How to apply:**

1. **Write the expiry into the sentence.** Not "not yet folded" but "not folded as of `<sha>` —
   re-check with `git rev-parse <master>:<path>`". A claim that carries its own re-derivation is
   harmless when it goes stale. See [[carry-the-antidote-with-the-assertion]].
2. **Prefer a check to a claim.** Where a one-line command answers it, cite the command instead of
   its answer.
3. **When you predict a clause will go stale, come back and do the touch.** I wrote _"will need a
   further touch by whoever folds their branch"_ and then spent a commit making the prediction come
   true. **A self-invalidating pin is worth nothing unless somebody does the thing it names, and
   that is the half that normally does not happen.** See [[self-invalidating-pins]].
4. **Treat a peer telling you they acted as a prompt to VERIFY, not to edit.** Both times I checked
   two ways — ancestry _and_ the file's actual content — and both times the peer was right; the
   habit costs one command and the alternative is publishing their claim as my own.

Related: [[observations-expire]] (numbers, not statuses), [[a-retraction-does-not-travel]] (my own
withdrawn claims), [[a-merge-of-a-branch-name-is-a-claim-about-a-moving-target]] (the same problem
inside a fold message), [[ledger-rows-lag-reality]] (the instance scoped to issue rows),
[[squash-merge-lands-a-subset]] (reachable is not landed).

---

## The direction neither of us was watching: a WARNING that expires in transit (2026-09-11)

**Measured every ref in a shared object store — not the ones I expected — and found a peer's repair
sitting uncommitted in their worktree.** Warned them: finished work plus attention moved elsewhere is
this repository's named hazard. **Three commits landed while my message was in flight. It was true at
the head I read and false on arrival.**

**Why this one is different from the rows above:** those were my own stale claims inviting a reader to
act. **This was a correct measurement, correctly method-ed, that aged between the read and the send.**
During a fold a peer's tree has a shelf life in MINUTES. A message is not instantaneous.

🔴 **And the right disposition is to SEND IT ANYWAY, because the costs are wildly asymmetric:**

    a warning that turns out unnecessary     costs one message
    the warning you withhold as "probably
    already handled"                          costs the thing itself

**So do not suppress a staleness warning on the grounds that it may have been fixed by now.** State
the SHA you measured at, so the recipient can date it themselves — _"at `f5e94f813a`, nothing on any
ref carried it"_ — and let them find it stale. **A warning that carries its own measurement point
cannot mislead; one that reads as present-tense can.**

**The peer's own framing, worth keeping:** the method was right (every ref, shared store), the
conditions named were real, and the repository's rule says exactly that hazard. **Being overtaken by
events is not the same as being wrong.**

## 🔴 2026-09-12 — SAY THE FACT YOU MEASURED, NOT ITS CONSEQUENCE ON SOMEBODY ELSE'S TREE

**I handed a peer a tip and wrote: _"it already contains your `3da376a83f`, so this is a fast-forward
for you, not a second merge."_** ⚠️ **The first clause was a fact about MY tree and it was true. The
second was a claim about THEIRS, and it was false by the time they read it** — their line had moved
on to work I could not see.

✅ **They measured before acting, so it cost nothing. But the merge was not a fast-forward, and I had
told them it would be.**

🔴 **The two clauses look like one sentence and are not.** _"My tip carries X"_ is checkable here and
stays true. _"Therefore this is a fast-forward for you"_ silently assumes their HEAD is still where
they last told me — **which is the one thing a peer's SHA cannot promise, because they are working
while I write.**

**How to apply:** when handing work to another chat, **state what your own tree contains and let them
derive the consequence.** _"Carries `<sha>`; merges clean against `<sha>` as of my last measurement"_
is honest and ages into a dated fact. _"This is a fast-forward for you"_, _"you have nothing to
resolve"_, _"this will merge cleanly"_ are all predictions about a branch you cannot see, and they
are wrong exactly when the other chat has been productive. ⚠️ **The more useful the peer has been
since they last spoke, the more likely your claim about their branch is already false.**

Kin: [[observations-expire]], [[a-merge-of-a-branch-name-is-a-claim-about-a-moving-target]],
[[a-measurement-is-scoped-to-what-it-measured]], [[differs-is-not-owns]].
