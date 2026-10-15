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
- Checks: `npm test` (set `WARD_TEST_DATABASE_URL` to a loopback PostgreSQL for the real-database
  cases) and `npm run typecheck` (`// @ts-check` on every backend module, using the root install).
- Supabase adapter: `supabase-config.mjs`, `supabase-postgres.mjs`, `supabase-auth.mjs`,
  `migrate-supabase.mjs`, `infra/supabase-settings.template.env`, `infra/supabase-runtime-role.sql`
  and the optional `infra/supabase-security-hardening.sql`.
- Plain PostgreSQL adapter: `postgres-config.mjs`, `portable-postgres.mjs` (TLS pool and the
  runtime-role checks that Supabase also uses), `migrate-postgres.mjs`,
  `infra/postgres-settings.example.env` and `infra/postgres-runtime-role.sql`.
- `auth.mjs`: the shared `VerifierUnavailableError` (a sign-in outage returns 503, a bad token 401).
- Browser settings template: `infra/frontend.env.example`.
- Migrations (all five required for `/readyz`):
  - `001-shared-workspace.sql`: `ward_flow` schema, migrations, workspaces, commands and append-only audit.
  - `002-workspace-data-mode.sql`: `data_mode` column and a trigger that blocks reclassification.
  - `003-push-subscriptions.sql`: push subscriptions, baselines and deliveries.
  - `004-trigger-search-path.sql`: fixed `search_path` on trigger functions.
  - `005-retention-and-indexes.sql`: active push subscription and command receipt indexes.

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
