---
name: a-ruling-guarded-per-instance
description: A ruling enforced by adding a guard to each screen it was found on looks fully enforced while the unenumerated remainder survives untouched
metadata:
  node_type: memory
  type: feedback
  originSessionId: a8d04697-d651-4023-a4c8-7226e9ed0591
  modified: 2026-09-18T14:07:50.789Z
---

A correct ruling can be remediated one instance at a time — fix the screen, add a guard to that
screen — and the accumulating guards make the ruling look enforced. **They only cover the places
somebody happened to look.**

Measured 2026-09-18, Ward Flow. The register titles Form 5A "Community Treatment Order".
`ward-legal-figure-guard.test.ts` recorded the ruling in words: _"Form 5A is a Community Treatment
Order in the register, never an involuntary inpatient status."_ Three screens — patient search,
settings, the movement horizon — each carried their own guard forbidding the string, and the live
screens were correct. It read as closed.

`ward-index.tsx` carried it **26 times**: all 24 ward entries plus the unknown-ward fallback listed
Form 5A as an authority under which a locked HDU, a psychogeriatric unit, a forensic secure unit or
a perinatal unit holds people. Nobody had looked at the ward register, so it had no guard, so
nothing reported it. The drawings — authoritative on design — carried it too, including the exact
caption the screen had, which is where the screen got it.

**The tell is the shape of the remediation, not the quality of any part of it.** Every individual
fix was right and every guard was real. What was missing was ever asking _how many_ — one
`grep -c` across the tree answered it in a second and was never run, because each fix felt like
completion.

**Why:** a per-instance guard's population is the file it sits in. N guards enforce the ruling on N
files and say nothing about file N+1, but N guards accumulating over weeks read as coverage.

**How to apply:** when a ruling is found violated anywhere, **enumerate the whole population before
fixing any of it** — count the occurrences tree-wide, including drawings, fixtures and generated
indexes. Then write ONE guard keyed on the thing the ruling is about rather than on the literal
string: here, the register's own "Community treatment orders" _category_, so a new community form
code inherits the guard without an edit. Give it anti-vacuity floors at both ends — the population
must be non-empty AND the corrected value must be present — so emptying the source cannot pass.

Related: [[enumerate-to-establish-what-exists]], [[a-guards-condition-is-not-its-population]],
[[a-mockup-can-re-commit-a-closed-defect]], [[absence-under-one-prefix]],
[[a-written-diagnosis-does-not-sweep]]
