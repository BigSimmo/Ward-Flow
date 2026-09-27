---
name: a-guards-condition-is-not-its-population
description: "A refusal message hard-codes one cause for a guard whose condition spans many states — and it survived because it is TRUE in 3 of the 5 states that can reach it, including every state a manual check would try"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 375480d8-c65a-4a85-9c03-411b49e19410
  modified: 2026-09-11T15:25:42.654Z
---

Ward Flow, 2026-09-11, `ward-flow-reducer.ts`, `WITHDRAW_ACCEPTANCE`:

    if (movement.stage !== "accepted_awaiting_bed") {
      reject(`cannot withdraw an acceptance once a bed has been pulled (… is at ${movement.stage})`)
    }

**The guard tests ONE thing — is this still awaiting a bed? — and the message names ONE cause as
though it were the only one.** A coordinator at `placement_requested` is told a bed was pulled when
no bed could exist yet. 🔴 **Not a vague message: an ACTIONABLE wrong one.** They go looking for a
bed that was never taken, or stop chasing one they still need.

## 1 · The condition is not the population

Two of us counted `!== accepted_awaiting_bed` against a seven-member type, subtracted one, and said
"six stages". **Five.** `arrived` cannot reach the check at all: its only writer sets `closure` in
the _same object literal_ as the stage, and an earlier branch returns on `closure` first.

⚠️ **Arithmetic on a type is not a measurement of a population. What the code can EXPRESS is not
what the code can REACH.** The peer who made this error had endorsed the exact reachability
argument three paragraphs earlier, about a different code path. **Having the fact is not having it
available.**

## 2 · 🔴 A falsehood with a HIGH true rate is harder to find than one with a low one

Against the stage order, the sentence is **TRUE for `pulled`, `handover_ready`, `moving`** and false
only for the two earliest stages.

⚠️ **And the direction is the cruel part.** A withdrawal is most plausibly attempted mid-pathway —
exactly where the sentence is correct. **Anyone testing it realistically read an accurate sentence
and moved on.** The defect is concealed by the very thing that makes a manual check feel
representative, and a test written from a typical case cannot find it.

## How to apply

- **When a guard's message names a CAUSE, check the cause against every state the guard can reach**
  — and derive that set by reachability, not by subtracting from the type.
- **State the CONDITION, not a guessed cause.** One condition-shaped sentence is true across the
  whole population because it describes the gate. ⚠️ But do not buy truth with vagueness: _"this
  cannot be withdrawn"_ is true everywhere and says nothing — that trades a false specific for an
  empty general, which is the same defect's other half.
- 🔴 **Do NOT assert the false clause is absent everywhere.** Where it is legitimately true, a
  blanket ban is **red on correct work**. Assert its absence only at the states where it is false.
- ⚠️ **Boundary distinction (trigger condition vs scan region):** Distinguish narrowing which states
  trigger a check from narrowing what region is scanned. Asserting absence across all trigger states is
  wrong when the message is legitimately true in some states (narrow the trigger condition to where it
  is false). Conversely, when checking a rendered page for a forbidden phrase (as in
  [[a-guard-that-blocks-its-own-purpose]]), the spatial scan region must NOT be narrowed to a sub-element,
  because narrowing the scan region lets the forbidden phrase appear in a sibling element unseen.
- **Floor the refusal itself.** An event refused for a _different_ reason returns a message that
  also lacks the false clause and passes the absence check — vacuity, arriving through the door the
  assertion was pointed away from.

Related: [[adding-data-makes-an-unchanged-screen-lie]], [[one-word-two-states]],
[[half-a-fix-can-be-worse-than-none]], [[a-guard-that-blocks-its-own-purpose]],
[[compliance-without-coverage]], [[establish-the-unit-before-counting]],
[[tests-that-assert-rendering-not-truth]].
