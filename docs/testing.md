# Testing and verification

_Updated 2026-10-24 - historical diagnostics moved to the Ward archive; `test:focused --files` takes one comma-separated argument; Documentation owns._

Current Ward Flow commands, browser cadence and CI topology below were checked
against the remediation source on 20 October 2026. Hosted performance for this topology has not been measured. Older diagnostic and performance
material moved on 24 October 2026 to [testing: historical diagnostics](ward-flow/archive/testing-historical-diagnostics.md); it does not select a gate. Follow
[AGENTS.md](../AGENTS.md) and [HOW-WE-WORK.md](ward-flow/HOW-WE-WORK.md) for authority and gate rules.

> [!NOTE]
> **Inherited diagnostic material:**
> Some historical sections describe tooling developed for the former PsychSift monorepo. Those sections do not imply those tools or hosted jobs are present in Ward Flow.
> In the dedicated **Ward Flow** repository (`BigSimmo/Ward-Flow`), use synthetic browser/offline data. Run a focused unit check through `node scripts/run-vitest.mjs run <test-file>` or `npm run test:focused -- --files <a>,<b>` (one comma-separated argument) so repository admission and offline defaults apply. Use `npm run test:e2e:ward-journeys` for browser journeys and inspect `npm run verify:pr-local -- --dry-run` before readiness checks. Follow [`AGENTS.md`](../AGENTS.md) and [`HOW-WE-WORK.md`](ward-flow/HOW-WE-WORK.md) for authority and gates.

## Safe local execution

Repository verification uses a local run coordinator derived from Git's common directory, so admission covers every worktree for this repository. It permits at most two shared leases from different worktrees for fail-closed focused Vitest selections and read-only typechecking. Full Vitest, coverage, lint, build, Playwright, and live-provider tests retain exclusive admission. Unknown Vitest selections fail closed to exclusive mode, and shared Vitest runs are capped at two workers each.

Composite gates do not hold an umbrella lease: `verify:cheap` and `verify:pr-local` let each lint, typecheck, unit, build, or browser stage acquire the appropriate lease. This lets focused work proceed during lightweight stages without allowing it to overlap an exclusive stage. Waiting admission is queue-ordered, so later focused runs cannot jump ahead of a queued exclusive command. Exclusive stages wait up to 15 minutes for long browser or build owners; shared focused work retains a 30-second admission timeout so an interactive check reports contention promptly.

Nested commands reuse their parent's token. Shared typechecks override the repository's `node_modules/.cache` incremental path with worktree-specific temporary `.tsbuildinfo` state, so junctioned dependency directories are not written concurrently. The coordinator retains the legacy lock path and a live sentinel owner so older worktrees safely wait instead of bypassing newer shared leases. Dead owners and abandoned queue entries are reclaimed; live owners heartbeat and command text is redacted before persistence or contention output. Do not bypass or delete coordinator state manually.

Vitest's Vite transform cache is outside the commonly-junctioned `node_modules` tree and keyed by worktree. Two focused runs from the same worktree are not admitted concurrently. Do not install packages while a repository test, build, lint, typecheck, or server command is active. Avoid short-interval polling, and do not repeat an unchanged broad gate after it has already passed.

Ordinary Vitest and Playwright runs remove OpenAI, Supabase, database, and E2E credentials and force demo/offline mode. Provider tests use the `*.live.test.ts` suffix, are excluded from default discovery, and can only be started explicitly with `ALLOW_PROVIDER_TESTS=true npm run test:live`.

Provider-backed work, including `npm run test:live`, requires explicit user approval under
[AGENTS.md](../AGENTS.md).

<!-- docs-script-refs:historical-start -->

> **Historical provider-command examples:** the following aliases include retired monorepo tooling.

**Provider-backed boundary:** `test:live`, `eval:quality`, `eval:retrieval:quality`, `verify:release`, `check:supabase-project`, and other OpenAI/Supabase/hosted workflows need **explicit user approval** before agents run them (see root `AGENTS.md`). Prefer offline gates (`verify:cheap`, `verify:pr-local`, `eval:rag:offline`) unless that approval is in the task.

