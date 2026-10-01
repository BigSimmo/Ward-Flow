# Ward Flow — start here

**This is the only entry point.** Any other file that says "start here" is historical and carries a
banner pointing back to this one. Updated 21 September 2026.

## What Ward Flow is

A prototype of a bed-coordination tool for Western Australian mental health services: wards, beds,
referrals, patient movements, transport, delays and capacity. It runs on **synthetic data only**.
It lives on a local branch of this repository beside PsychSift, and **it is never pushed.**

## Where the current build is

- **Branch:** `codex/task-ward-flow-live-state-20260831` (local only, never pushed). **Folder:**
  `D:/Worktrees/Database/ward-lead`. Everything finished is folded here; `git log -1` there is the
  current build.
- **Read before any task:** [`code-map/README.md`](code-map/README.md), the file-by-file map of all
  Ward Flow code and the shared code it loads.
- **Code:** the engine and screens are in `src/components/ward-management/`; routes are in
  `src/app/mockups/ward-flow/`; tests are `tests/ward-*` and `tests/ui-ward-*`.
- **What has been done, and what is left:** [`STATUS.md`](STATUS.md) ("What is built", "Deferred",
  "Needs the owner") and the ledger. As of 22 September 2026, design elevation and Round 2 owner rulings
  are built and folded into the core line (tip `8d1c7c1e00` as of 2026-09-22 - confirm with `git log -1`), and zero owner questions remain open.
- **Other ward folders under `D:/Worktrees/Database/` are history.** Do not build in them; start a new
  branch from the ward line and follow [`HOW-WE-WORK.md`](HOW-WE-WORK.md).

## Mission and definition of done

**Mission.** A real tool that a bed coordinator would open on a weekday morning instead of a
whiteboard, a spreadsheet or a phone round. The screens keep the current folded design, and the behaviour
is truthful: nothing is shown that the data does not hold.

**A task is done** when it is committed on its own branch and an acting steward folds it into the
ward line after the selected checks, backup and diff review (see HOW-WE-WORK §4). A ready branch
owner may steward its own batch. The full offline suite runs daily and for broad changes, rather
than for every task.
Work that is built but not folded is not done. A screen is done when it also meets
[`SCREEN-DEFINITION-OF-DONE.md`](SCREEN-DEFINITION-OF-DONE.md).

**Before any real patient:** the outside reviews the owner parked must happen first (Aboriginal
cultural safety, medical device/TGA, clinical safety officer, privacy, WA legal advice on forms,
catchment data). They are listed in [`STATUS.md`](STATUS.md).

## Sources of truth

- **Design: the app as rendered from the latest folded commit on the ward line.** Owner ruling,
  25 September 2026: keep the current design, style and layout, and disregard other designs,
  including the Command visual pilot and the design-system proposal. The drawings in
  [`mockups/`](mockups/) and [`mockups/WARD-FLOW-DESIGN-SYSTEM.md`](mockups/WARD-FLOW-DESIGN-SYSTEM.md)
  are background only. Where a drawing and the current app differ in look, ask the owner before
  changing the app to match the drawing.
- **Behaviour: the working engine** under `src/components/ward-management/` and its tests. Where a
  drawing and the engine disagree on behaviour, the engine wins and the difference is written down.
- **Decisions: the owner's words.** The newest are in
  [`OWNER-RULINGS.md`](OWNER-RULINGS.md) (historical dump: [`archive/dated-notes/owner-answers-2026-09-17.md`](archive/dated-notes/owner-answers-2026-09-17.md)), including its "Second round". A later
  answer beats an earlier ruling.

## Running it

**Daily builder loop:**

```bash
npm run ward:dev                                 # organisation checkpoint, then ensure prints the URL
node scripts/ward-flow/serve-mockups.mjs         # serve the drawings to look at them side by side
node scripts/run-vitest.mjs <affected-files>     # focused vitest: changed files + up to 3 direct importers
node scripts/ward-flow/gate-tsc.mjs               # when changed source or types require it
```

**Fold checks (selected for the changed files, by the steward):**

```bash
node scripts/ward-flow/select-fold-gate.mjs --head <batch>  # STATIC, FOCUSED or FULL
```

Read the selector's result on the current local ward line before every fold. Existing chats must
refresh it too; an older chat instruction does not force a full suite or reserve stewardship for
one chat. When FULL is selected, use the saved findings, resume and bounded recheck procedure in
[`full-gate-recheck.md`](full-gate-recheck.md).

Screens live under `/mockups/ward-flow/...` on the URL `npm run ensure` prints. Never assume a port.

**Organisation checkpoint (six non-Design systems):** the reviewed
[`organisation/registry.json`](organisation/registry.json) maps source ownership and canonical references.
These are logical ownership divisions over existing files, not new applications or moved folders:

