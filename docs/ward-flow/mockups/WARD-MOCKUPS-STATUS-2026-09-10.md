# Ward Mockups — status for Ward Lead, 2026-09-10 evening

**Written because the message did not deliver.** Ward Lead's own handover says anything it must have
goes into a committed file as well as a message, since messages sit undelivered while it is busy.
This is that file. Everything here is measured from git, with the command named.

---

## 1 · State

    worktree      D:/Worktrees/Database/ward-mockups
    branch        ward/mockups-20260910
    tip           66c14961a336467b591e2f989db90f34353c84f3
    vs the line   27 behind, 5 AHEAD
    uncommitted   NONE

`git rev-list --left-right --count codex/task-ward-flow-live-state-20260831...HEAD` → `27  5`

⚠️ **Ward Lead's message said 3 ahead at `38290af7ee`. That was true when measured and was stale on
arrival** — two more commits landed while it was in flight. **Five is the number.** Its §2 gives the
line tip as `57b4e2b0ac`; `git rev-parse` here reads **`47083898fa`**. Re-measure before folding.

## 2 · The five unfolded SHAs, oldest first

| SHA          | What it is                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `6db2ae045f` | The opening brief for this chat. One root file, no ward paths.                                                            |
| `b06652fba2` | **MERGE of Design System `b7812ae17c`** — the 16 third-edition mockups, the standard, the kit. 🔴 Read §3 before folding. |
| `38290af7ee` | `docs/ward-flow/mockups/README.md`, new. A landing page for the drawings.                                                 |
| `15a4be1b22` | `handover-third-edition.html`, **new** — the 17th page. check.mjs 86/0, check-shell 30/0.                                 |
| `66c14961a3` | Owner ruling §7 adopted on all 18 pages, the check-shell assertion, and the README.                                       |

## 3 · 🔴 The merge conflict was THREE hunks, not one, and two of them were fixes

`git merge-tree` reported "one conflict" and **that reading was wrong: it names the FILE once, not
each hunk.** `command-third-edition.html` conflicted in three places. Resolved hunk by hunk per
`HOW-TO-FOLD-2026-09-10.md` §4 — never by picking a side.

1. **`dxLine`/`dxHtml` — a CLINICAL fix the third edition never received.** Master's AUDIT 2026-09-09
   stopped printing a working diagnosis for a movement still in the priority queue: `Movement` carries
   no diagnosis field, `Referral` is forbidden one, and an `Admission` does not exist until a bed is
   pulled. The third edition still printed one from `m.dx`. **Taking their side would have
   re-fabricated a clinical fact for a population that cannot hold one.** Master's sentence kept,
   renamed to `dxHtml` because the merged call site — which merged **cleanly**, from their side —
   calls that name. Keeping master's function verbatim would have left the page calling an undefined
   function.
2. **The candidate-list notes — both sides fixed the same stale sentence independently**, which is why
   this conflicted rather than merging clean. Their disclosure **structure** kept (standard §6.18);
   master's two AUDIT sentences kept inside it. Both corrections are load-bearing:
   - `AV_ORDER` is `{ eligible 0, declined 1, overridable 2 }`. **Their sentence had declined and
     overridable reversed** — a ward that has already declined needs no recorded reason to try again,
     so it is the coordinator's _easiest_ route. Their wording would have sent a coordinator to the
     harder route first.
   - Their _"Specialling left … remaining one-to-one nursing shifts"_ is **exactly the fabricated
     figure the audit removed.** Nothing on that screen tracks specialling as beds fill.
3. The Activity freshness line — since superseded by owner ruling §7. See §5.

⚠️ **Every one of the three looked like a wording tweak in the diff.**

## 4 · The disclosure is NOT missing here

Ward Lead's message says `command-third-edition.html`'s **"About these figures" disclosure did not
survive the fold.** That is true of the line and **not true of this branch.** It is a live control
here — `<button … aria-controls="candNotes">About these figures</button>` at line 7755, with its
announce at 8607 — because hunk 2 above kept their structure deliberately.

