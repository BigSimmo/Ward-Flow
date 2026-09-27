---
name: a-tolerance-your-change-tips-over
description: A gate with a numeric tolerance passes all session, then reddens on your change because it tipped pre-existing drift past the threshold — the failure names your files but is not your defect
metadata:
  type: feedback
---

`docs:check-inventory` passed early in the 2026-09-18 publication session and failed later on the
same branch. Nothing about my files was wrong: `docs/scripts-index.md` already understated the repo
by 4 script files and 2 npm scripts (drift inherited from `main`), and the gate tolerates a small
gap. Adding 3 script files pushed the gap to 7 and out of tolerance.

**Why:** a tolerance converts a pre-existing, ignored drift into a landmine whose trigger is
_anyone's_ next change in that dimension. The failure message names the current change, so the
natural reading is "I broke this" — and the natural repair (remove or rename my files) is wrong. It
also means an early green on a tolerance gate is not evidence for a later state: the gate's verdict
depends on cumulative repo state, not just on the diff.

**How to apply:** when a numeric gate flips red mid-session, first compare the two numbers it prints
against the same gate on the merge-base before treating it as your defect. If the base was already
drifting, the fix is the gate's own refresh command (here `node scripts/update-docs-inventory.mjs`),
and the refreshed counts legitimately include work that was never yours. Re-run tolerance gates at
the END of a change set, not only when the files are first added.

Related: [[checks-that-cannot-fail]], [[a-guards-condition-is-not-its-population]],
[[observations-expire]].