| System                      | Responsibility                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Behaviour                   | Engine actions and events; connect changes to their existing behaviour tests and decisions. |
| Data and content            | Registered types, reference content and digest sources.                                     |
| Documentation and knowledge | Existing entry points, canonical documents and owner rulings.                               |
| Issue and health            | Existing tests, findings and task records; keep unresolved work visible.                    |
| Safety and governance       | Access, persistence classification and explicit safety boundaries.                          |
| Change and recovery         | Existing local tooling, verification, source snapshots and coherent report publication.     |

Known module-only code can retain module ownership without an invented system category. Shared and
mixed boundaries remain explicit; Design is separate. Organisation records where work belongs and
what needs attention. It does not require fixing every reported product defect, and classification
does not grant clinical approval.

`npm run ward:organise` checks working sources and generates one
JSON/Markdown report pair. `npm run ward:organise:check -- --source working-tree` checks without writing;
use `--source index` to check exactly the staged registry, sources and reference targets before acceptance.
The CLI fallback is `node scripts/ward-flow/organisation.mjs --check --source working-tree`.

Reports mean **last checked**, never continuously current. Exit **0** means the required scope was
checked with no blocking findings; review findings can remain. Exit **1** means a concrete validation
failure; exit **2** means incomplete, unsafe or unavailable input/publication. Newly unclassified items
block until reviewed and mapped or recorded in the registry's exact unresolved scope. Prior reports
never grant acceptance; null hashes mean content was not checked. Denied and unknown content stays
metadata-only, with restricted labels hidden from diagnostics. Design stays a separate workstream.

Output lives in this worktree's Git metadata directory, under `ward-organisation/`. Read the selected
pair with `node scripts/ward-flow/organisation.mjs --show-report`; `current.json` selects both files in
one generation. Never choose the newest JSON and Markdown separately. After an interruption, inspect
that pointer first: publication may already have succeeded. A competing writer exits 2. A stale lock
is never removed by age: the owner or folding thread must verify the recorded process identity and stopped writer before
authorising manual recovery. Partial generations are retained, not automatically cleaned up.

`ward:dev` runs this checkpoint once and starts the existing server only on exit 0. Direct
`npm run ensure` still works and **does not** check organisation. This is neither a watcher nor a global
Git hook. Keep tasks and decisions in the existing ledgers.

For new work, use the registered Ward locations so their reviewed rules apply at the next checkpoint.
If work needs a new location or shared boundary, review and add its root/classification to the same
registry before acceptance; files outside declared scope are not automatically recognised as Ward work.
Keep each change's relevant tests and source/decision references with the work. A renamed exception
needs a reviewed rename record; a new unresolved item needs its own reviewed scope, not a reused report.

Exact classification rules must name an existing file in the selected source mode. A missing exact
target blocks acceptance even when a broader rule still covers its replacement. Update the exact
selector with a reviewed rename or location change; wildcard rules may reserve an empty location for
future work. The installed-system examples and checkpoint behaviour are covered by
[`tests/ward-organisation-core.test.ts`](../../tests/ward-organisation-core.test.ts).

Freshness checks detect repeated edits, missing canonical targets, expired/superseded declared records
and changed sources with an explicitly pinned hash. The report lists changes against a compatible
previous snapshot. These guards do not infer contradictions in prose or clinical behaviour: record
those in the existing task/decision ledgers for review, using the current owner ruling as authority.
Existing generated-document checks and relevant behaviour tests remain separate evidence.

## The four documents

1. [`STATUS.md`](STATUS.md) — where things stand: what is built, what is deferred, what needs the owner.
2. [`HOW-WE-WORK.md`](HOW-WE-WORK.md) — how any AI builder picks up, builds, tests, commits and hands back work.
3. [`../ward-flow-task-ledger.md`](../ward-flow-task-ledger.md) — **the ledger**: every Ward Flow task and its state.
4. [`OWNER-RULINGS.md`](OWNER-RULINGS.md) — generated index of the owner's rulings. Open the source file before relying on one.

Current plans are listed in [`plans/README.md`](plans/README.md).

## Traps that have each cost a day

1. **Serve a drawing; never double-click it.** Each drawing builds its navigation with JavaScript. As
   a bare file it looks like a different design, and a false "does not match" was once reported that way.
2. **Read the runner's summary line, not the exit code.** A run that died before starting can look
   like one that ran and failed. For the ward suite, files handed in must equal files that ran.
3. **Quote a number or SHA with the tree it came from.** This line moves several times a day.
   `git log -1` is the current commit; documents are not.
4. **No test can see that a screen does not look like its drawing.** Looking in a real browser is the
   only check, and it is recorded in [`SCREEN-VERIFICATION.md`](SCREEN-VERIFICATION.md).
5. **Ward Flow is never pushed, and nothing protected is deleted without the owner's yes.** "Fold into
   main" means the local ward line, never `origin/main`, which deploys the live app and database.
