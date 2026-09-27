# Q004 Task 3 — patient-linked discharge and audit design

Design for independent review, 2026-09-13. Source inspection only; no implementation, tests, server or provider operations. Authority is the Task 3 brief and Q004's explicit new local-prototype discharge/access/audit scope.

Revised after the independent review in `task-3-design-review.md`. This is a corrected design awaiting controller inspection, not an implementation or a passing review receipt.

Controller inspected and accepted R1–R5 before implementation. Implementation inspection found a classifier correction: `eligibilityRefusal` returns null immediately for a valid supplied override reason, so mixed `REFER_TO_UNITS` results are reachable on ordinary referrals, not that override-reason path. Capture all `REFER_TO_UNITS` operations. Add the closed category `referral` for calls without an override reason, reusing the typed target outcome details with `reason: null` and `overrideFactRecorded: false`; reason-bearing calls remain `override`. Do not change eligibility or describe ordinary referrals as overrides. Focused tests distinguish the mixed ordinary-referral and supplied-reason paths. This bounded source-backed amendment supersedes the narrower classifier row below.

## Recommendation and existing facts

Use `Admission` as the discharge record of truth. Add a guarded patient-linked projection and session audit/review collections. Keep `BedRelease` anonymous and unchanged; do not add a second discharge lifecycle or connect an anonymous release to an admission by inference.

Inspected contracts:

- `ward-admissions.ts`: `Admission.patientId: PatientId | null`, `unitId`, state, planned date and its provenance, discharge confirmation and its provenance, blocker, `leftAt`, leaving destination and follow-up. Identity belongs to `Patient`, never copied into Admission. Existing nullable links cover legacy records.
- `ward-discharge-dates.ts`: `derivedBedReleases` already projects admission discharge plans/decisions/departures. A date does not imply confirmation; blank waiting-on is not “Nothing outstanding”; an inter-psychiatric-ward transfer releases a local bed but not a statewide bed. Keep these functions and their consumers' arithmetic intact.
- `ward-flow-events.ts` / `ward-flow-reducer.ts`: `EVENT_ROLE` runs first. Admission departure is `RECORD_LEAVING`, ward-only, matching `actingUnitId`, occupied-only and terminal; it increments `empty`, not `allocatable`, and decrements sex mix. Anonymous `RELEASE_BED` changes both empty and allocatable. These paths must not be combined or both executed for one departure.
- Admission date/confirmation fields exist but have no corresponding reducer write actions in the inspected event union. Do not describe those fields as editable or silently invent these additional clinical planning actions in Q004's first contract implementation. Existing departure is sufficient for the new linked action.
- `ward-flow-provider.tsx`: reducer memory survives navigation beneath the shared provider; reload, remount, reset and scenario change reseed it. No persistence service exists. Initial clock adoption rekeys the world; keep this convention.
- `search/access-record.ts`: page-local `AccessEntry { words, at }`, no persistence or actor identity. Leave it intact; do not import its query strings into governance.
- `governance-registers.tsx`: current override records have role, instant, reason and target units; no review state or captured failed-gate verdict. Movement legal-status changes and legal forms exist; no authenticated user exists. Route-derived chrome role is a display hint, never an authenticated permission.
- `tests/ward-patient-link-default-deny.test.ts` intentionally permits exact named readers only. Its eight-entry allowlist must be deliberately extended for the new guarded selector, not switched off or broadened to all screens.

## Exact minimal discharge contract

New module: `ward-discharge-records.ts`. Types use existing `Instant`, `PatientId`, `Admission`, `Patient` and `WardFlowRole` aliases.

Every generation, revision, request ID and expected review count below is runtime-validated with `Number.isSafeInteger(value) && value >= 0`; TypeScript `number` alone is insufficient. Counter allocation must refuse exhaustion rather than wrap or reuse an ID.

