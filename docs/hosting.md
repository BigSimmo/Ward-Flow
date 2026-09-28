# Ward Flow hosting and database decisions

Owner-approved setup, 27 September 2026.

## Boundaries

- Host the synthetic prototype on Railway in its own **Ward Flow** project.
- Connect only `BigSimmo/Ward-Flow`, branch `main`.
- Do not connect Ward Flow to Supabase or reuse PsychSift's database, services or credentials.
- Azure is the owner's chosen future database platform. No Azure database, schema, credentials or connection has been created as part of this hosting setup.
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
- No Supabase, Azure, OpenAI or other database/provider credentials are configured for this service.
- Code, assets, scripts and runtime/build configuration are included in deployment watch paths; documentation-only changes are excluded.
- GitHub Actions remains disabled. The Railway GitHub integration is the deployment mechanism.

The dedicated healthcheck endpoint is `/api/health`, returning `{ status: "ok", appName: "Ward Flow", synthetic: true }` (HTTP 200). Check `/mockups/ward-flow` directly after deployments and distinguish build success from runtime verification.

## Known limits

The hosted compilation and TypeScript check passed during setup. This does not replace the full behaviour suite, browser journey review or clinical governance work.

The deployment dependency audit reported one high-severity production dependency advisory for transitive `sharp`. It was not remediated in this hosting task. Review the advisory and an appropriate patched dependency before treating the prototype as production-ready.
