# Tier 1–4 implementation evidence

Audience: owner and implementers. Status: local implementation verified; external acceptance remains blocked. Owner: this task.
Baseline: `559f225892b27b6c42bd7e9a6fa81f3ef81e62ec`; branch `codex/tier-improvements-20261104`.
The [implementation index](../plans/2026-11-04-tier-improvements.md) holds the agreed scope.

## Source reconciliation

- The planning checkout was `b6aa5cd`; source was refreshed with owner approval before edits.
- The current baseline has a panel boundary and an in-memory offline queue. Retain them.
- Recovery still retains one command identity. A list of identities cannot reconstruct unsent content.
- Existing coordinator “since you looked” code must be extended, not replaced.
- Open PRs overlap shared client, seed, alerts, kit, API/backend and operational files.
  The owner approved exact local scoped changes, preserving peer work; issue 688 records that scope.
- Current `AGENTS.md` uses branch/open-PR ownership; a missing legacy sign-out log is not a blocker.
- Node 24.22.1 is the current floor. Do not weaken it for the host's older default runtime.

## Delivery against the approved plan

| IDs                        | Local result                                                                                                                                                       | Remaining acceptance                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| AUD, Z2, O1                | Reconciled the refreshed main baseline, preserved historical documents and added the implementation index                                                          | Undescribed Tier 4 references remain unassessed                           |
| N1                         | Retained the existing shared-build seed replacement; removed redundant compiler caches around manually memoised access; measured all 45 route destinations/aliases | All five budgeted routes pass unchanged limits                            |
| A1, B1, U1                 | Ordered, scope-bound identities only; legacy migration, expiry, per-command outcomes and strict receipts; failed durable queued-to-sent transition prevents a POST | Unsent content deliberately cannot survive reload                         |
| C1, C2, A2, X1, Q1         | Five-minute age banner, last-good time, one active Retry surface, 3/15/60 second polling, voluntary sign-out guard and authorised screen return                    | Native screen-reader/device acceptance                                    |
| B2, E2                     | Exact own-command Activity review; current working role, receipt context, Undo sequence/window and confirmed inverse                                               | WebKit phone journey                                                      |
| D1, V1, R1, L1             | Independent panels, opt-in scrubbed relay, request IDs and strict API shapes                                                                                       | Collector configuration and observed delivery                             |
| G1, J1, L3, N2             | Actual Perth print stamp; 30-bed/one-page and 31-bed/two-page PDFs; clock boundaries; keyboard, focus and tap checks                                               | Physical printer/device and native assistive technology                   |
| H1, H2                     | Real role ownership defaults with act-now retained; saved choices and digest review baseline isolated by access and ward                                           | No external digest delivery commissioned                                  |
| Z1, O2, P2, K1             | Tighter source/script ratchets; 17 retained Knip entries justified; fallthrough flag; licence inventory; cumulative migration RLS guard                            | Owner review of 16 licence entries before enforcement                     |
| F1, M1, N3                 | Four new shared journeys registered on desktop and phone; per-step screenshots; bounded busy-phone advisory                                                        | Four WebKit cases cannot launch on this host                              |
| W1, Y1, T1, P1, R2, I0, V2 | Downtime/reconciliation and release drafts, local revert rehearsal, environment meanings, PR guidance, email ownership and handover design constraints             | Live monitoring/token/email setup, hospital wording and release authority |

## Verification

Local checks on the isolated candidate, using Node 24.22.1 / npm 11.17.0:

