# Supabase and Azure presets

> [!IMPORTANT]
> **Repository & Data Boundary:** Project `zakzoemeedfepxcstsou` is a **dedicated, isolated Ward Flow synthetic-only Supabase project**. **PsychSift's Supabase project, database, and credentials must never be used in Ward Flow.** Ward Flow's optional shared workspace (`backend/ward-flow/` and `/api/ward-flow/shared/*`) operates exclusively on **100% synthetic data** — zero real patient information (PII/PHI) is permitted.

Ward Flow retains its Azure PostgreSQL/Entra preset and adds an approved Supabase PostgreSQL/Auth preset. Database selectors (`azure`, `supabase`, `postgres`) and identity selectors (`entra`, `supabase`) are independent. Omitted selectors retain Azure/Entra compatibility. The shared engine, `/v1/workspace` paths, snapshots, command receipts, immutable audit and revision conflicts are the same. All data remains synthetic.

Shared mode is opt-in through backend `WARD_SHARED_ENABLED=true` and browser `NEXT_PUBLIC_WARD_SHARED_ENABLED=true`. The synthetic offline demo remains available when browser shared mode is off. Push stays off by default.

## Approved Supabase target

Start with the [empty, non-secret settings template](infra/supabase-settings.template.env), keeping the completed private copy outside Git. Supply runtime connection details and the publishable key privately; no administrator connection belongs in that runtime file.

Only project `zakzoemeedfepxcstsou` is allowed. The direct target is `db.zakzoemeedfepxcstsou.supabase.co:5432/postgres` with login `wardflow_backend`; the session pooler is `aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres` with login `wardflow_backend.zakzoemeedfepxcstsou`. The application refuses the administrator login and connection URL SSL overrides. These source restrictions do not prove a current hosted connection.

Before an authorised administrator operation, inspect the exact target, existing schema definitions, versions, ownership, effective grants, role flags/membership and nominated Auth account. Preserve a recoverable backup. Stop on incompatible existing objects; do not substitute a privileged runtime login.

Apply migrations `001-shared-workspace.sql`, `002-workspace-data-mode.sql`, `003-push-subscriptions.sql` and `004-trigger-search-path.sql` in order through a separate reviewed administrator workflow, then apply [runtime grants](infra/supabase-runtime-role.sql). Runtime startup never migrates and readiness requires migration 4 for every shared preset, including Azure. Repeat explicit schema/table/sequence/function revocations after future migrations. Per-schema function defaults cannot cancel PostgreSQL's global PUBLIC EXECUTE default; browser schema USAGE remains denied. The separate [Supabase helper hardening script](infra/supabase-security-hardening.sql) is optional provider-specific administrator work and refuses an unexpected helper identity. Do not apply it to Azure.

Set the runtime password privately, separate from Git. Use a private backend environment with `WARD_DATABASE_PROVIDER=supabase`, `WARD_AUTH_PROVIDER=supabase`, the shared/prototype selectors, approved project reference/URL, `WARD_SUPABASE_DATABASE_URL`, `WARD_SUPABASE_PUBLISHABLE_KEY`, verified `WARD_COORDINATOR_USER_IDS`, a synthetic `WARD_WORKSPACE_ID` and verified `WARD_ALLOWED_ORIGIN`. Set `WARD_SUPABASE_CA_CERT_FILE` when the project's CA is not already trusted by Node. CA bundles and private files stay outside deployment archives. TLS certificate and hostname verification remain enabled.

The backend uses only a publishable key to verify the sign-in token through the approved Auth service. Service-role and secret keys are refused. The service-returned UUID must be in the explicit coordinator allowlist; browser email, role and signup fields cannot grant access. Verification has a deadline covering both response headers and body reads. Invalid credentials are denied; provider outages return a retryable verification error.

Build the engine and start the backend with the private runtime environment. For the browser set `NEXT_PUBLIC_WARD_AUTH_PROVIDER=supabase`, the actual backend origin in `NEXT_PUBLIC_WARD_API_BASE_URL`, the approved Supabase URL and its publishable key. Never expose administrator/service-role credentials. The optional nominated signup email is a UI restriction, not the Auth service's registration policy. Keep the provider's confirmation/recovery and registration settings under their separate administrator authority.

Run `npm run ensure`, verify `/api/local-project-id` and use that actual frontend origin in the backend and provider allowlists. After separately authorised provider setup, verify authenticated readiness, sign-in, shared save/reload, restart persistence, stale revisions and retries. Offline proof does not establish these live results. No live migration, provider mutation, new paid service or deployment is performed by this source rebuild.

## Switching and recovery

Finish or abandon pending work, sign out and stop owned processes before switching presets. A previously accepted transaction can still commit. Preserve private configurations separately, select matching database/auth/browser settings, rebuild public browser configuration and restart. Switching selectors transfers no records. Azure code and its [administrator guide](SETUP-SHARED-AZURE.md) remain available; its migration CLI is Azure-specific. Generic PostgreSQL setup has its own [administrator and recovery flow](SETUP-POSTGRES.md).

Keep preserved recovery archives and their separate owner-held keys outside the checkout. This guide makes no claim about their current contents, a cloud-data export or a deployed revision. Restoration, data transfer, deployment and provider acceptance each require separate authority and evidence.
