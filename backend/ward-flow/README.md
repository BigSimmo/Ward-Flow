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
- This Azure backend implements owner-private synthetic snapshots but is deliberately **not** connected to
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

From the repository root, `npm run test:backend` runs the focused API tests without connecting
to Azure. From `backend/ward-flow/`, the equivalent command is `npm test`; root `npm test`
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
