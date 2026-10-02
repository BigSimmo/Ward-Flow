# Ward Flow hosting and database decisions

Owner-approved setup record, 27 September 2026. Clarified 2 October 2026.

> This is a dated configuration and evidence record. Hosted resources, credentials, settings,
> deployment were not rechecked during the documentation repair. A read-only GitHub check on 2 October 2026 found Actions enabled and the Ward Flow CI workflow active; that does not establish a passing run or deployment. Verify the
> exact Ward Flow target under the provider-confirmation boundary before acting.

## Boundaries

- Host the synthetic prototype on Railway in its own **Ward Flow** project.
- Connect only `BigSimmo/Ward-Flow`, branch `main`.
- Do not connect Ward Flow to Supabase or reuse PsychSift's database, services or credentials.
- Azure is the owner's chosen backend platform. No Azure backend was created by this hosting task;
  later work is described in [the backend guide](../backend/ward-flow/README.md). The guide does not establish
  current provider state or UI integration.
- The current browser-local state is not a shared database. There is no production identity or access-control system for real patients; use invented data only.
- Historical local-only and PsychSift hosting instructions in the imported documents describe the original source checkout. They do not authorise deploying this repository into PsychSift.

## Railway target

| Item           | Value                                                 |
| -------------- | ----------------------------------------------------- |
| Public app     | https://ward-flow-production.up.railway.app/          |
| Project        | `Ward Flow` (`8d748288-549b-4614-a4c3-30d1dbf3081d`)  |
| Environment    | `production` (`c52294d0-9ae8-46bc-b8cb-522d5f703f11`) |
| Service        | `ward-flow` (`a45ea3c2-cc8d-4d4b-a76d-1c89f5a79896`)  |
| Source         | `BigSimmo/Ward-Flow`, `main`                          |
| Runtime region | Singapore (`asia-southeast1-eqsg3a`)                  |
| Networking     | Railway HTTPS domain routed to container port `8080`  |

These identifiers are resource references, not credentials. Check the exact target before making changes. Hosting here does not establish suitability for real clinical data.

## Configuration

Railway service settings hold the build and start commands. Railpack installs the locked dependencies using its default installer; a custom install command caused a missing `/opt/corepack` packaging error and was removed.

- Builder: Railpack, Node `24.19.0`; npm version comes from `packageManager`.
- Build setting: `node --max-old-space-size=8192 node_modules/next/dist/bin/next build --webpack` (includes Next.js type checking).
- Start setting: `node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port $PORT`.
- Variables: `NODE_ENV=production`, `PORT=8080`, `NEXT_PUBLIC_MOCKUPS_ENABLED=true`, `NEXT_PUBLIC_SITE_URL=https://ward-flow-production.up.railway.app`, `RAILPACK_NODE_VERSION=24.19.0`.
- The setup record reported no Supabase, Azure, OpenAI or other database/provider credentials for this service. Current settings were not inspected.
- Code, assets, scripts and runtime/build configuration are included in deployment watch paths; documentation-only changes are excluded.
- The setup record reported GitHub Actions disabled and Railway's GitHub integration as the deployment mechanism. A read-only GitHub check on 2 October 2026 found Actions enabled and the dedicated Ward Flow CI workflow active. Current-head outcomes and deployment remain separate evidence.

The dedicated healthcheck endpoint is `/api/health`, returning `{ status: "ok", appName: "Ward Flow", synthetic: true }` (HTTP 200). Check `/mockups/ward-flow` directly after deployments and distinguish build success from runtime verification.

## Known limits

The record reports hosted compilation and TypeScript checks passed during setup on 27 September 2026. This historical evidence does not verify the current head, behaviour suite, browser journeys or clinical governance.

The deployment dependency audit reported one high-severity production dependency advisory for transitive `sharp`. It was not remediated in this hosting task. Review the advisory and an appropriate patched dependency before treating the prototype as production-ready.
