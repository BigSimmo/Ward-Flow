# Coordinator-only shared Azure setup

Implementation checkpoint, 7 October 2026: WF-29, WF-33 and WF-57. The owner requested one application role, coordinator, with access to the complete Ward Flow workspace. Each person still signs in with their own Entra account; a configured list assigns the coordinator role. Hospital role tiers can be introduced later.

This is a synthetic demonstration implementation. No live Azure resource was read, created, migrated, connected or deployed by this implementation session. The selected cloud runtime reports no outbound Azure identity, no secrets/runtime bindings and no Azure management or database network access. Both available browser connections report disconnected. Existing repository records establish the Azure Function and Blob service, but do not establish the current PostgreSQL inventory.

## What is implemented

Local recovery update, 9 October 2026: the verified existing server is `wardflow-dev-aue`, with database `wardflow_dev`. The example settings now pin that target, and the runtime refuses `wardflow` on this server. Setup requires an existing server and database by default; missing inventory stops before resource creation. `requireExistingDatabase: false` is reserved for a separately authorised new-resource plan, not this recovery. The new-resource template below remains historical preparation. Windows build paths are supported; packaging requires Python on Windows or `zip` elsewhere.

The original three implementation commits were recovered without publication or deployment. Azure schema, private SQL reachability and a dedicated reader remain unverified. Do not run configure, migrate, provision with resource creation enabled, or deployment commands under the current read-only setup authority. Follow the private recovery checkpoint before any future rollout. The original historical test results below are separate from fresh recovery checks.

- The existing Azure Function gains `/v1/workspace`, `/v1/workspace/commands` and `/v1/workspace/audit`. Its checked-in host configuration has an empty route prefix; the generated frontend base URL is the Function origin. Existing owner-specific Blob sessions remain separate.
- PostgreSQL holds one shared, versioned JSONB workspace, idempotency receipts and append-only audit entries. Named coordinators share the same workspace ID. The server applies the existing domain engine against the latest locked state.
- A stale command returns 409 without overwriting the winner. Successful state, audit and command receipt commit in one transaction. A retry uses the same command ID; reusing an ID for different content is refused.
- Audit identifies the authenticated Entra object ID and effective role `coordinator`, with action, revision, outcome, server commit time and structured domain audit changes. Existing domain roles are workflow perspectives, not access grants. Workflow guards remain effective.
- Microsoft browser sign-in and three-second refresh connect the existing provider to server state. Saves are confirmed only after commit. Uncertain saves retain their command ID for explicit retry. Revoked access clears protected state and removes the board.
- Shared mode does not read/write the browser's demo-state storage. Local demo mode and its typed-text privacy boundary remain unchanged. Shared scenario-file replacement is disabled because it would bypass audited commands.
- Application-level shared state validation checks repatriation in the browser client and backend engine, not through a PostgreSQL schema constraint; direct database writes can bypass it. This does not loosen the browser's prohibition on persisting those records. All entered content must remain invented.
- Database connections use verified TLS and short-lived Entra tokens. The app identity can update workspace state and append/read receipts/audit, but cannot migrate the schema or change/delete audit entries.

## Prototype versus live data

Database connectivity and data mode are separate. Prototype mode uses invented records and can run either locally or in the shared Azure database. Saving prototype data on a real hosted database does not make the records live.

The persistent workspace, command receipts and audit entries carry a `prototype` classification. Migration 2 labels existing synthetic workspaces and prevents changing a workspace's classification. A prototype API filters by that mode before fetching the payload; it refuses to expose a different mode. The client rejects missing or mismatched snapshot provenance. Server configuration and setup accept `WARD_DATA_MODE=prototype` only in this release.

Every Ward Flow screen shows **Data mode: Prototype**, plus whether it is a local demonstration or connected to the shared database. **Hospital records (unavailable)** opens an explanation without contacting another database, changing classification or discarding local drafts. Returning to prototype resumes the same workspace. The control does not grant permission or create a database connection.

Live mode is reserved for real hospital records in a separately commissioned deployment/database and workspace. It requires the health-service approvals, operational clock/source implementation and access/recovery checks described below. Prototype patients must never be copied into a live workspace. The SQL classification reserves the `live` value for a future commissioned adapter; this release never opens it. The mode describes the configured data source, not an automatic detector that can tell whether someone typed a real person's details. Do not enter real patient information into prototype mode.

