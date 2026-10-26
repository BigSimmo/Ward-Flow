# Ward Flow operations runbook

<!-- last-checked: 2026-10-24 -->

Written 24 October 2026 from repository docs and config; not tested against the live services.

_Updated 2026-10-24 - first plain-English runbook for the hosted prototype; Documentation owns._

**Who this is for:** whoever looks after the hosted synthetic prototype. **Status:** current
guidance, pulled together from the dated records linked below. Those records hold the detail and
the evidence. This page adds no new gate and proves nothing about the live services. Where a claim
here has **not been tested end to end**, it says so.

Ward Flow holds synthetic data only. Nothing here authorises real patient data.

## What runs where

| Part                 | Where                                        | Name                | Notes                                                                                |
| -------------------- | -------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| Public demo app      | Railway, project **Ward Flow**, `production` | `ward-flow`         | Local mode only. No database, no sign-in. Health: `/api/health`                      |
| Signed-in site       | Same Railway project and environment         | `ward-flow-shared`  | Shared mode. Sleeps when idle. Health: `/api/health`                                 |
| Shared backend       | Same Railway project and environment         | `ward-flow-backend` | Node server. `/healthz` (no sign-in), `/readyz` (signed in). Never sleeps            |
| Database and sign-in | Supabase project **Ward Flow**, Sydney       | schema `ward_flow`  | Backend logs in as the restricted `wardflow_backend` role, never the administrator   |
| Uptime check         | GitHub Actions, `backend-uptime.yml`         | backend uptime      | Every 30 minutes asks `/healthz`. Opens a `backend-down` issue that emails the owner |
| Source               | GitHub `BigSimmo/Ward-Flow`, branch `live`   | -                   | Railway follows `live`; the daily release moves it from CI-passed `main`             |

Railway runs in Singapore, so this hosting is offshore and synthetic-only. Addresses and resource
IDs are in [hosting.md](../hosting.md). The Supabase project ID and how to pick the right connector
account are in [DATABASE.md](DATABASE.md). Settings names (never values) are in the
[Supabase settings template](../../backend/ward-flow/infra/supabase-settings.template.env) and the
[frontend template](../../backend/ward-flow/infra/frontend.env.example). Secrets live only in
Railway and Supabase. Never copy them into the repo, a log, a ticket or a chat.

**One backend replica.** The shared backend runs as one Railway replica. Its board, archive-count
and reply caches are held per process. A second replica stays correct, but it reads the whole
board until its caches warm up, and database traffic roughly doubles. From PR #870 the backend
logs `ward_backend_process_cache_notice` once at startup when `RAILWAY_REPLICA_ID` is set. Adding
replicas is a hosted change and needs Josh's yes.

There is no `supabase/` folder and no Railway config file in the repo. Build commands, start
commands, watch paths and the health-check path are Railway dashboard settings. The repo copy of
the backend watch list is [watch-paths.mjs](../../backend/ward-flow/watch-paths.mjs). The schema is
in [backend/ward-flow/migrations](../../backend/ward-flow/migrations), currently up to
<!-- fact:latest-migration -->015-list-and-tv-views<!-- /fact -->.

## Who may do what

- **Read-only looks** (dashboard status, deployment list, logs, a health URL) are fine for the
  maintainer, but agents still need Josh's go-ahead before calling any provider (AGENTS.md rule 3).
- **Any live change needs Josh's explicit yes first.** That covers deploys, rollbacks, restarts,
  Railway or Supabase settings, migrations, rollback scripts, Auth changes, restores and deleting
  anything.
- **Anything billable needs spending approval first**: a new Supabase project, PITR, bigger
  compute, a paid alert or monitor. See the spending section of
  [shared-context-and-memory.md](../agents/shared-context-and-memory.md).
- Merging to `main` no longer deploys. The daily release (6 am Perth) moves `live`, and that is the
  deploy (next section). A manual release run needs Josh's "release now"; never push to `live` by hand.
- Never use PsychSift's Supabase project, Railway service or credentials.

## Routine checks

Weekly, or before a demonstration. All read-only.

1. **Uptime issues.** Look for an open `backend-down` issue in the repo. GitHub turns scheduled
   workflows off after 60 days without repo activity, so check the workflow still runs.
