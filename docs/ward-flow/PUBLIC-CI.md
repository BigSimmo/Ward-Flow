# Public Ward Flow PR checks

The public `BigSimmo/Ward-Flow` repository retains its current application source. The `Ward Flow CI`
workflow runs on pull requests to `main` and merge groups. It uses a read-only token, pinned actions,
locked dependencies, and synthetic browser configuration. It does not deploy the application.

## Layout

The checks run as parallel jobs, so a typical PR finishes in about four minutes (the single serial
job it replaced took about seventeen). Nothing is skipped: every job below runs on every non-docs PR.

| Job                                | Runners | What it runs                                                                                                                                      | Typical time |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `Ward Flow quick feedback`         | 1       | Only the tests that import the files the PR changed (`scripts/ward-flow/related-tests.mjs`). A fast signal, not a gate.                           | under 1 min  |
| `Ward Flow static checks`          | 1       | CI contracts, document links, screen record, dependency review, reference data, legal wording, and one type check of source and route types.      | about 1 min  |
| `Ward Flow unit shard 1` to `5`    | 5       | The reconciled offline unit population, split into five disjoint shards (`WARD_GATE_SHARD=i/5`). Together they run every file once.               | 2 to 3 min   |
| `Ward Flow browser journeys 1`–`3` | 3       | The Ward browser journeys, split into three duration-balanced groups of spec files (`WARD_JOURNEY_GROUP=i/3`), each on its own server and runner. | about 3 min  |
| `Ward Flow required`               | 1       | Passes only when the static, unit and browser jobs all succeed. This is the check the default-branch ruleset requires.                            | seconds      |

Details that keep the split sound:

- **Unit shards.** The discovery floor is checked on the whole population before splitting. Each shard
  is compared only with the expected-reds manifest entries for its own files, so the shards cover every
  file and every entry exactly once.
- **Browser groups.** Each group runs with one worker on a runner of its own. Three browsers sharing
  one runner made timing-sensitive journeys fail (28 September 2026). Failing groups upload traces and
  screenshots for three days.
- **Route types.** The static job runs `next typegen` before `tsc -p tsconfig.json`, so route and page
  signatures are checked there. The browser builds therefore skip their own type check
  (`WARD_GATE_BUILD=1`); the deployed build still runs it.
- **Build cache.** Browser jobs restore Next's working cache from the last run on the same PR. Next
  validates every entry against the source, so a warm cache changes speed, not what is built.
- **Contracts.** `scripts/ward-ci-public/check-contracts.mjs` fails if the required job stops needing
  any of the three, if a shard or group matrix does not match its count, or if the browser builds skip
  their type check without the static job's route-type check.

Documentation-only changes run the static contract, link and screen-record checks, and the other jobs
finish without installing anything. Package manifest changes also receive GitHub dependency review.

## Fast local iteration

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
