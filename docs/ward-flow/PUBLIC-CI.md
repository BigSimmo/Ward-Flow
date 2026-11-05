# Public Ward Flow PR checks

_Updated 2026-11-05 - atomic hosted shards, independent reuse and measured-main deduplication; Documentation owns._

The `Ward Flow CI` workflow in `.github/workflows/ward-flow.yml` checks the public
`BigSimmo/Ward-Flow` repository with pinned actions, locked dependencies, a read-only token and
synthetic fixtures. It runs on pull requests to `main`, main pushes, merge groups, manual dispatch
and the nightly schedule. It does not deploy the application. This describes the implemented
contracts; hosted runtime and savings need measurements from runs of this topology.

## Layout

The dependency-free `plan` job derives scope and verifies every output against a fresh diff before
unit or browser matrices can be allocated. Static checks, the production build, the prepared browser
build and scoped backend work follow that plan.

**Cheap first** (Josh, 4 November 2026). The unit shards, browser journeys and release gate also
wait for static checks and the production build (about two minutes each, in parallel), and coverage
waits for the shards. A failing lint, typecheck, build or phone script budget therefore stops the
run before about a dozen expensive runners start. A production build skipped by scope or exact verified evidence (not by
failure) still lets fresh tests run. A job skipped because a needed job failed never counts as a pass:
`Ward Flow required` needs `success` from every in-scope job.
The main reuse proof runs separately. Missing history, unknown files, deletions and renames select
all executable work. `Ward Flow required` rejects missing plans, unexpected skips and failed jobs.

Each pull request, and main, has one queue. A newer push to a pull request cancels that PR's older
run, even mid-run: a superseded head's result is never used, and letting it finish held the PR's new
run behind it while Ward Flow filled the account's 40 concurrent job slots (Josh, 4 Nov 2026
08:20Z, reversing that morning's never-cancel rule; "push less" keeps the churn down). Main runs
always finish, and a newer main push replaces any main run still waiting. The daily release takes
the newest CI-passed main.
Unit shards run four Vitest workers, one per hosted-runner vCPU.

| Job                                             | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Ward Flow scope plan`                          | Computes and verifies the scope flags, runs the full-history gitleaks secret scan (pinned, checksum-verified) and fails a PR that conflicts with main.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Ward Flow main reuse check`                    | On main pushes, proves reusable work independently for each gate on the exact landed tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `Ward Flow static checks`                       | CI contracts, source safety, document links/commands/facts and reference-pack integrity; scoped installs, changed-file checks, cached lint, route/source typecheck and policy/reference contracts.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Ward Flow backend and shared production proof` | Discovered backend tests, backend typecheck and LCOV against disposable PostgreSQL; authenticated shared-mode production browser proof.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Ward Flow unit shard 1` to `4`                 | Four disjoint duration-balanced slices of the reconciled offline unit population, with coverage blobs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Ward Flow prepared browser build`              | One isolated offline production browser build, exported with input and payload verification. No browser tests run here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Ward Flow browser journeys 1` to `2`           | Two groups on separate servers and runners, consuming the prepared build. Group 1 also runs the disjoint Chromium CSRF project on that server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `Ward Flow release gate <pair>`                 | Six required journeys with accessibility checks: desktop Chromium and phone WebKit, each split into a journeys part (the four core bed-flow journeys), a referrals part (inpatient transfer and community referral) and a checks part (the accessibility sweep); twelve required cases in all. The six suites run as two jobs of three, one per device (phone journeys, referrals and checks; desktop journeys, referrals and checks), one after the other on the same browsers, each suite with its own evidence and report artifacts. Consumes the verified prepared build whenever fresh release work is required. |
| `Ward Flow production build`                    | Separate full Next webpack build with normal typechecking and the phone script budget.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Ward Flow coverage`                            | Merges all four unit coverage populations, enforces unchanged thresholds and checks the executable-file inventory; skipped when any shard failed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Ward Flow required`                            | Checks every selected result, every allowed scoped skip and the separate main-reuse path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Every dependency install uses `scripts/install-locked-dependencies.mjs`, including the backend root.
The wrapper performs the locked install and verifies the installed runtime dependency inventory;
matching direct versions alone does not prove a usable installation. Jobs also record Node and npm.
An installation failure cannot establish test evidence.

Each job first restores `node_modules` from an exact cache key (OS, `.nvmrc`, `package.json` and
`package-lock.json`, no fallback). Only the production build job on main saves it, straight after
its attested install. On an exact hit the wrapper skips `npm ci` only when the restored tree's own
post-install stamp still matches the lock and the files on disk; otherwise it runs a clean install.

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

**Draft fast lane.** While a pull request is a draft, its runs skip the browser build, browser
groups and release gate (the phone and accessibility checks) whatever the scope says. Everything
else in the table still runs. `Ward Flow required` always fails on a draft, after confirming the
quick checks passed, so a draft can never merge on the fast lane. Marking the pull request ready
(`ready_for_review`) starts a full run, and only that run, or a later push, can pass the check.
Open pull requests as drafts while iterating and mark them ready when the work is done.

