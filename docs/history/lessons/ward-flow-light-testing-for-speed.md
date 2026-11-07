---
name: ward-flow-light-testing-for-speed
description: Josh wants Ward Flow fix waves run fast — helpers test only what they touched; the full suite runs once at the fold
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78e41062-7eb2-4d37-8c9c-e7e559457f17
  modified: 2026-09-16T22:08:29.161Z
---

On 17 Sept 2026, during a many-helper Ward Flow fix wave, Josh said: "Avoid excessive and heavy testing so
the fixes can all be done efficiently for me without a massive run time."

**Why:** helpers ran sweeps across 40 to 110 test files, several tsc runs and mutation proofs per task, all
fighting one shared test lock. Wall-clock time ballooned while each task only needed its own tests.

**How to apply:**

- Helper briefs say: run only the test files you created or edited, plus at most 3 that directly import or
  render the changed module.
- tsc runs once, at the end.
- No mutation proofs unless the finding is itself about a test that can't fail.
- The coordinator runs the full ward suite once, at the fold, before bringing work home.
- This doesn't relax the fold gate; it moves breadth to one place.

Related: [[hand-picked-test-subsets-ship-red]], which is why the fold-time full run stays mandatory.
