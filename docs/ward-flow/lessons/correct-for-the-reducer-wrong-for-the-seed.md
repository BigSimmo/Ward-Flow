---
name: correct-for-the-reducer-wrong-for-the-seed
description: "A predicate can be exactly right for every state the code can produce and wrong for the hand-authored fixture, with every test green and nothing to warn you"
metadata:
  type: feedback
---

2026-09-04. A model decided whether a ward's bed was already reserved by checking the movement's
`stage`. That was wrong: a step-back event moves the stage backwards while deliberately leaving the
bed held, so the model subtracted the same bed twice and reported wards as oversubscribed.

**The fix looked perfect and was verifiable.** `pullExpiresAt` is written by the one event that
decrements the bed, in the same object literal, and cleared by the one event that restores it, in the
same literal. Two writers in the whole reducer. **Exactly co-extensive with the reservation.** I
switched to it. Every test passed. `tsc` was clean. Lint and formatting were clean.

⚠️ **Then I re-ran a fixture measurement I had taken an hour earlier for an unrelated reason, and the
numbers had moved: 15 reserved claims down to 7, three oversubscribed wards up to five.** Eight of
the fifteen seeded movements standing at a pulled stage carry no `pullExpiresAt` at all — **states the
reducer cannot produce, because the seed is hand-authored.**

**The predicate was right about every reachable state and wrong about the data actually loaded.**
Nothing in the test suite, the type system, or the linter can see that gap: the fixture is valid
data, and the new rule was defensible for it in the sense of not crashing. It simply meant something
different.

**The rule that survived is a disjunction** — the stage half carries the authored seed, the marker
half carries the state the reducer can reach — with a mutation proving each half load-bearing.

**How to apply:**

- **When changing a predicate over model data, re-run a measurement over the real fixture before and
  after, and compare the numbers.** Not the tests: the tests use fixtures you wrote for the tests.
- **A hand-authored seed is a second implementation of the model's rules**, written by people, and it
  drifts from the reducer. "The reducer cannot produce this" is not the same as "this does not
  occur".
- The only reason this was caught is that a number existed from an earlier, unrelated measurement.
  **Take a baseline measurement before a behavioural change even when nothing asks for one** — it
  costs a minute and it is the only instrument that can see this class.

Related: [[a-green-mutation-over-inert-machinery]], [[the-suite-never-tests-the-absence]],
[[measure-the-thing-not-a-proxy]], [[observations-expire]], [[fields-with-no-producer]].
