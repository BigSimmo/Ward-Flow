# Ward Flow — roadmap

_Updated 2026-11-03 - new current programme (Q380): role access (D-80) and pilot readiness; the 17 October programme is kept below as history; Documentation owns._

## Current programme — 3 November 2026

Read from source on `main` at `cd66be7a` (#1332) on 3 November 2026. This is a source reading only; no new browser, hosted CI or deployment check is claimed. The redesign of every approved screen is merged (see the [handover entry](../design/handover/README.md)). Josh chose the next feature on 3 November 2026 (Q380): finish role access, then get ready for a pilot.

### 1. Finish role access (D-80)

D-80 PRs 1 to 4 are merged. Reading the source on 3 November found PR 5 and the item 14 screens built, which is further on than [STATUS.md](STATUS.md#decision-status-d-numbers) says (it still lists PR 5 as "in part" and item 14 as pending):

| D-80 item | What                                                                                    | Source on 3 November                                                                           |
| --------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 7         | Officers see their own service's jobs, with risk flags                                  | Built (#637)                                                                                   |
| 9         | Own-place Statistics as counts for wards, EDs and teams                                 | Built: `ward-role-access.ts`, the three Statistics screens                                     |
| 10, 11    | Community Movements screen; phone alerts for officers and community teams               | Built (#666): `ward-role-alerts.ts`, push in `backend/ward-flow/engine.ts`                     |
| 12        | Readmission flag only once the ward has accepted                                        | Built: `ward-readmission-copy.ts`                                                              |
| 13        | ED sees the wards asked and the accepting ward, not other wards' decline reasons        | Built: `edMovementCopy` in `ward-access-scope.ts`                                              |
| 14        | Record view and break glass review; Access log in Settings                              | Built: `governance-record-views.tsx`, `settings/access-log.tsx`                                |
| 15        | Opening a record logged as a record view                                                | Built (#667 and later): referral, patient, movement, list and TV reads; migrations 013 and 015 |
| 17        | Coordinator gives an "on behalf of the ward" reason when opening a clinical ward record | Not built; pilot item. D-86 dropped the two-person approval for role grants.                   |

Next steps:

1. Walk each desk (coordinator, bed manager, ward, ED, community, officer, executive, access admin) in the browser on synthetic data and check it sees only what D-80 allows. Fix what leaks.
2. Correct the D-80 row and the "Waiting on Josh" list in STATUS.md with the PR numbers (Q379 owns the STATUS owner tasks).
3. Build item 17 as part of pilot readiness below, not before.
4. **Done when:** every desk's walk passes, STATUS shows D-80 built except item 17, and Josh has seen it.

### 2. Pilot readiness

No real patient data until the real-data gate in [D-87](decisions.md#d-87-d-36-and-d-37-are-replaced-by-the-real-data-gate-27-october-2026) is fully signed. The repository can prepare; the sign-offs belong to people outside it.

1. **Go/no-go checklist (Q378).** [REAL-DATA-GO-NO-GO.md](governance/REAL-DATA-GO-NO-GO.md) is the one list of every real-data blocker, including session drafts kept in the browser, a Secure session cookie, the privacy impact assessment, a breach plan and the list of subprocessors.
2. **Sign-in and front door (Q371, Q372).** Harden the demo-code rate limit and make production fail closed when the front door is off.
3. **Hosting (D-84, Q370).** The app and backend are on Railway Singapore and the database in Sydney. Q370 (move to Sydney) is not answered; D-84 says to revisit with the health service's IT before real data.
4. **Owner tasks (Q379).** Sign-in renewal test before about 16 November, database migration 13, invite-only sign-up, and naming the privacy officer and clinical safety owner. The list is in STATUS.md.
5. **D-80 item 17.** The "on behalf of the ward" reason.
6. **Outside reviews.** The six reviews in historical milestone 6 below still stand: TGA check, clinical safety officer, privacy, WA legal advice on the forms, approved catchment and reference data, and post-incident review. The two open pilot questions also stand: run beside the whiteboard first or switch straight away, and who sponsors it in EMHS.
7. **Done when:** the real-data gate is signed and Josh approves a controlled pilot. A synthetic demonstration is a different milestone.

### Alongside

Design system clean-up (Q375 to Q377) and process changes (Q373, Q374) run in their own threads. They don't block the two steps above.

---

> **Historical programme — 17 October 2026.** Kept as dated history. The current source correction of 23 October follows.
>
> **Current source correction — 23 October 2026:** D-65's [20 October subsequent note](decisions.md#d-65-criteria-led-discharge-on-in-production-typed-patient-specific-criteria-and-the-awol-bed-hold-review-paused-17-october-2026)
> ends the absent without leave bed hold review warning's pause. The `awol-bed-hold-review`
> defaults in `src/components/ward-management/ward-feature-flags.ts` are now on in development,
> demo and production. The 17 October summary below retains the earlier pause as dated history.
> Source defaults do not establish current hosted configuration or observed deployment.

## Programme — 17 October 2026 (history)

> **Not refreshed since 17 October — noted 24 October 2026.** Later owner decisions D-72 to D-80
> (fix plan, community journeys, the ten bigger UX changes, one decline list, full referral first,
> role access plan version 2) are not reflected in the six steps below. Their build state is in the
> [STATUS decision table](STATUS.md#decision-status-d-numbers).

For current repository status, completed local verification, and active open work, see
[`docs/ward-flow/STATUS.md`](STATUS.md) and [`docs/ward-flow-task-ledger.md`](../ward-flow-task-ledger.md) (§7.78–§7.82).

The 8 October 2026 audit baseline was dedicated Ward `main` `e7b7f325346ea7abb5004bd2e60e63f64f5c9f95`
(advancing through PRs #130–#131 at `0bbcd341d08ad1b2e0c67a77a9cab84367e03769`, PRs #258–#264 at
`30b1803`, and the 14–17 October remediation, criteria-led discharge, and shared-access wave across PRs #283–#392 at `e025da04`).
Local integrity fixes, the v10 design system, phone layouts, criteria-led discharge in production with typed patient-specific criteria and paused AWOL bed-hold warnings (D-64/D-65, PRs #383, #385, #387), single-approval prototype role grants (D-66, PR #384), the 12-hour ISM-0428 shared session limit (PR #389), pluggable database workspace stores and browser auth adapters (PR #391), and opt-in shared synthetic workspace routes (`NEXT_PUBLIC_WARD_API_BASE_URL` and `/v1/workspace*` via `use-ward-supabase-shared.ts` and `ward-shared-client.ts`)
are landed on `main`. Production-grade multi-user authentication and clinical pilot readiness remain separate
milestones. Preserve the latest accepted appearance and current `AGENTS.md` repository boundary.

1. Fix confirmed lifecycle/data-integrity defects and misleading controls; add
   meaningful regressions and verify the integrated local candidate.
2. Complete source-backed workflow controls and phone/keyboard behaviour. Keep
   missing capabilities explicit where a role or product decision is unresolved.
3. Harden the authenticated **shared synthetic** backend boundary (opt-in Supabase
   shared workspace in `backend/ward-flow/`; provider in [DATABASE.md](DATABASE.md)).
4. Verify isolated environments, operational monitoring, recovery and release
   protections against named Ward resources; do not deploy under a local-fix request.
5. Prove concurrent users, conflicting reservations, retries, reconnects, permission
   revocation, performance and browser/accessibility acceptance.
6. Obtain the qualified/institutional approvals in the
   [production-readiness register](governance/PRODUCTION-READINESS.md), then approve
   a controlled clinical pilot. A synthetic demonstration is a different milestone.

Steps 1–2 and local backend contract work can run in parallel with exact file
ownership. Shared-user acceptance requires 3–5; clinical piloting requires 4–6.
The remediation checkpoint (archived; see [ARCHIVE.md](../ARCHIVE.md)),
[`docs/superpowers/plans/2026-10-16-audit-resolution-results.md`](../superpowers/plans/2026-10-16-audit-resolution-results.md), and
[`docs/ward-flow-task-ledger.md`](../ward-flow-task-ledger.md) (§7.78–§7.82) record evidence and
remaining decisions. Historical proposals below do not mark current tasks complete.

---

> **Historical completion notice — 17 October 2026.** The 25 September 2026 Phase 1–6 milestone
> log below is retained as historical context only. Milestones 1–4 (PsychSift removal, green ward
> test suite, removal of invented screen data, and Coordinator bed board journey) are completed in
> `BigSimmo/Ward-Flow`, and Milestone 5's opt-in shared synthetic workspace prototype is wired.
> Its former shared-repository references, red-suite counts, and script commands are historical.
> See [`docs/ward-flow/STATUS.md`](STATUS.md) and [`docs/ward-flow-task-ledger.md`](../ward-flow-task-ledger.md)
> (§7.78–§7.82) for current status and open work.

<!-- docs-script-refs:historical-start -->

## Historical programme — 25 September 2026

Written 25 September 2026 from the [product brief](product-brief.md), the two audits of that day
([`audit-2026-09-25-full-review.md`](https://github.com/BigSimmo/Ward-Flow/blob/97fa3e25276089a4a938951a59bcffabe47df149/docs/ward-flow/audit-2026-09-25-full-review.md) and the fresh full audit
written the same day) and [`STATUS.md`](STATUS.md), on the ward line at `64c6be7ab2`. **Josh
approved milestones 1 to 4 in this order on 25 September** ([`decisions.md`](decisions.md), D-7).
Milestones 5 and 6 are still a proposal he has not reviewed. Update this file in place when a
milestone moves, and record the reason in [`decisions.md`](decisions.md).

Every patient, ward and figure in the app is invented. Nothing on this roadmap loads real patient
data before milestone 6.

## The milestones, in order

Milestones 1 to 3 can run in parallel threads as long as they touch different files. Milestone 4
needs 2 and 3 finished, because a bed board built on a red suite and invented figures cannot be
trusted. Milestone 6 cannot finish until every outside review in it is signed off.

### 1. Clear out the PsychSift and Database leftovers

The ward line carries a second, older product (PsychSift, the guideline search tool) and its
deployment and database tooling. Ward Flow does not use them, and they make every check slower and
every search noisier.

- List what belongs to PsychSift or the live Database deployment, and what Ward Flow depends on.
- Remove the PsychSift code, tests, migrations and deployment config from the ward line, in small
  commits, with a backup branch first.
- Remove or rewrite instructions that only apply to PsychSift, so a new chat reads Ward Flow rules
  first.
- **Done when:** the ward line builds and the ward suite runs with no PsychSift code present, and the
  top-level instructions describe Ward Flow only.

### 2. Get the ward tests back to green

The [test baseline](https://github.com/BigSimmo/Ward-Flow/blob/97fa3e25276089a4a938951a59bcffabe47df149/docs/ward-flow/test-baseline.md) of 25 September found 79 of 648 ward test files failing
(176 tests), with none on the expected-failures list. The type check passes. The failures cluster
into a few causes: referring a patient is now refused by an eligibility check in 14 files, a date
crash on the activity and notice screens, seed counts that grew while the tests did not, behaviour
that drifted away from a recorded ruling, and style and wording guards.

- Settle the referral refusal first: it may go against Josh's 21 September "invite, then the ward
  refuses" ruling, and it alone accounts for 71 failing tests.
- Fix mechanical causes next (seed counts, the date crash, style guards).
- For each ruling conflict, either restore the ruled behaviour or record Josh's later decision here
  and in [`OWNER-RULINGS.md`](OWNER-RULINGS.md), then update the test. Never just edit the test.
- Clear the lint errors in the ward code.
- **Done when:** the full offline ward suite (`npm run check:ward-expected-reds`) passes with an
  empty expected-failures list, and [`STATUS.md`](STATUS.md) says so with the tip it was measured on.

### 3. Remove invented data from the screens

The audits found screens showing typed-in patients, record numbers, vital signs, legal status, bed
layouts and statistics as if they were records. This breaks the rule that the app never shows
something the data does not hold. The worst are handover naming the wrong patient, the bed drawer
inventing vital signs, and search inventing legal status and deadlines.

- Fix the wrong-patient and invented-clinical-fact screens first (audit §4.1).
- Then the typed-in figures on statistics, alerts, officer, on-call and delays screens (audit §4.2):
  compute them from the model, show "not recorded", or label them plainly as a demonstration.
- Redo by hand the five statistics-screen changes that never reached the line (they are on branch
  `backup/2026-09-25-ward-ux-statistics-20260923`; the screens have changed since, so rebuild them
  rather than merge): a "Reporting period: current state" strip on the statistics landing page, a
  collapsible "Measures this record does not support" group on community statistics, compare-table
  rows linking to each ward and ED statistics page, a clearly labelled demonstration chart with a
  "why this chart is illustrative" note (check first what the line already shows), and the landing
  page's "pending preparation" count wording. These belong to the "Remove invented screen data"
  thread.
- **Done when:** a check of every screen finds nothing shown as data that the model does not hold,
  recorded in [`SCREEN-VERIFICATION.md`](SCREEN-VERIFICATION.md).

### 4. A trustworthy Coordinator bed board

The heart of the product, built for the Coordinator first, because the Coordinator is the main user
and sees the whole network (Josh, 25 September; see the [product brief](product-brief.md)). The
journey is referral in, wards asked, a ward accepts, bed held, transport logged, arrival, discharge,
and the delays board. The engine and most screens exist; this milestone is about making the core
journey reliable end to end rather than adding features. The other roles' own views come after it.

- Walk the main journeys in the [journey explorer](journey/README.md) in a browser and fix what
  breaks.
- Settle the open design points: eligibility is not checked at placement, sex and gender identity
  share one field that drives bed matching, and whether the tool should ever suggest a ward.
- Bring the core screens to their drawings ([`SCREEN-DEFINITION-OF-DONE.md`](SCREEN-DEFINITION-OF-DONE.md)).
- **Done when:** the core journeys pass in the browser on synthetic data, the ward browser specs
  pass, and Josh has walked the board himself.

### 5. Build for more than one browser

Today the app runs inside one browser, with no real sign-in and nothing kept after the session.

- Real sign-in and role permissions, so every action is tied to a person.
- A shared, secure server so everyone sees the same board, hosted somewhere WA Health approves.
- A permanent audit trail of who decided what and when.
- A downtime plan for when the app is unavailable.
- **Done when:** two people on two computers see the same board, and every decision survives a
  restart with its author recorded. Hosting choice is Josh's decision; no deployment happens
  without his say-so.

### 6. Pilot readiness

These are the outside reviews Josh has parked until before any real patient (owner answer OA-63).
None is started, and none can be done by this team alone.

1. **TGA medical device check** — whether Ward Flow counts as a medical device, and what follows.
2. **Clinical safety officer** — appointed, a hazard workshop held, and residual risk signed off by
   the health service. A draft safety case exists in `governance/`; it was written by an AI and needs
   checking, not trusting.
3. **Privacy** — a privacy impact assessment, approval to hold real patient details, a named data
   custodian, and the internal patient codes decision (OA-58) made again.
4. **WA legal advice on the forms** — how the app names and handles Mental Health Act forms, and the
   legal-status gates on placement. The draft mapping in `governance/` is also AI-written.
5. **Catchment and reference data** — suburb-to-service tables, ward capacities and distances
   approved for real use and loaded. Every record is currently marked not approved.
6. **Post-incident review** process, also on Josh's parked list.

Plus the pilot itself. Josh has answered three of its questions (see the
[product brief](product-brief.md)): the pilot site is **East Metropolitan Health Service (EMHS)**,
with switching between sites kept in the app; the **Coordinator** is the main user and is built
first; and success is judged by the brief's measures (faster ED referral to bed allocation, fewer
missed or duplicate bed requests, and coordinators preferring it to the whiteboard), whose targets
are still proposals. Two questions are still open:

- whether to run Ward Flow beside the whiteboard first or switch straight away, and
- who sponsors it inside the health service, and who the clinical safety officer and data custodian
  will be.

Loading EMHS's real wards, beds and teams also belongs here, once the catchment data is approved.

The Aboriginal cultural safety review is deferred by Josh (see [`decisions.md`](decisions.md)); it is
not on this roadmap until he brings it back.

- **Done when:** every review above is signed off, EMHS's data is loaded, and the two open pilot
  questions are answered.

<!-- docs-script-refs:historical-end -->