```ts
type WardRecordActor =
  { role: "coordinator" } | { role: "ward"; actingUnitId: string } | { role: "ed" | "officer" | "community" | "demo" };

type DischargeIdentity =
  | { kind: "linked"; patient: Pick<Patient, "id" | "givenName" | "familyName" | "umrn"> }
  | { kind: "legacy-anonymous" }
  | { kind: "unresolved-link" };

type DischargeRecord = {
  id: string; // `discharge-${admission.id}`, stable through every discharge stage
  generation: number; // reducer world generation, not a date or a patient identifier
  revision: number; // current dischargeRevisions[admission.id] ?? 0
  admissionId: string;
  unitId: string;
  identity: DischargeIdentity;
  admissionState: Admission["state"];
  expectedDischargeAt: Admission["expectedDischargeAt"];
  dischargeConfirmedAt: Admission["dischargeConfirmedAt"];
  dischargeDateSetAt: Admission["dischargeDateSetAt"];
  dischargeDateSetBy: Admission["dischargeDateSetBy"];
  dischargeConfirmedBy: Admission["dischargeConfirmedBy"];
  blockReason: Admission["blockReason"];
  leftAt: Admission["leftAt"];
  leavingDestination: Admission["leavingDestination"];
};

type RecordRead<T> = { status: "allowed"; value: T } | { status: "denied" }; // does not distinguish absent from inaccessible
```

The name keys above are the existing `Patient` keys. The selected identity contains no DOB, address, history, other admission or other referral. Identity is joined by exact ID only: one matching Patient is required; null stays legacy-anonymous and an unknown or duplicate patient ID becomes unresolved-link, without trying names, UMRN, bed, array position, time or movement similarity. Exactly one admission and one referenced unit must resolve too: a detail/action refuses an absent or duplicate subject; a list omits ambiguous admission IDs before projecting, without exposing a hidden-row count. No new link-write or relink action. New admissions continue inheriting the referral link through the current reducer path; the new selector validates it again rather than assuming old `.find`/`.some` calls prove uniqueness. Existing anonymous fixtures remain anonymous.

Internal pure functions are `selectDischargeRecords(state, actor, unitId?): RecordRead<readonly DischargeRecord[]>` and `selectDischargeRecord(state, actor, admissionId): RecordRead<DischargeRecord>`. They are for reducer/provider plumbing only, never exported on the screen context. The exact exposed API is below. Access policy is explicit: coordinator reads across wards; ward reads only its exact existing `actingUnitId` (an omitted filter means that ward, never the network). An explicit different unit filter, ED/officer/community/demo, unknown role and malformed scope are denied. Validate the actor's exact shape; a coordinator does not acquire a ward identity from an extra `actingUnitId`. Coordinator clinical writes remain denied. This narrow policy grants no access to a person's other referrals or episodes. A denied read returns no identity, subject existence, ward count or filtered metadata.

The lists include admissions with an existing planned date, confirmation or recorded departure; no synthetic date is substituted. A confirmed-but-undated admission may show “Date not recorded” without manufacturing a capacity prediction. Anonymous bed releases remain separate operational rows using existing `BedRelease` readers, explicitly with no person link. Never concatenate anonymous and derived releases into a new capacity total: retain the current capacity calculation's chosen source. No duplicate record is created from the same admission merely because its derived release ID changes stage.

New action:

```ts
{
  type: "RECORD_PATIENT_DISCHARGE";
  role: WardFlowRole;
  now: Instant;
  actingUnitId: string;
  admissionId: string;
  patientId: PatientId;
  expectedGeneration: number;
  expectedRevision: number;
  leavingDestination: LeavingDestination;
}
```

Add `dischargeRevisions: Record<string, number>` to reducer state, default empty (= revision 0); expose that revision in every DTO. Existing `PULL_PATIENT` creates a new admission at revision zero; `PATIENT_ARRIVED` increments when it changes that admission from pulled to occupied; accepted `RECORD_LEAVING` and `RECORD_PATIENT_DISCHARGE` increment once with departure. `RELEASE_PULL` removes its admission and its revision entry; a missing admission refuses irrespective of revision. Away/return events change no field in this projection and do not increment it. There are no date/confirmation edit actions today. Any future writer of a projected field must join this invalidation contract.

