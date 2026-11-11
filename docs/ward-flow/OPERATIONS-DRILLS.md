# Ward Flow operations drills (draft)

_Updated 2026-11-10 - first draft from master audit list items M41, M42, M68, M70, M74, M75 and M110; Documentation owns._

**Status: DRAFT.** These are drill plans and blank records. **No drill on this page has been run**
unless a dated result is written in its record. Each drill uses synthetic data only. Steps that
touch a hosted service (Supabase, Railway, Sentry, GitHub, the live site) need Josh's yes on the
day, and billable steps need a spending approval first. The [operations runbook](OPERATIONS-RUNBOOK.md)
stays the one home for how to run the service; this page only holds rehearsals and their records.
Local evidence from 10 November 2026 is in
[evidence/2026-11-10-operations-audit-batch.md](evidence/2026-11-10-operations-audit-batch.md).

| Drill                               | Item | When                            | Hosted step?       | Last run           |
| ----------------------------------- | ---- | ------------------------------- | ------------------ | ------------------ |
| Restore and replay                  | M40  | Quarterly, and before real data | Yes (Josh's yes)   | Local: 10 Nov 2026 |
| Rollback after newer data           | M41  | Before real data                | Yes                | Never              |
| Downtime pack and return to service | M42  | Before real data                | Partly             | Never              |
| Service down, one at a time         | M68  | Local first, then hosted        | Yes, after local   | Local part only    |
| Password reset and invite email     | M70  | Before a pilot                  | Yes                | Never              |
| Trace one error end to end          | M74  | Once Sentry receives events     | Yes                | Never              |
| Responder tabletop with Josh absent | M75  | Before real data, with M63's    | No                 | Never              |
| Runbook cold read                   | M110 | Quarterly                       | No (local, mocked) | Partial: 10 Nov    |

## M41. Rollback drill

**Aim:** roll back one release after newer data has been written, and prove the newer data still
reads. The app rollback route is the runbook's
[Rolling back the app](OPERATIONS-RUNBOOK.md#rolling-back-the-app); the database is never restored as
part of an app rollback.

**Before starting (person):** Josh's yes; record the current `live` commit, the earlier `live-*`
release and each service's deployment; pause the daily release (`WARD_RELEASE_PAUSED`).

**Steps**

1. On the current release, make three synthetic saves that only the current release can make (for
   example a field added since the earlier release). Note their revisions, not their contents.
2. Roll back per the runbook. Confirm each service now runs the earlier commit.
3. Read the board as a coordinator. Check: the board loads; the three saves are still there; the
   earlier release neither drops nor rewrites the newer field on its next save (make one save and
   reload on the current release afterwards to check).
4. Roll forward the same way. Run the signed-in save, reload and conflict checks.

**When to roll forward instead (draft rule for Josh to confirm):** roll forward with a fix when the
earlier release cannot read the current schema (its minimum migration is above the earlier
release's), when newer data would be dropped or rewritten by the earlier release, or when the fault
is in data rather than code.

**Record:** date and time, both commits, each step's pass or fail, time from decision to working
rollback, and what was rolled forward. **Not run.**

## M42. Downtime pack and return to service

**Aim:** a rehearsed outage on synthetic data, with paper work re-entered by hand and the audit
checked for duplicates and gaps afterwards (D-72: print or PDF only, no device copy).

**Steps**

1. Before the outage: confirm the downtime pack is current (it is printed hourly and at each shift
   change). Note the pack's printed time.
2. Declare the outage. Record three synthetic changes on paper (a bed freed, an admission, a
   discharge), each with the time written.
3. Restore service. One person re-enters the paper changes by hand, in time order. A second person
   checks each against the paper.
4. Check the audit afterwards (administrator, local or with Josh's yes on hosted). Duplicates: no
   command ID with more than one audit row (the query in `backend/ward-flow/restore-drill.test.mjs`,
   `duplicateAudit`). Gaps: list the accepted rows whose `prior_revision` is not the previous accepted
   row's `revision` and explain each (a save merged onto a newer board can do this), and check the
   three re-entered changes appear once each.

**Record:** date, pack printed time, outage start and end, minutes to re-enter, duplicates found,
gaps found and how each was explained. **Not run.**

## M68. Service-down drills

**Aim:** one service down at a time. Staff see an honest state, healthy parts keep working, failures
stay bounded, and error reporting never blocks the app. Local first; the hosted run needs Josh's yes.

| Service down     | Staff should see                                               | Local fault test                                                      | Hosted drill record |
| ---------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------- |
| Supabase sign-in | The connecting screen retries quietly, then one plain sentence | `tests/ward-supabase-retry.dom.test.tsx`                              | Not run             |
| Database         | Saves "not confirmed", 503; the last board stays, marked stale | `shared-http.test.mjs` (503 versus 500)                               | Not run             |
| Backend          | "Not updating since", Retry; nothing claimed saved             | `tests/ward-audit-m78-captive-portal.dom.test.tsx`                    | Not run             |
| Signed-in site   | The browser's own error; the backend is unaffected             | None                                                                  | Not run             |
| Push service     | Saves still succeed; the alert is reported as failed           | `push.test.mjs` (delivery reports failed)                             | Not run             |
| Sentry           | Nothing; the app carries on                                    | `backend/ward-flow/service-down-drill.test.mjs` (hang, throw, reject) | Not run             |

**Hosted record (per service):** date, how it was taken down (or simulated), what a coordinator saw
on Home and the ward screen, whether a save made during it was lost or doubled, time to recover.

## M70. Password reset and invitation emails

Sign-in uses a password and a second step, so shift change does not depend on email; only resets and
invitations do. Supabase's built-in sender is rate limited and meant for testing.

**Written fallback (draft for Josh to approve):** when a reset or invitation email does not arrive
within 10 minutes, an access admin resets the password by hand in the Supabase dashboard (Josh's
account only while the data is synthetic), gives it to the person by phone, never by email or chat,
and the person changes it at first sign-in. The admin records the date and the account's role, never
the password.

**Timed reset (needs Josh):** on one synthetic test account, request a reset, record the minutes
until the email arrives and until the person is signed in. **Not run.** A paid email sender needs a
spending approval.

## M74. Trace one error end to end

**Aim:** one synthetic error traced from the tap to the backend log line and the Sentry event by one
request ID. The offline gaps were fixed on 10 November 2026 (D-129): the Sentry event now carries
the request ID, role, screen and route (`failureEvent` in `backend/ward-flow/error-report.mjs`), and
handled 500s are sent (`createSharedHandler` in `shared-http.mjs`); `backend/ward-flow/trace-drill.test.mjs`
pins both. **Blocked** only on the hosted part: Josh's yes and a Sentry project that receives events.
Then: trigger one synthetic server error, note the `x-request-id` the browser got, find the log line with
it, find the Sentry event with it, and record the times. **Not run.**

## M75. Responder tabletop with Josh absent

See [governance/ONE-PERSON-RISK.md](governance/ONE-PERSON-RISK.md) for the ownership map. The
tabletop is run with M63's. A named deputy, without Josh, talks through: a backend outage at 07:00
handover, a bad release (roll back), and a leaked key (rotate it). Pass: each step is something the
deputy has the access and the written steps to do. **Not run; there is no named deputy yet.**

## M110. Runbook cold read

**Aim:** an agent with no context follows the runbook step by step on a local or mocked setup and
records every wrong or missing step, then a PR fixes them.

**Record template:** date; runbook commit; agent and model; for each section (what runs where,
routine checks, deploy, rollback, incidents, backup and restore, drill), each step marked followed,
wrong or missing, with the fix. **Partial run 10 November 2026:** the backup-restore drill section
only, during M40; five gaps, two fixed (evidence page). The rest is owed.