| Check                                  | Observed result                                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recovery/session/API focused checks    | Ordered identities, scope/expiry, legacy migration, denied storage, safe paths and strict API shapes passed focused checks and the selected related batch                                 |
| Polling/status                         | 36 tests across 3 files passed: 3/15/60 second backoff, hidden tabs, five-minute status and retry progress                                                                                |
| Diagnostic privacy and panel isolation | 82 tests across 11 files passed; collector mocked, no delivery claim                                                                                                                      |
| Print/time logic                       | 20 tests across 4 files passed in UTC; 9 Perth boundary cases also passed in America/New_York                                                                                             |
| Browser registration                   | 18 tests across 3 files passed; 10 desktop plus 4 phone shared cases are required                                                                                                         |
| Migration policy                       | 40 tests across 2 files passed, including the complete 16-migration chain and nested-comment/DDL variants                                                                                 |
| Actual local PostgreSQL 17.11          | 448 existing tests passed; one new fixture was corrected and its actor/workspace/context isolation test then passed separately                                                            |
| Backend TypeScript                     | Passed in the selected local verification run after annotation fixes                                                                                                                      |
| Independent review                     | Found and fixed the lost client directive; reproduced unsafe queued-to-sent storage failure, now guarded and regression-tested; real role-filter wiring fixed and independently rechecked |
| Physical print/browser journeys        | Pinned Chromium production: all 52 accessibility/print cases pass; 30 beds produce one A4 landscape page and 31 produce two, with readable, unclipped tiles                               |
| Pinned browsers                        | Chromium launches. WebKit is blocked by missing system-registered GLES despite private library extraction; no dependency gate bypass                                                      |

The selected local readiness checks passed runtime, formatting, diff integrity, local document links,
index/inventory, dependency parity, backend types, full ESLint and frontend TypeScript.
The related unit batch passed 617 tests and exposed two forwarding-guard failures. The Activity
forwarder was narrowed to supported Undo types excluding override reasons, with one exact
human-reviewed forwarding site under the guard's existing policy. All 21 tests in the three
relevant guard/Activity files then passed. The 617 passing results from the earlier batch are reused; a full unit
suite was not run. The related selector capped fan-out at 82 files and leaves the rest to the batch gate.
The Knip check passes with the 17 existing entries explained below.

The shared production run at runtime commit `167701450` passes all ten required desktop journeys plus the separate
performance advisory. All four new flows pass: receipt recovery without replay, five-minute staleness
with keyboard Retry, exact own-command Undo, and cancellation/confirmation of voluntary sign-out
with safe return. Dismissing recovery also clears its list and retains focus. Four WebKit phone cases
cannot launch because the host lacks system-registered `libGLESv2.so.2`. The full shared gate correctly
remains failed. No dependency check, required case or retry policy was relaxed.

Earlier browser failures exposed test locators, a hidden bed-list view, an alertdialog role, late clock
installation and fake Auth refresh incorrectly minting a different session. Those harness defects
were corrected. Production testing also found Activity was using the page's role; it now uses parsed
working access, with administrators kept nonclinical. Fresh review found no critical or important
finding. The compiler-only trim passes the same browser obligations. A further 75 tooling, workflow, keyboard and tap tests pass across 12 files; its focused shared-access checks pass 137 tests across eight files.

## Production phone scripts — N1

Using the repository's phone-user-agent script measurement on production servers:

| Route     | Shared after trim, KiB gzip | Demo after trim, KiB gzip | Unchanged limit |
| --------- | --------------------------: | ------------------------: | --------------: |
| Home      |                       525.3 |                     549.6 |           550.3 |
| Referrals |                       530.5 |                     554.8 |           555.6 |
| ED        |                       479.5 |                     503.8 |           516.1 |
| Ward      |                       557.4 |                     581.1 |           582.5 |
| Movement  |                       589.8 |                     610.5 |           610.9 |

The first demo measurement exceeded four limits by 0.3–1.3 KiB. Two compiler opt-outs retain manual
API/context memoisation and save an actual 1.6875 KiB on every budgeted route. All five demo routes
are now under their limits; no budget changed. Measurements cover initial route scripts, not all
later asynchronous interactions. The broader phone inventory covers 45 route destinations/aliases;
only the five above have approved limits. Unbudgeted routes are measured without inventing a pass.

## Busy-phone advisory — N3

