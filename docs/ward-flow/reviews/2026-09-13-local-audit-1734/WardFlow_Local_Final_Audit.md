# WardFlow — final local working-tree audit

Evidence edition, 13 September 2026. Target: D:\Worktrees\Database\ward-lead

HEAD: 1ef9ed3975078b789e9b5d70b3f000c64edc3809, including dirty files actually on disk. Snapshot: 2026-09-13T09:37:01.817Z. End hash check: 2026-09-13T10:34:00.502Z. 809 files snapshotted; 52 changed during review. Four core modules used by native probes remained unchanged. The initial and final aggregate fingerprints use different record fields; compare individual SHA-256 values for drift.

## Verdict

Do not treat the current build as logically complete or clinically ready. Native tests reproduced disagreements between movement stage, actual reservation, admission and transport. A real browser reproduced stale capacity overwrite: confirmed 1 became 0 after pulling a bed; the untouched draft 1 then restored confirmed capacity to 1. No state was injected through the browser.

All 48 original issue IDs are retained below, with three additional items. These 51 work items include bugs, partial fixes, decisions, unverified concerns and real-use gates, not 51 confirmed defects. No blanket application fixes, commits, remote pushes, migrations, provider-backed tests or deployments were made. Only audit artifacts and an isolated owned dev cache were created. Other agents changed source/tests concurrently.

## What ran

Full named ward suite: 462 files handed in and 462 ran. 5,255 tests: 5,045 passed, 135 failed, 75 pending. Child test exit 1. Later focused rerun: 56 files, 934 tests, 838 passed and 96 failed, 42 files still failing. This later run is not a complete final-tree verdict and this audit did not apply the changes between the two runs.

Final native probes: 29 groups completed, zero setup errors, five positive controls, 48 backward-stage/action combinations and 27 capacity-boundary states. Completion means the diagnostic ran, not that the tested behaviour was correct.

Browser: 16 initial desktop route attempts plus five follow-up visits. Twenty desktop attempts returned 200; 19 distinct routes rendered. One initial board chunk error was not reproduced on either of two later board visits. Four phone checks at 390 by 844 had zero document-level horizontal overflow. One actual visible-control action sequence reproduced WF-08. The committed full browser spec suite was not run.

Opera was disconnected. Installed Playwright/Chromium on this PC was used against an isolated server whose project ID matched this exact worktree. No persistent audit server was intentionally left running. Review passes were serial, not independent subagents.

## What improved, and what must not be falsely repaired

Ordinary arrival and simple pull/release controls pass. The new protected discharge correctly denies wrong-scope/stale requests and prevents repeat vacancy credit. Applied pull override reasons are now retained in the new audit; WF-38 must be narrowed to projection agreement. Community decline exists locally. Stage-correction/withdrawal controls and the new ward-answer route exist. The installed Next 16.3.3 supplies retry: this is not a missing error-boundary prop. The facade test mock omits worldGeneration; its Capacity null dereference was not reproduced with the real routed provider.

## Repair order

First repair conservation across closure, stage correction, cancellation, release and arrival (WF-01/02/04/06/08/36/37). Then validate remaining resources, payloads and timestamps (WF-03/07/39), and repair referral withdrawal, independent purposes and no-booking progression (WF-12/13/14/16/23). Resolve identity, dates, discharge/follow-up and receiving responsibility with the relevant workflow owners. Retarget stale tests, then rerun the complete population and real journeys on a stable source snapshot.

## WA clinical interpretation

WA Health describes clinical handover as information supporting transfer of clinical accountability and responsibility. Vehicle arrival should therefore not silently stand in for clinical receipt. Its transport guidance is based on clinical needs, risk, safety and least restriction and describes multiple transport options: a fictitious booking must not be needed solely to satisfy the software. The transport page is older and contains inconsistent hours, so no operational provider contacts/hours were recertified here. EMHS distinguishes clinically relevant post-discharge contact from administrative scheduling. A seven-day measure is not permission to delay earlier individually required care. OCP standards are being updated from 2026, so current version and applicability checks are needed before clinical reliance.

Sources checked 13 September 2026:
https://www.health.wa.gov.au/Articles/A_E/Clinical-handover
https://www.health.wa.gov.au/Articles/J_M/Mental-health-patient-transport
https://emhs.health.wa.gov.au/Patient-Care/Safety-and-Quality/Mental-Health/Community-Follow-Up
https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/standards-and-guidelines/standards/

## Limits

Not completed: production build/typecheck, every non-ward-named dependant, all committed browser journeys, WebKit/Firefox, every responsive/print/accessibility state, live backend concurrency, authenticated security assessment, WA directory recertification or clinician-led legal/pathway validation. No test campaign establishes every possible journey combination. This is a source-window-bound report, not clinical certification or deployment approval.

## Test triage

Do not bulk-delete reds. Several tests enforce old phrases or arbitrary minimum character counts, match incidental reset wording, reject all details elements instead of only hidden ward bands, or expect retired fold states. Other failures concern real scope, sensitive adjacency or potentially lost controls and must be reviewed against approved current requirements. Repair incomplete fixtures and obsolete locators while retaining negative/positive behavioural controls. A passing route smoke alone does not settle whether a moved feature still works.

## Reconciled issue register

### WF-01 — Reconcile examination closure with admission, reservation and transport

**Priority:** P1. **Disposition:** Native reproduced. **Evidence:** N01.

A revoked examination closes a pulled movement and refunds capacity but retains its consuming admission.

**Required action:** Reconcile real commitments atomically, preserving actual arrival/departure facts and an attributable exception path.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-02 — Guard operational actions against surviving commitments after stage correction

**Priority:** P1. **Disposition:** Native reproduced. **Evidence:** N02,N03,N04,E01.

Step-back then pull can create a second admission; step-back then withdrawal or release can orphan or remove a real commitment. Controls now exist locally.

**Required action:** Keep correction separate from physical reversal. Guard later actions by reservation/admission IDs and physical milestones, not merely the stage.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-03 — Verify remaining high-acuity staffing at allocation

**Priority:** P1. **Disposition:** Controlled native fixture. **Evidence:** X02.

Remaining high-acuity capacity is zero, but a non-overridden pull creates a second high-acuity occupant against capacity one.

**Required action:** Enforce remaining high-acuity capacity with a specific refusal and the explicitly approved recorded-exception policy.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-04 — Separate cancellation, replacement booking and handover readiness

**Priority:** P1. **Disposition:** Native reproduced. **Evidence:** N05.

Cancelling before handover creates a replacement at handover_ready; the job can collect without HANDOVER_READY ever being recorded.

**Required action:** Separate cancellation, deliberate replacement and clinical readiness. A cancellation cannot prove readiness.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-05 — Define destination change and diversion after reservation or collection

**Priority:** P1 decision. **Disposition:** Workflow decision. **Evidence:** N04,N06 related.

No complete diversion contract was verified. Stage rewriting is not a physical diversion event.

**Required action:** Agree old/new bed accounting, amended transport and responsible service. Record actual diversion after collection rather than erasing departure.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-06 — Count one physical departure once across admission and bed-release paths

