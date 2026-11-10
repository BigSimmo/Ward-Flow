# One-person risk: ownership map (draft)

_Updated 2026-11-10 - first draft for master audit list item M75; Documentation owns._

**Status: DRAFT, not signed.** Nothing here names a deputy or grants anyone access. Josh fills the
blanks, signs it, and the tabletop in [OPERATIONS-DRILLS.md](../OPERATIONS-DRILLS.md#m75-responder-tabletop-with-josh-absent)
is run with Josh absent before real data. Names of secrets only; never their values.

## While the data is synthetic

Josh is the only responder, and that is accepted: D-97 item 5 makes Josh the owner of monitoring,
licence and downtime while Ward Flow is a prototype. `.github/CODEOWNERS` names one owner for every
path and says to add a second once governance names one.

## Before real data (the M75 gate)

A named deputy can respond, release, roll back and rotate keys without Josh; every bot and owner
token is listed with who can replace it; `CODEOWNERS` names a second owner.

### People

| Role                                        | Primary | Deputy (to name) | Signed (date) |
| ------------------------------------------- | ------- | ---------------- | ------------- |
| Repository owner (merge, release, rollback) | Josh    |                  |               |
| Hosting and database (Railway, Supabase)    | Josh    |                  |               |
| Monitoring and alerts (Sentry, uptime)      | Josh    |                  |               |
| Access admin (accounts, resets)             | Josh    |                  |               |

### What the deputy must be able to do

| Action                  | Needs                                                                   | Deputy can? |
| ----------------------- | ----------------------------------------------------------------------- | ----------- |
| Respond to an outage    | Railway and Supabase dashboard access; the runbook's incident table     |             |
| Release ("release now") | Permission to run the daily release workflow                            |             |
| Pause releases          | Repository Actions variables (`WARD_RELEASE_PAUSED`)                    |             |
| Roll back               | The runbook rollback route, including moving `live` (branch protection) |             |
| Rotate keys             | Each secret's source (table below) and where it is set                  |             |
| Approve a pull request  | Being a second code owner                                               |             |

### Tokens and secrets (names only)

Taken from the repository on 10 November 2026: GitHub Actions secrets referenced by workflows, and
the backend's settings in `backend/ward-flow/config.mjs` and related files. Who can replace each one
is for Josh to fill in.

| Name                                                    | Where it is set           | What it is for                         | Who can replace it |
| ------------------------------------------------------- | ------------------------- | -------------------------------------- | ------------------ |
| `WARD_FLOW_MONITOR_EMAIL`, `WARD_FLOW_MONITOR_PASSWORD` | GitHub Actions secret     | The synthetic monitor's sign-in        |                    |
| `WARD_FLOW_SUPABASE_PUBLISHABLE_KEY`                    | GitHub Actions secret     | The monitor's Supabase client key      |                    |
| `WARD_FLOW_UPTIME_TOKEN`                                | GitHub secret and Railway | The protected `/healthz` answer        |                    |
| `WARD_SUPABASE_PRUNE_DATABASE_URL`                      | GitHub Actions secret     | The receipt prune job's database login |                    |
| `WARD_SUPABASE_DATABASE_URL`                            | Railway (backend)         | The backend's database login           |                    |
| `WARD_FLOW_VAPID_PRIVATE_KEY` and pair                  | Railway (backend)         | Phone push signing                     |                    |
| `SENTRY_DSN`                                            | Railway (backend)         | Server error reporting                 |                    |
| The workflow `GITHUB_TOKEN`                             | GitHub, per run           | Issued per run; nothing to rotate      | GitHub             |
| Bot and owner personal tokens                           | Not in the repository     | To be listed by Josh                   |                    |

## Sign-off

- Josh: ______________________ date ________
- Deputy: ____________________ date ________
- Tabletop with Josh absent passed: date ________ (record in OPERATIONS-DRILLS.md)
