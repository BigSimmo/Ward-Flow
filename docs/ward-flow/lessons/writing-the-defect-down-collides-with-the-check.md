---
name: writing-the-defect-down-collides-with-the-check
description: "Three shapes in one evening where DOCUMENTING a defect broke the machinery that checks for it — a guard reporting the post-mortem as the bug, a comment breaking the mutation restore, and an absence check satisfied by prose."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 13c6e0ab-aac1-4d38-bec5-622e555c2b64
  modified: 2026-09-07T08:04:17.653Z
---

**Ward Flow, 2026-09-07. The same collision three times in one evening, in three different
mechanisms, and nobody saw the pattern until the third.** Every instance: **the act of writing the
defect down broke the thing that checks for the defect.**

    1. A GUARD REPORTED THE POST-MORTEM AS THE BUG
       design-token-contract scanned source text for `var(--x)` naming an undeclared token.
       statistics-v4.module.css documented three such tokens IN A COMMENT explaining that they had
       been referenced, never declared, and were fixed. The guard named the fixed file, the fixed
       tokens, and three line numbers that were all comment text.

    2. A COMMENT BROKE THE MUTATION RESTORE OF THE STRING IT DOCUMENTED
       A false string was removed and a comment written explaining why. Mutating it back to prove
       the new guard reddens then made the string appear TWICE — the mutant, and the comment. The
       mutator refuses a non-unique anchor, so the RESTORE aborted. The mutant shipped.

    3. AN ABSENCE CHECK WAS SATISFIED BY THE PROSE EXPLAINING THE FIX
       `grep -c "of 5 confirmed today"` must return 0. It returned 1 — at a line inside the comment
       recording that this exact pattern had been wrong. The live assertions were correct.

🔴 **THE BETTER THE DOCUMENTATION, THE MORE CERTAINLY IT COLLIDES.** A thorough post-mortem quotes
the defect verbatim; a whole-file text check cannot tell a quotation from an occurrence. **So the
guards punish exactly the behaviour this project keeps asking for**, and the tempting fix — delete
the explanation — is the worst available outcome.

## What to do instead, per mechanism

- **A guard that scans source must blank comments first** — `blankCssComments` in
  `tests/helpers/strip-source-comments.ts`, blanked not deleted so `file:line` stays exact. See
  [[a-comment-can-satisfy-a-guard]] for the inverse direction.
- **A mutation anchor must be chosen for uniqueness AFTER the comment is written**, not before.
  ⚠️ **And never redirect the restore's output away** — instance 2 only shipped because the
  refusal was silent.
- **An absence check must exclude comments, or be written against the ASSERTION rather than the
  file.** A floor pinned to an exact whole-file count breaks the moment somebody explains the fix.
  **Say what must be absent FROM A CODE PATH, not from the bytes.**

## The compounding conditions, which were all ordinary

