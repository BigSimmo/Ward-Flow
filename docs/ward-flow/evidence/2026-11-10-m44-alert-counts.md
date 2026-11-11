# Alert counts on a busy synthetic day (M44)

_Created 2026-11-10 - audit item M44; branch `claude/project-thread-bnphlk` (from `main` `29352cd0`). Offline, synthetic seed only._

**What this is:** the count report M44 asks for. `tests/ward-audit-m44-alert-fatigue.test.ts`
advances the demo clock through 24 hours in 30-minute steps from the seed (10:42 on day 0) and
counts, per role and per shift, the rows that are new since the last look. The first look is the
baseline and is not counted. Phone push is counted for the whole network (the coordinator's desk).

**What it is not:** a measure of a real ward. The seed raises most of its work in its opening
hours and little after, so night is empty. Re-run when alert rules change, and once on the pilot
site's own synthetic scenario before real data.

Re-run: `M44_REPORT=1 npx vitest run tests/ward-audit-m44-alert-fatigue.test.ts --silent=false`

## Counts, 10 Nov 2026 run

Red is act now, amber is due soon or other task rows. Roles not shown had none in any shift
(community; every role at night).

| Role                      | Shift                 | New red | New amber |
| ------------------------- | --------------------- | ------- | --------- |
| Coordinator               | Day (07:00-15:00)     | 10      | 1         |
| Coordinator               | Evening (15:00-23:00) | 3       | 0         |
| Site bed manager          | Day                   | 10      | 1         |
| Site bed manager          | Evening               | 3       | 0         |
| ED                        | Day                   | 2       | 0         |
| Ward (all wards together) | Day                   | 0       | 1         |

| Phone push (whole network) | New act-now items | Notifications sent |
| -------------------------- | ----------------- | ------------------ |
| Day                        | 10                | 5                  |
| Evening                    | 3                 | 3                  |
| Night                      | 0                 | 0                  |

## What the test checks every run

- A push is one grouped notification per sweep, never one per alert.
- No row is listed twice at once, and an alert that stays active is announced once.
- No row is both act now and calm at the same moment.
- A burst of 40 due-soon rows with one act-now row: the act-now row gets its own notification,
  quiet hours hold the due-soon rows but never the act-now one, and the coordinator's phone hears
  act now only.

**Still for a person:** judge whether 10 new act-now items in a day shift is too many for one
coordinator, once the pilot site's scenario is loaded. That is a clinical and workload judgement.