2. **Railway.** For each of the three services, find the current successful deployment and its
   commit. Do not mistake a WAITING or SKIPPED entry for the live one. Method:
   [RAILWAY-OPERATIONS.md, read the four states](RAILWAY-OPERATIONS.md#read-the-four-states-separately).
3. **Health.** `/api/health` on the two sites should give HTTP 200 and `{"status":"ok"}`.
   `/healthz` on the backend should report `database` as `ok`. These prove the server is up. They
   do not prove sign-in or saving works.
4. **Supabase.** In the dashboard (right project, checked against DATABASE.md): project healthy,
   database size and usage against the plan limit, newest backup date.
5. **Receipts.** Command receipts older than 7 days are pruned every Monday at 03:00 Perth by
   `.github/workflows/prune-receipts.yml`. It does nothing until the owner adds the repository
   secret `WARD_SUPABASE_PRUNE_DATABASE_URL`; check its weekly run succeeded. To prune by hand, run
   `npm --prefix backend/ward-flow run prune:supabase`. It needs the private administrator
   environment, so it is a live change. The audit history is never pruned.
6. **Quiet periods.** Two things stop by themselves when nobody is working on Ward Flow:
   - GitHub turns off every scheduled workflow after 60 days without repository activity:
     backend uptime, the daily release, receipt pruning, the dependency audit and the scheduled CI
     run. In each workflow's Actions page, check it still shows recent scheduled runs. Turn a
     disabled one back on there; a manual run alone does not re-enable the schedule.
   - A Supabase project on the Free plan pauses after about a week without activity. The backend
     `/healthz` should then report `database: unavailable`, and every save fails. Restoring it is done in
     the Supabase dashboard and is a live change, so it needs Josh's yes. The current plan is not
     recorded in the repo; on a paid plan this does not happen.

   Before a quiet spell (a holiday, or a paused pilot), note the date, and check both on return.

## How a deploy happens

- Since 24 October 2026, a move of the `live` branch (by the
  [daily release workflow](../../.github/workflows/daily-release.yml)) triggers Railway's GitHub integration for each service whose **watch paths**
  include a changed file. Documentation-only changes are SKIPPED on purpose.
- **Wait for CI** is on: the deploy waits for the GitHub checks on that exact commit and only
  goes ahead if they pass. Recorded as turned on for `ward-flow` on 4 October and for
  `ward-flow-backend` and `ward-flow-shared` on 19 October 2026. Current settings were not
  re-read for this page.
- While a new deploy builds or waits, the previous successful deploy keeps serving.
- **Database migrations never run on deploy.** The backend refuses to migrate at startup. A
  migration is a separate, approved administrator step
  ([SETUP-SUPABASE.md](../../backend/ward-flow/SETUP-SUPABASE.md)).
- Browser settings for the signed-in site are baked in at build time. Changing one needs a rebuild.

After a deploy, check the health URL and the affected page. Then, for shared-mode changes, the
signed-in save, reload and conflict sequence in
[operations-readiness.md](operations-readiness.md#hosted-browser-acceptance). **Not yet done in a
browser on the hosted site.**

### Rolling back the app

1. Get Josh's yes. Name the service and the exact earlier deployment.
2. Check that deployment still works with the current database schema and settings. Pair the
   site and backend versions. An older build may lack a later fix.
3. In Railway, redeploy that earlier deployment. Leave the database alone.
4. Fix the source with a reviewed revert or fix pull request. Never reset shared history.

Rollback candidates are listed in
[operations-readiness.md](operations-readiness.md#application-rollback). **No live rollback has
been run or proven.**

### During a pilot

The daily release changes the app under staff who are using it. Josh agreed on 26 October 2026
(Part A item 42) that during a pilot:

- the scheduled release is turned off, and releases are run by hand once a week at an agreed
  time, outside bed meetings and handover, with sites told the day before;
- an urgent safety fix may still be released at once, with Josh's yes, and sites are told the
  same day;
- no release goes out while a merged change to a hazard control is waiting for the clinical
  safety owner's review; and
- one rollback is rehearsed on synthetic data before the pilot starts: record the current `live`
  commit and each service's deployment, roll back to the previous `live-*` tag with Josh's yes,
  run the health and signed-in save, reload and conflict checks, then roll forward the same way.
  Record the times and results. The database is never restored as part of an app rollback.

## Common incidents: first steps

Start every incident by writing down the time, the service and what users see. Read before you
change anything. Do not paste tokens, passwords or record contents anywhere.

| What you see                    | First steps                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App down**                    | Check `/api/health` (site) or `/healthz` (backend). The signed-in site sleeps, so a slow first load is normal. In Railway, read the latest deployment's state and logs. FAILED or CRASHED: read the failed stage. Use the state table in [RAILWAY-OPERATIONS.md](RAILWAY-OPERATIONS.md#act-on-the-actual-state).                                                |
| **Sign-in failing**             | Check Supabase Auth status and the backend's `/healthz`. Then check the site's build settings point at the right backend and Supabase project, and the backend's allowed origin names the site. A user with no membership row is refused by design (backend README, roles and places).                                                                          |
| **Saves failing, Retry banner** | The banner reads "Connection unavailable — changes are disabled." with a Retry button. Ask the user to stay on the page and press Retry, not reload, or the unconfirmed action is lost. Then check backend `/healthz`: `database: unavailable` points at Supabase. HTTP 409 is a normal conflict, not an outage.                                                |
| **Database at limit**           | In Supabase, check database size and usage against the plan. Prune old command receipts (routine check 5, needs approval). Moving to a bigger plan or compute is billable and needs spending approval. The plan's exact limits are **not recorded in the repo**.                                                                                                |
| **Board size alert**            | From PR #870 the backend logs `ward_backend_workspace_size_alert` at most once an hour once the live board passes 6 MiB. Past that point, closed records archive after 7 days instead of 30. Check the board size and that archiving is working (the History archive count rises). Then follow **Database at limit**. Saves fail at the 8 MiB limit.            |
| **Bad migration**               | Stop further migrations. The backend accepts schema versions 5 up to the latest, so the app may keep running. With Josh's yes, run the matching rollback script in one stop-on-error transaction, newest first, from `backend/ward-flow/infra/` (order in [SETUP-SUPABASE.md](../../backend/ward-flow/SETUP-SUPABASE.md)). Then re-run the runtime role grants. |

The backend logs carry only request IDs, route categories, status and timings. They never carry
tokens, user IDs or payloads ([observability.md](../observability.md)). Sentry error reporting
was switched on on 26 October 2026 (organisation `clinibase-xz`, US region, synthetic data only,
per project notes). It receives error types and stack frames, never messages, URLs or users
([operations-readiness.md](operations-readiness.md#server-error-reporting-sentry)). Its settings
were not re-read for this page and **no event has been seen arriving**.

## Backup and restore

What the repo knows, from [RETENTION-AND-BACKUP.md](RETENTION-AND-BACKUP.md#backups):

- Backups are set in the Supabase dashboard, not in code. The repo cannot turn them on.
- **The current Supabase plan is not recorded.** On the Free plan there are no automatic
  backups. On Pro, daily backups are kept 7 days. PITR is a paid add-on.
- **Never use "restore in place" on the live project.** It replaces the live database and takes
  it offline.
- After any restore, the `wardflow_backend` password must be reset and the backend setting
  updated. Daily backups do not keep custom role passwords.
- A manual backup schema, `ward_flow_backup_20261019`, exists in the live database (reported by
  the owner, not recorded elsewhere in the repo). **Keep it until the shared pilot has run for a
  week.** Deleting it needs Josh's explicit yes.

Tested so far: one **local** `pg_dump` and `pg_restore` drill on 18 October 2026 against a
throwaway PostgreSQL server with synthetic data. It did not touch Supabase. Its migration row
count has an unresolved discrepancy. On 26 October 2026 a read-only `pg_dump -Fc` of the hosted
`ward_flow` data was restored into a local copy and passed (sign-in over HTTP not tested; see
[RETENTION-AND-BACKUP.md](RETENTION-AND-BACKUP.md#hosted-pg_dump-restore-drill-26-october-2026-second-run)).
**No Supabase backup has been observed and no Supabase restore has been tested.** The owner has not set a data-loss window (RPO) or recovery time (RTO).

## Backup-restore drill

**Run twice on 26 October 2026.** The first run failed (record in
[RETENTION-AND-BACKUP.md](RETENTION-AND-BACKUP.md#hosted-copy-restore-drill-26-october-2026)): the
data came back complete, but the copy had been made by a script that copies tables and rows through
Supabase's management service, so the audit locks were lost. The second run, with `pg_dump -Fc`,
passed every check except a sign-in through the restored backend, which it did not test (record in
[RETENTION-AND-BACKUP.md](RETENTION-AND-BACKUP.md#hosted-pg_dump-restore-drill-26-october-2026-second-run)). **Only a `pg_dump -Fc` counts as a
backup for this drill.** Running it touches the hosted Supabase project and needs Josh's explicit
yes first. Steps that create a new Supabase project are billable and need spending approval too.

Aim: prove a copy of the live `ward_flow` data can be brought back somewhere safe, and time it.
It never writes to the live database.

**Before starting**

1. Josh says yes to this run, names the target (local PostgreSQL, or a new scratch Supabase
   project) and approves any cost with a hard cap.
2. Check the connector or dashboard shows the right project name and ID (DATABASE.md). Stop if
   anything differs.
3. Write down the live schema version (the versions in `ward_flow.migrations`, not Supabase's
   own migration history), the row count of each `ward_flow` table, the number of triggers,
   functions and check constraints in the `ward_flow` schema, and the time. Metadata only, no
   record contents.

**Option A: local PostgreSQL (preferred, no hosted spend)**

4. With an approved administrator connection, take a read-only `pg_dump -Fc` of the `ward_flow`
   schema. Keep the dump and its checksum outside the repo. Josh copies the connection string
   from the Supabase dashboard (Connect, Session pooler) into a private file on the machine
   running the drill; the agent reads it without printing it and deletes it afterwards. Agents
   never fetch or type the password. The project's safety hook will ask Josh to approve the dump
   and the clean-up commands one at a time. Copies made through Supabase's management service or
   table-by-table scripts do not count: they drop triggers, functions, check constraints and
   grants.
5. Start a throwaway local PostgreSQL that matches the live major version (17 as of October 2026).
   Loopback only, or no network at all.
6. Roles are not in a `ward_flow` dump. Create the `wardflow_backend` login role first (`NOINHERIT`,
   or the backend refuses to start), then restore with `pg_restore --exit-on-error` into an empty
   database. Afterwards run `backend/ward-flow/infra/postgres-runtime-role.sql` (or
   `supabase-runtime-role.sql` on Supabase) as administrator to put back the grants and timeouts,
   and set the role's password privately. A local target also needs TLS, because the backend
   insists on a verified encrypted connection; a throwaway local certificate is enough.
7. Run the backend locally with the `postgres` adapter against the restored copy, as described in
   [operations-readiness.md](operations-readiness.md#backup-and-recovery-acceptance) step 5.

**Option B: new scratch Supabase project (tests Supabase's own backups)**

4. In the dashboard, Database, Backups, use "Restore to a New Project" from the newest backup.
   Check the cost shown before confirming.
5. In the new project, reset the `wardflow_backend` password. Do not point any Railway service at
   it. The current adapters only accept the live project ID, so the app cannot run against it
   without separately approved changes.

**Pass criteria**

- Restore finishes with no errors ignored.
- Every `ward_flow` table has the same row count as step 3.
- The migration ledger matches the live schema version.
- The triggers, functions and check constraints in `ward_flow` match the counts from step 3.
- `audit`, `record_access` and `break_glass` still refuse UPDATE, DELETE and TRUNCATE.
- Row-level security is on for every table.
- Option A: a local backend reads the same workspace revision and board, and a synthetic save,
  reload and stale-revision 409 behave as normal. Option B: `wardflow_backend` can log in.
- Time from start to usable copy is recorded, with the backup's capture time.

**Afterwards**

- Stop local services. Keep the dump private until Josh says otherwise.
- Record date, backup used, timings and each pass or fail in
  [RETENTION-AND-BACKUP.md](RETENTION-AND-BACKUP.md), with no credentials or record contents.
- Deleting a scratch project or dump is Josh's call.

## Contacts

| Role                             | Covers                                                                   |
| -------------------------------- | ------------------------------------------------------------------------ |
| Repository owner                 | Every live change, spending, deleting anything, RPO and RTO choices      |
| Hosting and database maintainer  | Railway and Supabase checks, approved migrations, backups and drills     |
| Application maintainer           | Code fixes, CI failures, revert pull requests, hosted browser acceptance |
| Synthetic test-account owner     | Test accounts, their roles and passwords                                 |
| Records manager, privacy officer | Required before any real data (see RETENTION-AND-BACKUP.md)              |

## Known gaps

- Supabase plan, backup availability and live schema version: **not observed**.
- Hosted browser sign-in, save, reload and conflict: **pending**.
- Hosted restore and app rollback: **never run**.
- Supabase "Allow new users to sign up" was still on when last recorded (19 October 2026).
- The backend trusts all forwarded proxy addresses; recheck before relying on per-address
  sign-in limits ([hosting.md](../hosting.md#shared-backend-and-signed-in-site--16-october-2026)).
