> # 🔴 SUPERSEDED — 2026-09-08. DO NOT FOLLOW THE BRANCH INSTRUCTIONS BELOW.
>
> This document was written when `claude/Ward-design` held the register and
> `claude/ward-flow-phases-6-7-design` held the code. **Both statements are now false.**
> The single master line is **`codex/task-ward-flow-live-state-20260831`**, and every
> ward document named below is present on it.
>
> **It is kept because it is a handover document, and handover documents are never deleted
> here — including superseded ones.** It records how the project was organised at the end of
> August 2026, which is worth having. It is not an instruction.
>
> **For the current state, read `docs/ward-flow/archive/dated-notes/WARD-LEAD-HANDOVER-2026-09-07.md`.**
>
> ⚠️ It was also the only copy of itself anywhere: it lived on `claude/Ward-design` alone and
> was not on the master line until today. A document that exists on one branch is one branch
> deletion away from gone — which is why it is here now, banner and all.

---

# Ward Flow — handover prompt for a Codex session

**Paste the block below into a fresh local Codex session.** Everything above it is for the owner.

⚠️ **Before you use this, read "What is not safe" at the bottom.** A Codex session can read and plan
here safely. Building here at the same time as the live Claude sessions is a different question.

---

## THE PROMPT — paste from here

You are joining **Ward Flow**, a synthetic, offline prototype of a psychiatric bed-flow hub for
Western Australia. It is reachable only at `/mockups/ward-flow`. It is **not** clinical decision
support and must never be presented as such. Its purpose is to show colleagues what such a system
would have to do.

### First, orient yourself — do not skip this

The repository is `D:\Repos\Database`. **The register of record for every decision on this project
is `docs/ward-flow-ledger.md`.** Read it before doing anything else. It is long; read the rules
section and section C at minimum.

⚠️ **CRITICAL — WHICH BRANCH.** Two copies of that ledger exist and they drift:

- **`claude/Ward-design`** — the authoritative copy. The register is written here.
- **`claude/ward-flow-phases-6-7-design`** — the working line, where the code is. It carries a
  near-current copy that has been behind by one commit at least once.

**If the two disagree, `claude/Ward-design` wins.** Check with:

```bash
git show claude/Ward-design:docs/ward-flow-ledger.md | wc -l
git show claude/ward-flow-phases-6-7-design:docs/ward-flow-ledger.md | wc -l
```

**The code lives on `claude/ward-flow-phases-6-7-design`. Neither branch is on `origin/main` and
neither is ever pushed.**

### The design specs

All on both branches, under `docs/superpowers/specs/`:

- `2026-08-30-ward-flow-ed-psychiatry-hub-design.md`
- `2026-08-30-ward-flow-coordinator-hub-design.md`
- `2026-08-30-ward-flow-community-hub-design.md`
- `2026-08-30-ward-flow-transport-design.md` — the flow: who books, who cancels
- `2026-08-30-ward-flow-transport-page-design.md` — the `/transport` page
- `2026-08-30-ward-flow-network-diagram-design.md`
- `2026-08-30-ward-flow-header-design.md`
- `2026-08-30-ward-flow-capacity-design.md`
- `2026-08-30-ward-flow-ward-forms-design.md`

**The code is under `src/components/ward-management/`.** The model is `ward-model.ts`; the state
machine is `ward-flow-reducer.ts`; derived values are `ward-derivations.ts`.

### Absolute constraints — these are the owner's and they are not negotiable

1. **Never invent a figure, timeframe or threshold from the Mental Health Act — anywhere.** Not in
   code, copy, comments, tests or fixtures. If a number is needed and the owner has not supplied it,
   stop and ask.
2. **Synthetic data only.** Patient names must be **obviously** synthetic — no realistic Australian
   name/suburb pairs. A screen of plausible invented patients in front of health-service staff is
   the hazard this rule exists for.
3. **No free-typed values**, with exactly one exception: a single optional story field on a
   referral. **A suburb is not an address**; addresses and narrative history are refused everywhere.
4. **Never push, never open a pull request.** Both branches exist on one disk only.
5. **Never `git stash`** — the stash stack is shared across every worktree on this machine.
6. **Never `git add -A`.** Stage named paths only.
7. **Never touch OpenAI, Supabase, hosted CI or a live database.**
8. **Never weaken a test to make something pass.**

### How this project has repeatedly gone wrong — read this, it will save you hours

The ledger's `R` rows are a catalogue of real failures from this project. The ones most likely to
bite you:

- ⚠️ **A search that returns a confident wrong answer.** `| head -1` silently picks the wrong file
  when a pattern matches two. Guessing a symbol name returns nothing and looks like absence.
  Reading `ReferralDraft` when the question was about `Referral`. **Print every match and its count
  before using one; if the count is not 1, the question is not properly asked.**
- ⚠️ **A colliding reference resolves to the wrong real thing.** There are two "Phase 9"s and two
  "phase 4"s in this project. **Cite by document and id together, never by phase number.**
- ⚠️ **Reading the tree instead of the log.** Half-built work looks exactly like a wrong build.
  For any _why is this like this_ question, `git log -S` before concluding.
- ⚠️ **A green test report can be one file short.** Vitest printed `83 passed (83)` when 84 were
  handed in, exit 0, nothing red. **State both numbers: files handed in and files passed.**
- ⚠️ **Verify the commit, not the tree.** This machine has killed `git commit` mid-command while the
  edit landed. `git show HEAD:<path>` is the check; a clean `git status` is not.

### What is decided and what is open

**Everything is in the ledger.** Rows carry a status; the ones that matter to you:

- `DECIDED, NOT BUILT` — build it, do not re-decide it.
- `DECIDED — CUT BEFORE BUILD` — the owner decided it and then removed it from scope. **Do not
  build it and do not treat the missing implementation as a gap.**
- `PROVISIONAL` — a stand-in the owner will replace. Change it in one place; do not spread it.
- `OPEN — owner decision owed` — **stop and ask him. Do not choose.**

⚠️ **A decision recorded here may still be unbuildable.** Two examples live right now: a ruling that
the referral clock stops on arrival, against a model that until recently had no arrival instant; and
two clocks that cannot both run because nothing links `Movement` and `Referral`. **Check the model
can express a decision before building to it.**

### If you change anything

- **Commit as soon as a file is readable, not when it is finished.** Sessions here have been killed
  mid-task.
- **Never `git commit --amend`** — it destroys the previous state as a precondition, and presents
  afterwards as a branch that lost a commit for no reason. Add a follow-up commit.
- **If you edit the ledger, every anchor is a hard assert that throws.** A conditional edit that
  silently no-ops while printing success has already caused a false report to another session here.

---

## What is NOT safe — owner, read this

**Reading and planning in Codex is safe.** The ledger and specs are comprehensive and current on
`claude/Ward-design`.

⚠️ **Building in Codex at the same time as the live Claude sessions is not, unless it has its own
worktree.** Five sessions are currently editing this repository in separate worktrees. Two writers
in one working tree deadlock, because the pre-commit hook inspects the whole tree.

⚠️ **And a new worktree is its own problem** — this machine already has ~148 of them and has been
running out of resources, killing sessions and swallowing commits.

**So: Codex is safe for reading, reviewing and planning now. For building, it needs either its own
worktree (which costs resources) or for the Claude sessions to have stopped.**
