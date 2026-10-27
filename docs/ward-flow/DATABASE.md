# Ward Flow database: the one source of truth

<!-- last-checked: 2026-10-24 -->

_Updated 2026-10-26 - runtime compatibility runs to the latest migration named below; migration grants commit with the schema; Documentation owns._

**Current database and sign-in: Supabase** (decision [D-55](decisions.md), 15 October 2026).

- Project `zakzoemeedfepxcstsou` (Sydney, `ap-southeast-2`), dedicated to Ward Flow and holding
  synthetic data only. Never PsychSift's Supabase project, Railway service or credentials.
- Sign-in is Supabase Auth on the same project. The accounts listed in `WARD_COORDINATOR_USER_IDS`
  are the bootstrap statewide coordinators. From migration 8 any other account needs a role and
  place in `ward_flow.memberships` (see the backend README). From migration 9 cover is a
  membership of its own kind in that table, requests for access have their own
  `ward_flow.access_requests` table, and each phone alert device in `ward_flow.push_subscriptions`
  records the membership that turned it on.
- Migration 11 adds append-only record access history and break glass protection, plus
  server-side session sign-outs. The backend accepts schema versions 5 through
  <!-- fact:latest-migration -->014-archived-records<!-- /fact -->; these
  capabilities require 11 and its runtime grants. Migration 12 adds foreign-key indexes without
  changing runtime behaviour. Migration 13 lets the record access log name a referral's full
  detail (D-80); before it, opening that detail is not logged. The supported bounds come from `MINIMUM_RUNTIME_MIGRATION` and
  `LATEST_MIGRATION` in the migration registry below. See the backend setup guides for rollback limits.
- Plain PostgreSQL (`postgres`) is kept behind the same seam as a fallback. It shares the SQL,
  migrations and runtime-role checks that the Supabase adapter builds on. It is not in use.
- **Azure is retired.** The Azure Functions host, Blob session vault, Azure PostgreSQL and Entra
  sign-in code were removed on 15 October 2026 (D-55). Do not reintroduce them without a new
  decision. Older documents that describe Azure are historical.
- Real patient data still needs separate hosting approval, a privacy impact assessment and
  clinical sign-off. Choosing a provider does not authorise any of that.

This page records the chosen provider. It does not prove the hosted backend is running or
connected. Hosted state is separate evidence.

Other documents may name the provider in passing, but they link here for the project ID,
settings and how to change it. When the database changes, change this page and the decision
log first, then search the docs for the old provider's name and update any passing mention.

## Selecting the Supabase connection

The ChatGPT Supabase account for this repository is named **Ward Flow**. Its organisation is
**Ward Flow**, ID `pacavezehklwafqskucg`. The separately connected **PsychSift** account is outside
this repository's boundary. A browser dashboard session may use a different account from the
connector, so opening the project in a browser is not a connector-access check.

Before using the connector in a new chat or after reconnecting:

1. Inspect the current tool's account choices. Select **Ward Flow** and, when the tool accepts
   `link_id`, pass that account's currently exposed value explicitly on every call. Discover it
   from the tool metadata; do not guess it, copy another account's value or retain a connection
   ID as a permanent project setting. Reconnection can change the available identifiers.
2. Read the project identified above through that connection. Require project name **Ward Flow**,
   project ID `zakzoemeedfepxcstsou` and organisation ID `pacavezehklwafqskucg` to match before
   proceeding. Matching a connection label alone is insufficient. If the tool offers no account
   selector, verify the bound account can read this exact project first.
3. If the account is missing, the identity differs or access is denied, stop the requested
   operation and inspect connection scope. Any diagnostic project/organisation listing must use
   the same selected account where supported and expose only relevant metadata. Do not fall back
   to PsychSift, change permissions or create a replacement project to work around account
   selection. If reconnection or organisation access is needed, have the owner complete that
   authorisation, then repeat the identity check.

