---
name: tests-that-assert-rendering-not-truth
description: "59 DOM tests over one component passed before and after six false-statement fixes; they assert that things are rendered, never that what is rendered is true of the record beside it"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2b6afefc-3c5d-42e8-9a09-d310ecde7e2f
  modified: 2026-09-03T23:16:48.675Z
---

**A whole DOM suite can assert that every element is present and still not notice that the page is
lying.** Ward Flow, 2026-09-04: six sentences the movement page printed about patients that the same
page's own data contradicted. **All 59 existing DOM tests over that component passed before the
fixes and passed after them.** Not one discriminated.

    arrived and handed over    -> facts panel: patient is in the ED she left
    "Bound for FRE Adult Open, North Metro"   Fremantle is South Metro; North Metro is the ORIGIN
    "Bound for" a ward from two OPEN referrals, beside "No ward has accepted this patient"
    "legal status has not changed", beside a timeline showing an inpatient order 320 min later
    "Nothing was recorded as holding this up", beside "None — handover complete"
    "No synthetic movement matches “WF-”" for a URL that said PT-004

⚠️ **The suite's shape is the defect.** `getByText(...)` proves a string reached the DOM. Nothing
compares that string to the record it claims to describe. Every one of these was found by a person
reading rendered pages line by line — 1731 lines of text across ten pages — after the redesign,
after `tsc`, after 400 unit tests and after a cold read.

⚠️ **Two of the six were "right most of the time", which is why they survived longest.** The service
name only diverges when origin and destination sit in different health services — exactly the
transfer that matters. A defect that is usually correct is invisible to spot-checking AND to a
per-id test written from a case that happens to agree.

**How to apply.**

- **Write the property over the whole fixture, not a sentence pinned to an id.** A per-id assertion
  goes green the moment somebody edits that record, with nobody deciding it should.
- **Floor the population that exercises each branch** — "movements with open referrals and no
  acceptance" — never the violations found. See [[floor-the-denominator-never-the-numerator]].
- **Mutate each fix back and check WHICH test goes red, by name.** Six for six here. And ⚠️ the
  first mutation attempt referenced a symbol the fix had removed, so every render threw and **five
  of seven went red** — a result that looks far more impressive than the real one and discriminates
  nothing. **A mutation that fails everything is as useless as one that fails nothing, and it is the
  more flattering of the two.**
- **Narrow a false positive, never loosen the predicate.** The blocker property first flagged four
  movements carrying `"No blocker"` — the default, carrying no information. Loosening the other way
  is what turns a guard into a passing sweep.

Related: [[the-suite-never-tests-the-absence]], [[a-property-that-does-not-discriminate]],
[[an-absence-promoted-to-a-headline]], [[which-assertion-went-red]],
[[green-mutation-that-changed-nothing]], [[fields-with-no-producer]].
