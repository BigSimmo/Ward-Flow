# Fold ready — `61f757ba5cab4597a9fc5cafa3b268e9b019b5d1`

**For Ward Lead. Written to a file because messages to it have queued rather than delivered three
times; it confirmed that reading them off the branch with `git show` works.**

Supersedes the head figures in [`PHASE0-RESOLUTION-2026-09-10.md`](PHASE0-RESOLUTION-2026-09-10.md)
and [`WARD-MOCKUPS-STATUS-2026-09-10.md`](WARD-MOCKUPS-STATUS-2026-09-10.md), which were true when
written. **The tip has moved.**

    fold this   61f757ba5cab4597a9fc5cafa3b268e9b019b5d1
    line at     8c5aebc938d0ceffead901866e23d26efd3a781b   (re-measure; it moves)

---

## The five acceptance checks, measured on the committed tip

| #   | Check                                      | Reads      | Wanted | Verdict      |
| --- | ------------------------------------------ | ---------- | ------ | ------------ |
| 1   | `git merge-tree --write-tree <line> <tip>` | **exit 0** | exit 0 | **PASS**     |
| 2   | `grep -c "AUDIT 2026-09-09"`               | **12**     | 12     | **PASS**     |
| 3   | `grep -c drawerMenu`                       | **13**     | 13     | **PASS**     |
| 4   | `grep -c accent-press`                     | **6**      | ≥ 1    | **PASS**     |
| 5   | `grep -ci "About these figures"`           | **2**      | 2      | **PASS**     |
| 6   | `check-output.txt` `grep -c "ALL GREEN"`   | **36**     | 18     | 🔴 see below |

🔴 **Check 6 cannot succeed, and it is the check that is wrong, not the tree.** Ward Lead flagged
this figure as inferred rather than measured, and said to report rather than bend it — so:

`check-output.txt` here is **byte-identical to the plan branch's own** (`cmp` clean, 1584 lines), and
**the plan branch's own file reads 36.** _"Eighteen green"_ means eighteen `exit 0` lines:

    git show <line>:docs/ward-flow/mockups/third-edition-kit/check-output.txt | grep -c "^exit 0"   ->   18

**Run check 6 as written and it fails on the plan branch's own artefact, and reads as though this
branch broke something.**

## The merge that got here

`git merge-tree` named **one** conflict. It was **three hunks** — it names the FILE once, not each
hunk. **Second time in one day.** Read individually, never taken as a side:

1. A line-**wrap** difference inside one comment. Identical words.
2. This branch holds the disclosure the line lacks (`About these figures`, 1 → 2) **and** the line's
   own AUDIT sentences. Superset.
3. This branch holds the **conditional dot** — it turns `danger` and the sentence says how many
   figures do not reconcile; the line has a fixed `good` dot and no failure reporting. Superset.
   **The line's explanatory comment, which this branch lost in the previous merge, is restored with
   it**: a green dot over a failed reconciliation is the same class of defect as the _"Live"_ claim
   that comment exists to record.

**Proved:** `command` and `handover` both `check.mjs` ALL GREEN exit 0 and `check-shell.mjs` ALL
GREEN exit 0. Formatted individually, never a whole-tree pass. `.prettierignore` untouched.

## In flight in this worktree right now

**Four page builds**, one agent per page, each owning one new file and none committing:

    add-a-patient-third-edition.html          Sonnet
    statistics-service-third-edition.html     Sonnet
    referrals-third-edition.html              Sonnet
    out-of-area-third-edition.html            Opus — the catchment ruling needs judgement

**None of them touches an existing file**, so folding `61f757ba5c` now is safe and nothing of theirs
is half-written into it.

## The four rulings received, and what has been done with them

| Ruling                                                                            | Status here                                                                                                                                                    |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q-10 YES** — seven screens added to the standard's §14 index                    | **not started.** The standard is the owner's; say the word and it is one pass.                                                                                 |
| **Q-13** — the referral's three prose blocks lose to the one-story rule           | **not started.** A redraw of `raise-a-referral-third-edition.html`.                                                                                            |
| **Q-11** — remove rail brass bar and flow-map ED-node bars, keep the brand stripe | **not started, and it is a SHARED-LAYER change** — the rail is in the shell, so it is made on Command and applied to every page by script, never page by page. |
| **D-1** — the screen is called **Patient**, not "Patient Now"                     | **noted.** Anything a person reads must say Patient. The filename is a separate question.                                                                      |

## On notices, since it was put to this chat

Ward Lead's ruling — that the words follow the standard, the visual treatment is the existing
drawer's, and inventing a notice design is not a builder's to do — **is the right call, and no
drawing should be commissioned for it yet.**

**But one thing does need the owner:** the standard's §6 has no component for _"the system told
somebody something"_. The Tasks drawer holds work a coordinator must do; a notice is different — it
is a thing that happened, addressed to a person. **If notices become a real capability, that is a new
component in §6 and it is the owner's to approve, not a builder's to improvise.** Raised, not built.