**Priority:** P1. **Disposition:** Native identity-gap reproduction. **Evidence:** N09,C05.

Legacy departure plus anonymous release credits two vacancies for one recorded patient departure. No common turnover identity distinguishes duplicate entry from two real beds.

**Required action:** Link one physical departure to one turnover. Preserve two credits for two genuinely different departures, but make retries and dual reporting idempotent.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-07 — Validate runtime events and define capacity reconciliation

**Priority:** P1. **Disposition:** Native payload boundaries. **Evidence:** N14,N15.

Capacity accepts negative, fractional, NaN, infinite and excessive values. An unknown step-back stage passes indexOf(-1).

**Required action:** Validate finite integers, bounds, enums and IDs at the reducer boundary. This is not proof that the normal dropdown submits an invalid stage.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-08 — Prevent an old capacity draft overwriting a newer observation

**Priority:** P1. **Disposition:** Real browser and native reproduced. **Evidence:** N08,browser-followup.

The real ward page changed confirmed capacity 1 to 0 after Pull, left draft 1, then restored 1 when Confirm capacity was clicked untouched.

**Required action:** Use draft/source revisions, refresh clean drafts and require explicit reconciliation for stale dirty drafts. Preserve the browser sequence as a regression.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-09 — Preserve patient/referral provenance and intended-episode uniqueness

**Priority:** P1. **Disposition:** Partially improved. **Evidence:** PULL source,C01.

Local admissions now copy linked patientId. referralId and homeRegion remain null; this is not complete episode provenance.

**Required action:** Carry verified identifiers, explicit unknowns and episode/idempotency keys. Do not infer identity from names or location.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-10 — Deliver recipient-scoped notices that survive active-row removal

**Priority:** P1 pending. **Disposition:** Not fully reverified. **Evidence:** Recipient/audit scope review.

The entire delivery and acknowledgement chain for every removed/withdrawn row was not traced. A central audit is not proof of recipient notification.

**Required action:** Verify each sending/receiving route after row removal and navigation, including unauthorised readers. Do not claim every notice is absent.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-11 — Make parallel-referral add, replace and withdraw semantics explicit

**Priority:** P2. **Disposition:** Source-supported decision. **Evidence:** REFER_TO_UNITS.

Active destination replacement and historic decisions are different facts. Adding B must not ambiguously withdraw A or revive a declined request.

**Required action:** Choose explicit add/replace/withdraw operations and verify both recipient views, re-referral and parallel limits.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-12 — Complete community decisions and independent referral purposes

**Priority:** P1. **Disposition:** Partly fixed, native stranded-purpose defect. **Evidence:** N12,N13.

Community decline exists locally. Community acceptance is not permitted. ED acceptance can leave a community purpose queued but not decidable even by coordinator.

**Required action:** Separate independent destination-purpose lifecycles from aggregate acceptance. Agree the community acceptance actor and test both decision orders.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-13 — Make front-door withdrawal terminal for pending decisions

**Priority:** P1. **Disposition:** Native reproduced. **Evidence:** N10,N11.

A withdrawn destination can subsequently be accepted or declined while retaining withdrawnAt.

**Required action:** Make withdrawal terminal for that attempt. A new intentional referral must be distinct, with visible refusal of stale decisions.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-14 — Provide truthful all-declined and no-admission exits

**Priority:** P2. **Disposition:** Source-supported, full exits unproved. **Evidence:** Referral lifecycle.

No complete resolution path was established for every no-destination, all-declined or no-admission state.

**Required action:** Provide outcome, re-referral and escalation choices, retaining a responsible service until accepted handover or documented closure.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-15 — Represent direct community/ward origins and inter-ward transfers

**Priority:** Scope decision. **Disposition:** Capability gap. **Evidence:** Movement origin model.

ED-only origin is not a truthful direct community or inter-ward transfer, despite widened booking roles.

**Required action:** Model typed sender/location and source admission. Distinguish inter-ward transfer from discharge to community and scope sender permissions.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-16 — Complete a no-booked-transport-needed journey

**Priority:** P1. **Disposition:** Native dead end. **Evidence:** N07.

Transport need false can be recorded, but handover readiness still demands a booking.

**Required action:** Support an assessed no-provider-booking path with appropriate readiness, departure and receiving confirmation. Do not create a fictional job.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-17 — Allow reassessment and changing clinical decisions

**Priority:** P2 decision. **Disposition:** Workflow decision. **Evidence:** Examination/status review.

A later assessment must not be confused with correction or with safe resource closure.

**Required action:** Record superseding assessments and their consequences without rewriting history. Test changing admission, physical health, escort and legal requirements.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-18 — Complete discharge dependencies and accountable community follow-up

**Priority:** Scope decision. **Disposition:** Partially improved. **Evidence:** C03,C04,C05.

Protected discharge, scoped readers and stale/replay protection now work. They do not establish complete EDD, barrier, receiving-service and clinical follow-up workflows.

**Required action:** Keep new guards; connect planning, actual departure, accepted follow-up task and clinically relevant contact. Scheduling alone is not clinical contact.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-19 — Connect temporary ED attendance to named location and responsible service

**Priority:** P2. **Disposition:** Source-supported. **Evidence:** Away/return handlers.

An away-at-ED flag and timestamp do not alone identify the ED encounter or responsible receiving service.

**Required action:** Link source admission, receiving ED/location and responsibility; cover return, medical admission and non-return without duplicate stock.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-20 — Link leave-bed handling to an admission and leave episode

**Priority:** P2. **Disposition:** Source-supported. **Evidence:** Leave-bed handlers.

Unit-level leave-bed entries do not uniquely establish the person/leave episode whose return must be handled.

**Required action:** Add admission and leave identities with an approved holding rule. Test overlapping leave, early/late return and non-return.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-21 — Agree reservation expiry and handover snapshot semantics

**Priority:** P2 decision. **Disposition:** Workflow decision. **Evidence:** Expiry/clock/handover.

Expired reservation display does not itself authorise release. Frozen handover and live state answer different questions.

**Required action:** Agree expiry escalation/renewal/release and distinguish immutable snapshot time from live state, including collected patients and midnight.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-22 — Render or clear a closed coordinator selection coherently

**Priority:** P2 pending. **Disposition:** Not fully reverified. **Evidence:** Coordinator lookup.

A later selected-movement lookup does not itself exclude closed records, but retaining a read-only history view could be intentional. No crash reproduced.

**Required action:** Prove either clear-and-return-focus or explicit closed read-only detail across another role's closure, Back/Forward and navigation.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-23 — Avoid accepted cases appearing as declined by all

**Priority:** P2. **Disposition:** Native reproduced. **Evidence:** X05.

Decline A, refer B, accept B still enters handover declined_by_all because the predicate ignores acceptedUnitId.

**Required action:** Use current acceptance/unresolved requests, not historical decline count, while retaining the historic decision.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-24 — Preserve the intended date in time-only inputs

**Priority:** P1. **Disposition:** Source-supported, controls present. **Evidence:** Ward parser, browser inventory.

HH:MM parses to day-zero 0-1439 and cannot express the intended later day. The comments claiming it always matches now are false after day zero.

