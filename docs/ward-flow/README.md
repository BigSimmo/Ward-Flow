# Ward Flow — start here

**This is the only entry point.** Any other file that says "start here" is historical and carries a
banner pointing back to this one. Updated 28 September 2026 for the dedicated repository.

## What Ward Flow is

A prototype of a bed-coordination tool for Western Australian mental health services: wards, beds,
referrals, patient movements, transport, delays and capacity. It runs on **synthetic data only**.
Its current repository is **`BigSimmo/Ward-Flow`**. Before working, verify that the checkout's
`origin` points there. The old `D:/Worktrees/Database/ward-lead` checkout and `BigSimmo/Database`
repository belong to the earlier shared-history arrangement; do not use them as Ward Flow destinations.

## Where the current build is

- **Base:** the `main` branch in `BigSimmo/Ward-Flow`. Work in an isolated branch and worktree made
  from that repository. Verify `git remote get-url origin`, the branch and `git log -1` in your
  checkout before making changes. The verified Ward Flow `main` tip identifies published source.
  Confirm a deployed revision and its runtime separately before calling it the current hosted build.
- **Find the affected source:** use the [current architecture orientation](../codebase-index.md)
  and relevant source/tests. The [code map](code-map/README.md) preserves a dated detailed snapshot;
  open only the sections needed for the task and verify relevant drift.
- **Code:** the engine and screens are in `src/components/ward-management/`; routes are in
  `src/app/mockups/ward-flow/`; tests are `tests/ward-*` and `tests/ui-ward-*`.
- **Current work:** use the agreed task scope, current source and existing task/checkpoint under
  the [task-receipt contract](../task-receipts.md). [`STATUS.md`](STATUS.md) opens with a
  current summary of what is built and what is left (dated; check it against `main`), followed by
  the historical 25 September record. Old entries do not authorise reviving old tasks.
- **Old Ward folders under `D:/Worktrees/Database/` are history.** Start new work in the dedicated
  Ward Flow repository and follow [`HOW-WE-WORK.md`](HOW-WE-WORK.md).

## Mission and definition of done

**Mission.** A real tool that a bed coordinator would open on a weekday morning instead of a
whiteboard, a spreadsheet or a phone round. The screens keep the current folded design, and the behaviour
is truthful: nothing is shown that the data does not hold.

**A task is done** when the requested stage and its required evidence are complete. A delivered
audit or verified local change does not require integration, publication or deployment. When
integration is requested, follow the authorised process in HOW-WE-WORK §4 and verify that stage
separately. A local commit alone does not prove publication or deployment. The full offline suite is selected for broad changes,
rather than every task. A screen is done when it also meets
[`SCREEN-DEFINITION-OF-DONE.md`](SCREEN-DEFINITION-OF-DONE.md).

**Before any real patient:** the outside reviews the owner parked must happen first (Aboriginal
cultural safety, medical device/TGA, clinical safety officer, privacy, WA legal advice on forms,
catchment data). They are listed in [`STATUS.md`](STATUS.md).

## Sources of truth

- **Design: the app as rendered from the latest accepted Ward Flow build.** Owner ruling,
  25 September 2026: keep the current design, style and layout, and disregard other designs,
  including the Command visual pilot and the design-system proposal. The drawings in
  [`mockups/`](mockups/) and [`mockups/WARD-FLOW-DESIGN-SYSTEM.md`](mockups/WARD-FLOW-DESIGN-SYSTEM.md)
  are background only. Where a drawing and the current app differ in look, ask the owner before
  changing the app to match the drawing.
  Reconfirmed by the owner on 2 October 2026 for the stale-rules review: use the current design on
  local `main` as the baseline. Neither historical mockup specifications nor D-28 commission a
  new redesign. Preserve understandable status, synthetic-data disclosure and accessible controls.
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
node scripts/run-vitest.mjs run <test-file>      # explicit test-file filters, one completed run
npm run test:related -- --base <actual-task-base> --dry-run  # preview changed-source selection
npm run test:related -- --base <actual-task-base>            # execute the related selection
node scripts/ward-flow/gate-tsc.mjs               # when changed source or types require it
```

Vitest positional arguments filter test filenames; they do not select importers of source files.
`test:related` follows imports from changed sources and reports its fan-out cap and fallback scope.
A related-test pass is focused evidence, not a substitute for the selected readiness gate.

**Fold checks (selected for the changed files, by the steward):**

```bash
node scripts/ward-flow/select-fold-gate.mjs --head <batch>  # origin/main by default; STATIC, FOCUSED or FULL
```

Read the selector's result on the exact integration candidate before acceptance. Existing chats must
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

1. [`../task-receipts.md`](../task-receipts.md) — current task identity, acceptance evidence and handoff; [`STATUS.md`](STATUS.md) gives the current summary, then historical context.
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
4. **Static checks do not prove fidelity to the accepted app.** Looking in a real browser is the
   only check, and it is recorded in [`SCREEN-VERIFICATION.md`](SCREEN-VERIFICATION.md).
5. **Verify the repository before any Git write, and get the owner's yes for protected deletions.**
   Ward Flow belongs in `BigSimmo/Ward-Flow`; `BigSimmo/Database` is a separate project. A push,
   pull request, merge, migration or deployment requires its own applicable authority and checks.
