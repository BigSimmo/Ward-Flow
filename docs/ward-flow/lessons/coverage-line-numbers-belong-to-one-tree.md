---
name: coverage-line-numbers-belong-to-one-tree
description: "A coverage report maps onto source only in the tree it was measured in; ward-lead's reducer is 16 lines longer than the ward line's, so per-line answers would be precise and about the wrong statements."
metadata:
  node_type: memory
  type: reference
  originSessionId: 2d57ae3e-f800-40ce-8184-f96d852a4bbe
  modified: 2026-09-18T15:21:06.738Z
---

Measured 2026-09-18. `ward-flow-reducer.ts` is **7238 lines in
`D:/Worktrees/Database/ward-journey-tooling` and 7254 in `D:/Worktrees/Database/ward-lead`**
— and the difference sits in the refusal area itself (the bed-capacity guard around line
4087). A coverage report from one tree read against the other would put every figure on a
real reducer case and none of them would be about that case.

**Why this shape is dangerous rather than merely wrong:** the answer stays specific and
per-action. Nothing looks off. "Line 4310 was never reached" is a sentence that survives
review in either tree — the reader has no way to notice it is a sentence about a
different statement.

**How to apply:** any tool that reads a coverage report against source it did not measure
must be given the source file the report WAS measured against, and must compare them by
hash — refusing outright on a mismatch rather than warning. `refusal-coverage.mjs` in
`docs/ward-flow/journey/` does this via `WARD_COVERAGE_REPORT` +
`WARD_COVERAGE_SOURCE`, and `prove-coverage.mjs` proves it by feeding a reducer one line
longer. More generally: measure in the same tree the artefact is generated from, or prove
the two trees agree. Uncommitted work in a shared worktree is enough to break the
correspondence, so "same branch" is not sufficient — only the bytes are.

Related: [[a-line-number-is-a-different-number-in-every-tree]],
[[a-flag-that-disables-what-it-configures]], [[ward-flow-journey-artefacts]].