**Required action:** Use date plus time or an explicit day selection, verify stored instants and printed labels at midnight and on later days.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-25 — Separate occurrence, recording, update and verification times

**Priority:** P2. **Disposition:** Native helper semantics plus source concern. **Evidence:** X07,preparation timestamps.

39 hours ahead is classified as tomorrow despite rolling-24-hour prose. Mutable confirmation time should not substitute for departure occurrence.

**Required action:** Choose calendar versus rolling horizon explicitly and separate occurrence/update/freshness timestamps. A note update must not create a new discharge.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-26 — Verify physical consistency of the scarce scenario

**Priority:** P2. **Disposition:** Native seed reproduced. **Evidence:** X04.

Scarce has gry-older-adult allocatable 1 but empty 0. Standard seed has no allocatable-above-empty case.

**Required action:** Repair or explicitly define the fixture semantics and keep zero physical vacancy unambiguous. Test actual allocation boundaries.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-27 — Verify replacement Capacity and Delays controls

**Priority:** P2 pending. **Disposition:** Partially verified. **Evidence:** Browser Capacity, native failures.

Capacity renders at desktop/phone. Its facade mock omits worldGeneration and causes a null dereference not seen with the real provider. Full revised controls remain unexhausted.

**Required action:** Fix the mock contract, then test real routed filtering, selection, empty groups and Delays. Do not label the mock crash a proven app crash.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-28 — Resolve Morning frozen-versus-live contract

**Priority:** P2. **Disposition:** Source-confirmed deferral. **Evidence:** morning/page.tsx.

Morning still redirects to bare Capacity; as-at-morning behaviour is explicitly unimplemented.

**Required action:** Implement a real frozen view or formally retire that requirement. Do not invent a decorative query parameter.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-29 — Establish privacy and genuine service-scoped authority

**Priority:** Before real data. **Disposition:** Real-use gate. **Evidence:** Provider,scoped readers.

Declared prototype roles and scoped readers are not authenticated server authorisation. No penetration test or actual data breach was established.

**Required action:** Establish identity, service membership, server enforcement, least privilege, access audit and retention before real data.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-30 — Govern sensitive demographic display and decision use

**Priority:** Before affected use. **Disposition:** Governance gate, failing CSS contract. **Evidence:** Sensitive-adjacency test.

A sensitive demographic adjacency guard fails. This is not proof of a discriminatory allocation outcome.

**Required action:** Inspect the actual patient layout and decision use with approved culturally safe semantics, keyboard order and purpose/provenance.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-31 — Validate legal forms, authority and deadline provenance

**Priority:** Before legal reliance. **Disposition:** Real-use gate. **Evidence:** Legal model,WA sources.

Legal status, form validity, location/transport authority and operational targets must not be collapsed. Product override is not legal authority.

**Required action:** Version authoritative rules, verify supported transitions and clocks with clinical/legal owners, and keep operational deadlines distinct.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-32 — Agree ranking, urgency and waiting-time policy

**Priority:** Before ranking reliance. **Disposition:** Policy not benchmarked. **Evidence:** Priority model.

Clinical ordering and fairness were not recertified by this audit; an operational score is not statewide optimality proof.

**Required action:** Use clinician-reviewed cases, defined tie-breaking, override accountability and starvation checks. Avoid sensitive proxies.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-33 — Provide authoritative persistence, concurrency and recovery

**Priority:** Before multi-user operation. **Disposition:** Real-use gate. **Evidence:** Provider,new audit.

Session-local reducer/audit state does not prove durable multi-user stock or audit history.

**Required action:** Add approved authoritative persistence, concurrency, idempotency and recovery. Test two real clients on an isolated backend, not unrelated reducers.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-34 — Make tests discriminate actual workflow failures

**Priority:** P1 assurance. **Disposition:** Native failures reproduced. **Evidence:** Full suite,focused rerun.

462 files ran with 5045 pass,135 fail,75 pending. Later 56-file rerun:838 pass,96 fail. Literal wording, stale selectors and incomplete mocks coexist with real contracts.

**Required action:** Triage product, design, oracle, fixture and environment separately. Preserve negative/positive controls and rerun the full population on a stable tree.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-35 — Align architecture notes with current code

**Priority:** P2. **Disposition:** Source-supported. **Evidence:** README,error boundary,clock comments.

Unqualified engine-sound/pass-count claims and several historical comments lag the code. Installed Next 16.3.3 DOES supply retry.

**Required action:** Use dated receipts and current contracts. Do not reverse valid retry wiring or new routes based on stale prose.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-36 — Require an actually ready resource of the appropriate kind

**Priority:** P1. **Disposition:** Native allocation boundary. **Evidence:** X06,X04.

In 27 resource states, zero empty with positive allocatable and no pending preparation permits pull.

**Required action:** Guard actual physical readiness independently of pending preparation and eligibility. Preserve the separately approved display arithmetic.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-37 — Reconcile the booked job when releasing its reservation

**Priority:** P1. **Disposition:** Native reproduced. **Evidence:** N06.

Book, release pull, cancel, collect, arrive can close a movement and decrement empty beds without an admission.

**Required action:** Bind transport to reservation/admission and account for job disposition on release. Use diversion after collection, not a fake reversal.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-38 — Retain applied override reasons consistently across projections

**Priority:** P2 reconciliation. **Disposition:** Old missing-reason claim refuted in part. **Evidence:** X03.

New audit retains the selected pull override reason. Legacy movement.overrides gains no entry and audit says overrideFactRecorded=false.

**Required action:** Do not add duplicate logging. Reconcile the canonical applied-override projection, legacy counts and flag semantics, proving exact reason/subject once.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-39 — Treat valid zero timestamps as present

**Priority:** P2. **Disposition:** Chronological native boundary. **Evidence:** X01.

A monotonic journey accepted at instant0 cannot go en route at1 and accepts a duplicate acceptance at2.

**Required action:** Use explicit timestamp presence checks, cover zero/negative/undefined/positive values and milestone retries.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-40 — Tie preparation to a current turnover identity

**Priority:** P2. **Disposition:** Source risk, full cycle unproved. **Evidence:** Preparation helper.

Unit-level discharged/preparing records cannot themselves distinguish an unresolved old cycle from a current turnover.

**Required action:** Link bed and turnover, retain historical notes and test delayed old-cycle updates. Do not expire real unfinished work automatically.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-41 — Decide which ward entries become shared facts

**Priority:** P2 decision. **Disposition:** Workflow decision. **Evidence:** Ward local state.

Several confirmations/constraints are local. Current labels acknowledge page scope; the old never-answered allegation is not retained.

**Required action:** Classify local acknowledgement versus shared observation versus history, with provenance/retention that matches the label.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-42 — Separate transport arrival from receipt and responsibility

**Priority:** P1 decision. **Disposition:** Clinical workflow decision. **Evidence:** PATIENT_ARRIVED,WA handover.

Officer arrival/occupancy is not the receiving clinical team's handover acknowledgement.

**Required action:** Record both physical arrival and explicit receiving responsibility, preserving an accountable exception path when they do not coincide.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-43 — Provide change-sensitive readiness and owned recovery

