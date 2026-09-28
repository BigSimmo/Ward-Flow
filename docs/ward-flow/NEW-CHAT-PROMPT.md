# Starting a new AI chat on Ward Flow

> **Historical archive — do not copy any prompt below.** These prompts name the old
> `D:\Worktrees\Database\ward-lead` checkout and prohibit GitHub use. Both directions are obsolete
> for the current `BigSimmo/Ward-Flow` project. Start a new task from this repository's
> [`AGENTS.md`](../../AGENTS.md) and [`README.md`](README.md). Before any Git write, verify the
> checkout's `origin` is `https://github.com/BigSimmo/Ward-Flow.git` and use a separate worktree
> based on its `main`. Do not use the old `BigSimmo/Database` repository for Ward Flow work.

**Two situations, two different files. Using the wrong one wastes the first hour.**

> **Updated 2026-09-16: read first.** Before using either prompt below, read
> [`handovers/WARD-FLOW-AUDIT-2026-09-16.md`](handovers/WARD-FLOW-AUDIT-2026-09-16.md) and
> [`handovers/WARD-LEAD-START-HERE-2026-09-16.md`](handovers/WARD-LEAD-START-HERE-2026-09-16.md) —
> several claims in the handover folder this document points to are stale, and fourteen mockups
> were replaced in committed history and must not be built or verified against.

---

## ① A new chat ON THIS MACHINE, inside the repository

**The file to open:** `docs/ward-flow/README.md`

Paste this as the first message:

```
Read docs/ward-flow/README.md in full before doing anything else, then follow where it points.

The job: build the Ward Flow screens to match the mockup design in docs/ward-flow/mockups/,
keeping the behaviour that already works. The drawings are authoritative on design; the
working engine is authoritative on behaviour; every deviation gets written down with its reason.

Four rules that are expensive to learn late:
1. Ward Flow is NEVER pushed. Both branches exist on one disk only. "Fold into main" always
   means the local ward line, never a remote — a remote push deploys to a live clinical database.
2. Serve a mockup to view it; never open one as a bare file. Each builds its navigation with
   JavaScript and renders as a completely different design when opened directly. A false
   "the build doesn't match" finding was reported to the owner from exactly that mistake.
3. Never read an exit code as the verdict — read the runner's own summary line. For the ward
   suite that line is "files handed in" equal to "files that ran".
4. Nothing automated here can see that a screen doesn't look like its drawing. Thousands of
   passing tests sat over sixteen screens that didn't match. Looking is the only instrument,
   and docs/ward-flow/SCREEN-VERIFICATION.md is where that looking gets recorded.

Do not delete or move anything matching ward-flow, ward-management or ward-board, any handover
or decision document, any worktree, or either ward branch, without asking me first.

Start by telling me what you understand the job to be, and what you'd do first.
```

---

## ② A new AI on ANOTHER PLATFORM, from the handover folder

**The folder:** `C:\Users\joshs\Backups\ward-flow-design-guide-2026-09-12`
**The file to open first:** `START-HERE-HANDOVER.md` — read the section headed
**"ADDED 2026-09-12, LATE"** before the rest of the file, because it corrects it.

Paste this as the first message:

```
I'm handing you a folder for a project called Ward Flow — a hospital ward bed-coordination
tool. Open START-HERE-HANDOVER.md and read the section headed "ADDED 2026-09-12, LATE" FIRST,
because it corrects the rest of that file, then read the whole thing.

Then open mockups/CONTACT-SHEET.html in a real browser. That is the design: 38 drawings on one
page. It must be SERVED or opened in an actual browser — each drawing builds its navigation with
JavaScript, so opened any other way it looks like a completely different design.

The job is to build screens that match those drawings. The drawings are authoritative on design.
Where a drawing and the existing working code disagree about BEHAVIOUR, the working code wins,
and the deviation gets written down with its reason.

Before you tell me anything is finished, note this: nothing automated in this project can see
whether a screen looks like its drawing. Thousands of passing tests sat over sixteen screens
that did not match. Somebody looking at both side by side is the only check that works, and
SCREEN-VERIFICATION.md is where that gets recorded — it currently reads 0 of 17.

Start by telling me what you understand the job to be, and what you'd do first.
```

---

## What to expect back

