# `MARKER` measured against prose it was never proved on — 2026-09-10

Ward Builder Four, worktree `D:/Worktrees/Database/ward-builder-four`, branch
`ward/invented-figure-markers-20260909`. Never pushed. **No component and no test file was mutated
or edited to produce this — every number below is from a read-only probe over the real corpus and a
hand-written adversarial corpus.**

Answering Ward Lead's open question (1): _does `MARKER` hold on more than the four strings it was
proved on?_ **It does not, in both directions.**

---

## The predicate under test

`tests/ward-provenance-sentences-carry-their-own-marker.test.ts` decides whether a sentence
discloses its own provenance with one alternation of twelve spellings. Its self-test proves it on
**four** strings — two it must accept, two it must reject. Four strings cannot separate a predicate
that works from one that happens to agree on four cases.

---

## 🔴 1. Ten of the twelve spellings are load-bearing on nothing

For each spelling: how many real provenance sentences it matches, and how many it is the **sole**
match for — i.e. how many would go red if it were deleted.

| spelling                                                                                                                               | matches | sole match | verdict         |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- | --------------- |
| `invented`                                                                                                                             | 4       | **1**      | load-bearing    |
| `no live (systems?\|integration)`                                                                                                      | 1       | **1**      | load-bearing    |
| `prototype`                                                                                                                            | 2       | 0          | carries nothing |
| `no real`                                                                                                                              | 2       | 0          | carries nothing |
| `placeholder`                                                                                                                          | 1       | 0          | carries nothing |
| `synthetic`, `fictional`, `not real`, `not a real`, `no figure here`, `not a (clinical )?record`, `nothing … is (a )?(real\|clinical)` | 0       | 0          | carries nothing |

**Deleting ten of the twelve leaves every real sentence green.** They are not holding the corpus up.
They are tolerance for rewords nobody has written yet — and every one of them is also attack surface.

---

## 🔴 2. Eight of thirteen invented-figures-as-fact slip through, and the strongest words admit them

The five plainest cases are all caught — _"There were 28 referrals this period."_ included. The
guard fails on the shape my own reword-arms document named **arm D, the bystander**: the marker word
is satisfied by a _neighbouring clause about a different subject_.

| the sentence                                                                        | admitted by   |
| ----------------------------------------------------------------------------------- | ------------- |
| _"This prototype shows that four beds are ready to admit right now."_               | `prototype`   |
| _"In the prototype, the average wait was eleven hours across the last seven days."_ | `prototype`   |
| _"The ward names are invented; there were 28 referrals this period."_               | `invented`    |
| _"There is no real difference between the two wards, and 28 referrals arrived."_    | `no real`     |
| _"The placeholder logo aside, three teams have capacity today."_                    | `placeholder` |
| _"Unlike the synthetic patient names, these bed counts are current."_               | `synthetic`   |
| _"These figures are **not** invented — they are the current state of the network."_ | `invented`    |
| _"This is **no longer** a prototype, and the eleven-hour figure is measured."_      | `prototype`   |

⚠️ **Read the last two again.** Those sentences assert the exact opposite of the owner's ruling —
_this figure is real_ — and the guard is satisfied **because they contain the word `invented` or
`prototype` while denying it.** A negated marker counts as a marker. That is not a tolerance
setting; it is the guard accepting a claim that the figure is measured.

Defects admitted, per spelling: **`prototype` 3 · `invented` 2 · `no real`, `placeholder`,
`synthetic` 1 each.** `prototype` is the weakest link and carries none of the corpus.

---

## 3. It also reddens honest prose — 6 of 15 rewords a person would actually write

`fabricated` · `dummy data` · `made up` · `illustrative only` · `sample value` ·
_"None of the numbers on this screen are real."_ (the alternation has `not real` / `no real` /
`not a real`, and this negates differently).

**This is why the obvious fix is wrong.** A guard that reddens correct work gets widened until it
means nothing — the failure this repository keeps recording.

---

## 🔴 4. The trade, priced, so nobody picks a direction from intuition

| predicate                          | honest prose reddened | defects admitted | real corpus |
| ---------------------------------- | --------------------- | ---------------- | ----------- |
| **today — all 12 spellings**       | 6 / 15                | **8 / 13**       | green       |
| **narrowed to the 2 load-bearing** | **11 / 15**           | 2 / 13           | green       |

Narrowing removes six of the eight defects **at zero cost to the real corpus today** and nearly
doubles the honest-prose reds. Both remaining defects are `invented`, which cannot be deleted — it
is the sole support of a real sentence.

**Neither column is the answer, and this is the finding.** The list is the wrong instrument. My own
reword-arms document already wrote the rule this violates:

> **Tolerance is bought by listing more FULL spellings, never by listing a fragment of one.**

`prototype`, `invented`, `synthetic`, `placeholder` are **topic words, not claims.** A sentence can
contain any of them while disclosing nothing about its own figure, which is precisely what the eight
cases above do. `no live (systems?|integration)` is a full claim, and it admits nothing.

**So the repair is a change of shape, not of length** — each alternative must be a claim that cannot
be true of a bystander, plus a rejection of a negated marker. **That is design work on a guard whose
strength is the point, it is Ward Lead's file, and I have not done it.** This document exists so it
is decided on the numbers.

---

## 5. What this does NOT say

- **Not that the guard is worthless.** It catches all five plain statements of an invented figure as
  fact, including the ruling's own case, and it caught the one real defect it was built to find.
- **Not that the adversarial corpus is the population.** Thirteen sentences I wrote are not a
  measurement of prose that exists; they are a measurement of the predicate. The real corpus is five
  sentences, and all five are compliant.
- **Not measured: the fourteen unexamined screens.** Still UNEXAMINED, still not compliant.
