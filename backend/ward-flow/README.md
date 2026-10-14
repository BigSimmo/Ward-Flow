# Ward Flow development backend

> [!IMPORTANT]
> **Repository & Provider Boundary:** **Ward Flow must never connect to PsychSift's Supabase or Railway resources.** For Ward Flow's optional shared prototype workspace (`backend/ward-flow/` and the configured `/v1/workspace*` backend routes), it uses either its **dedicated Ward Flow synthetic-only Supabase project (`zakzoemeedfepxcstsou`)** or its **dedicated Ward Flow Azure Functions / PostgreSQL backend**, operating exclusively on 100% synthetic data. Never enter or upload real patient information.

The shared synthetic workspace supports independent database (`WARD_DATABASE_PROVIDER`: `supabase` [default] | `postgres` | `azure`) and identity (`WARD_AUTH_PROVIDER`: `supabase` [default] | `entra`) selectors. Node (`server.mjs`) and Azure Functions (`function.mjs`) use the same backend factory (`providers.mjs`). See [Supabase/Azure presets](SETUP-SUPABASE.md), [PostgreSQL setup and recovery](SETUP-POSTGRES.md), [shared Azure setup](SETUP-SHARED-AZURE.md), and [read-only MCP database access](SETUP-MCP-READONLY.md). Runtime never auto-migrates or substitutes an administrator. **Every shared preset requires schema migration version `5` (`001` through `005`) before `/readyz` readiness**, including existing Azure installations. These source files do not establish a current hosted connection or deployment.

## How the UI connects (`local` mode vs shared workspace)

- **Default in-browser mode (`local`):** By default (`NEXT_PUBLIC_WARD_SHARED_ENABLED` unset or `false`), the Next.js app runs entirely in-browser using synthetic state persisted to `sessionStorage` in `src/components/ward-management/ward-flow-provider.tsx`. Saving to `sessionStorage` stops for the rest of the session once typed free text is dispatched (owner decision D-18), and refusal records are never stored.
- **Opt-in shared workspace mode (`shared`):** When `WARD_SHARED_ENABLED=true` and `NEXT_PUBLIC_WARD_SHARED_ENABLED=true` are configured, the Next.js UI connects to the shared workspace via `src/components/ward-management/ward-shared-client.ts`, `src/components/ward-management/use-ward-supabase-shared.ts`, and `src/components/ward-management/ward-shared-access.tsx` (talking to the configured backend base URL at `/v1/workspace`, `/v1/workspace/commands`, `/v1/workspace/audit`, and `/v1/workspace/push-*`).
- **Dormant owner-private Blob snapshot API (`/v1/sessions/:uuid`):** In the `azure` database preset, this package also retains the earlier owner-private Azure Blob Storage session snapshot store (`wflowdev7273a083aue`, `database.mjs`, client in `src/lib/cloud-scenario-vault.ts`). Only that legacy per-owner Blob snapshot vault remains dormant and disconnected from the active screens; the shared PostgreSQL/Supabase workspace is wired into the UI behind the opt-in shared-mode flags.

## Package file and migration inventory

- **Documentation & runbooks:**
  - `README.md` — package overview, architecture, and local test commands
  - `SETUP-SUPABASE.md` — dedicated Ward Flow synthetic Supabase (`zakzoemeedfepxcstsou`) and Azure preset guide
  - `SETUP-SHARED-AZURE.md` — coordinator-only shared Azure PostgreSQL (`wardflow-dev-aue` / `wardflow_dev`), Entra sign-in, and Web Push guide
  - `SETUP-POSTGRES.md` — portable PostgreSQL setup, migration preflight, and recovery guide
  - `SETUP-MCP-READONLY.md` — private VNet and least-privilege Entra read-only database verification runbook
- **Runtime, providers & HTTP handlers:**
  - `config.mjs` — environment configuration and allowlist validation (`WARD_DATABASE_PROVIDER`: `supabase` [default] | `postgres` | `azure`; `WARD_AUTH_PROVIDER`: `supabase` [default] | `entra`)
  - `providers.mjs` — lazy backend factory wiring the selected database pool, runtime-role verifier, authenticator, shared workspace store, and optional Web Push sender
  - `server.mjs`, `function.mjs`, `function-runtime.mjs`, `host.json` — standalone Node HTTP server and Azure Functions v4 entry points (`/healthz`, `/readyz`, `/v1/workspace*`, `/v1/sessions/:uuid`, and `wardFlowPushSweep` timer)
  - `shared-http.mjs` — shared workspace HTTP handler (`/v1/workspace`, `/v1/workspace/commands`, `/v1/workspace/audit`, `/v1/workspace/push-*`)
  - `engine.ts` & `build-engine.mjs` — shared Ward Flow domain reducer/validator compiled to `dist/engine.mjs`
  - `push.mjs` — optional Web Push (VAPID) notification builder and sender for act-now alerts
