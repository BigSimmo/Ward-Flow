---
name: hand-picked-test-subsets-ship-red
description: Naming test suites by hand before a commit has shipped a red test twice on Ward Flow — discover the suite set from disk instead
metadata:
  node_type: memory
  type: feedback
  originSessionId: 436aeae1-07d3-453f-b85f-5ea70b3fe932
  modified: 2026-08-27T20:39:50.438Z
---

Choosing which test files to run by naming them has now shipped a red test **twice** in this
repository, both times on Ward Flow, both times by a controller who felt well-verified:

- **Phase 6** — three of six fail-closed registration gates were run. `ward-landmarks.test.ts` was
  not one of them and was red at the phase's final review.
- **Phase 7 Task 5 (2026-08-28)** — six ward suites were named by hand, reported `160 passed`, and
  the commit went in. The full ward set is **57 files / 697 tests**, and two of them were red:
  `ward-referral-matching.test.ts` (one new import pulled the bed-release model into referral
  matching's transitive graph, breaking the spec's fourth-most-important contract) and
  `ward-legal-figure-guard.test.ts` (a new exported numeric constant with no provenance record).

Both misses share a shape: the broken thing was a **source-text or import-graph contract**, which
`tsc` and eslint cannot see, living in a suite whose name did not obviously relate to the change.
That is exactly the suite a hand-picked list omits.

**Why:** a hand-picked list encodes what you _think_ the change touches. Contract tests exist
precisely for the couplings you did not think of, so filtering by expected relevance filters out
the tests most likely to catch you.

**How to apply:** discover the file set from disk (`ls tests/<area>-*.test.ts*`) and run all of it,
in a script that **refuses** when discovery returns zero files and when an exit-0 run printed no
`Tests N passed` line. `check-ward-suite.sh` (originally at `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/check-ward-suite.sh`, now retired)
was the working example; `check-registration.sh` beside it was the Phase 6 equivalent. Current practice uses dynamic disk discovery via runner scripts or glob expansion, with explicit anti-vacuity floors. Related:
[[ward-flow-verification-lessons]], [[checks-that-cannot-fail]], [[measure-the-thing-not-a-proxy]].

## 🔴 "Derive from disk" is necessary and NOT sufficient — a derived list narrows silently

2026-09-04. I told five sessions "discover the set from disk, never hand-list it" all night. Then a
chat replaced a hand-list of four modules with membership derived from "composes wardTokens" — and
the derivation **silently dropped a file the hand-list had covered**, because that file composes
nothing and declares nothing; it inherits its tokens from whichever root renders it.

⚠️ **A widening intended to broaden the guard would have narrowed it, while passing.**

**The asymmetry is the point: broadening announces itself** — new members appear, somebody
investigates. **Narrowing produces a smaller green,** and nothing about a green says how many things
it looked at.

**So a derived set needs a floor asserting the KNOWN members are still IN it**, not merely that the
set is non-empty. The only reason that chat caught its own regression is that it had one.

⚠️ Two more discovery traps from the same night: `tests/ward-*` is a FILENAME PREFIX, not a
discovery rule — two ward tests were named after the component they test and were invisible to every
count. And a glob over vitest's population silently excludes the Playwright specs, four of which
import the same source. **Define a population by what a file DOES (imports, reads, renders), never by
what somebody called it.**

## 🔴 A THIRD MECHANISM, 2026-09-04: a NAMED FILE THAT DOES NOT EXIST IS SILENTLY IGNORED

The two cases above are about which files you _choose_. This one is about files you name that are
not there at all — and it is worse, because the run reports success.

Verifying a three-file copy fix, I named three test paths by hand. **Two of them did not exist.**
Vitest ran the one that did, printed `Test Files 1 passed (1)`, and **exited 0**. No warning, no
"pattern matched nothing", nothing on stderr. I caught it only because the file count looked too
small for what I had changed.

> **A named test path that does not exist is not an error. It is a silently smaller run whose
> success output is byte-identical to a real one.**

**The fix, and it is the same shape as the sweep lesson below:** derive the set by grepping for the
modules you changed, then run what that returns —

    grep -rln "<module>\|<ExportedName>" tests/ | grep -E '\.test\.(ts|tsx)$'

That found 15 files / 377 tests where my hand-list had found 1. **And check the file count against
what you expected before you read the colour.**

⚠️ **The general shape, which is the transferable part and is not about tests at all.** The same
night, a factual sweep over 23 files reported "zero mismatches" while skipping a defect in a file it
had opened and written up two other lines of. **Both failures produce output indistinguishable from
success — a small green and a clean report — and only the noisy failure modes ever get a second
look.** A lexical pass returning 395 candidates announces that it needs triage; a factual pass
returning zero announces that it is finished. Prefer the instrument that makes you work.

Related: [[compliance-without-coverage]], [[checks-that-cannot-fail]], [[gate-wrappers-mask-exit-codes]],
[[heavy-lock-refusal-looks-like-failure]].