A linked action is ward-only. After validating role, validate finite time and finite nonnegative safe-integer generation/revision, then exact current generation, unique acting/subject ward, unique live admission, exact patient linkage to one existing patient, matching revision, destination runtime membership, and occupied state. Call the SAME internal departure transition as `RECORD_LEAVING` only after these gates. It changes capacity exactly once and never dispatches `RELEASE_BED`. The consumer copies `expectedGeneration` and `expectedRevision` from the selected DTO, not from a fresh global read at submit time. No names or external identity enter the command.

Legacy `RECORD_LEAVING` stays available with its current ward/occupied semantics for existing anonymous workflows. It also increments revision and captures a discharge audit event, so a stale linked drawer cannot write after an existing path changed the admission. Missing patient link cannot prevent the legacy ward from recording the fact that a person left. The new action refuses a legacy or broken link rather than attaching the supplied patient ID. Do not add a new requirement to every old departure action under the guise of protecting this new linked one.

Read guards execute in the selector/provider API and write guards in the reducer; UI hiding is only presentation. New consumers receive guarded DTOs rather than the raw audit collection or a new unrestricted identity store. Existing `useWardFlow()` exposes raw synthetic arrays to old screens, so this work proves the new local application paths, not a browser-security boundary. Do not call roles authenticated, users verified or data protected against somebody editing browser memory.

## Audit capture, provenance and review

New module: `ward-audit.ts`. Store references and typed facts only. No names, UMRNs, search text, referral history, copied event payloads, arbitrary notes, console output, telemetry, notices or general rejection messages containing new patient fields.

```ts
type AuditCategory = "override" | "legal-status" | "legal-form" | "discharge" | "record-access" | "review";
type AuditActor = {
  role: WardFlowRole | null;
  actingUnitId: string | null;
  attribution: "declared-prototype-role";
};
type AuditSubject =
  | { kind: "admission"; admissionId: string; unitId: string; patientId: PatientId | null }
  | { kind: "movement"; movementId: string; patientId: PatientId | null }
  | { kind: "referral"; referralId: string; patientId: PatientId | null }
  | { kind: "bed-release"; releaseId: string; unitId: string }
  | { kind: "audit-event"; eventId: string }
  | { kind: "unresolved" };
type AuditReason =
  | "none"
  | "role"
  | "scope"
  | "missing-or-inaccessible"
  | "invalid-payload"
  | "identity-link"
  | "generation"
  | "revision"
  | "transition";
type AuditBase = {
  id: string;
  sequence: number;
  generation: number;
  action: WardFlowEvent["type"];
  at: Instant | null;
  actor: AuditActor;
  subject: AuditSubject;
  outcome: "accepted" | "partial" | "denied" | "stale";
  reasonCode: AuditReason;
  origin: "captured-this-session";
};
type AuditReview = {
  id: string;
  eventId: string;
  generation: number;
  at: Instant;
  byRole: "coordinator";
  decision: "reviewed" | "follow-up-required";
};
type WardAuditState = {
  worldGeneration: number;
  auditEvents: readonly AuditEvent[];
  auditReviews: readonly AuditReview[];
  auditSequence: number;
  auditReviewSequence: number;
  auditCaptureStartedAt: Instant;
};
```

Declare `WardAuditState` in `ward-audit.ts` and intersect it into `WardFlowState`; no duplicate timestamp declaration in the reducer. IDs are `audit-N` / `audit-review-N` within `generation`; array order is authoritative when demo instants coincide. Arrays append; no mutation, delete, replacement, automatic cap or purge within a generation. UI displays newest/oldest by copied sorting only. `auditCaptureStartedAt` is seeded as `NOW_ANCHOR`; add its name to `ward-reanchor.ts`'s `INSTANT_FIELDS` and add `ward-audit.ts` to `tests/ward-reanchor.test.ts`'s declaration scan. Seed and shift once through `seedWardFlowStateAt`. Event/review `at` uses the command's already-resolved instant; do not shift runtime entries. No counters/generations/revisions belong in `INSTANT_FIELDS`.