## Unit selection, coverage and measured costs

The discovery floor applies before the four-way split. Files are dealt longest first onto the
lightest shard using `scripts/ward-flow/unit-durations.json`; unknown files use the median, with a
deterministic fallback when measurements are absent. Real durations are not capped to make the
balance look better. All runners compute the same disjoint population. Expected-red entries are
compared only with the files that actually ran; launch failures, unhandled errors and import crashes
cannot be accepted as listed assertion failures.

Each hosted shard writes an exact, content-identified selection manifest. Each Vitest project
consumes only its intersection with that manifest, then removes the transport from worker inputs.
The collector runs one atomic process instead of splitting at the command-line character limit;
local resumable batches retain their file and character limits. Missing, duplicate, foreign or
changed selections fail closed, and every selected file must execute. Checkpoint identity includes
the transport and population, so old multi-batch receipts cannot stand in for the new run.

Each shard emits a Vitest blob with slice thresholds disabled. Coverage downloads every shard's
blobs and applies the unchanged thresholds to the merged population, then checks declared
executable files. Coverage does not run the entire suite a second time. The unit-duration extractor
reads those blobs and writes measured JSON; preparation profiling records aggregate counters and
milliseconds when `WARD_TEST_PROFILE_DIR` is set. No source text or event payloads are recorded.
Refresh committed duration records only from reviewed comparable measurements; synthetic test
fixtures and local durations do not establish hosted savings.

The legal-figure dueAt sweep (`tests/ward-legal-figure-guard-sweep-*.test.ts`) is about a third of
all unit time. Josh's ruling (27 October 2026): a pull request runs it only when it changes something
the sweep runs. `scripts/ward-ci-public/legal-sweep-scope.mjs` follows the sweep's imports from the
PR's own tree, and also counts the package manifests, `.nvmrc`, Vitest and TypeScript config,
`tests/setup/`, the workflow, the expected-reds manifest and the gate scripts that make this decision.
The import closure includes the execution harness and Vitest configuration, including their local
dependencies. Missing or unresolved local execution inputs refuse the narrow plan. The sweep's
iterator narrows movement subjects before constructing candidates; the complete world, exhaustive
candidate API, expiry sentinel registration and accepted-event/undo assertions stay unchanged.
Deletions, renames and any planner error run the sweep. The plan writes `legal_sweep=false` only for
a readable pull request diff, `verify-plan.mjs` re-derives it, and the shards leave the sweep out
(`WARD_GATE_SKIP_LEGAL_SWEEP=1`) only on that explicit `false`. Main pushes, the nightly run and
manual runs always run it. A pull request run without it cannot replace main's unit and coverage
proof, but independently proved browser, build, release and backend evidence can still be reused.

CI no longer runs a related-test pass in static checks: the unit shards run every file on every PR,
so it only repeated work (a mean of 1.1 minutes a push over 68 runs, up to 5.8, on 27 October 2026). `npm run test:related` keeps
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

One `browser-build` job prepares the offline browser app for the two journey groups and the
release gate. Consumers verify the checkout, toolchain, build flags, isolated path and payload digest
before using it. This completed build artifact is distinct from Next's working cache. The separate
production build still runs normal typechecks; the browser build uses `WARD_GATE_BUILD=1` because
static checks generate and verify route/source types.

Each Node runner installs the exact npm version declared by the root `packageManager` before
installing dependencies. The shared locked installer checks the actual selected npm CLI against
that declaration, including the separately packaged backend's inherited root pin. Dependency
lifecycle scripts remain disabled; recorded toolchain versions identify what ran.

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
device-specific cache: desktop installs Chromium, phone installs WebKit. Apt archives are also
separated by engine to avoid incomplete same-key cache writes; existing combined archives remain
read-only fallbacks. Backend shared proof restores the trusted Chromium binary cache. System
libraries and revision/executable checks still run on cache hits. A missing required executable
fails preflight before a build.

Coverage blobs and the prepared browser build are retained for one day. Static diagnostics, unit
state/preparation profiles and failed browser/release evidence are retained for three days. Backend
and shared-mode evidence, final coverage/measured unit costs, and browser execution reports/costs are retained for seven days. Browser costs are extracted only after a successful journey verdict; raw JSON is also retained after failure. `scripts/ward-flow/journey-durations.mjs --from-reports <directory>` reads existing JSON without launching browsers or rewriting the baseline.
Report directories are unique per invocation so a later CSRF or diagnostic run cannot overwrite a
journey failure. Local pruning keeps the newest five managed report directories only.

Successful release-gate legs also retain their JSON execution reports and axe JSON attachments for
three days, including nonblocking moderate/minor findings. This success artifact excludes screenshot,
video and trace files; failed legs keep their existing full diagnostic artifact. Missing success
reports fail evidence collection. These retained reports do not change accessibility thresholds or
prove physical-device, hosted-provider or deployment acceptance.

