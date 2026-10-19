# Ward Flow docs — archive note

Dated handovers, owner-answer dumps, and one-off measurement notes are **historical**.

## Live (use these)

1. [`LOCAL-FIRST-RUN.md`](LOCAL-FIRST-RUN.md) — boot the UI
2. [`README.md`](README.md) — product entry
3. [`STATUS.md`](STATUS.md) — where things stand
4. [`HOW-WE-WORK.md`](HOW-WE-WORK.md) — builder workflow
5. [`../ward-flow-task-ledger.md`](../ward-flow-task-ledger.md) — task ledger
6. [`OWNER-RULINGS.md`](OWNER-RULINGS.md) — rulings index (open cited sources)

## Archived

- Top-level dated notes: [`archive/dated-notes/`](archive/dated-notes/README.md)
- `START-LOCAL-CHAT.md` and `PROJECT-ISSUES.md` at the old paths are **stubs**
- Older trees under `handover/`, `handovers/`, `plans/`, etc. remain but are not entry points

Do **not** treat `archive/dated-notes/` as current process.

## Removed in the 15 October 2026 docs trim

These folders left the working tree. Nothing in the app, tests or scripts read them.

- `docs/ward-flow-phase-3-workspace/` (phase 3 briefs, reports and reviews)
- `docs/archive/` (August and September handovers, plans and PsychSift-era notes), except the owner rulings and decision records and `branch-cleanup-guide.md`, which live agent instructions still point to
- `docs/ward-flow/archive/` except `dated-notes/owner-*.md` and the clinician check rulings (read by the owner-rulings index) the retired coverage record (read by a test), the D-5 protected deletion ruling and the unanswered owner questions

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

A fourth pass removed 116 more dated audits, reports, handovers, plans and build contracts. The list and the restore command are in [`../ARCHIVE.md`](../ARCHIVE.md); the files are kept in Git history at `main` commit `0a469c6`.

## Documentation system

Process / freshness / tip lock: [../DOCS-SYSTEM.md](../DOCS-SYSTEM.md).