- **Database & authentication adapters:**
  - `postgres.mjs`, `postgres-config.mjs`, `postgres-preflight.mjs` — shared PostgreSQL workspace store, CAS/idempotency/audit transactions, schema readiness (`version = 5`), and catalogue preflight
  - `portable-postgres.mjs` — generic TLS PostgreSQL pool and runtime-role privilege verifier (`postgres` preset)
  - `supabase-config.mjs`, `supabase-postgres.mjs`, `supabase-auth.mjs` (and `supabase-bootstrap.mjs` / `infra/supabase-*.sql` helpers) — dedicated Ward Flow Supabase (`zakzoemeedfepxcstsou`) pool, runtime-role verifier, and Auth token verifier (`supabase` preset)
  - `database.mjs`, `auth.mjs` — Azure Blob Storage snapshot adapter (`wflowdev7273a083aue`) and Entra v2 JWT verifier (`azure` / `entra` presets)
- **Setup, migration & packaging CLIs:**
  - `migrate-supabase.mjs`, `migrate-postgres.mjs`, `migrate.mjs` — schema migration and runtime-role runners for Ward Flow Supabase (`zakzoemeedfepxcstsou`), portable PostgreSQL, and Azure Entra
  - `azure-setup.mjs`, `az-command.mjs` — Azure CLI inspection, provisioning, configuration, and verification helpers
  - `package-deployment.mjs` — builds the deployment zip archive (`dist/wardflow-backend.zip`)
- **Versioned SQL migrations (`migrations/`, all 5 required for `/readyz`):**
  - `migrations/001-shared-workspace.sql` — `ward_flow` schema, `migrations`, `workspaces`, `commands`, and append-only `audit` tables (`001`–`004` also correspond to `004_ward_flow_shared_workspace.sql` in earlier notes)
  - `migrations/002-workspace-data-mode.sql` — `data_mode` (`prototype` | `live`) column and reclassification-prevention trigger
  - `migrations/003-push-subscriptions.sql` — `push_subscriptions`, `push_baselines`, and `push_deliveries` tables for Web Push alerts
  - `migrations/004-trigger-search-path.sql` — hardens `search_path = pg_catalog, ward_flow` on `ward_flow` trigger functions (`schema.sql` at the package root is unapplied historical Blob-era scaffolding)
  - `migrations/005-retention-and-indexes.sql` — adds composite active push subscription index (`push_subscriptions_actor_active`) and chronological command receipt index (`commands_workspace_committed`)
- **Infrastructure templates (`infra/`):**
  - `infra/azure-settings.example.json`, `infra/database.bicep`, `infra/frontend.env.example`
  - `infra/postgres-settings.example.env`, `infra/postgres-runtime-role.sql`
  - `infra/supabase-settings.template.env`, `infra/supabase-runtime-role.sql`, `infra/supabase-security-hardening.sql`
  - `infra/verify-reader.sql` (also referenced as `003_ward_flow_mcp_readonly_role.sql` in read-only role runbooks)

## Boundaries

- The Azure Functions host is `wardflow-dev-api-aue` in `rg-wardflow-dev-aue`.
  Its existing Entra authentication requires Josh's identity. The API also
  verifies the v2 access token, tenant, audience, `WardFlow.Access` scope and owner/coordinator allowlist.
- In the `azure` preset, the Function's existing managed identity accesses a private blob container in
  its existing storage account (`wflowdev7273a083aue`) for `/v1/sessions/:uuid`, and connects to Azure Database for PostgreSQL (`wardflow-dev-aue` / `wardflow_dev`) for `/v1/workspace*`.
  No storage key or password is stored in the backend.
- The root `schema.sql` remains unapplied historical Blob-era scaffolding
  and is not used by runtime. The shared workspace adapter uses `postgres.mjs`, versioned `migrations/` (`001` through `004`), and
  `migrate-supabase.mjs` / `migrate-postgres.mjs` / `migrate.mjs`.
- Each Blob session has an owner UUID and a revision. `PUT` uses an expected revision;
  a stale save returns `409` and does not replace the current blob.
