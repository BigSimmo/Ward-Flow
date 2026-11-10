# Compound drills, 10 November 2026

**Audience:** Josh and builders. **Status:** DRAFT drill script plus point-in-time automated evidence. No person has run the manual steps yet. **Owner:** Documentation.

The master audit list (10 Nov 2026) names six compound drills, to run before each client demo or pilot milestone, two at a time. Each mixes failures that are tested one by one elsewhere. This page says what is now automated, what the automated runs found, and the steps a person must still do.

Synthetic data only, on a local machine. No hosted service, provider or live site was used. Nothing here is a speed target: the local machine was shared by about 15 other jobs.

## How to run the automated part

Browser-side halves (Vitest, no database):

```sh
node scripts/run-vitest.mjs run tests/ward-audit-drill-1-offline-revoke-switch.dom.test.tsx \
  tests/ward-audit-drill-2-shift-outage-reconnect.dom.test.tsx tests/ward-audit-drill-3-old-tab-migration.dom.test.tsx \
  tests/ward-audit-drill-4-restore-alerts-saves.dom.test.tsx tests/ward-audit-drill-5-resort-screen-reader.dom.test.tsx \
  tests/ward-audit-drill-6-lost-reply-retry-undo.dom.test.tsx
```

Server-side halves (Node test runner, real loopback PostgreSQL). They skip without `WARD_TEST_DATABASE_URL`, and run in CI's own PostgreSQL job with the rest of the backend suite. Each test makes and drops its own database, so drill 3's rollback never touches other tests.

```sh
cd backend/ward-flow
WARD_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:<port>/postgres node --test \
  ward-audit-drill-2-shift-outage-reconnect.test.mjs ward-audit-drill-3-old-tab-migration.test.mjs \
  ward-audit-drill-4-restore-alerts-saves.test.mjs ward-audit-drill-6-lost-reply-retry-undo.test.mjs
```

Drill 2 runs the 7:00 Perth handover by default. `WARD_DRILL_ALL_SHIFTS=1` adds 15:00 and 21:30.

## Results of the 10 November local run

| Drill                                                          | What is automated                                                                                                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Offline, access revoked, account switch                     | A save made offline by person A; A's role is revoked; person B signs in on the same device; the connection returns                                                                                        | Pass. A's save is never sent under either account. B gets only B's board, with no view mixing in A's board. A's recovery note is never checked under B, and signing out clears it                                                                                                                                                                                                                                          |
| 2. Shift-change load, outage, mass reconnect                   | Server: 100 synthetic users through a fault proxy against a real backend and PostgreSQL. Browser: 100 real clients with the app's own polling                                                             | Pass. Every save landed exactly once (200 accepted saves, 200 revisions). 37 answers were "Database unavailable ... Retry the same command ID" (503) during the bursts, and the retries settled. Median request 4.5 s, slowest 7.4 s on this shared machine. Browser half: during the outage the clients backed off to about one read a minute each, and 20 saves whose replies were lost were replayed, not applied twice |
| 3. Old open tab, migration, waiting saves                      | Server: the previous schema with its backend running, the newest migration applied under it, a new backend beside it, then the rollback script. Browser: an old tab that cannot read the new board format | Pass. Waiting saves landed once each on the old and new backends, Retries replayed, and both backends kept saving after the rollback. The old tab held its waiting saves, sent nothing and said the board was not current                                                                                                                                                                                                  |
| 4. Restore, alerts already sent, waiting saves, recovery notes | Server: a byte copy of the database as the backup, then saves and a sent alert after it, then a backend on the copy. Browser: a tab holding a newer revision than the restored one                        | Pass after the D-129 fix. The restored database has no receipt for the lost saves. A waiting save made against the lost revisions was refused as stale (409). A recovery note for a lost save is never reported as saved. With a new restore marker, the open tab reads the restored board again (finding 1, fixed). **Two findings below**                                                                                |
| 5. Re-sorting list, screen reader, urgent action               | Keyboard focus on a referral row and on an ED row's menu action while another desk's update re-sorts the list and puts an urgent referral first                                                           | Pass. Focus stays on the same control, which still names the same patient, and Enter acts on that patient                                                                                                                                                                                                                                                                                                                  |
| 6. Lost reply, Retry, another desk's Undo                      | Server: two backends, desk A's arrival commits but its reply is lost, desk B undoes it, desk A retries. Browser: the same with a fake server                                                              | Pass. Retry carries the same command identity. The server replays the kept receipt, does not re-apply the arrival, and returns today's board with the Undo standing                                                                                                                                                                                                                                                        |

### Findings

