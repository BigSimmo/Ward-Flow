# Ward Flow Railway operations

An on-demand diagnosis using existing Git, GitHub CLI and Railway tools. This is
guidance, not a new gate, background monitor, merge controller or approval process.
Use the authority already granted for the task. Preserve owner-held work and ask
only when a proposed action adds effects outside that authority.

## What happened and what actually needed fixing

| Observation on 4 October 2026                                       | Cause or interpretation                                                                                                                                                         | Correction and evidence                                                                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The source had `/api/health`, but Railway had no health-check path. | Confirmed configuration gap: having a route does not configure the provider. Who removed or omitted the setting is unknown; no change audit established that cause.             | Saved `healthcheckPath=/api/health`. A later main deployment succeeded with that setting. Railway's probe tests startup liveness, not every app workflow or continuous uptime.                   |
| GitHub Actions was active, but `source.checkSuites` was false.      | The setup record said Actions was disabled originally. The later GitHub/Railway settings were not aligned; the exact change history is unknown.                                 | Enabled Wait for CI without redeploying. The next app deployment waited for its exact main workflow, then succeeded.                                                                             |
| New main was not live while coverage ran.                           | Expected pipeline behaviour, not a failed deployment. The latest deployment was WAITING; the previous successful deployment kept serving. Coverage was the last unfinished job. | Preserve the gate and inspect the unfinished job. CI and deployment both succeeded for `7ea5ab6aebcdc25fffb9cd86ab0249e39d5316ba`.                                                               |
| Documentation commits were SKIPPED.                                 | Expected watch-path behaviour. Documentation did not change app/build inputs.                                                                                                   | Confirm the live-to-main changed paths against configured watch patterns. No redeploy is needed solely to match a documentation SHA.                                                             |
| Local main lagged behind remote main.                               | Local refs update independently; the working checkout was also on a feature branch with dirty owner files.                                                                      | Fast-forwarded local main in clean isolated worktrees to verified remote main. Owner files were not swept into a commit.                                                                         |
| npm printed five high vulnerabilities.                              | Five affected package nodes traced to one development-only `braces` advisory, not five independent runtime flaws.                                                               | Production-only audit returned zero; no published patched `braces` release was available. The suggested ESLint downgrade was not applied. This remains an upstream development/build-input risk. |

These are observations of named revisions, not promises about future settings.
The [incident report](reports/railway-repair-2026-10-04.md) records the initial
evidence. Its pending-CI-setting section is historical: the approved correction
was subsequently completed. The successful deployment above also incorporated
the capacity, movements and on-call changes from `59ee806`.

## Read the four states separately

Record **local main**, **remote main**, **live deployment** and **pending
deployment** as full SHAs. Include a dirty-worktree count and the unfinished or
failed exact-head CI job. A green PR head, latest deployment entry, stale
`origin/main`, or successful health response cannot substitute for this comparison.

On Josh's Windows desktop, these commands read state without committing, merging,
fetching, deploying, restarting or changing settings. They need the existing
authenticated CLIs; a login failure is missing evidence, not an app outage.
Run Git commands from the intended Ward Flow checkout.

```powershell
git remote get-url origin
git remote get-url --push origin
git branch --show-current
git status --short
git rev-parse main
$wardRemoteMain = gh api repos/BigSimmo/Ward-Flow/commits/main --jq .sha
$wardRemoteMain
gh run list --repo BigSimmo/Ward-Flow --commit $wardRemoteMain --json databaseId,headSha,status,conclusion,url
railway deployment list --project 8d748288-549b-4614-a4c3-30d1dbf3081d --environment c52294d0-9ae8-46bc-b8cb-522d5f703f11 --service a45ea3c2-cc8d-4d4b-a76d-1c89f5a79896 --limit 10 --json
```

Both remote URLs must identify `BigSimmo/Ward-Flow`. For each Railway entry read
`id`, `status` and `meta.commitHash`. The newest entry can be pending; do not call
it live. Identify the current successful deployment separately from WAITING,
BUILDING, DEPLOYING, SKIPPED or REMOVED entries. If the list is ambiguous, use the
connector's `environment_status` with `includeSuccessful=true` and its active
deployments/replicas, or the dashboard's active deployment. Report unavailable
live revision evidence as unknown.

Inspect the exact main run from the returned run ID:

```powershell
gh run view RUN_ID --repo BigSimmo/Ward-Flow --json headSha,status,conclusion,url,jobs
```

Replace `RUN_ID` with the observed ID. Read the jobs and steps: a successful job
that skipped its tests is not evidence that those tests executed. If more than
one workflow exists for the commit, inspect their conclusions as well; Railway
waits on GitHub Actions workflow conclusions, not just the PR's individual jobs.