Validate new action times as finite; a rejected malformed time is captured as `at: null` (“Time unavailable”), never an invented instant. All audit sanitizers, including those observing old actions, map nonfinite times and nonmember enums to null. This records malformed legacy behavior without changing its clinical decision. Actor/subject references come from unique resolved state records and a closed role vocabulary; unknown payload strings are not copied into logs. Ambiguous or missing subjects become `unresolved`. Patient references require the same unique link validation as discharge reads.

Capture at the reducer boundary, after its existing decision, exactly once per dispatched event. Factor the existing switch behind a small wrapper if needed; capture must not run in rendering or change eligibility calls, gate order or thresholds. Scope the event classifier explicitly:

| Category     | Captured operations                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Override     | `REFER_TO_UNITS`, `PULL_PATIENT`, `ACCEPT_IN_PRINCIPLE`, `ACCEPT_REFERRAL` when an override reason is supplied, including invalid supplied values. Capture the operation's outcome and any mixed destination results. Separately record whether an existing override fact was actually added in this transition; no inference from a nonempty historic array. Neither supplying a reason nor adding that fact proves a gate was bypassed. |
| Legal status | `CHANGE_LEGAL_STATUS` attempts, including accepted and refused outcomes.                                                                                                                                                                                                                                                                                                                                                                  |
| Legal form   | `RAISE_REFERRAL` captures a selected legal form only when that existing field is supplied; retain the fact that this is initial capture, not a later form-change action. No invented form-edit action or legal deadline.                                                                                                                                                                                                                  |
| Discharge    | `FLAG_BED_RELEASE`, `CONFIRM_BED_RELEASE`, `REVERT_BED_RELEASE`, `BLOCK_BED_RELEASE`, `CLEAR_BED_RELEASE_BLOCK`, `SET_BED_PREPARATION`, `RELEASE_BED`, `RECORD_LEAVING`, `RECORD_PATIENT_DISCHARGE`. Leave-bed actions are not discharge actions. Distinguish anonymous bed subjects from admission subjects.                                                                                                                             |
| Access       | New explicit selected-discharge-detail open attempts. No claim that all record/search activity is captured.                                                                                                                                                                                                                                                                                                                               |
| Review       | New review attempts and accepted review entries.                                                                                                                                                                                                                                                                                                                                                                                          |

Use the following closed details, with `AuditEvent = AuditBase &` the union of `{ category: K; details: Details[K] }` for each category. Restrict each member's `action` to its classified event types. Existing enum aliases come from their present modules; no new clinical vocabulary.

```ts
type OverrideDetails = {
  reason: OverrideReason | null;
  overrideFactRecorded: boolean;
  targets: readonly {
    unitId: string | null; // resolved unit only; invalid target is null
    outcome: "accepted" | "denied";
    reasonCode: AuditReason;
  }[];
};
type BedReleaseAuditFacts = {
  state: BedRelease["state"] | null;
  expectedAt: Instant | null;
  waitingOn: BedReleaseWaitingOn | null;
  blocker: BedReleaseBlocker | null;
  preparing: boolean | null;
  preparationNote: BedPreparationNote | null;
};
type BedReleaseAuditRequest =
  | {
      action: "FLAG_BED_RELEASE";
      expectedAt: Instant | null;
      waitingOn: BedReleaseWaitingOn | null;
      blocker: BedReleaseBlocker | null;
    }
  | { action: "REVERT_BED_RELEASE"; waitingOn: BedReleaseWaitingOn | null }
  | { action: "BLOCK_BED_RELEASE"; blocker: BedReleaseBlocker | null }
  | { action: "SET_BED_PREPARATION"; preparing: boolean | null; note: BedPreparationNote | null }
  | { action: "CONFIRM_BED_RELEASE" | "CLEAR_BED_RELEASE_BLOCK" | "RELEASE_BED" };
type DischargeDetails =
  | {
      kind: "departure";
      before: Admission["state"] | null;
      after: Admission["state"] | null;
      requestedDestination: LeavingDestination | null;
      recordedDestination: LeavingDestination | null;
    }
  | {
      kind: "bed-release";
      before: BedReleaseAuditFacts | null;
      requested: BedReleaseAuditRequest;
      after: BedReleaseAuditFacts | null;
    };
type AuditDetails = {
  override: OverrideDetails;
  "legal-status": { before: LegalStatus | null; requested: LegalStatus | null; after: LegalStatus | null };
  "legal-form": { operation: "initial-capture"; formCode: string | null };
  discharge: DischargeDetails;
  "record-access": { requestId: number | null };
  review: { decision: AuditReview["decision"] | null };
};
```

