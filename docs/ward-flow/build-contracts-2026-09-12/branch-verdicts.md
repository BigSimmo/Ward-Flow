# Ward Flow branch classification — OWED vs SUPERSEDED

Main line: `f57435cd45`. Read-only git analysis, no files touched, no branches switched.

---

## 1. `ward/mockups-20260910` — 35 commits ahead

**Files touched:** all 46 files are under `docs/ward-flow/mockups/**` (grouped: 43 `.html`
drawings + `README.md`, `WARD-FLOW-DESIGN-SYSTEM.md`, `WARD-MOCKUPS-HANDOVER-2026-09-11.md`,
plus `third-edition-kit/{AGENT-BRIEF.md, inputs/*, shell/*}`). Two large new files
(`ward-answer-third-edition.html` +7,497 lines, `wards-third-edition.html` +11,847 lines).

**Out-of-scope paths:** none. Nothing outside `docs/ward-flow/mockups/**`; it does not touch
`docs/ward-flow/design/prototypes/**` at all (in-scope but unused), and does **not** touch
`.prettierignore`.

**Supersession check:** merge-base `4b92d03e87`. Checked every one of the 46 touched files
against `git log <merge-base>..f57435cd45 -- <path>` — **zero** of them were changed on the
main line after the fork. No overlap anywhere.

