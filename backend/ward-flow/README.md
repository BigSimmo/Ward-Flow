# Ward Flow development backend

This package stores synthetic Ward Flow demonstration sessions in the existing
`wflowdev7273a083aue` Azure Storage account. It is a development service.
Never enter or upload real patient information.

## Status note (3 October 2026)

- Demo refresh persistence already exists in the browser: the app saves the
  synthetic ward state to `sessionStorage` in
  `src/components/ward-management/ward-flow-provider.tsx`. Saving stops for the
  rest of the session once typed free text is dispatched (owner decision D-18),
  and refusal records are never stored.
- This Azure backend is code-complete but is deliberately **not** connected to
  the UI. Connecting it waits on WF-29 (privacy and service-scoped access) and a
  later owner decision.
- No Azure action was taken when this note was written.

## Boundaries

- The Azure Functions host is `wardflow-dev-api-aue` in `rg-wardflow-dev-aue`.
  Its existing Entra authentication requires Josh's identity. The API also
  verifies the v2 access token, tenant, audience, `WardFlow.Access` scope and owner.
- The Function's existing managed identity accesses a private blob container in
  its existing storage account. Sessions are stored under owner-specific paths.
  No storage key or password is stored in the backend.
- The PostgreSQL `schema.sql` is retained for a later private-network rollout.
  It has not been applied and is not used by this API. There is no migration
  runner yet; add one together with a PostgreSQL store adapter. The unused `pg`
  dependency was removed on 3 October 2026; add it back with that adapter.
- Each session has an owner UUID and a revision. `PUT` uses an expected revision;
  a stale save returns `409` and does not replace the current blob.
- The API accepts only the `synthetic` classification. This label and basic
  shape checks do **not** establish that arbitrary JSON is truly synthetic.
  Keep this service limited to invented demonstration content and do not treat
  it as approved clinical storage.

## Local checks

`npm test` runs the focused API tests without connecting to Azure. The package
requires Node 22. Copy `.env.example` to an ignored `.env` only for local use;
never add access tokens or passwords to it. Local calls to Azure Storage need
an Azure identity with data access to the existing account.

The Azure Functions v4 entry point is `function.mjs` with `host.json` at the
package root. Deploy a package of this folder to the existing Flex Consumption
host; do not set `WEBSITE_RUN_FROM_PACKAGE`. Keep the current host authentication
configuration and use the existing system identity and storage account.
