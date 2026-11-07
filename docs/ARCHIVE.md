# Ward Flow documentation archive

Historical documents no longer live in the working tree. Every one is kept in Git history at
`main` commit `0a469c6` (`0a469c61260a49aaa94733f948ae1d53f4d3f5e6`), the last commit before they
were removed. That commit is part of `main`, so it stays in every full clone.

Read or restore a file:

```sh
git show 0a469c6:docs/ward-flow/reports/remediation-2026-10-08.md
git checkout 0a469c6 -- docs/ward-flow/reports/remediation-2026-10-08.md
```

## Moved to `docs/history/` on 8 November 2026

Josh approved 7 November 2026 (documentation audit). Nothing was deleted. These moved, with Git
history following each file, into [`history/`](history/README.md), which search tools skip by default:

- `docs/ward-flow/lessons/` → `docs/history/lessons/` (207 imported lessons; `RULES.md` is still generated from them)
- `docs/ward-flow/archive/` → `docs/history/archive/` (dated notes, owner-ruling dumps, old registers; the owner-rulings index still reads them)
- nine superseded files from the top of `docs/`: `ward-flow-changeable-data-rule.md`, `ward-flow-context.md`,
  `ward-flow-ledger.md`, `ward-flow-phase-5-handover.md`, `ward-flow-phase-6-7-decisions.md`,
  `ward-flow-phase-8-decisions.md`, `ward-flow-provisional-values.md`, `ward-flow-referral-destination-spec.md`
  and `ward-flow-remaining-work.md` → `docs/history/`
- `docs/ward-flow/ARCHIVE-NOTE.md` → `docs/history/ARCHIVE-NOTE.md`; its record of earlier trims is copied below, so this page is the one archive index

The tree exactly as it was before the move is tagged `docs-history-2026-11-08` (`main` commit `6b1352c9`).

## Removed on 24 October 2026

Josh approved 24 Oct 2026.

- `docs/process-hardening.md` (848 lines): the former PsychSift process-hardening plan, covering
  verification gates, CI cost measurements and known debts for the PsychSift monorepo. It was fully
  fenced as history and described no current Ward Flow gate. Removed 2026-10-24. Its last commit on
  `main` is `2273b858` (`2273b8584335fda6749ab51deea8b4ef5b4ec20e`). Read or restore it with
  `git show 2273b858:docs/process-hardening.md` or `git checkout 2273b858 -- docs/process-hardening.md`.

The same approval moved, rather than removed, other finished and superseded notes into
[`ward-flow/archive/`](history/archive/) (now `docs/history/archive/`): the owner and decision rulings formerly in `docs/archive/`
and `docs/ward-flow/design/` (now in `ward-flow/archive/dated-notes/`), the rest of
`docs/ward-flow/design/`, the six remaining build contracts, two finished plan folders, five of the six
trap notes, two code-map pages, ten finished notes from the top of `docs/ward-flow/`, and the
historical sections of `testing.md` and `wiring-conventions.md`. Git history follows each move.

## Removed on 18 October 2026

Items 22 and 23 of the 18 October review, approved by the owner.

- `docs/audit/` (the 2 September 2026 full repository audit)
- `docs/ward-flow/handover/` (the superseded mockup engineering handover, its templates and session transcript), except `02-SCORING-RUBRIC-AND-FATAL-FLAWS.md`, which a drawing cites
- `docs/ward-flow/handovers/` (four dated September handovers)
- `docs/ward-flow/reports/` (dated October reports and the pathway audit)
- `docs/ward-flow/audit-artefacts/` and `docs/ward-flow/sdd-rescued/`
- `docs/ward-flow/build-contracts-2026-09-12/`, except the six contracts that code or tests cite
- `docs/history/archive/task-ledger-history-2026-08-to-2026-10-13.md`
- `docs/ward-flow/plans/`: dated plans and checkpoints that nothing in code, tests, checks or acceptance evidence cites, `research-2026-09-10/` and `type-floor-record-2026-09-11-528bb60708/`
- `docs/superpowers/plans/`: the August and September plans that no code or test cites
- `docs/archive/branch-cleanup-guide.md` and `docs/archive/codex-review-protocol.md`
- dated one-off audits, briefs, proposals and reconciliations at the top of `docs/ward-flow/` and in `docs/ward-flow/design/`, and two dated design-system notes
- `docs/ward-flow-safety-checklist.md` (retired by Prototype Operating Mode on 3 October 2026)

Superseded agent rule and process files, removed when `AGENTS.md` became one short safety file:

- `PROJECT-INSTRUCTIONS-CONTINUATION.md` (a retired stub) and `WARD-MOCKUPS-BRIEF.md` (superseded mockup brief)
- `docs/ward-flow/three-chat-working-agreement.md` and `docs/ward-flow/who-is-who.md` (the old three-chat and folder-role model)
- `docs/ward-flow/testing-fast-feedback.md` (it described the retired `test-batch.mjs` runner)

