# Ward Flow database: the one source of truth

**Current database and sign-in: Supabase** (decision [D-55](decisions.md), 15 October 2026).

- Project `zakzoemeedfepxcstsou` (Sydney, `ap-southeast-2`), dedicated to Ward Flow and holding
  synthetic data only. Never PsychSift's Supabase project, Railway service or credentials.
- Sign-in is Supabase Auth on the same project. The accounts listed in `WARD_COORDINATOR_USER_IDS`
  are the bootstrap statewide coordinators. From migration 8 any other account needs a role and
  place in `ward_flow.memberships` (see the backend README). From migration 9 cover, requests for
  access and phone alerts by role are held there too.
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

## Where the provider is chosen

| What                                          | Where                                                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Provider names, defaults and settings readers | `backend/ward-flow/config.mjs` (`DEFAULT_DATABASE_PROVIDER`, `DEFAULT_AUTH_PROVIDER`, `DATABASE_PROVIDERS`, `AUTH_PROVIDERS`)     |
| Adapters for those names                      | `backend/ward-flow/providers.mjs` (`DATABASE_ADAPTERS`, `AUTH_ADAPTERS`)                                                          |
| Supabase adapter                              | `backend/ward-flow/supabase-config.mjs`, `supabase-postgres.mjs`, `supabase-auth.mjs`, `migrate-supabase.mjs`, `infra/supabase-*` |
| Plain PostgreSQL adapter                      | `backend/ward-flow/postgres-config.mjs`, `portable-postgres.mjs`, `migrate-postgres.mjs`, `infra/postgres-*`                      |
| Shared workspace store (provider-neutral SQL) | `backend/ward-flow/postgres.mjs`, `migrate.mjs`, `migrations/001` to `009`                                                        |
| Browser sign-in                               | `src/components/ward-management/use-ward-supabase-shared.ts`, selected by `selectWardAuthProvider` in `ward-shared-access.tsx`    |
| Browser security policy                       | `src/lib/security-headers.ts` (`resolveWardAuthProvider`, `resolveSharedWorkspaceOrigins`)                                        |
| Settings templates                            | `backend/ward-flow/.env.example`, `backend/ward-flow/infra/*.env*`, root `.env.example`                                           |
| Tests that cover every registered provider    | `backend/ward-flow/provider-routing.test.mjs`, `tests/ward-auth-provider-parity.test.ts`, `tests/security-headers.test.ts`        |

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
