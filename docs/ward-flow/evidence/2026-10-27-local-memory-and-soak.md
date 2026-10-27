# Local memory and soak measurements (H-0646, H-0965)

_Updated 2026-10-27 - first local run; synthetic data only; local machine only, no hosted service touched._

Approved by Josh in chat, Oct 27, 2026, 8:06 PM AWST. Everything here ran on Josh's Windows PC against a
loopback PostgreSQL 17 in Docker (`127.0.0.1:55432`) holding only synthetic data. The live site, Railway
and Supabase were not contacted. No screenshots were taken.

## H-0646: backend memory, 50 desks reading a 6 MiB board

Script: `scripts/ward-flow/backend-memory-load.mjs`. It runs the real workspace store and HTTP handler
(`backend/ward-flow/postgres.mjs`, `server.mjs`) in a child process. Sign-in is replaced by a local
stand-in, because the real verifier needs Supabase. The seeded board is grown with made-up departed stays
(`ZZ-TEST` names, `ZZ000001` style UMRNs) until it is about 6 MiB. Each desk is a statewide bootstrap
coordinator, so every reply is the whole board (the heaviest case). Desks poll like the browser:
every 3 s with `since`, and a full read the first time.

Run: 50 desks, 603 s, Node 24.19.0, pool of 4 connections.

| measure                              | value                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| full board reply (uncompressed JSON) | 5.6 MiB                                                                               |
| idle RSS / heap used before load     | 101.2 MiB / 27.6 MiB                                                                  |
| peak RSS                             | 784.5 MiB (at 22 s, during the first 50 full reads)                                   |
| peak heap used                       | 253 MiB; peak external (buffers) 337 MiB                                              |
| steady RSS (second half of run)      | 128.3 MiB, flat between 125 and 131 MiB from 35 s to 600 s                            |
| steady heap used                     | 47.7 MiB                                                                              |
| request rate                         | 15.6 a second (9,362 unchanged polls, 50 full reads)                                  |
| unchanged poll latency               | p50 26 ms, p95 209 ms, p99 966 ms                                                     |
| full read latency                    | p50 7.2 s, p95 8.3 s, max 8.9 s                                                       |
| errors                               | 45 requests answered 503 and 41 hit the 12 s handler deadline, all in the first ~30 s |

Reading: memory is set by the cold start, when every desk asks for the whole board at once. Each full read
builds and compresses a scoped copy, so 50 at once briefly needed about 0.8 GB. Once desks hold the board,
unchanged polls cost little and the process sat near 128 MiB for the rest of the run. The cold start also
overran the 12 s deadline and the 4 connection pool for some desks; they recovered on their next poll.
Writes were not part of this run, so a busy save period (which changes the revision and forces full
reads) would sit between these two figures. Local loopback has no Singapore to Sydney round trip, so
hosted latency will be higher.

Question for Josh: what memory limit does the Railway plan give `ward-flow-backend`? A limit under about
1 GB could be hit when many desks reconnect at once after a restart.

## Josh's decision

Deferred. Josh, in chat at about 9:14 PM AWST on 27 Oct 2026: "H-0646: don't change the Railway memory limit
yet". This replaces an earlier relayed instruction recorded here a few minutes before.

No Railway setting was changed, and none will be changed now. Recommendation noted for later: 2 GB per replica
for `ward-flow-backend` (production), given the local cold-start peak of about 0.8 GB. Any change is a separate
live write that needs Josh's exact approval of the value, and the plan may cap it. Railway facts at the time:
live `ward-flow-backend` memory over the last hour was about 0.15 GB (max 0.151 GB), no memory limit is visible
in the service config, and the plan limit is unconfirmed.

## H-0965: TV and desk left open

Script: `scripts/ward-flow/browser-soak.mjs`. It starts `next start` on `127.0.0.1:3917` from a local
production build, opens the bed meeting TV (`/ward-flow/bed-meeting?service=all`) and one ward board
(`/ward-flow/board/rph-adult-secure`) in headless Chromium, and every 10 minutes records each page's JS heap
(Chrome DevTools `Performance.getMetrics`) before and after a forced garbage collection, plus DOM nodes and
listeners.

Limit: the pages run in local mode (the default). Shared mode needs a Supabase sign-in in the browser,
which this local-only run could not use, so these pages do not poll the backend. The clocks, timers and
TV views run as usual.

Started 27 Oct 2026, 8:53 PM AWST, aimed at 24 hours. First samples:

| page | heap used MiB | after GC MiB | DOM nodes | listeners |
| ---- | ------------- | ------------ | --------- | --------- |
| TV   | 15.47         | 10.35        | 1,123     | 1,073     |
| desk | 18.71         | 10.77        | 3,138     | 914       |

The verdict comes after the run, from the after-GC column.

## Rerun

```powershell
docker run -d --name wf-memsoak-pg -e POSTGRES_PASSWORD=<local only> -e POSTGRES_DB=wardsynthetic -p 127.0.0.1:55432:5432 postgres:17
npm --prefix backend/ward-flow ci; npm --prefix backend/ward-flow run build:engine
$env:WARD_TEST_DATABASE_URL = "postgresql://postgres:<local only>@127.0.0.1:55432/wardsynthetic"
node scripts/ward-flow/backend-memory-load.mjs --desks 50 --minutes 10 --mib 6 --csv <scratch>/memory.csv
npm run build
node scripts/ward-flow/browser-soak.mjs --out <scratch folder> --hours 24 --every-minutes 10
```

The load script refuses a database URL that is not loopback. Stop the soak early by creating `STOP` in its
output folder; its PID is in `soak.pid` there.