Instance 2 needed three things and none of them is a mistake anybody would flag: the restore's
output redirected away; the verification run pointed at a _different_ file (8 passed, while the
edited file's own test was red); and a batch whose other failure was the known load-dependent one.
**Reading "2 failed" as the familiar flaky pair would have shipped it.** It was caught only because
the failure was an ASSERTION rather than a TIMEOUT — the received text showed a NEW note beside an
OLD stamp, which is only possible if one edit landed and the other did not.

⚠️ **"A red inside a batch is not yet a red" is a necessary rule on a loaded machine and it nearly
cost this fix.** Both directions of it are dangerous: a real red dismissed as flake, and a flake
chased as real.

⚠️ **Instance 2 has its own first-person account by the chat it happened to — [[a-comment-that-quotes-the-string-it-removes]]. Read that one for the incident; this one is the CLASS, and the class is what nobody saw until the third mechanism showed the same shape.**

Related: [[a-comment-can-satisfy-a-guard]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[restoring-a-mutated-file]], [[comments-that-recruit]],
[[a-fix-that-states-a-falsehood-more-confidently]], [[corruption-that-makes-checks-pass-harder]].

## 2026-09-10 — the strongest instance yet: the check's own SELFTEST DATA quoted in documentation

The three cases above are documentation of a _defect_ breaking a check. **This is documentation of
the CHECK ITSELF breaking it, which is worse, because writing down how a guard works is the thing we
keep asking people to do.**

`scripts/check-ward-citations.mjs --selftest` injects fake citations to prove it can fail — one is
`deadbeefdeadbeef`. **Two ward documents explaining how the selftest works now quote that string
verbatim** (`builder-prompts-2026-09-08.md:105`, `merge-to-main-survey-2026-09-08.md:210`), so the
real scan finds it every time.

**The mechanism is sharper than "the corpus grew".** Injection is a `Map.set`, so it does not add a
row — **it overwrites the ATTRIBUTION of a row already present:**

    selftest credits deadbeefdeadbeef to   <selftest>:0
    real run credits it to                 builder-prompts-2026-09-08.md:105

**Same string, same count, different author.** A single run cannot show this. **A diff of the two
runs states it immediately** — which is the cheap check when a canary count looks wrong.

Three consequences:

- **The tool can never exit 0 again** while those documents exist. A permanent exit 1 meaning
  _"somebody documented the check"_ is indistinguishable from one meaning _"a citation broke"_.
- 🔴 **Every "subtract the canaries" arithmetic is wrong, and wrong in the dangerous direction.**
  Mine said subtract one. A later fix added a second canary, making the naive rule "subtract two".
  **Two is also wrong** — measured selftest 12, real 11, a difference of ONE. **Subtract by NAMING
  the canaries in the output, never by counting them.**
- **I did not catch my own wrong instruction by vigilance.** I re-read it only because someone
  widened the checker and I was checking whether the widening had made it unfailable. **When an
  instrument changes, re-read every published rule that quotes it** — mechanical, and the only part
  of this that generalises.

See [[wrong-on-purpose-and-load-bearing]] for why the fix is never to delete the quoting sentence.

## 2026-09-11 — the fourth member bites THE RECORD, not the code

A CSS debt gate reads raw file text, comments included. So **a comment explaining why a required
literal was deliberately kept is counted as another instance of that literal** — and the better the
justification is written, the more debt it records. The instruction ("report any you decline, with
the reason") and the trap are the same action.

🔴 **Then the fix over-corrected into the same family.** The rule went out as _"never write the
literal anywhere, including commit messages and reports"_. Measured, the gate walks `<cwd>/src` only
(`.css`/`.ts`/`.tsx`) — docs are not read and a commit message is not a file. **Under the wide
version, the errata entry recording the rule could not name the declaration it forbids.**

**A rule against reproducing the forbidden thing, applied widely enough that it forbids RECORDING
what the forbidden thing is.** An instruction that cannot name its subject is unusable.

**The correct shape carries its own boundary:** inside the scanned tree, describe and never
reproduce; outside it, quote exactly, because the record must be able to name its subject. **When
you write a rule of this family, state where it stops in the same sentence.**

## 2026-09-11 — the counting side: a rule's own example read as an instance

Same family, opposite direction. The four above are about a check MISREADING prose. This one is
about **me** doing it, with grep, and reporting the result as a defect.

I compared a screen's strings against its drawing and reported _"'Not recorded' present in the
drawing, absent from the form — a real gap"_. The single occurrence was **inside the drawing's own
design rule**, which reads: _Absence is written in words. "Not recorded", "Not written yet", never a
blank, never a dash._ The rule was **quoting itself as an example of the property it asserts.**

🔴 **A document that states a rule about a string necessarily contains that string** — so on any
screen whose drawing writes its rules down, a naive presence count over-reports by exactly the
number of examples the rules give. **The better-documented the design, the worse the over-count**,
which is the same perverse gradient as the CSS-debt case above.

⚠️ **And the over-count pointed the wrong way round.** The form was correct — it satisfied the rule
with a THIRD phrase the drawing never uses ("Not answered yet", and an empty state reading _"Nothing
written — that is a complete answer"_). Meanwhile three of the other four hits sat on two prose boxes
the owner had already DELETED by ruling, which the drawing had silently redrawn. **So the real defect
was in the artefact I was treating as the reference**, and my method could not have found it: a
string diff asks "does the form match the drawing", never "is the drawing still allowed".

**How to do it instead:** a string check between a screen and its drawing must (1) exclude the
drawing's rules/legend/gallery regions before counting — they describe, they do not render — and
(2) be read as a list of QUESTIONS, never findings. Each difference has three possible causes and
only one is a gap in the screen: the screen is behind, the screen said it better, **or the drawing
is stale against a ruling**. Check the rulings before reporting any of them.

Related: [[a-mockup-can-re-commit-a-closed-defect]], [[a-grep-for-a-filename-finds-its-prose]],
[[a-comment-can-satisfy-a-guard]], [[establish-the-unit-before-counting]],
[[a-comment-that-quotes-the-string-it-removes]].
