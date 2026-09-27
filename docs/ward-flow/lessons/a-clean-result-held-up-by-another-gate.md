---
name: a-clean-result-held-up-by-another-gate
description: A guard reported zero violations because a DIFFERENT gate normalised the input; its coverage claim was conditional and nothing said so
metadata:
  type: feedback
---

A CSS guard scanned 51 stylesheets and found zero unprotected status colours. True — and
**the reason it was zero was Prettier, not the guard.** The parser could not see
`var( --success-text )` at all (leading whitespace made the token read as the empty string),
and the only reason no such line existed is that the formatter rewrites it to `var(--x)`
before anything is committed.

So the guard's real claim was **"zero, provided the format gate ran"** — and the format gate
has a documented bypass (`SKIP_FORMAT_GUARD=1`, plus AGENTS.md's own note that an agent
pushing from its own environment misses the pre-push hook entirely).

**Why:** an injection sweep proved 51 of 51 files go red on a planted regression, which reads
as unconditional coverage. It is not. Two shapes were caught by all 51; a third was missed by
all 51. The sweep was honest and the summary sentence was wider than it.

**How to apply:**

- When a guard reports a clean estate, ask **what keeps it clean** — the guard, or something
  upstream that normalises the input before the guard ever sees it. A formatter, a codegen
  step, a lint autofix and a schema validator all do this.
- If the answer is "something upstream", that dependency belongs **in the guard's own
  docblock**. The next person reads the count, not the chain.
- Report coverage as **"N of N on the shapes tested"** and name the shapes. `var()` inside
  `calc()`, inside a custom-property definition, and behind `@supports` were untested here,
  and "the parser is sound" would have covered all three.

Same family as [[the-suite-never-tests-the-absence]] and
[[a-fix-can-obsolete-its-own-guards-question]]: the check is real, the scope sentence is not.
See also [[compliance-without-coverage]] — a sweep proving it found something never proves it
found everything.
