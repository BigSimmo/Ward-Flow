> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

﻿# Ward Flow review findings handover — 2026-09-16

> **Updated 2026-09-16, evening:** read
> [`WARD-FLOW-AUDIT-2026-09-16.md`](WARD-FLOW-AUDIT-2026-09-16.md) and
> [`WARD-LEAD-START-HERE-2026-09-16.md`](WARD-LEAD-START-HERE-2026-09-16.md) first — both were
> produced after this document was grounded (at `f44ae7369d`, 17:23) and check specific claims
> this document makes against later commits.

**Author:** Chief of Staff (Grok Bot)  
**Worktree:** `D:\Worktrees\Database\Ward-lead`  
**Branch:** `codex/task-ward-flow-live-state-20260831`  
**Tip when findings were first recorded:** `1644b3263d` (conflicted)  
**Tip when this handover was grounded:** `f44ae7369d` (`f44ae7369dc6d1604174e1a384c93fc340ab27fd`) at 2026-09-16 17:23 AWST  
**Standing order:** Do not merge Database PRs unless Joshua names them.

---

## Purpose

Handover of issues found in the 2026-09-16 Ward Flow logic/design review + visual attempt on this local worktree, **re-checked against the current tree** so nothing stale is treated as still true.

---

## Current worktree health (grounded 2026-09-16 17:23)

| Check                          | At first review (~15:35 AWST)                          | Now (grounded)                                                    |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Unmerged `git` paths           | Many (UU/AA across src + docs)                         | **0 unmerged**                                                    |
| `<<<<<<<` markers under `src/` | Present (search, on-call, OOA, officer, discharges, …) | **0 markers**                                                     |
| `ward-flow-reducer.ts` markers | None                                                   | None                                                              |
| App compile / Playwright build | **Failed** on conflict markers (`on-call-screen.tsx`)  | Conflicts cleared — **visual suites not re-run yet** (see VIS-01) |

**Implication:** Conflict-specific “cannot compile” / half-merged JSX items from the first pass are **historical** unless noted as still open below. Product findings that survive in source are listed under **Still open**.

---

## Still open (grounded against tip `f44ae7369d`)

### STILL-01 — Officer console uses “statutory” clinical-trust language — **P1 — CONFIRMED LIVE**

- **Evidence now:** `src/components/ward-management/officer/officer-screen.tsx`
  - ~L335: _“validated by clinical and **statutory** guards”_
  - ~L348: _“**Statutory Guard:** … Section 61 Form 4A Transport Authorisation”_
- **Why it matters:** Mission / owner rules refuse inventing Mental Health Act / statutory framing in product chrome. Operational guard copy is fine; “statutory” asserts law.
- **Suggestion:** Rewrite to operational language (e.g. “recorded Form 4A transport authorisation required before Collected”). Keep KPI/third-edition structure if desired.
- **Original ID:** CF-04

### STILL-02 — “Statutory timing” / “Legal deadline” product language still widespread — **P1 — CONFIRMED LIVE**

- **Evidence now (sample):**
  - `ward-priority.ts` ~L142: factor label `"Statutory timing"`
  - `coordinator/priority-queue.tsx` ~L221–259: uses that factor; fallback _“Legal deadline breached”_
  - `alerts-screen.tsx` ~L168–177: _“Legal deadline passed”_ / _“statutory form deadline”_
  - `delays-derivations.ts` / `delays-screen.tsx` / `handover-page.tsx` / `legal-forms-derivations.ts`: multiple “legal deadline” / “statutory clock” strings
- **Nuance:** Some comments deliberately contrast “no deadline recorded” vs “no statutory deadline” (good). The **user-visible labels** remain the risk.
- **Suggestion:** Global rename to operational Form-clock language unless an owner ruling supplies real statutory figures.
- **Related prior audit:** P0-02 on main (2026-09-12 adversarial report)

### STILL-03 — FD-23 co-ward count still on shared role switcher — **P1 — CONFIRMED LIVE**

- **Evidence now:** `src/components/ward-management/ward-role-switcher.tsx`
  - Builds `wardCandidateIds` from `focusMovement.acceptedUnitId` / `referredUnitIds` (~L93–100)
  - Exposes `referredWardCount` in copy and `data-referred-ward-count` (~L145–178)
- **Why it matters:** FD-23 / co-ward privacy: ward seat must not learn competing destination **count** via shared chrome.
- **Suggestion:** Stop rendering co-referred ward counts/names on shared navigation; keep projection only through ward-scoped referral helpers.
- **Related prior audit:** P0-01

### STILL-04 — `ACCEPT_REFERRAL` still creates **no** `Movement` (split worlds) — **P1 — CONFIRMED LIVE**

- **Evidence now:** `ward-flow-reducer.ts` `case "ACCEPT_REFERRAL"` ~L4145–4150:

  > Spec D14: acceptance decides only that the network takes this referral — it creates NO `Movement`.

  Explicitly asserted by `tests/ward-referral-reducer.test.ts` (cited in that comment).

- **Why it matters:** Bed journey (pull / transport / arrive) lives on Movements. Accepting a referral alone is a **dead end** for placement unless a separate event bridges the worlds.
- **Suggestion:** Product decision — either wire an explicit “open movement from accepted referral” event with full origin/legal/stage inputs, or make UI copy state clearly that acceptance ≠ bed journey.
- **Related prior audit:** Journey map “Referral board accept → Dead end”

### STILL-05 — Morning board unreachable; capacity fold may leave D9 / frozen-view gaps — **P2 — CONFIRMED LIVE (architecture)**

