# Ward Lead — handover, 2026-09-10 evening

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**You are WARD LEAD.** Read this, then Josh will paste you the third-edition master build plan.

    worktree   D:/Worktrees/Database/ward-lead
    branch     codex/task-ward-flow-live-state-20260831      <- THE MASTER LINE
    tip        b91f3ca9de
    state      ward suite 4217 passed / 0 failed · typecheck 0 · prettier clean

---

## 0 · The rules that override everything

1. 🔴 **WARD FLOW IS NEVER PUSHED.** It exists on this disk only. No push, no PR, no remote. `main`
   is never touched — not merged to, not fast-forwarded, not `branch -f`, not even locally. Owner
   ruled this twice: _"the ward flow line, not main"_ and _"never add to main... it must be Ward
   Flow!!!!"_
2. 🔴 **NEVER delete or move anything matching `ward-flow` / `ward-management` / `ward-board`, or any
   handover or decision document INCLUDING SUPERSEDED ONES**, without asking Josh and saying exactly
   what would be lost. _"Nothing imports it"_ is never sufficient. A `PreToolUse` hook enforces it.
   **Never edit or disable that hook.**
3. **WARD LEAD IS THE ONLY CHAT THAT MERGES.** Others commit on their own branch and hand you SHAs.
4. **One chat per folder.** Two chats in one worktree deadlock and **NEITHER** can commit.
5. **Never `git add -A`. Never bare `git stash`. Never remove a worktree.**
6. **Providers (OpenAI, Supabase, GitHub, hosted CI) need Josh's explicit say-so EVERY time.**

**Folding doctrine, with the incident that bought each rule:** `docs/ward-flow/HOW-TO-FOLD-2026-09-10.md`.
**Read it before folding anything.** Fold BY SHA, never by branch name.

**How to talk to Josh:** he is a psychiatrist, not an engineer. Answer first, plain English, numbered
steps, one recommendation not a menu, no file paths or jargon unless he asks.

---

## 1 · What Josh decided today, and where it is written

All in `docs/ward-flow/owner-decisions-2026-09-09.md`:

|       | Ruling                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §7    | Activity wording **"Invented figures, reconciled with each other"** everywhere; **high acuity marked by the referring clinician at referral** (system working it out is ruled OUT); repo **stays PUBLIC**; the 58 unwritten test plans are **superseded**; the three real-patient gates are **DEFERRED**                                                                                                                                        |
| §8–§9 | 🔴 **Sex and gender: TWO separate fields, and GENDER decides the bed.** Two genders, Female and Male. _"Treat trans woman as a woman for gender"_ — so there is **no conflict to adjudicate** and **NO OVERRIDE PATH** on that gate. Gender lives on the **patient profile**; the clinician fills it in at referral if absent. **"Not yet recorded" must be a third STATE, never a third gender — and must never default to the recorded sex.** |

---

## 2 · What landed today (all committed, all green)

**The acuity gate, built end to end** — `11af319d14` (build) and `cff539e5b3` (the 56 reds closed).

    ReferralDestination ward arm  highAcuityNursingNeeded   a REQUEST fact, beside secureBedNeeded
    Movement / Admission          highAcuity                referral -> movement -> admission
    Unit                          highAcuityCapacity        authored, 23 wards, INVENTED FIGURES
    ward-admissions.ts            remainingHighAcuityCapacity(unit, admissions)
    ELIGIBILITY_GATES             "acuity", on BOTH paths
    proof                         tests/ward-acuity-gate.test.ts (14 tests, paired both directions)

**Two producers are wired** — the ED intake and the network referral form each gained a two-radio
control that **starts unanswered**. `false` is not a default: it would skip the gate entirely.

🔴 **`acuity` is deliberately NOT in `SUITABILITY_GATES`** — no reason typed into a form creates a
high-acuity nurse. That classification is a ruling and is pinned in `ward-referral-reducer.test.ts`.

🔴 **The drawing prints "N of M high-acuity places in use" and the gate REFUSES to.** Reproducing it
re-commits a closed specialling defect: the authored figure is never decremented and `eligibility()`
sees no admissions, so any subtraction claims headroom that may not exist. A test bans
`/in use|available|free|remaining|left/` in the gate's own sentence.

⚠️ **The scarce-night demo now strands 13 patients, up from 9** (WF-306/312/318/324, every
high-acuity routine movement). **The standard night is UNCHANGED at 2** — which is the number the
scenario guard's warning is actually about. Re-measured and re-dated in `tests/ward-scenarios.test.ts`
and `tests/ward-escalation.test.ts`. **`highAcuityCapacity` is invented on all 23 wards; Josh may
replace the figures and these numbers will move again.**

---

## 3 · What is NEXT, approved and unstarted

1. 🔴 **Build sex and gender** per §8–§9. Fully specified; nothing is blocked. ⚠️ `Unit.sexMix` is
   `Record<Sex, number>` and `sexDesignation` has three values — decide deliberately whether the bed
   mix becomes a GENDER mix, and do not let "not recorded" fall back to sex.
2. **Put the three genuinely-missing clinically-shaped tests on the board** — no-confirmation-dialog
   undo guard; sensitive identity fields component; cross-ward override-record boundary guard.
3. **Pass the Activity wording to Ward Mockups** for all sixteen third-edition drawings. Five kit
   files still carry the old **"Live, reconciled"**: `shell-script.js:1088`, `rail.html:6423`,
   `SHELL-SPEC.md:251`, `RAIL-MAP.md:242`, `buildsheet.html:4854`.