1. **Defect (drill 4), fixed 10 November 2026 (D-129): a tab could show a restored-away board as current.** After a restore, the workspace revision goes backwards. An open tab holding a newer revision ignored every board with a lower revision, so it kept showing changes the restore lost, marked ready. The backend now sends the `WARD_RESTORE_MARKER` setting as `restoreMarker` on every workspace read (`backend/ward-flow/config.mjs`, `shared-http.mjs`), and a tab that sees a new marker reads the restored board again, even at a revision it has seen before. Tests: `backend/ward-flow/ward-audit-drill-4-restore-alerts-saves.test.mjs` and `tests/ward-audit-drill-4-restore-alerts-saves.dom.test.tsx` (no longer skipped). The restore runbook now sets a new marker ([OPERATIONS-RUNBOOK](../OPERATIONS-RUNBOOK.md)). Still owed: a person checking it on a hosted restore, with Josh's yes. Without a new marker the tab still keeps its newer board (pinned by the last test in the browser file).
2. **Finding (drill 4): alerts sent after the backup are sent again.** An alert sent between the backup and the restore is still waiting in the restored copy, so phones get it a second time. An alert about a change the restore lost has already reached phones and cannot be called back.
3. **Finding (drill 4): a lost save's recovery note holds saving on that tab.** After a restore, a recovery note naming a lost save finds no receipt. As designed (#1435), the tab keeps saving held and asks again until the note expires at the end of the access period, then says "outcome not known". After a restore that can be hours. Signing out clears it.
4. **Observation (drill 2): no random spread in polling.** Reads back off 3 s, 15 s, 60 s with no random jitter. The reconnect was spread because each client keeps its own timing and people press Retry at different moments. A mass event that lines clients up, such as every phone waking at once, is not covered.

## Steps a person must do

Each drill needs a person for the parts code cannot prove. Record the date, the build (`main` commit), the devices and the result of each step. Do not record any real name or typed patient text.

### Drill 1. Offline, revoked, account switch

1. On one phone or laptop, sign in as synthetic person A. Turn the network off. Make one change, and check the waiting message.
2. As an access admin on another device, remove A's role.
3. On the first device, sign out of A and sign in as synthetic person B, still offline. Turn the network on.
4. Check: B sees only B's board. No message mentions A's change. A's change is not on the board, in Activity or in the audit list.
5. Repeat with a second browser tab left open as A while B signs in.

### Drill 2. Shift-change load, outage, mass reconnect

1. Needs Josh's yes and a spending estimate before any hosted run. The local run above is the free part.
2. On a hosted copy, with 100 synthetic users at 7:00, 15:00 and 21:30 Perth, stop the backend for five minutes, then start it.
3. Check: every device shows the outage plainly, waiting changes send once when it returns, and the database's connection limit is not exceeded. Record the slowest save and any "Database unavailable" answers.

### Drill 3. Old tab, migration, waiting saves

1. Open the live build in a tab on the evening before a release, go offline, and make two changes.
2. After the 6 am release and its migration, go online in the same tab without reloading.
3. Check: the two changes either send once each or the tab says plainly they could not be checked. Then reload and check the "not sent" message names the right number of changes.

### Drill 4. Restore, alerts, waiting saves, recovery notes

1. Needs Josh's yes before any hosted restore. Use a restore to a new project, never in place.
2. With phone alerts on for one synthetic account, make changes and let one alert send after the backup point. Keep two tabs open, one with a waiting change.
3. Restore and repoint the backend.
4. Check and record: what the open tabs show (expect them to read the restored board once the new `WARD_RESTORE_MARKER` is set; finding 1), whether the phone gets the alert again (finding 2), how long a tab stays held by a recovery note (finding 3), and whether staff can tell which changes were lost.

### Drill 5. Re-sorting list, screen reader, urgent action

1. With NVDA on Windows (Chrome) and VoiceOver on an iPhone, move to a referral row on the Referrals board.
2. From another desk, raise an urgent referral that sorts first.
3. Check: the screen reader stays on the same row and does not read a different patient; the new urgent referral is announced or easy to find; opening and acting from the focused row acts on the patient it names.

### Drill 6. Lost reply, Retry, another desk's Undo

1. On a phone, record an arrival, and cut the network the moment you press it (flight mode), so the reply is lost.
2. On a second desk, undo that arrival.
3. Restore the network on the phone and press Retry.
4. Check: the board shows the arrival undone, the phone says what happened in plain words, and Activity shows one arrival and one Undo, not two arrivals.

## Questions for Josh

1. Is a repeated alert after a restore acceptable (finding 2)? Recommendation: accept it, and add a line to the restore runbook telling staff to expect repeats and to check the board before acting.
