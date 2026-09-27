---
name: ward-flow-tests-share-one-instant
description: "Every Ward Flow event fired in a test carries the provider's `now`, which only ADVANCE_CLOCK moves — so four clicks put four events at ONE instant, and any join on `at` alone collides"
metadata:
  node_type: memory
  type: project
  originSessionId: 5e393ec4-f01a-41a0-b49b-d6c9d0bca57b
  modified: 2026-09-06T06:45:06.696Z
---

2026-09-06, Ward Flow. `useWardFlow().now` changes **only** when `ADVANCE_CLOCK` is dispatched. So a
DOM test that clicks four controls dispatches four events **all carrying the same `Instant`**. The
clock is not what separates them.

## Why it mattered

I joined a movement's `stageChanges` to its `unwinds` by `at` **and** `by` (the actor), because the
reducer writes both records inside one update from one event. Mutating the join down to `at` alone
survived all 66 tests — so the actor half was defensive code with no proof, **which is
indistinguishable from unnecessary code.**

The collision turned out to be trivially constructible, not exotic: a **ward's** `RELEASE_PULL` and a
**coordinator's** `STEP_BACK_STAGE` fired in the same test land on the same instant, and the loose
join makes the ward's act print as the coordinator's — wrong actor, wrong act, on the audit trail,
looking entirely legitimate.

## How to apply

- **Any join on `at` in this codebase needs a second key.** Actor, kind, or id — `at` alone is not
  unique even in ordinary use, let alone under test.
- **To separate two events in time, dispatch `ADVANCE_CLOCK` between them** (role `demo`). Nothing
  else moves the clock.
- **Conversely, this makes collision tests easy** — you do not have to contrive a same-instant
  scenario, you have to contrive a _different_-instant one.
- Related: [[a-green-mutation-only-counts-if-the-mutant-ran]], [[the-fixture-your-tests-render]],
  [[a-property-whose-operands-can-coincide]].

## The same session, two more of the same family

**A helper called with a plausible wrong argument answers rather than erroring.** I probed a banner's
reachability with `referralCandidates(referral, referral.destination, …)` where the screen passes
`wardAddressing(referral).destination`. It returned `[]` and I nearly reported the banner
unreachable. It is reachable — on `RF-001`, live. Same family as
[[git-queries-that-answer-instead-of-erroring]]: **derive it the way the screen derives it, or you
have measured a different question.**

**And a proxy is not the property.** A test asserting "no row is about a bed" matched `/bed/i` and
went red on _"has no locked beds (All open)"_ — the ward's **designation**, not its occupancy. See
[[establish-the-unit-before-counting]].