- **Evidence now:** `morning/morning-page.tsx` header comments: `/morning` redirects to `/capacity` (MERGE 02); component parked unreachable; D9 half-unsatisfiable called out in-file; handover was repointed to capacity.
- **`as-at=morning` query drop:** Not re-proven as a live URL bug in this grounding pass (capacity-screen has no obvious `as-at` searchParam reader in a quick scan). Treat the **redirect + unmounted morning page** as the grounded fact; re-check bookmarks/query preservation when visual tests re-run.
- **Suggestion:** Owner ruling on D9 after MERGE 02; ensure capacity can express “morning freeze” if that product need remains.

### STILL-06 — Visual / e2e not re-verified after conflict clearance — **P1 process — OPEN**

- **Evidence:** First run `npm run test:e2e:ward-journeys` failed at production **build** on markers (log: `scratch/ward-flow-visual-2026-09-16.log`). Tree is now marker-clean; **suites were not re-executed** for this handover.
- **Suggestion:** Re-run `npm run test:e2e:ward-journeys` then `npm run test:e2e:visual` on this tip and attach results to a follow-up note.
- **Original:** VIS / CF compile blocker

---

## Resolved since first review (do not re-fix as open)

### RESOLVED-01 — Merge conflict markers / unmerged paths — **WAS P0 process**

- **Was:** UU files + `<<<<<<<` in search, on-call, OOA, discharges, officer, capacity, settings, docs.
- **Now:** `unmerged=0`, `markers_anywhere_src=0`. Tip moved `1644b3263d` → `f44ae7369d`.
- **Original IDs:** worktree health, CF-03 (half-merged on-call JSX), CF-05/CF-06 as _conflict_ items

### RESOLVED-02 — Search legal filter lies (HEAD side) — **WAS P0 — FIXED IN TREE**

- **Was:** HEAD offered `Form 1A (ED 24h)` / `Form 5A (Involuntary)` chips and invented referral legal matches via `involuntaryBedNeeded`.
- **Now:** `search-filters.ts` uses `SELECTABLE_LEGAL_FORMS` + Voluntary/Involuntary; `matchesLegal` returns `false` for referrals with explicit comment that `involuntaryBedNeeded` is never a legal determination (~L128–142). Misleading labels appear only in historical comments.
- **Original IDs:** CF-01, CF-02

### RESOLVED-03 — OOA invented-threshold honesty — **KEEP (positive)**

- **Now:** `out-of-area-board.tsx` still surfaces invented/unvalidated threshold notices (e.g. ~L270, `INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE`). That is **desired** epistemology, not a defect.
- **Original ID:** CF-05 (honesty half)

---

## Broader risks carried from 2026-09-12 main adversarial audit (not fully re-proven today)

These remain the working backlog for a full adversarial re-pass on a clean tip. Marked **CARRY** = cited from prior audit + partially sighted in this tree, **not** exhaustively re-verified line-by-line on `f44ae7369d`.

| ID       | Sev   | Topic                                                            | Grounding this pass                                                                                          |
| -------- | ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| CARRY-01 | P0/P1 | Impossible bed/person states (pull/exam/leave/release/step-back) | Reducer present, marker-free, large; **not** re-audited case-by-case today                                   |
| CARRY-02 | P1    | Privacy free-text sinks                                          | Not re-scanned                                                                                               |
| CARRY-03 | P1    | Community “Waiting for your answer” / accept affordance          | Comment at `community-screen.tsx` ~L181 still discusses that list; UI behaviour **not** journey-tested today |
| CARRY-04 | P1    | Transport cancel / handover-ready hazards                        | Not re-proven                                                                                                |
| CARRY-05 | P2    | CI soft-lies / expected-reds / unmounted coverage                | Morning tests parked/unreachable noted in-file; broader CI gates not re-run                                  |

Prior full report (main, remote): `/workspace/ward-flow-adversarial-audit-full-report.md` on the bot computer (also historically under workspace reviews).

---

## Visual testing record

| When                   | Command                          | Result                                                                                                           |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 2026-09-16 ~15:40 AWST | `npm run test:e2e:ward-journeys` | **FAIL** — webpack merge conflict markers (`on-call-screen.tsx`). Log: `scratch/ward-flow-visual-2026-09-16.log` |
| After tip `f44ae7369d` | (not run)                        | **Due** — tree is compile-clean of markers                                                                       |

Also intended: `npm run test:e2e:visual` (`playwright.visual.config.ts`).

---

## Suggested next actions (priority)

1. Fix **STILL-01 / STILL-02** statutory/legal deadline **user-visible** copy (officer + priority/alerts/delays/handover).
2. Fix **STILL-03** FD-23 `referredWardCount` on `WardRoleSwitcher`.
3. Decide product path for **STILL-04** referral→movement bridge (or honest UI).
4. Re-run **ward-journeys + visual** on `f44ae7369d`; attach pass/fail to a follow-up handover line.
5. Schedule full adversarial re-pass for CARRY-* on this tip (reducer invariants + privacy + community/ED journeys).

---

## Related local artifacts

- First-pass review notes: `scratch/ward-flow-review-2026-09-16.md` (partially stale — written during conflicted tip)
- Visual fail log: `scratch/ward-flow-visual-2026-09-16.log`
- This handover: `docs/ward-flow/handovers/WARD-FLOW-HANDOVER-2026-09-16-REVIEW-FINDINGS.md`

---

## Grounding method

Re-checked on Josh machine `f8d0c9ff-c395-477e-9a63-4b169866f6ad` via local Shell:

- `git` status / unmerged / HEAD
- `Select-String` for conflict markers, statutory language, FD-23 counts, search legal helpers
- Direct read of `ACCEPT_REFERRAL` handler and morning-page header comments

No PR merges. No force-push. Handover is documentation only.