Migration 2 must run before deploying the updated client. An older backend without snapshot provenance is rejected, rather than silently treated as prototype or live. The first migration remains unchanged; rerunning the runner upgrades schema 1 to 2 and does not erase stored synthetic state or audit history.

Implementation verified on 8 October 2026: 47 backend tests passed with real disposable PostgreSQL; 15 focused frontend/provider/colour tests, source typecheck and scoped ESLint passed. Desktop/mobile Chromium verified the mode controls without page errors or toolbar overflow, and the production Next build passed. The deployment package was regenerated. Live Azure rollout remains blocked by identity/network access from the execution workspace.

For the two current private-network/reader blockers, use [SETUP-MCP-READONLY.md](SETUP-MCP-READONLY.md). It includes the fixed read-only connection/metadata check and keeps migration/deployment separate.

## One settings file

Copy `infra/azure-settings.example.json` to ignored `infra/azure-settings.local.json`, or reuse the existing private settings file on the owner's PC. Keep `dataMode` set to `prototype`, and fill the actual Ward Flow subscription, tenant, coordinator account object IDs and migration administrator identity only after verification. The migration administrator is an Entra database administrator name, not a password. The example pins `serverName: wardflow-dev-aue`, `databaseName: wardflow_dev` and `requireExistingDatabase: true` to reuse the verified development target. Keep the generated workspace UUID stable across restarts and deployments.

The resource group, existing Function and API audience are fixed to Ward Flow. The setup verifies the selected subscription/tenant, the Function's Australian location and managed identity, then inspects PostgreSQL. It does not use PsychSift resources.

The default frontend client is the existing API application ID. Verify that this registration supports a SPA and exposes a v2 `WardFlow.Access` scope. An approved separate SPA client can be set in the settings file, with delegated API permission and required consent. Do not change existing web redirect URIs, secrets or token audiences to make SPA sign-in work.

No secret or access token belongs in the settings file, frontend variables, repository or chat. Follow the cloud runtime's selected outbound identity/CLI profile when running setup; a login in another browser or desktop is not automatically attached to this cloud worker.

## Apply in order

The rollout commands below require separate approval before any provider mutation, migration or deployment. Run from the repository root with Node 24, this repository's locked dependencies, Azure CLI and access to the selected Ward Flow subscription. Build the shared engine before packaging. Packaging uses Python on Windows and `zip` on other systems.

```sh
npm ci
npm --prefix backend/ward-flow ci --ignore-scripts
npm --prefix backend/ward-flow run build:engine
npm --prefix backend/ward-flow run azure:inspect -- /absolute/path/to/azure-settings.local.json
```

Inspection needs only the actual subscription and tenant IDs; role/administrator placeholders may remain until setup. It reports safe resource metadata. If a database already exists, review its hosting, private network, authentication and backup settings; inspection preserves them. Subsequent modes refuse an unsuitable existing database rather than silently replace or open it.

```sh
npm --prefix backend/ward-flow run azure:provision -- /absolute/path/to/azure-settings.local.json
```

Provision reuses the verified existing server and database. With the default `requireExistingDatabase: true`, missing inventory fails before creation. Only a separately approved new-resource plan may explicitly set that flag to false and use `infra/database.bicep`: PostgreSQL 16, Australian region, 32 GB storage, burstable B1ms development compute, 35-day backups, public access disabled, Entra-only authentication, private DNS and a private VNet. Those template values describe historical preparation, not the actual PostgreSQL 18 development server's settings. Existing networks or Function network integration cause a review stop before creating another topology.

Provision writes non-secret `dist/setup/backend.env` and `dist/setup/frontend.env`. These are ignored generated outputs. Existing private networks need a verified `functionSubnetId` in the same VNet as the database; an existing network attachment is never silently switched. The new subnet delegation targets the documented Flex Consumption Function. Another hosting plan needs its appropriate reviewed delegation.

Before enabling shared mode, install the new backend code while keeping `WARD_SHARED_ENABLED=false`:

```sh
npm --prefix backend/ward-flow run package:deployment
az functionapp deployment source config-zip \
  --subscription YOUR_VERIFIED_WARD_FLOW_SUBSCRIPTION \
  --resource-group rg-wardflow-dev-aue \
  --name wardflow-dev-api-aue \
  --src backend/ward-flow/dist/wardflow-backend.zip
```

The archive contains the Function runtime, compiled engine and locked backend dependencies. It excludes `.env`, setup outputs and tests. Flex Consumption deployment must use its supported package deployment; do not set `WEBSITE_RUN_FROM_PACKAGE` as a workaround.

