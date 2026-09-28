# Ward Flow code map — start here

**Start with [Ward Flow's entry point](../README.md) and the repository's
[AGENTS.md](../../../AGENTS.md).** This map is a file-by-file snapshot written on 25 September 2026
against the former Database ward line at `ace8e9ee8d`. Ward Flow now has its own repository,
[`BigSimmo/Ward-Flow`](https://github.com/BigSimmo/Ward-Flow), with `main` as its current base.
Check the code in your checkout before relying on a count, route, or setup claim below. Historical
Database paths and PsychSift references in linked map pages describe the extraction source; they are
not instructions for current work.

This map describes code. It does not rule on product questions. Where it repeats another document's
verdict it names that document.

## The parts

| Part                                                 | Covers                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Overview](overview.md)                              | The whole thing on one page: sizes, how the pieces fit, known gaps (the original 25 Sept map)   |
| [Engine](engine.md)                                  | Reducer, every event type, state shape, entities, persistence, the clock, adding an event       |
| [Data and rules](data-and-rules.md)                  | Seeds, reference data, eligibility, referrals, catchment, legal clocks, capacity, all selectors |
| [Routes, shell and shared UI](shell-and-shared.md)   | All 42 routes and redirects, the layout chain, rail, top bar, navigation, shared UI pieces      |
| [Screens A](screens-a.md)                            | Coordinator, ED, ward, referrals, community, search, statistics                                 |
| [Screens B](screens-b.md)                            | Board, capacity, movements, delays, handover, patients, alerts and the rest                     |
| [Tests](tests.md)                                    | Every ward test file, how the suites run, which tests to run for a change                       |
| [Scripts and tooling](scripts-and-tooling.md)        | Every script, generator, check, git hook and npm script; fold gates in order                    |
| [Docs and mockups](docs-and-mockups.md)              | Every top-level doc and drawing, with status; what each history folder holds                    |
| [Former frame and PsychSift](frame-and-psychsift.md) | Historical extraction context; verify current shared imports in this repository                 |

## Key concepts in ten lines

1. **Ward Flow has its own repository.** This bed-coordination prototype for WA mental health services
   is developed in `BigSimmo/Ward-Flow`. PsychSift belongs to the former Database repository.
2. **This map predates shared database work.** Its browser-state, API, login and migration descriptions
   are historical. Inspect the current implementation and [AGENTS.md](../../../AGENTS.md) before
   changing data flow. Keep prototype patients synthetic.
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
8. **The rendered app is the current design authority; the engine is the behaviour authority.** The
   drawings in `docs/ward-flow/mockups/` are background. See [Ward Flow's entry point](../README.md).
9. **The current base is public Ward Flow `main`.** Verify the checkout and `origin` before any remote
   action. The former Database ward line and its local-only rule do not govern this repository.
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
| How to branch, check and integrate    | Repository [AGENTS.md](../../../AGENTS.md), then `docs/ward-flow/HOW-WE-WORK.md`                  |

## How to run and test

Work in a separate worktree from the current `BigSimmo/Ward-Flow` `main`, following
[AGENTS.md](../../../AGENTS.md). Do not link dependencies to the former Database checkout. Confirm
the checkout and remote before changing or running anything.

```bash
npm run ward:dev                                  # organisation check, then prints the local URL
node scripts/ward-flow/serve-mockups.mjs          # serve the drawings (never double-click them)
node scripts/run-vitest.mjs <files>               # focused tests: your files + up to 3 direct importers
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

Screens are at `<printed URL>/mockups/ward-flow`. Never assume a port.

Select the checks for your change from [AGENTS.md](../../../AGENTS.md) and
[HOW-WE-WORK.md](../HOW-WE-WORK.md). For a documentation-only change, check the changed links with
`npm run check:ward-doc-links`.

## Finishing a task

Follow the current repository [AGENTS.md](../../../AGENTS.md) for ownership, checks and integration.
Commit only your intended files on your own branch, and report the verification actually run. Do not
apply the former Database ward-line fold procedure to this repository.

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
7. **Double-clicking a drawing.** Serve it for historical comparison; opened as a bare file it renders
   differently. The rendered app is the current design authority.
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
