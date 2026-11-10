# Real patient data: go/no-go checklist

_Created 2026-11-03 - Q378 (Josh, 3 Nov 2026); checked against main `cd66be7a` and the Ward Flow Supabase project; Documentation owns._

_Updated 2026-11-10 - section 4 rechecked against repository records and the Sentry row corrected (audit item M61); drafts linked under sections 2 and 3; Documentation owns._

Ward Flow runs on synthetic data only. This page lists everything that must be true before the
first real patient record is entered. It is a checklist, not an approval. The answer is **no-go**
until every row below is ticked with evidence, and the named owners in section 5 have signed.

The wider evidence register is [PRODUCTION-READINESS.md](PRODUCTION-READINESS.md). The database
of record is in [DATABASE.md](../DATABASE.md).

## 1. Code changes needed first

| #   | Item                                                                                                                                                                                                                                                                                                        | Where today                                                                                                                 | Done when                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Drafts behind a data-mode switch.** Referral and legal-form drafts (names, free text, patient keys) are written to sessionStorage. The only guard is a comment and the `synthetic-demo` default. In live mode, drafts must stay in memory, or be stored only after a privacy decision on browser storage. | `wf-draft:v2:*` in `src/components/ward-management/ward-session-drafts.ts`, called from `referrals/referral-draft-cache.ts` | Every browser storage write that can hold patient detail checks the workspace data mode, and a test proves nothing patient-like is written when the mode is not `prototype`. |
| C2  | **Demo world state stays demo-only.** The whole demo world (including invented patients) is saved to browser storage.                                                                                                                                                                                       | `ward-flow-demo-state-v1` in `ward-flow-demo-storage.ts`, gated by `ward-flow-persistence-classification.ts`                | The demo store cannot run in a live workspace (tested).                                                                                                                      |
| C3  | **Reminder labels.** Tools reminders keep a target label in localStorage, which outlives the tab.                                                                                                                                                                                                           | `wf-mock-tools-reminders` in `tools/ward-tool-remind-store.ts`                                                              | Labels are place or bed text only, or the label is looked up at display time instead of stored (tested with a movement target).                                              |
| C4  | **Secure cookie always.** `wf_pass` gets `Secure` only when the request URL says https. Behind a proxy that can read as http.                                                                                                                                                                               | `withPass` in `src/app/api/session/route.ts`                                                                                | Production always sets `Secure`, whatever the request protocol (tested).                                                                                                     |
| C5  | **Sign-in token storage.** The Supabase refresh token sits in sessionStorage, readable by page scripts, because the backend is on another site (H-0044).                                                                                                                                                    | `ward-flow:auth:<project>:v1` in `ward-auth-session.ts`                                                                     | Either the token moves to an HttpOnly cookie on a same-site backend, or the PIA accepts the risk with a session time limit and the strict content security policy kept.      |
| C6  | **Data-mode lock opened on purpose.** Migration 7 limits the database to `prototype`, and the backend refuses any other `WARD_DATA_MODE`.                                                                                                                                                                   | `migrations/007-prototype-only.sql`, `backend/ward-flow/config.mjs`                                                         | A new decision and migration allow `live`, only after sections 2 to 5 are complete. Never by hand in the console.                                                            |
| C7  | **Logs and error reports.** Sentry is server-side, off unless `SENTRY_DSN` is set, and scrubbed.                                                                                                                                                                                                            | `src/lib/sentry-server.ts` (`scrubSentryEvent`)                                                                             | A test sends an event containing synthetic names and free text and shows none of it leaves the server. Railway and Supabase logs checked for request bodies.                 |

Already in place, checked 3 Nov 2026: sign-out, expiry and a refused session clear every Ward
Flow key from browser storage (`ward-browser-data.ts`); the service worker caches static files
only, never pages or data (`public/ward-flow-push-sw.js`); no analytics; fonts are local; push
messages carry fixed text with counts and a place name only.

## 2. Privacy impact assessment (PIA)

| #   | Item                                                                                                                                             | Done when                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| P1  | Name the privacy officer (STATUS "Waiting on Josh").                                                                                             | Named in writing.                                          |
| P2  | PIA under the current WA privacy law and mandatory WA Health policies, covering every data flow in section 4 and every browser key in section 1. | Signed PIA, with its scope and version.                    |
| P3  | Lawful basis and purpose for each field Ward Flow holds (name, UMRN, legal status, free text, documents).                                        | Field list approved; anything not needed is removed.       |
| P4  | Retention, correction and deletion by record type ([RETENTION-AND-BACKUP.md](../RETENTION-AND-BACKUP.md) open questions answered).               | Approved retention policy, with a measured deletion check. |
| P5  | Access control: who can grant administrator access, break glass review and the record access log reviewed on a schedule.                         | Written rule, named reviewer, first review done.           |
| P6  | Bed meeting TV privacy review (screens visible to passers-by).                                                                                   | Review signed; TV view changes made if needed.             |

