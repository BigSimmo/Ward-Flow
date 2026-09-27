# Ward Builder Four — session record and current understanding, 2026-09-10

Written at the owner's request so the reasoning survives the chat window. Companion to
`handover-ward-builder-four-2026-09-10.md`, which is the operational handover; **this file is the
understanding.** Worktree `D:/Worktrees/Database/ward-builder-four`, branch
`ward/invented-figure-markers-20260909`. Never pushed.

---

## 1. What the work was

The owner ruled on 2026-09-09 that **every sentence disclosing an invented figure must be true read
alone** — quoted, screen-read, copied into a message, or reached after the heading has scrolled
away. _A heading is context, and context does not travel with the sentence._

The defect that produced the ruling: under a heading reading **"Invented figures"**, an item was
replaced with _"There were 28 referrals this period."_ — an invented number stated as measured
fact — and **every guard stayed green.** The claim was true of the LIST and false of the ENTRY.

## 2. What was built, and the one thing that made it work

A guard, `tests/ward-provenance-sentences-carry-their-own-marker.test.ts`, folded at `4a35634f96`.

🔴 **Its first version was itself an instance of the defect it was built for.** The predicate was
twelve bare words under `some(spelling => includes(spelling))`. Measured against thirteen sentences
it had never seen, **eight passed**, including two that assert the opposite of the ruling:

> _"These figures are **not** invented — they are the current state of the network."_

**It satisfied the guard by containing the word it denies.** A substring test has no polarity. Not
a loosely-tuned guard — an inverted one, certifying the exact claim the ruling forbids.

**The fix is shape, not length.** Every alternative now binds the disclosing word to its verb
(`are invented`) or its noun (`invented figures`), so a negator must land _inside_ the phrase and
breaks the match. **Never a bare word; never a blacklist of negators** — that is the same fragment
weakness one level along, and unbounded.

⚠️ **And the trade everybody predicts does not exist.** The word list was defended as tolerance for
honest rewording; narrowing was priced at 6 → 11 honest sentences reddened. **Claim shapes cost
neither: 0 of 5 real sentences, 0 of 9 honest rewords, 0 of 18 defects.** The tolerance was never in
the bare words — it is in the verb list. _Do not re-open that argument from memory._

## 3. The five arms, and the column that makes them evidence

Real component, pristine copy outside the worktree, `cmp` after each.

| arm                               | old guard          | now                              |
| --------------------------------- | ------------------ | -------------------------------- |
| bare figure in the first `<p>`    | RED                | RED                              |
| same figure in a **second `<p>`** | **GREEN**          | RED                              |
| prose in `<span>`                 | RED _on the floor_ | RED **on the rule, block named** |
| the disclosure **negated**        | **GREEN**          | RED                              |
| **semicolon** bystander           | **GREEN**          | RED                              |

**The "old guard" column is the half that matters.** A red on a repaired guard proves the guard
fires; it does not prove the hole was ever open. Three were.

## 4. Current understanding of the state of this ruling across Ward Flow

| surface                                       | state                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `hub-screen.tsx`, `ward-management-modes.tsx` | **guarded** by the source-scanning guard, compliant                               |
| statistics footnotes                          | **guarded** by `tests/helpers/ward-invented-figures.ts`, repaired at `bad20426c9` |
| the other ~60 files                           | 🔴 **unguarded by either**                                                        |
| fourteen ward screens                         | 🔴 **UNEXAMINED — not compliant, not defective, unexamined**                      |

**Owner ruling, 2026-09-10: _"leave the reach at 2, keep what you built."_** Recorded by Ward Lead
at `2529b59e5d`. ⚠️ **It does NOT cancel the statistics repair** — that fixes a guard which
certified a denial. Both hold at once.

**Why the reach cannot simply be widened:** this codebase discloses provenance in a **banner**, not
under a heading. A badge-anchored rule was measured and rejected — 42 of 63 banner sentences
flagged, almost all correct prose — because the banner's first paragraph carries the SAFETY
statement (_"This board is not a medical device"_) and the provenance statement sits elsewhere.
That is a structural fact about the UI, not a tuning problem.

## 5. Known limits — these must be quoted WITH the guard, never the guard alone

- **`RETRACTED` is a list, not a shape**, incomplete by construction, labelled as such in place.
- **A colon, an `and`, and a comma each hide a bystander inside one clause.** Shared with the
  statistics helper, arrived at independently. **A residual shared by two independent
  implementations is a property of the APPROACH — sentence-level text analysis cannot see a
  bystander inside one clause — not a bug in either.** Documented rather than chased: splitting on
  them shreds honest prose.
- **The guard reads rendered `.tsx` prose only.** Mockups, banners and runtime-composed strings are
  invisible to it.

## 6. 🔴 The three findings I would most want a successor to inherit

**1 · A substring test has no polarity.** Anywhere this repo does
`SPELLINGS.some(s => text.includes(s))`, ask two questions: does a _negation_ of the keyword satisfy
it, and does a _bystander clause_ satisfy it? Two independent instances were found in one day
(8 of 13, then 7 of 10). Treat it as a class.

**2 · A constant anti-vacuity floor catches only the LAST unit that stops being measured.** Proven
here: prose moved out of a `<p>`, blocks fell 3 → 2, a floor of `>= 3` reddened. That is arithmetic,
not detection — add a fourth block and the identical mutation passes in silence. Where something
upstream is stable, make the floor **relative** to it and **name** what went dark. Every other floor
in this programme is still a constant.

**3 · Adjacency is an assertion, and it is the only assertion that costs nothing to make.** Three
times in one day I shipped a true statement with a false implication — _"reaches 2 files of 76"_
(reads as _the other 74 are unguarded_), a peer's figure quoted to the owner (right conclusion,
neighbouring rule), and two true clauses joined by an em dash that told a colleague the backups
were compromised. **None is caught by re-measuring the number, and knowing the rule did not prevent
the third.** The control is to _state the implication you are not making._

## 7. Method notes that cost real time

- **A quoted bash heredoc halves doubled backslashes.** A regex written that way reached Node as
  backspace characters and reddened everything — a confident answer to no question at all. Caught
  because obvious matches failed, not because anyone checked. **Write regex-bearing scripts with a
  file tool.**
- **Mutate additively.** Replacing a block shrinks the corpus and can trip the floor as well as the
  rule; **a red with two causes cannot say which caught the defect**, and it reads as a stronger
  result, not a weaker one.
- **Verify a peer's fix claim — especially one that agrees with you.** Ward Builder Two's repair
  held; probing its _design_ then found five more. And when a peer corrects you in the _reassuring_
  direction, audit that hardest.
- **Route owner questions through Ward Lead.** One question reached the owner from two chats. Two
  honest answers, and afterwards no way to tell which governs. It was safe here only because both
  recommendations coincided — **luck, not process.**
- **Name the MECHANISM when two chats report a fault in one artefact**, or the second gets closed by
  the first's correction.