The configuration command must run on a host that can reach the private database, through an authorised VNet-connected runner/VPN or equivalent private connection. Public Azure Cloud Shell does not by itself establish that reachability. A proxy-only HTTP identity is also insufficient for PostgreSQL TCP access.

```sh
npm --prefix backend/ward-flow run azure:configure -- /absolute/path/to/azure-settings.local.json
```

Configure is an administrative mutation, not an inspection or read-only MCP check. It verifies existing Function Entra authentication and identity/storage settings, then applies versioned migrations to the configured database under the nominated administrator and verifies/creates the Function's database principal and grants. The default existing-resource guard forbids creating a missing database. The verified target is `wardflow_dev`. Migration and grant failures remain failures. Configure also attaches the reviewed private network, appends the SPA redirect URI, adds the frontend CORS origin, expands any existing host identity allowlist to include named coordinators, and applies shared settings. Review and approve those exact changes before running it; consent for a separate frontend client is an additional directory step.

Apply the generated `frontend.env` values to the verified frontend service and rebuild it. Next.js public variables are embedded at build time; changing runtime variables alone does not update an already-built client. The Microsoft SPA redirect is exactly `<frontendOrigin>/mockups/ward-flow`.

After deployment, run:

```sh
node backend/ward-flow/azure-setup.mjs verify /absolute/path/to/azure-settings.local.json
```

This authenticates with the coordinator API scope and checks database readiness, effective role, exact workspace ID and audit access. The first authorised workspace GET creates the invented baseline and its audit entry. A health response alone does not establish this integration. Then verify two independent coordinator sessions: shared save/reload, last-bed contention, conflict presentation, explicit lost-response retry and access revocation. Confirm the actual deployed frontend/backend revisions, not only the branch's test result.

## Phone alerts (optional, off by default)

Implementation checkpoint, 10 October 2026 (feature 4). Standard Web Push (VAPID) tells a signed-in coordinator's phone or browser when a new act-now (red) item appears, with Ward Flow closed. No live resource was read, changed or deployed for it.

- **Off unless configured.** The backend sends nothing and registers no timer unless `WARD_SHARED_ENABLED=true` and all three of `WARD_FLOW_VAPID_PUBLIC_KEY`, `WARD_FLOW_VAPID_PRIVATE_KEY` and `WARD_FLOW_VAPID_SUBJECT` are set. Malformed values stop the backend rather than half-working.
- **What triggers a push.** After a command commits, the server engine's act-now list (the same rows the coordinator's Alerts and Tasks show) is compared with the last announced list; only new rows are sent, once each while they stay red. A five-minute timer trigger (`wardFlowPushSweep`) re-checks rows that turn red with time alone, such as a wait passing its target. The account that made the change is not sent its own alert; accounts removed from `WARD_COORDINATOR_OBJECT_IDS` receive nothing.
- **What the phone shows.** "Ward Flow: 2 new act now items", the hospital site (or "2 sites") and "Open Alerts to review. Synthetic demo data." Tapping opens `/mockups/ward-flow/alerts`. No patient name, UMRN, Ward Flow id, diagnosis, alert detail or typed text is sent (D-18).
- **Storage.** Migration 3 adds `ward_flow.push_subscriptions` (browser endpoint and its public encryption keys, owning Entra object ID, created, last success, revoked) and `ward_flow.push_baselines` (the act-now row ids last announced). Endpoints the push service reports gone (404 or 410) are deleted. Only known browser push service hosts are accepted as endpoints.
- **Routes.** `GET /v1/workspace/push-key`, `POST /v1/workspace/push-subscribe` and `POST /v1/workspace/push-unsubscribe`, with the same Microsoft sign-in and coordinator check as the workspace. The existing `v1/workspace/{action}` Function route already covers them.

To turn it on, after separate approval for each provider step:

1. Generate a key pair on a trusted machine, from the repository root: `npm exec --prefix backend/ward-flow --offline -- web-push generate-vapid-keys --json`. Do not paste the private key into chat, the repository or a ticket.
2. Apply migration 3 with the same authorised `azure:configure` (or `migrate.mjs`) run described above; it also grants the backend identity the two new tables. `/readyz` reports the schema unavailable until migration 3 is applied when push is configured.
3. Rebuild the engine and redeploy the backend package (`build:engine`, `package:deployment`, then the `config-zip` deployment above). The package now includes `push.mjs` and the `web-push` dependency.
4. Add the three Function app settings. Prefer a Key Vault reference for the private key:

   ```sh
   az functionapp config appsettings set \
     --subscription YOUR_VERIFIED_WARD_FLOW_SUBSCRIPTION \
     --resource-group rg-wardflow-dev-aue \
     --name wardflow-dev-api-aue \
     --settings WARD_FLOW_VAPID_PUBLIC_KEY=<public key> \
       "WARD_FLOW_VAPID_PRIVATE_KEY=@Microsoft.KeyVault(SecretUri=<secret URI>)" \
       WARD_FLOW_VAPID_SUBJECT=mailto:<monitored address>
   ```

