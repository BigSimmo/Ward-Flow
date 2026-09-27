---
name: the-same-words-true-on-one-screen-false-on-another
description: "Identical UI wording can be truthful on one screen and a false clinical claim on another, because truth lives in the data source — so a repo-wide text ban goes red on honest copy"
metadata:
  node_type: memory
  type: feedback
---

2026-09-04, Ward Flow. A results table was headed **"Since arrival"** over a value computed from
`movement.openedAt`. `Movement` records **no arrival instant at all** — `arrivedAt` was deliberately
deleted — and `Referral.triagedAt`'s doc comment states the rule in terms: _"TRIAGE IS NOT ARRIVAL,
AND NO SCREEN MAY WORD IT AS ONE."_ A patient arrives, waits, and is triaged later; on a busy night
that gap is not small, so the header understated every wait on the screen.

## ⚠️ THE SAME TWO WORDS ARE CORRECT ON THE NEXT SCREEN ALONG

The out-of-area ledger has an identical **"Since arrival"** header. It is fed by `sinceArrivalLabel`,
which reads a real admission and says _"Arrival not recorded"_ when it has none. **Truthful, and a
Playwright test pins it.**

> **Two screens, identical wording, different data source. One is a claim the record supports and
> one is a claim it cannot.**

**So a repo-wide ban on the phrase would go RED on honest copy**, and whoever hit that red would
either weaken the guard or reword a truthful column. **A wording rule cannot express this; only a
property can** — _does the value's source hold the thing the label names?_

⚠️ **And this is why it survived review.** A second screen using the same phrase makes the wrong one
read as HOUSE STYLE rather than as an assertion. The consistency that normally signals care was the
camouflage.

## How to apply

- **Scope the guard to the table it is about**, and say in the test why it is not repo-wide.
  Mine asserts over the header row of ONE table and carries a comment naming the truthful sibling.
- **When you find bad wording, grep for the phrase before fixing it** — not to fix them all, but to
  find out whether some instances are correct. A blanket fix is as wrong as no fix.
- **The tell is a label naming a thing, and a value computed from a different field.** Check the
  producer, never the word.

Related: [[a-guard-that-pins-the-old-wording]], [[a-property-that-does-not-discriminate]],
[[an-alias-defeats-a-name-matching-detector]], [[fields-with-no-producer]],
[[tests-that-assert-rendering-not-truth]].
