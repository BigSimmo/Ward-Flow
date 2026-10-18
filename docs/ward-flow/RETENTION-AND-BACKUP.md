# Ward Flow retention, correction and backup plan

**Status:** Ward Flow is a prototype. It holds synthetic data only. This plan must be agreed and
in place before any real patient data is entered. It is not legal advice. A WA Health records
manager and privacy officer need to review and sign it off. Prepared 18 October 2026 for readiness
review item 10.

Anything marked **unconfirmed** could not be checked from the repository or a public source.

## What Ward Flow stores

All tables are in the `ward_flow` schema of the Supabase database named in
[DATABASE.md](DATABASE.md). Today every row is synthetic.

| Table                | What it holds, in plain words                                                                                  | Identifiers once real?                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `workspaces`         | The live board: patients, referrals, movements, beds, transport and delays, as one saved record with a version | Yes. Patient details and clinical notes                 |
| `audit`              | One row per change or refused change: who, role, place, when, and the before and after values                  | Yes. The before and after values copy patient details   |
| `record_access`      | One row each time someone opens a patient or movement page: who, role, place, patient ID, which screen, when   | Yes. Patient ID and staff ID                            |
| `break_glass`        | One row each time someone opens a record outside their own care, with the reason and end time                  | Yes. Patient ID and staff ID                            |
| `memberships`        | Which staff member holds which role at which place, who granted it, when it ends                               | Staff only                                              |
| `access_requests`    | Requests for a role from staff who have none, and the decision                                                 | Staff only                                              |
| `commands`           | Receipts that stop a resent button press being applied twice. Outcome and version number only                  | Staff ID only. No patient content                       |
| `push_subscriptions` | Phone alert addresses and their encryption keys, per staff member                                              | Staff only                                              |
| `push_deliveries`    | Which alert is still waiting to reach which phone                                                              | Board item IDs only                                     |
| `push_baselines`     | The list of urgent items already announced, one row per board                                                  | Board item IDs only                                     |
| `session_sign_outs`  | Signed-out sign-ins, kept until the token would have expired anyway                                            | Staff ID only                                           |
| `migrations`         | Which database changes have been applied                                                                       | No                                                      |
| Supabase Auth        | Staff sign-in accounts (email, password hash), held by Supabase outside `ward_flow`                            | Staff only. Supabase's own log retention is unconfirmed |

`record_access` and `session_sign_outs` arrive with migration 10 (readiness items 8 and 9).
`audit`, `record_access` and `break_glass` are append-only. The database refuses any change or
removal, including by the backend itself.

## Retention plan

Health records are kept for decades. So **nothing in the app deletes clinical or audit records
by itself**. Disposal of those is a manual, authorised records task years from now. The app only
prunes operational leftovers that hold no patient content.

The audit's before and after values will hold patient identifiers once data is real. The access
logs name the patient. So both inherit the retention of the clinical record they describe. The
State's general authority says an audit trail is kept for "the life of the record(s) that is the
subject of the audit trail" (DA 2023-004, item 33.1).

