# Release timing and the post-release check (draft drill and record)

_Draft, 10 November 2026, audit items M71 (the 6 am release path) and M67 (release check pack and
post-release check, with M52 headers). Audience: Josh and whoever runs a release. Owner: Josh.
Lifecycle: draft until the first five records below are filled in. Evidence boundary: written from
source at main 29352cd0; **no release, Railway read or live check has been run for this page.**
Rolling back is in the [runbook](OPERATIONS-RUNBOOK.md#rolling-back-the-app); its timing drill is M41._

## The schedule

`.github/workflows/daily-release.yml` runs at `0 22 * * *` (22:00 UTC). Perth keeps UTC+8 all year,
so that is 6 am every day. GitHub often starts an on-the-hour schedule late, sometimes by 30 minutes
or more. The run then fast-forwards `live`, and Railway builds and deploys each service whose watch
paths changed. The target is **every service finished before 6:45 am Perth**, ahead of day shift.

A late or doubled run is safe: the release reads no clock except to name the release record, and a
second run finds live already released and changes nothing
(`tests/ward-audit-m80-scheduled-jobs.test.ts`, `tests/ward-daily-release-retry.test.ts`).

During a pilot the schedule is off and releases are weekly by hand (runbook, "During a pilot").

## M71 drill: five recorded releases

For each of the next five scheduled releases, a person with Josh's yes for the GitHub and Railway
reads fills in one row. All times Perth. Reading Railway is a provider read and needs that yes.

| Date | Run queued | Run started | `live` moved | `ward-flow` deployed | `ward-flow-shared` deployed | `ward-flow-backend` deployed | All before 6:45? |
| ---- | ---------- | ----------- | ------------ | -------------------- | --------------------------- | ---------------------------- | ---------------- |
|      |            |             |              |                      |                             |                              |                  |
|      |            |             |              |                      |                             |                              |                  |
|      |            |             |              |                      |                             |                              |                  |
|      |            |             |              |                      |                             |                              |                  |
|      |            |             |              |                      |                             |                              |                  |

Where to read each time: the release run's page (queued and started), its log line "Released
&lt;sha&gt;" (`live` moved), and each Railway service's deployment list (the newest SUCCESS whose
commit is that sha; a SKIPPED service did not need to deploy, so write "skipped").

If any of the five misses 6:45, the fix is a decision for Josh: move the cron earlier (for example
`0 21 * * *`, 5 am Perth; the main CI nightly at 18:00 UTC still finishes first) or off the hour
(for example `17 21 * * *`), which GitHub delays less.

## M67: the post-release check

`scripts/ward-flow/post-release-check.mjs` is the check that follows a release. It is read-only:

1. **Railway runs live's commit.** Waits until each of `ward-flow`, `ward-flow-shared` and
   `ward-flow-backend` reports the commit `live` points at. Today it reads a names-and-commits JSON
   file a person copies from Railway; reading Railway from the workflow needs a Railway token in
   the repo's secrets, which is Josh's decision.
2. **Health.** `/api/health` on both sites and `/healthz` on the backend.
3. **Security headers (M52).** The signed-in site's front page must send every header
   `src/lib/security-headers.ts` builds for a hosted site, and a content security policy with
   `frame-ancestors 'none'` and a script nonce. A test keeps the script's list equal to the code's.
4. **Synthetic sign-in and read.** The uptime monitor's synthetic account signs in, loads
   `/v1/workspace`, and signs out.

It prints and can save (`--out`) one record with a pass or fail per check. It refuses any address
that is not local unless given `--yes-live`, which stands for Josh's yes on the day. A synthetic
**save** on live is a write and is deliberately not part of it; it needs its own yes.

Offline evidence: `tests/ward-audit-m67-post-release-check.test.ts` (each check passing, each
failing, Railway behind, a failed Railway read, the monitor account unset, the `--yes-live` refusal).

### Still to do (needs Josh)

- Run it once against live after a release, with his yes, and keep the record under
  `docs/ward-flow/evidence/`.
- Decide whether a workflow step runs it after each release. That needs a Railway read token and
  the monitor secrets in that workflow, and moves it from "a person runs it" to "it runs itself".
