---
name: compare-against-merge-head-not-the-branch-name
description: "A branch name resolves at read time, so comparing a merge result against it reports work that landed after you started as work you dropped"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9196936a-67c8-429f-8951-37f5069dea95
  modified: 2026-09-06T04:22:22.254Z
---

Reconciling duplicated work on 2026-09-06, I counted test cases on the merged tree against
`codex/task-ward-flow-live-state-20260831` and found a file with **16 cases where the branch had
17**. That reads as exactly the thing the reconciliation was supposed to prevent: a dropped
assertion.

**Nothing was dropped. The integration branch had advanced twice while my merge was open**, and the
extra case was in a guard that landed after I started. My merge was against `ddb0dbcec`; the name
now pointed at `cdc18e376`.

**Why the shape is dangerous:** a branch name is resolved at read time, so a comparison written the
obvious way silently changes its own baseline between the merge and the count. The result is a
_false positive in the most alarming direction_ — it accuses you of losing someone's work, and the
natural next move is to go hunting for a case that was never there, or worse, to report it to the
person whose work you supposedly dropped.

**How to apply:** when measuring anything about a merge, resolve the parent ONCE and use the SHA —
`git rev-parse MERGE_HEAD` during a merge, or the recorded SHA afterwards — never the branch name.
Say which SHA the numbers are against when reporting them, so the reader can tell a real loss from a
moved tip. **And the tell that saved it here: `git log <mine> --not <master> -- <file>` was empty —
my branch had never touched that file, so it could not have dropped anything from it.** A number
that is impossible rather than merely surprising is the one worth re-deriving.

Related: [[observations-expire]], [[a-measurement-is-scoped-to-what-it-measured]],
[[identical-work-produces-no-conflict]], [[squash-merge-lands-a-subset]].