⚠️ **A good first reply restates the job and asks about something genuinely undecided.** A reply
that immediately starts writing code has not read the design, and that is the failure this whole
folder exists to prevent.

---

# ③ Using the prompt in Codex specifically

**Yes, prompt ① works in Codex unchanged** — Codex reads `AGENTS.md`, which now points at
`docs/ward-flow/README.md`, so it reaches the same place. **But add these two lines**, because
they are the two ways a Codex session goes wrong here and neither is obvious from inside it.

```
You are working on branch codex/task-ward-flow-live-state-20260831. Confirm you are on it
before touching anything — docs/ward-flow/ does not exist on main, so if those files appear
missing you are on the wrong branch, not looking at a broken folder.

Never open a pull request, never push, and never merge anything toward origin/main for this
work. Ward Flow is local-only by design. If another chat is already working in this folder,
do not start here — two sessions in one working folder cannot both commit, and the block is
mechanical with no polite way round it.
```

⚠️ **THE SECOND ONE IS NOT THEORETICAL.** Two builders hit it from opposite sides and spent two
hours each asking the other to "just commit first". **That request is mechanically unanswerable** —
the commit check inspects the whole folder, so neither can commit until one party's changes are
completely out of the way.

⚠️ **AND THE FIRST ONE READS AS YOUR MISTAKE WHEN IT HAPPENS.** On any other branch, every path in
this document returns "no such file" — which looks like a bad handover rather than a wrong branch.

---

# ④ THE CODEX PROMPT — folder to select, then paste this

**Select this folder in Codex:**

```
D:\Worktrees\Database\ward-lead
```

⚠️ **Only one session may work in that folder at a time.** If a Claude chat is still live in it,
do not start Codex there — two sessions in one folder cannot both commit, and there is no polite
way round it.

Paste this as the first message:

```
You are continuing an existing project. Read before building.

FIRST: confirm you are on branch codex/task-ward-flow-live-state-20260831. docs/ward-flow/ does
not exist on main — if those paths look missing, you are on the wrong branch, not looking at a
broken handover.

THEN: read docs/ward-flow/README.md in full, and follow where it points. It is the entry point
and it is current. Do not start from your own assumptions about this codebase.

THE JOB
Ward Flow is a hospital ward bed-coordination prototype. The engine works and about 5,000 tests
pass. The screens do not look like their design. Your job is to rebuild 17 screens to match the
drawings in docs/ward-flow/mockups/, keeping the behaviour that already works. Nothing is
unbuilt — roughly seven screens are close and ten are partial. Expect 8-12 days.

The drawings are authoritative on DESIGN. The working engine is authoritative on BEHAVIOUR where
the two disagree. Write down every deviation with its reason; do not silently follow a drawing's
behaviour over a working engine, and do not silently keep a screen's layout over its drawing.

THE FIVE THINGS THAT COST A DAY EACH IF LEARNED LATE
1. Serve a mockup to view it. Never open one as a bare file. Each builds its navigation with
   JavaScript and renders as a completely different design when opened directly — a false "the
   build doesn't match" finding was reported to the owner from exactly that mistake.
2. Never read an exit code as the verdict. Read the runner's own summary. For the ward suite
   that line is "files handed in" equal to "files that ran". A run that died before starting
   reports identically to one that ran and failed.
3. Nothing automated here can see that a screen does not look like its drawing. Thousands of
   passing tests sat over sixteen screens that did not match. Looking is the only instrument.
4. Ward Flow is NEVER pushed. Both branches exist on one disk only. No pull request, no push,
   no merge toward origin/main — that deploys to a live clinical database. "Fold into main"
   always means the local ward line.
5. Never delete or move anything matching ward-flow, ward-management or ward-board, any handover
   or decision document, any worktree, or either ward branch, without asking the owner first.
   "Nothing imports it" is never a sufficient reason.

HOW A SCREEN IS FINISHED
docs/ward-flow/SCREEN-DEFINITION-OF-DONE.md is the checklist — including comparing the screen
against its drawing at 390px, 820px and 1440px, in both light and dark. When you have done that,
RECORD IT in docs/ward-flow/screen-verification.json and regenerate the record. It currently
reads 0 of 17 looked at. An unrecorded check and a check that never happened are the same thing:
that is how two screens were previously reported as verified when they were not.

If you edit a drawing, regenerate docs/ward-flow/mockups/MANIFEST.json or the commit will stop.

START BY doing none of the above. Tell me what you understand the job to be, which screen you
would take first and why, and anything in the handover that looks contradictory or unclear. Do
not write code in your first reply.
```

