---
name: a-record-the-gate-never-consulted
description: "An approval entry whose key did not match documented an authorisation the gate never read — and the gate's OK line looked identical either way"
metadata:
  type: feedback
---

On 2026-09-06 I recorded a deliberate test retirement in `diff-integrity.json` and reported it as
approved. `check:diff-integrity` printed `OK  tests/… 7 -> 4` and `PASS`, so it looked settled.

**`isApproved()` matches on `path` AND `before` AND `after`, all exact.** My entry said `before: 13`
— the file's own history — while the gate measures 7 against the merge base. **The entry matched
nothing.** The gate was passing because 3 removed of 7 is under the per-file ceiling, and it would
have passed with no entry at all.

**The two states print the same line.** "Under threshold, no approval needed" and "approved" are
indistinguishable in the output. I only found it by opening the script and reading the matcher.

**The control that settled it:** I deliberately mismatched the entry (`after: 99`), left the ceiling
alone, and re-ran — identical `OK` and identical `PASS`. That is the measurement; my first instinct
was to tighten the ceiling instead, which broke the gate's own self-test and proved nothing.

**Why:** I had written a long, careful, honest reason string and let its quality stand in for the
question of whether anything read it. Effort spent on a record is not evidence the record is wired
up.

**How to apply:** when you add an entry to an allowlist, approval file, exemption list or ledger that
a tool consumes, **read the matcher and check your key actually matches** — then break the entry
deliberately and confirm the tool's verdict changes. If it does not change, the entry is a record and
not a gate condition, and it must say so in its own text so the next reader is not told it was
approved when it was merely under a threshold. Related: [[checks-that-cannot-fail]],
[[compliance-without-coverage]], and [[a-mention-is-not-an-assertion]].
