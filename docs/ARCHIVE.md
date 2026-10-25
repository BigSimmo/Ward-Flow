# Ward Flow documentation archive

Historical documents no longer live in the working tree. Every one is kept in Git history at
`main` commit `0a469c6` (`0a469c61260a49aaa94733f948ae1d53f4d3f5e6`), the last commit before they
were removed. That commit is part of `main`, so it stays in every full clone.

Read or restore a file:

```sh
git show 0a469c6:docs/ward-flow/reports/remediation-2026-10-08.md
git checkout 0a469c6 -- docs/ward-flow/reports/remediation-2026-10-08.md
```

## Removed on 24 October 2026

Josh approved 24 Oct 2026.

- `docs/process-hardening.md` (848 lines): the former PsychSift process-hardening plan, covering
  verification gates, CI cost measurements and known debts for the PsychSift monorepo. It was fully
  fenced as history and described no current Ward Flow gate. Removed 2026-10-24. Its last commit on
  `main` is `2273b858` (`2273b8584335fda6749ab51deea8b4ef5b4ec20e`). Read or restore it with
  `git show 2273b858:docs/process-hardening.md` or `git checkout 2273b858 -- docs/process-hardening.md`.

The same approval moved, rather than removed, other finished and superseded notes into
[`ward-flow/archive/`](ward-flow/archive/): the owner and decision rulings formerly in `docs/archive/`
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
- `docs/ward-flow/archive/task-ledger-history-2026-08-to-2026-10-13.md`
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

Owner rulings and decision records (`docs/ward-flow/archive/dated-notes/`, which since 24 October 2026
also holds the rulings formerly in `docs/archive/`, and the decision identity register), the lessons and journey folders (CI checks and scripts read
them), reference data, governance, the database, backend and sign-in documents, and every file that
code, tests, a check or acceptance evidence cites.

Earlier trims are recorded in [`ward-flow/ARCHIVE-NOTE.md`](ward-flow/ARCHIVE-NOTE.md).
