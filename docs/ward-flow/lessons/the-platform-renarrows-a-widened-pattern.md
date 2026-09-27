---
name: the-platform-renarrows-a-widened-pattern
description: "I quoted three lines of code I had never opened, from grep slices that did not contain them — and one was reproduced independently because the checker built its replica from my description"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 539fa8a0-8dce-48a5-874e-356072a88101
  modified: 2026-09-12T05:29:08.597Z
---

🔴 **This file originally recorded a measured defect. THERE WAS NO DEFECT. What survives is how I
came to publish one, three times in an hour, on 2026-09-12.**

I claimed `scripts/check-ward-citations.mjs` builds paths with `path.join`, so Windows backslashes
collapsed its corpus to 50 of 522 while it exited 0. **Line 125 is `path.posix.join(dir, entry.name)` —
forward slashes on every platform, the only path join in the file, landed 2026-09-08 in `97701db0c7`.**
The real walk matches 522 of 1678. I had read the file through a `grep -n` window returning lines
115, 118, 126 and 127; **line 125 was not in it, and I supplied it from expectation and set it in a
fenced block as though quoted.** I then measured a replica built from my own assumption, which
behaved exactly as predicted because the prediction was written into it.

Two more the same hour, same mechanism: `~/.claude/hooks/issues-surface.sh` (no such file — the hook
is `.claude/hooks/issues-surface.sh`, inside the repo, and **the owner authorised the change in my
wrong words**, believing it touched every project on the machine); and "the Lead's worktree is gone",
this being the entire justification for releasing a lease by hand instead of via `certify-reset`
(**all three leased worktrees exist**; I had carried across `check-live-state`'s true 5-of-8 missing
paths, which are a different population — see [[a-measured-claim-spent-on-a-neighbouring-question]]).

🔴 **AND IT NEARLY SURVIVED BEING CHECKED.** Ward Lead replicated the first independently, got my
exact number, and believed it — **because it built its replica from my description.** Two
measurements, one instrument. See [[right-conclusion-wrong-evidence]] and
[[a-control-must-test-the-premise-not-the-measurement]]: agreement is evidence only in proportion to
how easily it could have failed to happen.

**Why:** the lesson "verify every path in a brief" was already written in the very document I was
editing. Writing it down did not stop its author repeating it, so it was prose, not a control.

**How to apply — the control, as a procedure:** _before quoting a line of code, open the file at that
line._ A grep window is not the file, and the lines it does not return are exactly where an
assumption passes unchallenged. If a fenced block in your output implies "I read this", you must
actually have read it. Relatedly, never let someone else check your claim from your description of
the artefact — point them at the artefact. See [[the-artefact-you-search-is-not-the-artefact-that-runs]],
[[assert-only-about-code-you-opened]], [[a-retraction-does-not-travel]] (the retraction went into the
plan, not only into chat).

✅ **THE ONE HALF THAT SURVIVES, and it is genuine:** that script's `--selftest` injects its three
impossible citations into the maps **after** the walk, so it exits 1 and names all three whether the
walk found 50 documents or 522. **A self-test placed downstream of the step that selects what gets
examined cannot test that step** — same shape as [[restoring-a-mutated-file]]. A gate that walks a
tree should print its population beside its verdict, with a floor, not just a non-zero check
([[compliance-without-coverage]]).

⚠️ **Unrelated trap, same hour, real:** `npx vitest run --reporter=basic` does not exist in vitest 4.
It fails as a _startup error_ — `Failed to load custom Reporter from basic` — and **exits 1 with no
test having run**, which reads exactly like a red suite. Read the runner's own
`Tests  N failed | N passed` line ([[gate-wrappers-mask-exit-codes]]).

⚠️ **Also real, and recurring on this machine today:** backslashes and em dashes are being eaten in
transit between chats. Five stray `0x08` bytes reached three ward documents from regex `\b` pasted
into prose; Ward Lead's own first attempt produced a raw `0x01` from an eaten sed backreference plus
a mojibake dash. **None was visible in the source. All were caught by running the thing and reading
its output.**
