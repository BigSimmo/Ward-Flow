# Ward Flow hosting and database decisions

_Updated 2026-10-21 - public feature-mode and backend build dependencies clarified from source; Documentation owns._

Owner-approved setup record, 27 September 2026. Clarified 2 October 2026.

> This is a dated configuration and evidence record. Hosted resources, credentials, settings,
> deployment were not rechecked during the documentation repair. A read-only GitHub check on 2 October 2026 found Actions enabled and the Ward Flow CI workflow active; that does not establish a passing run or deployment. Verify the
> exact Ward Flow target under the provider-confirmation boundary before acting.

## Boundaries

- Host the synthetic prototype on Railway in its own **Ward Flow** project.
- Connect only `BigSimmo/Ward-Flow`, branch `live` (since 24 October 2026; before that `main`). The daily release workflow moves `live` to CI-passed `main` ([HOW-WE-WORK §4](ward-flow/HOW-WE-WORK.md#4-integration-in-the-dedicated-repository)).
- **Ward Flow must never connect to PsychSift's Supabase or Railway resources**, database, services or credentials.
- For Ward Flow's optional shared prototype workspace (the separate `backend/ward-flow/` server's `/v1/workspace*` routes), it uses Ward Flow's **dedicated synthetic-only Supabase project**, operating exclusively on 100% synthetic data. The current provider and how to change it are recorded in [DATABASE.md](ward-flow/DATABASE.md). No shared backend was created by this initial Railway hosting task; see [the backend guide](../backend/ward-flow/README.md). Those guides do not establish current hosted provider state.
- The default browser-local state is not a shared database. There is no production identity or access-control system for real patients; use invented data only.
- Historical local-only and PsychSift hosting instructions in the imported documents describe the original source checkout. They do not authorise deploying this repository into PsychSift.

## Railway target

| Item           | Value                                                  |
| -------------- | ------------------------------------------------------ |
| Public app     | https://ward-flow-production.up.railway.app/           |
| Project        | `Ward Flow` (`8d748288-549b-4614-a4c3-30d1dbf3081d`)   |
| Environment    | `production` (`c52294d0-9ae8-46bc-b8cb-522d5f703f11`)  |
| Service        | `ward-flow` (`a45ea3c2-cc8d-4d4b-a76d-1c89f5a79896`)   |
| Source         | `BigSimmo/Ward-Flow`, `live` (was `main` until 24 Oct) |
| Runtime region | Singapore (`asia-southeast1-eqsg3a`)                   |
| Networking     | Railway HTTPS domain routed to container port `8080`   |

These identifiers are resource references, not credentials. Check the exact target before making changes. Hosting here does not establish suitability for real clinical data.

## Configuration

Railway service settings hold the build and start commands. Railpack installs the locked dependencies using its default installer; a custom install command caused a missing `/opt/corepack` packaging error and was removed.

- Builder: Railpack, Node `24.19.0`; npm version comes from `packageManager`.
- Build setting: `node --max-old-space-size=8192 node_modules/next/dist/bin/next build --webpack` (includes Next.js type checking).
- Start setting: `node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port $PORT`.
- Variables: `NODE_ENV=production`, `PORT=8080`, `NEXT_PUBLIC_MOCKUPS_ENABLED=true`, `NEXT_PUBLIC_SITE_URL=https://ward-flow-production.up.railway.app`, `RAILPACK_NODE_VERSION=24.19.0`.
- The setup record reported no Supabase, OpenAI or other database/provider credentials for this service. Current settings were not inspected.
- Code, assets, scripts and runtime/build configuration are included in deployment watch paths; documentation-only changes are excluded.
- The setup record reported GitHub Actions disabled and Railway's GitHub integration as the deployment mechanism. A read-only GitHub check on 2 October 2026 found Actions enabled and the dedicated Ward Flow CI workflow active. Current-head outcomes and deployment remain separate evidence.

The source healthcheck endpoint is `/api/health`, returning `{ status: "ok" }` (HTTP 200). It proves liveness only; it does not check database/provider readiness. This source contract is not a fresh hosted observation. Check `/ward-flow` directly after an authorised deployment and distinguish build success from runtime verification.

## Separate drawer preview — 5 October 2026

> **Deleted 19 October 2026.** The owner deleted the `ward-flow-drawer-preview` service, so its
> address below no longer answers. This section is kept as history only.

Owner authorised an additional preview and then requested expedited completion. The existing
`ward-flow` service was preserved. The new `ward-flow-drawer-preview` service
(`5bdb71a8-2399-4d3a-80c1-5e4e6d9cdfc9`) runs in the same Ward Flow project/environment, with
its own domain: https://ward-flow-drawer-preview-production.up.railway.app/ward-flow/delays.
It is pinned to `ea64f464920a699ce5b62988f5589cb33b466d29` on
`codex/drawer-preview-20261005-ea56aa7`; its source tree exactly matches local `ea56aa7`.
Deployment `c1f42ae4-1e1a-4895-8b1c-0b619fce694c` reached `SUCCESS`. The public Delays page
was freshly fetched with HTTP 200 and the title `Delays — Ward Flow`.

This preview uses the recorded build/start commands, port 8080, `/api/health`, and sleeping when
idle. Its five variables enable the synthetic mockups and set the preview origin and runtime.
The selected Railpack runtime was Node 24.21.0. The preceding full unit run passed 10,383 tests;
the production browser run passed 118, skipped one and exposed one Referrals Escape defect.
That defect was corrected, with 37 focused tests, lint/typecheck and its targeted browser
regression passing. Broad gates were not repeated after this final fix at the owner's request.

## Shared backend and signed-in site — 16 October 2026

Owner approved hosting the shared backend (16 October 2026) so live sign-in and saving can be
tested. Two services were added to the same Ward Flow project and environment, Singapore region,
both following `BigSimmo/Ward-Flow` `main` at the time (now `live`). The open public demo (`ward-flow`) is unchanged and
stays in local mode, because shared mode puts a sign-in screen in front of every page.

| Item     | Backend                                                                                                | Signed-in site                                              |
| -------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Service  | `ward-flow-backend` (`e61d6afa-0fe0-48d4-af02-6db904423f97`)                                           | `ward-flow-shared` (`e6b96cb4-a904-4f83-a10c-0a2ee9608457`) |
| Address  | https://ward-flow-backend-production.up.railway.app                                                    | https://ward-flow-shared-production.up.railway.app          |
| Port     | 8080                                                                                                   | 8080                                                        |
| Health   | `/healthz` (no sign-in; always 200, with `database` "ok" or "unavailable", checked at most every 30 s) | `/api/health`                                               |
| Sleeping | Off                                                                                                    | On                                                          |

Backend settings (Railway dashboard):

- Build: `npm ci --prefix backend/ward-flow --include=dev && npm --prefix backend/ward-flow run build:engine`.
- This backend build depends on Railpack's root locked install as well as the backend install:
  `build-engine.mjs` uses the root `tsconfig.json` and bundles source from
  `src/components/ward-management/` and `src/lib/`. Backend typechecking uses the root TypeScript
  installation. The service can still run as a separate Node process.
- Start: `sh -c 'printf "%s\n" "$WARD_SUPABASE_CA_PEM" > /tmp/supabase-ca.pem && exec node backend/ward-flow/server.mjs'`.
  The Supabase pooler certificate chains to the public Supabase Root 2021 CA, which Node does not
  trust by default. The start command writes it from a variable, so no certificate file is in the
  deployment archive.
- Variables: the [Supabase settings template](../backend/ward-flow/infra/supabase-settings.template.env)
  values, with every blank one filled: `WARD_COORDINATOR_USER_IDS` (the coordinator test
  account), `WARD_WORKSPACE_ID` (the shared workspace), `WARD_SUPABASE_PUBLISHABLE_KEY`,
  `WARD_ALLOWED_ORIGIN` set to the signed-in site, `WARD_TRUSTED_PROXY_ADDRESSES=*`,
  `WARD_SUPABASE_CA_CERT_FILE=/tmp/supabase-ca.pem`, `HOST=0.0.0.0` and `PORT=8080`, plus
  `WARD_SUPABASE_CA_PEM`. The backend refuses to start in shared mode if the coordinator or
  workspace id is missing. Phone push is off (no VAPID keys).
  `WARD_SUPABASE_DATABASE_URL` is the restricted `wardflow_backend` session pooler login. Its
  password was set privately by the owner and lives only in Railway.
  The recorded wildcard proxy setting is safe only while ingress overwrites forwarded client
  headers and the backend cannot be reached directly. Reverify those conditions before relying on
  per-address sign-in limits; prefer explicit proxy socket addresses, or no forwarded-header trust
  when unverified. This document does not establish the current deployed ingress boundary.
- Watch paths: `/backend/ward-flow/**`, `/src/components/ward-management/**` and `/src/lib/**`
  (the engine bundles both, including the synthetic-data guard), `/package.json`,
  `/package-lock.json` and `/tsconfig.json`. The list lives in
  [watch-paths.mjs](../backend/ward-flow/watch-paths.mjs), and a backend test fails if the engine
  is built from a file outside it. Change the Railway setting whenever that list changes.

Both services wait for CI: the owner turned on Railway's **Wait for CI** for `ward-flow-backend`
and `ward-flow-shared` on 19 October 2026, so a deploy (now a move of `live`) goes ahead only after its GitHub
checks pass. Still pending, deferred by the owner on 19 October 2026: in Supabase, under
Authentication, then Sign In / Providers, turn off **Allow new users to sign up**, so only invited
accounts can register.

Signed-in site settings: the same build and start commands as `ward-flow`, plus
`NEXT_PUBLIC_WARD_SHARED_ENABLED=true`, `NEXT_PUBLIC_WARD_AUTH_PROVIDER=supabase`, the approved
Supabase URL, `NEXT_PUBLIC_WARD_API_BASE_URL` set to the backend, and
`NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY` as a Railway reference to the backend's
`WARD_SUPABASE_PUBLISHABLE_KEY`, so the key is kept in one place. These are fixed at build time, so
a change needs a rebuild.

The frontend also reads the public build settings `NEXT_PUBLIC_WARD_ENVIRONMENT` and
`NEXT_PUBLIC_WARD_FLAGS` (comma-separated registered `name=on` or `name=off` overrides). If the
feature environment is unset, a non-production `NODE_ENV` uses development defaults and a
`NODE_ENV=production` build uses demo defaults, whether local or hosted. An unnamed production build locks safeguard flags on;
explicit `demo` leaves them switchable on a device. In an explicitly named `production` feature
environment, device choices are ignored and safeguard flags stay on. These settings and their
precedence are source contracts, not observations of current Railway values. Select a feature mode
for each service deliberately, and rebuild to apply a change; the [public frontend template](../backend/ward-flow/infra/frontend.env.example)
lists the settings without selecting a mode for an operator.

Checked 17 October 2026 against the hosted services: the backend's authenticated `/readyz`
answered 200 with the database ready, the coordinator test account signed in, a save moved the
workspace from revision 1 to 2 after a reload, and a second save at the old revision got 409. The
seven other synthetic `@example.test` accounts were given roles through the backend's own access
routes, each for 30 days (bed manager at RPH, the Dabakarn ward, RPH ED, the Midland community
team, transport officer, executive and access admin). The signed-in site answered 200 with a
content security policy naming only the backend and the Supabase project. Signing in through the
signed-in site in a browser was not checked. Railway Singapore is offshore, so this hosting is
for synthetic data only.

## Post-merge verification and recovery

For day-to-day checks, rollback and restore steps, start with the [operations runbook](ward-flow/OPERATIONS-RUNBOOK.md).
The [operations readiness record](ward-flow/operations-readiness.md) records the deployed
revision, browser acceptance status, rollback candidates and isolated-restore procedure. Use it
for current verification work; the dated setup observations above remain historical evidence.

## Known limits

The record reports hosted compilation and TypeScript checks passed during setup on 27 September 2026. This historical evidence does not verify the current head, behaviour suite, browser journeys or clinical governance.

Dependency audit, 4 October 2026: `npm audit --omit=dev` reports 0 vulnerabilities in both the root package and `backend/`. The earlier high-severity advisory for transitive `sharp` is resolved: `sharp` is pinned through an override at 0.35.5. One development-only advisory remains in the full tree, `braces` (GHSA-vfj7-8cjw-p6xm, via `micromatch`). The scanner suggested a semver-major Next lint downgrade, not a verified compatible fix; [dependency advisory maintenance](dependency-security.md) records the current upstream block and review trigger. This is a local audit result, not a hosted or production-readiness verdict.
