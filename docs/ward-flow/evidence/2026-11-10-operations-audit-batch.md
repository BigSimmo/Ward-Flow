# Operations audit batch: local evidence, 10 November 2026

_Updated 2026-11-10 - master audit list items M40, M68, M69, M74, M78, M82, M83 and M110, local runs only; Documentation owns._

**Evidence boundary.** Every run below was on a cloud agent container, synthetic data only, against a
throwaway local PostgreSQL 16 on loopback. Nothing touched Supabase, Railway, Sentry, GitHub or the
live site. The container had 4 CPUs shared with about 15 other agents (load average 6.6 to 8.0 during
the load runs), so every timing here is pessimistic and is **not** a statement about the hosted
service. Hosted steps are listed as "needs Josh" and were not run.

## M40. Restore drill and replay (local)

- **Script, now in the repository:** `backend/ward-flow/restore-drill.test.mjs`. It runs in CI's
  backend job (the PostgreSQL service with `WARD_TEST_DATABASE_URL`) and skips without a database.
- **Run:** `WARD_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/wardflow_test node --test restore-drill.test.mjs`
  in `backend/ward-flow`, after `npm run build:engine`. **Result: 4 of 4 passed**, 10 November 2026,
  about 06:45 UTC.
- **What it did:** latest schema (migration 17) plus `postgres-runtime-role.sql`, five synthetic
  saves through the runtime role, then `pg_dump -Fc -n ward_flow`, `pg_restore --exit-on-error` into
  an empty database, and the runtime grants re-run.
- **Time to restore:** dump 167 ms, restore and grants 286 ms, **total 453 ms** (a 1,124-row copy;
  an earlier run gave 310 ms).
- **Records checked:** 17 tables and 1,124 rows, the same count per table; migration ledger 1 to 17;
  4 triggers, 4 functions, 70 check constraints and the view count the same; table and column grants
  the same (8 column grants); row-level security on for every table; hashes of the audit, command
  receipts and workspace revisions the same.
- **Permissions checked:** `audit`, `record_access` and `break_glass` refuse UPDATE, DELETE and
  TRUNCATE on the copy; the copy is read and written through `wardflow_backend`.
- **Replay and duplicates:** resending the last command after the restore replays its stored receipt
  (`replayed: true`) and adds no audit row; a new save works; another desk's save against the old
  revision is a normal 409. **No duplicate audit rows** (no command ID with more than one row).
- **Can it fail?** Yes. With `pg_restore --section=pre-data --section=data` (no triggers or indexes)
  all four checks failed, then the file was put back.
- **Still to do (needs Josh):** the hosted half. A `pg_dump -Fc` of the live `ward_flow` schema
  (runbook Option A) or "Restore to a New Project" (Option B, billable), each with his yes on the day.
  Cadence per the item: quarterly, and before real data.

## M68. Service-down drills (local part)

