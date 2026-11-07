---
name: playwright-kept-build-root-fabricates-reds
description: PLAYWRIGHT_KEEP_BUILD_ROOT makes mutation testing invent failures; two disjoint mutations returned byte-identical failure lists
metadata:
  type: feedback
---

`scripts/run-playwright.mjs` accepts `PLAYWRIGHT_BUILD_ROOT_ID` + `PLAYWRIGHT_KEEP_BUILD_ROOT` to
reuse a build directory, cutting a ~3-minute build to about one. **Never use it for mutation
testing.** Found 2026-08-28 in Caring Contacts Task 21: two mutations touching _disjoint_ files —
one only `globals.css`, one only `sheet.tsx` — returned **byte-identical 26-element failure lists**.
Two unrelated changes do not do that. Re-run on fresh roots, both were green.

**Why:** The reuse serves a stale build, so the browser never sees the mutation and the "failure"
is whatever the previous build was already failing.

**How to spot it:** identical failure counts or identical element lists across mutations that touch
different files. That coincidence is the tell.

**What to do:** re-run the whole table on fresh roots and keep only those verdicts. "The corruption
looks confined" is not a basis for keeping the rest — re-running is cheaper than arguing.

Same family as [[gate-wrappers-mask-exit-codes]] and [[checks-that-cannot-fail]]: the evidence
apparatus producing a confident wrong answer.
