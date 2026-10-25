# Ward Flow backend

_Updated 2026-10-24 - local-mode saving brought into line with D-72; Documentation owns._

> [!IMPORTANT]
> Synthetic data only. The current database and sign-in provider, and how to change it, are
> recorded in one place: [docs/ward-flow/DATABASE.md](../../docs/ward-flow/DATABASE.md). Ward Flow
> must never connect to PsychSift's Supabase or Railway resources.

This package is the optional shared synthetic workspace. It is a plain Node HTTP server
(`server.mjs`) that serves `/healthz`, `/readyz` and `/v1/workspace*`. `/healthz` needs no sign-in,
always answers 200 while the server runs, and reports `database` as `ok` or `unavailable` (never the
reason) from a check it repeats at most every 30 seconds; the uptime workflow alerts on either. The provider is chosen by
`WARD_DATABASE_PROVIDER` and `WARD_AUTH_PROVIDER` (see DATABASE.md). Runtime never migrates the
database and never substitutes an administrator login. Shared readiness requires migrations `001`
to `005` and accepts later versions through <!-- fact:latest-migration -->014-archived-records<!-- /fact -->.
These source files do not establish a current hosted connection or deployment.

## How the UI connects

- **Local mode (default):** with `NEXT_PUBLIC_WARD_SHARED_ENABLED` unset or `false`, the app runs
  in the browser on synthetic state in `sessionStorage` (`ward-flow-provider.tsx`). After typed
  text is dispatched it saves a scrubbed copy with typed values removed, and stops saving only if
  a safe copy cannot be made (D-72, which replaced D-18's stop).
- **Shared mode (opt in):** with `WARD_SHARED_ENABLED=true` and
  `NEXT_PUBLIC_WARD_SHARED_ENABLED=true`, the UI signs in through `use-ward-supabase-shared.ts`
  and talks to this backend's `/v1/workspace`, `/v1/workspace/commands`, `/v1/workspace/audit`
  and `/v1/workspace/push-*` routes through `ward-shared-client.ts`.

## Roles and places (migrations 8 and 9)

- Sign-in proves only who the account is. The server decides who each account is working as on
  every request, from its own record, never from the browser or the sign-in token. Accounts in `WARD_COORDINATOR_USER_IDS` are the
  bootstrap statewide coordinators. Every other account needs an active membership in
  `ward_flow.memberships`: a role, a place and an end date.
- An account with more than one role sends `X-Ward-Working-As` (a membership ID, or `bootstrap`).
  Without it the server answers 409 `choose-role` with up to 20 choices (plus `bootstrap`). The
  app shows a role picker, keeps the chosen membership ID in that tab's session storage and offers
  Switch role. A header naming a role that has ended is answered with the choices again.
- Every reply is cut to that desk's place with `scopeWardFlowState`, the same rule the screens
  use: the snapshot, the poll and every command reply. A command is refused (422, `code: "scope"`)
  when its type is not the desk's own or it names a record outside the desk's place. The audit
  row names the sender's role and place.
- `GET /v1/workspace/audit` is the statewide coordinator's. An access admin reads role changes
  inside their own place only. Everyone else gets 403.
- `GET /v1/workspace/access` and `POST /v1/workspace/access/grant`, `/approve` and `/revoke` are
  for the access admin and the statewide coordinator. Nobody grants themselves a role or one wider
  than their own, and every role has an end date. All granted roles work immediately, including
  existing coordinator and access-admin grants with no approval record (D-66). Each change is
  audited. The legacy `/approve` route returns 422 without changing approval history.
- `POST /v1/workspace/break-glass` (`patientId`, `reason`) opens one patient's record, read only,
  for a ward, ED, community team or bed manager, for the time in the clinical values module. Each
  opening is kept in `ward_flow.break_glass` and audited, and more than the set number in one shift
  is marked as a pattern.
- From migration 9, `GET` and `POST /v1/workspace/access/cover` list cover and let a
  coordinator, nurse in charge or ED clinician give cover of one ward or ED for one shift at most.
  An account with no role may hold one open `POST /v1/workspace/access/request`, and an access admin answers
  it with `/access/decide`. Before 9 these routes answer 409 and say migration 9 is not applied.
- Phone alerts: before 9 they stay with the bootstrap statewide coordinators. From 9 each device
  records the membership that turned it on, and alerts reach bed managers, nurses in charge and ED
  clinicians for their own place, cover included.

## Files

- Guides: `SETUP-SUPABASE.md` (current provider), `SETUP-POSTGRES.md` (plain PostgreSQL fallback).
- Provider seam: `config.mjs` (provider names, defaults and settings validation) and
  `providers.mjs` (adapters and startup).
- HTTP: `server.mjs` (server, readiness, shutdown and the five-minute phone push sweep) and
  `shared-http.mjs` (workspace routes). `error-report.mjs` sends optional scrubbed failure reports.
- Domain: `engine.ts`, built to `dist/engine.mjs` by `build-engine.mjs`. `push.mjs` builds and
  sends Web Push act-now alerts.
- Store: `postgres.mjs` (workspace store, revisions, receipts, audit and push state), `records.mjs`
  (how a workspace is split into one row per record from migration 10, and when a save clashes),
  `postgres-preflight.mjs` (catalogue preflight before migrations), `migrate.mjs` (migrations in
  order) and `migrations.mjs` (the one migration list, latest version and file checksums; a new
  migration is one entry there plus its SQL file).
- Traffic: the 3 second poll sends `?since=<revision>`, and an unchanged workspace answers with its
  revision and clock only. A command queued behind others asks for `reply: "revision"`, so its
  accepted reply has no snapshot. The saved workspace keeps the newest 1,000 audit entries (plus
  any an audit review names); the `audit` table keeps every one. A changed workspace is still sent
  whole to each desk on its next poll; only saving is per record (migration 10). A member desk
  also sends `&context=<hash>`, its last full read's access context: while its role, place, cover
  and openings are unchanged it gets the same cheap answer, without the records being read or
  locked. It leaves the context out once a minute and reads in full, because what a desk may see
  also changes with time. JSON replies of 1 KB or more are gzipped when the browser accepts it.
  Measured on the seed data (19 October 2026): a statewide full read is 363 KB (29 KB gzipped), a
  one-ward desk's 35 KB (5 KB gzipped), and an unchanged poll about 360 bytes. A ward desk open for
  an 8-hour shift reads in full at most 480 times instead of 9,600 (audit F-04).
- Commands (`command-schemas.ts`): every command needs a known type, its sender's own allowed role
  (never defaulted) and bounded plain JSON; the core bed-flow commands also have zod field schemas.
- Demo controls (advance clock, reset or set scenario) are refused on the shared workspace unless
  `WARD_SHARED_DEMO_EVENTS=true`.
- `prune-receipts.mjs` (`npm run prune:receipts:supabase` or `npm run prune:receipts:postgres`): removes
  command receipts older than 7 days by the database clock. It runs with the migration identity,
  because the runtime role cannot delete receipts.
- Checks: `npm test` (set `WARD_TEST_DATABASE_URL` to a loopback PostgreSQL for the real-database
  cases) and `npm run typecheck` (`// @ts-check` on every backend module, using the root install).
- Supabase adapter: `supabase-config.mjs`, `supabase-postgres.mjs`, `supabase-auth.mjs`,
  `migrate-supabase.mjs`, `infra/supabase-settings.template.env`, `infra/supabase-runtime-role.sql`
  and the optional `infra/supabase-security-hardening.sql`.
- Plain PostgreSQL adapter: `postgres-config.mjs`, `portable-postgres.mjs` (TLS pool and the
  runtime-role checks that Supabase also uses), `migrate-postgres.mjs`,
  `infra/postgres-settings.example.env` and `infra/postgres-runtime-role.sql`.
- `auth.mjs`: the shared `VerifierUnavailableError` (a sign-in outage returns 503, a bad token 401)
  and `VerifierRateLimitedError` (too many sign-in checks from one address returns 429).
- Sign-in checks (`supabase-auth.mjs`): a token's finite expiry, optional finite not-before and issuer are checked here,
  then its signature against Supabase's published keys (cached 10 minutes, never used once older).
  A signed token naming a key that is not in the current list is refused here. Any other token
  without a usable published key (a legacy shared-secret token, no key ID, an unsupported or
  unreadable key, or while the keys cannot be read) goes to Supabase's `/auth/v1/user`, limited to 30 checks a minute per client address and 300 in
  total. Each account named by a role holder's token takes at most 10 of the 300, then shares the 30 left for
  accounts with no role, so forged tokens naming one real account cannot use up the checks other desks need.
  A confirmed token is reused for a minute. The client address is the socket's, or
  `X-Real-IP` (else the last `X-Forwarded-For` entry) only when the socket is listed in `WARD_TRUSTED_PROXY_ADDRESSES`
  (`*` is safe only after verifying that every connection passes through an ingress that
  overwrites these headers; the hosting provider's name alone does not establish that boundary).
  Prefer an explicit proxy socket allowlist; leave it empty when that boundary is unverified. A locally
  verified token's signature remains valid until it expires. Separately, from migration 11 the
  workspace checks server-side sign-outs on subsequent requests and refuses the signed-out
  session before token expiry. Before 11 that workspace revocation is unavailable.
  Sign-out refuses subsequent requests; it does not cancel an operation already authorised and
  in flight. Role changes serialize with full-board reads and commands through the workspace
  lock. Audit/access/cover helper reads may finish using the authority resolved when their request
  began. Do not interpret sign-out or revocation as cancellation of every in-flight response.
  Use migration 11 or later when server-side sign-out and access-history guarantees are required;
  older schemas remain rollback compatibility, not evidence that those capabilities are present.
- Browser settings template: `infra/frontend.env.example`.
- Migrations (`/readyz` needs 1 to 5, and accepts later versions through <!-- fact:latest-migration -->014-archived-records<!-- /fact -->):
  - `001-shared-workspace.sql`: `ward_flow` schema, migrations, workspaces, commands and append-only audit.
  - `002-workspace-data-mode.sql`: `data_mode` column and a trigger that blocks reclassification.
  - `003-push-subscriptions.sql`: push subscriptions, baselines and deliveries.
  - `004-trigger-search-path.sql`: fixed `search_path` on trigger functions.
  - `005-retention-and-indexes.sql`: active push subscription and command receipt indexes.
  - `006-row-level-security.sql`: row-level security on every table, with one policy that lets
    only the `wardflow_backend` login see or write rows. The table owner is unaffected, so later
    migrations and receipt pruning still work. The backend runs on 5 or 6, so it can deploy
    before this migration is applied to a live database. `infra/rollback-006-row-level-security.sql`
    takes a database back to 5 in one transaction. The preflight and the runtime check refuse a
    database whose row-level security does not match its version.
  - `007-prototype-only.sql`: workspaces allow `data_mode = 'prototype'` only, since Ward Flow is
    synthetic only (D-55). It stops before changing anything if any workspace is labelled live.
    `infra/rollback-007-prototype-only.sql` restores the old check.
  - `008-role-access.sql`: memberships and break glass records, and audit rows that name every
    role and its place. Before 8 only the bootstrap accounts can sign in.
    `infra/rollback-008-role-access.sql` takes a database back to 7, and refuses once any audit row
    names a role other than coordinator or a place narrower than statewide, because audit rows are
    never removed or changed.
  - `009-access-cover-requests.sql`: cover of a second ward or ED as its own kind of membership
    (it ends by itself, at most the clinical values module's cover length), requests for access
    from an account with no role, when each role was last used (a role not used for the set time
    switches off), and phone alerts by role and place. Cover counts as a role holder for the
    sign-in allowance, because it is a membership. A request is not a role, so the account that
    asks stays in the no-role allowance. Granting, approving, removing, cover, answering a request
    and break glass need a sign-in within the step-up window, or the server answers `step-up`.
    `infra/rollback-009-access-cover-requests.sql` ends all cover, turns off membership phone
    alerts and takes a database back to 8.
  - `010-workspace-records.sql`: each referral, bed (ward), movement, patient, admission and every
    other list or map entry is its own row in `ward_flow.workspace_records`, with the workspace
    revision at which its content last changed. Existing workspaces are moved across in the same
    transaction, so either every record moves or nothing changes. A save writes only the rows it
    changed. A save sent against an older revision still applies when nobody else has changed a
    record it changes or names since then; otherwise it is refused (409, "Someone else changed this
    record first"). Before 10, any change refuses every save made against an older revision.
    `infra/rollback-010-workspace-records.sql` puts every record back in the workspace row and takes
    a database back to 9. Deploy the backend first: one that only knows 9 refuses a database at 10.
  - `011-record-access-and-sign-out.sql`: append-only patient/movement record access history,
    append-only protection for break glass rows and server-side session sign-outs. The
    `/v1/workspace/record-access` and `/v1/workspace/sign-out` routes use these capabilities;
    before 11 record opens are not logged and sign-out does not revoke the session here.
    `infra/rollback-011-record-access-and-sign-out.sql` returns the schema to 10, dropping the
    record access and sign-out tables and removing break glass edit protection. Preserve any
    required record access history first. Apply it only with separate authority, in one
    stop-on-error transaction; it takes the migration lock itself. Reapply runtime grants after 11.
  - `012-foreign-key-indexes.sql`: an index for each of the 13 foreign keys that had none (the
    Supabase advisor's finding). Indexes only: no table, row, grant or policy changes. Each plain
    `CREATE INDEX` blocks writes to its table while it builds; at prototype sizes that is well under
    a second, so apply it at a quiet time rather than mid-demonstration.
    `infra/rollback-012-foreign-key-indexes.sql` takes a database back to 11. Reapply runtime
    grants after 12.
  - `013-referral-record-views.sql`: the record access log also takes `referral`, so opening a
    referral's full detail is logged as a record view (role access plan v2, D-80). No row, grant or
    policy changes. Before 13 a referral opening is not logged.
    `infra/rollback-013-referral-record-views.sql` takes a database back to 12, and refuses once a
    referral opening has been logged, because the log is append-only. Reapply runtime grants after 13.
  - `014-archived-records.sql`: closed movements, referrals and alerts older than 30 days leave the
    live workspace for `archived_records` (Josh, 25 Oct 2026, after the stress test's size finding).
    The backend looks every 20 saves, and on every save once the workspace passes 6 MiB, and logs
    `ward_backend_workspace_size_warning` past 6 MiB. A record any live record still names stays
    live. History reads the archive through `GET /v1/workspace/archive` (newest 5,000, scoped to
    the desk as its live workspace is). `infra/rollback-014-archived-records.sql` puts the current
    generation's archived records back first, then drops the table. Reapply runtime grants after 14.
    The backend accepts versions 5 to 14.

## Boundaries

- The API accepts only the `synthetic` classification and `WARD_DATA_MODE=prototype`. These
  labels and shape checks do not prove that arbitrary JSON is synthetic. Do not treat this
  service as approved clinical storage.
- Request logs carry only event, generated request ID, route category, method category, status,
  outcome category and duration. They never carry tokens, user IDs, URLs, payloads or exception
  text. HTTP, push and store failures share bounded error-name and protocol-code fields; unknown
  values fall back to `Error` without copying exception text. Logger failures cannot change the
  API result.
- Optional Sentry error reporting (`error-report.mjs`) is off unless `SENTRY_DSN` is set. It sends
  only the fixed failure name and those same error-name and code fields, at most once every five
  minutes per failure kind. `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` are optional labels.
- Configured PostgreSQL lock/query deadline failures return `503 storage_unavailable`; other
  query/code faults remain `500`. A failed migration rollback preserves the original exception
  and removes the failed connection from the pool.

## Local checks

The backend has its own package and lockfile, but its engine build is coupled to this repository's
root source and TypeScript configuration: `build-engine.mjs` bundles `engine.ts` with the root
`tsconfig.json`, and backend `npm run typecheck` invokes the root TypeScript installation. Install
both locked dependency sets from the repository root (`npm ci`, then
`npm ci --prefix backend/ward-flow`) before those checks. This build contract does not require the
running HTTP server and the frontend to share a process or Node version. Before changing an engine
import or moving its source, compare the bundle inputs with [backend watch paths](watch-paths.mjs);
the dated [hosting record](../../docs/hosting.md) lists deployment settings, not proof of their
current provider state.

From the repository root, `npm run test:backend` builds the engine and runs backend tests offline.
From `backend/ward-flow/`, run `npm run build:engine && npm test`. The real-PostgreSQL tests run only
when `WARD_TEST_DATABASE_URL` points at a disposable database (CI provides one). The backend
accepts Node `>=22`; the root toolchain requires Node `>=24.15.0 <25` and npm `11.x`. Copy
`.env.example` to an ignored `.env` for local use only and never add passwords or tokens to Git.