**Reachability check:** spot-checked four distinctive commit-subject phrases
("the breach word reaches the other 32 drawings", "the ward's own screen, where a bed request
is answered", "Discharges, the release and egress board", "Wards, the index of every ward in
the network") against `git log f57435cd45 --grep`. No matches — none of this work exists on
the main line under another commit.

**Verdict: OWED.** Clean, in-scope, no file-level or content-level overlap with anything the
main line has done since the fork.

---

## 2. `ward/phase-2-gender-wiring-20260911` — 1 commit

**Commit:** "task 9 hands back — gender cannot reach the bed gates yet because no seeded
occupant has one." Touches one new file: `.superpowers/sdd/third-edition-phase1/task-9-report.md`
(133 lines added, nothing else).

**Supersession check:** the file doesn't exist on main (new path), so no direct file-overlap.
But the substance is not new to the line — main-line commit `51041fd137`
("the gender wiring stopped at its own hand-back trigger, and nothing links a bed's occupant
to a person at all", 2026-09-11 01:40, **after** this branch's fork point) records the
identical finding: 259 people network-wide, zero resolve to a `Patient` record because
`Admission` has no `patientId`, the ten `referralId`-linked admissions also dead-end,
`genderEligibility()` left correct/tested/uncalled, the same three implementer refusals, and
it is filed as owner-decision entry **A-6** in `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md`
plus `docs/ward-flow/archive/dated-notes/owner-questions-queued-2026-09-10.md` — the canonical place this kind of
hand-back gets recorded on this line.

Also worth noting: `.superpowers/sdd/` has its own nested `.gitignore` whose first line is a
bare `*`, which matches this exact file — `git check-ignore -v` confirms
`task-9-report.md` is ignored by that rule. It was committed to the branch despite that,
meaning it was force-added into what the repo treats as a scratch/tool-output directory, not a
docs location anything else references.

**Verdict: SUPERSEDED.** The finding is already on the main line, filed in the proper
owner-decision/queued-question ledger under a different commit (`51041fd137`). Folding this
branch would add a duplicate write-up of the same conclusion into a directory the repo's own
`.gitignore` marks as non-canonical scratch space.

---

## 3. `ward/reword-arms-20260909` — 1 commit

**Commit:** "the reword-arm harness, which existed only in a session scratchpad." Adds
scripts/ward-flow/reword-arm.mjs (gone — reword-arm helper deleted) (130 lines, new file) — a spec-driven two-mutation
(`reword` + `break`) harness built specifically for the reword-arm sweep: JSON spec naming a
site, test files, a reword mutation that must stay green, and a break mutation that must go
red naming its own subject.

**Supersession check:** the file itself doesn't exist on main. But:

- The reword-arm sweep this harness exists to power is **already complete** on the main line —
  merge commit `9744451ba6` ("57 of 57 reword arms") folds it in, and `9744451ba6` is an
  ancestor of `f57435cd45`.
- The main line independently built and reviewed a general single-mutation harness for exactly
  this class of problem: `scripts/ward-flow/mutate.mjs` + `mutation-run.mjs`, sharing the same
  six guarantees this branch's commit message lists near verbatim (refuse untracked target,
  refuse a non-unique anchor, prove the mutant applied by hash, restore from bytes captured
  before the edit — never `git checkout --`, verify the restore by content, report which
  assertion actually went red). Commit `e77f78b893` ("--append, so a sweep-shaped control can
  go through the harness at last") extended `mutation-run.mjs` specifically to cover the
  bulk/sweep shape, explicitly "authorised by Ward Lead; `scripts/ward-flow` is their path" —
  i.e. this is the reviewed, owned tool going forward. That commit postdates this branch's fork
  point (merge-base `f6ef9e53`) and is on the main line.

**Verdict: SUPERSEDED**, with a caveat worth stating plainly: this is not "the identical script
already landed" — it's "the sweep this tool served is finished, and the main line built and
authorised a more general replacement for the same job while this branch sat unfolded."
Folding `reword-arm.mjs` now would add a second, unreviewed, narrower mutation harness
alongside the one the line has already adopted.

---

## 4. `ward/task-patient-link-guard-20260911` — 1 commit

**Commit:** "the peel-ed row is accepted, not queued — the test's own name said otherwise."
Touches `tests/ui-ward-roles.spec.ts` only: renames one test from
`"shows rph-ed and peel-ed each their own queued-for-review psychiatry referral, and never the
other's"` to `"... arrived psychiatric-review referral, and never the other's"`, and expands
the doc comment above it. No assertion, fixture, or source file changed.

**Supersession check:** merge-base `343f57d7e2`. Main line touched this same file 4 times
since the fork (`883a648422`, `4a3e488744`, `886f978af9`, `cfb963f23c`) — but all four edit
**different regions**: the Movements-board region-name query (~line 392), the Ward-screen
panel-name assertions (~line 178), and the Tools-drawer mount helper functions (~lines 14–83).
None touch the Emergency-department test (~line 630) this branch renames. Confirmed directly:
the old name `"queued-for-review psychiatry referral"` is **still present, unrenamed**, in
`f57435cd45`'s copy of the file.

**Reachability check:** grepped main-line history for "peel-ed row is accepted" and "arrived
psychiatric-review" — no matches.

**Verdict: OWED.** Same file, disjoint region, main line never made this rename, and the
branch's own message says explicitly it is finishing a rename an earlier main-line repair
(`9c9aa86797`) left behind.

---

## 5. `ward/task-referral-draft-referrer-20260911` — 1 commit

**Commit:** "wip — preserve an abandoned D-11 test tweak before switching branches." Touches
`tests/ward-referral-unsaved-history-warning.dom.test.tsx` only (6 insertions, 5 deletions).
The commit message **says outright** this is superseded: "`codex/task-ward-flow-live-state-
20260831` already carries a fuller fix for the same test (comment-stripping plus this same
runtime assertion, commit `1a21199845`)."

**Verification:** `1a21199845` is on the main line, touches the same file, after this branch's
merge-base (`1cbdb570e6`). Diffed both: this branch adds one line —
`expect(typeof (globalThis as { indexedDB?: unknown }).indexedDB).toBe("undefined");` — plus a
reworded comment. `1a21199845`'s diff contains that **exact same line, verbatim**, plus the
**exact same reworded comment, verbatim**, plus additional work this branch doesn't have
(comment-stripping before the regex scan, a length floor, a `useState` presence check). This
branch's diff is a strict subset of what's already on the main line.

**Verdict: SUPERSEDED.** Confirmed, not just asserted by the commit message — the main line's
version is byte-for-byte a superset of this branch's change.

---

## Summary table

| Branch                                       | Verdict                                         |
| -------------------------------------------- | ----------------------------------------------- |
| `ward/mockups-20260910`                      | OWED                                            |
| `ward/phase-2-gender-wiring-20260911`        | SUPERSEDED                                      |
| `ward/reword-arms-20260909`                  | SUPERSEDED (tool's job already done + replaced) |
| `ward/task-patient-link-guard-20260911`      | OWED                                            |
| `ward/task-referral-draft-referrer-20260911` | SUPERSEDED                                      |

No branch required a "CANNOT TELL" — each had either a clean zero-overlap result or a directly
comparable main-line commit to diff against.
