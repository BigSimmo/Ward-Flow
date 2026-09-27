---
name: reflog-answers-whose-commit
description: "Reachability cannot say who wrote a commit; the per-branch reflog can, and a fold does not erase it"
metadata:
  node_type: memory
  type: reference
  originSessionId: f6e64d99-63e7-48b3-bbdb-2d4ba6f98eac
  modified: 2026-09-05T13:14:18.461Z
---

Two sessions each concluded, independently, that **no git command answers "which chat wrote this
commit"** — and both were wrong for the same reason: we searched _reachability_ and the answer is in
_how each ref acquired the commit_.

⚠️ **A THIRD SESSION REACHED THE SAME WRONG CONCLUSION ON 2026-09-06** — Ward Lead, from the two
correct observations that every chat commits as one author and that a post-fold commit is contained
by every branch — **and asked for "attribution between us is not recoverable from the repository" to
be written into the document all six chats read.** It was disproved in one sweep: `0f6e38520` appears
in exactly one branch reflog, `claude/ward-builder-two-modes`, action `commit:`, and in no other.
**Three independent arrivals at the same false limit is what makes this worth keeping** — the wrong
answer is the one reachable by sound reasoning from true premises, so it will be reached again.

⚠️ **AND I THEN RELAYED THIS FILE'S OWN "twelve vanished branches" AS A MEASUREMENT I HAD JUST
TAKEN.** I had not run it; I read it here and passed it on inside a correction of somebody else's
figure. The peer half-reproduced it with a crude method and honestly said so — which is what made me
check, and it does hold (28 checkout endpoints, 16 resolve, 12 do not, all real branch names). **A
figure quoted from durable notes is a relayed figure, and relaying one INSIDE A CORRECTION is the
most believable place a number can sit** — the frame says "I checked and you did not". Re-run before
correcting somebody with a remembered number. Captured properly on 2026-09-06 to
`docs/ward-flow/archive/dated-notes/commit-attribution-2026-09-06.md` on `claude/ward-builder-four`.

- `git merge-base --is-ancestor <sha> HEAD` answers **"is it in my history"**. After any fold it
  returns true for everyone's work, so it never discriminated.
- `git branch -a --contains <sha>` answers **"how far has it spread"**. It appears to discriminate
  only while a commit still lives on one branch; the next fold makes every commit look alike.
- **Author does not discriminate at all** — every chat on this machine commits as `BigSimmo`.

**The reflog does.** A branch that MADE a commit logs `commit: <subject>`; a branch that RECEIVED it
by merge logs `merge <sha>: Merge made by the 'ort' strategy`. So folding **adds** a different kind
of evidence rather than destroying the original. Map branch → worktree via the ownership registry.

```bash
G=$(git rev-parse --git-common-dir); SHA=$(git rev-parse <ref>)
find "$G/logs/refs/heads" -type f | while read -r f; do
  awk -v sha="$SHA" -F'\t' '{split($1,h," "); if (h[2]==sha && $2 ~ /^commit/){print;exit}}' "$f" \
    | grep -q . && echo "${f#$G/logs/refs/heads/}"
done
```

Line format is `<old> <new> <name> <email> <time> <tz>\t<message>`, so the sha must be the **new**
value and the message must begin `commit`. ⚠️ A loose "file contains the sha and contains the word
commit" gives the right answers for the wrong reason — it matches a sha appearing as the _old_ value
of any line. Iterating branches with `git reflog show` times out (397 branches here); read the files instead.
⚠️ **And `-F'\t'` may not survive an agent's tool layer** — backslash escapes were silently eaten
several times in one night on this machine, and a tab separator that becomes the letter `t` splits on
nothing, finds no message field, and reports "nothing authored this anywhere" — which reads exactly
like a legitimate negative. Use `$'\t'`, or write it in Python, and keep a positive control beside it.
⚠️ **It corrupted THIS FILE on the first write** — both mentions of the escape arrived as literal
tab characters, so the note describing the hazard was itself an instance of it. Build the backslash
with `chr(92)` rather than typing one when writing about escapes.

**Four limits, and the first was found by the control inside the same test:**

1. **A merge commit made by plain `git merge` returns nothing** — its message begins `merge `, not
   `commit`. A merge staged with `--no-commit` then `git commit` logs `commit (merge):` and IS found.
   So this answers _who authored an ordinary commit_, never _who performed a merge_.
2. **Local and expiring** — reflogs never travel, and default expiry is 90 days (30 unreachable).
3. **Rebase or cherry-pick makes a new sha**; the check truthfully names where that sha was made,
   which may not be where the work was done.
