# Phase 0 — the resolution Ward Lead asked for

**Written 2026-09-10, later the same evening. A companion to
[`WARD-MOCKUPS-STATUS-2026-09-10.md`](WARD-MOCKUPS-STATUS-2026-09-10.md), whose §1 and §2 this
supersedes** — those figures were true when written and the tip has moved since.

🔴 **Two messages to Ward Lead came back undelivered, which is why this is a committed file.** Its
own handover says anything it must have goes into one.

    resolution SHA   66000a388a740c42c93b2a49997caacc7eed6944
    branch           ward/mockups-20260910
    vs the line      29 behind, 13 ahead
    uncommitted      NONE

---

## 1 · Why it was short, not long

Ward Lead measured a conflict on `command-third-edition.html` from both directions, would not pick a
side, and **was right not to.** What it did not have was this:

    git merge-base --is-ancestor b7812ae17c e9c6900e3e   ->   TRUE

**The plan branch is the branch already merged here at `b06652fba2`, plus six commits.** So the
resolution was an incremental merge, not a three-way reconstruction.

Sixteen pages conflicted, not one: the plan's six commits changed the shell on every page, and the
owner's §7 pass changed the freshness line on every page. **Same region, so every page collided.**

## 2 · 🔴 Where the danger actually was, and it was one file

    git diff --numstat <line> b7812ae17c -- <page>

| Population        | What the line holds that the plan's base lacks       |
| ----------------- | ---------------------------------------------------- |
| Fifteen pages     | **nothing**                                          |
| `command-…​.html` | **+170 / -71** — the AUDIT 2026-09-09 clinical fixes |

**So `git checkout --theirs` was safe on fifteen files and would have silently lost the clinical work
on the sixteenth.**

Resolved by taking the theirs side of each **hunk, in place** — never a whole file — so every
auto-merged region, which is where Command's clinical fixes live, survived untouched.

## 3 · The freshness line carries both sides

The plan branch's version is a **real honesty fix this branch lacked**: the dot turns `danger` and
the sentence says how many figures do not reconcile, instead of reading green regardless. The owner's
§7 ruling is the sentence. Both kept:

    agreeing      Invented figures, reconciled with each other, as at 10:42, last event …
    disagreeing   Invented figures, 3 figures do not reconcile, as at 10:42, last event …

Applied as **one shared-layer pass over all eighteen pages**, never page by page.

⚠️ **Five needed a second matcher.** Ward, Search hub, Raise a referral, Ward statistics and ED
statistics are full HTML documents, so Prettier indents them four spaces deeper, which pushes the
ternary past the print width and wraps it across four lines instead of one. **Same code, two
shapes — exactly the five the kit handover names.**

## 4 · 🔴 One of the three acceptance checks cannot succeed

Measured on the committed tip:

| Check                    | Reads | Wanted | Verdict                              |
| ------------------------ | ----- | ------ | ------------------------------------ |
| `accent-press`           | 6     | ≥ 1    | PASS                                 |
| `About these figures`    | 2     | 2      | PASS                                 |
| `check-output ALL GREEN` | 36    | 18     | **the check is wrong, not the tree** |

`check-output.txt` here is **byte-identical to the plan branch's own** — `cmp` clean, 1584 lines —
and **the plan branch's own file reads 36.** _"Eighteen green"_ means eighteen `exit 0` lines, which
is what the file holds. The correct check:

    git show <tip>:docs/ward-flow/mockups/third-edition-kit/check-output.txt | grep -c "^exit 0"   ->   18

**Run as written it fails on the plan branch's own artefact, and reads as though this resolution
broke something.**

## 5 · All three sides present, measured on the committed tip

    clinical dxHtml fix (line)      1
    correct ward ordering (line)    2
    shell fixes (plan)              6   accent-press
    owner §7 wording                1

## 6 · Proved after a sixteen-file merge, on the whole population

    check.mjs        18 of 18 pages GREEN, 0 red, exit 0 each
    check-shell.mjs  command 30/0 ALL GREEN, handover 30/0 ALL GREEN
      PASS  the activity line carries its own provenance, never live
            Invented figures, reconciled with each other, as at 10:42, last event 10:10

No whole-tree format pass; each file formatted individually. `.prettierignore` untouched.

## 7 · The commits, for reading — fold the tip, do not cherry-pick

| SHA          | What it is                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `6db2ae045f` | The opening brief for this chat.                                                                                                                                                                                                     |
| `b06652fba2` | MERGE of `b7812ae17c`. **Conflict was THREE hunks, two of them master-line fixes** — a clinical `dxHtml` audit, and a sentence with the ward ordering **reversed** (`AV_ORDER` is eligible 0, declined 1, overridable 2). Both kept. |
| `38290af7ee` | `mockups/README.md`, new — a landing page for the drawings.                                                                                                                                                                          |
| `15a4be1b22` | `handover-third-edition.html`, **new**, the 17th page.                                                                                                                                                                               |
| `66c14961a3` | Owner §7 adopted on 18 pages, the check-shell assertion, and the README.                                                                                                                                                             |
| `0155d5b2e3` | `WARD-MOCKUPS-STATUS-2026-09-10.md` — the earlier undelivered report.                                                                                                                                                                |
| `66000a388a` | **THIS merge.**                                                                                                                                                                                                                      |

⚠️ **`0155d5b2e3` answers Ward Lead's earlier (a)–(e) in full**, including the acuity trap being live
at `command-third-edition.html:6168`, and `shell-sweep.mjs` reporting DRIFT on 15 of 16 pages
**before** anything done here (baseline built from `HEAD`'s own files; verdicts byte-identical).

## 8 · Not started, waiting on the owner through Ward Lead

Plan items **I-19** (the seven screens missing from the standard's §14.1), **Q-13** (the Raise a
referral prose blocks against the 2026-08-30 one-story-field ruling) and **Q-11** (rail brass bar,
flow-map ED-node bars, brand stripe).

**One page of the eleven the owner asked for is done — Handover. Add a patient is next and
unstarted.**

Nothing pushed. `main` untouched. No `git add -A`, no bare stash, no worktree removed.
