# Ward Flow assignment register

**One line per task, one owner, written down before work starts.** Created 2026-09-06 after I
dispatched the same census section to two chats, both built it, and only a merge conflict made it
visible.

⚠️ **This file exists because the intention did not work.** I told two chats I would "assign each
item once, in writing" and then kept it in my head; three hours later a chat credited me with a
register that was a sentence and nothing else. **A resolution is not a structure.**

## The rules

1. **Claim before you build.** A task not on this list is unowned; a task on it is not yours.
2. **The owner may assign directly.** He talks to chats without going through me, so a row here can
   be incomplete rather than wrong — **ask, do not assume.**
3. **Measurement is not a claim.** Two independent measurements of one set are a control. Two
   independent builds are waste.
   🔴 **AND WHEN YOU CHECK WHETHER A FILE IS SOMEBODY ELSE'S, THE DIRECTION IS THE WHOLE QUESTION.**
   Added 2026-09-06 after I recorded `referral-intake.tsx` as another chat's hot file on the strength
   of `git diff` alone. **It differed because their branch was BEHIND.** A branch that is behind
   differs from yours in exactly the same way as one that is ahead, and no diff can separate them.
   Ask ancestry instead — `git merge-base --is-ancestor <their-last-touch> HEAD`, and
   `git log HEAD..<theirs> -- <path>` for what they actually hold. Both were empty; the file was free
   the whole time, and I had written down a blocker that did not exist.
4. **Record the ruling, not just the task**, where the owner has given one — and quote him.
5. 🔴 **NEVER WRITE "AUTHORISED" IN THE STATUS COLUMN.** Added 2026-09-06 after I did exactly that.
   The status column records **my dispatch decision**; the rulings table records **his**. A status
   reading _"authorised"_ is a word from the wrong vocabulary, and a reader cannot see which of us
   said it. **If the owner ruled, it belongs in the rulings table with his words and the date. If he
   did not, the status is "unasked" — never a synonym for approval.**

## 🔴 THE `!unit.forensic` CLAUSE WAS NEVER AUTHORISED, AND TWO TRUE DOCUMENTS MADE IT LOOK AS IF IT WAS

**Corrected 2026-09-06. This is the failure this register exists to prevent, committed by the person
keeping the register.**

Row 29 read _"Forensic clause … | Builder Two | authorised 2026-09-06"_. **I searched every ward
document: there is no ruling, no owner quote, no date. "Authorised" is my word, not his.**

⚠️ **AND NEITHER DOCUMENT WAS WRONG ON ITS OWN — THAT IS THE WHOLE POINT.** Ward Builder Two's
`tests/ward-network-cohort-structural-gap.test.ts` correctly said the clause _"needs the owner's
authorisation"_. My row appeared to record that the authorisation existed. **A reader who went
looking for it would have found my row and reasonably concluded the test's condition was met.
Together, two accurate documents authorised a clinical change nobody authorised** — forensic status
decides whether a bed can be offered to a particular patient.

**The clause is NOT built.** Verified by Ward Builder Two: `networkHasCohort` does not carry it, and
the two `!unit.forensic` occurrences in `ward-eligibility.ts` (199, 423) are pre-existing and
unrelated — recorded here so that a later grep for that string is not misread as evidence it shipped.

**The correction is written beside the test that names the fix as well as here**, because a
retraction that lives only in a conversation does not travel. **Open question with the owner:
should a forensic unit be excluded from ordinary bed matching?**

## Open

