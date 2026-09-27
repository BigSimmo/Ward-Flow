---
name: a-clean-worktree-is-not-an-empty-one
description: "Safe worktree sweeps on this machine — why git-clean is not loss-free, how a wrong glob faked an 80/80 result, and the 'initializing' lock that makes stale entries unprunable forever"
metadata:
  node_type: memory
  type: project
  originSessionId: 78a1f8ba-8ebd-47af-9e6c-674b54499d41
  modified: 2026-09-07T11:28:30.245Z
---

**Measured 2026-09-07**, sweeping 196 worktrees down to 135 with the owner's approval. Four things
that are not obvious and each of which nearly produced a wrong answer.

## 1 The loss question has one correct framing, and "merged" is not it

🔴 **Removing a worktree folder cannot delete a branch or a commit.** Refs live in the shared
`D:/Repos/Database/.git`; a worktree folder is only a checkout. **Proved, not assumed** — resolved a
branch belonging to a _different_ worktree from inside mine and it answered.

⚠️ **So "unmerged" is the wrong axis and overstates unfinished work badly**: a squash-merged PR's
commits are never ancestors of `main`, so landed work reads as unmerged. **The axis that matters is
UNCOMMITTED.** Report it that way or the owner is told 109 folders hold unfinished work when they
hold none.

## 2 🔴 `git status` clean is not "nothing to lose" — ignored files are invisible to it

A folder can be spotlessly clean and still hold `.env.local` or local notes, because `--porcelain`
omits ignored paths. **Check `--ignored=matching` and subtract the build junk** (`node_modules`,
`.next`, `coverage`, `.turbo`, `tsbuildinfo`, `playwright-report`).

## 3 ⚠️ AND MY CHECK FOR THAT WAS ITSELF WRONG — `ls .env*` matched a TRACKED file

The probe reported **all 80 candidates hold a private `.env`**. They held `.env.example`, which is
**committed to the repo**. The real number was **two**. A 40× overstatement that read as a
catastrophic finding.

🔴 **The tell was the number being too round: 80 of 80.** A hazard that afflicts _every_ member of a
population usually means the probe matched something structural. Same family as
[[a-clean-result-from-measuring-nothing]] — but inverted: a false POSITIVE from a glob that was
never as specific as its name suggested. **Name the exact files, never a glob, when the glob's
purpose is to find the unusual one.**

## 4 🔴 An interrupted `git worktree add` leaves a lock that blocks prune FOREVER, silently

Three dead registrations survived every prune because each admin dir under `.git/worktrees/<name>/`
carried a `locked` file reading **`initializing`** — the lock git sets _during_ creation and removes
on success. Killed mid-setup, it is never cleared, and **`git worktree prune` skips locked entries
without printing anything about them.**

- The admin dir name is **not** the path basename (`d1ae/Database` was administered as `Database24`)
  — find it by grepping each `gitdir` file, never by guessing the name.
- Other fingerprints of the same interruption: a **stale zero-byte `index.lock`**, and an **empty
  `commondir`**, which is what makes git answer `fatal: not a git repository: (NULL)` for a folder
  whose link is actually fine. ⚠️ **I misdiagnosed that as a broken link and had to correct it.**
- Clearing one: confirm the folder is gone, `git worktree unlock <path>`, then `prune --dry-run
--verbose` and read what it lists **before** running it for real.

**How to apply:**

1. **Tier by staleness, not by tidiness.** Anything written to in the last 24h may hold a session
   from a tool you cannot enumerate — Codex and Antigravity sessions do not appear in `ListAgents`.
   File mtime is the only signal available for those, and it is an inference, so say so.
2. **`git worktree remove` (never `rm -rf`)** — it re-checks dirtiness at removal time, which your
   audit, minutes old by then, cannot.
3. **Re-verify clean immediately before removing**, and afterwards **prove every branch still
   resolves**. 58 checked, 0 lost, is the sentence worth being able to write.
4. ⚠️ **`protect-ward-flow.sh` blocks `worktree prune` even with `--dry-run`**, and blocks any
   command _containing_ one — so a read-only batch fails as a whole. Split the reads out.

Related: [[never-delete-worktrees-unasked]], [[worktree-sweep-destroys-live-work]],
[[protected-work-and-backups]], [[read-the-failure-message]].
