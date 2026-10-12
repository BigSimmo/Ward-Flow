# Portable Ward Flow backend

The shared workspace supports PostgreSQL-compatible hosts through configuration. Azure PostgreSQL/Entra and the approved Supabase database/Auth presets remain available. The reducer, API paths, snapshots, revision conflicts, audit records and command receipts are shared across these presets. All operation remains synthetic-only.

This is PostgreSQL-host portability. MySQL, SQL Server, SQLite, MongoDB and other engines require an implementation of the store contract below and their own conformance proof. PostgreSQL SQL, JSONB, advisory locks and PL/pgSQL migrations cannot be used unchanged on those engines. Compatibility with a particular managed host must be verified there before use; no additional hosted database was connected during this implementation.

## Configure a PostgreSQL host

1. Use a supported PostgreSQL installation with verified TLS and a database reserved for the synthetic application. Keep an administrator identity separate from the app's restricted login. Inspect the target and back up any existing contents before applying migrations.
2. Create a private environment file from [the PostgreSQL example](infra/postgres-settings.example.env). Set `WARD_DATABASE_PROVIDER=postgres` and independently select `WARD_AUTH_PROVIDER=supabase` or `entra`. Supabase Auth retains the existing approved project/UUID allowlist; Entra uses the documented existing tenant/audience/coordinator settings. A database selector never grants workspace access.
3. Set `WARD_POSTGRES_DATABASE_URL` for the restricted login and `WARD_POSTGRES_MIGRATION_DATABASE_URL` for the administrator, on the same hostname, port and database. The supported setup CLI installs the fixed `wardflow_backend` role. Use percent-encoded passwords, explicit usernames and database names, and no URL query parameters. Set `WARD_POSTGRES_CA_CERT_FILE` when a private CA is needed; omit it for a server with a CA already trusted by Node. Certificate and hostname verification remain enabled. URL SSL overrides can replace node-postgres TLS configuration, so the parser rejects them: [node-postgres TLS guidance](https://node-postgres.com/features/ssl).
4. Invoke the administrator workflow explicitly from the repository root:

   ```powershell
   node --env-file=C:/private/ward-migration.env backend/ward-flow/migrate-postgres.mjs
   ```

   It checks the existing `ward_flow` namespace before mutation, refuses unknown objects or incompatible definitions/ownership, applies only supported migrations, and installs [restricted runtime grants](infra/postgres-runtime-role.sql). An existing migration number alone is insufficient. It does not drop data, create a database/project, import records or run automatically during app startup. Unknown or incompatible namespaces require owner review; do not delete them to make setup pass.

5. Set the runtime role's password privately using the administrator's `psql` session and `\password wardflow_backend`. Put the same password in the private runtime URL. Remove the migration administrator URL from the app's environment file. Custom role names are supported by runtime validation but need separately reviewed matching grants; the setup CLI deliberately uses the fixed application role.
6. Build the engine with `npm --prefix backend/ward-flow run build:engine`, then start:

   ```powershell
   node --env-file=C:/private/ward-runtime.env backend/ward-flow/server.mjs
   ```

   Startup verifies the actual database role, flags, ownership, narrow permissions, migration set and audit/provenance triggers. It refuses administrator credentials, missing/incompatible schemas and unsafe privileges. Connections have bounded connect/query timeouts and max four pooled connections. Neither Azure storage nor its credential factory is initialised for the portable preset.

7. Keep the browser configured for the selected identity preset, shared mode and the actual backend origin. Run `npm run ensure`, verify `/api/local-project-id`, sign in privately, and check authenticated `/readyz`, save/reload and a revision conflict before relying on a new host. Both Node and Azure Functions use the same backend factory. Hosting authentication/network policies still need provider-specific review; a local import test does not establish a deployment.

The first authorised read creates a fresh synthetic workspace through the engine. Presets do not transfer data. Push delivery stays disabled unless its existing explicit configuration is supplied; migrations preserve the subscriptions and outbox, and no live scheduler was enabled by this work.

## Changing providers

Finish or abandon pending work, sign out, stop the backend and owned frontend, select matching database/auth/browser settings, rebuild the public frontend configuration and restart. Check readiness and save/reload. Keep each private preset separately. An already accepted transaction may commit after sign-out. Data transfer and provider deployment are separate operations.

For retained providers, use [Supabase/Azure presets](SETUP-SUPABASE.md) and [Azure setup](SETUP-SHARED-AZURE.md). The verified Azure recovery ZIP remains the immutable 11 October snapshot at `D:/Repos/ward-flow-logs/backups/Ward-Flow-Azure-Recovery-20261011.zip`; the portable continuation is saved in this branch's subsequent commits. Preserve the ZIP and its separate key independently.

## Adapter contract for another database engine

Implement a trusted server-side shared-store factory, then register it in the backend factory and configuration selector. Keep the existing HTTP handler, identity verifier and reducer. An adapter must provide:

| Interface                                              | Required behaviour                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ready()`                                              | Refuse an unsupported schema/guard configuration.                                                                                    |
| `read(actorId)`                                        | Initialise at most once with attributed audit; return the existing prototype snapshot shape and reject incompatible persisted state. |
| `command(actorId, commandId, expectedRevision, event)` | Validate/apply the trusted engine and atomically write state, immutable audit and receipt. Return the existing status/body contract. |
| `audit()`                                              | Return the latest 200 prototype audit records in descending sequence.                                                                |
| Resource lifecycle                                     | Provide an owned resource with `end()` for shutdown and startup-failure cleanup.                                                     |
| Optional push group                                    | Preserve `pushEnabled`, `subscribe`, `unsubscribe`, `pushStatus` and `sweepPush`, including device ownership, outbox and retries.    |

The adapter must enforce workspace locking or equivalent compare-and-swap, expected revisions, actor-scoped command-ID uniqueness and payload fingerprints. Retrying the same command must replay its receipt; changed content under a used ID must be refused. State, revision, audit and receipt must commit together or all roll back. Audit mutation and workspace reclassification must be denied at storage level. Do not expose credentials or grant browser clients direct store access.

Before enabling an engine, run its actual disposable-database tests for contention, stale revisions, idempotency, changed-ID payload refusal, rollback, reconnect persistence, immutable audit, provenance, restricted privileges and lifecycle. Mocked SQL or a successful connection alone does not prove those guarantees. Provider-backed acceptance remains distinct from offline and local database proof.
