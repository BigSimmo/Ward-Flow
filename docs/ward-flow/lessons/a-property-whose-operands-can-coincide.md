---
name: a-property-whose-operands-can-coincide
description: "a property test whose two sides are equal in the defective case passes on the broken code; two sessions found this separately"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 2 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 2 index lines for one subject crowd out 1 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# a-property-whose-operands-can-coincide

> a property test whose two operands are equal in the defective case is a coincidence detector, not a property — and it survives every other guard-quality rule

**Before trusting a property test, ask whether its two sides can be EQUAL in the broken state.**

2026-09-04, Ward Flow. A colleague fixed a screen that said "3 eligible destinations" where 11 wards
were eligible, then wrote a property test for it: _the line must name the population its figure came
from_. Property over the whole fixture, floored on the discriminating population, written straight
after diagnosing the defect — **every rule we had spent the night trading.** It **passed against the
unfixed code**: in that branch the eligible count and the shortlist size are the SAME NUMBER, so the
understating sentence already satisfied the obligation.

⚠️ **This is the failure that survives doing everything else right.** It is not a blocklist, not a
wording pin, not a vacuous floor, not an unexecuted mutation. The property is real, the floor is
sound, and it still cannot discriminate — because the two quantities it compares coincide in exactly
the case it exists to catch.

**The remedy is to pick the operand that cannot coincide.** Theirs became the NETWORK count, which on
a capped movement is larger by construction. Ask: _is there a value that is structurally different in
the broken state, rather than one that merely usually differs?_

⚠️ **And the only method that detects it is restoring the broken version and watching the test pass.**
A property that passes on fixed code tells you nothing; the entire signal is whether it fails on the
broken one. Same discipline as a mutation control — both of us needed it, the same night, to catch
results we would otherwise have believed.

Related: [[a-property-that-does-not-discriminate]], [[which-assertion-went-red]],
[[floor-the-denominator-never-the-numerator]], [[green-mutation-that-changed-nothing]],
[[a-guard-that-pins-the-old-wording]].

---

**2026-09-06 — THE SAME SHAPE, BUT THE OPERANDS COINCIDED BECAUSE I WROTE BOTH OF THEM THE SAME WAY.**
I put a ward's recorded sex mix on a clinical board with `` `Female ${unit.sexMix.female ?? 0}` ``. The
keys are **`Female`/`Male`, capitalised**, so every one of 23 wards rendered **"Female 0 · Male 0"** —
a confident false clinical statement about the whole network. My test then built its expected string
from **the identical expression**, so the two agreed perfectly and the case passed.

**Two mechanisms stacked, and each one alone would have been caught:**

1. **A nullish default turned a wrong key into a number instead of an error.** `?? 0` on a
   `Record<K, number>` defends against nothing — the type guarantees the key — so its only effect was
   to convert a typo into a plausible figure. **A default that cannot fire in the correct case can
   only ever mask the incorrect one.**
2. **The test recomputed the expectation rather than stating it.** Asserting `cell === f(x)` where the
   screen renders `f(x)` is a tautology in the shape of a property, and it stays green for any `f`.

**What actually caught it: looking at the rendered page.** No test could have. And the typecheck that
WOULD have caught the key was the one I skipped — I grepped a filtered subset of its output for one
filename instead of running the gate and reading its exit code.

**How to apply.** When an assertion's expected value is computed, ask what a wrong accessor, key or
unit would do to BOTH sides — if it moves them together, the test is a coincidence detector. Add a
guard over the **data** that the fault falsifies globally: here, _at least one ward must show a
non-zero mix_, which a wrong key zeroes everywhere at once. And treat `?? 0`, `|| 0` and `?? ""` on a
value the type says is present as a defect in itself, not as caution. Related:
[[tests-that-assert-rendering-not-truth]], [[a-bypass-that-runs-a-narrower-check]],
[[fields-with-no-producer]].

---

# operands-that-coincide

> My property test passed against the unfixed code because its two operands are the same number in the defective case — a coincidence detector, not a property

A screen said "3 eligible destinations" where eleven wards were eligible: the count came from a
shortlist capped at three. I fixed it, then wrote a property over the whole fixture, floored on the
discriminating population, asserting **"the line must name the population its figure came from"**.
Every rule I had been trading with colleagues all night. **It passed against the unfixed code.**

**Why:** in that branch the eligible count and the shortlist size are THE SAME NUMBER. So the
original understating sentence — "3 eligible destinations" — already contained the population size.
The test failed in exactly the way the code did, for exactly the same reason: _a denominator looks
redundant when it equals the numerator._ I had written that sentence into the fix's own comment an
hour before writing the test that fell for it.

**The rule:** _a property whose two operands can be equal in the defective case is not a property —
it is a coincidence detector._ Before trusting one, ask whether its two sides can coincide in the
broken state. If they can, pick a different operand. Here the working obligation was the NETWORK
count, which on a capped shortlist is **larger by construction**, so no understating sentence can
contain it by accident.

**How to apply:** the only method that detects this is restoring the defect and watching the guard.
A guard passing on fixed code says nothing at all; **the entire signal is whether it fails on the
broken code.** So: never write a guard without running it against the unfixed version — not as
diligence, as the definition of having written one. And when the mutation passes, do not adjust the
wording; find the operand that cannot coincide.

Related, from the same session: a _correct_ fix can leave a screen worse than the false one it
replaced — see [[right-but-inexplicable]]. And a sweep's output is a population to READ, never a
population to CHANGE: of nine call sites of one helper, three were correct as they stood and a
blanket replacement would have broken three working screens.

Related: [[checks-that-cannot-fail]], [[a-property-that-does-not-discriminate]],
[[which-assertion-went-red]], [[a-green-mutation-only-counts-if-the-mutant-ran]].
