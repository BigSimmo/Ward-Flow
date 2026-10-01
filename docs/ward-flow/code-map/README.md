# Ward Flow code map — start here

**Read this before any Ward Flow task.** It is the index to a file-by-file reference of every Ward
Flow file and the shared code it loads. Written 25 September 2026 against the ward line at tip
`ace8e9ee8d` (`codex/task-ward-flow-live-state-20260831`). The line moves several times a day: check
`git log -1` and re-count anything a decision depends on.

This map describes code. It does not rule on product questions. Where it repeats another document's
verdict it names that document.

## The parts

| Part                                               | Covers                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Overview](overview.md)                            | The whole thing on one page: sizes, how the pieces fit, known gaps (the original 25 Sept map)   |
| [Engine](engine.md)                                | Reducer, every event type, state shape, entities, persistence, the clock, adding an event       |
| [Data and rules](data-and-rules.md)                | Seeds, reference data, eligibility, referrals, catchment, legal clocks, capacity, all selectors |
| [Routes, shell and shared UI](shell-and-shared.md) | All 42 routes and redirects, the layout chain, rail, top bar, navigation, shared UI pieces      |
| [Screens A](screens-a.md)                          | Coordinator, ED, ward, referrals, community, search, statistics                                 |
| [Screens B](screens-b.md)                          | Board, capacity, movements, delays, handover, patients, alerts and the rest                     |
| [Tests](tests.md)                                  | Every ward test file, how the suites run, which tests to run for a change                       |
| [Scripts and tooling](scripts-and-tooling.md)      | Every script, generator, check, git hook and npm script; fold gates in order                    |
| [Docs and mockups](docs-and-mockups.md)            | Every top-level doc and drawing, with status; what each history folder holds                    |
| [Frame and PsychSift](frame-and-psychsift.md)      | The shared frame Ward Flow runs inside, load-bearing shared files, PsychSift at module level    |

## Key concepts in ten lines

1. **Two products, one Next.js app.** Ward Flow is a bed-coordination prototype for WA mental health
   services. PsychSift, the clinical-guideline search app, shares the repository and is being retired
   from this branch. Nothing in PsychSift imports Ward Flow.
2. **No server, no database, no login.** All Ward Flow state lives in the browser tab. Patients are
   synthetic. There are no Ward Flow API routes or migrations.
3. **One reducer is the engine.** Screens call `dispatch(event)`; `wardFlowReducer` checks the role,
   the payload, that the screen's view is not stale, and the domain rules, then either changes state
   or records a refusal. See [Engine](engine.md).
4. **Screens read through pure selectors** (`ward-derivations.ts` and friends), never by reaching
   into state ad hoc. See [Data and rules](data-and-rules.md).
5. **The role is the route.** There is no signed-in identity; which screen you are on decides the
   role. Who may send which event is the `EVENT_ROLE` table.
6. **Time is synthetic.** `ward-clock.ts` is the only file that reads the real clock; the demo clock
   only moves through `ADVANCE_CLOCK`. Tests share one instant unless they advance it.
7. **Saves go to `sessionStorage`, and stop once anything typed happens.** Typed free text never
   reaches browser storage (the privacy lock).
8. **Drawings are the design authority; the engine is the behaviour authority.** The drawings live in
   `docs/ward-flow/mockups/`. No test can see a screen that does not match its drawing.
9. **The ward line is local only and never pushed.** "Fold into main" means the local ward line,
   never `origin/main`, which deploys the live PsychSift app and database.
10. **Owner rulings are law.** They are indexed in `docs/ward-flow/OWNER-RULINGS.md`; a later answer
    beats an earlier ruling.

## Where to find things

| You want…                             | Look in                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| What an action does and who may do it | `ward-flow-events.ts` (`EVENT_ROLE`), `ward-flow-reducer.ts` — [Engine](engine.md)                |
| A type (Movement, Referral, Unit…)    | `ward-model.ts`, `ward-patients.ts`, `ward-admissions.ts`                                         |
| A figure shown on a screen            | The selector in `ward-derivations.ts` or a domain file — [Data and rules](data-and-rules.md)      |
| Seed patients, wards, sites           | `ward-sites.ts`, `ward-movements.ts` (seed fixtures despite the name), `ward-*-seed.ts`           |
| Which component a URL renders         | `src/app/mockups/ward-flow/**/page.tsx` — [Routes, shell and shared UI](shell-and-shared.md)      |
| The left rail, top bar, drawers       | `src/components/ward-management/shell/`                                                           |
| Nav links and route titles            | `ward-nav.ts` (single source, tested both ways)                                                   |
| A screen's code                       | `src/components/ward-management/<screen>/` — [Screens A](screens-a.md), [Screens B](screens-b.md) |
| A screen's design                     | `docs/ward-flow/mockups/` — [Docs and mockups](docs-and-mockups.md)                               |
| Tests for an area                     | [Tests](tests.md), "Which tests to run for a change"                                              |
| Generated docs and their generators   | [Scripts and tooling](scripts-and-tooling.md)                                                     |
| Status, open work, rulings            | `docs/ward-flow/STATUS.md`, `docs/ward-flow-task-ledger.md`, `docs/ward-flow/OWNER-RULINGS.md`    |
| How to branch, commit and fold        | `docs/ward-flow/HOW-WE-WORK.md`                                                                   |

