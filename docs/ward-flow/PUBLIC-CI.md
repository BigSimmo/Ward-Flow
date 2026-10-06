# Public Ward Flow PR checks

The public `BigSimmo/Ward-Flow` repository retains its current application source. The `Ward Flow CI`
workflow runs on pull requests to `main` and merge groups. It uses a read-only token, pinned actions,
locked dependencies, and synthetic browser configuration. It does not deploy the application.

## Layout

The checks run as parallel jobs, so a typical PR finishes in about four minutes (the single serial
job it replaced took about seventeen). No test is dropped: each job runs everything in its part, and a
PR skips a job only when its changes cannot affect it (see [Scope by change](#scope-by-change)).

| Job                                | Runners | What it runs                                                                                                                                                                                             | Typical time |
| ---------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `Ward Flow static checks`          | 1       | CI contracts, document links, screen record, dependency review, changed-file checks, the PR's related tests, backend tests, reference data, legal wording, and one type check of source and route types. | 1 to 2 min   |
| `Ward Flow unit shard 1` to `5`    | 5       | The reconciled offline unit population, split into five disjoint, cost-balanced shards (`WARD_GATE_SHARD=i/5`). Together they run every file once.                                                       | 2 to 3 min   |
| `Ward Flow browser journeys 1`–`3` | 3       | The Ward browser journeys, split into three duration-balanced groups of spec files (`WARD_JOURNEY_GROUP=i/3`), each on its own server and runner.                                                        | about 3 min  |
| `Ward Flow coverage`               | 1       | Merges the five unit shards' coverage blob reports and applies the `vitest.config.mts` thresholds to the whole suite. Starts when the shards finish.                                                     | about 1 min  |
| `Ward Flow required`               | 1       | Passes only when every job succeeds (see [Main pushes](#main-pushes) for the one reuse case). This is the check the default-branch ruleset requires.                                                     | seconds      |

Details that keep the split sound:

- **Unit shards.** The discovery floor is checked on the whole population before splitting. Files are
  dealt longest first onto the lightest shard using `scripts/ward-flow/unit-durations.json` (each
  file's measured cost; an unmeasured file counts as the median, and with no record the split falls back
  to every fifth file). Every runner computes the same deal, so the shards stay disjoint. Each shard's
  floors scale with its share of the files, and each shard runs as one vitest process. Each shard is
  compared only with the expected-reds manifest entries for its own files, so the shards cover every
  file and every entry exactly once. Refresh the cost record when the shards drift apart.
- **Coverage.** Each unit shard also records V8 coverage for its own files into a Vitest blob report
  (`WARD_COVERAGE_BLOB_DIR`), with the thresholds switched off for that one slice. The coverage job
  downloads all five blobs, fails if any shard's blob is missing, and runs
  `vitest --merge-reports --coverage`, which applies the unchanged thresholds to the merged whole-suite
  result. Until 6 October 2026 a separate job ran the whole unit suite a second time for coverage, which
  took about seventeen minutes on its own.
- **Related tests.** The static job also runs only the tests that import the files the PR changed
  (`scripts/ward-flow/related-tests.mjs --root .`), as a fast signal. In `--root` mode it judges reds
  against the expected-reds manifest the same way the unit shards do, so it fails only where a shard
  would also fail. It used to have its own runner; sharing the static runner keeps two PR runs inside
  the account's concurrent-runner limit.
- **Browser groups.** Each group runs with one worker on a runner of its own. Three browsers sharing
  one runner made timing-sensitive journeys fail (28 September 2026). Failing groups upload traces and
  screenshots for three days.
- **Route types.** The static job runs `next typegen` before `tsc -p tsconfig.json`, so route and page
  signatures are checked there. The browser builds therefore skip their own type check
  (`WARD_GATE_BUILD=1`); the deployed build still runs it.
- **Build cache.** Browser jobs restore Next's working cache from the last run on the same PR. Next
  validates every entry against the source, so a warm cache changes speed, not what is built.
- **Browser cache.** Browser jobs restore the Playwright Chromium download (`~/.cache/ms-playwright`),
  keyed by the installed Playwright version, and still install the system libraries every run. Only
  runs on `main` save it, so pull requests reuse main's copy without adding their own.
- **Contracts.** `scripts/ward-ci-public/check-contracts.mjs` fails if the required job stops needing
  any of the three, if a shard or group matrix does not match its count, or if the browser builds skip
  their type check without the static job's route-type check.

## Main pushes

Railway deploys a `main` commit only after this workflow succeeds on it. Every push to `main` first runs
`Ward Flow main reuse check` (`scripts/ward-ci-public/main-reuse.mjs`). It proves, through the GitHub API
and git, that the pushed tree is identical to the head of the one merged pull request that produced it,
that the head already contained the previous `main`, and that a successful run on that head really ran
every unit shard, browser group, the coverage thresholds and the production build. When all of that
holds, those jobs are skipped on `main`, the required job requires them to be skipped (not failed or
cancelled), and the run still concludes success, so the deploy proceeds. The static checks, including
the whole-tree lint that pull requests do not run, and the secret scan still run on every `main` commit.
Anything short of the proof, including any API or git error, runs the full suite as before.

A scheduled full run of `main` at 02:00 AWST (18:00 UTC) keeps a regular fresh-runner run of the whole
suite on `main`.

## Changed-file checks

`scripts/ward-ci-public/changed-checks.mjs` runs in the static job on the files the PR changes, in
about ten seconds:

- **Prettier** on each changed file. Older unformatted files elsewhere never block an unrelated PR.
- **ESLint, errors only**, on changed source and script files. Warnings are reported locally, not gated.
- **Test-deletion guard** (`scripts/check-diff-integrity.mjs`): fails when a PR removes or guts tests
  without an approved entry in `diff-integrity.json`.

Run it locally with `node scripts/ward-ci-public/changed-checks.mjs --base origin/main`.

The static job also runs whole-tree ESLint (errors only) on every run, pull requests included, so an
ESLint config, rule or plugin change that breaks a file the PR did not touch fails on the PR instead
of first on `main`.

## Scope by change

`scripts/ward-ci-public/plan.mjs` decides which jobs a PR needs. It narrows only for files it
positively recognises; anything else, including deletions, renames, workflow and configuration
changes, runs every job.

| The PR changes only                                     | Static | Unit shards | Browser groups |
| ------------------------------------------------------- | ------ | ----------- | -------------- |
| Ward documentation                                      | links  | skipped     | skipped        |
| `backend/ward-flow/**` (and documentation)              | yes    | skipped     | skipped        |
| unit test files `tests/**/*.test.ts(x)` (and the above) | yes    | yes         | skipped        |
| anything else                                           | yes    | yes         | yes            |

The narrower rows are safe because nothing in `src/`, `tests/` or `scripts/` imports the backend, and
the browser specs import only application code and Playwright, never unit test files. Package manifest
changes also receive GitHub dependency review. Unit and browser jobs time out after 15 and 20 minutes,
so a hung run fails quickly instead of holding a runner.

## Fast local iteration

- `node scripts/ward-ci-public/changed-checks.mjs --base origin/main`: the CI changed-file checks.
- `npm run test:related`: runs only the tests related to your changes against `origin/main` (about two
  seconds for a small change). This is the same selection as the quick-feedback job.
- `WARD_GATE_SHARD=2/5 npm run check:ward-expected-reds`: reproduces one CI unit shard exactly.
- `WARD_JOURNEY_GROUP=1/3 npm run test:e2e:ward-journeys`: reproduces one CI browser group (Node 24).

## History

The previous broad PsychSift `CI` workflow is disabled in GitHub settings. The workflow uses no write
token or application deployment.

The first hosted run on public `main` found broken local evidence links, four legal-wording lines and
inherited unit tests that refer to agent tooling absent from the public checkout. Its reference,
typecheck and browser journey steps passed. These failures are not waived; a later hosted run on the
final PR head must pass before the change is ready to merge. The screen-verification record check
checks record structure and freshness, not whether the rendered screens visually match their designs.
