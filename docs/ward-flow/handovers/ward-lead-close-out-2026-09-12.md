# Ward Lead — close-out, 2026-09-12

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**Line: `codex/task-ward-flow-live-state-20260831`. Everything below is true at `44adb6f50d` and
not after.** Every SHA and count in this document is a claim about a specific tree; three chats lost
three rounds today to figures that were correct about the wrong tree. Name the tree or the number
means nothing.

> **This document is written to the BRANCH, not sent as a message.** Ward Mockups did the same thing
> tonight, for the reason it recorded: _"a message that does not arrive looks exactly like one never
> sent."_ Two messages to Lane B genuinely vanished today — the sender's transcript recorded the
> recipient as blocked, and it was not. A fold carries this; a channel might not.

---

## 1 · The standing rules, reaffirmed because each was tested today

**ROUTE EVERY ISSUE AND QUESTION TO WARD LEAD.** Not to the owner, not to another lane. Ward Lead
assembles one list. A question answered into the wrong chat is a question nobody has.

**ROUTE EVERY COMMIT TO WARD LEAD.** Ward Lead is the only chat that folds. Hand over a SHA, never
a branch name — a branch name describes a target that moves after your message is written.

**AND MEASURE BEFORE YOU HAND IT OVER, against WARD LEAD's tip and not your own:**

```
git rev-list --count <ward-lead-tip>..<your tip>
git merge-tree --write-tree <ward-lead-tip> <your tip>
```

🔴 **FOUR HANDOVERS TODAY OVERSTATED WHAT THEY OWED** — four claimed and two owed, seven claimed
and six owed, sixteen claimed and zero owed, eight claimed and zero owed. **Not one was careless.**
Every list was true when written, and Ward Lead had already folded the difference. A status claim
about another tree expires, and one command settles it.

**"FOLD INTO MAIN" MEANS THE LOCAL WARD FLOW LINE. PERMANENTLY** — owner ruling D-8, recorded
machine-wide so it stops being re-asked. Nothing goes to `origin/main`.

⚠️ **And carry the measurement in the direction that shows the hazard.** _"The ward line adds no
migrations to main"_ is TRUE and it is the wrong sentence. **`origin/main` holds TEN migrations this
line LACKS**, four of them fail-closed clinical retrieval guards. A merge preserves them. **A
force-push, a branch replacement, or a publication branch rebuilt from a working tree does not.**
The rule is _"whatever touches main must never be a replacement."_