| Task                                                                       | Owner         | Status                                                      |
| -------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| Ready-figure preparation qualifier — 5 screens + the scope guard           | Builder Three | building; board, flow-diagram, shortlist-panel, 2 orphans   |
| Orphaned transport job surface (option 3)                                  | Builder Two   | building                                                    |
| Book-now prompt on pull                                                    | Builder Two   | queued                                                      |
| Audit line: withdrawal vs stage correction                                 | Builder Two   | queued; diff to Ward Lead before commit                     |
| 24-hour pull window + escalation (owner ruling 2026-09-06)                 | Builder Two   | queued                                                      |
| Forensic clause + "nothing free" vs "nothing eligible"                     | Builder Two   | 🔴 **NOT AUTHORISED — see below. Do not build the clause.** |
| ICC → Inner City Clinic collapse                                           | Builder Two   | assigned                                                    |
| Unreachable ward screens — MEASUREMENT ONLY                                | Builder Four  | owner-assigned direct; report only, delete nothing          |
| Unknown — owner-assigned direct                                            | Builder One   | ⚠️ task not known to Ward Lead; establish before assigning  |
| DOM-level qualifier guard (fixture question first)                         | unassigned    | approved as separate work                                   |
| Free-text override box → fixed five-item list                              | unassigned    | paused pending owner confirmation                           |
| Patient Search Console — artifact repair + build into `patient-search.tsx` | Ward Lead     | building; owner-assigned direct 2026-09-06                  |
| Raise a referral — artifact repair + visual pass on `referral-intake.tsx`  | Ward Lead     | building; logic untouched, owner-assigned direct 2026-09-06 |

## With the owner

| Question                                                | Recorded                           |
| ------------------------------------------------------- | ---------------------------------- |
| May a community team decline a referral sent to it?     | 2026-09-06                         |
| Distinguish discharge follow-up from a caseload request | 2026-09-06                         |
| Can a ward revise the referrer's diagnosis block?       | ledger, section B                  |
| The clinician check                                     | `Q1`, questions written 2026-09-06 |

## Closed by ruling, do not rebuild

| Item                                | Ruling                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `raisedBy` — who entered a referral | **Not recorded.** _"Who referred doesn't matter in this case."_ 2026-09-06   |
| ED → community referral             | **Yes, for discharge follow-up.** Path already existed; guard pins it.       |
| `CANCEL_TRANSPORT` role widening    | **Yes** — _"if discharging a patient… need community follow-up."_ 2026-09-06 |
| Site names stay real                | _"Just leave the names as is for now."_ 2026-09-06                           |
| Known zero renders as `none`        | Confirmed 2026-09-06 after the 31-of-69 magnitude was put to him             |

## Folded into the master line, 2026-09-06 evening

Recorded here rather than in my head, which is the whole reason this file exists.

| Commit      | Owner        | What                                                                                                          |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| `79837b371` | Builder Two  | Three events wrote unchecked reasons; two printed the literal word "undefined" where a clinician expected one |
| `77a1b2446` | Builder Two  | Book-now prompt (ruling 17) — it invited a commitment to a bed the screen had only read off the board         |
| `fa268f426` | Builder Four | Commit attribution, 2208 rows, captured while the branches still exist                                        |
| `03f2f97d2` | Ward Lead    | The "STRIPS ONLY COMMENTS" canary, which fired on our own house style                                         |

**State after the fold:** typecheck 0. Ward sweep 289 files passed, 13 skipped (302); 3588 passed,
2 expected fail, 82 skipped (3672). Both totals balance, which is the check that catches a file that
never ran — though not, as it turns out, one that ran three times. Backed up 2026-09-06T080335Z.

## Two things this register did not catch

1. **The canary that fired on the house style.** `ward-transport-page-name` asserted
   `stripped.length > component.length / 2`, which measures COMMENT DENSITY, not the stripper it
   guards. A retirement marker took the file to 53% comments and a correct stripper failed, under a
   message blaming the stripper. ⚠️ **When I mutated the stripper greedy to test my repair, the
   `<h1>` survived** — so the sibling assertion that reads like the real check would have passed.
   The crude ratio was load-bearing and the elegant one was decoration. Mutate before removing any
   part of a guard that fired wrongly.

2. **A test file appended to itself twice, at 15:41, by something outside its own folder.**
   `tests/ward-capacity-view.dom.test.tsx`, 367 lines to 1101, six `describe` blocks where there
   should be two. Proved lossless before restoring (of 734 added lines, **zero** absent from HEAD)
   and the damaged copy kept. All five chats asked; **cause not established.**

   ⚠️ **I relayed "it ran three times" to five chats and published it. It is wrong.** Self-append
   DOUBLES — 367 → 734 → 1468 — so no number of runs lands on 1101; the bytes came from a **fixed
   snapshot**. ⚠️ **My correction then repeated the error one level up: "two operations" is also
   unsupported**, because one write of a doubled buffer produces the same three byte-identical
   copies. **Three copies, one or two write events** — and the difference decides which tool to
   audit, since "twice" sends you hunting a loop or a retry and "once" a concatenation bug. **And the line-ending test that looked like it would name the tool family
   cannot: `.gitattributes` sets `* text=auto eol=lf`, so LF-only is what every file here looks
   like.** Four's swept 178 worktrees with detectors proved on known-good and known-bad input
   first — **this file is the only instance.**
   ⚠️ **This does not fail — it passes three times over**, inflating every count with nothing going
   red. It surfaced only because it held a commit hook for half an hour.

