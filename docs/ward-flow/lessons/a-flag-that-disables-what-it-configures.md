---
name: a-flag-that-disables-what-it-configures
description: SUPERSEDED — this claimed --coverage.reporter=json disabled coverage and swallowed the test filter. Both halves were false; see coverage-report-deleted-when-tests-fail.
metadata:
  node_type: memory
  type: reference
  originSessionId: 2d57ae3e-f800-40ce-8184-f96d852a4bbe
  modified: 2026-09-18T15:55:27.181Z
---

🔴 **WRONG. Written and disproved the same day, 2026-09-18.** It claimed that adding
`--coverage.reporter=json` to a vitest run silently disabled coverage and made the run
ignore the positional test filter that followed it.

Neither happened. The flag was irrelevant, and the file count that looked like a swallowed
filter was simply how many test files match `ward-` in this repository. The real cause was
`coverage.reportOnFailure`, which defaults to false and makes vitest delete the coverage
directory after any run with a failing test.

Kept only so the wrong explanation does not get re-derived from the same evidence, which
it fits perfectly. The correct one is in [[coverage-report-deleted-when-tests-fail]].