**NAME ANY FILE THAT IS A RULING WEARING THE SHAPE OF CODE** when you hand it over — a panel order,
a pinned sentence, an expected-array, an exact count. A conflict resolved the obvious way in one of
those silently reverses a person and looks like a tidy-up. Known examples in the line today:
`EXPECTED_PANELS` (owner's panel order, Corridors first), `ward-origin-department-absence`'s pinned
sentence, `STRIP_SPECIMEN`'s exact count, the referral free-text allowlists, and
`sending-team-question-spec-2026-09-12.md`.

---

## 2 · Owner decisions, 2026-09-12

Full text in `docs/ward-flow/owner-decisions-2026-09-12-fold-and-authorisation.md`.

|          | Ruling                                                                                                                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-8**  | "Fold into main" always means the local Ward Flow line. Permanently.                                                                                                                                                                                                                                      |
| **D-9**  | The Mental Health Act authorisation gate **stays overridable**, with his clinical reason: a formed patient sometimes has to go to an unauthorised location under pressure, and it is uncommon. **The code does not change** — what was missing is the REASON, written where the contradiction is visible. |
| **D-10** | The small-text raise is **deferred**, with triggers.                                                                                                                                                                                                                                                      |
| **D-11** | **Two ledgers is the design, not a split to repair.** Ward Flow work goes in `docs/ward-flow-ledger.md`. The main project's `docs/outstanding-issues.md` is **disregarded for this project**. Do not tidy them into one.                                                                                  |

**Also ruled tonight, in the same sitting:**

- **The `security` gate follows authorisation** — same answer, stated explicitly rather than
  inferred. 🔴 Until tonight this was deliberately NOT extended, because he had answered about
  authorisation only. Inferring an answer onto a neighbouring question is the D-5 fourth element.
- **O-5 is TWO jobs** — the decline notice addressed to the sending team, and that team's READ
  ACCESS until closure. Neither exists. **Do not let one of them close the ruling.**
- **Median wait**: implement the existing suppression rule _if it is already set up_. Unverified at
  the time of writing — do not build on this line of the handover without checking.
- **The governance banner stays** in the raise-now batch.

---

## 3 · The deferred list

**Deferred by the owner tonight, explicitly, not dropped:**

1. **The safety caveats print smaller than the figures they qualify.** `.note` and its siblings carry
   _"a nought here is a measured answer"_, _"breached can never mean a Mental Health Act deadline"_,
   _"these three must never be summed"_ — all below the legibility floor, while the figures they
   qualify are above it. 🔴 **The figure is legible and the caveat that makes it safe is not.**
2. **`/network`'s bare digits** — 130 bed-count chips and the triage tier digits at 10px with no word
   beside them. Escalated days ago; nobody was working it.
3. **The sign-in outage.** A fix matching the exact mechanism is merged at `fbbb6c16cf`. ⚠️ **Whether
   the deploy landed needs provider access — do NOT close it on the commit.** Prototype, so deferred.
4. **The small-text raise as a single piece of work** — roughly half a day, screen at a time with a
   width check at each. ⚠️ **It cannot be done per-screen**: the four sub-floor classes live in one
   shared file imported by seven files, so raising them for one rebuilt screen raises six others.
   **Raising them IS the sweep.**
5. **The Aboriginal cultural safety review.** Unstarted, and genuinely cannot be done by this team.
6. **The reducer-level judgement-gate test** — see §4.

---

## 4 · The P1 whose title was false for nine days

`#Q6WD1M` read _"Ward Flow places patients with no eligibility check in the reducer at all"_.

🔴 **That has been false since 2026-09-03.** PR #2571 (`b401b65cc`) introduced `SUITABILITY_GATES`
and `eligibilityRefusal()`; its three call sites were re-verified today at `ward-flow-reducer.ts`
lines **1496, 1583, 1834**. The physical gates refuse outright and are not overridable.

**What is actually open** is narrower and the row's own detail states it: there is no REDUCER-LEVEL
proof that the JUDGEMENT gates refuse. The only such assertion exercises `ACCEPT_REFERRAL` on a
fixture where BOTH age and security fail, so a red cannot say which gate did the work; and on the
pull path a specialling refusal fires first for that same pair.

⚠️ **A STALE "THIS IS BROKEN" IS MORE DANGEROUS THAN A STALE "THIS IS COVERED", BECAUSE THE FIRST
PROMPTS ACTION.** The row records that this misreading nearly closed the finding falsely once.

✅ Title corrected through `issues:update` (request `c04f2d2e`), not by editing the table.
**NEXT ACTION when someone takes it: one reducer-level test on the coordinator pull path, using a
movement/unit pair whose ONLY failing gate is a judgement gate.** 1–2 hours, most of it finding the
pair.

---

## 5 · Open and unowned — route these to Ward Lead, do not adopt them silently

- ~~**`tests/source-control-bytes.test.ts` is red**~~ — 🔴 **CORRECTED. IT IS GREEN ON THIS
  LINE**, measured after this handover was first committed: `Test Files 1 passed (1)`, `Tests 7
passed (7)`, node's own exit 0 read apart from any pipe. Lane C measured it independently with a
  POSITIVE CONTROL first — a file carrying one 0x08, found — then all three planning documents at
  zero on the line and at one each in its own tree, which is 164 commits behind.

  🔴 **AND THIS ITEM FLIPPED BETWEEN TWO CHATS FOUR TIMES. THAT IS THE FINDING, NOT THE BYTES.**

  ```
  Lane C reported     open, unowned
  Ward Lead corrected repaired at a45d9b5d4e   — true of the line, not of Lane C's tree
  Lane C accepted     struck it from its handover
  Ward Lead re-opened "real, still open" — in this document, one section below a
                      paragraph warning that a stale "this is broken" prompts action
  Lane C measured     closed on the line, red in its own tree. Same as the correction.
  ```

  ⚠️ **NOT ONE OF THOSE FIVE STATEMENTS WAS CARELESS, AND EVERY ONE WAS TRUE OF THE TREE ITS
  AUTHOR WAS STANDING IN.** The defect is not in anybody's measurement. **It is that a RED gets
  reported as a property of the REPOSITORY when it is a property of a TREE**, and nobody wrote the
  tree beside the claim until the third exchange.

  ✅ **A red is the more dangerous case than a commit count.** A commit count obviously belongs to a
  branch. **A failing test feels like it belongs to the code** — so nobody thinks to ask "whose
  tree?", and the same item can flip indefinitely while every participant is honest and correct.

  ✅ **THE RULE: quote a red with its tip, or do not quote it.** The ward suite's own
  control-character guard is separately green and covers a different population — the two were
  conflated today, by Ward Lead, to the owner, twice.

- **Four lint problems in three files** — governance-registers, out-of-area-board, patient-search.
- 🔴 **`baseRowFingerprint` is recorded, format-validated and NEVER COMPARED.** `resolveIssue` is
  called without it and line 746 OVERWRITES it with the row's current value. **A field whose entire
  purpose is to detect that a row changed cannot detect anything** — in the tool that applies queued
  edits to a clinical issue ledger.
- 🔴 **The inbox queue has no owner.** Several chats fill it, nobody drains it, ten days deep;
  `origin/main`'s half went 15 → 29 in one hour. **Draining it once changes nothing.**
- **`statistics-compare-screen.tsx` defines its own `cannotBeFormed`** and never imports the shared
  absence vocabulary — a second vocabulary one screen from the first.
- **Three absence arms unreachable from any screen** (`empty`, `neverRecorded`, `destroyed`) —
  recorded as available, not missing.
- **The comparison table has no phone scroll threshold** and nobody has measured whether it needs
  one. Department names are long. ⚠️ Left unmeasured rather than invented — **needs somebody at
  375px, not a decision.**
- **The Movements panel move is unverified at phone width.** A panel above the list pushes the first
  patient row down. No gate can see it; nobody has looked.
- **`--t-N` / O-17.1 is unanswered**, and ⚠️ **its trigger is now spent** — Lane D was the first
  rebuild that needed it and built without it. The next rebuild will not be the first, and nobody
  will notice the condition passed.
- **D-1's drawing** (`legal-forms-third-edition.html:8581–8599`) still specifies the overruled sort.
- **The ED hub's two rival drawings** — no written ruling says which is the spec.
- **FD-5's seed specimen** — routed to two lanes, both closed. Orphaned.
- **`scratch_debug_elig.test.ts`** — not a guard, in every lane's full suite, invisible to the ward
  runner.

**Owed by the owner, asked and deliberately not guessed:** whether the 27 ward-side queued requests
are filed into the main ledger first and then migrated, or redirected to the Ward Flow ledger
directly.

---

## 6 · State of the line

**Full ward suite at the last complete run: 450 handed in, 450 ran, 5,109 collected, 5,033 passed.**
The one red then was a zero-width space in `ward-statistics-ed-about-figures.dom.test.tsx`, added
that evening and since fixed. ⚠️ **A fresh full run against `44adb6f50d` has not completed at the
time of writing — do not quote this paragraph as a green line.**

**Ratchet:** 379/379, re-pinned 2026-09-12 with all five prose sentences named per file.

**Backup:** verified by `git bundle verify` — _"The bundle records a complete history."_ ⚠️ The first
attempt tonight **died silently**, leaving a lock file and no bundle, and its log vanished with the
task. It was caught only by checking the output directory rather than believing the run. **Why it
died is not diagnosed.** On a repository that exists on one disk, _"the script printed nothing bad"_
is not evidence a bundle exists.

**34 ward-ish branches owe commits to this line and are deliberately NOT folded.** They are dormant,
superseded, or belong to other programmes. 🔴 **"Not an ancestor" is not "unfolded work"** — folding
a branch because git says it differs is how superseded work returns to life. One exception was
folded tonight: `d1915ed6fd`, a 2026-09-02 Ward Lead handover carrying 63 items with evidence, found
by sweeping git rather than by anyone reporting it, and confirmed genuinely absent from this line
before folding rather than assumed from reachability.

---

## 7 · The defect that hit four chats in one night, in four disguises

|                                                             |                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| a guard against counting a mention as a use                 | **built by counting a mention as a use**                                         |
| a fix whose subject was removing a duplicate                | **left a duplicate** — nine fields returned, eight destructured                  |
| a brief warning that status claims about other trees expire | **built on a status claim about a tree 130 commits away**                        |
| a step-6 repair told to name missing paths                  | **named four of five** — the fifth reported a wrong COUNT, not a vanished folder |

**Every one of these was found by somebody else's instrument. Not one author found their own**, and
several had written the general rule down — one of them twice, in the same file, hours earlier.

🔴 **A WRITTEN DIAGNOSIS DOES NOT SWEEP.** Having the rule, and having published it, changed nothing
until a different person ran it over the work after the author believed they were finished.

⚠️ **And the paired version is the useful half, because the two failure directions look identical in
a report:**

```
generalising from what you were SHOWN    → fix the instance, report it as the set
completing from what you did NOT LOOK AT → treat a slice as the whole file
```

**Both produce a TRUE statement at the WRONG WIDTH. Both survive every gate here**, because every
gate reads what code DOES and nothing reads what it SAYS.

🔴 **And a finding is a claim.** It inherits every failure mode a claim has — while arriving with
the authority of having been FOUND.
