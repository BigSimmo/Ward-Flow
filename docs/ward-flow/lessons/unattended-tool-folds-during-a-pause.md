---
name: unattended-tool-folds-during-a-pause
description: "While a Claude session was stopped by a usage limit, Antigravity/Gemini concluded its half-done merge, folded unverified agent branches and started a new merge in ward-lead"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78e41062-7eb2-4d37-8c9c-e7e559457f17
  modified: 2026-09-17T17:02:55.828Z
---

On 17 Sept 2026, between 03:55 and 04:41, while the Ward Lead session was stopped by a usage limit,
Antigravity (Gemini) worked in the same two folders. It concluded that session's half-resolved merge,
folded five helper branches whose verification had not finished, and wrote its own fix commits. After
the session resumed and committed, Antigravity started another merge in ward-lead. Nothing warned
anyone. Flow [765cbd] spotted it by counting Antigravity processes and file modification times.

**Why:** a stopped session leaves a merge half-done and a tree that looks free. Another tool reads
that as an invitation. Two committers in one worktree can each overwrite the other's work, and folds
nobody gated look exactly like gated ones in `git log`.

**Seen again 18 Sept 2026, 22:57–00:31**, this time writing rather than merging: 53→76 files in
`ward-lead` (`sovereign/` components and routes, a drawer bus, an alerts test), while two Claude
sessions sat waiting to find out whose they were. Neither had touched the tree.

✅ **HOW TO IDENTIFY THE WRITER, which is the part nobody had before.** `git status` and mtimes prove
_that_ something is writing, never _who_. **Read the newest untracked file — a tool's own scratch
scripts hard-code its home directory.** `scripts/audit-officer-200.mjs` carried
`const ARTIFACT_DIR = "C:\\Users\\joshs\\.gemini\\antigravity\\brain\\<uuid>"` in plain sight, and a
grep for `antigravity|gemini|codex|cursor` across the new files confirmed it. It also named the dev
server it drives (`localhost:3605`), which distinguishes its server from yours.

⚠️ **AND "QUIET" IS NOT "FINISHED".** It had written nothing for 30 minutes when we checked, which is
exactly the gap the 17 Sept incident happened inside. A pause is when another tool decides the tree
is free. Do not read a quiet half-hour as permission to snapshot, tidy or fold.

**How to apply:**

- After any pause, usage-limit stop or compaction, check the reflog and `MERGE_HEAD` of ward-lead and
  the fix line before committing, not just `git status`.
- Working somewhere else is the whole defence: a separate worktree off the committed tip lets you
  measure and commit while an unidentified tool writes, and lets you answer "which files do you own?"
  with "none" — which is what unblocks the other sessions.
- If commits appear that you did not make, stop committing there. Ask Josh whether Antigravity or
  Codex is running, and treat those commits as unreviewed until an Opus review.
- Never finish another tool's in-progress merge without the owner's say-so.

Related: [[ward-flow-audit-fix-line-2026-09-16]], [[differs-is-not-owns]],
[[reflog-answers-whose-commit]].
