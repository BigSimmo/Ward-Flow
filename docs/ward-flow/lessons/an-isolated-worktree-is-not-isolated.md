---
name: an-isolated-worktree-is-not-isolated
description: "Antigravity commits into other sessions' worktrees and branches, and rebuilds silently drop other sessions' committed work — a clean merge is not a safe one"
metadata:
  node_type: memory
  type: project
  originSessionId: d9f6d3ee-6105-489f-896e-5c1538d8238d
  modified: 2026-09-17T20:24:21.277Z
---

**Measured 2026-09-18, in one night.** A Claude session created a private worktree
(`ward-audit-realdata-20260918`) on its own branch precisely to stay clear of Antigravity (Gemini),
which was writing `ward-lead`. At 04:12 **Antigravity committed into that private worktree, on that
branch** (`2ed6b7196a`). The commit was benign — it fixed its own `patient-now-adapter` types — but
the assumption was not.

🔴 **A separate worktree buys you a separate working tree, not an owner.** Nothing on this machine
stops an unattended tool entering one. "Nobody else is in here" is not a thing a session can assume.

## The three ways it bit, all in one fold

1. **A concurrent rebuild re-introduced what a sweep had removed.** Antigravity rebuilt
   `legal-forms-screen.tsx` and `ed-screen.tsx` while a wording sweep was removing statutory chrome
   from them. Taking the rebuild and re-applying the rule, the committed guard found **seven**
   reintroduced claims — "Statutory Forms Registry", "Issue Statutory Form", "MHA 2014 Authorities",
   "Legal deadline passed". ⚠️ **A sweep is undone by the next rebuild and nothing says so. Build
   the guard first; the guard is the deliverable, the sweep is just its first run.**
2. **The rebuild silently deleted a control another session had committed.** The "No transport
   needed" button vanished in a **textually clean merge** — different regions, no conflict. Only
   `ward-event-reachability.test.ts` would ever have noticed. 🔴 **`git merge-tree` returning clean
   says nothing about whether the merge preserved behaviour.**
3. **A file arrived mid-write and malformed.** `screen-verification.json` was captured with broken
   JSON in a protective snapshot. Snapshotting a live tree has this cost; it is still smaller than
   merging over it, but check generated/structured files parse before relying on them.

## How to apply

- **Before folding, re-check the files you changed still contain your change.** Not the diff — the
  file. A clean merge can drop a whole block.
- **Prefer a committed gate to a completed sweep.** Ask "what goes red when someone undoes this?"
  If the answer is nothing, the sweep is decoration.
- **After any pause, check `git log` and `reflog` on your OWN branch**, not just the shared line —
  see [[unattended-tool-folds-during-a-pause]], which is the same tool doing the same class of
  thing.
- **Cross-session talk found what no tool reported.** The register-entry-versus-control collision
  ([[two-rulings-that-collide]] shape) was semantic, in two different files, invisible to git. Two
  sessions comparing notes caught it.

Related: [[unattended-tool-folds-during-a-pause]], [[protected-work-and-backups]],
[[a-clean-worktree-is-not-an-empty-one]], [[identical-work-produces-no-conflict]].