The small bed snapshot intentionally captures typed facts before and after even when lifecycle state stays unchanged; later edits cannot erase the original blocker/preparation/date assertion. Departure records the validated requested destination and the resulting stored destination separately, including unchanged prior destination on denial. Runtime membership-check every enum and form code against its existing selectable vocabulary; invalid values produce null, not copied strings. For denied operations, `after` is the unchanged resolved state; malformed values remain null. Do not add free text, copied role labels, full payloads or generic `Record<string, unknown>` details.

`REFER_TO_UNITS` already computes permitted and held-back destinations (`ward-flow-reducer.ts:1492–1545`). Capture one typed target result in its existing loop while its decision is available, preserving request order and mapping unknown IDs to null. All accepted means `accepted`, some accepted means `partial`, none accepted means `denied`; a top-level refusal marks each safely resolved requested target denied. Other override actions have their single target result when it resolves. A partial operation uses top-level `reasonCode: 'transition'`; target results identify acceptance/refusal without claiming a historical gate identifier. Do not use rejection growth alone to classify mixed operations. Observe `overrideFactRecorded` from the fact appended by this transition only: a new `Movement.overrides` entry or recorded referral acceptance override. Both `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` can succeed using a reason without adding such a fact, so the flag is false for those current paths; ordinary stage-change attribution is not an override fact. Label it “Override fact recorded”, never “Gate bypassed”. Prior gate/bypass verdict remains “Not captured”; no eligibility rerun or new bypass inference.

For classified operations use an internal result `{ state: WardFlowState; outcome: AuditBase['outcome']; reasonCode: AuditReason; targets?: OverrideDetails['targets'] }` from the existing decision branches; the wrapper appends one event. Keep unclassified actions on their current path. Factor only the captured branches/helpers necessary to return this metadata; do not duplicate or change clinical gates. Neither `nextState !== state` nor rejection-array growth is an acceptance verdict. Exact replay of an open request is the stated exception to one capture per dispatch: it creates no second event. Capturing/reviewing never recursively dispatches another action.

Intercept the three new protected event types at the reducer boundary before the legacy role-refusal string/`subjectId` helpers can inspect their payload. Check `EVENT_ROLE` first there, then their new guards. For a denial with finite `now`, append a general `Rejection` with a sequence-only ID, `movementId: 'none'`, the known action literal and fixed reason “Request could not be completed”; no role, unit, target or patient text enters any field. For a nonfinite `now`, omit the general rejection row rather than inventing its required timestamp; the guarded audit event records `at: null`. Other precise reasons appear only in guarded audit. Old rejection behavior stays unchanged, and its prose is never copied into audit.

Two new commands:

```ts
{ type: 'OPEN_DISCHARGE_RECORD'; role: WardFlowRole; now: Instant;
  actingUnitId?: string; admissionId: string;
  expectedGeneration: number; requestId: number }
{ type: 'REVIEW_AUDIT_EVENT'; role: WardFlowRole; now: Instant;
  eventId: string; expectedGeneration: number; expectedReviewCount: number;
  decision: 'reviewed' | 'follow-up-required' }
```

