# Ward Flow

<!-- last-checked: 2026-10-24 -->

_Updated 2026-10-24 - link the operations runbook and the release tags; Documentation owns._

A ward and bed-coordination prototype for mental health services: referrals, patient movements, transport, delays and capacity.

**All patient data is synthetic. This is a development prototype, not an approved system for real patient care.** Never enter real patient information.

[Open the hosted prototype](https://ward-flow-production.up.railway.app/ward-flow).

## Quick start

You need Node.js 24.19.0 (`.nvmrc`) and npm 11. Any OS works.

```sh
npm ci            # installs dependencies and the Git hooks
npm run ensure    # starts or reuses the dev server and prints its URL
```

Open the printed URL plus `/ward-flow`. No credentials are needed: by default the app runs on synthetic, browser-local state. See [local first run](docs/ward-flow/LOCAL-FIRST-RUN.md) for the details.

The shared backend has its own packages. Install them once before `npm run test:backend` (which builds the backend engine, then runs its tests):

```sh
npm ci --prefix backend/ward-flow
```

## Everyday commands

| Task                                                 | Command                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| One unit test file (fast)                            | `node scripts/run-vitest.mjs run tests/ward-model.test.ts` |
| Unit tests for your changes                          | `npm run test:related`                                     |
| All unit tests                                       | `npm run test`                                             |
| Lint (zero warnings allowed)                         | `npm run lint`                                             |
| Typecheck                                            | `npm run typecheck`                                        |
| Format the files you changed                         | `npm run format -- --files <paths>`                        |
| Ward browser journeys                                | `npm run test:e2e:ward-journeys`                           |
| Release gate journeys (desktop Chrome, phone WebKit) | `npm run test:e2e:release-gate`                            |
| Shared backend tests                                 | `npm run test:backend`                                     |
| Pre-push checks for your change                      | `npm run verify:pr-local`                                  |

## How it fits together

- **Framework:** Next.js 16 with React 19 and TypeScript. Styling is CSS Modules.
- **Screens:** routes live under [`src/app/ward-flow/`](src/app/ward-flow/). Screen components and the workflow engine live under [`src/components/ward-management/`](src/components/ward-management/).
- **State:** one reducer holds the ward flow (referrals, movements, beds, transport, delays). Screens dispatch actions to it, and the synthetic seed data lives beside it.
- **Shared workspace (optional):** [`backend/ward-flow/`](backend/ward-flow/README.md) saves the shared state to Ward Flow's own synthetic-only database. The current provider is in [DATABASE.md](docs/ward-flow/DATABASE.md). Ward Flow must never connect to PsychSift's Supabase or Railway resources.
- **Tests:** Vitest unit and DOM tests in [`tests/`](tests/), Playwright journeys in `tests/*.spec.ts`.

## Continuous integration and deploys

- Every pull request runs [Ward Flow CI](.github/workflows/ward-flow.yml). Its scope plan selects executable static checks, eight unit shards, browser journeys, the release gate and a production build; documentation checks and a secret scan still run for narrower changes. See [scope by change](docs/ward-flow/PUBLIC-CI.md#scope-by-change). `Ward Flow required` checks the selected results and permitted skips.
- Dependabot opens grouped dependency updates each Monday.
- Railway deploys `main` automatically through its GitHub integration. Build, start and health check settings are recorded in [hosting](docs/hosting.md); day-to-day checks and rollback are in the [operations runbook](docs/ward-flow/OPERATIONS-RUNBOOK.md). A green CI run does not prove a deploy; check the hosted app directly.
- Each `main` commit that passes CI is tagged `release-YYYY-MM-DD-<short sha>` ([release tag workflow](.github/workflows/release-tag.yml)), giving a named point to compare or roll back to.

## Where to read next

- [Documentation by task](docs/README.md): user guides, engineering, operations and historical records.
- [Ward Flow documentation](docs/ward-flow/README.md): the product, accepted design and working behaviour.
- [AGENTS.md](AGENTS.md) and [how we work](docs/ward-flow/HOW-WE-WORK.md): rules for contributors and coding agents.
- [Decisions](docs/ward-flow/decisions.md) and [current facts](docs/FACTS.md).
- [Original source README](README.local-source.md), kept for history.

## Licence

The existing [licence](LICENSE) is retained. Public visibility does not grant an additional open-source licence.