## How to run and test

Work in your own worktree on your own branch cut from the ward line, with `node_modules` as a junction
to ward-lead's (`cmd //c mklink /J node_modules D:\Worktrees\Database\ward-lead\node_modules`, run
inside the new worktree). Use absolute paths and `git -C <worktree>`; the shell's folder resets.

```bash
npm run ward:dev                                  # organisation check, then prints the local URL
node scripts/ward-flow/serve-mockups.mjs          # serve the drawings (never double-click them)
node scripts/run-vitest.mjs <files>               # focused tests: your files + up to 3 direct importers
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

Screens are at `<printed URL>/mockups/ward-flow`. Never assume a port.

Before folding (the full list and order is in [Scripts and tooling](scripts-and-tooling.md)):

```bash
node scripts/check-ward-expected-reds.mjs         # full offline ward suite (needed for engine changes)
npm run test:e2e:ward-journeys                    # browser journeys, chromium-mockups project
npm run check:ward-doc-links                      # doc links resolve
npm run ward:organise:check -- --source working-tree
```

Plus each generator's `--check` when its sources changed (`screen-map`, `mockup-manifest`,
`owner-rulings-index`, `screen-verification`, `rules-index` under `scripts/ward-flow/`).

## Finishing a task (Josh's rule, 25 September 2026)

A thread is not finished, and must not be resolved, until all of this is true:

1. **Everything useful is committed** on your own branch. Stage explicit paths; never `git add -A`,
   never `git stash`, never push.
2. **Anything a commit, merge or fold could overwrite is backed up first**: a backup branch
   (`backup/<date>-<topic>`) or `bash ~/.claude/scripts/backup-work.sh`.
3. **Take the fold lock** (`node scripts/ward-flow/fold-lock.mjs acquire "<thread name>"`), merge the
   latest ward line into your branch, re-run the checks for what you touched, then fold into the ward
   line in `D:/Worktrees/Database/ward-lead` (never `origin/main`).
4. **Compare against the backup** to confirm nothing was lost, then **release the fold lock**.
5. **Unwanted work stays on a named backup branch**, and your worktree has no uncommitted changes.
6. **Report to the coordinator**: what was folded, the backup branch name, and any open questions.
   Send any blocker or question to the coordinator straight away, with a recommendation.

## Common pitfalls

1. **Reading the exit code instead of the summary.** A run that died before starting can look like
   one that ran and failed. For the ward suite, files handed in must equal files that ran.
2. **Adding an event in one place.** A new event needs its union member, an `EVENT_ROLE` entry, a
   reducer case, a persistence classification and a permissions test. See [Engine](engine.md).
3. **Showing what the data does not hold.** The biggest recurring defect family: screens inventing
   vitals, pods, ages, legal status or figures. Every figure must come from state through a selector.
4. **Two files named `ward-bar`.** Root `ward-bar.tsx` is a small stacked-bar chart;
   `shell/ward-bar.tsx` is the top bar.
5. **`ward-movements.ts` is seed data**, not movement logic.
6. **Retired chrome and unreachable screens are still on disk** and look live. Check importers before
   editing, and never delete them without the owner (protected paths).
7. **Double-clicking a drawing.** Serve it; opened as a bare file it renders as a different design.
8. **Hex colours, small tap targets, coloured edge bars.** Design tokens only, 48px taps, no edge bars
   or top highlights (owner rulings; tests enforce most of this).
9. **Mental Health Act wording.** No section numbers and no computed legal time limits; unconnected
   controls say exactly "Not wired in this prototype."
10. **Trusting a document's number or SHA.** Quote a figure with the tree it came from, and check
    `git log -1`.

## Keeping this map current

Update the part that covers any file you add, rename or retire, in the same commit. If a part goes
stale beyond a quick fix, say so at the top of that part with the date rather than leaving it silently
wrong.