`OPEN_DISCHARGE_RECORD` validates role, finite time, safe-integer generation/request ID, current generation and the same discharge selector guard before appending an access event. It records the detail-open decision, not proof a human read the screen. List DTOs already contain patient identity and discharge information: this is explicitly not capture before every patient-data disclosure, nor a second level of identity access. The only receipt is that audit event; do not add a receipt collection, token service or open-result store.

Exact additions to the provider context:

```ts
type DischargeOpenHandle = Readonly<{ generation: number; requestId: number }>;
type WardRecordApi = {
  worldGeneration: number; // nonsensitive signal used to clear selected UI state
  readDischargeRecords(actor: WardRecordActor, unitId?: string): RecordRead<readonly DischargeRecord[]>;
  openDischargeRecord(actor: WardRecordActor, admissionId: string): DischargeOpenHandle;
  readDischargeRecord(
    actor: WardRecordActor,
    admissionId: string,
    handle: DischargeOpenHandle | null,
  ): RecordRead<DischargeRecord>;
  readAuditEvents(actor: WardRecordActor): RecordRead<readonly AuditEvent[]>;
  readAuditReviews(actor: WardRecordActor): RecordRead<readonly AuditReview[]>;
};
```

`openDischargeRecord` allocates a safe-integer request ID in a provider `useRef` counter, copies the currently rendered generation/actor/target, dispatches with provider `now`, and returns the handle immediately. The handle is not a success result; until the reducer processes the event the read returns denied. Allocation occurs only in a deliberate handler, never rendering. The request counter remains monotonic across reducer reset/scenario events and resets only with a remounted provider; generation still protects direct reducer callers that reuse a request number. No effects dispatch opens. Existing `dispatch` remains the write API for linked departure and review, using DTO/event generation and revision/count captured when selected.

The provider's `readDischargeRecord` delegates to `readOpenedDischargeRecord(state, actor, admissionId, handle)` in guarded plumbing. Require current generation, valid handle numbers and the first access event for that generation/request ID to be accepted and match actor role/ward and admission ID. Re-run the internal selector and require the captured subject's patient link to agree with the currently validated link. Otherwise return denied, with no data from the old selection. A changed actor, admission selection or world generation clears the consumer's handle; passing a handle for another current selection refuses even before that cleanup. Scope is revalidated on every read. The first recorded access decision owns its valid generation/request ID. A repeat matching an accepted receipt returns unchanged state; any other reuse is refused and cannot produce an accepted event for that ID. A prior denied ID stays denied; append a denial for a mismatched/rejected retry without storing an untrusted target solely to deduplicate it. A new deliberate attempt receives a new request ID. No accepted receipt is overwritten. Invalid request IDs are captured as null and can never resolve a handle.

`readAuditEvents(state, actor)` / `readAuditReviews(state, actor)` in `ward-audit.ts` implement the coordinator-only context methods; no ward-wide audit-history access is inferred from own-ward discharge access. The new collections are not exported wholesale on unrestricted context. A coordinator may review any captured non-review event. Review validates coordinator role, runtime decision, finite time, safe-integer generation/count, matching current generation, exactly one existing target event and exact current review count for that event. A review of a review event is refused. Append a review entry and separate audit review event atomically. Latest review determines display state; absent entry is “Unreviewed”. Reusing the same expected count is stale; submitting the current count appends a later review, even if the decision is unchanged. No free-text review note. Read DTOs are detached copies of the closed records, including nested actor/subject/details/target arrays and patient identity, not references into stored state; callers cannot rewrite provenance through the read API. Types also expose them readonly.

Review means administrative review only. It cannot rewrite the event, erase a refusal, approve a legal form, clear a blocker, change priority, permit a discharge or confer another role. The review's actor is a declared coordinator role, never a named reviewer. Show “Role recorded”; do not label this as who authenticated.

## Persistence and honest coverage

