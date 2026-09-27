---
name: ward-flow-audit-fix-line-2026-09-16
description: "The 16-17 Sept Ward Flow audit and fix programme — COMPLETE, folded home to ward-lead 17 Sept; open owner questions listed in progress doc §8"
metadata:
  node_type: memory
  type: project
  originSessionId: 78e41062-7eb2-4d37-8c9c-e7e559457f17
  modified: 2026-09-17T04:31:47.019Z
---

The 16-17 Sept 2026 Ward Flow audit and fix programme is **complete and folded home**. On 17 Sept, ward-lead
(`codex/task-ward-flow-live-state-20260831`) reached `84ea0bd08a`. `ward/audit-fixes-20260916` was fast-forwarded
to the same commit. Nothing is pushed.

**Why:** Josh said "Into main when done and ensure the full journey is all working and wired up and add more
sample data … Nothing should be dead end or logic breakdown". "Main" means the local ward line.

**How to apply:**

- Resume from `docs/ward-flow/handovers/WARD-FLOW-PROGRESS-2026-09-16-NIGHT.md` §8. It lists what landed, the gates
  (full ward suite 570 files and 6,750 tests green; tsc; diff-integrity; generators; eslint on changed files;
  browser `ui-ward-*` 94 passed including `ui-ward-full-journey.spec.ts`; dead-end detector 35 routes) and the
  OPEN OWNER QUESTIONS:
  1. "For discharge" should require the examination outcome for a patient on a form (recommend yes).
  2. A non-binary patient never goes to a single-gender ward (recommend keep).
  3. Tier cell styling on the referral board.
  4. Officer print loss.
  5. A stop-transport control, which waits on the diversions question.
  6. The §7 list: Form 3D, Settings look, T9, diversions, community cancel, and clarifications 17, 28, 39, 46, 47, 49.
- Don't rebuild anything on that list without an answer.
- Antigravity's work was kept and fixed. Its raw unsaved snapshot is commit `5733345a2c`, with a backup at
  `C:/Users/joshs/Backups/antigravity-wip-2026-09-17-0540/`.
- With Josh's yes on 17 Sept, 79 finished helper worktrees were removed. Their branches are kept, and the
  list is in `C:/Users/joshs/Backups/worktrees-to-remove-2026-09-17.txt`.
  - `ward-audit-fixes` (holds uncommitted audit input notes) and ward-lead were kept.
  - D: went from about 57 GB to about 92 GB free.

See [[unattended-tool-folds-during-a-pause]], [[ward-flow-light-testing-for-speed]], [[fold-home-when-done]].

**Round 2 (17 Sept afternoon):**

- Josh answered the 24 questions. They are recorded verbatim at the end of
  `docs/ward-flow/owner-answers-2026-09-17.md` ("Second round"), in ward-lead commit `5f9cd59cb2`.
- Eight lanes run in the new folders `ward-r2-*`, all branched from `5f9cd59cb2`:
  - legal-gates: discharge exam gate, T9
  - legal-labels: T5 register labels, 3A label
  - gender-nonbinary: non-binary allowed on single-gender wards with a placement record
  - transport: stop keeps the bed and a Stop control, diversions T4a/T4b, no transport needed
  - referrals-community: booking community team cancels, referrer withdraws the community arm
  - screens-a: Tier bold, officer print, statewide flow from data, limiting-admissions fixed list
  - screens-b: ward and handover against the new drawings, F2, Settings matches the Gemini rebuild
  - housekeeping: ledger entry for the Aboriginal review, lesson control bytes, broken links, Q17 screenshots
- Q22 lists were shown to Josh in chat.
- Josh also asked for a full documentation review: every doc current, no contradictions, and a clear process
  so any AI builder can pick up. Phase A is read-only:
  - a Sonnet inventory, written to scratchpad `docs-inventory.md`;
  - an Opus contradiction review, written to scratchpad `docs-contradictions.md`, with a proposed structure
    of one entry point, one status doc, one builder process doc and one ledger.
    Phase B comes after the round-2 lanes fold, including housekeeping, which touches the ledger, OPEN-QUESTIONS
    and doc links. It rewrites and consolidates, marking superseded docs with a banner and never deleting them.

**Round 2 fold (17 Sept evening):** all nine r2 branches + booking-log (owner 3rd ruling: transport is booked by phone, Ward Flow only logs CAD number / voluntary-involuntary / estimated time) folded into ward/audit-fixes-20260916 with one import conflict. Branch collisions reddened 7 test files (legal gate on collection vs stop-transport test setup; reachability register; legal-figure sweep missing RECORD_WARD_INTAKE_CONSTRAINTS; ED wording). Lesson: helpers testing only their own files is fast, but budget one fixer pass after the fold for cross-branch reds. Deferred: community-screen booking control (list built on Admission, no Movement link), ED "no transport needed" display, officer print, Statewide flow, diversions, owner-answers parseable IDs.