Drafts toward these rows (none ticks a row): [PIA draft](PRIVACY-IMPACT-ASSESSMENT.md) (P1, P2),
[field list](DATA-MINIMISATION-FIELD-LIST.md) (P3), [retention plan](../RETENTION-AND-BACKUP.md) (P4),
[access review](ACCESS-REVIEW.md) (P5).

## 3. Breach plan

| #   | Item                                                                                                                                                                                                      | Done when                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| B1  | One page: who is told first, who decides, and the notification duties and time limits the PIA confirms (state scheme, and the federal scheme if a private hospital takes part).                           | Plan approved by the privacy officer. |
| B2  | Containment steps that work today: end every session (server-side sign-outs, migration 11), turn the front door to required, rotate the Supabase keys and `WARD_PASS_SECRET`, pause the Railway services. | Each step written with who can do it. |
| B3  | Evidence kept: record access log, Supabase auth and API logs, Railway logs, with how long each provider keeps them.                                                                                       | Retention of each log confirmed.      |
| B4  | A synthetic breach drill run end to end.                                                                                                                                                                  | Drill record with times and lessons.  |

Draft toward these rows (it ticks none): [breach plan](../pilot/breach-plan.md).

## 4. Subprocessors and regions

Rechecked 10 Nov 2026 against repository records only (audit item M61). **No provider dashboard
was opened**, so every "Region now" is as last recorded, with its source. A live recheck of each
row is a read-only provider look and needs Josh's yes. Write the date in "Live check" when done.

| Service                                               | Holds                                                               | Region now (source)                                                                                                                                                                                                                                   | Live check | Needed before real data                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase (database, sign-in)                          | All records, accounts, access log                                   | Sydney (`ap-southeast-2`), checked 3 Nov 2026                                                                                                                                                                                                         | Not yet    | Paid plan with point-in-time backup (now **free**). Invite-only sign-up (open sign-up **on** at 19 Oct 2026). Data processing terms signed.          |
| Supabase organisation options                         | AI assistant SQL, log and data-sharing opt-ins                      | Organisation-wide; **on** at 3 Nov 2026 (Q391)                                                                                                                                                                                                        | Not yet    | Turned off ([hardening H1, H2](PROVIDER-ACCOUNT-HARDENING.md)).                                                                                      |
| Railway (app and backend)                             | Every request and response in transit, logs                         | Singapore (D-84, 26 Oct 2026; runbook)                                                                                                                                                                                                                | Not yet    | Move to an Australian host chosen with the health service's IT (D-84 revisit), or the PIA accepts offshore processing. Data processing terms signed. |
| Sentry (server errors)                                | Scrubbed error events: types, stack frames, fixed failure names     | **US region**, organisation `clinibase-xz`, switched on 26 Oct 2026 per project notes ([operations-readiness](../operations-readiness.md#server-error-reporting-sentry)). Which services carry `SENTRY_DSN` is not re-read and no event has been seen | Not yet    | Josh chooses (STATUS item 4): keep, move or remove. Before real data, off or onshore unless the PIA accepts scrubbing; keep scrubbing tested (C7).   |
| Web push services (Google, Apple, Mozilla, Microsoft) | Fixed alert text: counts and a place name                           | Global                                                                                                                                                                                                                                                | n/a        | Confirm the PIA accepts this, or turn push off for live workspaces.                                                                                  |
| GitHub (code, Actions, uptime issues)                 | Code, synthetic fixtures, CI logs, `backend-down` issues            | United States                                                                                                                                                                                                                                         | Not yet    | Never real data, screenshots or logs with real data. Private repository (D-87).                                                                      |
| AI coding tools and agent memory                      | Code, synthetic data, project notes (Supermemory `wardflow_design`) | Varies; United States for most                                                                                                                                                                                                                        | n/a        | Never real data. Written rule for every agent and contributor (AGENTS.md hard rule 1).                                                               |

Earlier wording said Sentry was "not set up". That was wrong against the runbook and
operations-readiness, which record it switched on in a US-region organisation. The open question
is which organisation to keep (STATUS item 4), not whether one exists.

## 5. Sign-off

| #   | Item                                                                                    | Done when                         |
| --- | --------------------------------------------------------------------------------------- | --------------------------------- |
| S1  | Hosting approval from the health service.                                               | Written approval.                 |
| S2  | Clinical safety owner named; hazard log reviewed and accepted (Clinical Safety Case).   | Signed acceptance.                |
| S3  | Hosted backup restore drill and two-person shared save, reload and conflict run passed. | Receipts in operations-readiness. |
| S4  | Pilot scope agreed: wards, accounts, training, supervision and stop conditions.         | Signed pilot plan.                |
| S5  | Final go/no-go meeting: every row above ticked with evidence.                           | Minutes with the decision.        |
