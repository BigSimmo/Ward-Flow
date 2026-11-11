# Scheduled jobs, uptime coverage and live-versus-repo: audit evidence

_Point-in-time record, 10 November 2026, audit items M72, M80, M81 and M85. Source at main
29352cd0 plus this branch's new tests. Every check here ran offline on synthetic data; no provider,
hosted service or live site was called. What a person still has to do is marked **Needs Josh**._

## M80: scheduled jobs, late, doubled or overlapping

| Job (workflow)                                           | Overlap                       | Doubled run                                         | Late run                                      | Setting missing                                                                                                       |
| -------------------------------------------------------- | ----------------------------- | --------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Daily release (`daily-release.yml`, 22:00 UTC)           | Queued, never cancelled       | Second run changes nothing (new test)               | Clock used only to name the record            | Pause switch unset means release as normal (tested)                                                                   |
| Receipt clean-up (`prune-receipts.yml`, Mon 03:00 Perth) | Queued                        | Second run removes 0 and succeeds                   | Cutoff is the database's `now()`, not the run | Scheduled run fails loudly; manual run notes it. **Fails weekly until the secret is added**                           |
| Backend uptime (`backend-uptime.yml`, every 10 minutes)  | Queued                        | Keeps one issue; closes once                        | No clock; checks what is true when it runs    | Token or monitor account missing: warning, then one "Uptime monitor not set up" issue after 144 runs (fixed, see M72) |
| Dependency audit (`dependency-audit.yml`, nightly)       | No group; read-only, harmless | Report name carries the run id, so none overwritten | Reads advisories when it runs                 | No settings                                                                                                           |
| Nightly browsers (`ward-flow-nightly-browsers.yml`)      | Queued                        | Refreshes the one open issue (existing test)        | Local server only                             | No settings                                                                                                           |
| Keep-alive (`workflow-keepalive.yml`, Sundays)           | Queued                        | Same enables both times                             | No clock                                      | A refused enable fails the run                                                                                        |
| Living-page reminder (`docs-freshness.yml`, Mondays)     | Queued                        | Updates the one open issue (read, not tested)       | Uses today's date by design                   | No settings                                                                                                           |
| CI tidy (`ward-flow-ci-tidy.yml`, hourly)                | Queued                        | Cancels only active runs (read, not tested)         | No clock                                      | No settings                                                                                                           |

A test also fails if a new scheduled workflow appears without being added to this table.

Evidence: `npx vitest run tests/ward-audit-m80-scheduled-jobs.test.ts`, 23 passed;
`npx vitest run tests/ward-daily-release-retry.test.ts`, 36 passed (one new duplicate-run test).

**Needs Josh:** add the repository secret `WARD_SUPABASE_PRUNE_DATABASE_URL` (the `wardflow_pruner`
login), so the weekly clean-up stops failing.

## M72: what the 10-minute uptime check proves and misses

Proves, when green with no warning: the backend process answers `/healthz`; the backend reached its
database within the last 30 seconds (only when `WARD_FLOW_UPTIME_TOKEN` matches); Supabase sign-in
answers for the synthetic monitor account; that account loads `/v1/workspace` with synthetic data.

Misses: any save, reload or conflict; the signed-in site and the demo site (they sleep when idle and
are not called); alerts and phone push; the release itself; whether the backend runs the commit
`live` points at (that is the post-release check, M67).

Failures injected offline (`tests/ward-audit-m80-scheduled-jobs.test.ts`, M72 block, plus
`backend/ward-flow/workspace-monitor-workflow.test.mjs`): backend down, unreachable, database
unavailable, recovery on a later try, hidden database (token missing or misspelt), alert issue cannot
be created, open issues cannot be listed, workspace 503, sign-in refused, sign-in not answering.

Gaps found (operational choices for Josh):

1. **Fixed 10 November 2026 (D-129).** A hidden database check or an unset monitor account left the
   run green with only a warning, so the database check could be off for weeks unseen. The
   `backend-uptime.yml` coverage step now opens one "Uptime monitor not set up" issue, @mentioning
   the owner, after 144 runs (about a day) of gaps, and closes it once the whole check answers
   again. Test: the M72 block in `tests/ward-audit-m80-scheduled-jobs.test.ts`.
2. When the alert issue cannot be created the run fails, but GitHub emails a failed scheduled run
   only to whoever last edited the schedule, which may not be Josh.

**Needs Josh:** rename the backend's Railway variable `ARD_FLOW_UPTIME_TOKEN` to
`WARD_FLOW_UPTIME_TOKEN` (M54; recorded in `2026-11-04-tier-improvements.md`), then run the uptime
workflow by hand once with "Send one test alert" ticked and confirm the email arrives.

## M81: live matches the repo (offline part)

`scripts/ward-flow/live-schema-diff.mjs --print-query` prints one read-only query returning names
only: migration version, tables, row-level security, policies and the runtime role's grants.
`--snapshot <file> [--settings <names.txt>]` prints a names-only difference against the repo's
migrations, `infra/supabase-runtime-role.sql`, the settings template and the setting names the
backend reads. A settings file holding a value is refused.

First run, against a private local PostgreSQL 16 built from migrations 001 to 017 and the runtime
role script (not the hosted database): "Live matches the repo". After revoking one column grant,
adding a table grant, switching off one table's row-level security and dropping one policy, it named
exactly those four, and named `ARD_FLOW_UPTIME_TOKEN` as a live setting the repo never reads.
Offline test: `npx vitest run tests/ward-audit-m81-live-schema-diff.test.ts`, 8 passed.

**Needs Josh:** a yes for each run against the hosted database (after every migration and monthly),
and the backend service's setting names copied from Railway without values. Record the first
hosted run here.

## M85: size trend (offline part)

`scripts/ward-flow/script-size-trend.mjs` turns CI's own `script-budget-measured` artifact into one
month's rows of `docs/ward-flow/evidence/script-size-trend.csv`; re-recording a month replaces it.
A pull request that changes `script-budget.json` (a raise) or screen source (a trim) is classed as a
browser change by `scripts/ward-ci-public/plan.mjs`, so the release-gate journeys and axe sweep run.
Evidence: `npx vitest run tests/ward-audit-m85-size-trend.test.ts`, 5 passed.

**Needs Josh:** the artifact is kept 7 days and fetching it is a GitHub read, so either a monthly
manual download with his yes, or a CI step that appends the row (a shared workflow change). The
CSV does not exist yet; no month has been recorded.