<!-- docs-script-refs:historical-end -->

## Risk-based selection

Start with the cheapest check that can fail for the changed behavior. Add another check only when it covers a distinct plausible regression that the existing evidence does not. Documentation and policy changes normally need formatting, documentation, syntax, or focused contract checks; localized behavior needs its directly affected test; cross-cutting or uncertain executable changes escalate to the relevant domain or broad gate. Do not routinely stack focused tests, the full unit suite, lint, typecheck, build, and browser checks, and do not rerun an unchanged passing gate.

`npm run verify:pr-local -- --dry-run --files <comma-separated paths>` shows the local plan. Recognised documentation and maintained policy scopes stay focused. Unit-only changes retain root static/unit checks; backend-only changes also select backend typecheck/tests because root contracts import backend engine and schemas. Both skip the demo UI build and journeys but keep the production `build` and phone script budget. Source, tooling, configuration, unknown changes and unavailable history select broad work, including the production `build`. Provider, physical-device and release-only acceptance retain their normal authority requirements.

## Testing speed playbook

<!-- docs-script-refs:historical-start -->

> **Historical selection examples:** this table includes the former Production UI workflow and retired process reference. Use the current commands and CI topology below.

Browser gates are expensive; select the affected checks before starting them. Prefer selection, duration-balanced groups, and within-session cache reuse over raising Playwright workers (`workers: 1`, `fullyParallel: false`, `retries: 0` stay required — see `#093` and the removed `docs/process-hardening.md`, recorded in [ARCHIVE.md](ARCHIVE.md)).

| Change type                           | Run this                                                                       | Avoid                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Lib/helper, no UI                     | `npm run test:focused -- --files <a>,<b>` or one Vitest file                   | `verify:ui`                                               |
| Component interaction                 | `.dom.test.tsx` + focused Vitest                                               | full Chromium                                             |
| Phone chrome / scroll / composer      | Focused Ward journey; release-gate phone project where affected                | immediate `verify:ui`                                     |
| Shared shell / header / `globals.css` | Inspect the local readiness plan; run affected Ward journeys                   | stacking `verify:cheap` + `verify:pr-local` + `verify:ui` |
| Docs / ledger only                    | `npm run verify:pr-local -- --dry-run` (confirm docs route)                    | full unit + UI                                            |
| PR ready                              | `npm run format -- --files <owned-paths>` (commit it) + `verify:pr-local` once | mid-CI pushes that cancel Production UI                   |

<!-- docs-script-refs:historical-end -->

**Local Playwright keep-root (iterative UI work).** Each `run-playwright.mjs` invocation otherwise builds under a unique `.next-playwright/<id>/` and deletes it. KEEP does **not** skip the Next production build — every invocation still rebuilds. It reuses the webpack/dist cache inside one shared root across stages in the same local session:

```bash
export PLAYWRIGHT_BUILD_ROOT_ID=local-ui
export PLAYWRIGHT_KEEP_BUILD_ROOT=true
# then: a focused Ward journey or single-spec run
# each run still builds; the shared root retains webpack cache between them
# unset both vars (or delete `.next-playwright/local-ui`) when done
```

## Commands