**Priority:** P1 supported journeys. **Disposition:** Workflow coverage incomplete. **Evidence:** Transition review.

Readiness can become stale after clinical, legal, escort or destination changes. Not every recovery scenario was executed.

**Required action:** Link readiness to the facts assessed, record reassessment and owner, and permit truthful physical event recording with explicit exceptions.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-44 — Maintain verified service and catchment directory

**Priority:** Before directory reliance. **Disposition:** Real-use gate. **Evidence:** Sites/teams/catchment.

No complete WA directory or live staffed-bed recertification was performed in this audit.

**Required action:** Maintain source authority, dates, scope, contacts and uncertainty. Do not treat hospital totals as current suitable staffed ward capacity.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-45 — Scope regional multi-leg transport and repatriation

**Priority:** Later/included scope. **Disposition:** Capability decision. **Evidence:** Single-job/origin model.

A single ED-origin/job path is not a full regional multi-leg retrieval or repatriation workflow.

**Required action:** Model legs, connecting handovers and responsible services when included. Do not delay current integrity fixes for optional future scope.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-46 — Establish clinical safety ownership and controlled pilot

**Priority:** Before clinical pilot. **Disposition:** Real-use gate. **Evidence:** Audit limitations,WA standards.

A large suite and source audit are not clinical validation, regulatory classification or deployment approval.

**Required action:** Maintain hazard ownership, exclusions, human oversight, downtime/rollback and clinician-led acceptance evidence.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-47 — Define truthful flow analytics and measure benefit

**Priority:** After event integrity. **Disposition:** Dependency. **Evidence:** N01,N06,N09,X05,X07.

Invalid identity, stock and timestamps can produce plausible wrong metrics.

**Required action:** Define population/denominator/occurrence time/missingness and reconcile event records to every outcome metric before claiming benefit.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-48 — Maintain capability register and evidence-bound backlog

**Priority:** P2 process. **Disposition:** Process improvement. **Evidence:** Initial/final manifests.

48 old rows mix bugs, decisions and gates. 52 snapshotted files changed while four core modules remained unchanged.

**Required action:** Keep stable IDs, maturity labels, hashes, evidence and closure proof. A changed core invalidates its old proof; unrelated visual changes do not.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-49 — Give community screens truthful role and task context

**Priority:** P2. **Disposition:** Source-supported, browser presentation. **Evidence:** ward-chrome-role,community visit.

Chrome has no community role and defaults its context to coordinator, differing from actual community reducer permissions.

**Required action:** Add truthful community or neutral context and verify role label, primary action and tasks without accidentally widening permissions.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-50 — Remove unproved aggregate placement guarantee

**Priority:** P2. **Disposition:** Source-supported. **Evidence:** Capacity zero-gap copy.

Equal counts in four broad bed groups do not prove nobody goes without today given individual constraints.

**Required action:** Say nominal category capacity/gap, not guaranteed placement. Test equal totals with incompatible needs.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

### WF-51 — Stabilise local server/cache verification safely

**Priority:** P2 environment. **Disposition:** Observed then workaround verified. **Evidence:** ensure logs,browser passes.

Normal Turbopack startup failed on missing SST files. Isolated cache worked. The first board chunk error did not recur in two later visits.

**Required action:** Keep environment and app findings separate, verify identity/free managed port, preserve logs and never delete another session's cache.

**Closure standard:** Reproduce against the current source, test the original counterexample and a neighbouring valid control, verify affected projections/actual routes, record the source hash and remaining limits. Workflow decisions require owner approval rather than an invented clinical rule.

## Native reproduction catalogue

These are actual imported-code diagnostic observations. Controlled fixtures are not ordinary UI reproduction claims. Earlier harness versions and fixture corrections are retained in the evidence folder. Full event traces and the 48/27 matrices remain in native-probes-v5.json.

### C01-normal-arrival

Kind: positive-control. Diagnostic completed: true.

```json
{
  "before": {
    "stage": "accepted_awaiting_bed",
    "closed": false,
    "allocatable": 1,
    "empty": 2,
    "admissionId": null,
    "consumingAtUnit": 18,
    "transport": null
  },
  "after": {
    "stage": "arrived",
    "closed": true,
    "allocatable": 0,
    "empty": 1,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": {
      "id": "WF-012-transport",
      "provider": "Ambulance service",
      "escortRequired": true,
      "acceptedAt": 702,
      "enRouteAt": 712,
      "collectedAt": 722,
      "arrivedAt": 732
    }
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "BOOK_TRANSPORT",
      "role": "ed",
      "movementId": "WF-012",
      "provider": "Ambulance service",
      "escortRequired": true,
      "now": 682
    },
    "rejected": []
  },
  {
    "event": {
      "type": "HANDOVER_READY",
      "role": "ed",
      "movementId": "WF-012",
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_ACCEPTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 702
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_EN_ROUTE",
      "role": "officer",
      "movementId": "WF-012",
      "now": 712
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PATIENT_COLLECTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 722
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PATIENT_ARRIVED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 732
    },
    "rejected": []
  }
]
```

### C02-pull-release

Kind: positive-control. Diagnostic completed: true.

```json
{
  "before": {
    "stage": "accepted_awaiting_bed",
    "closed": false,
    "allocatable": 1,
    "empty": 2,
    "admissionId": null,
    "consumingAtUnit": 18,
    "transport": null
  },
  "after": {
    "stage": "accepted_awaiting_bed",
    "closed": false,
    "allocatable": 1,
    "empty": 2,
    "admissionId": null,
    "consumingAtUnit": 18,
    "transport": null
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RELEASE_PULL",
      "role": "coordinator",
      "movementId": "WF-012",
      "reason": "patient_no_longer_coming",
      "now": 687
    },
    "rejected": []
  }
]
```

### N01-examination-phantom

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "before": {
    "stage": "pulled",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": null
  },
  "after": {
    "stage": "pulled",
    "closed": true,
    "allocatable": 1,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": null
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RECORD_EXAMINATION",
      "role": "ed",
      "movementId": "WF-012",
      "outcome": "revoked",
      "now": 682
    },
    "rejected": []
  }
]
```

### N02-stepback-double-pull

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "firstAdmission": "AD-ARR-01",
  "secondAdmission": "AD-ARR-02",
  "before": {
    "stage": "pulled",
    "closed": false,
    "allocatable": 1,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": null
  },
  "after": {
    "stage": "pulled",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-02",
    "consumingAtUnit": 20,
    "transport": null
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "CONFIRM_CAPACITY",
      "role": "ward",
      "unitId": "rph-adult-secure",
      "actingUnitId": "rph-adult-secure",
      "value": 2,
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 693
    },
    "rejected": []
  },
  {
    "event": {
      "type": "STEP_BACK_STAGE",
      "role": "coordinator",
      "movementId": "WF-012",
      "to": "accepted_awaiting_bed",
      "reason": "recorded_in_error",
      "now": 694
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 695
    },
    "rejected": []
  }
]
```

