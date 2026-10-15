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

## Documentation system

Process / freshness / tip lock: [../DOCS-SYSTEM.md](../DOCS-SYSTEM.md).
