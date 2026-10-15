# Ward Flow backend

> [!IMPORTANT]
> Synthetic data only. The current database and sign-in provider, and how to change it, are
> recorded in one place: [docs/ward-flow/DATABASE.md](../../docs/ward-flow/DATABASE.md). Ward Flow
> must never connect to PsychSift's Supabase or Railway resources.

This package is the optional shared synthetic workspace. It is a plain Node HTTP server
(`server.mjs`) that serves `/healthz`, `/readyz` and `/v1/workspace*`. The provider is chosen by
`WARD_DATABASE_PROVIDER` and `WARD_AUTH_PROVIDER` (see DATABASE.md). Runtime never migrates the
database and never substitutes an administrator login. Shared readiness requires migrations `001`
to `005`. These source files do not establish a current hosted connection or deployment.

## How the UI connects

- **Local mode (default):** with `NEXT_PUBLIC_WARD_SHARED_ENABLED` unset or `false`, the app runs
  in the browser on synthetic state in `sessionStorage` (`ward-flow-provider.tsx`). Saving stops
  for the rest of the session once typed free text is dispatched (D-18).
- **Shared mode (opt in):** with `WARD_SHARED_ENABLED=true` and
  `NEXT_PUBLIC_WARD_SHARED_ENABLED=true`, the UI signs in through `use-ward-supabase-shared.ts`
  and talks to this backend's `/v1/workspace`, `/v1/workspace/commands`, `/v1/workspace/audit`
  and `/v1/workspace/push-*` routes through `ward-shared-client.ts`.

## Roles and places (migration 8)

- Sign-in proves only who the account is. The server decides who each account is working as on
  every request, from its own record, never from the browser or the sign-in token. Accounts in `WARD_COORDINATOR_USER_IDS` are the
  bootstrap statewide coordinators. Every other account needs an active membership in
  `ward_flow.memberships`: a role, a place and an end date.
- An account with more than one role sends `X-Ward-Working-As` (a membership ID, or `bootstrap`).
  Without it the server answers 409 `choose-role` with the choices. The picker in the app is not
  built yet.
- Every reply is cut to that desk's place with `scopeWardFlowState`, the same rule the screens
  use: the snapshot, the poll and every command reply. A command is refused (422, `code: "scope"`)
  when its type is not the desk's own or it names a record outside the desk's place. The audit
  row names the sender's role and place.
- `GET /v1/workspace/audit` is the statewide coordinator's. An access admin reads role changes
  inside their own place only. Everyone else gets 403.
- `GET /v1/workspace/access` and `POST /v1/workspace/access/grant`, `/approve` and `/revoke` are
  for the access admin and the statewide coordinator. Nobody grants themselves a role or one wider
  than their own, every role has an end date, and a coordinator or access admin role waits for a
  second person to approve it. Each change is audited.
- `POST /v1/workspace/break-glass` (`patientId`, `reason`) opens one patient's record, read only,
  for a ward, ED, community team or bed manager, for the time in the clinical values module. Each
  opening is kept in `ward_flow.break_glass` and audited, and more than the set number in one shift
  is marked as a pattern.
- Phone alerts stay with the bootstrap statewide coordinators.

## Files

- Guides: `SETUP-SUPABASE.md` (current provider), `SETUP-POSTGRES.md` (plain PostgreSQL fallback).
- Provider seam: `config.mjs` (provider names, defaults and settings validation) and
  `providers.mjs` (adapters and startup).
- HTTP: `server.mjs` (server, readiness, shutdown and the five-minute phone push sweep) and
  `shared-http.mjs` (workspace routes).
- Domain: `engine.ts`, built to `dist/engine.mjs` by `build-engine.mjs`. `push.mjs` builds and
  sends Web Push act-now alerts.
- Store: `postgres.mjs` (workspace store, revisions, receipts, audit and push state),
  `postgres-preflight.mjs` (catalogue preflight before migrations), `migrate.mjs` (migrations in
  order) and `migrations.mjs` (the one migration list, latest version and file checksums; a new
  migration is one entry there plus its SQL file).
- Traffic: the 3 second poll sends `?since=<revision>`, and an unchanged workspace answers with its
  revision and clock only. A command queued behind others asks for `reply: "revision"`, so its
  accepted reply has no snapshot. The saved workspace keeps the newest 1,000 audit entries (plus
  any an audit review names); the `audit` table keeps every one.
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
- Sign-in checks (`supabase-auth.mjs`): a token's expiry and issuer are checked here,
  then its signature against Supabase's published keys (cached 10 minutes, never used once older).
  A signed token naming a key that is not in the current list is refused here. Any other token
  without a usable published key (a legacy shared-secret token, no key ID, an unsupported or
  unreadable key, or while the keys cannot be read) goes to Supabase's `/auth/v1/user`, limited to 30 checks a minute per client address, 30 per account and 300 in
  total, and a confirmed token is reused for a minute. The client address is the socket's, or
  `X-Real-IP` (else the last `X-Forwarded-For` entry) only when the socket is listed in `WARD_TRUSTED_PROXY_ADDRESSES`
  (`*` on Railway, which is reachable only through its proxy). A locally
  verified token stays valid until it expires, even after sign-out.
- Browser settings template: `infra/frontend.env.example`.
- Migrations (`/readyz` needs 1 to 5, and accepts 6 to 8):
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

## Boundaries

- The API accepts only the `synthetic` classification and `WARD_DATA_MODE=prototype`. These
  labels and shape checks do not prove that arbitrary JSON is synthetic. Do not treat this
  service as approved clinical storage.
- Request logs carry only event, generated request ID, route category, method category, status,
  outcome category and duration. They never carry tokens, user IDs, URLs, payloads or exception
  text. Logger failures cannot change the API result.

## Local checks

From the repository root, `npm run test:backend` runs the backend tests offline. From
`backend/ward-flow/`, run `npm run build:engine && npm test`. The real-PostgreSQL tests run only
when `WARD_TEST_DATABASE_URL` points at a disposable database (CI provides one). The backend
accepts Node `>=22`; the root toolchain requires Node `>=24.15.0 <25` and npm `11.x`. Copy
`.env.example` to an ignored `.env` for local use only and never add passwords or tokens to Git.