4. **`command-third-edition.html`'s "About these figures" disclosure** did not survive the fold and
   needs re-applying on top of the clinical corrections.
5. **64 queued ledger inbox requests** need `npm run issues:reconcile` from a dedicated fresh-base
   branch — the printed instruction assumes a PR, and Ward Flow has none.

---

## 4 · Waiting on Josh

1. 🔴 **Four scratch files of mine need his word to delete** — the protected-delete hook refuses `rm`
   anywhere in this worktree, correctly, because it cannot tell scratch from an unpushed ward branch.
   All untracked, nothing imports them: `arm.gen.txt`, `msg.tmp.txt`, `patch.tmp.py`,
   `tests/zz-probe.test.ts`. If he approves, prefix the command with
   `CLAUDE_ALLOW_PROTECTED_DELETE=1` — **never by editing the hook.**
2. **The narrow-screen board question** (see §5) — deferred, unanswered.
3. **Real high-acuity staffing figures** for the 23 wards, if he has them.
4. **Thirteen owner questions** are bundled inside the incoming master plan. Put them to him in ONE
   message, not drip-fed.

---

## 5 · The deferred item, and a correction that must not be un-made

`docs/ward-flow/deferred-ward-browser-failures-2026-09-10.md` — **owner deferred fixing; a diagnosis
is not permission.**

⚠️ **A CLAIM I CIRCULATED THIS MORNING WAS WRONG TWICE OVER AND IS RETRACTED IN THAT FILE.** It said
**four columns** were off-screen and that this was **"the predictable consequence of an approved
change"**. It is **ONE column clipped by ~17px, at 641px only**, and the causal story was false and
never checked. It reached Josh, Ward Lead and four builders before anyone checked it. **Do not let
the four-column version come back in a relay.**

The remaining owner question survives the retraction: at narrow widths, do the five approved columns
**drop or stack**, or does the table **accept sideways scrolling and visibly show that it scrolls**?
**Nobody may pick one as part of a repair.**

**Failure 2 is diagnosed and the SPEC is the wrong side, not the app** — `SEEDED_QUEUED_IDS` holds
four ids; the seed and the unit pin both hold six. Fix is to extend it to the model pin's six in
order. **Not run with the set extended, so no fix is proven. Still deferred.**

---

## 6 · The other chats, verified against git rather than the register

| Chat                      | Branch                                  | State                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Design System** (Fable) | `claude/wardflow-design-review-43df97`  | Wrote the **1,040-line master build plan** at `e9c6900e3e`. **Josh hands it to you himself. Fold by SHA only when he says go.**                                                                                                         |
| **Ward Mockups**          | `ward/mockups-20260910`                 | 17 ahead of `da185a9197`. Owns `docs/ward-flow/mockups/**` and `design/prototypes/**`                                                                                                                                                   |
| **Ward Verifier**         | `ward/phone-and-chrome-verify-20260908` | Tree clean at `9ed4f03020`. Holding                                                                                                                                                                                                     |
| **Ward Builder Two**      | —                                       | Tree clean, holding, nothing uncommitted                                                                                                                                                                                                |
| **Ward Builder One**      | —                                       | 🔴 **ITS CLAIM ROW IS STALE.** No ward-builder branch has moved since 2026-09-07; `f51f7d3639` is already an ancestor of the master line. I edited `ed/ed-screen.tsx` today on that basis — **verified against git, not the register.** |

⚠️ **Phase 0 of the incoming plan asks you to fold three mockup commits — `d523d5e3cd`,
`aa985f8517`, `fb7ef96b83`.** Ward Mockups has edited that same folder today, so run
`git merge-tree --write-tree <line> fb7ef96b83` FIRST. **Do not start before Josh says go.**

---

## 7 · Traps that cost time today — every one of these produced a false green

- **`npx vitest run … | tail` returns TAIL's exit code.** A 56-failure run reported exit 0.
- **`--reporter=basic` does not exist here.** It ran **zero tests**, exited 0, and an empty
  failing-file grep read exactly like "everything passes".
- **`grep … | head -20` truncated a list and nearly let me report a field as absent** that was
  present in eighteen files. **Count first; never conclude absence from a truncated list.**
- **vitest does not typecheck.** A hand-written union refused a value while every test using it
  passed. **Run `npx tsc --noEmit` separately, always.**
- **Prettier reflows markdown tables**, so exact-string edits written before formatting stop
  matching. Anchor on line numbers or re-read after formatting.
- **Bash heredocs here break on some content.** When one fails, write the script with the Write tool
  and run the file — do not fight the quoting.
- **Backups:** `env -u MSYS2_ARG_CONV_EXCL bash ~/.claude/scripts/backup-work.sh`. The `MSYS2` fix
  everyone is told to use for `git show <branch>:<path>` **silently stops the backup writing
  anywhere.** And `git bundle verify` checks a bundle against ITSELF — **read the tip out** with
  `git bundle list-heads … | grep ward-flow-live-state`.
- **`npm run format` exits 0 when prettier is absent**, changing zero files. **Zero is the tell.**

---

## 8 · The habit that produced every real finding today

> **A result that agrees with you is the one nobody audits.**

Both of today's substantive corrections came from someone re-checking a claim that was already going
their way. And **record who RAN the check, not only who was right** — the arguments and the
measurements came from different people every time.