| Command                                       | Purpose                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `node scripts/run-vitest.mjs run <test-file>` | Focused development check with admission and offline defaults.                                                |
| `npm run test:focused -- --files <a>,<b>`     | Related-file selection; unsafe or empty mappings fail closed to the full unit command.                        |
| `npm run test`                                | Complete default offline unit population.                                                                     |
| `npm run typecheck:backend`                   | Backend TypeScript check, selected for backend and unknown local scope.                                       |
| `npm run test:backend`                        | Discover all backend tests; prints PostgreSQL integration NOT RUN without an explicit loopback test database. |
| `npm run test:backend:integration`            | Require an explicit loopback `WARD_TEST_DATABASE_URL`; refuse missing or remote databases.                    |
| `npm run test:backend:coverage`               | Backend discovery with separate `coverage/backend/lcov.info`, without an invented coverage floor.             |
| `npm run test:ci-workflows`                   | Selected offline cache, runner, lock parity, backend-CI and audit-CI contracts.                               |
| `npm run test:live`                           | Explicit provider suite; needs separate authority and `ALLOW_PROVIDER_TESTS=true`.                            |
| `npm run test:e2e:pr`                         | Production Chromium CSRF spec, excluding `@mockup` and legacy `@quarantine` tags.                             |
| `npm run test:e2e:ward-journeys`              | Synthetic Ward Chromium journeys.                                                                             |
| `npm run test:e2e:release-gate`               | Dedicated desktop Chromium and phone WebKit release journeys/axe checks.                                      |
| `npm run test:e2e:advisory`                   | Tag-filtered mockup/legacy `@quarantine` selections; no waiver from required journeys.                        |
| `npm run verify:cheap`                        | Broad offline local static, lint, typecheck and unit gate.                                                    |
| `npm run verify:pr-local`                     | Risk-routed local readiness; inspect `-- --dry-run` against the actual changed set.                           |
| `npm run verify:ui`                           | Lock parity plus the production Chromium selection, not the complete Ward journey suite.                      |
| `npm run check:coverage-inventory`            | Verify the declared executable-file population against produced LCOV.                                         |
| `npm run docs:maintain:check`                 | Read-only document, index, organisation and reference-pack integrity aggregate.                               |

Local readiness always invokes its selected gates: the cross-gate receipt store and gate arbiter
were retired on 18 October 2026, so
`run-heavy.mjs` and `run-vitest.mjs` never skip a run on an earlier result. Report reused evidence only
when you reuse an exact earlier run of the same inputs, with its time and scope.

The full unit gate separately checkpoints complete batches. Reuse requires matching source,
dependencies, command and environment, including all three `WARD_ENGINE_FUZZ_*` settings. Each batch
must retain its process outcome as well as assertion results; older checkpoints without that evidence
are refused. A normal exit 1 is valid evidence of assertion failures, not permission to ignore a
launch failure, signal, unhandled error or disagreement between the process and its assertion report.
A test file that fails outside its tests (an import crash) is a failing file; it is never accepted as
a listed expected red.

Playwright keeps an internal JSON report even with a caller-selected display reporter. Explicitly
requested projects must each execute a test across the reports; listing a project in configuration
or skipping all its tests is insufficient. Only the existing `test:e2e:advisory` selection may be
empty. A diagnostic rerun cannot erase an initial shard failure. Browser preflight includes both
mobile WebKit projects. The release accessibility sweep checks HTTP success, the intended final
URL and screen identity before axe, including the bed-meeting phone fallback. The complete release gate requires all four named journeys on desktop Chromium and phone WebKit: eight passed cases, no skips and no retry recovery. Any serious or critical axe WCAG violation fails it; the runner does not rescan to turn an initial failure green.

The script-budget check requires positive finite limits and complete measurements, counts queried
Next script assets, and rejects missing/empty assets or unexpected redirects. The existing WF-001
legacy redirect is accepted only at its exact coded destination. `check:client-bundle-secrets` scans
tracked source for known credential patterns, fails on unreadable eligible files, and retains its
synthetic exclusions; it does not inspect built bundles. Bounded FULL dependency analysis resolves
safe local const literal imports; unresolved or shadowed loads still retain the full gate.

Set `FAST_CHECK_SEED` to reproduce the property tests; local and ordinary CI runs default to `424242`. The scheduled engine safety run separately uses `scripts/ward-flow/engine-fuzz-window.mjs`: a reproducible UTC-day window of 16 sequences, 100 steps each. Its JSON records first/last seeds and the 1,600-event budget. Reproduce with `--date YYYY-MM-DD` and the recorded `WARD_ENGINE_FUZZ_FIRST_SEED`, `WARD_ENGINE_FUZZ_SEQUENCES` and `WARD_ENGINE_FUZZ_STEPS`; checkpoint identity includes all three settings. `WARD_TEST_PROFILE_DIR` enables aggregate preparation counters and milliseconds without source text or event payloads. Unit blob and Playwright JSON extractors produce reviewable timing JSON; update duration records from comparable successful measurements, without capping real outliers or inventing hosted savings.

