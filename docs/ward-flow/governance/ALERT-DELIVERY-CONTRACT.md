# Alert delivery contract (draft question and drills)

_Created 2026-11-10 - audit items M20 and M21; drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`). Draft only: nothing here is decided._

**Status:** a question for Josh, then three drills nobody has run. Ward Flow holds synthetic data
only, so nobody is paged at night (D-111 item 7). This paper must become a D entry in
[decisions.md](../decisions.md) before real data. The drills come after that ruling.

## 1. What phone alerts do today (verified in source, 10 Nov 2026)

- **Grouped counts, not pages.** One notification per sweep per desk, naming a count and a site
  only (`backend/ward-flow/push.mjs` `pushPayload`). Three kinds: act now (coordinator and place
  desks), transport jobs (officer), team updates (community). A desk hears one kind
  (`engine.ts` `scopedActNowAlerts`).
- **No acknowledgement.** Nothing records that a person saw or answered a push. The alert stays
  on Alerts and Tasks until the record changes.
- **Best effort delivery.** Each push lives one hour (`TTL: 3600`), urgency high. A device that
  answers 404 or 410 is dropped; 403 is not retried; other failures retry up to
  `MAX_DELIVERY_ATTEMPTS` (5) sweeps (`postgres.mjs`).
- **Recipients.** Current role holders only, and sends stop after removal, term end or cover end
  (`backend/ward-flow/access-push-lifetime-repairs.test.mjs`, real PostgreSQL in CI).
- **Privacy.** Count and place only. `tests/ward-audit-m21-push-name-marker.test.ts` feeds a
  synthetic name marker through every push and notification builder and fails if it reaches a
  payload. The service worker replaces any words that do not match the server's templates
  (`tests/ward-pwa-worker.test.ts`).
- **"Synthetic demo data."** Every push body ends with these words. They must change before real
  use, and the service worker's templates (`public/ward-flow-push-sw.js` `PUSH_BODIES`) must
  change with them, or every real push shows the fallback text. **Needs Josh** (part of the
  real-data gate).

## 2. The question for Josh (M20)

**Before real data, which alerts are urgent, who must acknowledge them, and what happens when
nobody does?**

| Option                                          | What it means                                                                                                                                                                                                                                                                     | Cost and risk                                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **A. Keep push as a prompt only** (recommended) | Push stays grouped counts with no acknowledgement. The safety net is the screen: act-now rows stay on Alerts and the Handover sheet until dealt with, and the site's existing paging (switchboard, phone) stays the only paging system. Written into the pilot's local procedure. | No new build. Relies on staff looking at the screen; the pilot procedure must say so plainly.                             |
| B. Acknowledge urgent pushes                    | A named list of act-now kinds needs an "I've got it" tap from the receiving desk. Unacknowledged after N minutes, the coordinator sees it as act now.                                                                                                                             | New command, new audit row, a desk (not a person) owns the acknowledgement. Needs a clinical choice of which kinds and N. |
| C. Escalate to a pager or phone call            | Unacknowledged urgent alerts go to a paging provider.                                                                                                                                                                                                                             | A billable provider, a new data flow to review for privacy, and clinical sign-off. Largest change.                        |

**Recommendation: A** for the pilot, because Ward Flow is not validated clinical decision
support and a push that silently fails must never be the only way urgent work is found. Revisit B
if the pilot shows act-now rows waiting unseen.

Whatever is chosen, the D entry should name: the urgent kinds, the desk that answers, the time
limit, and who is told when nobody does.

## 3. Drills (after the ruling, before real data)

Each drill is run on a pilot device with synthetic data, and recorded in
`docs/ward-flow/evidence/` with date, device, browser and who ran it. **None has been run.**

| Drill           | Set up                                                        | Do                                                           | Pass when                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Push denied** | Desk signed in; browser notification permission set to Block. | Raise an act-now row (demo clock or a synthetic referral).   | Settings says phone alerts are blocked and how to fix it; the row is on Alerts and the Handover sheet within one poll; nothing claims a push was sent.                                   |
| **Device off**  | Phone alerts on; device switched off or in flight mode.       | Raise an act-now row, wait 70 minutes, switch the device on. | No stale push is shown after its one-hour life, or if shown it opens Alerts with current data; the row is still on the screen for whoever is on shift; the delivery log names no device. |
| **Silenced**    | Phone alerts on; device on Do Not Disturb or silent.          | Raise an act-now row.                                        | The push arrives silently (no sound expected); the row is on Alerts; the procedure from section 2 says who else sees it.                                                                 |

What a person still has to do: Josh rules on section 2 (a D entry), the pilot site names the
device and the person who runs the drills, then each drill is run and recorded.
