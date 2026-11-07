---
name: a-test-expectation-line-is-a-ruling
description: Resolving a merge conflict over a test expectation can silently revert an owner's decision, with every gate green and nothing to mutate
metadata:
  type: feedback
---

**A changed expectation line looks like an ordinary line edit in a merge, and each one is a
decision.** Ward Builder Four, 2026-09-06, handing its own superseded work to the chat replacing
it:

    toHaveTextContent("0")  ->  toHaveTextContent("none")
    freeingCellText(0)      ->  "none"

Taking the other parent's version of any of those **reverts the owner's ruling silently.** Every
gate stays green. There is no red, nothing to mutate, and no instrument that detects it — the
conflict resolver believes they are choosing between two spellings of one intent.

**Why:** three separate rulings landed in the same five files within a few hours. The diff cannot
say which parent's line encodes a decision and which is an artefact of the other change. Only
someone who knows the rulings can tell, and that person is usually not the one resolving.

**How to apply:**

- Before resolving a conflict in a test file, get an inventory of **which lines are rulings and
  whose** — from the author of each side, not from the diff.
- **Diff case NAMES both directions, never counts.** A re-pointed case leaves the count unchanged
  while the claim moves — the count-based check is the one I issued and had to withdraw, despite
  having [[agreeing-checks-with-one-blind-spot]] already written down.
- Watch for a fix whose slogan over-reaches: _"make all the zeros agree"_ sounds like it includes
  the absent ones. `0` (reported none) and `undefined` (nobody told us) must stay distinguishable
  — assert the **inequality directly**, not as a consequence of two separate equality tests. See
  [[fields-with-no-producer]] and [[one-word-two-states]].

The structural cause of the duplication behind it: there was no place where "this item is taken"
could be written, so no care by either builder could have surfaced it. **The register is the fix,
not the vigilance.**

## A guard that defends a SUPERSEDED ruling, citing the owner — 2026-09-06

Asked to find where shipped code contradicts a fresh set of owner rulings, the answer was not in the
code. **Both contradictions were in GUARDS.**

A test pinned a clinical vocabulary list to five exact entries, with a docblock reading: _"Pinned to
the EXACT members in the EXACT owner-approved order, not to a length — a length check would pass an
entry silently reworded, and these words go in front of a coordinator as fact."_ **Excellent
reasoning, correct when written, and the owner has since added two entries.**

🔴 **So the guard does not merely lag the ruling. It DEFENDS the superseded version and cites the
owner while doing it.** Whoever implements the addition meets a red whose message and comment both
argue the addition is wrong — and the authority quoted is the same person who ordered it.

⚠️ **A spurious red does not merely mislead; it argues against a correct change.** This is the worst
form: the ruling and the guard invoke the same authority, so a builder resolving the conflict has no
tie-breaker except the date — which is in a document they may not open.

**How to apply, both directions:**

- **When encoding a ruling in an expectation, put the ruling's DATE and its record's filename in a
  trailing comment on the line**, so the next person meets the provenance where the conflict
  surfaces rather than in a document.
- **When auditing "does the code contradict this ruling", search the TESTS, not only the source.** A
  correct ruling usually fails first as a red, not as a wrong behaviour, and the red will be
  attributed to the change rather than to the stale pin.
- **The second contradiction had the same shape**: four test files pinned a label string the owner
  had just ordered renamed. Related: [[a-guard-that-blocks-its-own-purpose]],
  [[a-green-mutation-only-counts-if-the-mutant-ran]].

## A format commit is the worst thing to resolve by side-pick (2026-09-10)

Folding a 95-file `prettier --write` pass produced two conflicts, both the same shape: **the format
branch had reformatted a superseded version of the file.**

    tests/…-filters.test.ts   their side carried the PRE-typecheck-fix identifiers, prettily wrapped.
                              Taking "theirs" would have silently reverted a fix and reinstated
                              thirteen type errors — with prettier's blessing on the diff.
    a handover document       UNION: mine added a new section above a table, theirs reformatted the
                              table. Both wanted. A side-pick either way loses one.

⚠️ **Every hunk in a format conflict looks cosmetic, and one of them was a type fix.** Resolve by
taking the semantically newer content and re-running prettier on it — never by picking a side.

**And fold the format pass LAST** where the chain allows: it touches hundreds of files across several
chats' territory, and anything folded after it inherits the whole conflict surface.

## 2026-09-10 — a FORMAT commit is the worst thing to resolve by side-pick

A whole-tree `prettier --write` on a branch cut earlier reformatted a file the master line had since
FIXED. **Taking my side would have silently reverted a typecheck fix and put thirteen type errors
back — prettily wrapped, with prettier's blessing.** Ward Lead caught it at the fold and resolved as
_their content, then formatted_.

🔴 **The hazard is that every hunk in a format diff looks cosmetic, and one of them was a repair.**
A reviewer scanning a 95-file reflow for "anything substantive" finds nothing, because the
substantive change is invisible **as a change** — it is a stale version, correctly formatted.

⚠️ **Formatting a superseded file makes the stale version look MORE authoritative**, not less: it is
now tidy, consistent, and passes the format gate.

**Rules that follow:**

- **Never resolve a format-commit conflict by side-pick.** Take the other side's CONTENT and
  re-format it.
- **Fold a whole-tree format LAST**, so nothing folds after it and inherits the conflict surface.
  ⚠️ If the format sits mid-chain, taking the tip takes it too — a linear chain cannot be reordered
  at fold time, so the ordering has to be decided when the commit is MADE.
- **Give the folder your file count before the fold, not after.** Their `--check` afterwards will
  differ legitimately (files committed after your branch point), and without your number the
  difference cannot be told from a shortfall in your run.