### N03-stepback-withdraw-orphan

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "before": {
    "stage": "pulled",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": null
  },
  "after": {
    "stage": "destination_review",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": null
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "STEP_BACK_STAGE",
      "role": "coordinator",
      "movementId": "WF-012",
      "to": "accepted_awaiting_bed",
      "reason": "recorded_in_error",
      "now": 683
    },
    "rejected": []
  },
  {
    "event": {
      "type": "WITHDRAW_ACCEPTANCE",
      "role": "coordinator",
      "movementId": "WF-012",
      "reason": "recorded_in_error",
      "now": 687
    },
    "rejected": []
  }
]
```

### N04-moving-stepback-release

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "before": {
    "stage": "moving",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": {
      "id": "WF-012-transport",
      "provider": "Ambulance service",
      "escortRequired": true,
      "acceptedAt": 702,
      "enRouteAt": 712,
      "collectedAt": 722
    }
  },
  "after": {
    "stage": "accepted_awaiting_bed",
    "closed": false,
    "allocatable": 1,
    "empty": 2,
    "admissionId": null,
    "consumingAtUnit": 18,
    "transport": {
      "id": "WF-012-transport",
      "provider": "Ambulance service",
      "escortRequired": true,
      "acceptedAt": 702,
      "enRouteAt": 712,
      "collectedAt": 722
    }
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "BOOK_TRANSPORT",
      "role": "ed",
      "movementId": "WF-012",
      "provider": "Ambulance service",
      "escortRequired": true,
      "now": 682
    },
    "rejected": []
  },
  {
    "event": {
      "type": "HANDOVER_READY",
      "role": "ed",
      "movementId": "WF-012",
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_ACCEPTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 702
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_EN_ROUTE",
      "role": "officer",
      "movementId": "WF-012",
      "now": 712
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PATIENT_COLLECTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 722
    },
    "rejected": []
  },
  {
    "event": {
      "type": "STEP_BACK_STAGE",
      "role": "coordinator",
      "movementId": "WF-012",
      "to": "pulled",
      "reason": "recorded_in_error",
      "now": 723
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RELEASE_PULL",
      "role": "coordinator",
      "movementId": "WF-012",
      "reason": "pull_made_in_error",
      "now": 742
    },
    "rejected": []
  }
]
```

### N05-cancel-invents-handover

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "before": {
    "stage": "pulled",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": {
      "id": "WF-012-transport",
      "provider": "Ambulance service",
      "escortRequired": true
    }
  },
  "after": {
    "stage": "moving",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": {
      "id": "WF-012-transport-replacement-1",
      "provider": "Ambulance service",
      "escortRequired": true,
      "acceptedAt": 702,
      "enRouteAt": 712,
      "collectedAt": 722
    }
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "BOOK_TRANSPORT",
      "role": "ed",
      "movementId": "WF-012",
      "provider": "Ambulance service",
      "escortRequired": true,
      "now": 682
    },
    "rejected": []
  },
  {
    "event": {
      "type": "CANCEL_TRANSPORT",
      "role": "ed",
      "movementId": "WF-012",
      "reason": "patient_not_ready",
      "now": 688
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_ACCEPTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 702
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_EN_ROUTE",
      "role": "officer",
      "movementId": "WF-012",
      "now": 712
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PATIENT_COLLECTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 722
    },
    "rejected": []
  }
]
```

### N06-release-cancel-phantom-arrival

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "before": {
    "stage": "pulled",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": {
      "id": "WF-012-transport",
      "provider": "Ambulance service",
      "escortRequired": true
    }
  },
  "released": {
    "stage": "accepted_awaiting_bed",
    "closed": false,
    "allocatable": 1,
    "empty": 2,
    "admissionId": null,
    "consumingAtUnit": 18,
    "transport": {
      "id": "WF-012-transport",
      "provider": "Ambulance service",
      "escortRequired": true
    }
  },
  "after": {
    "stage": "arrived",
    "closed": true,
    "allocatable": 1,
    "empty": 1,
    "admissionId": null,
    "consumingAtUnit": 18,
    "transport": {
      "id": "WF-012-transport-replacement-1",
      "provider": "Ambulance service",
      "escortRequired": true,
      "acceptedAt": 702,
      "enRouteAt": 712,
      "collectedAt": 722,
      "arrivedAt": 732
    }
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "BOOK_TRANSPORT",
      "role": "ed",
      "movementId": "WF-012",
      "provider": "Ambulance service",
      "escortRequired": true,
      "now": 682
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RELEASE_PULL",
      "role": "coordinator",
      "movementId": "WF-012",
      "reason": "patient_no_longer_coming",
      "now": 687
    },
    "rejected": []
  },
  {
    "event": {
      "type": "CANCEL_TRANSPORT",
      "role": "ed",
      "movementId": "WF-012",
      "reason": "patient_not_ready",
      "now": 688
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_ACCEPTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 702
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_EN_ROUTE",
      "role": "officer",
      "movementId": "WF-012",
      "now": 712
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PATIENT_COLLECTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 722
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PATIENT_ARRIVED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 732
    },
    "rejected": []
  }
]
```

### N07-no-transport-dead-end

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "reason": "cannot ready a handover before transport is booked (BOOK_TRANSPORT)",
  "recordedNeed": {
    "needed": false,
    "at": 692
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RECORD_TRANSPORT_NEED",
      "role": "ed",
      "movementId": "WF-012",
      "needed": false,
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "HANDOVER_READY",
      "role": "ed",
      "movementId": "WF-012",
      "now": 693
    },
    "rejected": [
      "cannot ready a handover before transport is booked (BOOK_TRANSPORT)"
    ]
  }
]
```

### N08-stale-confirmation-double-credit

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "before": {
    "stage": "accepted_awaiting_bed",
    "closed": false,
    "allocatable": 1,
    "empty": 2,
    "admissionId": null,
    "consumingAtUnit": 18,
    "transport": null
  },
  "reserved": {
    "stage": "pulled",
    "closed": false,
    "allocatable": 0,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": null
  },
  "after": {
    "stage": "pulled",
    "closed": false,
    "allocatable": 1,
    "empty": 2,
    "admissionId": "AD-ARR-01",
    "consumingAtUnit": 19,
    "transport": null
  },
  "qualification": "Engine accepts an old draft without revision. UI draft reachability is separately inspected."
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "CONFIRM_CAPACITY",
      "role": "ward",
      "unitId": "rph-adult-secure",
      "actingUnitId": "rph-adult-secure",
      "value": 1,
      "now": 692
    },
    "rejected": []
  }
]
```

