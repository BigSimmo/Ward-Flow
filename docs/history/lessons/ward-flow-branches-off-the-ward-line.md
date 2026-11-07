---
name: ward-flow-branches-off-the-ward-line
description: "Never branch Ward Flow work off origin/main — main carries MOST of Ward Flow but not the newest files and routes, so the base gap is silent, not obvious."
metadata:
  node_type: memory
  type: project
  originSessionId: 13c6e0ab-aac1-4d38-bec5-622e555c2b64
  modified: 2026-09-06T21:51:39.567Z
---

**Never branch Ward Flow work from `origin/main`. Branch from the ward line's current tip.**

    git rev-parse codex/task-ward-flow-live-state-20260831

⚠️ **CORRECTED 2026-09-07, and the first version of this memory was wrong in the dangerous
direction.** I wrote that a worktree off `origin/main` "contains no Ward Flow at all". **False**, and
a peer measured it:

    src/components/ward-management     origin/main 164 files   ward line 175
    src/app/mockups/ward-flow          origin/main  33 page.tsx  ward line  35
    src/components/ward-management/hub origin/main  ABSENT

**Ward Flow has been landing on `main` for a long time.** What `main` lacks is the newest ~11 files
and 2 routes. **So the failure is silent, not loud: `npm ci` succeeds, the app runs, the ward screens
render, the nav works.** A chat discovers the gap only by rebuilding something that already exists,
or by folding work built on a 33-route base into a 35-route one — the same count collision that
needed hand-resolution on 2026-09-07, except neither side would know a base difference existed.

**My wrong reason was more comforting than the truth, and that is the whole hazard:** "you would
notice immediately" is exactly what somebody will rely on.

**The rule that produced the error:** `AGENTS.md` "Anti-conflict and CI-speed operating procedure"
says _"Start from a fresh `origin/main` worktree/branch (`newtask`)"_, and the session-start banner
repeats it. **Both are correct for this repository and inapplicable to this project, and neither
says so.**

**Also worth knowing: the ward line has DIVERGED from main, it is not merely ahead.**
`git rev-list --left-right --count origin/main...<ward line>` gives **75 behind, 2074 ahead**. The
"2,073 ahead" figure everyone quotes is true and is half the picture; whoever eventually merges Ward
Flow to `main` inherits both directions at once.

⚠️ **The branch NAME moves too** — the master line was `claude/ward-flow-phases-6-7-design` until
2026-09-01. Re-derive it; `docs/ward-flow/control/system-state.json` names the integration branch,
and `~/.claude/worktree-ownership.md` is surfaced at every session start in every worktree.

Related: [[protected-work-and-backups]], [[ward-flow-coordination-state]],
[[not-an-ancestor-is-not-unfolded-work]], [[a-clean-negative-that-measured-nothing]],
[[claims-written-wider-than-their-evidence]].
