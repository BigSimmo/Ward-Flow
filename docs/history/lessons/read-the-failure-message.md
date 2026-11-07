---
name: read-the-failure-message
description: A red test's message often names a different defect than the one you injected; read the number, don't just accept the red
metadata:
  type: feedback
---

**When a check goes red, read what it actually says before recording it as the expected red.** A
failure message that carries a number, a count, or a name you did not predict is reporting a second
defect, and accepting the red discards it.

Caught 2026-08-25 in Caring Contacts Task 6b. A subagent asserted that a SQL anchor string appears
exactly once in a migration, so a scan could safely anchor on it. Its uniqueness control fired at
**`expected 3 to be 1`** — not 2, which the injected mutation would explain. The third occurrence was
inside the mutation's own **comment**: the control was counting prose, so a future comment merely
_discussing_ the anchor would have failed a test while changing nothing. Fixed by stripping `--`
comments before scanning, with a control on the stripping itself.

The subagent's own account of why it caught it is the reusable part: _"it surfaced only because a
failure message carried a number I did not expect and I read it instead of accepting the red."_

**Why:** a mutation proof is designed to produce a red, so a red is the outcome you are hoping for —
which is exactly when confirmation bias is strongest. The gate says PASS-shaped things when it is
wrong (see [[checks-that-cannot-fail]]) and FAIL-shaped things when it is wrong in a _different_ way,
and only the message distinguishes them.

**How to apply:**

1. Before injecting a mutation, predict the failure message, not just "it will be red." Then compare.
2. Treat an unexpected count in an assertion error as a finding in its own right, not noise.
3. Scans that count occurrences in source must strip comments first — this repo already had the
   precedent in its `CREATE INDEX CONCURRENTLY` scan: _a scan that reads its own warning as a
   violation is a scan that reports the wrong thing._
4. A mutation that should leave a gate **green** is evidence too. Over-sensitivity controls belong in
   the ledger beside the red ones, presented as results rather than as non-results.

Related: [[run-the-test-before-prescribing-the-fix]] — same family, one step earlier.