5. On each phone: open the HTTPS frontend, sign in, then Settings, Alerts, **Phone alerts**. On iPhone (iOS 16.4 or later) add Ward Flow to the Home Screen and open it from there first; Safari tabs cannot receive web push.

The frontend's Content-Security-Policy currently sets `connect-src 'self'`. A browser enforcing it refuses the cross-origin calls to the Function (and Microsoft sign-in), for the shared workspace and phone alerts alike, until the Function origin and `https://login.microsoftonline.com` are added through a reviewed `src/lib/security-headers.ts` change. Push delivery itself is between the browser and its push service and does not need a CSP entry.

Removing any one of the three settings turns phone alerts off. Stored subscriptions stay until a person turns the switch off, the push service reports them gone, or they are deleted.

## Local evidence and remaining verification

The focused PostgreSQL test uses an actual local PostgreSQL server and refuses remote database URLs. The backend suite must be run with the compiled engine and a disposable local database. CI supplies PostgreSQL 16 and runs the same integration test inside the blocking static job. The local implementation session used PostgreSQL 18; a hosted CI result has not been observed.

```sh
npm --prefix backend/ward-flow run build:engine
WARD_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/wardflow_test npm --prefix backend/ward-flow test
```

The proof covers two-account contention for the last bed, stable idempotency, changed-content reuse, fresh-store reads, append-only audit protection and rollback when audit insertion fails. Focused frontend tests cover uncertain-save retry, conflicts, access revocation, refresh/dispatch races, server-state adoption without browser persistence and preserving local drafts during updates. Existing demo-provider/privacy/restore tests remain applicable.

Local verification on 7 October 2026: 43 backend tests passed, eight focused frontend/CI tests passed, 52 existing provider/privacy/restore/scenario/audit tests passed, source typecheck and scoped ESLint passed, and the production Next build and offline Bicep compilation passed. System Chromium smoke checks returned HTTP 200 with no page errors; enabling shared mode without configuration hid the board and left browser session storage empty. Six offline setup tests check existing-server reuse, ambiguous inventory, identity mismatch and preserving unsuitable resources/networks. These tests use a fake Azure CLI and make no Azure requests.

Migration SQL and an offline Bicep compilation are not live Azure application evidence. Azure-managed token access, actual private DNS/routing, consent, Easy Auth, deployment, restore and hosted browser journeys remain unverified until the authorised resource checks pass.

The Knip dependency/export check remains red on root-repository findings also reproduced on the unchanged base checkout: `server-only`, `@typescript/typescript6`, `playwright-core`, `tsx`, `sharp`, `parse5` and seven duplicate exports. The added workspace configuration resolves the new nested-backend dependency warnings and recognises the existing root `esbuild` dependency. This is not a full PR-readiness or hosted-CI verdict.

## Before real patient use

Keep the existing D-36/D-37 institutional approvals and MHA advisory limits separate from technical setup. An approved health-service deployment needs privacy/clinical/records review, a commissioned Entra tenant and access process, approved hosting for the whole data path, retention and incident procedures, and a demonstrated recovery plan. The documented Railway frontend is in Singapore; Australian database hosting does not establish approval of that frontend or its logs/support arrangements.

The shared baseline still seeds invented patients and uses a server-owned demonstration clock. Live patient sourcing, accurate operational timestamp semantics and any PAS adapter need their own reviewed implementation. This is not a flag that turns synthetic records into approved clinical data.

For a commissioned production database, review compute, high availability, independent audit integrity/retention, monitoring, backup residency and access, and measured recovery objectives. The current burstable instance and same-region backups are a development baseline. Test backup restore and disaster recovery before claiming readiness. Database audit triggers protect application writes; they do not make the database administrator unable to alter data. An approved immutable audit archive is separate work.

Backend code can support later roles and PAS ingestion without a screen rewrite. The small configuration surface makes hosted synthetic connection straightforward; real clinical commissioning is a separate acceptance milestone.