Both audit and review live only in reducer/provider memory. Navigation retains them; reload, provider remount, reset and scenario replacement clear them together with the synthetic world. No browser storage, API, cookie, backend, authentication or migration. Reset is a deliberate session boundary and must not leave old review pointers attached to new sequence IDs. Clearing on reset means this is not an immutable retained audit log.

Exact generation lifecycle: initial `seedWardFlowState` sets `worldGeneration: 0`, empty audit/review/revision collections and zero audit/review counters. On an accepted `RESET_SCENARIO` or `SET_SCENARIO`, retain the existing seed/clock calculation, then set the replacement state's `worldGeneration` to the prior state's generation plus one. Other domain state reseeds as before. Advance only for accepted reset/scenario events, never for `ADVANCE_CLOCK` or a refusal. Generation is a safe nonnegative integer and never wraps; refuse a new reset if it would exceed `Number.MAX_SAFE_INTEGER`. All three new commands compare `expectedGeneration` before resolving subjects; mismatch produces `stale` with reason `generation` and an unresolved subject. The audit event documenting that stale attempt belongs to the current generation; it must not attach the old target ID to a newly seeded subject. An old review cannot target a new `audit-1`, and an old departure cannot consume a new admission's revision zero. No new generation field is required on legacy events.

Reducer reset does not remount children, so screens clear selected DTOs/handles when `worldGeneration` changes. The reducer/selector generation check is authoritative even before that UI cleanup. Provider remount, including initial clock adoption, destroys its consumer subtree, request allocator and reducer together and starts generation zero anew; handles are neither stored nor transferred between provider instances. No durable or globally unique epoch mechanism is required for this local contract.

Seed audit/review arrays empty. Never synthesize capture rows by scanning seeded overrides, legal changes or departures. Governance can retain an independently labelled historical-facts register, but its rows have “Capture/review unavailable” and cannot be reviewed as captured events. New queue counts cover only captured events, never all historical operations. A concise persistent qualifier is enough: “Captured this session · resets with demo”. Access detail says “Discharge opens captured this session”; existing page-local search wording remains true. Mockup claims of all-network authenticated history remain unsupported.

## Consumer contract and owned implementation files

Capacity Ward tab keeps anonymous ward/capacity aggregates. Its Discharges tab requests the selected ward's guarded `DischargeRecord[]`, then calls the guarded open action for a selected detail. The network view uses the coordinator projection. Discharges board uses the same DTO, stable record ID, revision and open/departure actions. Legacy anonymous bed rows offer only existing bed actions. Governance reads the coordinator audit/review APIs and captured-event filter vocabulary. No consumer derives identity itself or sends actions while merely filtering/rendering a list.

Task 3's exact owned implementation source files:

- Add `src/components/ward-management/ward-discharge-records.ts` and `ward-audit.ts`.
- Edit `src/components/ward-management/ward-flow-events.ts`, `ward-flow-reducer.ts`, `ward-flow-provider.tsx` for the contracts, runtime gates, capture, sequence/reset handling and guarded APIs.
- Edit `src/components/ward-management/ward-reanchor.ts` only to include `auditCaptureStartedAt` in the existing instant-name set.
- No `BedRelease`, eligibility, ranking, legal vocabulary, admission-schema, seed-identity, search-log or screen source edits are required for this contract milestone.

Exact owned test files:

- Add `tests/ward-discharge-records.test.ts`, `tests/ward-patient-discharge.test.ts`, `tests/ward-audit.test.ts`, `tests/ward-audit-provider.dom.test.tsx`.
- Edit `tests/ward-patient-link-default-deny.test.ts` only to explicitly admit the new selector/audit plumbing that actually reads links, retaining anti-vacuity checks and named scope reasons.
- Edit `tests/ward-flow-reducer.test.ts` only where its exhaustive action/seed contracts require the added fields/events; retain old transition assertions.
- Edit `tests/ward-reanchor.test.ts` to scan `ward-audit.ts`'s timestamp declarations alongside its existing model files and assert nonzero capture-start shifting, including reset after clock advance. Retain exact-name equality and anti-vacuity assertions; do not broaden the instant set to counters or durations.