For a skipped deployment, compare actual changed paths with the service's actual
watch patterns. `git diff --name-only LIVE_SHA REMOTE_MAIN_SHA` is a local read
when both commits are available; replace the placeholders with observed full
SHAs. If an object is missing, obtain it through an ordinary authorised fetch
before drawing conclusions. Do not guess the skip reason from the status alone.

The connector's `describe_service` reads the saved health-check path, source branch,
CI-wait setting, watch patterns and staged changes without reading variable values.
Use that or the dashboard; do not dump credentials or environment variables for
this diagnosis. Reading configuration is different from changing it.

## Act on the actual state

| State                                                | Next useful action                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WAITING with exact-head CI queued/running            | Report the unfinished job and its start time. Allow the existing run to finish. Observe at meaningful boundaries; do not start another deploy or disable CI wait.                       |
| WAITING with a failed CI workflow                    | Diagnose that workflow's failed step. Fix a reproducible scoped failure through ordinary ownership and checks. A main deployment must not bypass it.                                    |
| Exact-head CI succeeded but deployment still WAITING | Recheck all workflows for that SHA and the existing deployment. If the state persists, investigate the integration/event path. Do not assume a rebuild fixes an event-delivery problem. |
| BUILDING or DEPLOYING                                | Read the existing deployment's build/startup/probe evidence. This is progress until a failure, timeout or reproducible stalled state is established.                                    |
| FAILED or CRASHED                                    | Inspect logs for that exact deployment and its last failed stage. A build, startup, probe, routing and application error require different fixes.                                       |
| SKIPPED with only unwatched documentation changes    | Expected. The app can be current while its commit SHA differs from main. Confirm paths; do not redeploy for cosmetic SHA equality.                                                      |
| SKIPPED despite watched app changes                  | Inspect the reported skip reason, source branch, watch patterns and exact-head CI. Railway can also skip failed or timed-out CI; this is not necessarily a watch-path bug.              |
| Local main behind remote, ancestry is clean          | In an authorised clean worktree, use ordinary fetch and `git merge --ff-only origin/main`. Keep dirty owner worktrees intact.                                                           |
| Local main diverged or owner files are dirty         | Identify exact committed candidates and owners. Use reviewed ordinary merges where authorised; do not reset, rebase or commit every dirty file to make SHAs match.                      |
| Live commit matches expected app inputs              | Verify the public health endpoint and affected route. Deployment success and HTTP success do not certify every browser workflow.                                                        |

The [Wait for CI documentation](https://docs.railway.com/deployments/github-autodeploys)
describes failure/cancellation/neutral handling and the two-hour wait limit.
The coverage job's repository timeout is separate; inspect the actual workflow
before calling a long-running job hung. Missing checks are unknown, not green.

## Why a wait or 404 is not automatically a fault

`WAITING` is a coordination state while the previous app can remain available.
Watch-path `SKIPPED` means there may be no changed application to deploy.
An intentional retired route, disabled preview or unavailable synthetic entity can
legitimately return 404. Verify the intended path and runtime contract before
changing routing or loosening an access gate. A 404 from the configured health
endpoint during startup is actionable because that endpoint is expected to
respond successfully for that deployment. A request blocked by the execution
sandbox is client-side access evidence, not proof of a public outage.

After an expected deployment becomes active, make a small HTTPS smoke check:

```powershell
curl.exe --max-time 20 --silent --show-error --write-out "\nHTTP %{http_code}; TLS %{ssl_verify_result}\n" https://ward-flow-production.up.railway.app/api/health
curl.exe --max-time 20 --silent --show-error --output NUL --write-out "HTTP %{http_code}; TLS %{ssl_verify_result}\n" https://ward-flow-production.up.railway.app/mockups/ward-flow/wards
```

Use the affected route for the task; the wards route is an example. The health
contract is HTTP200 and `{"status":"ok"}`. Railway
[health checks](https://docs.railway.com/deployments/healthchecks) run during
deployment, not continuously. This workflow needs no polling service, paid alert,
load test or extra mandatory gate.

## Keep dependency evidence in proportion

Read the affected packages, unique advisories, production/development paths and
compatible patched versions separately. `npm audit --omit=dev --package-lock-only`
can help distinguish production dependencies, but does not prove build-image
package removal or dismiss untrusted build input risk. The initial five entries
were `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) had no
published patch at inspection. Recheck upstream when maintaining dependencies;
do not force an unrelated framework downgrade to remove the audit count.
