# Supabase and Azure backend presets

Ward Flow uses the same transactional PostgreSQL workspace store and `/v1/workspace` API with either backend. Database and identity selectors are independent. These are the two documented presets:

| Setting                                  | Azure preset                     | Supabase preset                     |
| ---------------------------------------- | -------------------------------- | ----------------------------------- |
| `WARD_DATABASE_PROVIDER`                 | `azure`                          | `supabase`                          |
| `WARD_AUTH_PROVIDER`                     | `entra`                          | `supabase`                          |
| Browser `NEXT_PUBLIC_WARD_AUTH_PROVIDER` | `entra`                          | `supabase`                          |
| Database identity                        | Existing Entra runtime principal | Restricted `wardflow_backend` login |
| Browser sign-in                          | Microsoft                        | Supabase email/password             |

Omitted selectors retain Azure/Entra compatibility. Shared browser operation remains opt-in through `NEXT_PUBLIC_WARD_SHARED_ENABLED=true`. Turning it off preserves the existing synthetic demo without provider requests.

## Supabase setup

Only project `zakzoemeedfepxcstsou` is approved. Its session-pooler host, copied from the owner’s Connect panel, is `aws-0-ap-southeast-2.pooler.supabase.com:5432`, database `postgres`. The runtime username is `wardflow_backend.zakzoemeedfepxcstsou`. The `postgres` administrator is for reviewed migrations only and is refused by the runtime adapter.

1. Inspect the target before applying SQL: schemas, tables, constraints, functions, effective grants, migration versions, existing runtime-role flags/ownership/membership and the nominated Auth account. A matching version alone is insufficient. Stop on incompatible existing objects. The initial execution confirmed an empty `ward_flow` schema and no existing runtime role.
2. Apply `migrations/001-shared-workspace.sql`, `002-workspace-data-mode.sql`, `003-push-subscriptions.sql`, then [runtime grants](infra/supabase-runtime-role.sql) as a separate migration administrator. Repeat the explicit schema/table/function revocations after every later migration. PostgreSQL’s global default function EXECUTE is not removed by a per-schema default privilege revoke; browser schema USAGE remains denied.
3. Assign a random runtime password privately. Keep it, the coordinator UUID and administrator credentials outside Git. Use a private backend environment file based on [the example](infra/supabase-settings.example.env). Download this project’s root certificate from Database Settings → SSL Configuration and set `WARD_SUPABASE_CA_CERT_FILE` to its local path. TLS certificate and hostname verification stay enabled; connection-string SSL overrides are refused.
4. Build the shared engine with `npm --prefix backend/ward-flow run build:engine`. Start from the repository root with `node --env-file=<private-backend.env> backend/ward-flow/server.mjs`. Startup proves `current_user=wardflow_backend`; a migration administrator is never substituted.
5. Configure browser values in untracked `.env.local`: `NEXT_PUBLIC_WARD_SHARED_ENABLED=true`, `NEXT_PUBLIC_WARD_AUTH_PROVIDER=supabase`, `NEXT_PUBLIC_WARD_API_BASE_URL=<local backend origin>`, `NEXT_PUBLIC_WARD_SUPABASE_URL=https://zakzoemeedfepxcstsou.supabase.co`, and the project’s **publishable** key. Never supply a service-role/secret key to the browser. The optional `NEXT_PUBLIC_WARD_COORDINATOR_EMAIL` nominates the local account-creation form; this value is browser-visible and is not an authorisation boundary.
6. Run `npm run ensure`, verify `/api/local-project-id` and its PID/checkout, then use that actual URL in backend `WARD_ALLOWED_ORIGIN` and Supabase Auth’s Site URL/redirect allowlist. The form uses `/mockups/ward-flow` for confirmation/recovery. Keep confirmation enabled and use existing email delivery. The owner enters their password privately. After confirmation, record the verified Supabase user UUID in `WARD_COORDINATOR_USER_IDS` and restart the backend. Only that UUID is granted workspace access; browser roles/email fields cannot grant it.

The small Auth adapter uses Supabase’s supported REST endpoints for password sign-in, user verification, refresh, logout, signup and recovery. It avoids a new dependency/lockfile change. Signup never adopts a session; recovery cannot enter the board until the password update succeeds. The nominated form restricts the local UI, while Supabase’s project-level registration policy is a separate administrator setting. Close public registration after nominated-account provisioning where required; do not claim the browser restriction controls the Auth service.

The shared engine creates a fresh synthetic workspace on its first authorised read. Existing Azure data and browser demonstrations are not imported. Runtime grants preserve append-only command/audit records and exclude DDL. Phone-push routes, tables and outbox remain available; delivery stays off by default and no scheduler is configured.

## Switching providers

1. Finish or abandon pending work and sign out. An already accepted transaction can still commit.
2. Stop the local backend and the owned frontend server. Preserve each provider’s private environment file separately.
3. Select the matching database/Auth/browser preset and its connection, origin and coordinator settings. Rebuild/restart the frontend when changing `NEXT_PUBLIC_*` values.
4. Verify readiness, sign-in and a save/reload before continuing. Changing a preset does not migrate data.

For Azure, follow [the retained shared Azure setup](SETUP-SHARED-AZURE.md). All Azure deployment, Entra, Blob, PostgreSQL, migration and infrastructure code remains available. The original migration CLI is Azure-specific; Supabase migrations use a separate reviewed administrator workflow. Azure access requires signing in again because OAuth caches are excluded from recovery.

## Azure recovery preserved on 11 October 2026

The verified recovery package is outside the checkout at `D:/Repos/ward-flow-logs/backups/azure-supabase-transition-20261011-4378`. Its README and manifest contain the exact bundle/archive filenames, hashes, Azure resource identities and restoration commands. The separate owner-restricted key is at `C:/Users/joshs/.codex/integrations/ward-flow-backup-keys/azure-supabase-transition-20261011-4378.key`. Safeguard the archive and key independently of this Windows profile; keep the key separate from the archive.

Both source histories were restored and checked: baseline `1158c0950871a00f9eae544075d965b6e4f0fcee` and retained Azure branch `5c9c9a6b74c690475e3ea2e4df7ebf9c311d79cc`. All 107 private source files passed authenticated decryption and SHA-256 comparison; the deployment ZIP passed CRC checks. The histories diverge, so do not blindly replay the older Azure branch into this one. Existing Azure worktrees/resources remain intact. This preserves available setup material and dated observations; it is not a fresh cloud-data export or newly verified Azure deployment.
