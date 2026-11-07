---
name: prove-the-task-is-still-outstanding
description: Before starting assigned work, prove the thing asked for does not already exist; on Ward Flow, take tasks only from Ward Lead
metadata:
  type: feedback
---

**An assignment is a statement about the past, not evidence the work is outstanding.** On
2026-09-01 I was assigned WF-BUILD3-001: build a permanent check that a dynamic route's literal
prefix appears in source. The brief was detailed and current — eight named falsifiers, three
blocking, written by Ward Verifier. **It was already implemented**, in `tests/ward-nav.test.ts`,
at the same scope, with every one of those eight falsifiers already handled. I found it only
because a comment in an unrelated file named the test. Nobody in the chain knew.

**Why:** the people writing assignments are building at the same time as you, in other worktrees,
on branches you cannot see with `cat`. A brief written 40 minutes ago can describe work that
landed 90 minutes ago. Nothing in the assignment can tell you this — its detail and freshness are
not evidence, and a well-argued brief is the _most_ convincing way to be sent at finished work.
Josh's instruction, 2026-09-01: only take tasks from Ward Lead, and assess first that the task is
truly outstanding and not stale.

**How to apply, before writing any code:**

1. **Search for the thing itself, not the task.** If asked for a test, grep `tests/` for what it
   would assert. If asked for a feature, grep for its user-visible strings. One command, and it
   is the command most likely to end the task.
2. **Follow the comments.** The existing implementation was named in a code comment, not in any
   doc, ledger or handover. `grep -rn` the subject across `src` and `tests`, not just docs.
3. **Check the other branches, not just yours.** `git rev-parse <branch>:<path>` and
   `git diff --name-only $(git merge-base <branch> <master>) <branch>`. A sibling chat's work is
   invisible to `cat` and to a master-only name check — see [[ward-flow-ledger-system]].
4. **Confirm the source.** On Ward Flow, work comes from Ward Lead. A registry row, a doc, a
   remembered plan or my own inference is not an assignment. Ask; do not infer.
5. **Report the duplication as the deliverable.** "This already exists, here are the line numbers"
   is a better outcome than a second weaker copy beside a stronger one — especially when the
   original is a file I am forbidden to edit and so cannot merge into.
6. **Distrust the version that flatters the plan.** The scout that said "your check works fine"
   was wrong; the one that said "it already exists" was right and was the conclusion I already
   wanted. Verify both in the file, with line numbers. See
   [[check-the-conclusion-that-flatters-the-theme]].

Related: [[ledger-rows-lag-reality]] is the same failure for ledger rows rather than assignments —
twelve of twenty open rows were already fixed. [[observations-expire]]: state every branch fact
with its SHA, because a sibling branch moved twice during one investigation.

## ⚠️ AN ASSIGNMENT THAT NAMES A FILE, A CAUSE AND A COUNT IS THREE CLAIMS. 2026-09-04.

I was handed: _"`system-state.json` records a `checkout` absolute path that no longer exists,
because the master worktree was renamed on 2026-09-02. Fix the recorded path."_ Concrete, plausible,
and a fix I could have made in one edit.

**Every specific was wrong.**

| claimed                         | measured                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------- |
| the file is `system-state.json` | it is `live-state.json`; system-state has **no absolute path at all**         |
| cause is the worktree rename    | the renamed worktree **exists and resolves**; so does the other absolute path |
| one stale path                  | **three of five** are dead — a 60% rot rate                                   |

**The fix as described would have been made, committed, and changed nothing** — the validator fails
on the first dead entry, so repairing one only surfaces the next.

> **Run the failing thing and read ITS message before repairing what a message ABOUT it said.**

One real run gave the true subject (`ward-verifier`), the true file, and the true count. Everything
above came from that, not from doubting my colleague.

## 🔴 And check whether the record CAN be edited before promising to edit it

Two neighbouring records here are **content-addressed: the filename is byte-equal to the file's own
sha256** (verified with `sha256sum` against the basename). Editing a path inside one destroys the
identity it exists to provide. **"Fix the recorded value" is not always an available operation** —
and the file that _was_ editable turned out to be a different one entirely.

**Ask which layer owns the defect.** Three dead paths in a directory with a documented history of
being wiped is not a data error to patch; it is a field that should never have held an absolute
path. Recording the BRANCH and resolving the path from `git worktree list` survives both a
`git worktree move` (git updates its own pointers; a JSON copy cannot follow) and a wipe-and-recreate.

⚠️ **Report and recommend rather than rebuild, when the contract belongs to someone else** — three
other sessions' gates read that validator. Say what you would build and why, and ask once.

Related: [[a-distribution-error-inflates-a-quote]], [[read-the-failure-message]],
[[assert-only-about-code-you-opened]], [[observations-expire]].

## 2026-09-04: a brief hands you its premise for free, and I amplified one into a headline

The worst instance yet, and it was my own top finding. A brief said _"Confirmed reachable, the button
is enabled, and clicking it silently does nothing"_ and asked me which of three mechanisms explained
it. **I answered the question and never tested the premise.** I proved the mechanism properly — drove
the reducer, built a control, showed the refusal — and the reducer knows nothing about which rows the
screen lists. A list filter excluding closed movements had landed **an hour before**, so at the tip I
cited there was no row and no button. I then escalated it to "the worst class of defect on this
prototype", and it was written into the fold rules and assigned to a builder.

⚠️ **A narrow question implies its premise is settled.** Being asked "which of three?" is not
evidence that "whether at all" was checked. The narrower and more expert the question, the more the
premise rides in unexamined — and answering the narrow part _well_ is what makes the whole thing
persuasive.

⚠️ **Symptom to watch: I proved the half I knew how to prove.** Driving the reducer was the part I was
good at. Reachability needed a different artefact — the screen's own list filter — and I never opened
it. **Check which half of a claim your method can actually reach, and say so about the other half.**

**How to apply:** when handed a defect to explain, re-establish that it occurs, at the ref you are
about to cite, before explaining why. One `git log -S` on the guarding line would have cost thirty
seconds. Related: [[observations-expire]], [[a-correction-that-agrees-with-you]],
[[relayed-numbers-lose-attribution]], [[assert-only-about-code-you-opened]].

## A status line that is TRUE and still sends you to the wrong place — 2026-09-06

A ledger row read _"DECIDED, NOT BUILT — no 48-hour rule anywhere in ward source; every 48 is a
breakpoint or an unrelated count."_ **Accurate.** I verified it myself before starting. It is also
how both of us came to expect an empty field.

**Half the ruling was already shipped.** `Admission.awayAtEmergencyDepartmentSince` had existed
since the same day as the ruling, and its own doc comment said _"the ward is holding the bed
because they are coming back"_ — which IS the below-threshold behaviour. **The behaviour had been
built without the figure**, so a search for the figure found nothing and reported it as unbuilt.

⚠️ **The status was derived from searching for the ARTEFACT and stated as a fact about the
BEHAVIOUR.** Nothing in the sentence is false; the inference from it is. And a coordinator on the
same line made the mirror error the same night — searched the source for an implementation and
reported on the DECISION.

**How to apply: before building from a "not built" row, search for the BEHAVIOUR in the ruling's own
words, not for the token you would have used.** Here: "holding the bed", "coming back", "away at" —
none of which contain a 48. **The cheapest version is to grep the ruling's nouns**, and it takes one
command. Then say which you searched, because "not built" and "the figure is absent" are different
claims and only one of them licenses building.

Related: [[measure-the-thing-not-a-proxy]], [[ledger-rows-lag-reality]], [[a-mention-is-not-an-assertion]].