## Component tests (jsdom)

Two Vitest projects run under one `npm run test` (see `vitest.config.mts`):

- **node** (`tests/**/*.test.ts`) — pure logic, route handlers, and SSR-string assertions.
- **jsdom** (`tests/**/*.dom.test.tsx`) — interactive component tests via `@testing-library/react`. The `.dom.test.tsx` suffix is required; a `.test.ts` file is collected by the node project and has no DOM.

Author component tests to assert **user-visible behaviour**, not markup snapshots:

- Query by role and accessible name (`getByRole("button", { name: … })`) so a missing or wrong `aria-label` fails the test; drive interactions with `@testing-library/user-event`.
- Cover the state matrix the change touches — loading / empty / error / disabled — plus keyboard operability and focus where relevant.
- The shared setup (`tests/setup/jsdom.setup.ts`) registers jest-dom matchers, auto-unmounts between tests, and polyfills `matchMedia` (override per test with the exported `installMatchMediaStub`) and `Element.scrollIntoView`.
- Mock hooks/modules with `vi.mock`; when the factory needs a spy, create it with `vi.hoisted` so it exists when the hoisted mock runs.

<!-- docs-script-refs:historical-start -->

> **Historical component examples:** some example files below were removed; consult current tests before reusing a path.

Reference examples: `tests/icon-button.dom.test.tsx` (accessible-name contract), `tests/sheet.dom.test.tsx` (stacked-overlay keyboard + scroll-lock), `tests/scroll-behavior.dom.test.tsx` (reduced-motion), `tests/registry-retry.dom.test.tsx` (`vi.hoisted` hook mock + error recovery).

<!-- docs-script-refs:historical-end -->

## Playwright ownership

The repository runner exclusively builds and serves each Playwright production app. It selects a safe port, verifies `/api/local-project-id`, uses an isolated `.next-playwright/<run-id>` build directory, replaces provider configuration with inert loopback values, and removes its server and output on success, failure, or signal. Playwright configuration never starts a server. The production boot guard permits this demo profile only when the output is isolated, provider mode is offline, credentials are absent, and the Supabase URL is the inert `127.0.0.1:1` target. Before acquiring the heavy lock or building, the runner preflights the Chromium (or requested Firefox/WebKit) executable — including the default `chrome-headless-shell` binary and any `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override — and exits non-zero immediately when it is missing, so a launch-infra failure cannot be mistaken for product-test failures after a multi-minute build. The designated download-disabled container image is the one exception: when `PLAYWRIGHT_BROWSERS_PATH` is exactly `/opt/pw-browsers` and the client-pinned shell is absent, the runner selects the newest preinstalled shell for the current platform and CPU architecture, then passes its exact path to Playwright. It logs that fallback before the build; generic shared caches still fail closed even when `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, so a developer cache cannot silently bless a stale browser.