| Record                                    | Proposed retention                                                                                   | Rule it comes from                                                                                                                                                                                                                                                                                                                                                                                                       | How disposal happens                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Board content (`workspaces`), psychiatric | At least 7 years after death, if the patient reached 25. Treat as the person's lifetime plus 7 years | [PIRDS DA 2019-008](https://fionastanley.health.wa.gov.au/~/media/Corp/Policy-Frameworks/Information-Management/Information-Retention-and-Disposal-Policy/Supporting-Information/DA2019008-Patient-Information-Retention-and-Disposal-Schedule-for-the-WA-health-system.pdf) item 1.4. [Mental health SDA 2021-012](https://www.wa.gov.au/system/files/2023-12/sda-mental-health-services.pdf) section 1.5 says lifetime | Manual. Reviewed by the delegated authority first (PIRDS section 1.4). Never by the app                 |
| Board content, non-psychiatric patients   | 60 years after last attendance or last documentation                                                 | PIRDS item 1.1 (discharged inpatients), 1.3 (emergency)                                                                                                                                                                                                                                                                                                                                                                  | As above                                                                                                |
| Board content, Aboriginal patients        | Indefinite if born on or before 1970, or seen at listed remote clinics                               | PIRDS section 1.1.2                                                                                                                                                                                                                                                                                                                                                                                                      | Do not dispose                                                                                          |
| `audit` (all rows)                        | Same as the clinical record it describes. In practice the longest class above                        | [DA 2023-004](https://www.wa.gov.au/system/files/2024-02/2023004-grdasg.pdf) item 33.1                                                                                                                                                                                                                                                                                                                                   | Append-only. Cannot be removed row by row. Disposal would be a whole-board archive and destruction task |
| `record_access`, `break_glass`            | Same as the clinical record it describes                                                             | DA 2023-004 item 33.1                                                                                                                                                                                                                                                                                                                                                                                                    | As for `audit`                                                                                          |
| `memberships`                             | As long as any audit or access row that names them. They are needed to read the audit                | Unconfirmed classification. Records manager to decide                                                                                                                                                                                                                                                                                                                                                                    | Manual. `break_glass` rows already point at them, so the database blocks early removal                  |
| `access_requests`                         | Proposed 2 years after the decision                                                                  | Unconfirmed. Possibly DA 2023-004 item 33.5 (system user groups, 2 years)                                                                                                                                                                                                                                                                                                                                                | Manual pruning job, not built yet                                                                       |
| `commands` receipts                       | 7 days                                                                                               | Operational copy only. The audit keeps the record                                                                                                                                                                                                                                                                                                                                                                        | `backend/ward-flow/prune-receipts.mjs`. Run by an operator. Whether it is scheduled is unconfirmed      |
| `push_deliveries`, `push_baselines`       | Only while the item is still urgent                                                                  | Operational only                                                                                                                                                                                                                                                                                                                                                                                                         | Removed by the app automatically                                                                        |
| `push_subscriptions`                      | While active. Dead phone addresses are removed by the app. Revoked rows currently stay               | Operational only                                                                                                                                                                                                                                                                                                                                                                                                         | Proposed: prune revoked rows after 30 days. Not built yet                                               |
| `session_sign_outs`                       | Until the token would have expired. Safe to prune after one day                                      | Operational only                                                                                                                                                                                                                                                                                                                                                                                                         | Removed by the app once expired (`backend/ward-flow/postgres.mjs`)                                      |
| Database backups                          | 7 days of daily backups on the Pro plan, or the PITR window                                          | DA 2023-004 item 33.7 (business continuity)                                                                                                                                                                                                                                                                                                                                                                              | Aged out by Supabase                                                                                    |

**What starts the clock.** PIRDS uses last attendance, date of last documentation, or date of
death. Ward Flow has no date of death. So a records manager must decide how the board's content is
transferred into, or matched with, the hospital record that carries those dates.

**Holds.** Records linked to an investigation, inquiry or FOI request must be kept until that is
finished, even if otherwise due (PIRDS section 1.5).

**Why the law allows long retention.** The PRIS Act says to destroy or de-identify personal
information once no longer needed, "unless its retention is expressly required or authorised by
or under another law" (IPP 4.2). The State Records Office says the State Records Act 2000 is such
a law, and records "may only be destroyed or permanently de-identified in accordance with an
approved retention and disposal authority"
([State Records Office](https://www.wa.gov.au/organisation/state-records-office-of-western-australia/privacy-and-responsible-information-sharing-act-2024-and-record-keeping-obligations)).

**Version check.** The WA Health
[Information Retention and Disposal Policy MP 0144/20](https://www.health.wa.gov.au/About-us/Policy-frameworks/Information-Management/Mandatory-requirements/Storage-and-Disposal/Information-Retention-and-Disposal-Policy)
lists PIRDS 2019-008. The copy found has an approval status date of 19 May 2022. Whether a newer
version exists is unconfirmed. The policy page names the general authority as "DA2024/004" while
its link points to DA 2023-004. Which number is current is unconfirmed.

## Correction requests

The PRIS Act's privacy principles began on 1 July 2026. The breach notification scheme begins
on 1 January 2027
([Office of the Information Commissioner](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/personal-information-collected-and-after-1-july-2026)).

For a public health service, the Information Commissioner says people correct their records under
the Freedom of Information Act 1992 (WA). IPP 6 (decide within 45 days) covers contracted service
providers
([OIC summary](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/information-privacy-principles-summary),
[OIC public guide](https://www.wa.gov.au/organisation/office-of-the-information-commissioner/what-are-my-privacy-rights-resource-the-public)).
Which route applies to Ward Flow depends on who runs it. That is unconfirmed.

How Ward Flow would handle an agreed correction:

1. The request goes to the health service's FOI or privacy officer, not the ward team.
2. If agreed, an authorised user corrects the live board in the usual way. That makes a new
   audited change with the old and new values.
3. History is never edited. The append-only audit keeps the wrong value and shows when and why it
   changed. That is the honest record, and the database enforces it.
4. The change notes that it answers a correction request, with the request's reference number,
   never the person's name. A way to add that note is not built yet.
5. If the request is refused, the officer gives reasons. Any statement the person asks to attach
   is kept with the hospital record. Ward Flow does not hold free-text statements.
6. Tell the person that the old value stays in the audit, and in backups until they age out.

## Backups

The database is hosted Supabase. The owner chose to configure it through the dashboard, not as
code. So **the repository cannot turn on backups or PITR**. Those are console steps below.

The current Supabase plan could not be confirmed from the repository. What Supabase documents
([backups guide](https://supabase.com/docs/guides/platform/backups), checked 18 October 2026):

- **Free plan:** no automatic backups.
- **Pro plan:** daily backups kept 7 days. Team keeps 14 days.
- **Point-in-Time Recovery (PITR):** a paid add-on on Pro or higher. It needs at least the Small
  compute size. Restore to any second in the window. Worst-case loss about two minutes. Windows of
  7, 14 or 28 days. With PITR on, daily backups stop.
- **Restore in place** replaces the live project. It is offline while it runs.
- **Restore to a new project** (beta) copies the database, roles and Auth users into a new
  project in the same region. It does not copy Auth settings, API keys, storage files or Edge
  Functions ([guide](https://supabase.com/docs/guides/platform/clone-project)).
- Daily backups do not keep passwords for custom roles. After any restore, the backend's
  `wardflow_backend` password must be reset and the backend's setting updated.

**Cost estimate, to check against the live price.** PITR 7 days is listed at USD 0.137 an hour,
about USD 100 a month. Small compute is listed at USD 15 a month against Micro at USD 10, and Pro
includes USD 10 of compute credit. So 7-day PITR adds roughly USD 105 a month on top of the Pro
plan's USD 25 ([pricing](https://supabase.com/pricing),
[PITR usage](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery)).
PITR is billed hourly and is not covered by the Spend Cap. It needs Josh's separate spending
approval.

**Recommendation.** While data is synthetic, Pro daily backups are enough. Turn on 7-day PITR
before any real patient data, and repeat the restore drill after.

## Restore drill (local, synthetic)

- **Date:** 18 October 2026.
- **Environment:** a throwaway PostgreSQL 16.15 server on this machine, loopback only, synthetic
  data. **Not production and not Supabase.**
- **Schema:** migrations 1 to 10 from the working tree, applied by the repo's own `migrate()`.
  Migration 10 was a concurrent change on this branch and applied cleanly.
- **Script:** kept outside the repository (`/home/claude/pgdrill/drill.mjs`). It creates a board
  with the store's own code, sends two synthetic commands, adds two synthetic `record_access`
  rows and one sign-out row.

Commands it ran:

```sh
psql -h 127.0.0.1 -p 55432 -U postgres -c "CREATE DATABASE drill_source"
# migrate(pool), createWorkspaceStore(...).read(actor), two store.command(...) calls
pg_dump -h 127.0.0.1 -p 55432 -U postgres -Fc -f drill_source.dump drill_source
psql -h 127.0.0.1 -p 55432 -U postgres -c "CREATE DATABASE drill_restore"
pg_restore -h 127.0.0.1 -p 55432 -U postgres -d drill_restore --exit-on-error drill_source.dump
# compare, then DROP DATABASE drill_source and drill_restore
```

| Check                                                                   | Result                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Rows per table, source and restored copy                                | Same in all 12                                                              |
| `workspaces` 1, `audit` 3, `commands` 2, `record_access` 2              | Same                                                                        |
| `session_sign_outs` 1, `migrations` 10, all others 0                    | Same                                                                        |
| Migration ledger 1 to 10                                                | Identical. Pass                                                             |
| `audit`, `record_access`, `break_glass` refuse UPDATE, DELETE, TRUNCATE | 9 of 9 refused. Pass                                                        |
| Row-level security on every table                                       | Pass                                                                        |
| New store on the restored copy reads the same version (3) and board     | Pass                                                                        |
| Audit readable through the store (3 rows)                               | Pass                                                                        |
| Timing                                                                  | Migrate 119 ms, dump 90 ms (78 KB), restore 199 ms, whole drill about 1.4 s |

All 15 checks passed. Both databases and the dump file were removed afterwards.

**Limits.** This proves the schema, triggers and data survive a `pg_dump` and `pg_restore`. It
does not prove a Supabase dashboard restore works. That uses physical backups, a different
mechanism. It did not test the runtime role's permissions, Auth users, or a realistic data size.

## Steps for Josh in the Supabase console

Do these in the Ward Flow project only, after checking the project name and ID match
[DATABASE.md](DATABASE.md).

1. **Plan and backups.** Organisation settings, Billing: note the plan. Then Database, Backups:
   check daily backups are listed and the newest is from today or yesterday. If none are listed,
   the project is likely on Free. Record what you see.
2. **Decide on PITR.** Project Settings, Add-ons, Point in Time Recovery. Check the live price
   first. The estimate above is about USD 105 a month extra for 7 days. It needs your spending
   approval before turning on. Recommended: not yet. Turn on before real data.
3. **One restore drill into a NEW project.** Database, Backups, "Restore to a New Project" tab.
   Pick the newest backup. Never use the in-place restore on the live project. Check the cost
   shown before confirming. In the new project, check the `ward_flow` tables have the same row
   counts as the live one, and that `wardflow_backend` can sign in after its password is reset.
   Record the date, backup used, time taken and result here. Deleting the drill project afterwards
   is your call.
4. **Sign-in token length (item 8).** Authentication, Sessions (on some dashboards, Project
   Settings, JWT Keys): set access token expiry to 900 seconds (15 minutes). Check a fresh sign-in
   still works.
5. **Region.** Project Settings, General: check the region is still Sydney (`ap-southeast-2`). A
   restore to a new project stays in the source region.
6. **Test account passwords (item 12).** The shared test password is not in the code, the seed
   data, the docs or the settings files (the whole Git history was searched on 18 October 2026),
   so only the live accounts hold it. Authentication, Users: give each of the eight test accounts
   its own new password of at least 15 characters. Then Authentication, Providers, Email (on some
   dashboards, Authentication, Policies or Password security): set the minimum password length to
   15 and turn on leaked password protection if your plan offers it. The app's new password form
   asks for 15 characters to match.
7. **Migration 10 and its grants (items 8 and 9).** Once the pull request is merged, apply
   migration 10 to the live database and re-run `infra/supabase-runtime-role.sql`, the same way
   migration 9 was applied. Until then the backend keeps working, but opening a record is not
   logged and a sign-out takes effect only when its token expires. The undo is
   `infra/rollback-010-record-access-and-sign-out.sql`.

## Open questions for a records manager or privacy officer

1. Is the Ward Flow board part of the patient's health record, or a bed management system with
   its own class? PIRDS has no bed management item. The bed census (item 2.4) is 10 years.
2. For psychiatric patients, follow PIRDS item 1.4 or the mental health SDA's lifetime advice?
3. How is "last documentation" or "date of death" supplied, since Ward Flow does not hold it?
4. Which retention class fits staff roles and access requests?
5. Does correction run through FOI or IPP 6 for this system, and who is the contact?
6. Is a 7-day backup window acceptable, or is PITR required from day one with real data?
7. How long does Supabase keep its own Auth and access logs, and does that meet DA 2023-004 item 33.2?