## Phone script budget on a moving main

Main has no merge queue and does not require branches to be up to date, so PRs that each fit the
phone script budget can land together over it. Before 4 November 2026 that turned every open PR's
required production build red until someone raised the limit by hand. Three parts now handle it:

- **Prevention.** The build merges the latest main before measuring (`merge-latest-main.mjs`), and
  `ward-flow-budget-recheck.yml` re-runs that build on armed PRs when relevant main inputs move.
  The build records the exact measured main revision; a matching latest-attempt receipt avoids a
  redundant rerun even when the recheck starts late. Contradictory receipts override timestamps;
  missing legacy receipts retain the conservative timing fallback. Annotation errors cannot
  establish a match, and the existing ten-minute wait bound remains.
- **Fair blame.** The budget step is `budget-gate.mjs`. When a PR's merged result is over budget, it
  builds and measures main alone in a separate worktree and fails only routes the PR pushed over,
  or grew more than 1.5 KB (build noise) past an already-over main. Inherited overage is a warning. It first reuses the
  measurements main's own push run saved for that commit (`main-measured.mjs`), so main is built a
  second time only when none exist. That build runs only when the merged result is over.
- **Trim issue, never an automatic raise.** Main's build saves its measurements as the
  `script-budget-measured` artifact. When a main run fails and those show a route over budget,
  `ward-flow-budget-heal.yml` opens one issue, "Phone script budget: main is over, trim needed",
  or rewrites the open one with the latest sizes. It comments only when a route newly goes over or
  grows more than 1.5 KB past the last report. It has issue permission only and never edits
  `script-budget.json`: a person decides any raise in a PR with its own history file (Josh,
  5 November 2026; until then the bot opened a PR raising the limit, a one-way ratchet).
- **Finding what to trim.** Build with `ANALYZE=true` and the usual production build command, then
  open `.next/analyze/client.html`. Look first at what every Ward Flow page loads (the root and
  `ward-flow` layouts and their shared chunks), then at the route's own page chunk. Lazy-load
  panels a phone does not draw on first paint, and keep demo seed data and large tables out of
  the shared chunks.

`ward-flow-ci-tidy.yml` frees runner slots on PR close and hourly (no longer on each PR push). It
cancels runs for merged or closed PRs, and other workflows' runs for an older head of an open PR
while none of their jobs is running. Ward Flow CI's own superseded PR runs are cancelled by its
concurrency group. Running checks on a current head are never cancelled.

## Main pushes and nightly runs

The main reuse proof in `main-reuse.mjs` first checks the one merged same-repository PR, the newest
completed run and required-job verdict, complete bounded history and unambiguous ordering. It then
proves unit, coverage, browser, release, production-build and backend work independently. A missing
legal sweep reruns unit and coverage without discarding otherwise valid browser/build proof. Unit
and coverage outputs stay coupled so a fresh merge always receives fresh shard blobs.

Test receipts must identify the exact landed tree. An up-to-date head can replace a genuinely absent
tested-tree notice, but never a malformed or contradictory notice. Build reuse additionally requires
the latest build attempt's exact built-tree and strict-budget notices. An inherited-overage warning
supplies no strict-budget receipt. Older successful attempts cannot fill gaps in the latest verdict.

A reused gate must be skipped, rather than failed or cancelled, and reuse is accepted only on a main
push with a successful verifier. Every fresh in-scope gate must pass. The prepared browser artifact
is built whenever either browser consumer still needs fresh work; a failed artifact preparation
blocks both consumers. Static checks and the secret scan always execute. Scheduled and manual runs
never take the reuse path. The daily release also vetoes a later contradictory acceptance verdict
on the selected SHA before advancing live or publishing a retained draft; API reads are not atomic
with publication.
On pull requests the scope plan job merges the current main as its last step
(`merge-latest-main.mjs`), so a conflicted PR fails there, before any other job starts, and
`Ward Flow required` fails with it. The production build merges main again before it measures the
phone script budget. `ward-flow-budget-recheck.yml` re-runs armed PRs' production builds only after
a main push that touched what the build or its budget reads (not after docs-only merges).

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
- `WARD_GATE_SHARD=2/4 npm run check:ward-expected-reds` reproduces one unit shard.
- `WARD_JOURNEY_GROUP=1/2 npm run test:e2e:ward-journeys` reproduces one browser group.
- `node scripts/ward-ci-public/changed-checks.mjs --base origin/main` runs the CI changed-file checks.

The changed-file checks cover formatting, errors-only ESLint and diff/test-deletion integrity.
Selected frontend static work additionally runs whole-tree ESLint with `--max-warnings 0`. Test-count
floor reductions remain advisory unless `DIFF_INTEGRITY_STRICT=1`; unreadable before-state and
truncation artefacts fail. Agents need the normal authority before provider, hosted CI or publication
operations. Local passing checks do not establish hosted CI, merge or deployment results.