One successful pinned Chromium measurement used 390×844, 4× CPU slowdown, 150 ms latency,
200,000 bytes/s download and 93,750 bytes/s upload. The synthetic fixture held 77 movements,
268 admissions and 22 units. It reached the usable shared screen in 9,110.2 ms; first contentful
paint was 8,740 ms, DOM content loaded 1,249.1 ms and load 4,801.2 ms.
This is a warm local server with desktop emulation, not a physical-device or absolute speed verdict.
The separate attempt is bounded to 25 seconds and records unavailable evidence honestly.
Its timing does not decide whether a required journey passed.

## Local reviewed-revert exercise — Y1

On the separate local branch `codex/tier-rollback-rehearsal-20261104`, based on `9bb54d18c`,
a harmless comment was committed as `fc0ecd134` and reverted with a new commit `065369535`.
Both normal commit hooks passed. The resulting tree exactly equals its starting tree
(`git diff --exit-code 9bb54d18c HEAD` passed). The branch and worktree are retained.
This proves a local reviewed Git revert only; it does not prove a hosted rollback, deployment,
database restore or schema downgrade. No provider or release was changed.

## Retained Knip baseline — Z1

The 17 pre-existing entries remain explicit; no baseline growth or blanket exclusion is commissioned.

| Entries                                                          | Decision and reason                                                                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broadcast standalone state/action/reducer/initial state (4)      | Retain the peer-facing legacy adapter while concurrent Alerts work is preserved; no new runtime dependency added                                      |
| Patient Now fixture map (1)                                      | Retain the demonstration stories and dynamic fallback module; its exported map is legacy surface, not a live data source                              |
| Mobile keyboard provider and bar page tools (2)                  | Retain shell compatibility surfaces during concurrent shell work; current public wrapper exports are not a licence to delete their internal behaviour |
| Discharge-delay reasons and eligibility gates (2)                | Retain the shared domain vocabulary; the eligibility type is derived from its gate list                                                               |
| Four derivation exports and movementsByStage (5)                 | Retain historical facade compatibility for this scoped patch; removal requires a separate call-site/history assessment, not only an unused report     |
| Statistics disclaimer module (1)                                 | Retain the historical wording reference; do not silently delete a Ward Flow document/reference during a reliability task                              |
| PullReleaseReason and provider UnreviewedStringOrUnknownKeys (2) | Retain the prospective release vocabulary and the public compile-time payload guard; the latter has explicit type regression coverage                 |

These are retention decisions, not claims that every export has a current runtime consumer.
The existing shrinking-baseline gate still rejects new unused code. Source headroom is 150 lines;
scripts over 1,200 lines receive bounded per-file ratchets. No script budget is raised.

## Remaining acceptance

Native screen readers, physical devices, WebKit phone checks, hosted CI, telemetry
activation/delivery, uptime configuration, reviewed downtime wording, release and the unnamed
Tier 4 descriptions remain open until evidence is recorded. Local PostgreSQL is distinct from
Supabase acceptance. I1 handover implementation and the other held items remain outside this patch.

## Evidence identity and limits

Runtime source is committed through `167701450` on `codex/tier-improvements-20261104`, based on
`559f22589`. Later commits contain verification tooling and this record. Both the demo and shared
production builds passed compilation and their selected desktop checks on these source files.
The complete shared gate remains failed solely because four WebKit cases could not launch.
The full unit suite, all seven older release journeys, hosted CI and a deployment were not run here.

Primary logs, screenshots, PDFs, script inventories and the dated advisory JSON are retained in
the task-local private workspace `/tmp/ward-flow-tier-improvements.utlrcpn5`; they are untracked
and have not been uploaded. Decisive logs are `shared-production-after-trim.log`,
`demo-production-after-trim.log`, `demo-phone-budgets-after-trim.json`,
`shared-phone-budgets-after-trim.json`, `all-phone-route-scripts-after-trim.json`,
`slow-phone-baseline-final.json`, `lint-completion.log` and `typecheck-completion.log`.
The dated review found no remaining critical or important finding. Protected files and script
budgets are unchanged. No push, PR, merge, provider configuration or deployment was performed.