Capacity/Discharges/Governance screen implementations and their DOM assertions belong to their later screen owners. They will deliberately replace tests asserting missing review functionality, while keeping no-durable-access claims and default-deny properties. No screen source changes in Task 3.

## Focused acceptance cases

1. Coordinator reads a selected ward/network discharge list; ward reads own ward; other ward, ED, officer, community, demo, unknown role and missing scope return no sensitive data. Direct helper and direct reducer calls exercise denial, not only disabled UI.
2. Exact patient ID resolves; null stays legacy; unknown/duplicate patient ID stays unresolved; a same-name/same-UMRN patient is never substituted. Duplicate admission/unit IDs refuse detail and mutation without changing multiple records. No other admission/referral is disclosed.
3. Linked departure succeeds for owning ward and current generation/revision, updates the admission and existing bed arithmetic once; coordinator/cross-ward/wrong patient/invalid destination/stale revision/nonfinite time/waitlisted/pulled/departed are refused. Read the revision from an actual DTO, mutate via an existing admission path, then prove the old DTO cannot write. Existing anonymous departure still works.
4. Open receipt is required for the detail-open flow and bound to generation/actor/request/subject/current link. Denied/old selection/role switch/stale link cannot expose the old detail. Repeating an accepted request is idempotent; a denied or mismatched reused ID cannot become accepted. Lists remain guarded reads but are not logged as detail opens. Filtering is not reported as somebody reading a record.
5. Capture accepted, partial, denied and stale paths independently. Exercise all-permitted/all-refused/mixed `REFER_TO_UNITS`, plus reason-bearing `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` with no override fact. Original decision outcomes survive without parsing rejection prose or rerunning gates. No search words, name, UMRN or arbitrary role/ID/enum payload reaches new general rejection fields. Audit references are resolved and enum facts sanitized.
6. Review is coordinator-only; missing/duplicate event, review-event subject, malformed decision/time/count and stale count/generation refuse. Second review appends; original event is deeply unchanged; clinical state/capacity/eligibility are byte-for-byte unchanged by access/review. Attempt to mutate a returned nested DTO and prove the stored audit/review/identity remains unchanged.
7. Seeded history creates zero captured events; first event/review has deterministic generation-scoped identity. Test a nonzero clock offset and reset after clock advance; capture start shifts once and counters do not. Navigation keeps state. Reset/scenario clear collections and increment generation while the provider request counter continues; remount recreates the whole world and allocator. No storage/network is touched.
8. Existing anonymous/derived bed release field contracts remain intact, including confirmed-undated behavior, terminal departure and inter-ward statewide exclusion. Preserve existing eligibility/ranking and legal-figure guards; no fabricated deadline tests.
9. Open a record, retain its handle and a departure command, reset, and open the same actor/subject again (also exercise a direct request-ID reuse). The old handle and command refuse. Likewise retain a review command across reset and recreate the same audit event ID; the old review cannot attach to it. Stale-generation audit subjects stay unresolved rather than pointing to newly seeded records.
10. Block/clear or preparation updates preserve lifecycle state but capture different typed before/requested/after facts. A later change cannot rewrite those earlier facts. Capture the actual departure destination; malformed legacy values become null in audit without changing the legacy transition's decision. New protected wrong-role denials never pass through the old payload-interpolating role/subject helpers. Malformed time creates audit `at: null` and no invented general rejection timestamp.

R1–R5 are addressed in this proposal: revision DTO/invalidation, mixed outcomes and override-fact semantics, reanchor ownership, generation-bound commands/handles, and immutable typed discharge facts. The implementation risks requiring focused proof are preserving decision order while extracting capture metadata, enforcing generation checks before resolving stale subjects, keeping both clock/reset paths consistent, and preventing nested DTO aliasing. Controller inspection of this corrected design remains outstanding. No further owner question is needed for these local corrections. Broader staff identity, historical retention, legal-form editing or wider access-capture coverage remains separate scope.
