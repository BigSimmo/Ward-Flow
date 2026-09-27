---
name: corruption-that-makes-checks-pass-harder
description: "A tripled test file passes three times, a truncated stylesheet passes byte-identity, a leaked mutation reports normally — damage whose signature is a stronger green, not a red"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5e393ec4-f01a-41a0-b49b-d6c9d0bca57b
  modified: 2026-09-06T08:16:18.363Z
---

2026-09-06, Ward Flow. Three instances in one day of the same family: **a file damaged in a way that
makes the checks pass MORE, not fail.** A red is a gift; these give you a better-looking green.

1. **A test file appended to itself three times.** 367 lines became 1101, six describe blocks where
   there are two, every added line already present in HEAD. **It does not fail — it passes, three
   times over**, and every count anybody quotes from that run inflates. Found only because an
   unrelated pre-commit hook blocked.
2. **A literal `</style>` inside a CSS comment.** Per the HTML spec a style element's raw text ends
   at the first literal `</style` sequence, comment or not — same trap as `</script>` inside a
   script. The element closed 233 lines early and the page rendered unstyled. **The byte-identity
   guard read from the first `<style>` to the FIRST `</style>`, so the truncated block still matched
   its canonical source exactly and passed. A jsdom parse passed too** — the document is well-formed,
   it just means something other than what its author wrote.
3. **A mutation harness that restored outside a `finally`.** One throw left the file mutated; the
   next five mutations measured a corrupted baseline **while printing perfectly normal reports**,
   each claiming "HASH MATCHES" because each restored to what it found.

4. **Two NUL bytes inside a template literal in a `.ts` source file, 2026-09-10 (Lane A, `corridorCounts`).**
   `` `${a}\u0000${b}\u0000${c}` `` — they sat where spaces were meant to be, in a string used only as a
   grouping key. 🔴 **The 8-case unit suite passed WITH them present**, because a separator made
   of NULs separates exactly as well as one made of spaces. **They were invisible in terminal
   output**, survived into a commit (`815171263c`), and were found only by a deliberate byte scan
   (`open(p,'rb').read().count(b'\x00')`) run for an unrelated reason. `tsc --noEmit` passed;
   prettier passed. **Nothing in the repository looks for them, and I did not establish that
   anything would.**
   ⚠️ **The tell is that there is no tell.** Damage that changes no behaviour cannot be caught by
   any behavioural gate, so `cat`, a diff, a test run and a review all agree the file is fine. When
   a file has been through `sed -i`, an encoding conversion, or any byte-level edit on Windows,
   **scan it for control characters explicitly** — that is the only thing that sees it.

## The common shape

**Every one was correct by every automated measure except the one that matters**, and in each case
the measure that would have caught it was cheap and absent. None of them could fail, because failing
requires an assertion that ranges over the damage, and the damage was outside every assertion's view.

## How to apply

- **When a check reads a delimited region, ask what happens if the delimiter appears twice.**
  `indexOf(close)` is a decision to trust the first one. For style/script blocks the guard is one
  line: exactly one terminator per file.
- **Scan for self-append across a tree periodically** — a file whose own first 300 characters appear
  more than once. 3,177 files in about a second, and it catches a whole class:
  `s.split(s.slice(0, 300)).length - 1 > 1`.
- **Suspect the numbers that got better.** A count that rose, a suite that got greener, a block that
  matched more exactly — those are where this family hides. [[a-summary-line-over-a-broken-run]] is
  the same instinct.
- **Open the rendered thing.** Two agents hit the `</style>` trap; one diagnosed and fixed it, one
  shipped it. The difference was not knowledge — the one who caught it had looked at the page.
- Related: [[an-emptied-population-passes-every-check]] (the mirror: population goes to zero and
  `[].every()` is true), [[restoring-a-mutated-file]], [[checks-that-cannot-fail]],
  [[broken-and-never-worked-look-identical]].