When capturing Playwright output through a shell pipe (`cmd 2>&1 | tee …`), enable `set -o pipefail` (or avoid the pipe). Without it, bash reports the pipeline exit from `tee` (`0`) while the log still ends in `N failed` — a measurement artifact that previously looked like a green-when-broken gate (outstanding-issues #120). The Node runners themselves already propagate Playwright’s exit status.

The active Ward CI prepares one isolated offline production browser build and fans the verified
artifact out to three journey runners and the release gate. Consumers check checkout/toolchain,
build flags, isolated path and payload digest. The separate production-build job still checks the
normal application build. On verified main reuse the prepared-build job is skipped and release
journeys build afresh. Next working-cache reuse is separate from this completed artifact; only main
saves explicit Next/browser cache entries. Local keep-root reuse still rebuilds unless an explicitly
verified prepared artifact is selected.

Blocking tests run with zero retries. The browser wrapper selects list and JSON reporters;
the reporter defaults in `playwright.config.ts` do not establish that JUnit is produced by that wrapper.
Default reports and traces stay under a unique `test-results/<run-id>-<uuid>/` directory after the
temporary build is removed. A later invocation, including the CI CSRF check, uses a separate directory. At startup the runner keeps only the newest five such run directories,
counting the current one, and never removes anything else under `test-results/`.
Each report must also be configured with every requested project, including each name of a variadic
`--project a b` selection. An optional local sharded diagnostic rerun writes to its own directory and
cannot erase the original failure. A job name is never enough to establish which tests executed or why
they failed.

The former `verify:phone-chrome` command is retired in this repository. For phone changes select the
affected current Ward journey or the dedicated release-gate phone project. Browser emulation does
not establish physical Safari or installed-PWA acceptance.

### Playwright project cadence

`playwright.config.ts` declares ten always-present projects plus the conditional
`chromium-mockups-known` and `ward-shared-mode` projects. Declaring a project is not proof CI executes it.

| Project                                                       | Execution in the dedicated Ward Flow repository                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `release-gate-desktop`, `release-gate-phone`                  | `test:e2e:release-gate`: desktop Chromium and phone WebKit, in the browser-scoped `release-gate` job.                                                                                                                                                                                                                                                                          |
| `chromium-mockups`                                            | `test:e2e:ward-journeys`: required Ward journeys in three file groups when the planner selects browser work.                                                                                                                                                                                                                                                                   |
| `chromium-mockups-known`                                      | Conditional local/fold project when `WARD_JOURNEY_KNOWN_FAILURES` is set; not a separate CI matrix.                                                                                                                                                                                                                                                                            |
| `ward-shared-mode`                                            | Conditional: shared mode against a local backend and PostgreSQL, only through `node tests/support/ward-shared-mode-run.mjs` (needs `WARD_E2E_DATABASE_URL`); CI runs it in the separate backend/shared-production job. It builds and serves production Next plus a production backend through loopback HTTPS and local fake authentication, including save/reload persistence. |
| `chromium`                                                    | `test:e2e:pr` selects the production CSRF spec; CI invokes that spec explicitly in browser group 1.                                                                                                                                                                                                                                                                            |
| `firefox-ward-responsive`, `webkit-ward-responsive`           | Manual/selective responsive checks through the existing wrapper.                                                                                                                                                                                                                                                                                                               |
| `firefox`, `webkit`, `mobile-webkit`, `mobile-pwa-standalone` | Available for explicit project selection; no general main/weekly release matrix invokes them in the current workflows.                                                                                                                                                                                                                                                         |

The responsive projects select only `tests/ui-ward-responsive-audit.spec.ts` and require `@mockup`.
Run a selected project through `npm run test:e2e -- tests/ui-ward-responsive-audit.spec.ts --project=firefox-ward-responsive`
(or `--project=webkit-ward-responsive`). Availability and a Chromium result do not prove execution
in another engine. Phone WebKit in the release gate is emulation, not physical Safari/PWA acceptance.

## Appearance verification

The former `ui-style-contract`, `ui-visual-baseline` and visual-artifact specs were removed from this
dedicated repository. There is no active visual-baseline CI job or automatic screenshot adoption
workflow. The retained generic `playwright.visual.config.ts` is not evidence of a running gate.
Verify changed Ward appearance through the affected Ward journey and direct browser inspection,
including meaningful computed styles, geometry, keyboard interaction and accessibility where affected.
Follow the bounded screenshot and viewport rules in [HOW-WE-WORK §5](ward-flow/HOW-WE-WORK.md#5-testing).

## Flake policy

Blocking Playwright tests run with zero retries. The flake ledger and quarantine tooling were
retired on 18 October 2026; `tests/flake-ledger.json` is no longer read. A repeatable failure on
the same commit must be fixed or reported. Legacy tag filters in command aliases do not restore
that policy. Report and investigate failures on the same revision: a diagnostic rerun supplies
additional evidence and does not erase the initial failure. See [checks and evidence](agents/checks-and-evidence.md).

<!-- docs-script-refs:historical-start -->

> **Retired quarantine policy:** the following paragraph records the former ledger requirements.

`tests/flake-ledger.json` may be empty. Each entry must match the exact spec and title, and the test title must include `@quarantine` but not `@critical`. Entries require an owner, reproduction command, local tracking reference, first/last-seen dates, and an expiry no more than 30 days away. Reproduce a candidate three times on the same SHA before adding or retaining it: fix fail/pass races, treat repeatable failures as regressions, and remove entries that no longer reproduce.

<!-- docs-script-refs:historical-end -->

## CI topology

The active workflow is `.github/workflows/ward-flow.yml`; [Public CI](ward-flow/PUBLIC-CI.md)
describes its jobs and exact scope table. A dependency-free `plan` job derives and verifies `full`,
`unit`, `browser`, `policy`, `backend`, `build` and `frontend_static` before allocating matrices.
Recognised Ward Markdown can skip executable work. Policy selects its contracts. Backend-only
changes select frontend static checks, the full root unit gate and backend/shared proof; unit-only
changes skip backend proof. Both skip demo UI production builds and journey groups. Unknown,
deleted/renamed, executable configuration, source and non-PR/missing-history scopes fail closed.
The local readiness planner uses these flags too: inspect its dry run; source/unknown scope includes
backend typecheck/tests and production `build`.

Every root and backend install uses `scripts/install-locked-dependencies.mjs`, followed by installed
runtime inventory verification. Static work includes CI contracts, source safety, maintained links,
commands, facts and the dependency-free reference-pack membership/hash check. Full local
`docs:maintain:check` additionally checks generated indexes and organisation and needs dependencies
for site-map generation. Scoped frontend checks retain whole-tree lint and route/source typecheck.
Eight disjoint unit shards produce coverage blobs; the coverage job merges them, enforces unchanged
thresholds and validates declared executable files. Source-reading guards remain mandatory in
focused selection even after import fan-out capping; capped/deferred evidence remains partial.

The separate backend job discovers nested `.test.mjs` suites, typechecks and records backend LCOV
against disposable PostgreSQL. Without an explicit loopback `WARD_TEST_DATABASE_URL`, the local
runner says **PostgreSQL integration: NOT RUN**; the integration alias requires that URL and refuses
remote hosts. The shared-mode browser proof uses production builds, loopback HTTPS and local fake
authentication. It checks signed-in saves, another desk's view, reload persistence, conflicts,
server refusals and keyboard focus. Backend/root tests cannot substitute for that browser proof.

One prepared browser build feeds three journey groups; group 1 runs the separate Chromium CSRF
case on the same server. The release gate requires all eight named desktop/phone journey cases,
zero retry recovery and no serious or critical axe WCAG violations, without a recovery rescan. The required job checks plan, static,
backend, unit, prepared build, journeys, release, secret scan, build and coverage, and rejects
unexpected skips. Main reuse retains the existing exact-tree/PR-run proof. On that path only the
approved heavy jobs skip; static, backend/shared proof, secret scan and a fresh release run remain.

Events include the nightly 18:00 UTC (02:00 AWST) full main run. Nightly fuzz windows are bounded and
recorded for reproduction; preparation profiles and unit/browser timing JSON support measurement.
Coverage blobs and prepared builds are kept one day; static/unit and failed browser diagnostics
three days; backend evidence, final coverage/unit costs and browser execution reports/costs seven
days. Explicit cache saves are main-only. These are retention policies, not evidence that a hosted
run passed or that it became faster. `.github/workflows/dependency-audit.yml` is the separate audit
workflow. Hosted results and deployment state require observed evidence and their own authority.
