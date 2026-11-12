# Settings and secrets inventory

_Created 2026-11-10 - audit item M54 (sources A47, A48, C39). Drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`). Documentation owns._

**Status:** draft, built offline from the code. **Not yet checked against what each service
holds.** Nobody has opened Railway, GitHub or Supabase settings for this list. No value is written
here, and none may ever be.

`tests/ward-audit-m54-settings-inventory.test.ts` fails when the code or a workflow reads a setting
that is not in a table below, so the list cannot fall behind the code.

## What a person still has to do

1. **Fix the uptime token name (needs Josh).** The audit found the backend service holds the
   uptime token under a misspelt name, so the backend reads no `WARD_FLOW_UPTIME_TOKEN`, refuses
   the monitor's header and the uptime job's database check never runs. In Railway, on the
   backend service, add the variable with the exact name `WARD_FLOW_UPTIME_TOKEN` and the same
   value as the GitHub secret of that name, then remove the misspelt one. Then run the
   **Backend uptime** workflow once and check its log says the database was checked. Record the
   date below. The code side already matches: `backend/ward-flow/server.mjs` reads
   `WARD_FLOW_UPTIME_TOKEN` and `.github/workflows/backend-uptime.yml` sends that secret.
2. **Check each table against the service (needs Josh's yes: a read-only provider look).** Tick
   the last column. Any setting a service holds that is not listed here is either added or
   removed.
3. **Record the proxy addresses the backend trusts (audit M53).** Today the backend is set to
   `WARD_TRUSTED_PROXY_ADDRESSES=*` ([hosting](../../hosting.md)), which trusts any forwarding
   header. Write Railway's edge addresses here, or the reason `*` stays, before real users
   (D-97 item 6).
4. **Rotation.** Rotate a secret when someone with access leaves, on any suspected exposure,
   before real data, and otherwise once a year. Each rotation needs Josh's yes at the time.

## Web app (Railway web service)

| Setting                                     | Secret | Purpose                                                                                    | Read by                                | Checked on service |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------ |
| `NEXT_PUBLIC_DEMO_MODE`                     | No     | Public demo switch                                                                         | `src/instrumentation.ts`               |                    |
| `NEXT_PUBLIC_SITE_URL`                      | No     | The site's own address                                                                     | `src`                                  |                    |
| `NEXT_PUBLIC_WARD_API_BASE_URL`             | No     | Backend address for the shared workspace                                                   | `src`                                  |                    |
| `NEXT_PUBLIC_WARD_AUTH_PROVIDER`            | No     | Sign-in provider (blank means Supabase, D-55)                                              | `src/lib/security-headers.ts`          |                    |
| `NEXT_PUBLIC_WARD_COORDINATOR_EMAIL`        | No     | Bootstrap coordinator sign-in hint                                                         | `src/components/ward-management`       |                    |
| `NEXT_PUBLIC_WARD_DATA_MODE`                | No     | Data mode; drafts are kept only in `prototype`                                             | `ward-session-drafts.ts`               |                    |
| `NEXT_PUBLIC_WARD_DEMO_URL`                 | No     | Link to the public demo                                                                    | `src`                                  |                    |
| `NEXT_PUBLIC_WARD_ENVIRONMENT`              | No     | Which environment flags apply                                                              | `ward-feature-flags.ts`                |                    |
| `NEXT_PUBLIC_WARD_FLAGS`                    | No     | Feature flags                                                                              | `ward-feature-flags.ts`                |                    |
| `NEXT_PUBLIC_WARD_OPEN_SIGNUP`              | No     | Whether the front door offers sign-up                                                      | `front-door/use-front-door-auth.ts`    |                    |
| `NEXT_PUBLIC_WARD_SHARED_ENABLED`           | No     | Shared workspace switch                                                                    | `src`                                  |                    |
| `NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY` | No     | Supabase publishable key (public by design)                                                | `ward-auth-session.ts`                 |                    |
| `NEXT_PUBLIC_WARD_SUPABASE_URL`             | No     | Supabase project address                                                                   | `ward-auth-session.ts`                 |                    |
| `NEXT_PUBLIC_WARD_SUPPORT_EMAIL`            | No     | Report-a-problem support address                                                           | `help/ward-help-report.ts`             |                    |
| `WARD_FRONT_DOOR`                           | No     | Front door (pass) switch                                                                   | `src/proxy.ts`, `api/session/route.ts` |                    |
| `WARD_DEMO_CODE`                            | Yes    | The demo code people type at the front door                                                | `src/lib/front-door-pass.ts`           |                    |
| `WARD_PASS_SECRET`                          | Yes    | Signs the `wf_pass` cookie                                                                 | `src/lib/front-door-pass.ts`           |                    |
| `WARD_TRUSTED_PROXY_ADDRESSES`              | No     | Demo-code try limit: only `*` applies here; an IP list is ignored with one warning (D-147) | `src/lib/demo-code-tries.ts`           |                    |
| `SENTRY_DSN`                                | Yes    | Server error reporting, off when blank                                                     | `src/lib/sentry-server.ts`             |                    |
| `SENTRY_ENVIRONMENT`                        | No     | Label on error reports                                                                     | `src/lib/sentry-server.ts`             |                    |
| `SENTRY_ENABLE_LOGS`                        | No     | Sends warn and error log lines to Sentry Logs unless `false`                               | `src/lib/sentry-server.ts`             |                    |
| `SENTRY_RELEASE`                            | No     | Release label on error reports                                                             | `src/lib/sentry-server.ts`             |                    |
| `SUPABASE_SERVICE_ROLE_KEY`                 | Yes    | **Must never be set on the web app.** Read only to refuse it                               | `src/instrumentation.ts`               |                    |

## Backend (Railway backend service)

| Setting                                | Secret | Purpose                                                                                 | Read by                  | Checked on service |
| -------------------------------------- | ------ | --------------------------------------------------------------------------------------- | ------------------------ | ------------------ |
| `WARD_ALLOWED_ORIGIN`                  | No     | The one browser origin the API answers                                                  | `config.mjs`             |                    |
| `WARD_AUTH_PROVIDER`                   | No     | Sign-in provider                                                                        | `config.mjs`             |                    |
| `WARD_COORDINATOR_USER_IDS`            | No     | Bootstrap coordinator account ids                                                       | `config.mjs`             |                    |
| `WARD_COORDINATOR_UNTIL`               | No     | When bootstrap coordinator access ends                                                  | `auth.mjs`, `config.mjs` |                    |
| `WARD_DATABASE_PROVIDER`               | No     | Supabase or Postgres                                                                    | `config.mjs`             |                    |
| `WARD_DATA_MODE`                       | No     | Must be `prototype`; anything else refuses to start (GNG C6)                            | `config.mjs`             |                    |
| `WARD_FLOW_UPTIME_TOKEN`               | Yes    | Lets the uptime job see the database answer on `/healthz`                               | `server.mjs`             |                    |
| `WARD_FLOW_VAPID_PRIVATE_KEY`          | Yes    | Signs phone alerts                                                                      | `push.mjs`               |                    |
| `WARD_FLOW_VAPID_PUBLIC_KEY`           | No     | Phone alert public key                                                                  | `push.mjs`               |                    |
| `WARD_FLOW_VAPID_SUBJECT`              | No     | Contact the push services see                                                           | `push.mjs`               |                    |
| `WARD_POSTGRES_CA_CERT_FILE`           | No     | Database certificate path                                                               | `postgres-config.mjs`    |                    |
| `WARD_POSTGRES_DATABASE_URL`           | Yes    | Runtime database connection (holds a password)                                          | `postgres-config.mjs`    |                    |
| `WARD_POSTGRES_MIGRATION_DATABASE_URL` | Yes    | Migration connection (holds a password)                                                 | `migrate-postgres.mjs`   |                    |
| `WARD_RESTORE_MARKER`                  | No     | New value after each database restore, so open tabs reload the restored board (drill 4) | `config.mjs`             |                    |
| `WARD_SHARED_DEMO_EVENTS`              | No     | Whether demo controls work in the shared workspace                                      | `config.mjs`             |                    |
| `WARD_SHARED_ENABLED`                  | No     | Shared workspace switch                                                                 | `config.mjs`             |                    |
| `WARD_SUPABASE_CA_CERT_FILE`           | No     | Database certificate path                                                               | `supabase-config.mjs`    |                    |
| `WARD_SUPABASE_DATABASE_URL`           | Yes    | Runtime database connection (holds a password)                                          | `supabase-config.mjs`    |                    |
| `WARD_SUPABASE_MIGRATION_DATABASE_URL` | Yes    | Migration connection (holds a password)                                                 | `migrate-supabase.mjs`   |                    |
| `WARD_SUPABASE_PROJECT_REF`            | No     | The approved Supabase project                                                           | `supabase-config.mjs`    |                    |
| `WARD_SUPABASE_PRUNE_DATABASE_URL`     | Yes    | Receipt pruner connection (holds a password)                                            | `prune-receipts.mjs`     |                    |
| `WARD_SUPABASE_PUBLISHABLE_KEY`        | No     | Supabase publishable key                                                                | `supabase-config.mjs`    |                    |
| `WARD_SUPABASE_URL`                    | No     | Supabase project address                                                                | `supabase-config.mjs`    |                    |
| `WARD_TRUSTED_PROXY_ADDRESSES`         | No     | Proxies whose forwarding headers are trusted (today `*`, see M53)                       | `config.mjs`             |                    |
| `WARD_WORKSPACE_ID`                    | No     | Which shared workspace row                                                              | `config.mjs`             |                    |
| `SENTRY_DSN`                           | Yes    | Backend error reporting, off when blank                                                 | `error-report.mjs`       |                    |
| `SENTRY_ENVIRONMENT`                   | No     | Label on error reports                                                                  | `error-report.mjs`       |                    |
| `SENTRY_RELEASE`                       | No     | Release label on error reports                                                          | `error-report.mjs`       |                    |

## GitHub repository secrets and variables

| Setting                              | Secret | Purpose                                   | Used by workflow     | Checked on service |
| ------------------------------------ | ------ | ----------------------------------------- | -------------------- | ------------------ |
| `WARD_FLOW_UPTIME_TOKEN`             | Yes    | Must equal the backend's value            | `backend-uptime.yml` |                    |
| `WARD_FLOW_MONITOR_EMAIL`            | Yes    | Synthetic monitor account sign-in         | `backend-uptime.yml` |                    |
| `WARD_FLOW_MONITOR_PASSWORD`         | Yes    | Synthetic monitor account sign-in         | `backend-uptime.yml` |                    |
| `WARD_FLOW_SUPABASE_PUBLISHABLE_KEY` | No     | Publishable key for the monitor's sign-in | `backend-uptime.yml` |                    |
| `WARD_SUPABASE_PRUNE_DATABASE_URL`   | Yes    | Receipt pruner connection                 | `prune-receipts.yml` |                    |
| `WARD_RELEASE_PAUSED` (variable)     | No     | Pauses the daily release                  | `daily-release.yml`  |                    |

## Set by the platform or used only locally and in CI

Not held as service settings by us, listed so the test can tell them from a missing setting:
`ANALYZE`, `HOST`, `NEXT_BUILD_CPUS`, `NEXT_DIST_DIR`, `NEXT_RUNTIME`, `NEXT_TSCONFIG_PATH`,
`NODE_ENV`, `PATH`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_OFFLINE_MODE`, `PORT`,
`RAILWAY_ENVIRONMENT`, `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_GIT_COMMIT_SHA`,
`RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_REPLICA_ID`, `WARD_GATE_BUILD`, `WARD_PG_BIN`,
`WARD_TEST_DATABASE_URL`.

## Rotation record

Newest first. Write the setting's name, never its value.

| Date | Setting | Why (leaver, exposure, before real data, yearly) | Josh's yes (date) | Done by (role) |
| ---- | ------- | ------------------------------------------------ | ----------------- | -------------- |
|      |         |                                                  |                   |                |

## Uptime check after the token fix

| Date | Workflow run shows database checked? | Checked by (role) |
| ---- | ------------------------------------ | ----------------- |
|      |                                      |                   |
