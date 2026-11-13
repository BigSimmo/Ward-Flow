# Ward Flow — status

<!-- last-checked: 2026-11-13 -->

**The one page for where Ward Flow stands now.** Audience: Josh, staff testers and every builder.
Owner: Documentation. Checked on 13 November 2026 against `main` at `cb685b5` (PR #1650) by reading
the merged pull request titles and searching source. No browser, hosted or deployment check was run
for this page. Work items live in the [backlog](backlog.md). Older status is in
[the status history](../history/status-to-2026-11-03.md).

Synthetic data only. Do not enter real patient information. Ward Flow is not approved for clinical
deployment.

## Now

### Merged 10 to 13 November 2026

About 50 pull requests merged after #1594, #1597 to #1654. In themes:

- **Master audit and clinical fixes:** the master audit's non-clinical fixes (D-129 to D-131, #1598),
  clinical audit fixes (D-125 to D-130, #1599; group 3, D-139, #1600), arrival support lines and under 18
  on an adult ward (D-134, #1609), the forecast double count, ended legal form wording and ED 24-hour
  boundary (D-145, #1621), and the live audit fixes of 11 November (D-148 to D-151, #1626).
- **Audit batches:** audit fixes groups 1 and 2 (D-132, D-138, #1601, #1604), Batch 2 ward arrival and
  beds (D-134, #1608), Batch 3 shift change and follow-up (D-136, #1605), Batch 4 outages and pilot
  control (D-135, D-142, #1603), Batch 5 counts, screens and print (D-137, #1607), plus the legal export
  and staff request fixes (D-155, D-156, #1635).
- **Redesigns:** the patient screen as a dashboard grid (D-165, #1644) and the Triage page with a left
  sign-off nav (D-167, #1646).
- **Home and the community desk:** the changes-since strip on one line (D-161, #1638), escalations named
  first with movements off the strip (D-163, D-164, #1641), every return to ED shown in shared mode
  (D-152, #1629) and a narrow scoped list for the community desk's ED heads-up (D-154, #1632).
- **Phone and search:** phone search start screen, Go to tiles and results (#1597), chip rows that move
  only sideways (D-144, #1602, #1610, #1617), and the review fixes of 10 to 12 November (D-159, #1637)
  and 12 November (D-162, #1639).
- **Performance, hardening and CI:** performance audit fixes (D-146, #1624, #1622), one ward access
  object per desk so the idle lock fires (#1611), handled 500, 503 and 413 errors reported to Sentry
  (#1616), demo-code addresses trusted only from a configured proxy (#1615), uptime unknown shown red
  (#1613), nightly cross-browser runs (#1614), and CI sped up without dropping a check (D-166, #1645,
  #1647, #1643, #1625, #1628, #1631).
- **Records and demo script:** glossary ruling (D-143, #1612), D-153 (#1630), D-168 and D-169 demo
  script wording (#1648, #1649, #1642), D-170 clinical wording audit (#1650), D-171 hosted database at
  schema 18 (#1651), D-172 community desk heads-up stays as built (#1652) and the coordinator handover
  (#1654).

### Merged 9 to 10 November 2026

19 pull requests merged after #1531, #1553 to #1588. In themes:

- **Rulings applied:** the 8 and 9 November rules audit (#1555), the D-106 clinical value changes
  (#1556), D-117 care plans follow-up (#1586) and the D-115 audit guards and audits 1 to 8 (#1579).
- **Features:** Tomorrow on Home, the step-by-step bed meeting and ED long-wait next steps (D-108,
  #1560); ten ED and referral features (D-110, #1563); care plans, safety flags, tribunal dates and
  escalation history (#1578); search, export and training tools (#1559); staff and handover tools
  (#1562); deciding referrals on Home and the Log a delay form (#1584).
- **Design:** page tops on every page (D-116, D-118, D-119, #1581); the floating phone bar (D-112,
  #1580); one "under a form" rule (D-100, #1553).
- **Help:** a Help drawer overhaul (#1558) and the three figures at the top of Home explained (#1561).
- **Phone limits and CI:** Capacity loads on first open (#1557), main back under its limits (#1582),
  steadier tests (#1554) and 30 minute unit shards (#1588).

### Merged 8 to 9 November 2026

About 50 pull requests merged, #1502 to #1552. In themes:

- **Triage:** the webPSOLIS pick-lists are built (#1502 review, #1504 build), then a safety plan
  builder, means safety, a follow-up prompt, a Start a triage queue and phone fixes (#1507, #1539, #1542).
- **Decisions built:** a named bed counts as pulled, never also waiting (D-96, #1506); the friction pass
  Quick bar and peek panels (D-98, #1549); D-80 item 17, the "on behalf of the ward" reason (`24e75284`).
- **Owner notes 3 to 14 on every screen:** Home (#1546, #1551, #1552), Patient page (#1544), Movements
  (#1527, #1548, #1550), Waiting (#1528, #1535, #1545), Referrals (#1534), Capacity (#1540), Places
  (#1532), Handover (#1529), TV screens (#1537), Settings (#1512, #1531) and printed documents (#1538).
- **Fixes:** 14 verified backlog defects (#1506), live audit follow-ups (#1518, #1522), the 8 November
  repo review (#1523), forgiving page search (#1524) and the desk walk findings (`a7e35bf19`).
- **Help:** 52 how-to guides and 15 screen questions (#1525); tours updated to the redesign (#1510).
- **Pilot documents:** shadow pilot breach plan, incident log and known issues (#1543).

### Merged 3 to 8 November 2026

About 125 pull requests merged, #1327 to #1501. In themes:

- **Triage and risk form** in the app, opened from **New → Triage or Referral** (#1500).
- **One right-hand drawer** for Bed board, Referrals, Waiting, Places, Governance, Handover, Ward home,
  Transport, Search, Alerts, Out of area and Discharges (#1495, #1497).
- **Design and front-end audits:** names in full, one word for each thing, the form rule, icons and
  side edges, layout, speed and keyboard access, and a safety net (#1474 to #1481, #1484, #1487).
- **Saving and recovery:** offline saves send themselves, double taps record once, drafts recover,
  stale caches recover, shared changes and phone alerts recover safely (#1329, #1395, #1435, #1441,
  #1452, #1472, #1478).
- **Sign-in and privacy:** the site lock fails closed on Railway with a 12-character demo code, a
  hardened pass cookie, safer password-recovery links, and drafts kept out of browser storage outside
  prototype mode (#1344, #1345, #1346, #1492).
- **Help:** welcome cards, a chapter menu, tablet layouts, more walk-throughs, and Help remembered by
  account (#1410, #1482).
- **Screens:** Home, Referrals, Capacity, Discharges and On-call, the bed meeting, Forms, Transport and
  Out of area, Places and Patients, Handover, ED, Statistics, Waiting, Search and phone tools (#1336 to
  #1389, #1424, #1488).
- **Role access:** Settings, the account menu and Alerts by role, and the WF audit fixes (#1392, #1448,
  #1471).
- **Readiness:** the real-data go/no-go checklist (#1342) and an uptime check that signs in as a
  synthetic monitor (#1469).
- **Process and CI:** the branch and its PR are the claim (#1349), a `hold` label and no stacked PRs
  (#1341), threads arm and merge their own PRs (#1354, #1453), merge-queue preparation (#1466), faster
  CI (#1385 to #1465), one file per What's new and budget-history entry so parallel PRs stop
  conflicting (#1384, #1404), and Next 16.4.5 (#1490).

To list every merge since a date or revision:
`node scripts/ward-flow/merged-since.mjs --since <YYYY-MM-DD or revision> --ref origin/main`.

### In progress

- **Role access (D-80):** every item is built in source, including item 14 (Governance review and the
  Access log) and item 17 (`24e75284`). The first automated desk walk ran on 8 November and its two
  findings were fixed ([desk walk](evidence/desk-walk-2026-11-08.md)). Part 2 of the walk is in the
  [backlog](backlog.md).
- **Pilot readiness:** the steps in the [roadmap](roadmap.md#2-pilot-readiness).
- **Audits of 9 and 10 November:** the latest rulings are D-121 (working rules, guards and Josh's PC)
  and D-122 (clinical and privacy answers). The documentation fixes ship in one PR. D-122's clinical
  items have merged with the clinical audit fixes (#1599, #1609, #1621). Earlier audits: clinical values (D-106) and working rules and
  documentation (D-107).

### Waiting on Josh

Re-checked on 10 November. D-108 settled the legal times and ED next-step questions, so they are
gone. The 16 November date for the sign-in test was dropped (Q390). Two asks are done and removed
(audit A8-08): `Ward Flow hold` has been a required check in the "Protections" ruleset since
3 November (Q384), and Dependabot security updates are on. Items 4 to 12 are carried from
3 November and not re-checked.

1. Protect the `live` branch in GitHub so only the release workflow can update it, with no
   force-push or deletion (D-121 item 1).
2. If not done yet, add the Actions event policy for `pull_request_target` before GitHub's second
   brownout on 16 November 2026 (D-114). GitHub blocks it by default from 2 December.
3. Check the merged clinical audit fixes for D-122 (#1599, #1609, #1621) and the D-170 wording audit.
4. Sign-in renewal test (Q390): sign in with a test account in the morning, and make one save after
   lunch without signing in again.
5. In Supabase: turn off "Allow new users to sign up", and turn off the organisation's AI SQL, log and
   data options (Q391).
6. Choose the Sentry organisation for server error reporting (PR #686).
7. Turn on Remote Control for the backup-restore drill and the hosted two-person run.
8. Set limits on who can grant administrator access.
9. Name the privacy officer and the clinical safety owner.
10. Arrange the clinician trial.
11. Keep or strike the decision entries marked "Source unverified" (D-28 and D-30 to D-35).
12. Before any real data (deferred): the [real-data go/no-go checklist](governance/REAL-DATA-GO-NO-GO.md).

### Keeping this page true

- Update **Now** at least weekly, and whenever something above changes. Use `merged-since.mjs` for the
  merged list, then write the themes by hand.
- The freshness check warns when this page is more than 7 days old, on every pull request and in a
  weekly reminder issue. Change the `last-checked` date only after checking the page against `main`.
- Decisions live only in [decisions.md](decisions.md). Work lives in the [backlog](backlog.md) and open
  pull requests.

## What is built

**Route and screen overview.** The <!-- fact:ward-route-count -->61<!-- /fact --> Ward page routes
form part of the <!-- fact:app-route-count -->65<!-- /fact --> scoped app pages/handlers including
sign-in and digest. The separate root redirect is additional. Engine and components are under
`src/components/ward-management/` and `src/components/wf/`. Redirect routes are retained
for old links; their presence does not establish an independent screen:

| Area                   | Screens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coordinator day        | Home (`/ward-flow`; `/` and `/ward-flow/command` redirect there), bed meeting TV (`/bed-meeting`) and agenda (`/bed-meeting/agenda`), referrals (`/referrals`, `/referrals/new`), movements (`/movements`, `/movements/[movementId]`), transport officer (`/transport/officer`; `/transport` redirects there), Waiting (`/waiting`; `/delays` redirects with its filters; `/queue`, `/escalation` and `/exceptions` redirect here), discharges                                                                                                                                                                                             |
| Beds and wards         | Bed board (`/board/[unitId]` with stranded prompts), ward view (`/ward/[unitId]`, `/ward/[unitId]/answer`), wards directory (`/wards`), capacity (with bed-meeting sheet and tomorrow's forecast), ready beds by road time (distance only, not suitability); retired `/network` and `/constellation` routes redirect to Home; coordinator placement panel, out-of-area                                                                                                                                                                                                                                                                     |
| Pressure and safety    | ED psychiatry directory (`/ed`), individual ED psychiatry hub (`/ed/[edId]`), alerts centre (`/alerts`), seclusion and restraint (`/seclusion`), governance (`/governance`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| People and directories | Places (`/hub`, one search across wards, EDs and community teams), patient search (`/search`), unified Patient Now flight deck (`/people/[patientId]`), add patient (`/people/new`), community directory (`/community`, `/community/[teamId]`), on-call directory (`/on-call`)                                                                                                                                                                                                                                                                                                                                                             |
| Records and reports    | Handover (`/handover`, with print), legal forms (`/legal-forms`, using recorded due times, with no computed Act periods), patient chronology (`/reports/chronology`), downtime pack (`/reports/downtime`), **12 Statistics route files**, including the `/statistics/overview` bookmark redirect to Statistics home (labelled Network): `/statistics`, `/statistics/overview`, `/statistics/compare`, `/statistics/weekly`, `/statistics/wards`, `/statistics/ward/[unitId]`, `/statistics/eds`, `/statistics/ed/[edId]`, `/statistics/teams`, `/statistics/community/[teamId]`, `/statistics/services`, `/statistics/service/[serviceId]` |
| Other                  | Settings (`/settings`), sign-in (`/ward-flow-sign-in`), digest (`/mockups/ward-flow-digest`), compact floating drawers (Tools, Tasks, Activity, Referrals), scenario save/load, universal prototype banner                                                                                                                                                                                                                                                                                                                                                                                                                                 |

The dated work summary of 27 September to 17 October is in [the status history](../history/status-to-2026-11-03.md#dated-work-summary-27-september-to-17-october-2026).

## Decision status (D-numbers)

**Dated decision-state summary, not the current task backlog** (that is [backlog.md](backlog.md)). The 24 October direction below has been reconciled with later recorded answers on 3 and 9 November. Original answers belong in decisions.md. Verify implementation and deployment separately. [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) is historical.

Status of every decision in [decisions.md](decisions.md), D-1 to D-81, read from its text, a source search and merge titles at `d1e61c1` on 24 October 2026; D-15, D-21, D-23, D-26, D-30, D-45, D-48, D-50 and D-51 re-checked against source at `899b232e` the same day. No runtime check was run. "Unverified" means the source search could not confirm the state. D-81 was added on 24 October 2026 with #680; the next free number is in [FACTS.md](../FACTS.md) (`next-decision`).

| No.  | Short title                                   | Status                | Evidence                                                                      |
| ---- | --------------------------------------------- | --------------------- | ----------------------------------------------------------------------------- |
| D-1  | Local only, no linked repository              | Dropped or superseded | Replaced by D-27                                                              |
| D-2  | Railway disconnected                          | Dropped or superseded | Hosting record of 27 September, [`hosting.md`](../hosting.md)                 |
| D-3  | Retire PsychSift and Database code            | Built                 | Dedicated repository; clean-up #412                                           |
| D-4  | Synthetic patients only                       | Policy only           | `src/lib/synthetic-data-guard.ts`                                             |
| D-5  | Parallel worktrees, folded one at a time      | Policy only           | Blanket retest replaced by D-26                                               |
| D-6  | Aboriginal cultural safety review deferred    | Policy only           | Deferred by Josh; D-87 keeps the charter as reference, not a gate             |
| D-7  | First four milestones, in order               | Policy only           | [`roadmap.md`](roadmap.md)                                                    |
| D-8  | Standing rulings R1 to R16                    | Policy only           | R1 replaced by D-27                                                           |
| D-9  | Rulings R17 to R21                            | Unverified            | Product items not re-checked one by one                                       |
| D-10 | Gate build type check (R22)                   | Built                 | `scripts/ward-flow/gate-build-flag.mjs`                                       |
| D-11 | Rulings R23 to R25                            | Dropped or superseded | R24 and R25 replaced by D-26; R23 not re-checked                              |
| D-12 | Rulings R26 to R31                            | Built                 | `gate-tsc.mjs`, `related-tests.mjs`; R28 and R31 replaced by D-26             |
| D-13 | Tooling tests in batch gates (R32)            | Built                 | `TOOLING_TESTS` in `scripts/check-ward-expected-reds.mjs`                     |
| D-14 | Standing defaults for small choices           | Policy only           | —                                                                             |
| D-15 | Rulings R33 to R35                            | Partly built          | R33 `addInitScript` in `tests/`; R34 `tsconfig.ward-gate.json`; R35 not found |
| D-16 | No legal override; receipts on nine forms     | Built                 | `OVERRIDE_LEGAL_MISMATCH` gone, `FLAG_LEGAL_MISMATCH` kept                    |
| D-17 | Morning roll-up is Josh's default             | Built                 | `MORNING_ROLLUP_TIME_MINUTES`                                                 |
| D-18 | Privacy lock only for typed text              | Built                 | `eventCarriesTypedTextPayload`; narrowed by D-67, D-72                        |
| D-19 | 25 September evening rulings                  | Unverified            | Many items; not re-checked one by one                                         |
| D-20 | High-contrast colour check retired            | Unverified            | Named archive note is not in this repository                                  |
| D-21 | Coordinator bed board, nine answers           | Unverified            | 9A `GENDER_REVIEW_FLAG`; other items not re-checked                           |
| D-22 | No legal limits in hour rules                 | Built                 | `ward-operational-defaults.ts`                                                |
| D-23 | Leave-bed fields kept; search not by ward     | Built                 | `leaveOpenWarning`; ward match removed in `ward-patients.ts`                  |
| D-24 | Hour-rules morning list, all A                | Built                 | `LONG_WAIT_MINUTES`, `DUE_SOON_URGENT_MINUTES`                                |
| D-25 | Lone-patient check reads free beds            | Built                 | `ward-eligibility.ts`                                                         |
| D-26 | Select fold checks by changed risk            | Unverified            | `select-fold-gate.mjs` gone; `related-test-selection.mjs` (#506)              |
| D-27 | Dedicated `BigSimmo/Ward-Flow` repository     | Policy only           | AGENTS.md hard rule 2                                                         |
| D-28 | Design modernisation, anti-box                | Unverified            | Item 4 replaced by D-42                                                       |
| D-29 | Act time limits as a labelled demo            | Dropped or superseded | Replaced by D-70; `act-periods-demo.ts` deleted                               |
| D-30 | Coordinator approval for inter-ward transfers | Built                 | Transfer accept is coordinator only, `ward-flow-protected-record-events.ts`   |
| D-31 | Gender-diverse placement needs review         | Built                 | `ward-eligibility.ts`                                                         |
| D-32 | Wait-order queues with triage badges          | Built                 | Restored by D-71 (#490)                                                       |
| D-33 | Ward shift notes stay local                   | Unverified            | Not re-checked                                                                |
| D-34 | Medical deterioration releases the bed        | Built                 | `ward-flow-record-events.ts`, `ed-medical-placement-controls.tsx`             |
| D-35 | Regional multi-leg transport deferred         | Policy only           | Deferred                                                                      |
| D-36 | External governance hard gates                | Dropped or superseded | Replaced by D-87 (the real-data gate)                                         |
| D-37 | Governance postures and roadmap               | Dropped or superseded | Replaced by D-87; Azure parts by D-55                                         |
| D-38 | Leave, AWOL and CTO on the Patient page       | Built                 | `RECORD_ABSENT_WITHOUT_LEAVE`, `RECORD_COMMUNITY_TREATMENT_ORDER`             |
| D-39 | UMRN, never a WF number                       | Built                 | `movementUmrn`, `ward-patient-resolver.ts`                                    |
| D-40 | A second CTO keeps the first                  | Built                 | `earlier` in `ward-patients.ts`                                               |
| D-41 | Delays filters state the hidden count         | Built                 | "Show everyone"; Delays renamed Waiting (#474)                                |
| D-42 | 12px floor, no uppercase exception            | Built                 | `--wf-fs-11` alias in `ward-flow-v9-tokens.css`                               |
| D-43 | Colour in glyphs; red is a 1px edge           | Partly replaced       | The red edge is replaced by D-94 item 2; colour in glyphs still applies       |
| D-44 | Compact sizing and white cards                | Unverified            | Not re-checked                                                                |
| D-45 | Phone is its own 390×844 design               | Built                 | `48rem` phone media queries, `phone-fold`; no `--wf-bp-narrow` token          |
| D-46 | Focal part, own part and hero per page        | Unverified            | Not re-checked                                                                |
| D-47 | Glass about 80% opaque with sheen             | Built                 | `saturate(1.4)` glass in `src/components/wf/`                                 |
| D-48 | Figures in Geist Mono, tabular digits         | Partly built          | `--wf-mono` is Geist Mono, `tabular-nums`; chart axes not re-checked          |
| D-49 | 44px default row, dense and touch             | Built                 | `data-density` in `ward-flow-v9-tokens.css`                                   |
| D-50 | Neutral T1 pill; amber Form 1A badge          | Unverified            | Neutral pill on Home and ED; Patient page tier 1 uses `danger` tone           |
| D-51 | Queues highlight; Delays hides with count     | Built                 | "highlighted, all rows stay" in queue, referrals, out of area                 |
| D-52 | 10 October page review rulings                | Unverified            | `--wf-overdue-zone` present; other items not re-checked                       |
| D-53 | Elevate design language and Glare mode        | Built                 | `ward-flow-v9-tokens.css`, `v10-parts.tsx`; `CommandPalette` later dropped    |
| D-54 | Tier thresholds need clinical sign-off        | Policy only           | Open until health service sign-off                                            |
| D-55 | Supabase provider; Azure retired              | Built                 | `backend/ward-flow/`, [DATABASE.md](DATABASE.md)                              |
| D-56 | Josh signs sourced clinical values            | Built                 | `ward-clinical-values.ts`                                                     |
| D-57 | Twenty Top 25 items into real screens         | Partly built          | Items 9 (later D-60) and 16 (parked) not built in it                          |
| D-58 | Josh signs three nationally sourced values    | Built                 | `ward-clinical-values.ts`                                                     |
| D-59 | One role access table, default deny           | Built                 | `ward-role-access.ts`, `ward-access-scope.ts`                                 |
| D-60 | Criteria led discharge, voluntary only        | Built                 | `ward-discharge-criteria.ts`                                                  |
| D-61 | Tasks and Alerts are one queue                | Built                 | Signed off by D-62                                                            |
| D-62 | Alerts queue flag removed                     | Built                 | `alerts-one-queue` flag gone                                                  |
| D-63 | Remaining clinical values signed              | Partly built          | Six synthetic values added since, four more under D-106                       |
| D-64 | Criteria led discharge on boards              | Built                 | CLD chips in `ward-discharge-criteria.ts`                                     |
| D-65 | CLD on in production; typed criteria          | Built                 | `sessionLimit`; AWOL review back on (#487)                                    |
| D-66 | Granted roles need no second approval         | Built                 | `/approve` refusal in `backend/ward-flow/shared-http.mjs`                     |
| D-67 | Session draft recovery for forms              | Built                 | `referrals/referral-draft-store.ts`                                           |
| D-68 | Bed meeting TV content and access             | Built                 | Ward access in `ward-role-access.ts`; item 3 replaced by D-79                 |
| D-69 | No legal status needs involuntary bed         | Built                 | `involuntaryBedNeededForLegalStatus`                                          |
| D-70 | No computed Act periods                       | Built                 | `act-periods-demo.ts` deleted                                                 |
| D-71 | Audit 1 clinical safety fixes                 | Built                 | #490, #504                                                                    |
| D-72 | Seven fix plan product decisions              | Partly built          | #533, #534, #542, #553; six screens withdrawn (D-74); history table pending   |
| D-73 | Batch merge safeguards                        | Policy only           | Item 5 replaced by a lighter substitute                                       |
| D-74 | Owner answers, 21 October                     | Built                 | Build items: #564, #578, #611; Realtime closed, six screens cancelled         |
| D-75 | UX follow-up, caching, extra-travel hold      | Built                 | `extraTravelHold`; PERF-03 in `src/proxy.ts`                                  |
| D-76 | Community move journey and Ask more wards     | Built                 | #578, #611                                                                    |
| D-77 | Ten bigger UX changes                         | Built                 | #557, #558, #560, #561, #566, #568, #587, #599                                |
| D-78 | One decline list                              | Built                 | #579                                                                          |
| D-79 | Wards see the full referral first             | Built                 | #588                                                                          |
| D-80 | Role access plan version 2                    | Built                 | PRs 1 to 5; item 14 (31 Oct); item 17 `24e75284`; D-86 drops second approver  |
| D-81 | Pulled, with a pull time limit                | Built                 | #680 (wording across screens and docs)                                        |

### Later recorded decisions: source reconciliation, 3 November 2026

These rows record decisions, not a new assertion that their implementation is complete or live.

| Decisions | Recorded disposition                                                                                          | Verification boundary                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| D-82      | A per-screen phone budget increase of at most 5 KB per PR is allowed after diagnosis and a safe trim attempt. | Measure the actual candidate; permission is not a passing budget check.                      |
| D-83–D-85 | Full synthetic names; existing hosting retained; incoming beds described as pulled.                           | Names question answered. Real-data reviews and any provider changes remain separate.         |
| D-86      | No second approver for role grants; earlier grant safeguards remain.                                          | Supersedes that part of D-80.                                                                |
| D-87      | Real-data gate replaces overstated D-36/D-37 readiness claims.                                                | No institutional approval or real-data authority inferred.                                   |
| D-88      | Demo-code front door permitted once approved for switching on.                                                | Runtime switch/provider state not checked here.                                              |
| D-89–D-91 | Scoped mock-up line cap; Help tasks/walkthroughs and expansion decisions.                                     | Read original decision boundaries and relevant current source.                               |
| D-92–D-94 | Later prototype interface decisions are recorded in [decisions.md](decisions.md).                             | Consult each original ruling; this summary supplies no implementation or deployment verdict. |
| D-95      | One page scroll on desktop; a click outside closes a hand-built drawer (3 November 2026).                     | Built (#1322).                                                                               |
| D-96      | A named bed is pulled, and its patient is not also waiting.                                                   | Built (#1506).                                                                               |
| D-97      | Owner answers on seven open items (N21 to WF-B008).                                                           | Open items moved to the [backlog](backlog.md).                                               |
| D-98      | Friction pass: Quick bar, Patient peek and Ward peek.                                                         | Built (#1549).                                                                               |
| D-99 on   | Recorded 9 November 2026, including D-106 (clinical values audit) and D-107 (rules and docs audit).           | Read each in [decisions.md](decisions.md); work they create is in the [backlog](backlog.md). |

<a id="remaining-work-and-local-remediation"></a>

## Remaining work

Every open build item is in the [backlog](backlog.md). Actions only Josh can take are listed in [Waiting on Josh](#waiting-on-josh) above. Dated task detail stays in
[`docs/ward-flow-task-ledger.md`](../ward-flow-task-ledger.md).

### How device copies and drafts are kept

D-72 item 1 permits automatic saving of a scrubbed
submitted-state device copy after a typed-text event, whether accepted or refused.
Typed values are replaced with “Typed text not kept on this device”. If a safe,
valid copy cannot be made, saving stops. D-18 continues to exclude the original
typed values from that copy. D-67 separately permits bounded sessionStorage
recovery for opted-in synthetic referral and
legal form drafts, scoped to account, session, scenario and form subject.
Restored drafts require human review and submission; referral attachments
require reattachment. Successful submission clears the relevant draft;
sign-out, session termination and reset invalidate drafts and pending writes.
Browser session restoration may preserve sessionStorage across a restart, so
browser-close deletion is not guaranteed. Explicit JSON scenario exports are
separate from draft recovery and automatic shared persistence. They refuse
scenarios containing repatriation or support-notification records. Imported
scenarios use the same scrubbed device-copy path, subject to its safety and
restore-validation checks; refresh recovery is not guaranteed for every import. No real
patient information is authorised by any of these paths.

## Before any real patient

The [production-readiness register](governance/PRODUCTION-READINESS.md) distinguishes
local engineering from required institutional and qualified external decisions:
clinical safety, WA privacy/information governance, legal forms, cultural safety,
reference-data verification, intended-purpose/TGA assessment and accountable
support. D-87 replaced the internal D-36 and D-37 statements with the real-data gate; nothing in
this repository is an external approval.