This check establishes connector access only. Runtime HTTP allowlisting, synthetic browser
credentials, hosted workflow acceptance and backup/restore evidence are separate requirements.
A successful metadata read or `ACTIVE_HEALTHY` status does not complete those checks. Keep
connection IDs in the current private checkpoint when needed, never credentials in repository
guidance. Fresh tool metadata and the verified project take precedence over a remembered ID.

## Where the provider is chosen

| What                                          | Where                                                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider names, defaults and settings readers | `backend/ward-flow/config.mjs` (`DEFAULT_DATABASE_PROVIDER`, `DEFAULT_AUTH_PROVIDER`, `DATABASE_PROVIDERS`, `AUTH_PROVIDERS`)                                               |
| Adapters for those names                      | `backend/ward-flow/providers.mjs` (`DATABASE_ADAPTERS`, `AUTH_ADAPTERS`)                                                                                                    |
| Supabase adapter                              | `backend/ward-flow/supabase-config.mjs`, `supabase-postgres.mjs`, `supabase-auth.mjs`, `migrate-supabase.mjs`, `infra/supabase-*`                                           |
| Plain PostgreSQL adapter                      | `backend/ward-flow/postgres-config.mjs`, `portable-postgres.mjs`, `migrate-postgres.mjs`, `infra/postgres-*`                                                                |
| Shared workspace store (provider-neutral SQL) | `backend/ward-flow/postgres.mjs`, `records.mjs`, `migrate.mjs`, `migrations.mjs`, `migrations/001` through <!-- fact:latest-migration -->014-archived-records<!-- /fact --> |
| Browser sign-in                               | `src/components/ward-management/use-ward-supabase-shared.ts`, selected by `selectWardAuthProvider` in `ward-shared-access.tsx`                                              |
| Browser security policy                       | `src/lib/security-headers.ts` (`resolveWardAuthProvider`, `resolveSharedWorkspaceOrigins`)                                                                                  |
| Settings templates                            | `backend/ward-flow/.env.example`, `backend/ward-flow/infra/*.env*`, root `.env.example`                                                                                     |
| Tests that cover every registered provider    | `backend/ward-flow/provider-routing.test.mjs`, `tests/ward-auth-provider-parity.test.ts`, `tests/security-headers.test.ts`                                                  |

## Settings

| Setting                          | Values                 | Default    |
| -------------------------------- | ---------------------- | ---------- |
| `WARD_DATABASE_PROVIDER`         | `supabase`, `postgres` | `supabase` |
| `WARD_AUTH_PROVIDER`             | `supabase`             | `supabase` |
| `NEXT_PUBLIC_WARD_AUTH_PROVIDER` | `supabase`             | `supabase` |

Any other value, including the retired `azure` and `entra`, is refused at startup. Set-up steps
are in [the Supabase guide](../../backend/ward-flow/SETUP-SUPABASE.md) and
[the plain PostgreSQL guide](../../backend/ward-flow/SETUP-POSTGRES.md).

## Changing provider later

1. Record a new decision in [decisions.md](decisions.md) that replaces D-55.
2. Database: add a settings reader and an adapter that returns `createPool` and `verifyPool`, then
   register the same name in `DATABASE_PROVIDERS` and `DATABASE_ADAPTERS`. Any PostgreSQL host can
   reuse `postgres.mjs` and the migrations unchanged. A non-PostgreSQL database needs its own
   workspace store with the same methods as `createWorkspaceStore`.
3. Sign-in: add an adapter that returns `createAuthenticator`, register it in `AUTH_PROVIDERS` and
   `AUTH_ADAPTERS`, add the browser hook beside `use-ward-supabase-shared.ts`, update both browser
   selectors and allow the new origins in `resolveSharedWorkspaceOrigins`.
4. Update this page. `provider-routing.test.mjs` runs every registered provider automatically.
5. Moving data is separate. Changing settings never copies records between providers.
