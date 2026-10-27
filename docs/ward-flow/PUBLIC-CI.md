# Public Ward Flow PR checks

_Updated 2026-10-26 - main push queue, parallel release-gate legs, four unit workers; Documentation owns._

The `Ward Flow CI` workflow in `.github/workflows/ward-flow.yml` checks the public
`BigSimmo/Ward-Flow` repository with pinned actions, locked dependencies, a read-only token and
synthetic fixtures. It runs on pull requests to `main`, main pushes, merge groups, manual dispatch
and the nightly schedule. It does not deploy the application. This describes the implemented
contracts; hosted runtime and savings need measurements from runs of this topology.

## Layout

The dependency-free `plan` job derives scope and verifies every output against a fresh diff before
unit or browser matrices can be allocated. Static checks and scoped backend work follow that plan.
The main reuse proof runs separately. Missing history, unknown files, deletions and renames select
all executable work. `Ward Flow required` rejects missing plans, unexpected skips and failed jobs.

A newer push to a pull request cancels that PR's older run. Main pushes share one queue: the main
run in progress always finishes, and a newer merge replaces any main run still waiting, so a burst
of merges is checked once, on the newest main. The daily release takes the newest CI-passed main.
Unit shards run four Vitest workers, one per hosted-runner vCPU.

| Job                                             | Work                                                                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Ward Flow scope plan`                          | Computes and verifies install, policy, frontend static, backend, unit, browser and production-build flags.                                                                                            |
| `Ward Flow main reuse check`                    | On main pushes, proves the exact tree already passed the required heavy PR jobs.                                                                                                                      |
| `Ward Flow static checks`                       | CI contracts, source safety, document links/commands/facts and reference-pack integrity; scoped installs, changed-file checks, cached lint, route/source typecheck and policy/reference contracts.    |
| `Ward Flow backend and shared production proof` | Discovered backend tests, backend typecheck and LCOV against disposable PostgreSQL; authenticated shared-mode production browser proof.                                                               |
| `Ward Flow unit shard 1` to `8`                 | Eight disjoint duration-balanced slices of the reconciled offline unit population, with coverage blobs.                                                                                               |
| `Ward Flow prepared browser build`              | One isolated offline production browser build, exported with input and payload verification. No browser tests run here.                                                                               |
| `Ward Flow browser journeys 1` to `3`           | Three groups on separate servers and runners, consuming the prepared build. Group 1 also runs the disjoint Chromium CSRF project on that server.                                                      |
| `Ward Flow release gate <project>`              | Six required journeys with accessibility checks, as two parallel legs: desktop Chromium and phone WebKit, twelve required cases. Consumes the prepared build, or builds fresh on verified main reuse. |
| `Ward Flow secret scan`                         | Full-history gitleaks scan with a pinned, checksum-verified binary.                                                                                                                                   |
| `Ward Flow production build`                    | Separate full Next webpack build with normal typechecking and the phone script budget.                                                                                                                |
| `Ward Flow coverage`                            | Merges all eight unit coverage populations, enforces unchanged thresholds and checks the executable-file inventory.                                                                                   |
| `Ward Flow required`                            | Checks every selected result, every allowed scoped skip and the separate main-reuse path.                                                                                                             |

Every dependency install uses `scripts/install-locked-dependencies.mjs`, including the backend root.
The wrapper performs the locked install and verifies the installed runtime dependency inventory;
matching direct versions alone does not prove a usable installation. Jobs also record Node and npm.
An installation failure cannot establish test evidence.

## Scope by change

`plan.mjs` narrows only positively recognised scopes. `full` controls root installation; independent
`frontend_static`, `backend`, `unit`, `browser`, `build` and `policy` flags select work. Static document
and contract checks and the secret scan still run on narrow PRs.

| The PR changes only                                                           | Frontend static       | Root unit and coverage | Backend/shared proof | Browser groups and release | Production build |
| ----------------------------------------------------------------------------- | --------------------- | ---------------------- | -------------------- | -------------------------- | ---------------- |
| Recognised Ward Markdown or README                                            | skipped               | skipped                | skipped              | skipped                    | skipped          |
| Maintained policy and recognised documentation                                | policy contracts only | skipped                | skipped              | skipped                    | skipped          |
| `backend/ward-flow/**` and recognised documentation                           | yes                   | yes                    | yes                  | skipped                    | yes              |
| `tests/**/*.test.ts(x)` and recognised documentation                          | yes                   | yes                    | skipped              | skipped                    | yes              |
| Unit tests plus backend and recognised documentation                          | yes                   | yes                    | yes                  | skipped                    | yes              |
| Source, browser specs, tooling, configuration, unknown or unavailable history | yes                   | yes                    | yes                  | yes                        | yes              |

Backend engine and schema changes affect root tests and shared contracts. Backend-only changes
therefore retain the complete root unit gate as well as backend/shared proof, while skipping the
demo UI build and journey groups. Package manifests also select dependency review on PRs.
Deletions and renames fail closed even when their paths would otherwise qualify for a narrow row.

## Unit selection, coverage and measured costs

The discovery floor applies before the eight-way split. Files are dealt longest first onto the
lightest shard using `scripts/ward-flow/unit-durations.json`; unknown files use the median, with a
deterministic fallback when measurements are absent. Real durations are not capped to make the
balance look better. All runners compute the same disjoint population. Expected-red entries are
compared only with the files that actually ran; launch failures, unhandled errors and import crashes
cannot be accepted as listed assertion failures.

Each shard emits a Vitest blob with slice thresholds disabled. Coverage downloads every shard's
blobs and applies the unchanged thresholds to the merged population, then checks declared
executable files. Coverage does not run the entire suite a second time. The unit-duration extractor
reads those blobs and writes measured JSON; preparation profiling records aggregate counters and
milliseconds when `WARD_TEST_PROFILE_DIR` is set. No source text or event payloads are recorded.
Refresh committed duration records only from reviewed comparable measurements; synthetic test
fixtures and local durations do not establish hosted savings.

CI no longer runs a related-test pass in static checks: the unit shards run every file on every PR,
so it only repeated work (about 3.7 minutes a push on 27 October 2026). `npm run test:related` keeps
the same selection for local iteration. It follows literal imports, re-exports and CommonJS requires through
`src`, `scripts`, `tests` and `backend/ward-flow`. Both focused entry points share this selector.
Declared source-reading guards, including the appearance-key scan across all `src/`, are retained
after fan-out capping. Capped or explicitly deferred selections are partial evidence; the full unit
gate covers the remaining population. Root related runs compare failures with the same expected-red
manifest as the unit gate. Dynamic file-reading dependencies need an explicit declaration.

## Backend and shared production proof

`scripts/run-backend-tests.mjs` discovers every nested backend `.test.mjs`, excluding dependency and
build directories. Default runs without `WARD_TEST_DATABASE_URL` explicitly report
**PostgreSQL integration: NOT RUN**. An explicit PostgreSQL URL must point to loopback; remote hosts
are refused. `npm run test:backend:integration` requires that URL instead of succeeding with skipped
database checks. `npm run test:backend:coverage` writes separate `coverage/backend/lcov.info` without
inventing a numeric coverage floor. The default runner retains the explicit loopback URL used by CI.

The backend job uses disposable PostgreSQL and a separate shared-mode runner. That runner builds
and serves Next in production mode, runs the backend with production configuration through an
ephemeral loopback HTTPS proxy, and supplies local fake authentication. The runner uses the system
`openssl` executable to generate a temporary self-signed certificate; it is a declared system binary
in the unused-code configuration. It exercises both signed-in
desks, save propagation, reload persistence, conflict refusal, server workflow refusal and retained
keyboard focus. It validates the required shared cases from the report; a successful process with
missing or skipped cases is insufficient. It does not contact the hosted authentication provider.

## Browser build, release and caches

One `browser-build` job prepares the offline browser app for the three journey groups and the
release gate. Consumers verify the checkout, toolchain, build flags, isolated path and payload digest
before using it. This completed build artifact is distinct from Next's working cache. The separate
production build still runs normal typechecks; the browser build uses `WARD_GATE_BUILD=1` because
static checks generate and verify route/source types.

All blocking browser runs use one worker and zero retries. The release verdict requires the four
named bed-flow journeys on **both** `release-gate-desktop` and `release-gate-phone`: eight cases with
no skip or retry recovery. Accessibility retains the existing **serious or critical** axe WCAG failure threshold, without a recovery rescan. HTTP success,
final URL and screen identity are checked before scanning. A diagnostic rerun retains the original
failure. Playwright JSON establishes executed projects and cases; a configured project is not proof.

Next working caches and browser downloads are restored where selected; explicit cache saves are
restricted to main. Whole-tree lint uses ESLint's content cache, keyed by the lockfile, `eslint.config.mjs`
and `eslint-rules/`, so only changed files are linted again. Unit shards restore Vitest's compiled-module
cache (`fsModuleCache`), whose entries are keyed by file content, Vite config and lockfile; a stale entry is
missed, never used. Main runs start that cache empty and save one copy per shard each ISO week. Browser caches are keyed by Playwright version, include the required Chromium
headless shell, and still install system libraries on a cache hit. Release browser downloads use a
Chromium/WebKit-specific cache. A missing required executable fails preflight before a build.

Coverage blobs and the prepared browser build are retained for one day. Static diagnostics, unit
state/preparation profiles and failed browser/release evidence are retained for three days. Backend
and shared-mode evidence, final coverage/measured unit costs, and browser execution reports/costs are retained for seven days. Browser costs are extracted only after a successful journey verdict; raw JSON is also retained after failure. `scripts/ward-flow/journey-durations.mjs --from-reports <directory>` reads existing JSON without launching browsers or rewriting the baseline.
Report directories are unique per invocation so a later CSRF or diagnostic run cannot overwrite a
journey failure. Local pruning keeps the newest five managed report directories only.

## Main pushes and nightly runs

The main reuse proof in `main-reuse.mjs` is unchanged. It verifies through git and the GitHub API that
the pushed tree equals the head of the one merged PR that produced it, that this head contained the
previous main, and that a successful run on that head actually ran every required unit shard,
browser group, coverage thresholds and production build. Any missing proof or API/git error runs
fresh checks. On verified reuse the unit, coverage, browser-build, journey-group and production-build
jobs must be skipped, rather than failed or cancelled. Static checks, backend/shared proof and secret
scanning still execute. The release gate executes afresh, building locally because no prepared
browser artifact is produced on that path. A failed release gate fails `Ward Flow required`.

The scheduled full main run starts at 18:00 UTC (02:00 AWST). It selects a reproducible UTC-day engine
fuzz window: 16 sequences of 100 steps, with the exact first/last seeds and event budget written to
JSON. Reproduce it with `engine-fuzz-window.mjs --date YYYY-MM-DD` and the recorded
`WARD_ENGINE_FUZZ_FIRST_SEED`, `WARD_ENGINE_FUZZ_SEQUENCES` and `WARD_ENGINE_FUZZ_STEPS` values.
These settings are part of checkpoint identity. The bounded nightly window changes test inputs,
not the safety invariants. Ordinary runs retain their deterministic default seeds.

## Fast local iteration

- `node scripts/run-vitest.mjs run <test-file>` uses repository admission and offline defaults.
- `npm run test:focused -- --files <comma-separated source paths>` shows or runs mapped tests; add `--dry-run` to inspect selection. Unsafe or empty mappings refuse and direct you to the full gate.
- `npm run test:related` selects against `origin/main`, retaining declared source-reading guards.
- `npm run verify:pr-local -- --dry-run --files <comma-separated paths>` shows selected aliases. Source or unknown scope includes backend typecheck/tests and the production `build`; narrow scopes follow their flags. A failure before backend completion explicitly leaves integration unproved.
- `WARD_GATE_SHARD=2/8 npm run check:ward-expected-reds` reproduces one unit shard.
- `WARD_JOURNEY_GROUP=1/3 npm run test:e2e:ward-journeys` reproduces one browser group.
- `node scripts/ward-ci-public/changed-checks.mjs --base origin/main` runs the CI changed-file checks.

The changed-file checks cover formatting, errors-only ESLint and diff/test-deletion integrity.
Selected frontend static work additionally runs whole-tree ESLint with `--max-warnings 0`. Test-count
floor reductions remain advisory unless `DIFF_INTEGRITY_STRICT=1`; unreadable before-state and
truncation artefacts fail. Agents need the normal authority before provider, hosted CI or publication
operations. Local passing checks do not establish hosted CI, merge or deployment results.