⚠️ **A good first reply restates the job and asks about something genuinely undecided. A reply
that starts writing code has not read the design — which is the failure this whole project exists
to stop repeating.**

---

# ⑤ A NEW SESSION CONTINUING CASELOAD SYSTEM & MASTER ISSUES REMEDIATION (Current: 2026-09-14)

**Folder to select:**

```
D:\Worktrees\Database\ward-lead
```

Paste this as the first message to continue directly from the 2026-09-14 handover:

```
You are continuing development on Ward Flow, a psychiatric ward bed-coordination and patient flow prototype.
Confirm you are on branch `codex/task-ward-flow-live-state-20260831` in `D:\Worktrees\Database\ward-lead` before doing anything else.

1. CRITICAL GOVERNANCE & SAFETY RULES:
   - Ward Flow is NEVER pushed to origin/main. Both branches exist on one disk only. Pushing to origin/main deploys to a live clinical database.
   - Owner Ruling D-11 applies: There are two separate ledgers. Ward Flow issues and tasks live in `docs/ward-flow/PROJECT-ISSUES.md` and `docs/ward-flow-task-ledger.md`. Never touch `docs/outstanding-issues.md` for Ward Flow.
   - 100% CSS strict tokenization: Zero raw hex/rgb/hsl literals in `src/components/ward-management/` CSS files. Use `var(--...)`.

2. MANDATORY CONTEXT TO READ FIRST:
   - Read the latest handover: `docs/ward-flow/handovers/WARD-FLOW-HANDOVER-2026-09-14.md`
   - Read the Master Issues Catalog: `docs/ward-flow/PROJECT-ISSUES.md` (authoritative register of 62 verified issues: 13 P0, 21 P1, 28 P2, and 13 active blocking questions)
   - Read the reconciled task ledger: `docs/ward-flow-task-ledger.md` (mapped to Invariants I-01..I-14 and Families WF-01..WF-52)
   - Read the project entry point: `docs/ward-flow/README.md`

3. WHAT WAS JUST COMPLETED & VERIFIED:
   - Built and verified Third-Edition Patient Search (`src/components/ward-management/search/patient-search.tsx`, `search-filters.ts`, `search.module.css`):
     * 4 dropdown filters (Service, Setting, Legal Status, Wait Band) with dynamic facet counts `(N)`.
     * 7 quick query chips (Form 1A, Form 4A, Form 5A, Peel ED, Adult Secure, Waiting > 24h, Unplaced).
     * Yield summary strip (5 clinical metrics) and 1-click filter reset.
     * 46 vitest DOM tests passing (`tests/ward-patient-search.dom.test.tsx`), 22 unit tests passing (`tests/ward-patient-search.test.ts`), 0 typecheck errors, 0 raw colours.

4. IMMEDIATE MISSION & REMEDIATION ROADMAP:
   Begin tackling the top Tier 1 P0 Critical defects:
   - ISSUE-P0-01: Form 1A 24-hour statutory countdown clock in ED (`ed-screen.tsx`, `ward-legal-forms.ts`). Form 1A expires after 24h under WA Mental Health Act 2014 §34; decouple from the 1440m operational target and render an urgent breach countdown.
   - ISSUE-P0-02: Enforce Owner Ruling D-14 cross-ward default-deny privacy boundary (`ward-derivations.ts`, `record-preview.tsx`) so ward users cannot see prior declined destinations.
   - ISSUE-P0-03: Enforce Invariant I-05 arrival rollback prevention (`ward-flow-reducer.ts:1924`) so STEP_BACK_STAGE cannot erase physical patient arrival.

Start by summarizing your understanding of the current system state, confirming you have reviewed `docs/ward-flow/handovers/WARD-FLOW-HANDOVER-2026-09-14.md` and `docs/ward-flow/PROJECT-ISSUES.md`, and outlining your proposed plan for ISSUE-P0-01. Do not touch code until we align.
```