## ⚠️ FOLD INSTRUCTION, PENDING — the route count is 35, and BOTH branches will say 34

**Written down because it is a conflict whose obvious repair is wrong, and it will reach whoever
folds next rather than whoever wrote this.**

`tests/ward-nav.test.ts:164` holds `expect(wardFlowRoutes.length).toBe(33)`. **Verified on master
2026-09-06: `find src/app/mockups/ward-flow -name page.tsx | wc -l` returns 33, so the literal is
currently correct.**

Two sessions are each adding one route, in the same window, on separate branches:

| Route                                               | Branch           | Their literal |
| --------------------------------------------------- | ---------------- | ------------- |
| `/mockups/ward-flow/hub`                            | Ward Builder One | 34            |
| `/mockups/ward-flow/statistics/service/[serviceId]` | Ward Builder Two | 34            |

🔴 **AT THE FOLD IT IS 35. Neither side's 34 is right, and both are right alone.** Do not take
either side of the conflict marker, and **do not bump the literal by one — that is the repair that
feels obviously correct and is wrong for exactly one of them.** Count the files on disk and set the
expectation to what was counted.

### ⚠️ CORRECTED — IT IS FIVE NUMBERS ACROSS TWO FILES, NOT ONE

**My first note named `ward-nav.test.ts:164` and stopped there. Ward Builder One found the rest by
RUNNING the files rather than reading them** — they updated three, missed the `ward-landmarks` pair,
and only the run told them. **Two of the five live in a file nobody thinks to open when adding a
route.**

| File                               | Literal                    | Master | At the fold |
| ---------------------------------- | -------------------------- | ------ | ----------- |
| `tests/ward-nav.test.ts:164`       | `wardFlowRoutes.length`    | 33     | **35**      |
| `tests/ward-nav.test.ts:1150`      | `RENDERABLE_ROUTES.length` | 27     | **29**      |
| `tests/ward-landmarks.test.ts:248` | `wardFlowRoutes.length`    | 33     | **35**      |
| `tests/ward-landmarks.test.ts:284` | `RENDERABLE_ROUTES.length` | 27     | **29**      |
| `tests/ward-nav.test.ts`           | the nav-entry count        | 33     | **35**      |

**Measured on master, not inferred: 33 `page.tsx` files on disk; `REDIRECT_ONLY_ROUTES` holds six
(`constellation, morning, transport, queue, exceptions, escalation`); 33 = 27 + 6.** Both new routes
are renderable, so the fold is **35 = 29 + 6**.

### 🔴 AND TWO OF THE COUNTS ARE IN TEST TITLES, WHERE THEY WERE ALREADY WRONG BEFORE EITHER ROUTE

```
ward-landmarks.test.ts:213   "...: 33 (30 renderable + 3 redirect-only)"     actual: 27 + 6
ward-landmarks.test.ts:260   "RENDERABLE_ROUTES has exactly 30 entries"      actual literal: 27
```

⚠️ **`30 + 3 = 33` sums correctly, which is exactly why nobody caught it — the total was right and
both halves were wrong.** **A breakdown that adds up is not a breakdown that is true**, and a count
in a test TITLE has nothing to recompute it and cannot go red. That file's own comments record being
caught by this twice already.

**Ward Builder One has corrected both titles on their branch. Do NOT fix them here** — that would
conflict with their fold for no gain.

⚠️ **Two additive edits to one counted expectation is a conflict nobody sees coming, because each is
correct in isolation and neither author can see the other's.** Same shape as the `WARD_VIEWS`
collision flagged earlier the same evening — and this one was missed on the first pass.

**Ward Builder Two has put "count the files on disk at the moment of editing, never bump the
previous literal" into their own task brief**, so their side is handled by instruction rather than by
anybody remembering.
