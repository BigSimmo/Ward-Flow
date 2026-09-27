# Ward Flow — roadmap

Written 25 September 2026 from the [product brief](product-brief.md), the two audits of that day
([`audit-2026-09-25-full-review.md`](audit-2026-09-25-full-review.md) and the fresh full audit
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

The [test baseline](test-baseline.md) of 25 September found 79 of 648 ward test files failing
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