### N09-departure-release-double-vacancy

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "admissionId": "AD-RPHS-01",
  "releaseId": "WR-909",
  "emptyBefore": 2,
  "emptyAfter": 4,
  "departuresAdded": 1
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "FLAG_BED_RELEASE",
      "role": "ward",
      "unitId": "rph-adult-secure",
      "actingUnitId": "rph-adult-secure",
      "waitingOn": "Awaiting ward round",
      "expectedAt": 702,
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RECORD_LEAVING",
      "role": "ward",
      "admissionId": "AD-RPHS-01",
      "actingUnitId": "rph-adult-secure",
      "leavingDestination": "discharged-to-the-community",
      "now": 693
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RELEASE_BED",
      "role": "ward",
      "releaseId": "WR-909",
      "actingUnitId": "rph-adult-secure",
      "now": 694
    },
    "rejected": []
  }
]
```

### N10-withdrawn-referral-reaccepted

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "referral": {
    "id": "RF-901",
    "ageBand": "Adult",
    "destinations": [
      {
        "destination": {
          "kind": "emergency_department",
          "edId": "rph-ed",
          "purpose": "psychiatric_review"
        },
        "state": "accepted",
        "withdrawnAt": 693,
        "withdrawalRecordedBy": "Flow coordinator",
        "decidedAt": 694,
        "decidedBy": "ED mental health"
      }
    ],
    "homeRegion": "Perth Metropolitan",
    "suburb": {
      "kind": "named",
      "name": "Armadale"
    },
    "source": "community",
    "raisedAt": 692,
    "urgency": 2,
    "originSiteCode": "RPH",
    "transportNeeded": false,
    "history": ""
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "RECEIVE_REFERRAL",
      "role": "community",
      "ageBand": "Adult",
      "destinations": [
        {
          "kind": "emergency_department",
          "edId": "rph-ed",
          "purpose": "psychiatric_review"
        }
      ],
      "homeRegion": "Perth Metropolitan",
      "suburb": {
        "kind": "named",
        "name": "Armadale"
      },
      "source": "community",
      "urgency": 2,
      "originSiteCode": "RPH",
      "transportNeeded": false,
      "history": "",
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RECORD_REFERRER_WITHDRAWAL",
      "role": "coordinator",
      "referralId": "RF-901",
      "now": 693
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_REFERRAL",
      "role": "ed",
      "referralId": "RF-901",
      "destinationKind": "emergency_department",
      "now": 694
    },
    "rejected": []
  }
]
```

### N11-withdrawn-referral-declined

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "referral": {
    "id": "RF-901",
    "ageBand": "Adult",
    "destinations": [
      {
        "destination": {
          "kind": "emergency_department",
          "edId": "rph-ed",
          "purpose": "psychiatric_review"
        },
        "state": "declined",
        "withdrawnAt": 693,
        "withdrawalRecordedBy": "Flow coordinator",
        "declineReason": "no_suitable_bed",
        "decidedAt": 694,
        "decidedBy": "ED mental health"
      }
    ],
    "homeRegion": "Perth Metropolitan",
    "suburb": {
      "kind": "named",
      "name": "Armadale"
    },
    "source": "community",
    "raisedAt": 692,
    "urgency": 2,
    "originSiteCode": "RPH",
    "transportNeeded": false,
    "history": ""
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "RECEIVE_REFERRAL",
      "role": "community",
      "ageBand": "Adult",
      "destinations": [
        {
          "kind": "emergency_department",
          "edId": "rph-ed",
          "purpose": "psychiatric_review"
        }
      ],
      "homeRegion": "Perth Metropolitan",
      "suburb": {
        "kind": "named",
        "name": "Armadale"
      },
      "source": "community",
      "urgency": 2,
      "originSiteCode": "RPH",
      "transportNeeded": false,
      "history": "",
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RECORD_REFERRER_WITHDRAWAL",
      "role": "coordinator",
      "referralId": "RF-901",
      "now": 693
    },
    "rejected": []
  },
  {
    "event": {
      "type": "DECLINE_REFERRAL",
      "role": "ed",
      "referralId": "RF-901",
      "destinationKind": "emergency_department",
      "reason": "no_suitable_bed",
      "now": 694
    },
    "rejected": []
  }
]
```

### N12-accepted-ed-strands-community

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "referral": {
    "id": "RF-901",
    "ageBand": "Adult",
    "destinations": [
      {
        "destination": {
          "kind": "emergency_department",
          "edId": "rph-ed",
          "purpose": "psychiatric_review"
        },
        "state": "accepted",
        "decidedAt": 693,
        "decidedBy": "ED mental health"
      },
      {
        "destination": {
          "kind": "community_team",
          "teamName": "Inner City Clinic"
        },
        "state": "queued"
      }
    ],
    "homeRegion": "Perth Metropolitan",
    "suburb": {
      "kind": "named",
      "name": "Armadale"
    },
    "source": "community",
    "raisedAt": 692,
    "urgency": 2,
    "originSiteCode": "RPH",
    "transportNeeded": false,
    "history": ""
  },
  "reason": "referral RF-901 has already been accepted elsewhere"
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "RECEIVE_REFERRAL",
      "role": "community",
      "ageBand": "Adult",
      "destinations": [
        {
          "kind": "emergency_department",
          "edId": "rph-ed",
          "purpose": "psychiatric_review"
        },
        {
          "kind": "community_team",
          "teamName": "Inner City Clinic"
        }
      ],
      "homeRegion": "Perth Metropolitan",
      "suburb": {
        "kind": "named",
        "name": "Armadale"
      },
      "source": "community",
      "urgency": 2,
      "originSiteCode": "RPH",
      "transportNeeded": false,
      "history": "",
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_REFERRAL",
      "role": "ed",
      "referralId": "RF-901",
      "destinationKind": "emergency_department",
      "now": 693
    },
    "rejected": []
  },
  {
    "event": {
      "type": "DECLINE_REFERRAL",
      "role": "coordinator",
      "referralId": "RF-901",
      "destinationKind": "community_team",
      "reason": "no_suitable_bed",
      "now": 694
    },
    "rejected": [
      "referral RF-901 has already been accepted elsewhere"
    ]
  }
]
```

