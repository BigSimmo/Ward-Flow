# Railway scoped repair, 4 October 2026

Fresh observations between 17:43 and 17:51 UTC, for task
`01a0fe58-6434-7205-8baa-61d50d5540db` (Railway continuation). This record supplements
the dated [hosting record](../../hosting.md). It does not certify every app workflow.

## Verified target and delivery boundary

- Repository: `BigSimmo/Ward-Flow`, verified fetch and push destination.
- Project: `8d748288-549b-4614-a4c3-30d1dbf3081d`.
- Service: `a45ea3c2-cc8d-4d4b-a76d-1c89f5a79896`.
- Environment: production, `c52294d0-9ae8-46bc-b8cb-522d5f703f11`.
- Public domain: <https://ward-flow-production.up.railway.app>.
- Live deployment: `8c466045-d8e2-4bad-a20b-98e65d5c35e4`, SUCCESS, commit
  `7623de14242707b5f038aad956667a6f673dc1df`.
- Repository main at inspection: `d37ec244e479f6861c7871595a1be84602f2435f`.
  Its deployment was SKIPPED; the only intervening changes were documentation.
  Its [exact-head CI run](https://github.com/BigSimmo/Ward-Flow/actions/runs/37209189657)
  completed successfully. This is main evidence, not this report branch's CI.

No application code or dependency change was justified by the inspected evidence.
No merge, restart, redeploy, source reconnection, tracing enablement, load test,
new resource, access change or billable API was performed. Existing ownership,
forecast and community candidates and their publication restrictions remain separate.
PR46 was not changed.

## HTTPS, latency and network observations

The service was online with one running replica out of one, zero crashed replicas,
no recent failures, no active warning/critical notifications and no pending work.
The Railway-managed domain routes to port 8080; no custom-domain DNS setup or
separate certificate correction was indicated.

A direct HTTPS GET to `/api/health` returned `200` and `{"status":"ok"}`.
Observed client times in seconds: DNS 0.051, TCP connected 0.194, TLS complete
0.355, first byte 0.512, total 0.513. These are cumulative timings from one
request, not a latency benchmark. The initial sandbox request was blocked;
the authorised request outside that network restriction succeeded. The sandbox
failure is not evidence of a Railway outage.

The Railway 24-hour sample returned 2,849 requests: 2,844 2xx, five 3xx, zero
4xx and zero 5xx. The worst hourly p95 was 220 ms and its p99 was 1,234 ms.
Sparse buckets and an isolated tail do not establish a reproducible app defect.
CPU usage peaked at approximately 0.062 vCPU; memory peaked at 0.249 GB.

The inspected recent HTTP sample contained successful page, asset and health
responses with empty upstream-error fields. Network-flow samples had no reported
drop cause, but were partial captures with zero latency values; these do not
establish complete connection coverage. The DNS log sample was empty, which is
not proof that no DNS failures occurred. Tracing remains disabled.

No active outage or reproducible infrastructure latency/network failure was found.
HTTP success does not prove browser interactions, persistence or other app workflows.
No scale, region or networking change is justified by these observations.

## Health-check configuration corrected for the next deployment

Both initial configuration and status reads showed no `healthcheckPath` and no
staged changes. The existing source route returns HTTP 200 with `Cache-Control:
no-store`; it makes no external calls and is a liveness probe.

The exact production service was updated using only `healthcheckPath: /api/health`.
The update tool explicitly states that this configuration applies on the next
deployment and does not redeploy the current service. Its successful result and
subsequent configuration read confirmed the path. Readback also reported
`healthcheckTimeout: 60`; no timeout was supplied in the request.
The same live deployment remained SUCCESS and no staged changes were present.

This is a saved configuration correction, not evidence that a new deployment
passed its probe. At the next separately authorised deployment, verify the exact
commit, successful probe, live replica and HTTPS response. Railway health checks
run during deployment, not continuously, according to its
[health-check documentation](https://docs.railway.com/deployments/healthchecks).

## Dependency finding and compatible-fix assessment

The live build reported five high-severity npm audit entries. A fresh full audit
of main's existing lockfile reproduced five high entries, all arising from
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):

`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.

All five packages are development dependencies in the lockfile. The live commit
and inspected main have identical root manifests and lockfiles. A fresh
`npm audit --omit=dev --package-lock-only --json` returned zero vulnerabilities.
Thus five affected dependency nodes describe one advisory, not five independent
runtime vulnerabilities. No application import path to this chain was identified.
This does not dismiss untrusted development/build input risk or prove built-image
package removal.

The advisory lists affected `braces <=3.0.3` with no patched version. The registry
confirmed latest `braces` 3.0.3, `micromatch` 4.0.8 depending on `braces ^3.0.3`,
and `fast-glob` 3.3.3 depending on `micromatch ^4.0.8`.
There is no compatible published patch to pin. npm proposes `eslint-config-next`
14.2.35, a major downgrade from the project's aligned Next/ESLint 16.3.6 family.
That proposed downgrade is not a safe automated repair. No forced audit fix,
dependency override or framework downgrade was applied. Review a compatible
upstream patch when published; do not treat the production-only clean audit as
full-tree cleanliness.

## Remaining CI-wait decision and exact action

Railway source configuration still reads `checkSuites: false`. The repository
workflow runs on pushes to main and prevents main-run cancellation. It meets
Railway's documented prerequisites for
[Wait for CI](https://docs.railway.com/deployments/github-autodeploys).
The older hosting record says Actions were disabled at setup; that historical
reason no longer establishes why CI wait should remain off.

Recommended next action: for this exact production service, enable **Wait for CI**
in Railway service settings after confirming the intended deployment policy and
that the dashboard save will not initiate a build/redeploy. Keep the source repository,
branch and GitHub permissions unchanged. Then re-read `source.checkSuites: true`
and verify the next authorised main deployment waits for its exact-head workflow.
This changes deployment timing, not the repository's intentionally removed gates.

The available `update_service` tool has no `checkSuites` field. Reconnecting the
source can build immediately, so it was not used as a workaround. No GitHub
permission change or deployment is authorised by this report. A dashboard-capable
operator or supported non-deploying update API is needed to finish this correction.

Railway evaluates workflow conclusions rather than individual jobs: failures skip
deployment; skipped/neutral workflows do not block; cancellation and the two-hour
timeout have documented qualifications. CI wait alone is not every app acceptance gate.