**Folding `b06652fba2` restores it to the line.**

    grep -n "About these figures" docs/ward-flow/mockups/command-third-edition.html

## 5 · Owner ruling §7, adopted

Verified at source, not taken from the relay:

    git show codex/task-ward-flow-live-state-20260831:docs/ward-flow/owner-decisions-2026-09-09.md

> **"Adopt _'Invented figures, reconciled with each other'_ everywhere.** The sixteen third-edition
> pages move off _"Synthetic snapshot at …, figures reconcile"_. Open item 7 is CLOSED."

**This supersedes the merge of earlier the same day**, which kept the third edition's wording on the
evidence that `check-shell.mjs` asserted it. That evidence was sound and is now spent. **The
assertion moved in the same commit**, because a harness pinning the superseded sentence would redden
every page for obeying the ruling.

🔴 **The `!/^Live/` guard is KEPT.** The ruling changed which _honest_ sentence is used. It did not
licence the dishonest one that started all of this.

**Proved on the whole population, not a sample:** `check.mjs` **ALL GREEN on all 18 pages** (86 checks
each, 88 on Command), eight widths, both themes, exit 0 every time. The new sentence is longer, so the
historically narrow-fragile pages were the point — `ward` and `statistics-ward` at 320,
`raise-a-referral` and `movement` at 1100 — all green.

## 6 · Still outstanding in this folder

**The five kit files still say "Live, reconciled" and have NOT been touched:**

    third-edition-kit/shell/shell-script.js      GENERATOR — re-emits it
    third-edition-kit/inputs/rail.html           GENERATOR — re-emits it
    third-edition-kit/inputs/SHELL-SPEC.md       SPEC — instructs it
    third-edition-kit/inputs/RAIL-MAP.md         SPEC — instructs it
    third-edition-kit/inputs/buildsheet.html     SPEC — instructs it

They now need the **§7** wording, not the intermediate one. **Held deliberately** on Ward Lead's "do
not start a new large piece". One scripted pass when lanes are settled.

## 7 · Two findings, both measured against a baseline

### 🔴 The acuity trap is LIVE in this folder

`command-third-edition.html:6168` renders the eligibility gate's detail as:

    u.acuityInUse + " of " + u.acuityCeiling + " high-acuity places in use"

**That is the exact sentence the built gate refuses to print, and which a test bans**
(`/in use|available|free|remaining|left/`), because printing a count of free places re-commits a closed
specialling defect.

**`handover-third-edition.html` does NOT carry it — 0 occurrences.** Confined to Command.

**Raised, not built.** The replacement sentence is a clinical wording decision and belongs to the
owner. ⚠️ **A mockup sits outside every gate, so approval of a drawing is not approval of the sentence
inside it.**

### `shell-sweep.mjs` reports DRIFT on 15 of 16 pages — and did so before any change here

A baseline built from `HEAD`'s own files in a scratch tree and swept there reports **1 SAME / 15
DRIFT, byte-identical verdicts to after.** So this is **not** caused by the §7 pass.

    grep -c "shell-sweep" third-edition-kit/check-output.txt   ->   0

**It appears in no recorded run, so this verdict has seemingly never been read.** Reported, not chased.

## 8 · What is believed and NOT verified

Recorded because three false claims about other chats' state circulated on 2026-09-10.

- **That Ward Builder Four's `_broken-copy.html` is only in its own worktree.** Ward Lead's words.
  Not checked here, and not this chat's to check.
- **That `e9c6900e3e` is 6 ahead of the line.** Ward Lead's figure, unmeasured here.
- **The four-column board claim** was never held or relayed by this chat.

## 9 · Safe to pause

**Nothing uncommitted, nothing in flight.** One page of the eleven the owner asked for is done
(Handover); Add a patient is next and **has not been started**, pending lanes.

Nothing pushed. `main` untouched. `.prettierignore` untouched. No `git add -A`, no bare stash, no
worktree removed.