4. ⚠️ **DELETING A BRANCH DELETES ITS REFLOG** — `logs/refs/heads/<name>` goes with the ref, so the
   answer survives a fold and does not survive a cleanup. **This is the realistic expiry, not the 90
   days.** Proved rather than assumed: 397 branches and 397 reflog files, zero orphans in either
   direction, while `logs/HEAD` names **12 branches that were once checked out and no longer exist**.
   Zero orphans alone would also be explained by nobody ever deleting a branch; the twelve are what
   make it a proof. On this machine worktrees have been destroyed mid-session twice, so the evidence
   of who wrote what is exactly as durable as the branch nobody has tidied up.

⚠️ **None of it replaces saying what file you are about to touch, before you touch it.** The reflog
only helps once the question is already "who wrote this" — see
[[identical-work-produces-no-conflict]] for why that question arrives too late, and
[[a-correction-that-agrees-with-you]] for why I went looking: the tidy conclusion "stop looking for a
command" was the one everybody had already agreed on.

## Why `%an` can never answer it here, and what that does to agents. 2026-09-06.

**Every commit made by every session on this machine carries the identical author AND committer:**
`BigSimmo`. Checked across three sessions' commits. So `git log --format=%an` — the one field whose
whole job is "who wrote this" — **cannot distinguish any of us, ever, and never returns an error.**

A peer's subagent found a commit sitting over its in-flight work, had no attributable source in
git, and **named a different session that had never touched that worktree** — it took a name out of
the session's traffic because git offered none. **That is the correct behaviour for an agent asked
a question git refuses to answer**, and it produced a false accusation in a report that was about
to be relayed upward.

I cleared myself with **ancestry plus my own branch's reflog** — none of the three commits an
ancestor of my HEAD, 47 reflog entries, zero mentioning the other branch — not by pointing at the
author field, which said `BigSimmo` for me too.

**How to apply:** on this machine, attribution is **ancestry + per-branch reflog**, never `%an`.
Put that in any brief that asks a subagent to work out who changed something, because the next one
will reach for the author field, get a real name, and be confidently wrong. Related:
[[differs-is-not-owns]], [[git-queries-that-answer-instead-of-erroring]].

## ⚠️ "Completed" means STOPPED, not FINISHED

The same incident: a task notification said `completed`, so the controller staged the agent's files
and committed them. **The agent had stopped, not finished** — it resumed, found its own first fix
wrong, and corrected it two commits later. The earlier commit therefore carries a buggy
implementation under a message that does not mention it.

**A notification reports that an agent is no longer running. It cannot report that the agent was
done.** A standing rule of "never write into a worktree a subagent is working in" does not fire,
because the word looks like it satisfies the rule. See [[controller-staging-claims-subagent-work]].

---

## 🔴 2026-09-07: THIS MEMORY EXISTED AND A SUBAGENT STILL GOT IT WRONG — BECAUSE SUBAGENTS DO NOT READ IT

My phase-2 agent found a commit sitting over its in-flight work and reported that **"Ward Builder
Four was committing to this same worktree."** Four has never touched that tree. **The commit was
mine.**

Ward Builder Four verified their own innocence properly and then found the reason the agent could
not have got it right:

```
eef64e3aa   author=BigSimmo   committer=BigSimmo
d922706f8   author=BigSimmo   committer=BigSimmo
                ↑ every commit by every session on this machine, identical
```

⚠️ **The one field git offers for "who wrote this" cannot distinguish any session on this machine,
ever.** The agent had a question git refuses to answer, no attributable source, and did the only
thing available — **it took a name out of the session's traffic.** That is not carelessness; given
the tools, it is close to the correct behaviour.

### The actionable gap

**This memory did not fail. It was never in the room.** Subagents get only the brief I write; they
do not inherit the memory store. So:

- **Any brief where an agent might reason about who changed something must carry the rule inline** —
  `%an`/`%ae` are identical for every session here; use ancestry plus the **per-branch reflog**,
  where the branch that CREATED a commit logs `commit:` and one that merely received it logs
  `merge`/`pull`/`reset`.
- **And better: do not put an agent in that position.** The agent only needed to attribute because I
  committed its work mid-flight (see [[controller-staging-claims-subagent-work]]). Remove the cause
  and the misattribution never arises.
- 🔴 **A wrong attribution names a real person or session, so it travels further and lands harder
  than a wrong number.** It reached me, and I was one relay from passing it to the chat that folds.

Related: [[differs-is-not-owns]], [[controller-staging-claims-subagent-work]],
[[carry-the-antidote-with-the-assertion]], [[identical-work-produces-no-conflict]].