### N13-community-cannot-accept

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "blocked": true,
  "reason": "ACCEPT_REFERRAL requires role ward or coordinator or ed, but was raised by role community",
  "qualification": "Owner workflow decision: local decline exists, acceptance role does not."
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "RECEIVE_REFERRAL",
      "role": "community",
      "ageBand": "Adult",
      "destinations": [
        {
          "kind": "community_team",
          "teamName": "Inner City Clinic"
        }
      ],
      "homeRegion": "Perth Metropolitan",
      "suburb": {
        "kind": "named",
        "name": "Armadale"
      },
      "source": "community",
      "urgency": 2,
      "originSiteCode": "RPH",
      "transportNeeded": false,
      "history": "",
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_REFERRAL",
      "role": "community",
      "referralId": "RF-901",
      "destinationKind": "community_team",
      "now": 693
    },
    "rejected": [
      "ACCEPT_REFERRAL requires role ward or coordinator or ed, but was raised by role community"
    ]
  }
]
```

### N14-capacity-runtime-boundaries

Kind: payload-boundary. Diagnostic completed: true.

```json
[
  {
    "input": "-1",
    "accepted": true,
    "stored": "-1"
  },
  {
    "input": "0.5",
    "accepted": true,
    "stored": "0.5"
  },
  {
    "input": "NaN",
    "accepted": true,
    "stored": "NaN"
  },
  {
    "input": "Infinity",
    "accepted": true,
    "stored": "Infinity"
  },
  {
    "input": "99999",
    "accepted": true,
    "stored": "99999"
  }
]
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "CONFIRM_CAPACITY",
      "role": "ward",
      "unitId": "rph-adult-secure",
      "actingUnitId": "rph-adult-secure",
      "value": -1,
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "CONFIRM_CAPACITY",
      "role": "ward",
      "unitId": "rph-adult-secure",
      "actingUnitId": "rph-adult-secure",
      "value": 0.5,
      "now": 693
    },
    "rejected": []
  },
  {
    "event": {
      "type": "CONFIRM_CAPACITY",
      "role": "ward",
      "unitId": "rph-adult-secure",
      "actingUnitId": "rph-adult-secure",
      "value": null,
      "now": 694
    },
    "rejected": []
  },
  {
    "event": {
      "type": "CONFIRM_CAPACITY",
      "role": "ward",
      "unitId": "rph-adult-secure",
      "actingUnitId": "rph-adult-secure",
      "value": null,
      "now": 695
    },
    "rejected": []
  },
  {
    "event": {
      "type": "CONFIRM_CAPACITY",
      "role": "ward",
      "unitId": "rph-adult-secure",
      "actingUnitId": "rph-adult-secure",
      "value": 99999,
      "now": 696
    },
    "rejected": []
  }
]
```

### N15-invalid-stage

Kind: payload-boundary. Diagnostic completed: true.

```json
{
  "defect": true,
  "storedStage": "not_a_stage"
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "STEP_BACK_STAGE",
      "role": "coordinator",
      "movementId": "WF-012",
      "to": "not_a_stage",
      "reason": "recorded_in_error",
      "now": 683
    },
    "rejected": []
  }
]
```

### N16-zero-time-transport

Kind: timeline-boundary. Diagnostic completed: true.

```json
{
  "defect": true,
  "acceptedAt": 0,
  "reason": "cannot mark transport en route: the movement must be at Handover ready with transport accepted (it is at Handover ready, transport not accepted)",
  "qualification": "Timestamp boundary; this fixture injects zero after its seeded morning events, not an ordinary monotonic journey."
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 672
    },
    "rejected": []
  },
  {
    "event": {
      "type": "BOOK_TRANSPORT",
      "role": "ed",
      "movementId": "WF-012",
      "provider": "Ambulance service",
      "escortRequired": true,
      "now": 682
    },
    "rejected": []
  },
  {
    "event": {
      "type": "HANDOVER_READY",
      "role": "ed",
      "movementId": "WF-012",
      "now": 692
    },
    "rejected": []
  }
]
```

### C03-wrong-ward-discharge-denied

Kind: positive-control. Diagnostic completed: true.

```json
{
  "discharge": "denied",
  "audit": "denied"
}
```

### C04-stale-generation-discharge-denied

Kind: positive-control. Diagnostic completed: true.

```json
{
  "lastAudit": {
    "id": "audit-1",
    "sequence": 1,
    "generation": 0,
    "at": 692,
    "actor": {
      "role": "ward",
      "actingUnitId": "rph-adult-secure",
      "attribution": "declared-prototype-role"
    },
    "subject": {
      "kind": "unresolved"
    },
    "outcome": "stale",
    "reasonCode": "generation",
    "origin": "captured-this-session",
    "category": "discharge",
    "action": "RECORD_PATIENT_DISCHARGE",
    "details": {
      "kind": "departure",
      "before": null,
      "after": null,
      "requestedDestination": "discharged-to-the-community",
      "recordedDestination": null
    }
  }
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "RECORD_PATIENT_DISCHARGE",
      "role": "ward",
      "actingUnitId": "rph-adult-secure",
      "admissionId": "AD-RPHS-14",
      "patientId": "PT-003",
      "expectedGeneration": 1,
      "expectedRevision": 0,
      "leavingDestination": "discharged-to-the-community",
      "now": 692
    },
    "rejected": [
      "Request could not be completed"
    ]
  }
]
```

### E01-backward-transition-combinations

Kind: bounded-enumeration. Diagnostic completed: true.

Matrix case count: 48. Full rows in native-probes-v5.json.

### X01-zero-chronological

Kind: monotonic-boundary. Diagnostic completed: true.

```json
{
  "defect": true,
  "acceptedAt": 0,
  "enRouteRefusal": "cannot mark transport en route: the movement must be at Handover ready with transport accepted (it is at Handover ready, transport not accepted)",
  "duplicateAccepted": true,
  "monotonic": true
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": -90
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": -80
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": -70
    },
    "rejected": []
  },
  {
    "event": {
      "type": "BOOK_TRANSPORT",
      "role": "ed",
      "movementId": "WF-012",
      "provider": "Ambulance service",
      "escortRequired": false,
      "now": -60
    },
    "rejected": []
  },
  {
    "event": {
      "type": "HANDOVER_READY",
      "role": "ed",
      "movementId": "WF-012",
      "now": -50
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_ACCEPTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 0
    },
    "rejected": []
  },
  {
    "event": {
      "type": "TRANSPORT_EN_ROUTE",
      "role": "officer",
      "movementId": "WF-012",
      "now": 1
    },
    "rejected": [
      "cannot mark transport en route: the movement must be at Handover ready with transport accepted (it is at Handover ready, transport not accepted)"
    ]
  },
  {
    "event": {
      "type": "TRANSPORT_ACCEPTED",
      "role": "officer",
      "movementId": "WF-012",
      "now": 2
    },
    "rejected": []
  }
]
```

### X02-high-acuity-exhaustion

Kind: controlled-resource-fixture. Diagnostic completed: true.

```json
{
  "defect": true,
  "remainingBefore": 0,
  "consumingHighAcuity": 2,
  "staffable": 1,
  "qualification": "Authored capacity 1 and an existing consuming occupant are explicitly controlled; setup refer and accept were validated."
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 693
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 694
    },
    "rejected": []
  }
]
```

### X03-applied-override-audit

Kind: controlled-eligibility-fixture. Diagnostic completed: true.

```json
{
  "refusal": "RPH Adult Secure is not eligible for movement WF-012 — failed gate cohort: Adult unit does not match a youth movement. This placement needs a recorded override reason.",
  "legacyOverridesAdded": 0,
  "audit": [
    {
      "id": "audit-2",
      "sequence": 2,
      "generation": 0,
      "at": 693,
      "actor": {
        "role": "ward",
        "actingUnitId": null,
        "attribution": "declared-prototype-role"
      },
      "subject": {
        "kind": "movement",
        "movementId": "WF-012",
        "patientId": null
      },
      "outcome": "accepted",
      "reasonCode": "none",
      "origin": "captured-this-session",
      "category": "override",
      "action": "PULL_PATIENT",
      "details": {
        "reason": "The receiving team has agreed despite the mismatch",
        "overrideFactRecorded": false,
        "targets": [
          {
            "unitId": "rph-adult-secure",
            "outcome": "accepted",
            "reasonCode": "none"
          }
        ]
      }
    }
  ],
  "reasonRecordedInAudit": true
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 652
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 662
    },
    "rejected": []
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 692
    },
    "rejected": [
      "RPH Adult Secure is not eligible for movement WF-012 — failed gate cohort: Adult unit does not match a youth movement. This placement needs a recorded override reason."
    ]
  },
  {
    "event": {
      "type": "PULL_PATIENT",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "overrideReason": "The receiving team has agreed despite the mismatch",
      "now": 693
    },
    "rejected": []
  }
]
```

### X04-scenario-physical-consistency

Kind: native-seed-enumeration. Diagnostic completed: true.

```json
[
  {
    "scenario": "standard",
    "units": 23,
    "allocatableAboveEmpty": [],
    "negative": []
  },
  {
    "scenario": "scarce",
    "units": 23,
    "allocatableAboveEmpty": [
      {
        "id": "gry-older-adult",
        "allocatable": 1,
        "empty": 0
      }
    ],
    "negative": []
  }
]
```

### X05-accepted-counted-declined-all

Kind: reachable-sequence. Diagnostic completed: true.

```json
{
  "defect": true,
  "acceptedUnitId": "rph-adult-secure",
  "stage": "accepted_awaiting_bed"
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rgh-adult-secure"
      ],
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "DECLINE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rgh-adult-secure",
      "reason": "no_bed",
      "now": 693
    },
    "rejected": []
  },
  {
    "event": {
      "type": "REFER_TO_UNITS",
      "role": "coordinator",
      "movementId": "WF-012",
      "unitIds": [
        "rph-adult-secure"
      ],
      "now": 694
    },
    "rejected": []
  },
  {
    "event": {
      "type": "ACCEPT_IN_PRINCIPLE",
      "role": "ward",
      "movementId": "WF-012",
      "unitId": "rph-adult-secure",
      "now": 695
    },
    "rejected": []
  }
]
```

### X06-physical-vacancy-matrix

Kind: controlled-resource-boundary. Diagnostic completed: true.

Matrix case count: 27. Full rows in native-probes-v5.json.

### X07-horizon-longer-than-24h

Kind: native-helper-boundary. Diagnostic completed: true.

```json
{
  "hoursAhead": 39,
  "band": "tomorrow",
  "qualification": "Calendar tomorrow includes 39 hours ahead. This contradicts a rolling-24-hour description, not necessarily the agreed forecast policy."
}
```

### C05-protected-discharge-retry

Kind: positive-control. Diagnostic completed: true.

```json
{
  "firstOutcome": "accepted",
  "repeatOutcome": "stale",
  "vacancyUnchangedOnRepeat": true
}
```

Executed events (all setup acceptance shown):
```json
[
  {
    "event": {
      "type": "RECORD_PATIENT_DISCHARGE",
      "role": "ward",
      "actingUnitId": "rph-adult-secure",
      "admissionId": "AD-RPHS-14",
      "patientId": "PT-003",
      "expectedGeneration": 0,
      "expectedRevision": 0,
      "leavingDestination": "discharged-to-the-community",
      "now": 692
    },
    "rejected": []
  },
  {
    "event": {
      "type": "RECORD_PATIENT_DISCHARGE",
      "role": "ward",
      "actingUnitId": "rph-adult-secure",
      "admissionId": "AD-RPHS-14",
      "patientId": "PT-003",
      "expectedGeneration": 0,
      "expectedRevision": 0,
      "leavingDestination": "discharged-to-the-community",
      "now": 693
    },
    "rejected": [
      "Request could not be completed"
    ]
  }
]
```

## Source anchors

Reducer: src/components/ward-management/ward-flow-reducer.ts; SHA-256 93234fa21a847a9f59d59cd4984b925c45a8f15fa56ab3289caa8df05d92b07f

| Event | Lines |
|---|---|
| REVIEW_AUDIT_EVENT | 1248-1249 |
| ADD_PATIENT | 1258-1286 |
| RESET_SCENARIO | 1288-1289 |
| SET_SCENARIO | 1291-1292 |
| ADVANCE_CLOCK | 1294-1295 |
| RAISE_REFERRAL | 1297-1478 |
| RECORD_MEDICAL_CLEARANCE | 1480-1494 |
| RECORD_ARRIVED_IN_DEPARTMENT | 1505-1522 |
| RECORD_TRANSPORT_NEED | 1524-1543 |
| RECORD_NO_REFERRAL | 1545-1570 |
| RECORD_EXAMINATION | 1572-1645 |
| REFER_TO_UNITS | 1647-1760 |
| ACCEPT_IN_PRINCIPLE | 1762-1853 |
| WITHDRAW_REFERRAL | 1874-1916 |
| PULL_PATIENT | 1918-2198 |
| DECLINE | 2200-2267 |
| HANDOVER_READY | 2269-2313 |
| TRANSPORT_ACCEPTED | 2315-2341 |
| TRANSPORT_EN_ROUTE | 2343-2392 |
| PATIENT_COLLECTED | 2394-2433 |
| PATIENT_ARRIVED | 2435-2507 |
| RECORD_LEAVING | 2540-2572 |
| FLAG_MOVEMENT_URGENT | 2640-2653 |
| CLEAR_MOVEMENT_URGENT_FLAG | 2655-2666 |
| RECORD_MOVEMENT_BLOCKER | 2668-2714 |
| CLEAR_MOVEMENT_BLOCKER | 2736-2750 |
| RECORD_AWAY_AT_EMERGENCY_DEPARTMENT | 2752-2782 |
| RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT | 2784-2807 |
| CONFIRM_CAPACITY | 2809-2834 |
| FLAG_BED_RELEASE | 2836-2906 |
| CONFIRM_BED_RELEASE | 2908-2955 |
| REVERT_BED_RELEASE | 2957-2991 |
| BLOCK_BED_RELEASE | 2993-3037 |
| CLEAR_BED_RELEASE_BLOCK | 3039-3064 |
| SET_BED_PREPARATION | 3066-3107 |
| RELEASE_BED | 3109-3183 |
| RECORD_LEAVE_BED | 3185-3206 |
| END_LEAVE_BED | 3208-3219 |
| REQUEST_CAPACITY_REFRESH | 3221-3232 |
| RECEIVE_REFERRAL | 3234-3516 |
| ACCEPT_REFERRAL | 3518-3811 |
| DECLINE_REFERRAL | 3813-3950 |
| RECORD_REFERRER_WITHDRAWAL | 3966-4003 |
| RECORD_LOCAL_BED_SOUGHT | 4005-4027 |
| RECORD_ESCALATION | 4029-4040 |
| CHANGE_URGENCY | 4042-4074 |
| CHANGE_LEGAL_STATUS | 4076-4112 |
| RELEASE_PULL | 4114-4243 |
| BOOK_TRANSPORT | 4245-4289 |
| CANCEL_TRANSPORT | 4291-4404 |
| STEP_BACK_STAGE | 4411-4451 |
| WITHDRAW_ACCEPTANCE | 4457-4552 |
| ACKNOWLEDGE_INBOX_ITEM | 4562-4573 |
| COMPLETE_INBOX_ITEM | 4584-4625 |
| REOPEN_INBOX_ITEM | 4638-4652 |

## Evidence and replication

All raw reports, screenshots, traces, input scripts and file snapshots are under D:\Worktrees\Database\ward-lead\.local\ward-flow\audit-20260913-1734. Read review-evidence.json, initial-manifest.json, final-manifest.json, suite-summary.json, focused-rerun.json, native-probes-v5.json and browser-followup.json. Use the repository heavy-run lock and offline test environment. Do not run bare mutations or reset files in this shared dirty worktree.
