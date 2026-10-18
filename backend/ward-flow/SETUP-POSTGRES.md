# Portable PostgreSQL backend

Ward Flow uses Supabase (decision D-55) and keeps this generic PostgreSQL adapter behind the same seam as a fallback. [DATABASE.md](../../docs/ward-flow/DATABASE.md) is the single source of truth for which provider is current and how to change it. Both presets reuse the same engine, shared HTTP paths, synthetic snapshot format, revisions, audit and command receipts. Other database engines require a separately implemented and tested store adapter.

## Administrator prerequisites

Runtime startup never applies migrations. Shared readiness requires migrations **1 through 5** (and accepts later migrations through <!-- fact:latest-migration -->011-record-access-and-sign-out<!-- /fact -->, such as row-level security, prototype-only workspace enforcement, role memberships/break-glass, cover/access requests, records saved one by one and the record access log with sign-outs), including the fixed search paths on the audit and workspace-mode trigger functions and the composite push/command indexes. Keep a new runtime stopped until the schema and runtime grants are ready.

Inspect the exact database target, ownership and contents first. Preserve a recoverable backup before a migration. A matching migration number alone is insufficient. The generic PostgreSQL CLI checks the existing `ward_flow` catalogue and refuses unfamiliar tables, functions, constraints, triggers, sequences, ownership or migration histories. Do not delete an unexpected namespace to make setup pass.

Use a supported PostgreSQL database reserved for synthetic data, with verified TLS and a restricted application login separate from its administrator. Set these values privately:

- `WARD_DATABASE_PROVIDER=postgres`, `WARD_SHARED_ENABLED=true`, `WARD_DATA_MODE=prototype`.
- `WARD_AUTH_PROVIDER=supabase` (the only sign-in provider) with its settings: `WARD_SUPABASE_PROJECT_REF`, `WARD_SUPABASE_URL`, `WARD_SUPABASE_PUBLISHABLE_KEY` and the `WARD_COORDINATOR_USER_IDS` allowlist. Startup refuses the backend without them, even when PostgreSQL is the database.
- `WARD_POSTGRES_DATABASE_URL` for the fixed `wardflow_backend` login and `WARD_POSTGRES_MIGRATION_DATABASE_URL` for a different administrator on the same hostname, port and database.
- `WARD_WORKSPACE_ID` for a synthetic workspace and `WARD_ALLOWED_ORIGIN` for the verified frontend origin.
- `WARD_TRUSTED_PROXY_ADDRESSES` when a proxy sits in front of the backend (`*` on Railway), so sign-in check limits count each client separately.
- `WARD_POSTGRES_CA_CERT_FILE` when the server uses a CA not already trusted by Node.

Use percent-encoded credentials. URL query parameters and fragments are refused because they can override the explicit TLS settings. Certificate and hostname verification remain enabled. The [non-secret configuration template](infra/postgres-settings.example.env) has placeholders only. Keep private files and CA material outside Git and deployment archives.

After separate authority for the chosen target and administrator operation, invoke:

```powershell
node --env-file=C:/private/ward-migration.env backend/ward-flow/migrate-postgres.mjs
```

The CLI preflights the namespace, applies the supported migrations (`001` through <!-- fact:latest-migration -->011-record-access-and-sign-out<!-- /fact -->), then installs [restricted runtime grants](infra/postgres-runtime-role.sql). It creates no database or provider project, transfers no records and runs no deployment. It installs the fixed runtime role without embedding its password. Set the role's password privately with the administrator's `psql` command `\password wardflow_backend`, then put the matching value in the runtime URL. Remove the administrator URL from the runtime environment. To prune `ward_flow.commands` idempotency receipts older than seven days (the CLI uses the fixed `RECEIPT_RETENTION_DAYS` constant in `prune-receipts.mjs` and reads no retention override from the environment) without touching `ward_flow.audit`, run `node --env-file=C:/private/ward-migration.env backend/ward-flow/prune-receipts.mjs postgres` with the private migration environment (or use the npm aliases after exporting the required variables).

Schema migration and role grants are separate transactions. If the grants fail after the schema transaction commits, keep the runtime stopped, inspect the exact administrator failure privately and re-run the same reviewed CLI after correcting it. Supported existing versions are retained and the grant stage can be repeated. Do not roll back data by deleting the namespace or switch to an administrator login for the application. Unknown or incompatible state needs owner review and an authorised recovery from the preserved backup.

## Runtime and acceptance

Build the shared engine with `npm --prefix backend/ward-flow run build:engine`, then start with the private runtime environment:

```powershell
node --env-file=C:/private/ward-runtime.env backend/ward-flow/server.mjs
```

The portable and Supabase presets verify the actual login, flags, memberships, ownership, effective permissions, migration set and guard triggers. They refuse unsafe or unprepared runtimes. Pools use verified TLS, four connections and bounded connection/query timeouts.

After `npm run ensure`, verify `/api/local-project-id` before opening the frontend. Confirm authenticated readiness, shared read/save/reload, stale-revision refusal and retry behaviour for the selected target before relying on it. Offline mocked checks do not establish a hosted connection, local real-database correctness or deployment. Push stays off unless separately configured; this setup does not enable a scheduler.

Changing selectors does not transfer data. Finish or abandon pending work, sign out, stop owned processes, change matching database/auth/browser settings, rebuild public frontend configuration and restart. A previously accepted transaction can still commit. Keep private presets separately. See [Supabase setup](SETUP-SUPABASE.md) and [DATABASE.md](../../docs/ward-flow/DATABASE.md).

## Another database engine

A new trusted server adapter must preserve `ready()`, `read(actorId)`, `command(actorId, commandId, expectedRevision, event)` and `audit()`, plus shutdown/startup cleanup through an owned resource's `end()`. Keep the existing identity verifier and reducer. Preserve optional push methods when enabled.

The adapter must atomically commit state, revision, immutable audit and actor-scoped command receipt, or roll back all of them. It needs workspace locking or equivalent compare-and-swap, expected revisions and payload fingerprints. Identical retries replay the same receipt; changed content under a used command ID is refused. Audit mutation and workspace reclassification must be denied in storage. The audit API returns the latest 200 prototype records in descending sequence.

Before enabling another engine, test its actual disposable database for contention, stale revisions, retry/idempotency, changed payloads, rollback, reconnect persistence, audit/provenance guards, restricted permissions and lifecycle. PostgreSQL JSONB, advisory locks and PL/pgSQL are not portable SQL for MySQL, SQL Server, SQLite or MongoDB.
