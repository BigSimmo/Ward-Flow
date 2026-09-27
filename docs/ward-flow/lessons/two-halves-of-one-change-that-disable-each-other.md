---
name: two-halves-of-one-change-that-disable-each-other
description: "When one part of a change enables a condition another part does not handle, both parts pass in isolation and the combination is what breaks — and the combination is the state you are shipping"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 272cfee6-4b66-4c8f-bdcf-93a1b3add32c
  modified: 2026-09-17T17:53:31.378Z
---

A change with two parts gets verified one part at a time. Each passes. The defect lives only in
the state where **both** are active — which is the state that actually ships.

Measured 2026-09-17/18 on PR #2853, found by adversarial review and not by any gate:

- Part A declared three Sentry build arguments in the Dockerfile, so an operator could finally
  enable source-map upload. Verified: the arguments reach `npm run build`.
- Part B recovered a route pattern by matching stack-frame filenames containing `/.next/`.
  Verified: 19 tests, real fixtures taken from live Sentry events.
- **Enabling upload makes `withSentryConfig` install the SDK's `DistDirRewriteFrames` integration,
  which rewrites every frame to `app:///_next/...` before `beforeSend` sees it.** So the instant
  Part A was used, Part B stopped matching and every event fell into one `unrouted` bucket —
  silently, and worse than the splintering the PR existed to fix.

The fixtures were correct _for the current state_ and wrong for the state the PR was creating.
Nothing could have caught it: the tests, the types and the reviewer all agreed with the picture I
had, because I wrote all three.

**Why:** the mental model is "my change does X" and "my change also does Y", never "X changes the
environment Y runs in". The enabling part usually looks like configuration, so it does not feel
like behaviour at all.

**How to apply:** when a change has a part that _enables_ something and a part that _consumes_
something, ask explicitly what the enabling part alters for the consumer — then read the enabled
code path's source, not its documentation. Write at least one fixture in the post-enablement
shape. The question to ask out loud is: **"what does the world look like after my own change is
switched on, and have I tested that world?"** A staged rollout makes this worse, not better: the
two halves land together and are exercised weeks apart.

Related: [[half-a-fix-can-be-worse-than-none]], [[a-declaration-is-not-an-effect]],
[[the-artefact-you-search-is-not-the-artefact-that-runs]], [[a-test-co-authored-with-the-code]],
[[the-fixture-your-tests-render]], [[a-scrubber-that-removes-the-evidence]]