- The API accepts only the `synthetic` classification (`WARD_DATA_MODE=prototype`). This label and basic
  shape checks do **not** establish that arbitrary JSON is truly synthetic.
  Keep this service limited to invented demonstration content and do not treat
  it as approved clinical storage.

## Local checks

From the repository root, `npm run test:backend` runs the focused API tests without connecting
to Azure or Supabase. From `backend/ward-flow/`, the equivalent command is `npm test`; root `npm test`
instead runs the UI repository's unit suite. The backend package accepts Node `>=22`, while
the root toolchain requires Node `>=24.15.0 <25` and npm `11.x`.
Copy `.env.example` to an ignored `.env` only for local use;
never add access tokens or passwords to it. Local calls to Azure Storage need
an Azure identity with data access to the existing account.

The Azure Functions v4 entry point is `function.mjs` with `host.json` at the
package root. Deploy a package of this folder to the existing Flex Consumption
host; do not set `WEBSITE_RUN_FROM_PACKAGE`. Keep the current host authentication
configuration and use the existing system identity and storage account.

## Snapshot contract and local hardening (8 October 2026)

These changes are local source changes, not evidence of a deployment or a working
hosted configuration. Authentication and owner-private paths remain unchanged.
They do not provide shared clinical operation or service-scoped permissions.

- `GET /v1/sessions/:uuid` returns a positive integer revision, object payload
  and valid UTC `updated_at` timestamp. Invalid stored envelopes fail closed
  with a generic `503`; neither reads nor mutations repair or overwrite them.
  Existing records without retry receipts remain valid.
- `PUT` requires JSON `{ classification: "synthetic", expectedRevision, payload }`.
  The expected revision starts at zero for creation. Blob ETags guard the write;
  conflicting updates return `409`. Revisions are bounded to 2,147,483,646.
- A caller may additionally send a UUID `requestId`. Keep the same UUID,
  expected revision and exact serialized payload for a retry after an
  unconfirmed response. The receipt and SHA-256 payload digest are stored in the
  same conditional write. An identical retry of the latest mutation returns its
  already committed revision without another write. A different body/revision
  using that UUID conflicts. After an intervening mutation, reload and reconcile;
  this is not an unlimited receipt history or automatic retry policy.
- `DELETE /v1/sessions/:uuid` requires JSON `{ expectedRevision }` for an existing
  session and the same owner authentication. It returns `204`, `409` for a stale
  revision, or `404` if absent. The conditional write removes the current payload
  and receipt, leaving only revision, timestamp and a deletion marker. Reads then
  return `404`; the UUID is permanently retired and saves conflict, including
  revision-zero recreation. This prevents old revision-one writes overwriting a
  newly recreated session. Repeating deletion at the deleted revision is safe.
  Create a fresh UUID for a new session.
- Deletion does not claim to remove Azure soft-deleted copies, blob versions,
  backups or logs. Their configuration and approved retention remain unverified.
  No automatic retention interval or physical tombstone purge is configured;
  physical removal would require a separate anti-recreation lineage control.
- API responses include a generated `X-Request-ID`. JSON diagnostics contain only
  event, generated request ID, route category, method category, status, outcome
  category and duration. They exclude owner/session identifiers, raw URLs,
  payloads, tokens and exception text. Adapter failures have the same generic
  response and a request ID. Logger failures cannot change the API outcome.
  Hosted log collection, access, alerting and retention still need verification.

The dormant `src/lib/cloud-scenario-vault.ts` client validates save/load/readiness
responses and supports conditional deletion. `CloudRequestOptions` allows a
caller cancellation signal, an optional stable save request ID, and a 1–60,000 ms
deadline (default 10 seconds) covering both fetch and body parsing. Timeout or
cancellation is an **unconfirmed** operation, not proof that a server write was
rolled back. Reload/reconcile before repeating a change, or retry the latest
save with its retained receipt inputs. The client rejects redirects, endpoint
credentials/query/hash and remote HTTP; loopback HTTP is allowed for local tests.
HTTPS syntax is not an endpoint approval or origin allowlist: the future UI must
use the owner-approved Ward Flow endpoint and configure its CSP explicitly.

Run `npm --prefix backend/ward-flow test` from the repository root for synthetic
HTTP/storage/authentication tests, including CAS races, receipt retries, malformed
records, deletion and redacted diagnostics. Run
`npx vitest run tests/cloud-scenario-vault.test.ts` for mocked client
validation, deadlines, cancellation and deletion; no live Azure call is needed.
