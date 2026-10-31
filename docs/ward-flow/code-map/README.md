# Ward Flow code map — start here

**Start with the [current architecture orientation](../../codebase-index.md), [Ward Flow's product entry](../README.md)
and [AGENTS.md](../../../AGENTS.md).** This index routes builders to the relevant subsystem without
requiring them to treat its September census as a current specification.

**Audience:** builders. **Status:** maintained navigation over dated subsystem records. **Owner:** Documentation.
_Updated 2026-10-24 - test commands and `EVENT_ROLE` location corrected; Documentation owns._
The clock and transport-route corrections were checked from source at
`fc30c90c9cdae9a208786ade6e885750f770a7ea` on 21 October 2026; this is not a new verification of every map entry.

The detailed parts began as a 25 September 2026 snapshot of the former Database ward line at `ace8e9ee8d`.
Later dated updates describe their own scope. Use current source and tests for the affected contract;
the original counts, line numbers and extraction topology remain history. Ward Flow's current base is
`main` in [`BigSimmo/Ward-Flow`](https://github.com/BigSimmo/Ward-Flow).

This map describes code. It does not rule on product questions. Where it repeats another document's
verdict it names that document.

## The parts

| Part                                                                     | Covers                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Overview](overview.md)                                                  | The whole thing on one page: sizes, how the pieces fit, known gaps (the original 25 Sept map)                                                                                                                                                                                   |
| [Engine](engine.md)                                                      | Reducer, every event type, state shape, entities, persistence, the clock, adding an event                                                                                                                                                                                       |
| [Data and rules](data-and-rules.md)                                      | Seeds, reference data, eligibility, referrals, catchment, legal clocks, capacity, all selectors                                                                                                                                                                                 |
| [Routes, shell and shared UI](shell-and-shared.md)                       | All <!-- fact:ward-route-count -->53<!-- /fact --> routes under `/ward-flow/*` (<!-- fact:app-route-count -->57<!-- /fact --> total including sign-in and digest, plus `/` redirect), the layout chain, rail, top bar, navigation, shared UI pieces, and `src/components/wf/**` |
| [Screens A](screens-a.md)                                                | Coordinator (`/` and `/command`), ED (`/ed`, `/ed/[edId]`), ward, referrals, community, search, statistics (12 routes), reports (`/reports/chronology`, `/reports/downtime`)                                                                                                    |
| [Screens B](screens-b.md)                                                | Board, capacity, movements, delays, handover, patients, alerts and the rest                                                                                                                                                                                                     |
| [Tests](tests.md)                                                        | Every ward test file, how the suites run, which tests to run for a change                                                                                                                                                                                                       |
| [Scripts and tooling](scripts-and-tooling.md)                            | Every script, generator, check, git hook and npm script; fold gates in order                                                                                                                                                                                                    |
| [Docs and mockups](../archive/code-map/docs-and-mockups.md)              | Dated 25 September inventory of documents/drawings; its classifications are historical                                                                                                                                                                                          |
| [Former frame and PsychSift](../archive/code-map/frame-and-psychsift.md) | Historical extraction context; verify current shared imports in this repository                                                                                                                                                                                                 |

## Key concepts in ten lines

1. **Ward Flow has its own repository.** This bed-coordination prototype for WA mental health services
   is developed in `BigSimmo/Ward-Flow`. PsychSift belongs to the former Database repository.
2. **The September census predates shared database work.** Later scoped updates do not refresh the
   entire census. Use the [current architecture orientation](../../codebase-index.md) and affected
   implementation before changing data flow. Keep prototype patients synthetic.
3. **One reducer is the engine.** Screens call `dispatch(event)`; `wardFlowReducer` checks the role,
   the payload, that the screen's view is not stale, and the domain rules, then either changes state
   or records a refusal. See [Engine](engine.md).
4. **Screens read through pure selectors** (`ward-derivations.ts` and friends), never by reaching
   into state ad hoc. See [Data and rules](data-and-rules.md).
5. **Route roles and shared identity are separate.** Local synthetic mode supplies route-role
   previews. Shared mode authenticates an account and scopes its records and commands to the
   authorised role/place; `EVENT_ROLE` remains the engine's event permission table. A reachable
   screen must not borrow coordinator authority for another desk.
6. **Prototype data and clock control are separate.** `WardFlowProvider` uses wall-clock timing and
   schedules 30-second ticks. Supplying `initialNow` pins deterministic test/render time and stops
   those ticks. Read the [provider](../../../src/components/ward-management/ward-flow-provider.tsx),
   rather than applying the older census's clock description.
7. **D-72 permits a scrubbed device copy after typed events.** Original typed values are excluded;
   saving stops if a safe, valid copy cannot be made. D-67 separately permits bounded synthetic
   referral/legal form session drafts for human review. See [current persistence guidance](../STATUS.md#remaining-work-and-local-remediation).
8. **The rendered app is the current design authority; the engine is the behaviour authority.** The
   drawings in `design/third-edition-mockups/` are background. See [Ward Flow's entry point](../README.md).
9. **The current base is public Ward Flow `main`.** Verify the checkout and `origin` before any remote
   action. The former Database ward line and its local-only rule do not govern this repository.
10. **Owner rulings are law.** They are indexed in `docs/ward-flow/OWNER-RULINGS.md`; a later answer
    beats an earlier ruling.

## Where to find things

| You want…                             | Look in                                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What an action does and who may do it | `ward-flow-events.ts`, `ward-flow-event-roles.ts` (`EVENT_ROLE`), `ward-flow-reducer.ts` — [Engine](engine.md)                                                    |
| A type (Movement, Referral, Unit…)    | `ward-model.ts`, `ward-patients.ts`, `ward-admissions.ts`                                                                                                         |
| A figure shown on a screen            | The selector in `ward-derivations.ts` or a domain file — [Data and rules](data-and-rules.md)                                                                      |
| Seed patients, wards, sites           | `ward-sites.ts`, `ward-movements.ts` (seed fixtures despite the name), `ward-*-seed.ts`                                                                           |
| Which component a URL renders         | `src/app/ward-flow/**/page.tsx` — [Routes, shell and shared UI](shell-and-shared.md)                                                                              |
| The left rail, top bar, drawers       | `src/components/ward-management/shell/`                                                                                                                           |
| Nav links and route titles            | `ward-nav.ts` (single source, tested both ways)                                                                                                                   |
| A screen's code                       | `src/components/ward-management/<screen>/` — [Screens A](screens-a.md), [Screens B](screens-b.md)                                                                 |
| A screen's design                     | Accepted rendered app and [active screen checklist](../SCREEN-DEFINITION-OF-DONE.md); drawings are historical background                                          |
| Tests for an area                     | [Tests](tests.md), "Which tests to run for a change"                                                                                                              |
| Generated docs and their generators   | [Scripts and tooling](scripts-and-tooling.md)                                                                                                                     |
| Status, open work, rulings            | [Current task/receipt workflow](../../task-receipts.md), [local task index](../../ward-flow-task-ledger.md), generated [owner-rulings index](../OWNER-RULINGS.md) |
| How to branch, check and integrate    | Repository [AGENTS.md](../../../AGENTS.md), then `docs/ward-flow/HOW-WE-WORK.md`                                                                                  |

## How to run and test

Work in a separate worktree from the current `BigSimmo/Ward-Flow` `main`, following
[AGENTS.md](../../../AGENTS.md). Do not link dependencies to the former Database checkout. Confirm
the checkout and remote before changing or running anything.

```bash
npm run ensure                                    # start or verify local server and print the URL
node scripts/ward-flow/serve-mockups.mjs          # serve the drawings (never double-click them)
node scripts/run-vitest.mjs run <test-files>      # run only the test files you name
npm run test:focused -- --files <a>,<b>           # tests that import your changed source files
node node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
```

Screens are at `<printed URL>/ward-flow`. Never assume a port.

Select the checks for your change from [AGENTS.md](../../../AGENTS.md) and
[HOW-WE-WORK.md](../HOW-WE-WORK.md). For a documentation-only change, check the changed links with
`npm run docs:check-links`.

## Finishing a task

Follow the current repository [AGENTS.md](../../../AGENTS.md) for ownership, checks and integration.
Commit only your intended files on your own branch, and report the verification actually run. Do not
apply the former Database ward-line fold procedure to this repository.

## Common pitfalls

1. **Reading the exit code instead of the summary.** A run that died before starting can look like
   one that ran and failed. For the ward suite, files handed in must equal files that ran.
2. **Adding an event in one place.** A new event needs its union member, an `EVENT_ROLE` entry (`ward-flow-event-roles.ts`), a
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
8. **Appearance and accessible controls.** A page's look changes only through a mock-up Josh has approved (D-91); historical token prescriptions do not authorise restyling. Current rules (31 October 2026): no coloured side edges or stripes anywhere, and phone controls drawn at 40px (32px small) with an invisible cover that keeps the 48px tap area. See [HOW-WE-WORK section 6](../HOW-WE-WORK.md#6-owner-rules-that-fail-builds-or-reviews) and inspect current scoped tests before changing controls.
9. **Mental Health Act wording.** The engine does not calculate legal expiry, but it stores the expiry
   entered from the checked paper form. No screen shows section references or a computed countdown
   ([D-70](../decisions.md#d-70-no-computed-mental-health-act-periods-show-only-the-recorded-due-time-20-october-2026)
   removed the D-29 demo). Unconnected controls say exactly "Not wired in this prototype."
10. **Trusting a document's number or SHA.** Quote a figure with the tree it came from, and check
    `git log -1`.

## Keeping this map current

Update the affected maintained summary or dated correction alongside source changes. Identify its
source revision and scope; preserve the original census as history. Do not silently refresh old
counts, line numbers or verification dates. If a part has no maintained summary for the affected
contract, link the current source and state that limitation before its historical body.