Run fresh on 10 November 2026. The full drill table, one row per service, is in
[OPERATIONS-DRILLS.md](../OPERATIONS-DRILLS.md#m68-service-down-drills).

| Service down                        | Local fault test (fresh result)                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sentry hangs, throws or rejects     | `backend/ward-flow/service-down-drill.test.mjs`, new: 3 of 3 passed. The caller gets control back before the send starts; no unhandled rejection.                        |
| Backend unreachable or wrong answer | `tests/ward-audit-m78-captive-portal.dom.test.tsx`, new: 8 of 8 passed (unavailable, last good read kept, recovers on `online`).                                         |
| Database                            | `shared-http.test.mjs` "a database outage is a 503 and a code fault is a 500" (existing; run in the backend suite, not re-run alone today).                              |
| Supabase sign-in                    | `tests/ward-supabase-retry.dom.test.tsx` (existing, not re-run today).                                                                                                   |
| Push service                        | `push.test.mjs` "delivery reports sent, expired (404 or 410) or failed" (existing, not re-run today). Whether a failed push ever delays a save is not separately tested. |
| Signed-in site                      | No local fault test. Needs a hosted drill.                                                                                                                               |

## M69. Shift-change load and retry storms (local)

- **Retry spread, fixed:** `startWardPolling` (`ward-shared-polling.ts`) now spreads each backed-off
  retry by up to a quarter either way (15 s becomes 11.25 to 18.75 s; 60 s becomes 45 to 75 s). The
  healthy 3 s cadence is unchanged. Test: `tests/ward-audit-m69-retry-spread.test.ts`, 3 of 3 passed;
  with the spread taken out all 3 fail (checked, then put back). The existing polling and
  permission-drift tests still pass (13 of 13 across the three files).
- **Not spread yet:** the shared client's `online` handler (`ward-shared-client.ts`) reads at once
  on every device when the network returns, and the sign-in restore retries (`RESTORE_RETRY_MS`) are
  fixed. The load run below measures that reconnect burst.
- **Load script, now in the repository:** `scripts/ward-flow/shift-change-load.mjs` (local only).
  100 desks poll the way the browser does, 10 desks save, and halfway through every desk reads the
  whole board in the same second.

| Run (10 Nov 2026)                     | Reads a second | Changed reads p50 / p95 | Unchanged polls p50 / p95 | Reconnect burst p50 / p95 | Saves p50 / p95 | Errors | Saves lost |
| ------------------------------------- | -------------- | ----------------------- | ------------------------- | ------------------------- | --------------- | ------ | ---------- |
| 100 desks, 10 saving, 60 s, 1.5 MiB   | 19.3           | 1,207 / 3,050 ms        | 1,029 / 1,637 ms (56)     | 222 / 802 ms              | 897 / 2,439 ms  | 0      | 0 of 48    |
| 100 desks, none saving, 30 s, 1.5 MiB | 27.7           | 1,109 / 1,925 ms        | 3 / 124 ms (712)          | 1,353 / 2,057 ms          | none            | 0      | none       |

- **No save lost:** the board's revision rose by exactly the 48 accepted saves; 20 lost-reply resends
  all replayed, none applied twice.
- **What it shows:** reads stayed error-free, but the offered 33 reads a second was not reached on
  this shared machine because each read took about a second. With saves going on, nearly every poll
  is a changed read, so every save makes all 100 desks fetch again. The backend's database pool is 4
  connections (`portable-postgres.mjs`, `supabase-postgres.mjs`).
- **Needs Josh:** the response-time target (a Decision), and any hosted or throwaway-copy run
  (spending approval). Re-run this script on an idle machine before quoting a figure.

## M74. "What happened at 03:12?" (offline part)

- The request ID is in the reply header (`x-request-id`), the 500 reply body and the request log
  line (`shared-http.test.mjs`, existing).
- **Gap found:** the Sentry event never carries the request ID, role or screen
  (`failureEvent` in `error-report.mjs` keeps only `errorName` and `errorCode`), and a handled 500
  (`server_error`) is logged but not sent to Sentry; only unhandled failures are. Pinned by
  `backend/ward-flow/trace-drill.test.mjs` (1 passed, 3 todo).
- **Needs Josh:** the hosted drill (one synthetic error traced to a real Sentry event). No Sentry
  event has ever been seen arriving. Browser error reporting (TE-04) is another thread's.

## M78. Hospital network conditions

`tests/ward-audit-m78-captive-portal.dom.test.tsx`, 8 of 8 passed. Each of a 200 login page, a
followed redirect to a portal page, an unfollowed 302, an opaque or blocked answer, a 511, JSON that
is not a board and an old "not modified" for another revision leaves the board **unavailable** with
the last good read's time unchanged; the browser's `online` event then reads again by itself. An old
cached full board never replaces a newer one and never moves the last good read's time, so the
freshness chip turns "Not updating since" on time.

**Limit:** this drives the real `SharedWorkspaceClient` in jsdom with a faked `fetch`, not a browser
against a proxy. A Playwright run needs the shared-mode stack (backend plus Postgres), as CI's
shared-mode journey has. An old cached full board leaves the status "ready" (not "unavailable")
until its age passes the stale limit.

## M82. Database query health (local, offline review)

- **Size:** one workspace with 394,200 audit rows (a year at one a minute for 18 hours a day; 1%
  access changes, 0.05% break-glass), 394,200 command receipts (a year with no pruning) and 200,000
  record openings. `ANALYZE` run. Audit 122 MB, receipts 128 MB, openings 67 MB on disk.
- **Results (`EXPLAIN ANALYZE`, warm):**

| Query (source)                                             | Plan                                | Time    |
| ---------------------------------------------------------- | ----------------------------------- | ------- |
| Audit page, newest 200 (`postgres.mjs` audit)              | Backward index scan on `audit_pkey` | 0.14 ms |
| Audit page, access changes only, deep page                 | Same, 20,800 rows filtered out      | 5.96 ms |
| Same audit page as `wardflow_backend` (row-level security) | Same plan, one extra filter         | 0.08 ms |
| Break-glass proof (`EXISTS` over `audit`)                  | **Parallel sequential scan**        | 49 ms   |
| Command receipt lookup (primary key)                       | Index scan                          | 0.09 ms |
| Receipt prune batch (`prune-receipts.mjs`)                 | Sequential scan, stops at 1,000     | 0.30 ms |
| Record opening repeat and hourly rate check                | `record_access_actor` index         | 0.08 ms |

- **Locks:** no waiting locks during the review. **Pool:** 4 connections per backend copy.
- **Actions (proposals, not done):**
  1. The break-glass proof scans every audit row for the workspace. A partial index such as
     `audit(workspace_id, actor_id) WHERE action = 'BREAK_GLASS'` would make it an index lookup.
     That is a migration, so it needs Josh's yes and its own PR.
  2. The access-only audit page filters through every row it passes; fine at a year (6 ms), worth
     an index on `(workspace_id, sequence DESC) WHERE action LIKE 'ACCESS\_%'` if the audit grows past it.
  3. Keep the 30-day receipt prune running; a year of unpruned receipts is the largest table.
- **Needs Josh:** reading the Supabase performance and security advisors (a provider read).

## M83. Quotas and cost (offline inventory)

- **Board limit, proven fresh:** `performance.test.mjs` "the existing maximum world character
  boundary accepts equality and refuses one character more" and `shared-http.test.mjs` "a save past
  the workspace size limit is refused as full, never as a server fault (H-0291)": 5 of 5 matching
  tests passed. Browser half, new: `tests/ward-audit-m83-board-full.test.ts`, 1 passed and 1 todo:
  a 413 is refused once, never queued or resent, and the board stays ready.
- **Gap:** the browser shows the generic "The action was not applied. Nothing was changed. Check
  the details you entered, then try again." for a full board, where trying again cannot work (todo).
- **Limits known from the repository:** board 8,388,608 characters (database check and
  `postgres.mjs`); size alert from 6 MiB, then a 7-day archive window (`config.mjs`); database pool
  4 per copy; Sentry reports one per kind every five minutes.
- **Not recorded, needs Josh:** the Supabase plan and its limits (database size, egress, auth email
  rate, whether the project pauses when idle, backups), and the Railway usage alert and hard limit.
  Plan names and limits from memory are not evidence; read them from each dashboard and record them
  in the runbook. Any plan upgrade needs a spending approval.

## M110. Runbook cold read (partial)

A cold read of the runbook's [Backup-restore drill](../OPERATIONS-RUNBOOK.md#backup-restore-drill)
while running M40 found these gaps. The first two are fixed in the runbook in this change; the
rest are open.

1. Fixed: the runbook did not name a repeatable, checked-in local drill.
2. Fixed: step 3 asks for the trigger, function and check constraint counts but gives no way to take
   them; the drill test holds the queries.
3. Open: the pass criteria do not mention replaying a sent command or checking for duplicate audit
   rows, which M40 asks for.
4. Open: Option A step 6 needs TLS for a local backend, but does not say how; the drill test avoids
   it by using the store directly, so a sign-in over HTTP against a restored copy is still untested.
5. Open: the rest of the runbook (deploy, rollback, incidents) was not cold-read; a full cold read
   by an agent with no context is still owed (template in [OPERATIONS-DRILLS.md](../OPERATIONS-DRILLS.md#m110-runbook-cold-read)).