The shortcuts and document rules that lived only in `AGENTS.md` moved to
[`agents/shortcuts.md`](agents/shortcuts.md) and [`DOCS-SYSTEM.md`](DOCS-SYSTEM.md).
`docs/ward-flow/RULES.md` stays, because a CI check regenerates it from the lessons.

## Kept on purpose

Owner rulings and decision records (`docs/history/archive/dated-notes/`, which since 24 October 2026
also holds the rulings formerly in `docs/archive/`, and the decision identity register), the lessons and journey folders (CI checks and scripts read
them), reference data, governance, the database, backend and sign-in documents, and every file that
code, tests, a check or acceptance evidence cites.

## Removed in the 15 October 2026 docs trim (formerly in `ward-flow/ARCHIVE-NOTE.md`)

These folders left the working tree. Nothing in the app, tests or scripts read them.

- `docs/ward-flow-phase-3-workspace/` (phase 3 briefs, reports and reviews)
- `docs/archive/` (August and September handovers, plans and PsychSift-era notes), except the owner rulings and decision records and `branch-cleanup-guide.md`, which live agent instructions still point to
- `docs/history/archive/` except `dated-notes/owner-*.md` and the clinician check rulings (read by the owner-rulings index) the retired coverage record (read by a test), the D-5 protected deletion ruling and the unanswered owner questions

Every removed file is kept in commit `26d0987` (`26d09877cf0ca5362426090d5356206e6c90bccd`), the last `main` commit before the trim. To read or restore one:

```sh
git fetch origin 26d09877cf0ca5362426090d5356206e6c90bccd
git show 26d09877cf0ca5362426090d5356206e6c90bccd:docs/archive/ward-flow-roadmap.md
git checkout 26d09877cf0ca5362426090d5356206e6c90bccd -- docs/archive/ward-flow-roadmap.md
```

Links to removed files now read as plain text marked "removed in the 15 Oct 2026 docs trim".

### Second pass, same day: old drawings notes and finished plans

A second trim removed 54 more files that nothing in the app, tests or scripts reads:

- `design/third-edition-mockups/reference/` (the Gemini restyle copies of 15 September, never built from)
- the five dated handover and status notes at the top of `design/third-edition-mockups/`
- four dated notes in `design/third-edition-mockups/third-edition-kit/` (`REVIEW-FINDINGS.json`, `HANDOVER-MOCKUPS-CHAT-2026-09-10.md`, `MERGE-BRIEF.md`, `RESUME-2026-09-09.md`)
- 24 finished plans and specs in `docs/superpowers/` (every one the dead-code check already treats as history)

Kept on purpose: every drawing listed in `mockups/MANIFEST.json` (the screen verification check reads it), the kit's checker scripts, fonts, inputs and shell files, `AGENT-BRIEF.md`, every plan with unticked tasks (the dead-code check still reads those) and the four specs the code cites.

These files are kept in commit `5afce0b` (`5afce0b62413f4e182cfbefc7966e03b97126422`), the last `main` commit before this pass. Read or restore them the same way, for example:

```sh
git fetch origin 5afce0b62413f4e182cfbefc7966e03b97126422
git checkout 5afce0b62413f4e182cfbefc7966e03b97126422 -- design/third-edition-mockups/reference
```

### Third pass: dated plans, reports, handovers and audit output

A third trim removed 500 more files. Nothing that runs reads them, and no live doc, data file, lesson or ruling depends on them. Historical inventories and old plans may still mention them by name.

- 340 dated build plans and briefs in `docs/ward-flow/plans/` (plans dated October 2026, the folder README and every plan that a check, live doc, ruling or lesson relies on stay; the plans index and old plans may still name removed plans for history)
- `docs/ward-flow/sdd-rescued/`, `register/`, `handovers/`, `reviews/`, `triage/`, `outstanding/`, `rescued/`, `merge/` and `evidence/`, apart from any file something still cites
- the September reports in `docs/ward-flow/reports/`
- dated chat prompts, pre-registrations, finding registers and test sweeps at the top of `docs/ward-flow/`
- `docs/ward-flow/audit-artefacts/stabilisation-suite-report.json` (4 MB of test output, which `scripts/ward-flow/audit/measure-ward-suite.mjs` writes again when run)

Kept on purpose: both ledgers (they hold owner rulings), the owner rulings and decision records and the evidence they cite, the lessons (the rules index reads them) and the files they cite, `handover/` (a lesson cites it), the acceptance evidence `screen-verification.json` cites, the process audit `live-state.json` checks, `reference-data/` (the reference build scripts read it), and the drawings the screen verification check reads.

These files are kept in commit `cac245b` (`cac245bccbbc30115fe4ef9a38b8cfee0f149e92`), the last `main` commit before this pass. For example:

```sh
git fetch origin cac245bccbbc30115fe4ef9a38b8cfee0f149e92
git checkout cac245bccbbc30115fe4ef9a38b8cfee0f149e92 -- docs/ward-flow/plans/2026-09-11-lane-d-statistics.md
```

### Fourth pass, 18 October 2026

A fourth pass removed 116 more dated audits, reports, handovers, plans and build contracts. The list and the restore command are in this page; the files are kept in Git history at `main` commit `0a469c6`.
