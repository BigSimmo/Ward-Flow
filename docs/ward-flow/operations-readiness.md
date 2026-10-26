# Ward Flow operations verification

_Updated 2026-10-21 - recovery checklist scope clarified without provider execution; Documentation owns._

This record supports the existing [audit receipt](../superpowers/plans/2026-10-16-audit-resolution-results.md)
and [task ledger](../ward-flow-task-ledger.md). It records acceptance evidence and recovery steps,
not a second issue tracker. The [database page](DATABASE.md) identifies the approved synthetic-only
project; [hosting](../hosting.md#shared-backend-and-signed-in-site--16-october-2026) identifies the
services and addresses.

## Verified scope — 17 October 2026

Source snapshot: `ed9d59e71a294787e4fd32c8363ee875c7b63161`.

| Concern                                    | Observed evidence                                                                                                                          | Limit                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Combined source checks                     | [CI #2533](https://github.com/BigSimmo/Ward-Flow/actions/runs/39000996265) passed; its production checkout tree matches this main snapshot | Later source or lock edits need their own checks                                                             |
| Backend deployment                         | Railway reports deployment `906d84d0-21b6-4cc0-9d18-73408145439a` successful at this source revision                                       | Deployment metadata does not establish authenticated readiness                                               |
| Signed-in site deployment                  | Railway reports deployment `f21c47cb-c62d-4df9-afc6-66fd03c1e286` at this revision, sleeping when inspected                                | Sleeping is not a failure; browser acceptance is separate                                                    |
| Authenticated browser save/reload/conflict | Pending                                                                                                                                    | The checking runtime's proxy returned HTTP 403; no synthetic browser credentials were configured             |
| Hosted backup and isolated restore         | Pending                                                                                                                                    | The Supabase management connector denied project access; backup availability and retention were not observed |
| Application rollback candidates            | Railway reports prior backend and site deployments available for rollback                                                                  | No live rollback was executed or proven successful                                                           |

Earlier authenticated API and local synthetic restore checks remain dated evidence in their
original records. They do not close the two pending hosted checks above. Network and connector
denials are access limits, not demonstrated failures of the application or database.

## Server error reporting (Sentry)

Optional and off by default. Setting `SENTRY_DSN` on the signed-in site service turns on
server-side reporting through `src/lib/sentry-server.ts` (lean `@sentry/core` client, no browser
SDK, no CSP change). Each failed request sends the error type, stack frames and the
`incidentId`, method, router and route type tags that `ward.request_failed` already logs.
Error messages, URLs, headers, bodies, users and breadcrumbs are dropped before sending.
`logger.ts` warn and error lines also go to Sentry Logs unless `SENTRY_ENABLE_LOGS=false`.
Optional `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` label events; Railway's commit SHA is the
default release. Project notes record that Sentry was switched on on 26 October 2026, in the
US-region organisation `clinibase-xz`, for synthetic test data only. Which services carry
`SENTRY_DSN` was not re-read from Railway for this page, and no event has been seen arriving, so
delivery is unverified. Before real data, switch it off or move it onshore unless the health
service's privacy review accepts the scrubbing.

The shared backend has its own optional reporter, `backend/ward-flow/error-report.mjs`, turned on
by `SENTRY_DSN` on the `ward-flow-backend` service. It needs no SDK. Each report holds only a
fixed failure name (unhandled request failure, unhandled rejection, uncaught exception or push
re-check failure), the allow-listed error name and code that the log line already carries, the
environment and the release. No message, stack, request, user or record content is read. Each
failure kind is sent at most once every five minutes, so a long outage stays inside a free plan.

Uptime: `.github/workflows/backend-uptime.yml` checks the backend and its database every 30
minutes and emails the owner through a GitHub issue. The signed-in site is not checked because it
sleeps when idle.

## Hosted browser acceptance

Owner role: application maintainer, with the synthetic test-account owner.

1. Confirm the service source revisions and the project boundary above. Use a dedicated synthetic
   account and record its role/scope without including its password, token or account identifier
   in the receipt. Supply credentials through an approved secret or an authenticated test-browser
   session. Never add them to source, screenshots, URLs or test traces.
2. Allow the checking runtime to reach only the signed-in site, backend and the approved Auth
   origin. A proxy denial is a blocked check. Recheck configured access; do not bypass the proxy
   or substitute a mocked login for this acceptance.
3. Sign in through the actual signed-in site. Confirm the expected working role and scope and
   authenticated readiness. Make one agreed reversible change to an invented record through the
   real UI. Wait for its accepted outcome before reporting success; reload and confirm persistence.
4. Using the same isolated synthetic scenario, retain a valid command's original revision, accept
   a separate write that changes a record the retained command changes or names, then submit the
   stale command to `/v1/workspace/commands`. Require HTTP 409 and no duplicate mutation. From
   migration 10, a stale command touching only unchanged records can succeed; it is not a conflict
   fixture. Do not count a refusal of an invalid command as a conflict test.
   Re-read before retrying uncertain writes.
5. For temporary access, use an existing dedicated synthetic test membership/cover grant. End
   only that grant through the normal access-admin workflow and require the next read/poll to
   narrow both payload and access metadata. Confirm the write boundary too. Do not alter a
   different user's membership or manufacture authority in a token.
6. Restore the agreed reversible fixture through supported actions, sign out and close the test
   session. Record source/deployment IDs, UTC time, statuses and sanitised expected/actual results.
   Keep automatic traces, videos and payload logging off for the authenticated run.

Acceptance needs the complete sequence, not just an HTTP 200, a screenshot or a successful sign-in.
If the runtime network or credentials change, record the new evidence rather than changing a
pending row on the strength of configuration alone.

## Backup and recovery acceptance

Owner role: database/hosting maintainer. The repository owner chooses the acceptable data-loss
window (RPO) and time to recover (RTO). Neither an approved objective nor its achievement is
established by the evidence above; do not invent a provider retention schedule or a target value.

This section states what a recovery rehearsal must prove; it is not an executable export or restore
runbook. Before a separately authorised rehearsal, the maintainer must document the exact source
and isolated target identities, available backup mechanism and format, chosen recovery point,
tool/command sequence, database and Auth-state coverage, application configuration, stop conditions
and bounded cost. The current pending row does not establish that a usable hosted backup or those
provider operations are available. Keep the approved target-specific procedure and its evidence
with the private operations receipt, without copying credentials or record contents here.

1. With scoped management access, inspect backup/PITR availability, retention and the most recent
   recoverable point for the exact project on [DATABASE.md](DATABASE.md). Record timestamps and
   metadata only. Do not print database passwords, access tokens or record contents.
2. Obtain an authorised backup/export and preserve its checksum, database version, schema version,
   scope and capture time privately. A workspace JSON export is not a substitute for database
   recovery of memberships, audit records and command receipts. Project/database recovery may
   also need provider-managed Auth state; record what an export excludes.
3. Restore into a separately authorised, empty isolated target compatible with the backup. Verify
   its identity before writing. Never point a rehearsal at the active shared database or perform
   an in-place project restore. New paid targets require separate approval. A local target tests
   the archive and schema, while a hosted target also tests provider recovery; label the scope.
4. Require restore completion without ignored errors. Compare tables, constraints, row counts,
   sequence values and deterministic content digests with the captured snapshot, and validate
   the restored domain payload using the matching engine. Check the migration ledger and command
   retry/audit continuity. An unrelated local seed is not proof that the hosted backup is usable.
5. For a bounded database rehearsal, use the `postgres` adapter against the isolated restored
   PostgreSQL database while retaining the original approved Supabase Auth target and dedicated
   synthetic accounts. The current Supabase database and Auth adapters reject a new project target;
   a new Supabase database/Auth project needs separately approved configuration/code support before
   authenticated acceptance there. Check synthetic authenticated read/save/reload/conflict against
   the supported isolated backend and record which scope was tested. Measure the recovery duration
   and recovered timestamp, then compare them with
   the owner's objectives. Do not infer RPO from a backup schedule or RTO from a local import alone.
6. Preserve the backup and sanitised receipt. Stop owned rehearsal services. Deleting a Ward Flow
   backup, branch or worktree needs the repository owner's explicit approval.

## Application rollback

Railway's inspected history lists these prior builds as rollback-capable candidates:

| Service        | Prior deployment                       | Source                                     |
| -------------- | -------------------------------------- | ------------------------------------------ |
| Backend        | `bacd64c6-683b-4bf1-b085-4e3adc0e441e` | `d52e9aef0eb642280c4dd20884842c78ef9b5230` |
| Signed-in site | `f2796cc5-aa1b-45c3-a928-f6b0563d16d2` | `d52e9aef0eb642280c4dd20884842c78ef9b5230` |

Availability is not acceptance. Reconfirm artifact availability, schema/configuration compatibility
and the consequences of losing later fixes before choosing a candidate. Keep the database and
accepted records intact. Browser public settings are baked into its build; pair the correct site
and backend configuration. A candidate may predate an important fix and is not automatically the
recommended recovery version.

Rehearse on an isolated authorised target first. A live rollback is a separate deployment action:
identify the exact service and artifact and obtain the owner's approval before executing it.
Afterwards verify the selected deployed revisions, authenticated readiness, synthetic browser
save/reload/conflict and access scope. Keep subsequent main changes intact; source correction
uses a reviewed revert/fix PR rather than resetting shared history.
