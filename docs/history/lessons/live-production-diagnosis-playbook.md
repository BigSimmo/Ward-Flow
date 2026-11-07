---
name: live-production-diagnosis-playbook
description: "How to diagnose a live psychiatry.tools failure — Sentry carries a useless wrapper, Railway deploymentLogs has the real message, and SUPABASE_DB_URL gives EXPLAIN"
metadata:
  node_type: memory
  type: reference
  originSessionId: fa69685a-38db-4370-b1f2-c9129a7318f0
  modified: 2026-09-20T16:04:04.672Z
---

Worked 2026-09-20 to find why catalogue search was failing on the live site. The order matters,
because the first two sources mislead.

**1. The monitor names the probe, not the cause.** `gh run view <id> --log` on
`live-domain-monitor.yml` prints a per-probe roll-up (`ROOT_SHELL`, `HEALTH`, `ROUTES`,
`CATALOGUE_SEARCH`). It probes `/api/search/universal?q=…&domains=…` and asserts `degraded !== true`.

**2. Sentry is not enough, and looks like it is.** The failure arrives as
`Error: Unhandled server request error`, `mechanism: auto.db.supabase.postgres`, with **no Postgres
code, message or statement** — the Supabase auto-instrumentation captures a wrapper. Timestamps line
up exactly with the failing monitor run, so it is tempting to stop there. It cannot tell you what
broke. (`user.geo: SG` on these events is the GitHub runner, not a user.)

**3. Railway has the real line.** The app logs it properly. `environmentLogs` takes
`environmentId/filter/beforeDate/beforeLimit` and returned nothing for me even with an empty filter —
**treat a zero there as a broken probe, not an absence**. `deploymentLogs(deploymentId, filter,
limit)` works: get deployments via `deployments(first:10, input:{projectId:…})`, pick the newest
`SUCCESS` for the right service/environment (many are `SKIPPED`), then filter. Token is
`RAILWAY_API_TOKEN` in `D:/Repos/Database/.env.local`; endpoint `https://backboard.railway.com/graphql/v2`.
That produced `catalogue_kind=form failure=TimeoutError detail="Canonical form read exceeded 1200ms."`.

**4. The database answers "is it the query?" directly.** `SUPABASE_DB_URL` in the same file plus the
main checkout's `pg` module (via `createRequire`) gives full SQL: `pg_stat_statements` for means,
`EXPLAIN (ANALYZE)` for the plan, `pg_column_size` sums for where the bytes are. Here it exonerated
the query (21 ms) and convicted the payload.

**How to apply:** go monitor → Railway → database, and do not let an HTTP curl from Perth stand in
for server timing — my 2.6–4.9 s `curl` totals included the download and led me to blame latency the
server was not spending. Never print a value from `.env.local`; read it in-process.

Related: [[never-print-env-values]], [[a-clean-negative-that-measured-nothing]],
[[read-the-failure-message]], [[observations-expire]].
