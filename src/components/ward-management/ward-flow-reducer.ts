import {
  validCareChange,
  careChangeRefusal,
  applyCareChange,
  emptyCareJourney,
  recordedCommunityTransition,
} from "./ward-care-journey";
import {
  appendAudit,
  classifyAuditEvent,
  finiteInstant,
  reviewDecision,
  type AuditDecision,
  type WardAuditState,
} from "./ward-audit";
import {
  dischargeIdentity,
  readOpenedDischargeRecord,
  safeCounter,
  selectDischargeRecord,
  uniqueRecord,
  validRecordActor,
  type WardRecordActor,
} from "./ward-discharge-records";
import { isLeavingDestination, isFollowUpState, daysInBed, type LeavingDestination } from "./ward-admissions";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import type { Instant } from "@/components/ward-management/ward-clock";
import { type BroadcastAlert } from "./alerts/ward-broadcast-model";
import { reduceBroadcastAlertEvent } from "./alerts/ward-broadcast-reducer";
import { reduceInboxEvent } from "./ward-inbox-reducer";
import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  CANCEL_TRANSPORT_REASONS,
  LEGAL_FORM_RECEIPT_CORRECTION_REASONS,
  LEGAL_STATUS_CHANGE_REASONS,
  RELEASE_PULL_REASONS,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
  DIVERSION_REASONS,
  URGENCY_CHANGE_REASONS,
  URGENT_MARK_REASONS,
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  GENDER_NO_LONGER_SUITS_REFUSAL,
  GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL,
  OVERRIDE_REASONS,
  WARD_REQUEST_WITHDRAWAL_REASONS,
  wardRequestWithdrawalReasonLabels,
  WARD_INTAKE_CONSTRAINTS,
} from "@/components/ward-management/ward-change-reasons";
import {
  candidateReason,
  eligibility,
  adjustSexMix,
  mixSexOf,
  referralEligibility,
  type EligibilityGate,
} from "@/components/ward-management/ward-eligibility";
import {
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  referralState,
  referralSuburbIsAnswered,
} from "@/components/ward-management/ward-referrals";
import {
  EVENT_ROLE,
  WARD_BUZZ_MESSAGES,
  REPATRIATION_MODES,
  WARD_FLOW_ROLE_LABELS,
  type RepatriationMode,
  type WardFlowEvent,
  type OverridableWardFlowEvent,
  type WardFlowRole,
} from "@/components/ward-management/ward-flow-events";
import { SELECTABLE_LEGAL_FORMS, countryExtensionEligible } from "@/components/ward-management/ward-legal-forms";
import {
  form3CRefusedAfter3D,
  isLegalClockFormCode,
  ARRIVAL_LATE_AFTER_MINUTES,
  WAITLIST_INSTEAD_OF_DECLINE_REASONS,
  GENDER_MISMATCH_DECLINE_REASON,
  isArrivalLate,
  leaveBedNeedsOpenWarning,
} from "@/components/ward-management/ward-legal-clock";
import { isTentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { communityTeamById, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  BED_RELEASE_WAITING_ON,
  COHORTS,
  COMMUNITY_DECLINE_REASONS,
  DECLINE_REASONS,
  ED_DECLINE_REASONS,
  HOME_REGIONS,
  MOVEMENT_STAGES,
  REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_HISTORY_LIMITS,
  SENDING_TEAM_NAME_LIMIT,
  type CommunityDeclineReason,
  type ReferralCorrection,
  type ReferralHistoryField,
  REFERRAL_SOURCES,
  RECORDED_SEXES,
  genderReviewNeeded,
  REFERRAL_GENDERS,
  REFERRAL_DESTINATION_KINDS,
  REFERRAL_PURPOSES,
  STEP_BACK_REASONS,
  type ReferralAddressing,
  type ReferralDeclineReason,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
} from "@/components/ward-management/ward-model";
import type {
  MovementId,
  Addressee,
  BedRelease,
  LeaveBed,
  Movement,
  MovementStage,
  Notice,
  NoticeKind,
  Referral,
  WardReferralDestination,
  ReferralDestinationKind,
  Rejection,
  TransportLegalStatus,
  TransportProvider,
  Unit,
} from "@/components/ward-management/ward-model";
import {
  defaultWardConfiguration,
  describeInvalidConfiguration,
  validateConfiguration,
  type WardConfiguration,
} from "@/components/ward-management/ward-configuration";
import {
  bedReleases,
  generatedMovementPatients,
  leaveBeds,
  referrals,
  wardMovements,
} from "@/components/ward-management/ward-movements";
import { applyRulingsDemoOverlay } from "@/components/ward-management/ward-rulings-demo";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import {
  WARD_SCENARIOS,
  scenarioNetwork,
  scenarioUnits,
  type WardScenario,
} from "@/components/ward-management/ward-scenarios";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import {
  remainingHighAcuityCapacity,
  remainingSpeciallingCapacity,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { GENDERS } from "@/components/ward-management/ward-patients";
import type { Patient } from "@/components/ward-management/ward-patients";
import { combineWardPatients } from "@/components/ward-management/ward-patients-seed";
import { generatedOccupantPatients, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * Every seeded person: the hand-authored patients plus the generated ones the admission and
 * movement seeds name (owner rule, 25 Sept 2026: every record belongs to a patient who exists).
 * A person on both a pulled bed and its movement is listed once.
 */
const wardPatients: Patient[] = [
  ...new Map(
    combineWardPatients(generatedOccupantPatients, generatedMovementPatients).map((patient) => [patient.id, patient]),
  ).values(),
];
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { withDemoPlannedMoveTimes } from "@/components/ward-management/ward-demo-planned-moves";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";

/**
 * Stages `REFER_TO_UNITS` accepts, exported so a UI surface can pre-check referability and gate
 * its own control before dispatching — never optimistically claim a referral happened and let
 * this be the thing that silently refuses it (Task 5 fix round 1: `ShortlistPanel` used to
 * dispatch and unconditionally render success, so a movement at, say, `pulled` — still open,
 * still offering eligible candidates — showed "Referred by a human coordinator" while nothing
 * had happened). A single shared constant, used here AND by `ward-derivations.ts`'s
 * `referralBlockedReason`, so the two checks can never drift apart.
 */
export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested", "destination_review"];

/**
 * WHAT THE REDUCER ITSELF WRITES INTO `Movement.blocker` WHEN A MOVEMENT'S SITUATION CHANGES.
 *
 * ⚠️ **`Movement.blocker` — the free-prose one. NOT `BedRelease.blocker`**, which is a
 * `BedReleaseBlocker` enum about a bed being freed and is written by `BLOCK_BED_RELEASE` /
 * `CLEAR_BED_RELEASE_BLOCK`. Two fields, one name; nothing here goes near the other.
 *
 * **Why the reducer writes anything at all.** Until 2026-09-01 this field was set once, at
 * creation, to `"Awaiting coordinator referral"`, and no transition ever touched it. That sentence
 * stopped being true the moment a coordinator referred, and it stayed on screen through
 * acceptance, transport and collection — the movement console renders it as **Response** and
 * **Current blocker**, so somebody chased a patient whose ambulance was already moving. A blocker
 * describing an earlier stage is wrong BY CONSTRUCTION, not merely out of date, so the reducer
 * restates it wherever it has just been told something the standing sentence CONTRADICTS.
 *
 * ⚠️ **THE PROPERTY IS "NEVER CONTRADICTED BY THE RECORD BESIDE IT", NOT "NEVER OLDER THAN THE
 * STAGE BESIDE IT"** — this comment claimed the second until 2026-09-01 and the code never held it.
 * `PULL_PATIENT` moves the stage to `pulled` and leaves `"Awaiting a bed at the accepting ward"`
 * standing, which falsifies the stage version outright; `HANDOVER_READY` does the same with
 * `"Awaiting a transport provider response"`. Both are CORRECT, and that is the point: a pull
 * allocates a bed without making one ready — the seed's own three `pulled` movements say "Awaiting
 * single-room clean", "Ward finalising bed clean" and "Escort provider organising secure
 * transport" — and a handover being ready does not make a provider answer. Neither event is told
 * anything that contradicts the sentence it inherits, so writing one there would overwrite a
 * ward's real observation with a vaguer machine one. The two transport legs below ARE told such a
 * thing (`acceptedAt`, then `enRouteAt`), which is why they restate and these two do not. State
 * the property that holds; do not restore the one that reads more strongly and is false.
 *
 * **What these sentences are allowed to be.** Restatements of what the model has been told, and
 * nothing more. `"Awaiting a bed at the accepting ward"` says the stage is `accepted_awaiting_bed`;
 * `"None — in transit"` says the patient has been collected. None of them invents a fact about a
 * ward, a person or a provider — the richer sentences the seed carries ("Awaiting single-room
 * clean", "Escort provider organising secure transport") are things only a human knows, and only
 * `RECORD_MOVEMENT_BLOCKER` may write those.
 *
 * ⚠️ **A HUMAN'S PROSE IS OVERWRITTEN BY THE NEXT TRANSITION, AND THAT IS THE DESIGN.** A ward
 * that recorded "Awaiting single-room clean" while the patient was pulled will see that replaced
 * when transport is booked. The situation genuinely changed; a note about the old one is exactly
 * the staleness this table exists to end. If it is still true, it is recorded again — the same way
 * a handover note is repeated at handover rather than assumed to still hold.
 *
 * ⚠️ **THE SEED IS NOT DERIVED FROM THIS TABLE AND MUST NOT BE.** The twenty-one hand-authored
 * values (`ward-movements.ts`) stay exactly as written; two of them sit at the same stage with
 * different words ("Transport escort confirming departure time" and "Awaiting transport escort",
 * both `handover_ready` with a transport job), which is direct evidence that a stage does NOT
 * determine this field. That is why deriving it was refused and why only these nine sentences are
 * ever written (across ten events — `didNotProceed` covers both closures that are not an arrival):
 * the points where the previous sentence is provably false, not merely possibly stale.
 *
 * `hasActiveBlocker` (ward-priority.ts) must recognise every "nothing is blocking" phrasing here
 * as inactive, or a settled movement scores ten points for an obstruction it does not have. The
 * three below all use the `"None — …"` shape it already matches.
 */
export const STAGE_TRANSITION_BLOCKERS = {
  /** `REFER_TO_UNITS`: referrals are live and nobody has answered yet. */
  referred: "Awaiting destination response",
  /** `ACCEPT_IN_PRINCIPLE`: a unit has accepted; the bed itself is what is outstanding. */
  accepted: "Awaiting a bed at the accepting ward",
  /** `BOOK_TRANSPORT`: a job exists and the provider has not accepted it. */
  transportBooked: "Awaiting a transport provider response",
  /** `CANCEL_TRANSPORT`, bed-held branch only — owner answer 30 (2026-09-17), build plan item 30:
   *  "no automatic rebooking; a person books again." The job is removed, not replaced, so this
   *  reads the fact the record now supports instead of `transportBooked` (false, the job is gone)
   *  or `accepted` (also false — the bed IS still held here, unlike the no-bed-held branch, which
   *  keeps writing `accepted`). An ACTIVE blocker: somebody still has to book again. */
  transportCancelled: "Transport cancelled; not booked again yet",
  /** `TRANSPORT_ACCEPTED`: the provider ANSWERED — `transport.acceptedAt` is set — and has not set
   *  off. Restates `acceptedAt` and nothing else: which provider and whether an escort was asked
   *  for are on the job itself and `transportStatusLabel` already renders them. */
  transportAccepted: "Awaiting the transport provider's departure",
  /** `TRANSPORT_EN_ROUTE`: `transport.enRouteAt` is set and `collectedAt` is not. The vehicle is
   *  moving and the patient is still where they were; an ACTIVE blocker, deliberately, because
   *  nobody has been collected yet — `collected` below is the first value that says otherwise. */
  transportEnRoute: "Awaiting collection — transport is en route",
  /** `PATIENT_COLLECTED`. One of the two "absence with its reason" values the seed already
   *  carries, reused verbatim rather than reworded — the fixture and the reducer must not describe
   *  one situation with two sentences. */
  collected: "None — in transit",
  /** `PATIENT_ARRIVED`. The seed's other absence-with-reason value, again verbatim. */
  arrived: "None — handover complete",
  /** `RECORD_EXAMINATION` and `WITHDRAW_REFERRAL`, the two closures that are not an arrival.
   *  Nothing is blocking because there is no longer anything to block. */
  didNotProceed: "None — the movement did not proceed",
  /**
   * `RECORD_EXAMINATION` (`community_order`/`revoked`) at `handover_ready` or `moving` — owner
   * ruling WLQ-4 (2026-09-15). Not "did not proceed": the movement is deliberately NOT closed at
   * these two stages, so this sentence describes an open, active situation rather than a settled
   * one, and it is the only value in this table written by an event that leaves the movement open.
   */
  examinationRevokedAwaitingRelease: "Awaiting a coordinator to release the bed, because the examination was revoked",
  /**
   * `WITHDRAW_WARD_REQUEST` (RA1, item 18), and only when it empties `referredUnitIds` — a
   * different active situation from `referred` above (which says referrals ARE live), so it is a
   * SECOND value rather than a restatement. `acceptedUnitId` is never set here (that is `accepted`'s
   * job), and the movement stays open — a coordinator must refer again before anyone is asked.
   * Deliberately not "None — …": something IS outstanding here (a fresh REFER_TO_UNITS), so
   * `hasActiveBlocker` (ward-priority.ts) must keep scoring it as active. Withdrawing one ward while
   * others stay live does not touch `blocker` at all — `referred` above is still true.
   */
  wardRequestWithdrawn: "No ward is being asked",
  /**
   * `STOP_TRANSPORT` — owner answer 8 (second round, 2026-09-17): *"A stop after collection keeps
   * the bed held until the coordinator, the ward or the referrer releases it."* Before this, a stop
   * gave the bed back automatically (the same `releasePulledBedAndAdmission` call `RELEASE_PULL`
   * uses) and wrote `didNotProceed`. That call is now skipped: the movement still closes
   * `did_not_proceed` (the journey itself is over), but `acceptedUnitId`/`admissionId` are left
   * exactly as they were, so the bed stays reserved. An ACTIVE blocker, deliberately not
   * "None — …": a decision is still outstanding (who releases it), even though the journey has
   * ended — `RELEASE_HELD_BED` is the event that clears it, and only it clears it.
   */
  transportStoppedAwaitingRelease:
    "Awaiting the coordinator, the ward or the referrer to release the bed, because transport was stopped",
  /**
   * `RECORD_DIVERSION` — build plan item 29 (T4a, 2026-09-17) / OA-29: a collected journey was
   * diverted; the bed stays held and the movement stays OPEN until `RELEASE_DIVERTED_BED`. An
   * ACTIVE blocker, deliberately not "None — …": a release decision is still outstanding.
   */
  divertedAwaitingRelease:
    "Awaiting the coordinator, the ward or the referrer to release the bed, because the patient was diverted",
} as const;

/**
 * The whole of Task 3 onward is proved against this shape. Units live in state, not just
 * movements — the correction the design spec calls out explicitly: a ward that accepts, holds
 * and receives a patient with capacity that never moves makes the primary screen less true the
 * more it is used.
 */
export type WardFlowState = WardAuditState & {
  dischargeRevisions: Record<string, number>;
  movements: Movement[];
  units: Unit[];
  /** Refused transitions, newest first. */
  rejections: Rejection[];
  /** Demo jump-forward control. `now` is NOW_ANCHOR + elapsed + this offset, derived outside the reducer. */
  clockOffsetMinutes: number;
  /** Deterministic id source for referrals raised through RAISE_REFERRAL. No Math.random(). */
  referralSequence: number;
  /**
   * Fix round 2 (P2). Deterministic id source for leave beds raised through `RECORD_LEAVE_BED`,
   * independent of `state.leaveBeds.length` for the same reason `referralSequence` is independent
   * of `state.movements.length` — but here it actually matters, because `END_LEAVE_BED` REMOVES
   * entries (referrals are never removed, so `movements.length` would have been safe too).
   * Deriving the id from the array's length after removal makes ids repeat: record two, end the
   * first, record a third, and the third gets the first's id back — React sees duplicate `key`s,
   * and `END_LEAVE_BED`'s own id-filter then removes every leave bed sharing that id, silently
   * deleting the wrong record. This field only ever increases, so an id is never reused. No
   * `Math.random()`, same discipline as `referralSequence`.
   */
  leaveBedSequence: number;
  /** Which synthetic night is seeded — `ward-scenarios.ts`'s operational-numbers-only variants. */
  scenario: WardScenario;
  /**
   * Task 11 (spec item 9): beds expected to free up, now live reducer state rather than a frozen
   * fixture constant — `FLAG_BED_RELEASE` appends here, so a ward's own flag actually moves
   * `unitCapacity()`'s `potential` figure. Seeded from `ward-movements.ts`'s `bedReleases`.
   */
  bedReleases: BedRelease[];
  /**
   * Task 3: beds occupied by someone on approved leave, live reducer state for the same reason
   * `bedReleases` is — `RECORD_LEAVE_BED`/`END_LEAVE_BED` append to and remove from it, so a
   * ward's own report actually moves what the capacity board shows. Seeded from
   * `ward-movements.ts`'s `leaveBeds`. Never merged into availability (spec D4).
   */
  leaveBeds: LeaveBed[];
  /**
   * Task 3, spec D12: the one thing a coordinator may do to a ward's bed data. Recording a
   * request changes no bed figure at all — it is a record that somebody asked, with the time and
   * the requesting role, nothing more. `REQUEST_CAPACITY_REFRESH` appends here.
   */
  refreshRequests: { unitId: string; at: Instant; byRole: string; message?: string; urgent?: boolean }[];
  /** Morning bed rollup confirmations per unit. */
  morningRollupConfirmations: Record<
    string,
    { confirmedAt: Instant; confirmedByRole: string; expectedDischarges: number }
  >;
  /**
   * Phase 7 Task 3 (spec "The front door", controller ruling P1): Task 1 added the `Referral`
   * type and a hand-authored fixture for it, but nothing wired either into live state — this is
   * that wiring. `RECEIVE_REFERRAL` appends here; `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` transition
   * an entry in place via `replaceReferral`, exactly the discipline `bedReleases` already holds to
   * (nothing here ever REMOVES a referral, the same reason `nextReferralId` above is safe to
   * derive from an ever-growing array — see `frontDoorReferralSequence`'s own comment for why the
   * id source itself still does not lean on that). Seeded from `ward-movements.ts`'s `referrals`.
   */
  referrals: Referral[];
  /**
   * Monotonic id source for `RECEIVE_REFERRAL`, mirroring `leaveBedSequence`'s own discipline:
   * only ever increases, never derived from `state.referrals.length` — see `leaveBedSequence`'s
   * doc comment above for the Phase 5 collision that discipline exists to prevent.
   *
   * Named `frontDoorReferralSequence` rather than the field the brief for this task literally
   * names ("referralSequence") for a reason worth recording rather than silently working around:
   * `referralSequence` already exists on this type, and already means something — it is the id
   * source `RAISE_REFERRAL` (an ED clinician referring a patient already in the department) uses
   * to mint `Movement` ids ("WF-9NN"). That field predates this phase by several commits and is a
   * completely different concept from Task 1's front-door `Referral` (a request for a bed from
   * anywhere in the network, before it is ever a `Movement`) — the two are both colloquially
   * "referrals" but neither the record they identify nor the id namespace they mint from is the
   * same thing. Reusing `referralSequence` for both would not corrupt any single record (the two
   * id formats — "WF-9NN" vs "RF-9NN" — never collide even sharing one counter), but it would
   * silently couple two independent concepts' id supplies for no reason, which is exactly the
   * kind of muddling this model's naming discipline (`leaveBedSequence` isolated from
   * `referralSequence` itself, `bedReleases` isolated from `leaveBeds`) exists to prevent. A
   * distinct name costs nothing and keeps the two things as separate as they actually are.
   */
  frontDoorReferralSequence: number;
  /**
   * The people in the beds. Task 17.
   *
   * WHY THIS IS HERE AT ALL. Until 2026-08-30 this reducer contained the word "admission" zero
   * times. `PATIENT_ARRIVED` closed the movement, decremented the unit's empty count and bumped its
   * sex mix - and created no record of the person. So a patient who reached a ward became a CLOSED
   * MOVEMENT and nothing else, and `isOpen` (`!closure && stage !== "arrived"`) removes closed
   * movements from ten surfaces: the queue, the coordinator inbox, handover, placement, patient
   * search, the pressure strip, the live tracker and the ED screen among them.
   *
   * The consequence is the owner's own foundation failing at its last step. A person gets from an
   * emergency department to a ward - the thing this prototype exists to show - and the
   * demonstration immediately stops being able to see them. Arrival was modelled as an ENDING with
   * nothing on the other side of it.
   *
   * Seeded from `ward-admissions-seed.ts` so the beds start occupied by the same people the board
   * already renders, and so an arrival appends a record OF THE SAME SHAPE rather than a second
   * kind of occupant that every consumer would have to learn about.
   */
  /**
   * The people. Owner ruling PD-1, 2026-08-30.
   *
   * Separate from `admissions` because the lifecycles are different, not because the data is. An
   * admission is a stay in one bed - correctly born at arrival, ended when the person leaves. A
   * patient exists before any referral, outlives every admission, and is the thing the owner's flow
   * searches for: "search a patient, and if nobody comes up, ADD them."
   *
   * A record created by arrival would look right on every screen showing admitted people and be
   * missing at exactly that moment.
   */
  patients: Patient[];
  /** Monotonic id source for added patients - same discipline as the other sequences here: only
   *  ever increases, never derived from `state.patients.length`, which the seed makes non-zero. */
  patientSequence: number;
  admissions: Admission[];
  /** Monotonic id source for admissions created by arrival, holding the same discipline as
   *  `leaveBedSequence` and `frontDoorReferralSequence`: only ever increases, and never derived
   *  from `state.admissions.length`, which the seed already makes non-zero. */
  admissionSequence: number;
  /**
   * Ward-lead task, 2026-09-06: who has acknowledged which action-inbox row (`InboxItem.id`,
   * `ward-derivations.ts`), and since when. `ACKNOWLEDGE_INBOX_ITEM` (`ward-flow-events.ts`)
   * appends here; nothing else writes to it and nothing ever removes an entry.
   *
   * 🔴 **NEVER READ BY `buildActionInbox`, AND MUST NEVER BE.** Acknowledging a row must not change
   * whether `buildActionInbox` returns it — see that event's own doc comment. A screen wanting to
   * show "acknowledged by X since Y" reads this map ALONGSIDE the inbox's own output, keyed by the
   * same `InboxItem.id`, never as an input the inbox computation itself consults.
   */
  inboxAcknowledgements: Record<string, InboxAcknowledgement[]>;
  /**
   * Ward-lead task, 2026-09-06: the completion history of each action-inbox row, keyed by
   * `InboxItem.id`. `COMPLETE_INBOX_ITEM` and its undo `REOPEN_INBOX_ITEM`
   * (`ward-flow-events.ts`) both append here; see `InboxCompletionEntry` and
   * `inboxItemCompletionState` below for why this is a history rather than a boolean.
   */
  inboxCompletions: Record<string, InboxCompletionEntry[]>;
  /**
   * Communication addendum (`docs/ward-flow/plans/2026-09-1x-communication-addendum.md`, §1.1),
   * owner ruling D-2, 2026-09-10 — the AUTHORED list beside `buildActionInbox`'s DERIVED one. See
   * `ward-model.ts`'s own header comment on `Notice` for why a second list is the correct shape here
   * and not the duplicated-effort failure the addendum's §0 warns against.
   *
   * Appended to by exactly six event cases below (`ACCEPT_IN_PRINCIPLE`, `DECLINE`, `DECLINE_REFERRAL`,
   * `ACCEPT_REFERRAL`, `RELEASE_PULL`, `CANCEL_TRANSPORT`), each through `appendNotices`, which is
   * also where a `demo`-addressed notice is refused. Never read by `buildActionInbox` and never
   * written by it — the same one-way discipline `inboxAcknowledgements`'s own doc comment states for
   * itself, so acknowledging or completing an inbox row can never accidentally raise a notice, and a
   * notice can never accidentally change what the derived inbox shows.
   */
  notices: Notice[];
  /**
   * Task 3 of the audit-wiring plan, 2026-09-16: the coordinator-tunable figures an engine read
   * site actually consults, replacing three anonymous literals/constants (`event.now + 60`,
   * `ED_ACCESS_TARGET_MINUTES`, `PARALLEL_REFERRAL_CAP`) with one auditable record.
   * `SET_CONFIGURATION` is the only event that writes here; `RESET_SCENARIO`/`SET_SCENARIO`
   * reseed it to `defaultWardConfiguration()` along with everything else.
   */
  configuration: WardConfiguration;
  /**
   * Phone-logged repatriations. `RECORD_REPATRIATION` appends here and never creates a transport
   * job. One record per admission; a second is refused.
   */
  repatriations: RepatriationRecord[];
  /** Handover sign-offs — role and time only. `RECORD_HANDOVER_SIGN_OFF` appends here. */
  handoverSignOffs: HandoverSignOffRecord[];
  /**
   * Clinical contacts — team, time, and role. Contacting a team is this record, not a sent
   * message. `RECORD_CLINICAL_CONTACT` appends here.
   */
  clinicalContacts: ClinicalContactRecord[];
  /** Active and historical statewide broadcast directives. */
  broadcastAlerts: BroadcastAlert[];
  /** Monotonic sequence counter for broadcast IDs (e.g. BCAST-1). */
  broadcastSequence: number;
};

/** Phone-log of a repatriation arranged off-system. Never a booked transport job. */
export type RepatriationRecord = {
  admissionId: string;
  at: Instant;
  by: WardFlowRole;
  homeHospital: string;
  receivingWardAgreed: boolean;
  mode: RepatriationMode;
  provider: TransportProvider;
  cadNumber: string;
  transportLegalStatus: TransportLegalStatus;
  estimatedAt: Instant;
};

/** Shift handover sign-off. Role and time only. */
export type HandoverSignOffRecord = {
  at: Instant;
  by: WardFlowRole;
};

/** Record that a team was contacted. Not a sent message. */
export type ClinicalContactRecord = {
  teamId: string;
  at: Instant;
  by: WardFlowRole;
};

/**
 * ONE ACKNOWLEDGEMENT OF ONE ACTION-INBOX ROW — ward-lead task, 2026-09-06 (making
 * `buildActionInbox`, `ward-derivations.ts`, a real to-do list). Written only by
 * `ACKNOWLEDGE_INBOX_ITEM`.
 *
 * `by` IS A ROLE, NEVER A PERSON — the same discipline `Override.by`, `StatusChange.by` and
 * `StageChange.by` (`ward-model.ts`) already hold to, taken from the triggering event's own `role`
 * via `WARD_FLOW_ROLE_LABELS`, never supplied directly by a caller.
 *
 * ⚠️ **APPEND-ONLY, AND IDENTITY IS ARRAY POSITION, NEVER `at`.** Two acknowledgements of the same
 * row in one render carry the SAME `at` — `ADVANCE_CLOCK` is the only thing that moves `now`
 * independently, so four dispatches in one tick are four events at one instant. Nothing in this
 * file may look an entry up, sort these arrays, or deduplicate them by `at`; insertion order is the
 * only thing that tells two same-instant acknowledgements apart, exactly as it already does for
 * `Movement.overrides`, `Movement.stageChanges` and `Movement.unwinds`.
 */
export type InboxAcknowledgement = {
  at: Instant;
  by: string;
};

/**
 * ONE ENTRY IN AN ACTION-INBOX ROW'S COMPLETION HISTORY — written by `COMPLETE_INBOX_ITEM` and its
 * undo, `REOPEN_INBOX_ITEM`. Same ward-lead task and the same append-only, position-is-identity
 * discipline as `InboxAcknowledgement` above (see that type's own doc comment for the timestamp
 * reasoning, which applies here unchanged).
 *
 * ⚠️ **NOT A BOOLEAN, ON PURPOSE.** "Is this row complete right now" is answered by reading the
 * LAST entry for that row (`inboxItemCompletionState` below), never by a stored flag — a flag would
 * have to be flipped in place on every completion and reversal, which is exactly the silent
 * rewrite-of-history this design refuses. Every write — completing or reopening — is its own new
 * entry; nothing already written is ever edited or removed.
 */
export type InboxCompletionEntry = {
  at: Instant;
  by: string;
  kind: "completed" | "reopened";
};

export {
  inboxItemCompletionState,
  type InboxItemKind,
  INBOX_CATEGORIES,
  inboxItemKindOf,
  reduceInboxEvent,
} from "./ward-inbox-reducer";

/**
 * Deep-copies the frozen fixture so tests (and later, screens) never alias or mutate it.
 * Defaults to the standard night so `RESET_SCENARIO` (which calls this with no argument) always
 * returns to the standard night rather than staying on whichever scenario was active — an
 * explicit product-owner decision, not an oversight.
 */
export function seedWardFlowState(scenario: WardScenario = "standard"): WardFlowState {
  // The EMHS demo and surge scenarios bring their own wards and linked patients
  // (`ward-demo-network.ts`), and none of the standard night's rulings-demo overlay.
  const network = scenarioNetwork(scenario);
  const seed: WardFlowState = {
    worldGeneration: 0,
    dischargeRevisions: {},
    auditEvents: [],
    auditReviews: [],
    auditSequence: 0,
    auditReviewSequence: 0,
    auditCaptureStartedAt: NOW_ANCHOR,
    movements: withDemoPlannedMoveTimes(structuredClone(network?.movements ?? wardMovements), NOW_ANCHOR),
    units: scenarioUnits(scenario),
    rejections: [],
    clockOffsetMinutes: 0,
    referralSequence: 0,
    leaveBedSequence: 0,
    scenario,
    bedReleases: structuredClone(network?.bedReleases ?? bedReleases),
    leaveBeds: structuredClone(network?.leaveBeds ?? leaveBeds),
    refreshRequests: [],
    morningRollupConfirmations: {},
    referrals: structuredClone(network?.referrals ?? referrals),
    frontDoorReferralSequence: 0,
    patients: structuredClone(network?.patients ?? wardPatients),
    patientSequence: 0,
    admissions: structuredClone(network?.admissions ?? wardAdmissions),
    admissionSequence: 0,
    inboxAcknowledgements: {},
    inboxCompletions: {},
    notices: [],
    configuration: defaultWardConfiguration(),
    repatriations: [],
    handoverSignOffs: [],
    clinicalContacts: [],
    broadcastAlerts: [],
    broadcastSequence: 0,
  };
  return network ? seed : applyRulingsDemoOverlay(seed, NOW_ANCHOR);
}

/**
 * A FRESH SEED, ALREADY MOVED TO THE DEMONSTRATION'S CLOCK. The only door application code uses.
 *
 * ⚠️ **`shiftInstants` CARRIES NO ALREADY-SHIFTED MARKER, SO APPLYING IT TWICE DOUBLES EVERY
 * OFFSET.** Ward Board's framing is why that outranks its size: *a wrong clock looks wrong; a wrong
 * length of stay looks PLAUSIBLE.* A patient nine days in a bed reading as eighteen is not a
 * visibly broken screen — it is a believable number, on a screen whose purpose is to be believed,
 * with nothing anywhere to contradict it.
 *
 * ⚠️ **Stated honestly: no screen has ever shown that.** All three call sites passed a fresh
 * `seedWardFlowState()`, so nothing was ever double-shifted. This is a latent hazard being closed
 * because the cost of closing it is a function signature, not a live defect being repaired.
 *
 * The remedy is `TR-F3`-shaped — make the impossible state unrepresentable rather than check that
 * the reachable ones look right. **This function cannot be handed an already-shifted state because
 * it does not take a state at all**: it seeds and shifts in one step, so there is no argument a
 * caller could pass twice. `shiftInstants` stays exported for `ward-reanchor.test.ts`, which tests
 * the walker itself; `tests/ward-reanchor-single-application.test.ts` is the guard that application
 * code never reaches around this door to it.
 *
 * Offset zero returns a copy rather than the original, for the reason `shiftInstants` already
 * documents: the pinned and live paths then differ only in the offset, never in whether a copy was
 * taken, so no path exists that only a non-zero offset exercises.
 */
export function seedWardFlowStateAt(offsetMinutes: number, scenario: WardScenario = "standard"): WardFlowState {
  return shiftInstants(seedWardFlowState(scenario), offsetMinutes);
}

/** The id a rejection is filed against, for events that are not about one specific movement. */
function subjectId(event: WardFlowEvent): string {
  switch (event.type) {
    case "RECORD_PATIENT_DISCHARGE":
    case "RECORD_ADMISSION_CARE":
    case "RECORD_ADMISSION_FOLLOW_UP":
    case "OPEN_DISCHARGE_RECORD":
    case "REVIEW_AUDIT_EVENT":
    case "SET_CONFIGURATION":
      return "none";
    case "RAISE_REFERRAL":
      return event.edId;
    case "CONFIRM_CAPACITY":
    case "RECORD_WARD_INTAKE_CONSTRAINTS":
    case "FLAG_BED_RELEASE":
    case "RECORD_LEAVE_BED":
    case "REQUEST_CAPACITY_REFRESH":
    case "CONFIRM_MORNING_ROLLUP":
    case "SEND_WARD_BUZZ":
      return event.unitId;
    case "CONFIRM_BED_RELEASE":
    case "REVERT_BED_RELEASE":
    case "BLOCK_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "SET_BED_PREPARATION":
      return event.releaseId;
    case "RELEASE_BED":
      return event.releaseId;
    // Their own group, never folded into the unit- or release-scoped ones above: an admission id is
    // not a unit id and not a release id. These three are the only events in the model whose
    // subject is a person on a ward rather than a movement, a bed release or a referral — this
    // comment read "this event is the only one" until the two emergency-department events joined
    // `RECORD_LEAVING` here on 2026-09-01.
    case "RECORD_LEAVING":
    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT":
    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT":
    case "RECORD_REPATRIATION":
      return event.admissionId;
    case "END_LEAVE_BED":
      return event.leaveBedId;
    case "ACCEPT_REFERRAL":
    case "DECLINE_REFERRAL":
    case "RECORD_LOCAL_BED_SOUGHT":
    // Referral-scoped and carrying no `movementId`, for the same reason the two above are listed:
    // the `default` branch would read an absent property and stamp a rejection whose subject is
    // `undefined`, which renders as a rejection belonging to nothing rather than as an error.
    case "RECORD_REFERRER_WITHDRAWAL":
    // RB7 (build plan item 27, 2026-09-17): also referral-scoped, carrying `referralId` and no
    // `movementId` — the same reason `RECORD_REFERRER_WITHDRAWAL` directly above is listed rather
    // than left to the `default` branch.
    case "ADD_REFERRAL_CORRECTION":
      return event.referralId;
    case "ADVANCE_CLOCK":
    case "RESET_SCENARIO":
    case "SET_SCENARIO":
    // No referral yet exists to name a rejection against — the event that is rejected here is
    // the intake itself, exactly the same reasoning ADVANCE_CLOCK/RESET_SCENARIO/SET_SCENARIO
    // above already use.
    case "RECEIVE_REFERRAL":
    // A patient is not filed against a movement, and that is the point of the record rather than an
    // omission: they exist before any movement does.
    case "ADD_PATIENT":
      return "none";
    // Referral-scoped, not movement-scoped: a clearance is recorded against the referral the
    // inbox renders, and this event carries no `movementId` to return.
    case "RECORD_MEDICAL_CLEARANCE":
    // ⚠️ Listed here for a reason that is invisible until it breaks: this event carries NO
    // `movementId`, so the `default` below would read an absent property and stamp a rejection with
    // an `undefined` subject — which renders as a rejection belonging to nothing rather than as an
    // error. A referral-scoped event that forgets this line fails silently and only on the
    // unhappy path.
    case "RECORD_ARRIVED_IN_DEPARTMENT":
      return event.referralId;
    // Ward-lead task, 2026-09-06: these three carry no `movementId` at all — the subject is the
    // action-inbox row itself (`InboxItem.id`), which may or may not currently correspond to any
    // open movement (the underlying condition can have resolved between the row being seen and
    // the write landing).
    case "ACKNOWLEDGE_INBOX_ITEM":
    case "COMPLETE_INBOX_ITEM":
    case "REOPEN_INBOX_ITEM":
      return event.inboxItemId;
    // Item 48, Q2 (owner answer 48, 2026-09-17): notice-scoped, not movement-scoped — carries no
    // `movementId` to return, the same reason `ACKNOWLEDGE_INBOX_ITEM` and its two siblings just
    // above are listed rather than left to fall into `default`.
    case "MARK_NOTICE_READ":
      return event.noticeId;
    case "SET_STEP_DOWN_CANDIDATE":
    case "SET_DISCHARGE_BARRIER":
      return event.admissionId;
    case "EVALUATE_LEAVE_BED_WARNINGS":
    case "EVALUATE_ARRIVAL_LATENESS":
    case "RECORD_HANDOVER_SIGN_OFF":
      return "none";
    case "RECORD_CLINICAL_CONTACT":
      return event.teamId;
    case "DISPATCH_BROADCAST_ALERT":
      return "broadcast";
    case "ACKNOWLEDGE_BROADCAST_ALERT":
    case "STAND_DOWN_BROADCAST_ALERT":
      return event.alertId;
    default:
      return "movementId" in event ? (event.movementId as string) : "none";
  }
}

/**
 * Stable, non-random id: derived from the movement/subject, the event type and how many
 * rejections this state already carries — never a module-level counter, which would make two
 * calls with identical (state, event) produce different results and break the reducer's purity.
 */
function makeRejection(state: WardFlowState, event: WardFlowEvent, reason: string): Rejection {
  const subject = subjectId(event);
  return {
    id: `rejection-${subject}-${event.type}-${state.rejections.length}`,
    at: event.now,
    movementId: subject,
    attempted: event.type,
    reason,
  };
}

function reject(state: WardFlowState, event: WardFlowEvent, reason: string): WardFlowState {
  return { ...state, rejections: [...state.rejections, makeRejection(state, event, reason)] };
}

/**
 * ⚠️ **THE ELIGIBILITY GATE. Owner ruling, 2026-09-02, given in three parts:** *"the engine should
 * refuse, screen checks are not enough"*, then *"refuse unless a reason is recorded"*, then
 * *"The coordinator can over ride all rules"*.
 *
 * Returns the refusal message, or `null` to allow.
 *
 * ⚠️ **AN INELIGIBLE PLACEMENT IS MADE ACCOUNTABLE, NEVER IMPOSSIBLE — and the row below that looks
 * like a loophole IS THE RULING:**
 *
 *   ineligible + no reason       -> REFUSED, naming the failing gate
 *   ineligible + valid reason    -> PLACED, and the reason recorded
 *   eligible                     -> unchanged
 *   reason outside OVERRIDE_REASONS -> refused by MEMBERSHIP, never truthiness
 *
 * **Do not "tighten" the second row.** An override that is refused becomes a phone call, and the
 * placement then happens outside the system where nothing is recorded. **A rule that cannot be
 * overridden does not stop the placement; it stops the RECORD of the placement.** Anyone making one
 * gate un-overridable — the forensic gate is the obvious candidate — is REVERSING AN EXPLICIT OWNER
 * RULING, not tightening a loose end.
 *
 * ⚠️ **AND THE BOUNDARY, which is why this helper is only used for eligibility:** *"all rules"*
 * covers the ELIGIBILITY GATES. It does NOT cover the capacity refusals above it — allocatable beds,
 * a bed still being prepared, one-to-one specialling capacity. **A judgement rule is not a physical
 * fact: "this ward is the wrong cohort" is a clinical judgement and is overridable; "there is no
 * bed" is a fact about the world. NO REASON TYPED INTO A FORM CREATES A BED.** Widening this to a
 * capacity check would record a placement into a bed that does not exist — a false record, which is
 * the exact harm this ruling exists to prevent.
 */
/**
 * ⚠️ **THE GATES THIS REDUCER ENFORCES — a subset, and the subset is a JUDGEMENT that needs the
 * owner's confirmation. Ward Builder Three, 2026-09-02, flagged rather than assumed.**
 *
 * `eligibility()` returns twelve gates and they are not the same kind of thing:
 *
 *  - **SUITABILITY — does this bed suit this patient?** `cohort`, `security`, `sex_designation`,
 *    `sex_mix`, `forensic`, `legal_status`, `authorisation`, `age`. **These are clinical judgements,
 *    and these are what the owner's ruling is about.**
 *  - **THE WORLD — is there a bed at all?** `allocatable_bed`, `capacity_freshness`, `specialling`.
 *    ⚠️ **Already refused separately, above, and NOT overridable: no reason typed into a form creates
 *    a bed.** Enforcing them here would make a physical fact overridable and record a placement into
 *    a bed that does not exist.
 *  - ⚠️ **HISTORY — `prior_decline`. Neither of the above, and the reason this list exists.**
 *    A ward that declined ninety minutes ago *"because it had no bed"* is the commonest thing in bed
 *    management, and beds free up. Enforcing it would demand a recorded override every time a
 *    coordinator re-approaches a ward that once said no — **and none of the five `OVERRIDE_REASONS`
 *    fits, because they all name a MISMATCH and there is no mismatch.** Measured: enforcing it broke
 *    23 tests across 7 files, almost all of them re-referrals after a seeded decline.
 *
 * **So this reducer enforces SUITABILITY only.** The owner ruled that the engine should refuse an
 * unsuitable bed; he was not asked whether re-approaching a ward that declined should require a
 * recorded reason. ⚠️ **That is a live question for him and it is recorded as one.**
 */
/**
 * ⚠️ THE ONE SENTENCE FRAGMENT A SCREEN MAY MATCH ON TO KNOW A REFUSAL IS ANSWERABLE.
 *
 * A refusal that a recorded reason can get past reads differently from one that nothing can, and a
 * screen has to tell them apart to know whether offering a reason control would be honest. Doing
 * that by re-typing the wording here and there would be two copies of one fact — the second would
 * survive the first being reworded, and the control would then either vanish or appear where it
 * cannot help.
 *
 * So the engine exports the fragment it speaks. `ward-screen.tsx` matches on THIS, never on a
 * literal of its own. Reword the refusals and the control follows automatically.
 *
 * ⚠️ It deliberately names a STATE, not an action. The engine says one sentence to every caller and
 * only some callers can act on it; an instruction sent a ward nurse hunting for a control that
 * exists on the coordinator's panel. The exact clinical wording is the owner's to confirm.
 */
export const OVERRIDE_REASON_REQUIRED = "needs a recorded override reason";

/**
 * ⚠️ THE FRAGMENT UNIQUE TO ONE GATE, THE SAME DISCIPLINE AS `OVERRIDE_REASON_REQUIRED` ABOVE, ONE
 * LEVEL MORE SPECIFIC. `OVERRIDE_REASON_REQUIRED` tells a screen a refusal is answerable AT ALL; it
 * does not say which gate. `PULL_PATIENT`'s acuity block (item 10, owner answers 17 September 2026)
 * needs a SECOND fact beside the reason — "the nurse unit manager consulted" — and that tick must
 * show only beside THIS refusal, never beside the specialling refusal one guard above or an
 * eligibility refusal on `ACCEPT_IN_PRINCIPLE`. `ward-screen.tsx` matches on this exported fragment
 * for that reason, exactly as it matches on `OVERRIDE_REASON_REQUIRED` for the reason form itself —
 * never on a literal of its own that could drift from the reducer's actual wording.
 */
export const HIGH_ACUITY_STAFFING_REFUSAL = "has no high-acuity nursing capacity left";

/**
 * ⚠️ THE LIST OF GATES A RECORDED REASON MAY GET PAST. Two importers, both deliberate:
 *
 * 1. `tests/ward-referral-reducer.test.ts` asserts it is DISJOINT from the world-fact gates. That
 *    guard exists because the hazard it covers is silent — see the comment at `eligibilityRefusal`'s
 *    early return.
 * 2. `ward-derivations.ts`'s `shortlistCandidates`, so the coordinator's list can tell a ward that
 *    can be taken with a reason from one that cannot be taken at all.
 *
 * ⚠️ THE SECOND IMPORTER IS WHY THIS COMMENT CHANGED. It said "nothing else should import this",
 * which was true when the only thing that could act on the list was the engine. A screen that must
 * NOT offer a physical refusal as overridable needs the same list — and a second copy of it on the
 * screen is exactly how the two would drift into disagreeing about what a reason can buy.
 */
/**
 * 🔴 TYPED SO `"gender_designation"` CANNOT BE A MEMBER, T10 (item 8, owner answer 17 September
 * 2026): *"There is no override path on the gender gate."* Until this date the array held
 * `"sex_designation"`, which WAS overridable; the rename to `gender_designation`
 * (`ward-eligibility.ts`) is also a removal here, on purpose, not a rename in place — the entry is
 * dropped rather than relabelled.
 *
 * The exported type stays `readonly EligibilityGate[]` — narrowing it to
 * `Exclude<EligibilityGate, "gender_designation">[]` would break every `.includes(gate.gate)` call
 * site below and in `ward-derivations.ts`, which compare against the FULL gate union. The
 * `satisfies` clause below does the actual work: adding `"gender_designation"` back to the array
 * literal is a compile error there, which is the guarantee this comment promises, without
 * narrowing what callers may search the array for.
 */
export const SUITABILITY_GATES: readonly EligibilityGate[] = [
  "age",
  "authorisation",
  "cohort",
  "forensic",
  "legal_status",
  "security",
  "sex_mix",
  // ⚠️ ADDED BY OWNER RULING, 2026-09-02, and it is the only gate ever moved out of the world-fact
  // group. A stale bed count is information, not a wall: "I have confirmed the current bed state
  // with the ward directly" is a named person taking responsibility for a fact, which is what an
  // override reason IS. Before this it was refused at the front door with no way through and never
  // consulted at all on the placement path, which left the owner's own approved reason — "the bed
  // information is known to be out of date" — a dead option with nothing to answer.
  //
  // ⚠️ IT DOES NOT MEAN "THE WARD LOOKS FULL BUT IS NOT". The owner ruled the narrow reading
  // explicitly: this buys past a STALE COUNT, never past `allocatable_bed`. No reason typed into a
  // form creates a bed. See docs/ward-flow/owner-rulings-2026-09-02-staleness-and-legal-status.md.
  "capacity_freshness",
] as const satisfies readonly Exclude<EligibilityGate, "gender_designation">[];

/** Record only gates actually answered by this pull, against the same pre-pull resources. */
function pullOverrides(
  movement: Movement,
  unit: Unit,
  admissions: WardFlowState["admissions"],
  event: Extract<WardFlowEvent, { type: "PULL_PATIENT" }>,
  checkEligibility: boolean,
): Movement["overrides"] {
  if (event.overrideReason === undefined || !OVERRIDE_REASONS.includes(event.overrideReason)) return movement.overrides;
  const gates: NonNullable<Movement["overrides"][number]["gate"]>[] = [];
  if (movement.specialling && remainingSpeciallingCapacity(unit, admissions) <= 0) gates.push("specialling_staffing");
  if (movement.highAcuity && remainingHighAcuityCapacity(unit, admissions) <= 0) gates.push("high_acuity_staffing");
  if (checkEligibility) {
    if (movement.security === "Secure" && lockedBedsFree(unit) <= 0) gates.push("locked_bed_capacity");
    gates.push(
      ...eligibility(movement, unit, event.now)
        .gates.filter((gate) => !gate.pass && SUITABILITY_GATES.includes(gate.gate))
        .map((gate) => gate.gate),
    );
  }
  return [
    ...movement.overrides,
    ...gates.map((gate) => ({
      at: event.now,
      by: WARD_FLOW_ROLE_LABELS[event.role],
      reason: event.overrideReason!,
      unitIds: [unit.id],
      gate,
      ...(gate === "high_acuity_staffing" && event.numConsulted === true ? { numConsulted: true as const } : {}),
    })),
  ];
}

function eligibilityRefusal(
  event: OverridableWardFlowEvent,
  movement: Movement,
  unit: Unit,
  now: Instant,
): string | null {
  /*
   * 🔴 THE `gender_designation` CHECK RUNS FIRST, BEFORE THE OVERRIDE EARLY RETURN BELOW — T10
   * (item 8), and this ordering is the whole of the fix rather than a stylistic preference. The
   * `overrideReason !== undefined` branch a few lines down used to `return null` the moment a
   * reason was present, skipping the verdict entirely; that is exactly how a typed reason would
   * have bought past a gate the owner ruled has no override path at all. Computing the verdict
   * here, first, and refusing on `gender_designation` before any reason is even read, is what
   * makes "no override path" true regardless of what a caller supplies.
   */
  const verdict = eligibility(movement, unit, now);
  const genderFailure = verdict.gates.find((gate) => gate.gate === "gender_designation" && !gate.pass);
  if (genderFailure) {
    return (
      `${unit.name} is not eligible for movement ${movement.id} — failed gate gender_designation: ` +
      `${genderFailure.detail}. This is not something a recorded reason can override.`
    );
  }
  if (event.overrideReason !== undefined) {
    // Membership-checked, never truthiness-checked — the same discipline as `REFER_TO_UNITS`'s own
    // override validation. An unrecognised string must not buy its way past a clinical gate.
    if (!OVERRIDE_REASONS.includes(event.overrideReason)) {
      return `${event.type} overrideReason must be chosen from OVERRIDE_REASONS`;
    }
    // ⚠️ THIS RETURN SKIPS THE VERDICT ENTIRELY, AND WHAT MAKES THAT SAFE IS NOT IN THIS FUNCTION.
    //
    // An earlier version of this comment said the early return was safe because every gate this
    // function can refuse on is a judgement. THAT WAS WRONG, and wrong in the direction that
    // reassures: `eligibility()` emits FOUR gates outside `SUITABILITY_GATES` today —
    // `specialling`, `prior_decline`, `capacity_freshness`, `allocatable_bed` — so a recorded
    // reason does skip physical gates here, and has always done so.
    //
    // It is safe because `PULL_PATIENT` is the ONLY event that consumes a bed, and it enforces the
    // physical facts itself, before it ever calls this function:
    //
    //     if (unit.allocatable.value <= 0)                          -> reject
    //     if (movement.specialling && remainingSpeciallingCapacity(unit, …) <= 0) -> reject
    //     if (movement.highAcuity && remainingHighAcuityCapacity(unit, …) <= 0)   -> reject
    //     eligibilityRefusal(…)                                      <- runs AFTER all three
    //
    // Neither of those reads `overrideReason`. `REFER_TO_UNITS` and `ACCEPT_IN_PRINCIPLE` consume
    // no bed — an accept in principle is explicitly a promise made BEFORE one exists — so skipping
    // the physical gates there is correct rather than merely tolerated.
    //
    // ⚠️ SO THE THING TO PRESERVE IS THOSE TWO GUARDS AND THEIR ORDER, NOT THIS GATE LIST. The edit
    // that breaks it is a tidy-up: folding the bed and specialling checks into the eligibility
    // verdict, which already computes both. That refactor looks like a simplification, leaves
    // `SUITABILITY_GATES` untouched, and silently lets a typed reason create a bed.
    // `tests/ward-physical-facts-are-not-overridable.test.ts` is what goes red when it happens —
    // it asserts the refusals by their exact message, so it cannot pass on some other refusal.
    //
    // `referralAcceptanceRefusal` below needs none of this: it computes the verdict first and finds
    // unbypassable gates by ABSENCE from `SUITABILITY_GATES`, so it fails closed on its own.
    return null;
  }
  // `verdict` was already computed above, before the gender check — not recomputed here.
  const failed = verdict.gates.find((gate) => !gate.pass && SUITABILITY_GATES.includes(gate.gate));
  if (!failed) return null;
  return (
    `${unit.name} is not eligible for movement ${movement.id} — failed gate ${failed?.gate}: ` +
    `${candidateReason(verdict)}. This placement ${OVERRIDE_REASON_REQUIRED}.`
  );
}

/**
 * P1-3 (Ward Lead ruling, 17 September 2026): "a gender corrected after placement is never
 * re-checked". `RECORD_MOVEMENT_GENDER` can change `movement.gender` at any open stage, but until
 * this function existed nothing re-asked the two gender judgements — `gender_designation` (no
 * override path, `eligibilityRefusal` above) and the `Non-binary` placement-record check
 * (`GENDER_PLACEMENT_REFUSAL`) — against the unit a movement is ALREADY held or accepted at.
 * `PULL_PATIENT`, `HANDOVER_READY`, `TRANSPORT_ACCEPTED` and `PATIENT_COLLECTED` all call this
 * before advancing; `PATIENT_ARRIVED` deliberately never does — blocking an arrival strands a
 * patient already in transit, and the coordinator notice `RECORD_MOVEMENT_GENDER` raises for a held
 * movement (see that case below) is the safeguard from `moving` onward.
 *
 * Checks ONLY these two judgements, never the full `SUITABILITY_GATES` list `eligibilityRefusal`
 * covers — a movement's held unit already passed cohort/security/sex_mix/etc. once, and a gender
 * correction has no bearing on any of them; re-litigating the whole list here would let an
 * unrelated world-fact change (a bed count going stale, say) block a forward step this brief never
 * asked to re-gate.
 *
 * Returns `null` when the held unit still suits, or one of the two actionable refusals above —
 * never `eligibilityRefusal`'s own front-door wording, which is misleading here: nothing about
 * accepting THIS unit again fixes it (see `GENDER_NO_LONGER_SUITS_REFUSAL`'s own doc comment).
 */
function heldUnitGenderRefusal(state: WardFlowState, movement: Movement, now: Instant): string | null {
  if (!movement.acceptedUnitId) return null;
  const unit = findUnit(state, movement.acceptedUnitId);
  if (!unit) return null;
  const genderGate = eligibility(movement, unit, now).gates.find((gate) => gate.gate === "gender_designation");
  if (genderGate && !genderGate.pass) {
    return GENDER_NO_LONGER_SUITS_REFUSAL;
  }
  if (
    genderReviewNeeded(movement.gender, movement.sex) &&
    !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(movement.acceptedUnitId as string))
  ) {
    return GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL;
  }
  return null;
}

/**
 * The front door's half of the same ruling `eligibilityRefusal` implements for the placement path.
 *
 * ⚠️ IT EXISTS BECAUSE THE TWO PATHS HELD OPPOSITE POLICIES. Until now `ACCEPT_REFERRAL` rejected
 * on the FIRST failing gate of any kind, so a referral every ward failed on one judgement gate
 * could not be accepted by anybody, with any reason, ever — while the coordinator's placement path
 * checked no judgement gate at all. One end refused everything, the other end refused nothing.
 *
 * The rule both ends now hold: a judgement about the patient is overridable by a named human with
 * a recorded reason; a fact about the world is not. No reason typed into a form creates a bed.
 *
 * ⚠️ FAIL-CLOSED BY CONSTRUCTION, and this is the load-bearing line: a gate is overridable ONLY by
 * appearing in `SUITABILITY_GATES`. Everything else refuses outright, and tomorrow that is
 * automatically any gate someone adds to `referralEligibility` without thinking about this file.
 * The default for an unclassified gate is "no reason gets past this", never "anyone with a dropdown
 * can".
 *
 * 🔴 THIS SENTENCE USED TO NAME THE SET — "today that is `allocatable_bed`, `capacity_freshness`
 * and `specialling`" — AND IT WAS WRONG ON TWO OF THREE BY 2026-09-07. `capacity_freshness` was
 * moved INTO `SUITABILITY_GATES` by owner ruling on 2026-09-02, in an edit eighty lines above this
 * one that carries its own long comment; and `prior_decline` was never listed here at all. The
 * true set today is `allocatable_bed`, `prior_decline` and `specialling` — but it is stated here
 * only to say that it is DERIVED, never transcribed:
 *
 *     ELIGIBILITY_GATES (12, ward-eligibility.ts)  minus  SUITABILITY_GATES (9, above)
 *
 * ⚠️ A HAND-WRITTEN COPY OF A SET THAT LIVES IN TWO ARRAYS IS A THIRD SOURCE OF TRUTH, and this
 * one went stale in the same file, in the same week, as the edit that invalidated it. Compute it;
 * do not quote it. And do not restore a literal list here to be helpful — that is what this note
 * exists to prevent.
 */
function referralAcceptanceRefusal(
  event: OverridableWardFlowEvent,
  referral: Referral,
  destination: WardReferralDestination,
  unit: Unit,
  now: Instant,
): { refusal: string; overrideApplied?: undefined } | { refusal: null; overrideApplied: boolean } {
  const verdict = referralEligibility(referral, destination, unit, now);
  // ⚠️ `overrideApplied: false` on a CLEAN verdict even when the event carries a reason, so a
  // reason selected against a ward that turned out to be eligible is not filed as an override.
  // A record saying a clinical rule was bent, on an acceptance where none was, is a false entry in
  // the only place anyone would later go looking for the real ones.
  if (verdict.eligible) return { refusal: null, overrideApplied: false };
  const failed = verdict.gates.filter((gate) => !gate.pass);

  // Checked BEFORE the reason is even read, so no ordering accident can let one through.
  const unbypassable = failed.find((gate) => !SUITABILITY_GATES.includes(gate.gate));
  if (unbypassable) {
    return {
      refusal:
        `${unit.name} cannot accept referral ${referral.id} — failed gate ${unbypassable.gate}: ` +
        `${unbypassable.detail}. This is not something a recorded reason can override.`,
    };
  }

  // Everything still failing is a judgement gate, so a recorded reason is the way through — and
  // the refusal has to SAY so, or the reader is left believing the door is shut.
  if (event.overrideReason === undefined) {
    const judgement = failed[0];
    return {
      refusal:
        `${unit.name} does not accept referral ${referral.id} — failed gate ${judgement?.gate}: ` +
        `${judgement?.detail}. This acceptance ${OVERRIDE_REASON_REQUIRED}.`,
    };
  }
  if (!OVERRIDE_REASONS.includes(event.overrideReason)) {
    return { refusal: `${event.type} overrideReason must be chosen from OVERRIDE_REASONS` };
  }
  return { refusal: null, overrideApplied: true };
}

function findMovement(state: WardFlowState, movementId: string): Movement | undefined {
  return state.movements.find((candidate) => candidate.id === movementId);
}

function findUnit(state: WardFlowState, unitId: string): Unit | undefined {
  return state.units.find((candidate) => candidate.id === unitId);
}

function findBedRelease(state: WardFlowState, releaseId: string): BedRelease | undefined {
  return state.bedReleases.find((candidate) => candidate.id === releaseId);
}

/** Replaces one bed release in the array by id, leaving every other element untouched. */
function replaceBedRelease(state: WardFlowState, releaseId: string, next: BedRelease): WardFlowState {
  return {
    ...state,
    bedReleases: state.bedReleases.map((candidate) => (candidate.id === releaseId ? next : candidate)),
  };
}

function findAdmission(state: WardFlowState, admissionId: string): Admission | undefined {
  return state.admissions.find((candidate) => candidate.id === admissionId);
}

/** Replaces one admission in the array by id, leaving every other element untouched — the same
 *  discipline `replaceBedRelease` and `replaceUnit` already use. */
function replaceAdmission(state: WardFlowState, admissionId: string, next: Admission): WardFlowState {
  return {
    ...state,
    admissions: state.admissions.map((candidate) => (candidate.id === admissionId ? next : candidate)),
    dischargeRevisions: state.admissions.some(
      (candidate) => candidate.id === admissionId && candidate.state !== next.state,
    )
      ? { ...state.dischargeRevisions, [admissionId]: (state.dischargeRevisions[admissionId] ?? 0) + 1 }
      : state.dischargeRevisions,
  };
}

function findLeaveBed(state: WardFlowState, leaveBedId: string): LeaveBed | undefined {
  return state.leaveBeds.find((candidate) => candidate.id === leaveBedId);
}

function findReferral(state: WardFlowState, referralId: string): Referral | undefined {
  return state.referrals.find((candidate) => candidate.id === referralId);
}

/** Replaces one referral in the array by id, leaving every other element untouched — the same
 *  shape as `replaceBedRelease`/`replaceMovement` below. */
function replaceReferral(state: WardFlowState, referralId: string, next: Referral): WardFlowState {
  return {
    ...state,
    referrals: state.referrals.map((candidate) => (candidate.id === referralId ? next : candidate)),
  };
}

/** Replaces one movement in the array by id, leaving every other element untouched. */
function replaceMovement(state: WardFlowState, movementId: string, next: Movement): WardFlowState {
  return {
    ...state,
    movements: state.movements.map((candidate) => (candidate.id === movementId ? next : candidate)),
  };
}

function replaceUnit(state: WardFlowState, unitId: string, next: Unit): WardFlowState {
  return { ...state, units: state.units.map((candidate) => (candidate.id === unitId ? next : candidate)) };
}

/**
 * REFUNDS A HELD BED AND DELETES THE `Admission` `PULL_PATIENT` CREATED FOR IT (if one exists) — the
 * exact inverse of `PULL_PATIENT`'s own writes (ruling P4-1), extracted so `RELEASE_PULL` and, since
 * WLQ-38 (owner, 2026-09-15), a post-acceptance `WITHDRAW_REFERRAL` and `STOP_TRANSPORT` all reuse
 * ONE implementation rather than three copies drifting apart. See `RELEASE_PULL`'s own case, which
 * carried this logic alone until this extraction, for the full history of the phantom-occupant
 * defect this guards against.
 *
 * ⚠️ **THE REFUND IS GATED ON `movement.stage` OR `movement.admissionId` — NEVER ON EITHER ALONE.**
 * Gating on `admissionId` ALONE was this function's first draft, and a seeded fixture caught it
 * immediately: `admissionId` is `undefined` on every hand-authored seed movement at
 * `pulled`/`handover_ready`/`moving`, because those stages were AUTHORED rather than reached by
 * dispatching `PULL_PATIENT` — see that field's own doc comment. Gating the refund on `admissionId`
 * alone would silently skip it for every one of those, which is exactly the bed
 * `tests/ward-flow-reducer.test.ts`'s own `RELEASE_PULL` case caught going missing.
 *
 * 🔴 GATING ON `movement.stage` ALONE IS ALSO WRONG — closed by the 2026-09-16 fix round in this
 * function's body. `STEP_BACK_STAGE` from `pulled` to `accepted_awaiting_bed` keeps `admissionId` and
 * the reserved bed by design (rulings E/F — see that case's own comment), so a movement stepped back
 * to `accepted_awaiting_bed` still holds both while its stage no longer says `pulled` or later. A
 * caller reaching this helper from that stage with `stage` as the ONLY gate returned early and
 * cleared `admissionId` on the movement without ever refunding the bed here — a leaked bed and an
 * orphaned admission record, the exact PHANTOM OCCUPANT shape this helper exists to guard against.
 *
 * So the rule actually enforced is the OR the function body reads: `stage === "pulled"` or
 * `"handover_ready"` or `"moving"`, OR `admissionId !== undefined`. `RECORD_EXAMINATION`'s own inline
 * `holdsBed` check reads the identical OR for exactly this reason; this function matches it rather
 * than inventing a third rule.
 *
 * A no-op ONLY when NEITHER half of that OR holds — the movement's stage is `accepted_awaiting_bed`
 * or earlier AND `admissionId` is undefined, the ordinary case for a movement whose bed was never
 * pulled. `accepted_awaiting_bed` is therefore NOT unconditionally a no-op: a movement stepped back
 * to it from `pulled` still holds its bed and still gets refunded here. Every caller may still pass
 * this unconditionally rather than checking first — the no-op is a property of the movement passed
 * in, not something a caller must pre-filter for. Also a no-op when `movement.acceptedUnitId` or the
 * unit it names is missing, which the three reducer cases above each already guard against reaching
 * in the first place, but is repeated here defensively rather than assumed of every future caller.
 * The admission is deleted only when `movement.admissionId` actually names one.
 *
 * Callers remain responsible for clearing `movement.admissionId` on the MOVEMENT itself — this
 * function only touches `state.units`, `state.admissions` and `state.dischargeRevisions`, the same
 * split `RELEASE_PULL`'s own case already kept between its unit/admission writes and its movement
 * write.
 */
function releasePulledBedAndAdmission(state: WardFlowState, movement: Movement, now: Instant): WardFlowState {
  if (!movement.acceptedUnitId) return state;
  // Fix round (2026-09-16 audit): this used to decide a bed was held from `movement.stage` alone.
  // `STEP_BACK_STAGE` from `pulled` to `accepted_awaiting_bed` keeps `admissionId` and the reserved
  // bed by design (rulings E/F — see that case's own comment), so a movement stepped back to
  // `accepted_awaiting_bed` still holds both while its stage no longer says "pulled" or later. A
  // caller reaching this helper from that stage (e.g. `WITHDRAW_REFERRAL`, `REFER_TO_COMMUNITY_TEAM`)
  // returned early and cleared `admissionId` without ever refunding the bed — a leaked bed and an
  // orphaned admission record, the same PHANTOM OCCUPANT shape this helper's own stage-based fix
  // already closed for the pull-then-release-then-repull path. `RECORD_EXAMINATION`'s own inline
  // `holdsBed` check already reads `stage === "pulled" || admissionId !== undefined` for exactly
  // this reason; this helper now matches it.
  const bedCurrentlyHeld =
    movement.stage === "pulled" ||
    movement.stage === "handover_ready" ||
    movement.stage === "moving" ||
    movement.admissionId !== undefined;
  if (!bedCurrentlyHeld) return state;
  const unit = findUnit(state, movement.acceptedUnitId);
  if (!unit) return state;
  /*
   * Item 11, owner answer 11 (17 September 2026) — the bed kind `PULL_PATIENT` took is restored
   * here, never guessed. `admission.bedKind` is the ONLY record of which kind was taken (see
   * `PULL_PATIENT`'s own admission literal, and `Admission.bedKind`'s own doc comment); read BEFORE
   * the admission is filtered out below, so this is the sole point that can still see it.
   *
   * ⚠️ **RESIDUAL, STATED RATHER THAN GUESSED, NOT CLOSED BY THIS TASK.** Two shapes read `undefined`
   * here and both refund `allocatable` alone, exactly as this function did before this change:
   *   1. `movement.admissionId === undefined` — a hand-authored seed movement at
   *      `pulled`/`handover_ready`/`moving` (see this function's own doc comment above), which was
   *      never given a bed by dispatching `PULL_PATIENT` at all, so there is no admission to read a
   *      kind from.
   *   2. `movement.admissionId` resolves to a SEEDED admission — every admission in
   *      `ward-admissions-seed.ts` predates this field and carries no `bedKind`.
   * Neither case can say whether the bed released was one of the locked ones, so `allocatableLocked`
   * is left untouched for both — an honest "cannot restore what was never recorded", not a defect
   * this task's scope covers.
   */
  const heldAdmission =
    movement.admissionId === undefined
      ? undefined
      : state.admissions.find((candidate) => candidate.id === movement.admissionId);
  const releasedUnit: Unit = {
    ...unit,
    allocatable: { ...unit.allocatable, value: unit.allocatable.value + 1, confirmedAt: now },
    allocatableLocked: heldAdmission?.bedKind === "locked" ? unit.allocatableLocked + 1 : unit.allocatableLocked,
  };
  const withUnit = replaceUnit(state, unit.id, releasedUnit);
  if (movement.admissionId === undefined) return withUnit;
  return {
    ...withUnit,
    admissions: withUnit.admissions.filter((candidate) => candidate.id !== movement.admissionId),
    dischargeRevisions: Object.fromEntries(
      Object.entries(withUnit.dischargeRevisions).filter(([id]) => id !== movement.admissionId),
    ),
  };
}

function nextReferralId(sequence: number): MovementId {
  // "WF-9NN" — the 9 prefix keeps runtime-raised referrals visibly distinct from the
  // hand-authored and generated WF-0xx/WF-1xx..WF-4xx fixture ids.
  return `WF-9${String(sequence).padStart(2, "0")}`;
}

/**
 * Fix round 2 (P2). Mirrors `nextReferralId` above, but from `leaveBedSequence` rather than
 * `state.leaveBeds.length` — see that field's own doc comment on `WardFlowState` for why the
 * length-based id `RECORD_LEAVE_BED` used to derive collides once `END_LEAVE_BED` has removed an
 * earlier entry.
 */
function nextLeaveBedId(sequence: number): string {
  // "WL-9NN" mirrors FLAG_BED_RELEASE's own "WR-9NN" — visibly distinct from the hand-authored
  // "WL-00N" fixture ids.
  return `WL-9${String(sequence).padStart(2, "0")}`;
}

/**
 * Mirrors `nextReferralId`/`nextLeaveBedId` above — derived from `frontDoorReferralSequence`,
 * never from `state.referrals.length` (see that field's own doc comment on `WardFlowState`).
 * "RF-9NN" mirrors the fixture's own "RF-00N" ids (`ward-movements.ts`) and the "9" prefix every
 * other runtime-created id in this reducer uses, visibly distinct from the hand-authored fixture.
 */
function nextFrontDoorReferralId(sequence: number): string {
  return `RF-9${String(sequence).padStart(2, "0")}`;
}

// ── Communication addendum (docs/ward-flow/plans/2026-09-1x-communication-addendum.md) ──────────

/**
 * Mirrors `subjectId` above, but reads an already-built `Notice.about` rather than an event: a
 * movement's id first, then a referral's, then a unit's, then a patient's, and `"none"` only when a
 * notice names none of the four — which nothing raised below ever does. Kept separate from
 * `subjectId` rather than folded into it, because that function reads an EVENT and this one reads a
 * DECISION already made about a notice; merging them would make a future event-shaped change to one
 * silently reach the other.
 */
function noticeSubject(about: Notice["about"]): string {
  return about.movementId ?? about.referralId ?? about.unitId ?? about.patientId ?? "none";
}

/**
 * A unit's display name for a notice's `sentence`, falling back to its bare id rather than a
 * neighbour or an invented label — the same conservative-failure shape `ward-place.ts`'s own doc
 * comment states for exactly this reason: a notice naming the WRONG ward is worse than one naming an
 * id a reader can still search for.
 */
function unitName(state: WardFlowState, unitId: string): string {
  return findUnit(state, unitId)?.name ?? unitId;
}

/**
 * STABLE, NON-RANDOM, DERIVED FROM `(subject, kind, count)` — the same discipline `makeRejection`
 * above holds `Rejection.id` to, and for the same reason: a module-level counter would make two
 * calls with an identical `(state, event)` mint two different notice ids, breaking the reducer's
 * purity (communication addendum §1.1's own id rule; `Notice`'s own doc comment on `ward-model.ts`).
 *
 * `count` is `state.notices.length` **before** any notice raised by the current event is appended —
 * read once by the caller and passed in, rather than read from a state this function does not
 * receive. A decision that raises two notices (`ACCEPT_REFERRAL`, `CANCEL_TRANSPORT`) gives each
 * addressee its OWN `NoticeKind` for exactly this reason: two notices built from the same `count`
 * and the same `(subject, kind)` pair would collide and silently drop one.
 */
function makeNotice(
  now: Instant,
  count: number,
  kind: NoticeKind,
  to: Addressee,
  about: Notice["about"],
  sentence: string,
): Notice {
  return {
    id: `notice-${noticeSubject(about)}-${kind}-${count}`,
    raisedAt: now,
    to,
    about,
    kind,
    sentence,
    readAt: undefined,
  };
}

/**
 * THE ONE GATE EVERY NOTICE PASSES THROUGH BEFORE IT REACHES `state.notices` — and where `demo` is
 * refused, per the addendum's §1.2: *"`demo` is a role in that union and must never receive a
 * notice… refuse it in the reducer, not in a screen."* `WardFlowRole` is exhaustive and
 * `Addressee.role` is typed to it, so nothing stops a future call site constructing one that names
 * `demo`; this is the one place that mistake is refused structurally rather than trusted to never
 * happen at every call site separately.
 *
 * Silently drops a `demo`-addressed notice rather than rejecting the whole event: the underlying
 * decision (a bed pull released, a referral declined, a transport cancelled) is real and already
 * recorded on the movement or referral itself — only the notice, a courtesy on top of a decision
 * that already happened, is refused. Never touches `state.rejections`: `demo` is a perfectly fine
 * actor for other events, and reaching this function is not a validity failure of the dispatch.
 *
 * Fix round 1 (review finding, Important 1): exported so `tests/ward-notices.test.ts` can hand this
 * gate a `demo`-addressed `Notice` directly and prove the drop branch is actually taken. No call
 * site can construct one through the public `wardFlowReducer` API — every literal `to.role` built
 * by the six cases above is `"ed"`/`"ward"`/`"officer"`, and `EVENT_ROLE` excludes `demo` as the
 * ACTING role for all six — so this is the only way to exercise the addressee-side filter rather
 * than the (already-covered, different) acting-role gate.
 */
export function appendNotices(state: WardFlowState, notices: readonly Notice[]): WardFlowState {
  const notifiable = notices.filter((notice) => notice.to.role !== "demo");
  if (notifiable.length === 0) return state;
  return { ...state, notices: [...state.notices, ...notifiable] };
}

/**
 * WHO REFERRED THIS FRONT-DOOR REQUEST INTO THE NETWORK, RESOLVED TO A ROLE AT A PLACE — or
 * `undefined`, which is the ordinary answer for five of `REFERRAL_SOURCES`' six members.
 *
 * `Referral.source` names the CHANNEL a request came through (`ward-model.ts`, that field's own doc
 * comment) and carries no further identity; `Referral.originSiteCode` names the HOSPITAL it came
 * from, never a department. Only `ed_medical` resolves to both a role this application has (`ed`)
 * and a specific, safely-scoped place: `case "RECEIVE_REFERRAL"` above already REFUSES an
 * `ed_medical` referral whose origin site holds no emergency department, so every `ed_medical`
 * referral this function ever sees is guaranteed to resolve.
 *
 * ⚠️ **THE OTHER FIVE SOURCES ARE LEFT UNRESOLVED ON PURPOSE, NOT AN OVERSIGHT.**
 * `community`/`crisis_service`/`police`/`ambulance`/`inter_hospital` each name a channel this
 * application has no seat for, or — `community` — a channel with no SPECIFIC team recorded on the
 * referral's own origin (only a DESTINATION arm carries a `teamName`, and that names where THIS
 * referral is going, never where it came from). Guessing a `placeId` here would either address a
 * decline's reason to a community team that never sent this referral, or address it to nobody who
 * could actually read it — and `FD-23` (communication addendum §1.3) asks for a decline to reach the
 * referrer's OWN team and no other. A wrong or invented placeId is exactly the leak that rule exists
 * to prevent, so this degrades to no notice at all rather than guess — the same conservative-failure
 * discipline `ward-place.ts` states for an id it cannot resolve: absent is safer than wrong.
 */
function referralReferrer(referral: Referral): Addressee | undefined {
  if (referral.source !== "ed_medical") return undefined;
  const edId = siteByCode(referral.originSiteCode)?.emergencyDepartment?.id;
  return edId === undefined ? undefined : { role: "ed", placeId: edId };
}

/** The established departure arithmetic, shared by the legacy and patient-linked commands. */
function departAdmission(
  state: WardFlowState,
  admission: Admission,
  unit: Unit,
  now: Instant,
  leavingDestination: LeavingDestination,
): WardFlowState {
  // Owner decision 2026-09-25: a bed release is a named patient's discharge, so the pairing is by
  // name, never by ward-wide counts. `releaseAlreadyIncremented` is true only for a state in which a
  // release for THIS admission was completed before they left. The reducer can no longer produce that
  // (RELEASE_BED refuses while the person is still in the bed) and storage validation refuses it. If
  // it is ever met, NOT raising the figures again is the conservative answer: it can under-state free
  // beds, and never over-state them.
  const liveRelease = state.bedReleases.find((r) => r.admissionId === admission.id && r.state !== "discharged");
  const releaseAlreadyIncremented = state.bedReleases.some(
    (r) => r.admissionId === admission.id && r.state === "discharged",
  );

  // Item 11 / WFA-003: `PULL_PATIENT` decrements `allocatableLocked` when the bed taken was locked;
  // departure must restore it. `RELEASE_BED` never touches that field, so the restore runs on both
  // branches — including when empty/allocatable were already raised by a prior release.
  const restoreLocked = admission.bedKind === "locked" ? 1 : 0;
  // Owner ruling 2026-09-25: occupant counts follow gender (recorded sex for a non-binary person).
  // An admission carries only `sex`, so the gender comes from the movement that admitted it.
  const admittingMovement = state.movements.find((m) => m.admissionId === admission.id);
  const leaverSex = mixSexOf(admission.gender ?? admittingMovement?.gender, admission.sex);
  const updatedUnit: Unit = releaseAlreadyIncremented
    ? {
        ...unit,
        empty: { ...unit.empty, confirmedAt: now },
        allocatable: { ...unit.allocatable, confirmedAt: now },
        allocatableLocked: unit.allocatableLocked + restoreLocked,
        sexMix: adjustSexMix(unit.sexMix, leaverSex, -1),
      }
    : {
        ...unit,
        empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1), confirmedAt: now },
        allocatable: { ...unit.allocatable, value: Math.min(unit.beds, unit.allocatable.value + 1), confirmedAt: now },
        allocatableLocked: unit.allocatableLocked + restoreLocked,
        sexMix: adjustSexMix(unit.sexMix, leaverSex, -1),
      };
  const departed: Admission = { ...admission, state: "departed", leftAt: now, leavingDestination };
  const departedState = replaceAdmission(replaceUnit(state, unit.id, updatedUnit), admission.id, departed);
  // Owner ruling 2026-09-25: a leave bed belongs to one stay. Leaving ends it in the same write, so
  // "on leave" never counts a bed whose occupant has gone. No bed figure moves here: the figures
  // above already moved once, for the leaving itself.
  const withPerson: WardFlowState = departedState.leaveBeds.some((bed) => bed.admissionId === admission.id)
    ? { ...departedState, leaveBeds: departedState.leaveBeds.filter((bed) => bed.admissionId !== admission.id) }
    : departedState;
  if (!liveRelease) return withPerson;
  // Leaving completes this person's release — the same fields RELEASE_BED used to write. A stuck flag
  // comes off, because the bed is no longer held up.
  return replaceBedRelease(withPerson, liveRelease.id, {
    ...liveRelease,
    state: "discharged",
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    confirmedAt: now,
  });
}

type ProtectedRecordEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "OPEN_DISCHARGE_RECORD"
      | "REVIEW_AUDIT_EVENT"
      | "RECORD_PATIENT_DISCHARGE"
      | "RECORD_ADMISSION_FOLLOW_UP"
      | "RECORD_ADMISSION_CARE";
  }
>;

function protectedRefusal(
  state: WardFlowState,
  event: ProtectedRecordEvent,
  decision: AuditDecision,
  rejectionReason = "Request could not be completed",
): WardFlowState {
  const rejected =
    finiteInstant(event.now) === null
      ? state
      : {
          ...state,
          rejections: [
            ...state.rejections,
            {
              id: `record-rejection-${state.auditSequence + 1}`,
              at: event.now,
              movementId: "none",
              attempted: event.type,
              reason: rejectionReason,
            },
          ],
        };
  return appendAudit(state, rejected, event, decision);
}

/**
 * Whether a PATIENT RECORD's free-text legal status is involuntary, for the two discharge guards
 * below. `Patient.legalStatus` is free text: the seed writes "Involuntary patient (recorded)" (and
 * "… — Form 1A/3A") while these guards compared only against the movement vocabulary
 * ("Involuntary inpatient"), so thirteen seeded involuntary patients could be discharged to the
 * community with no refusal (live walkthrough code-read, 25 Sept 2026; Josh: fix the mismatch).
 * Deliberately wide: any status that starts with "Involuntary", plus "Detained awaiting
 * examination". Refusing a discharge that needs a revocation first is the conservative failure.
 */
function patientRecordIsInvoluntary(legalStatus: string | undefined): boolean {
  if (legalStatus === undefined) return false;
  return /^involuntary\b/i.test(legalStatus.trim()) || legalStatus === "Detained awaiting examination";
}

/** A previous stay must never decide this admission's discharge or transport state. */
function dischargeMovement(state: WardFlowState, admission: Admission): Movement | undefined {
  return (
    state.movements.find((movement) => movement.admissionId === admission.id) ??
    state.movements.find(
      (movement) =>
        admission.patientId !== null &&
        movement.patientId === admission.patientId &&
        movement.admissionId === undefined &&
        movement.closure === undefined,
    )
  );
}

function reduceRecordEvent(state: WardFlowState, event: ProtectedRecordEvent): WardFlowState {
  const deny = (
    reasonCode: AuditDecision["reasonCode"],
    outcome: AuditDecision["outcome"] = "denied",
    rejectionReason?: string,
  ) => protectedRefusal(state, event, { outcome, reasonCode }, rejectionReason);
  // Role is inspected before any protected payload or legacy rejection helper.
  if (!EVENT_ROLE[event.type].includes(event.role)) return deny("role");
  if (finiteInstant(event.now) === null || !safeCounter(event.expectedGeneration)) return deny("invalid-payload");
  if (event.expectedGeneration !== state.worldGeneration) return deny("generation", "stale");

  if (event.type === "REVIEW_AUDIT_EVENT") {
    if (!safeCounter(event.expectedReviewCount) || !reviewDecision(event.decision)) return deny("invalid-payload");
    const entry = uniqueRecord(state.auditEvents, event.eventId);
    if (!entry || entry.generation !== state.worldGeneration || entry.category === "review")
      return deny("missing-or-inaccessible");
    const count = state.auditReviews.filter(
      (review) => review.eventId === entry.id && review.generation === state.worldGeneration,
    ).length;
    if (count !== event.expectedReviewCount) return deny("revision", "stale");
    if (!safeCounter(state.auditReviewSequence) || state.auditReviewSequence >= Number.MAX_SAFE_INTEGER)
      return deny("invalid-payload");
    const sequence = state.auditReviewSequence + 1;
    return appendAudit(
      state,
      {
        ...state,
        auditReviewSequence: sequence,
        auditReviews: [
          ...state.auditReviews,
          {
            id: `audit-review-${sequence}`,
            eventId: entry.id,
            generation: state.worldGeneration,
            at: event.now,
            byRole: "coordinator",
            decision: event.decision,
          },
        ],
      },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }

  const actor = (
    "actingUnitId" in event
      ? { role: event.role, actingUnitId: event.actingUnitId }
      : "actingTeamId" in event
        ? { role: event.role, actingTeamId: event.actingTeamId }
        : { role: event.role }
  ) as WardRecordActor;
  if (!validRecordActor(actor)) return deny("scope");
  if (event.type === "OPEN_DISCHARGE_RECORD") {
    if (!safeCounter(event.requestId)) return deny("invalid-payload");
    const previous = state.auditEvents.find(
      (entry) =>
        entry.category === "record-access" &&
        entry.generation === state.worldGeneration &&
        entry.details.requestId === event.requestId,
    );
    if (previous) {
      const read = readOpenedDischargeRecord(state, actor, event.admissionId, {
        generation: event.expectedGeneration,
        requestId: event.requestId,
      });
      return read.status === "allowed" ? state : deny("missing-or-inaccessible");
    }
    if (selectDischargeRecord(state, actor, event.admissionId).status === "denied")
      return deny("missing-or-inaccessible");
    return appendAudit(state, state, event, { outcome: "accepted", reasonCode: "none" });
  }

  if (!safeCounter(event.expectedRevision)) return deny("invalid-payload");
  const admission = uniqueRecord(state.admissions, event.admissionId);
  const unit = uniqueRecord(
    state.units,
    (event.type === "RECORD_ADMISSION_FOLLOW_UP" || event.type === "RECORD_ADMISSION_CARE") &&
      (event.role === "coordinator" || event.role === "community")
      ? admission?.unitId
      : event.actingUnitId,
  );
  if (!unit || !admission || !uniqueRecord(state.units, admission.unitId)) return deny("missing-or-inaccessible");
  if (admission.unitId !== unit.id) return deny("scope");
  const identity = dischargeIdentity(state, admission);
  if (identity.kind !== "linked" || identity.patient.id !== event.patientId) return deny("identity-link");
  const revision = state.dischargeRevisions[admission.id] ?? 0;
  if (!safeCounter(revision) || revision >= Number.MAX_SAFE_INTEGER) return deny("invalid-payload");
  if (revision !== event.expectedRevision) return deny("revision", "stale");
  if (event.type === "RECORD_ADMISSION_CARE") {
    if (selectDischargeRecord(state, actor, admission.id).status === "denied") return deny("scope");
    if (!validCareChange(event.change)) return deny("invalid-payload");
    if (event.role === "community" && !["follow_up", "contact", "plan", "document"].includes(event.change.kind))
      return deny("role");
    if (
      (admission.state !== "occupied" && admission.state !== "departed") ||
      (admission.arrivedAt !== null && event.now < admission.arrivedAt)
    )
      return deny("transition");
    if (
      event.role === "community" &&
      ((event.change.kind === "follow_up" && event.change.serviceId !== event.actingTeamId) ||
        (event.change.kind === "contact" &&
          admission.careJourney?.followUp &&
          admission.careJourney.followUp.serviceId !== event.actingTeamId))
    )
      return deny("scope");
    const refusal = careChangeRefusal(admission, event.change, event.now);
    if (refusal) return deny("transition", "denied", refusal);
    if (event.change.kind === "transfer" && !uniqueRecord(state.units, event.change.receivingUnitId))
      return deny("missing-or-inaccessible");
    if (
      event.change.kind === "transport" &&
      event.change.authority === "none" &&
      ["ambulance", "service_vehicle", "police", "rfds"].includes(event.change.mode)
    ) {
      const movement = dischargeMovement(state, admission);
      const patient = uniqueRecord(state.patients, admission.patientId);
      if (patientRecordIsInvoluntary(patient?.legalStatus) || (movement && movement.legalStatus !== "Voluntary"))
        return deny("transition", "denied", "Record the checked transport authority for this involuntary arrangement.");
    }
    if (event.change.kind === "legal" && event.change.authority === "5B") {
      const previous = admission.careJourney?.legal?.authority ?? dischargeMovement(state, admission)?.legalForm?.code;
      if (previous !== "5A" && previous !== "5B")
        return deny(
          "transition",
          "denied",
          "A Form 5B continuation needs a recorded Form 5A or earlier Form 5B for this stay.",
        );
    }
    const careJourney = applyCareChange(
      admission.careJourney ?? emptyCareJourney(),
      event.change,
      event.now,
      WARD_FLOW_ROLE_LABELS[event.role],
    );
    let next = replaceAdmission(state, admission.id, {
      ...admission,
      careJourney,
      ...(event.change.kind === "follow_up"
        ? {
            followUp: {
              state: "arranged" as const,
              recordedAt: event.now,
              recordedBy: WARD_FLOW_ROLE_LABELS[event.role],
            },
          }
        : {}),
    });
    if (event.change.kind === "transfer" && event.change.step === "arrived") {
      if (event.role !== "coordinator" || admission.state !== "occupied") return deny("role");
      const receiving = uniqueRecord(state.units, event.change.receivingUnitId);
      const movement = dischargeMovement(state, admission);
      if (
        !receiving ||
        !safeCounter(receiving.empty.value) ||
        receiving.empty.value <= 0 ||
        !movement ||
        !eligibility(movement, receiving, event.now).eligible
      )
        return deny(
          "transition",
          "denied",
          "The receiving ward must have a suitable available bed and a linked placement record.",
        );
      if (
        state.admissions.some(
          (a) =>
            a.id !== admission.id &&
            a.patientId === admission.patientId &&
            (a.state === "occupied" || a.state === "pulled"),
        )
      )
        return deny("transition", "denied", "The patient already has another occupied or held bed.");
      if (
        (admission.specialling && remainingSpeciallingCapacity(receiving, state.admissions) <= 0) ||
        (admission.highAcuity && remainingHighAcuityCapacity(receiving, state.admissions) <= 0)
      )
        return deny("transition", "denied", "The receiving ward must have the required staffing capacity.");
      const bedKind =
        movement.legalStatus === "Voluntary" && openBedsFree(receiving) > 0 ? ("open" as const) : ("locked" as const);
      if (bedKind === "locked" && lockedBedsFree(receiving) <= 0) return deny("transition");
      const id = `transfer-${admission.id}-${revision + 1}`;
      const movementId: MovementId = `WF-${id}`;
      if (state.admissions.some((a) => a.id === id) || state.movements.some((m) => m.id === movementId))
        return deny("invalid-payload");
      next = departAdmission(
        next,
        { ...admission, careJourney },
        unit,
        event.now,
        "transferred-to-another-psychiatric-ward",
      );
      next = replaceUnit(next, receiving.id, {
        ...receiving,
        empty: { ...receiving.empty, value: receiving.empty.value - 1, confirmedAt: event.now },
        allocatable: { ...receiving.allocatable, value: receiving.allocatable.value - 1, confirmedAt: event.now },
        allocatableLocked: receiving.allocatableLocked - (bedKind === "locked" ? 1 : 0),
        sexMix: adjustSexMix(receiving.sexMix, mixSexOf(admission.gender, admission.sex), 1),
      });
      next = {
        ...next,
        admissions: [
          ...next.admissions,
          {
            ...admission,
            id,
            unitId: receiving.id,
            movementId,
            state: "occupied",
            bedKind,
            pulledAt: event.now,
            arrivedAt: event.now,
            leftAt: null,
            leavingDestination: null,
            expectedDischargeAt: null,
            dischargeConfirmedAt: null,
            dischargeDateSetAt: null,
            dischargeDateSetBy: null,
            dischargeConfirmedBy: null,
            dischargeDateMoves: 0,
            blockReason: null,
            awayAtEmergencyDepartmentSince: null,
            careJourney: { ...emptyCareJourney(), followUp: careJourney.followUp },
          },
        ],
        movements: [
          ...next.movements,
          {
            ...movement,
            id: movementId,
            admissionId: id,
            acceptedUnitId: receiving.id,
            stage: "arrived",
            openedAt: event.now,
            referredAt: undefined,
            acceptedAt: undefined,
            referredUnitIds: [receiving.id],
            arrivalDetails: undefined,
            arrivalLateNotifiedAt: undefined,
            expectFlag: undefined,
            stageChanges: [{ at: event.now, to: "arrived", by: event.role, reason: "Recorded ward transfer arrival" }],
            transport: undefined,
            closure: { at: event.now, outcome: "arrived", reason: "Recorded ward transfer arrival" },
          },
        ],
        dischargeRevisions: { ...next.dischargeRevisions, [id]: 0 },
      };
    }
    return appendAudit(
      state,
      { ...next, dischargeRevisions: { ...next.dischargeRevisions, [admission.id]: revision + 1 } },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }
  if (event.type === "RECORD_ADMISSION_FOLLOW_UP") {
    if (typeof event.followUpState !== "string" || !isFollowUpState(event.followUpState))
      return deny("invalid-payload");
    if (
      (admission.state !== "occupied" && admission.state !== "departed") ||
      admission.leavingDestination === "died-on-the-ward"
    )
      return deny("transition");
    if (admission.arrivedAt !== null && event.now < admission.arrivedAt) return deny("invalid-payload");
    const next = replaceAdmission(state, admission.id, {
      ...admission,
      followUp: { state: event.followUpState, recordedAt: event.now, recordedBy: WARD_FLOW_ROLE_LABELS[event.role] },
    });
    return appendAudit(
      state,
      {
        ...next,
        dischargeRevisions: { ...next.dischargeRevisions, [admission.id]: revision + 1 },
      },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }
  if (!isLeavingDestination(event.leavingDestination)) return deny("invalid-payload");
  if (admission.state !== "occupied") return deny("transition");
  if (admission.arrivedAt !== null && event.now < admission.arrivedAt) return deny("invalid-payload");

  // Involuntary patient discharge boundary (WA Mental Health Act 2014)
  const fullPatient = uniqueRecord(state.patients, identity.patient.id);
  const linkedMovement = dischargeMovement(state, admission);
  if (
    patientRecordIsInvoluntary(fullPatient?.legalStatus) ||
    (linkedMovement?.legalStatus !== undefined && linkedMovement.legalStatus !== "Voluntary")
  ) {
    if (
      event.leavingDestination === "discharged-to-the-community" ||
      event.leavingDestination === "left-against-advice"
    ) {
      if (!recordedCommunityTransition(admission, linkedMovement?.statusChanges.at(-1)?.at, event.leavingDestination)) {
        return deny(
          "transition",
          "denied",
          "Cannot discharge an involuntary patient without an explicit revocation order or recorded community treatment order transition.",
        );
      }
    }
  }

  // Discharge blocked while in transit
  if (
    linkedMovement &&
    (linkedMovement.stage === "moving" ||
      (linkedMovement.transport?.collectedAt !== undefined &&
        linkedMovement.transport.arrivedAt === undefined &&
        linkedMovement.transport.cancelledAt === undefined))
  ) {
    return deny("transition", "denied", "Patient is currently in transit to another facility.");
  }
  return appendAudit(state, departAdmission(state, admission, unit, event.now, event.leavingDestination), event, {
    outcome: "accepted",
    reasonCode: "none",
  });
}

/** Any ward-resource update invalidates a capacity draft, including protected departures. */
function advanceResourceRevisions(before: WardFlowState, after: WardFlowState): WardFlowState {
  if (after.units === before.units) return after;
  return {
    ...after,
    units: after.units.map((unit) => {
      const previous = before.units.find((candidate) => candidate.id === unit.id);
      if (!previous || previous === unit || (unit.allocatable.revision ?? 0) !== (previous.allocatable.revision ?? 0))
        return unit;
      return { ...unit, allocatable: { ...unit.allocatable, revision: (previous.allocatable.revision ?? 0) + 1 } };
    }),
  };
}

/** Capture is one reducer-boundary append; clinical branches supply their actual verdict. */
export function wardFlowReducer(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const protectedEvent =
    event.type === "OPEN_DISCHARGE_RECORD" ||
    event.type === "REVIEW_AUDIT_EVENT" ||
    event.type === "RECORD_PATIENT_DISCHARGE" ||
    event.type === "RECORD_ADMISSION_FOLLOW_UP" ||
    event.type === "RECORD_ADMISSION_CARE";
  if (
    classifyAuditEvent(event) &&
    (!safeCounter(state.auditSequence) || state.auditSequence >= Number.MAX_SAFE_INTEGER)
  )
    return state;
  if (protectedEvent) return advanceResourceRevisions(state, reduceRecordEvent(state, event));
  if (
    (event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO") &&
    (!safeCounter(state.worldGeneration) || state.worldGeneration >= Number.MAX_SAFE_INTEGER)
  )
    return state;
  // Refuse counter exhaustion before either legacy projection writer changes clinical state.
  const admissionId =
    event.type === "RECORD_LEAVING"
      ? event.admissionId
      : event.type === "PATIENT_ARRIVED"
        ? state.movements.find((movement) => movement.id === event.movementId)?.admissionId
        : undefined;
  if (admissionId !== undefined && EVENT_ROLE[event.type].includes(event.role)) {
    const revision = state.dischargeRevisions[admissionId] ?? 0;
    if (!safeCounter(revision) || revision >= Number.MAX_SAFE_INTEGER) return state;
  }
  const decision: AuditDecision = { outcome: "denied", reasonCode: "transition" };
  let next = reduceClinicalEvent(state, event, decision);
  if (event.type !== "RESET_SCENARIO" && event.type !== "SET_SCENARIO") {
    next = advanceResourceRevisions(state, next);
  }
  // 🔴 `next.movements !== state.movements` ADDED here (Y4 privacy fix round 2, P3 finding 6): a
  // genuine reseed (`seedWardFlowStateAt`) always produces a FRESH `movements` array, while every
  // `reject()` path — including `case "SET_SCENARIO"`'s own new scenario-membership check just
  // below — spreads `state` unchanged (`{...state, rejections: [...]}`), so `movements` keeps its
  // ORIGINAL reference. Before this, the condition checked ROLE alone: while role was the only gate
  // either case ever had, that was equivalent to "accepted", but `SET_SCENARIO` gaining its own
  // internal refusal (an invalid `scenario`) broke the equivalence — a role-valid, scenario-invalid
  // dispatch would have incremented `worldGeneration` on top of a REJECTED (not reseeded) state,
  // which would in turn have told `trackWardFlowTypedTextDispatch` (`ward-flow-provider.tsx`) a
  // genuine reseed happened when nothing was reseeded, wrongly clearing a live typed-text lock.
  if (
    (event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO") &&
    EVENT_ROLE[event.type].includes(event.role) &&
    next.movements !== state.movements
  )
    return { ...next, worldGeneration: state.worldGeneration + 1 };
  return appendAudit(state, next, event, decision);
}

function reduceClinicalEvent(state: WardFlowState, event: WardFlowEvent, decision: AuditDecision): WardFlowState {
  // 1. Role check first, before the event's payload is inspected at all.
  const permittedRoles = EVENT_ROLE[event.type];
  if (!permittedRoles.includes(event.role)) {
    decision.reasonCode = "role";
    return reject(
      state,
      event,
      `${event.type} requires role ${permittedRoles.join(" or ")}, but was raised by role ${event.role}`,
    );
  }

  switch (event.type) {
    case "RECORD_PATIENT_DISCHARGE":
    case "RECORD_ADMISSION_CARE":
    case "RECORD_ADMISSION_FOLLOW_UP":
    case "OPEN_DISCHARGE_RECORD":
    case "REVIEW_AUDIT_EVENT":
      return state;

    case "UPDATE_EXPECTED_DISCHARGE": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) {
        return reject(state, event, `no admission found for id ${event.admissionId}`);
      }
      if (admission.state === "departed") {
        return reject(state, event, `cannot update expected discharge for departed admission ${event.admissionId}`);
      }
      if (event.role === "ward" && event.actingUnitId && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `UPDATE_EXPECTED_DISCHARGE was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      if (typeof event.expectedDischargeAt !== "number" || !Number.isFinite(event.expectedDischargeAt)) {
        return reject(state, event, `UPDATE_EXPECTED_DISCHARGE expectedDischargeAt must be a valid timestamp`);
      }
      const isDateMove =
        admission.expectedDischargeAt !== null && admission.expectedDischargeAt !== event.expectedDischargeAt;
      const updated: Admission = {
        ...admission,
        expectedDischargeAt: event.expectedDischargeAt,
        dischargeDateMoves: isDateMove ? admission.dischargeDateMoves + 1 : admission.dischargeDateMoves,
        dischargeDateSetAt: event.now,
        // Walkthrough D8 (25 Sept 2026): "Ward manager" only when a ward set it. A coordinator is not
        // a ward manager, and the approved role list has no other label, so the role is not recorded.
        dischargeDateSetBy: event.role === "ward" ? "Ward manager" : null,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceAdmission(state, admission.id, updated);
    }
    // A reset re-anchors onto the demo's CURRENT now rather than handing back a fixture authored
    // at NOW_ANCHOR. Without this, a reset forty minutes into a demonstration returns predictions
    // that are already lapsed against a clock that has moved on - the exact defect Task 1 exists to
    // remove, reappearing on the one control a presenter reaches for when something looks wrong.
    //
    // `event.now` is the provider's now and already includes `clockOffsetMinutes`, which a reset
    // clears. Subtracting it lands the seed on the now the board will show AFTER the reset rather
    // than the one it showed before, so the visible clock does not jump.
    case "ADD_PATIENT": {
      /**
       * The whole case, and it is short on purpose: adding a patient links to nothing.
       *
       * No movement, no referral, no unit, no admission. That is what makes the owner's flow
       * possible - somebody searched, nobody came up, and this is the person who did not exist yet.
       * A version of this that required any of those would be the too-late record wearing a
       * different name.
       */
      // Membership-checked, never trusted from the type alone — the same discipline
      // `RECEIVE_REFERRAL` applies to `sex` against `SEXES`. `event.gender` is optional and
      // omitting it is the ordinary case (see the event's own doc comment); this only refuses a
      // caller that supplied something outside the two the owner's ruling permits.
      if (event.gender !== undefined && !GENDERS.includes(event.gender)) {
        return reject(state, event, "ADD_PATIENT gender must be chosen from GENDERS");
      }
      // Defensive uniqueness check: Reject duplicate UMRNs to prevent split clinical records
      const existingPatient = state.patients.find(
        (p) => p.umrn.trim().toLowerCase() === event.umrn.trim().toLowerCase(),
      );
      if (existingPatient) {
        return reject(
          state,
          event,
          `ADD_PATIENT UMRN collision: ${event.umrn.trim()} already belongs to patient ${existingPatient.id}`,
        );
      }
      // Optional suburb: blank/whitespace means "not yet recorded" (key absent), never store "".
      const suburb =
        typeof event.suburb === "string" && event.suburb.trim().length > 0 ? event.suburb.trim() : undefined;
      const patient: Patient = {
        id: `PT-A${String(state.patientSequence + 1).padStart(2, "0")}`,
        umrn: event.umrn,
        givenName: event.givenName,
        familyName: event.familyName,
        dateOfBirth: event.dateOfBirth,
        // Spread-in only when supplied — "not yet recorded" per owner ruling 2026-09-09/2026-09-10
        // is the KEY absent, never present-and-`undefined`, the same discipline `legalForm`'s
        // `dueAt` uses above for the same reason: the two shapes must not silently mean one thing.
        ...(event.gender === undefined ? {} : { gender: event.gender }),
        ...(suburb === undefined ? {} : { suburb }),
      };
      return { ...state, patients: [...state.patients, patient], patientSequence: state.patientSequence + 1 };
    }

    case "RESET_SCENARIO":
      return seedWardFlowStateAt(event.now - state.clockOffsetMinutes - NOW_ANCHOR);

    case "SET_SCENARIO": {
      // Y4 privacy fix round 2, P3 finding 6: `event.scenario` used to be passed straight through
      // with no runtime check at all — trusted on `WardScenario`'s type alone, the same
      // "union-typed (compile-time only)" gap this codebase already names for `legalStatus` /
      // `waitingOn` / `to` elsewhere (see `ward-flow-persistence-classification.ts`'s own comment).
      // A caller off the type system (an untyped script, a malformed dispatch) could store any
      // string as `state.scenario`, and `isValidStoredWardFlowState` (`ward-flow-provider.tsx`) used
      // to restore it unchecked too. Membership-checked here against the same `WARD_SCENARIOS` list
      // the restore-side check now reads, so the two can never silently disagree about what counts
      // as a real scenario.
      if (!WARD_SCENARIOS.includes(event.scenario)) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, `SET_SCENARIO scenario must be chosen from WARD_SCENARIOS`);
      }
      return seedWardFlowStateAt(event.now - state.clockOffsetMinutes - NOW_ANCHOR, event.scenario);
    }

    case "ADVANCE_CLOCK": {
      // Audit follow-up 2026-09-25: `event.minutes` used to be added to the offset unchecked,
      // so a non-finite (NaN/Infinity) or negative amount would corrupt every downstream
      // deadline read off the clock. `finiteInstant` already does the finiteness check this
      // reducer uses everywhere else; reused here rather than duplicating it.
      if (finiteInstant(event.minutes) === null || event.minutes < 0) {
        return reject(state, event, "ADVANCE_CLOCK minutes must be a finite, non-negative number");
      }
      return { ...state, clockOffsetMinutes: state.clockOffsetMinutes + event.minutes };
    }

    // Task 3 of the audit-wiring plan, 2026-09-16: the settings screen's "Save Configuration"
    // dispatches this once, with the whole edited draft. `validateConfiguration` is the only
    // door — an invalid payload is refused with a reason naming the field, never partially
    // applied field by field.
    case "SET_CONFIGURATION": {
      const requested = validateConfiguration(event.payload);
      if (!requested) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, describeInvalidConfiguration(event.payload));
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return { ...state, configuration: requested };
    }

    case "RAISE_REFERRAL": {
      const department = allEmergencyDepartments().find((ed) => ed.id === event.edId);
      if (!department) {
        return reject(state, event, `no emergency department found for id ${event.edId}`);
      }
      const sequence = state.referralSequence + 1;
      // The clinician chooses the form on the intake form; nothing here derives one from
      // `legalStatus` any more (product owner, 2026-08-24: "avoid any hard rules now please …
      // I can choose what option in the patient selection"). `null` means the clinician chose
      // no form, which is a real answer and not a missing one.
      //
      // A code the picker cannot offer is REFUSED rather than quietly dropped: silently
      // attaching no form would discard a choice the clinician did make, and inventing a form
      // for an unknown code is the fabrication this model exists to prevent.
      const chosenCode = event.draft.legalFormCode;
      const chosenForm =
        chosenCode === null ? undefined : SELECTABLE_LEGAL_FORMS.find((form) => form.code === chosenCode);
      if (chosenCode !== null && chosenForm === undefined) {
        return reject(state, event, `no selectable legal form found for code ${chosenCode}`);
      }
      /*
       * 🔴 THE ONLY PLACE THIS REDUCER WRITES A `dueAt` ON CREATION, AND BEFORE 2026-09-07 THERE
       * WAS NONE.
       *
       * Every deadline in the application was authored into the seed fixture, so a patient a
       * coordinator raised while actually using the prototype could never have a legal clock —
       * and every deadline-reading path (the severity ordering, the delays clock) was reachable
       * only by seeded patients. `tests/ward-legal-form-due-at-capture.test.ts` raises a referral
       * through this reducer specifically so that stays fixed.
       *
       * ⚠️ TYPED BY THE CLINICIAN, NEVER COMPUTED. The product owner answered one question on
       * 2026-09-07 — should the screen ASK for the due time — with "Yes". Deriving one from a
       * statutory interval is a different thing he declined on 2026-08-23: "please can you leave
       * the legal part and just start a clock once the patient arrives to ED. Keep it simple for
       * now." Nothing here may ever turn a duration into a deadline.
       *
       * 🔴 **CORRECTED 2026-09-17, T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`)
       * — "SELECTED BY `kind`, NOT BY A SECOND LIST OF CODES" IS NOW FALSE.** Struck in place
       * rather than deleted, because the reading that made it true is what a reader will otherwise
       * re-derive. Until this date `capturedDueAt` kept `event.draft.legalFormDueAt` only when
       * `chosenForm?.kind` was `"transport"` or `"transfer"` — 4A and 4C, the two the owner named
       * on 2026-08-23 — and dropped it for every other code. Owner answer 1, 2026-09-17: the
       * clinician types the expiry written on whichever form they hold, of any code, so this no
       * longer reads `kind` (or any other classification) at all — whatever the caller supplied on
       * `event.draft.legalFormDueAt` survives, for any `chosenForm`, exactly as typed.
       * `RECORD_LEGAL_FORM_EXPIRY` (below) is the event that records a further typed expiry or
       * extension after this initial capture. `tests/ward-legal-figure-guard.test.ts` no longer
       * allowlists by code either — see that file's own header for the provenance property that
       * replaced it.
       */
      const capturedDueAt = event.draft.legalFormDueAt;
      /*
       * ⚠️ THE LINK BACK TO THE FRONT DOOR — this is the ONLY writer of `Movement.referralId`.
       *
       * Owner ruling 8, 2026-09-01: a community team's referral to an emergency department and the
       * journey that department subsequently raises are TWO LINKED RECORDS, not one. Nothing is
       * invented here — every fact the movement needs already arrives on `event.draft` — so this
       * writes an id and nothing else.
       *
       * ⚠️ **IT RESOLVES RATHER THAN STORES, and that is the entire difference between this field
       *
       * 🔴 CORRECTED 2026-09-11: EVERY FACTUAL CLAUSE ABOUT `Admission.referralId` ABOVE IS NOW FALSE.
       * Struck in place rather than deleted, because the reading that made it true is what a reader
       * will otherwise re-derive.
       *
       *     seeded Admission.referralId, non-null      10      every one RESOLVES
       *     real Referral ids                          24      dangling: ZERO
       *     admissions carrying literal null          257      an honest absence, not a broken join
       *
       * Repaired 2026-09-10 at a6e5208b85 - "seeded referralId links what is true and nulls the rest,
       * invents nothing". ⚠️ The manufacturing by string substitution is GONE, not reduced.
       *
       * ✅ THE DESIGN POINT IS UNAFFECTED AND IS THE REASON THIS COMMENT EXISTS: resolve and refuse,
       * never merely store. `"RF-QQQ"` survives every truthiness test and reads as a plausible
       * identifier, which is exactly why an id naming no referral is refused here.
       * and `Admission.referralId`.** That field holds ids manufactured by string substitution from
       * the admission's own id, overlapping the real referral ids in zero places, and nothing can
       * see it: a stored id that joins to nothing typechecks, renders and passes every test
       * (`docs/ward-flow/fields-with-no-producer-2026-09-01.md`). So an id naming no referral is
       * REFUSED here, in the same discipline as `RECEIVE_REFERRAL`'s `edId` and `originSiteCode`
       * checks — and for the same reason, since `"RF-QQQ"` survives every truthiness test and reads
       * as a plausible identifier.
       *
       * ⚠️ **AND THE REFERRAL MUST NAME THIS DEPARTMENT.** Under ruling 8 the patient attends the
       * department the referral was addressed to, and that department raises the journey. A journey
       * at Fremantle claiming a referral addressed to Broome is a false join wearing a real id —
       * indistinguishable, once written, from a true one. The purpose (`bed`,
       * `psychiatric_review`, `medical_assessment`) is deliberately NOT checked: a referral to an
       * ED is a notification nobody declines on the purpose axis (owner, 2026-09-01), so gating on
       * it would be inventing a rule nobody has given.
       *
       * 🔴 **CORRECTED 2026-09-17, R5 (`docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md`,
       * WF-09) — "the addressing's state are deliberately NOT checked" IS NOW FALSE.** Struck in
       * place rather than deleted, because the reading that made it true is what a reader will
       * otherwise re-derive. This event had NO uniqueness guard at all: a second open movement could
       * be raised from the same referral, and a journey could be raised from an addressing its own
       * referrer had withdrawn or its own department had declined. Both are refused below, and
       * neither reopens the purpose question this paragraph still correctly leaves alone — a
       * withdrawal or a decline is a fact about whether the referral is STILL LIVE, not about what
       * it was asking for.
       */
      let raisedFrom: Referral | undefined;
      if (event.referralId !== undefined) {
        raisedFrom = findReferral(state, event.referralId);
        if (!raisedFrom) {
          return reject(
            state,
            event,
            `RAISE_REFERRAL referralId must name a referral this system already holds, and ${event.referralId} names none`,
          );
        }
        const referral = raisedFrom;
        const addressing = referral.destinations.find(
          (candidate) =>
            candidate.destination.kind === "emergency_department" && candidate.destination.edId === event.edId,
        );
        if (!addressing) {
          return reject(
            state,
            event,
            `referral ${referral.id} was never addressed to ${department.name}, so a journey raised there did not come from it`,
          );
        }
        /*
         * ⚠️ **WITHDRAWN CHECKED SEPARATELY FROM `state`, THE SAME O-17.11 SPLIT `ACCEPT_REFERRAL`
         * AND `DECLINE_REFERRAL` ALREADY HOLD TO.** `RECORD_REFERRER_WITHDRAWAL` stamps
         * `withdrawnAt` and never touches `state` — a fifth state would have bought almost no
         * compiler help, so `state` alone cannot see a withdrawal. Checked first: a withdrawn
         * referral is dead regardless of whatever `state` still reads.
         */
        if (addressing.withdrawnAt !== undefined) {
          return reject(
            state,
            event,
            `referral ${referral.id} was withdrawn by its referrer, so no journey can be raised from it`,
          );
        }
        // Declined, specifically — not merely "not queued": `accepted` and `cancelled` are not
        // refused here, because neither says this department turned the referral away. FD-24's own
        // reasoning runs the other direction for this guard than it does for ACCEPT_REFERRAL: a
        // decline there locks nobody ELSE out, but a decline HERE, on THIS destination, is exactly
        // the fact that must stop THIS department raising a journey from it.
        if (addressing.state === "declined") {
          return reject(
            state,
            event,
            `${department.name} declined referral ${referral.id}, so no journey can be raised from it`,
          );
        }
        /*
         * 🔴 **THE UNIQUENESS GUARD ITSELF — WF-09, and owner Q11 confirms the shape: a second
         * journey is refused WHILE an earlier one from the same referral is still open, and
         * permitted once that earlier one has genuinely NOT PROCEEDED.**
         *
         * 🔴 **CORRECTED, P2-6 (Ward Lead audit, 2026-09-17) — "counts as open exactly when it
         * neither carries a `closure` nor has reached `arrived`" IS NOW TOO NARROW.** Struck in
         * place rather than deleted, because the reading that made it true is what a reader will
         * otherwise re-derive. `isOpen`'s own definition treated a movement that had ARRIVED as
         * fair game for a second raise, the same as one that had genuinely `did_not_proceed` — but
         * an arrival is the referral's purpose being FULFILLED, not abandoned, and raising a second
         * journey from a referral that already delivered its patient is the same double-journey
         * shape this guard exists to catch, not the re-raise owner Q11 describes. The guard now
         * blocks on anything OTHER than a `did_not_proceed` closure — open (no closure at all) or
         * closed by arrival both block; only a closure whose outcome IS `did_not_proceed` (the
         * shape `WITHDRAW_REFERRAL`, `RECORD_ED_OUTCOME` and `REFER_TO_COMMUNITY_TEAM` all close
         * with) lets a second journey through, which is what `tests/ward-raise-referral-uniqueness
         * .test.ts`'s own Q11 case exercises via `WITHDRAW_REFERRAL`.
         *
         * `isOpen` (`ward-derivations.ts`) is still not imported here — that module imports
         * `REFERRABLE_MOVEMENT_STAGES` from THIS file, and importing back would be a circular
         * module edge, the identical reason `PULL_PATIENT`'s own `resolvedReferral` inlines its
         * lookup rather than importing `referralForMovement`.
         *
         * Scoped to THIS referral's id, never to `edId` alone: the point is one referral cannot
         * fund two live journeys at once, and a second department raising from the same referral
         * while the first still stands is exactly the case this guard exists to catch.
         */
        const blockingLinkedMovement = state.movements.find(
          (movement) => movement.referralId === referral.id && movement.closure?.outcome !== "did_not_proceed",
        );
        if (blockingLinkedMovement) {
          return reject(
            state,
            event,
            `referral ${referral.id} already has a linked movement (${blockingLinkedMovement.id}) that did not close as "did not proceed"; a second journey cannot be raised while it stands`,
          );
        }
      }
      // Opus review round 2, 17 September 2026 (P2): `RECEIVE_REFERRAL` above membership-checks
      // its own `gender` and `tentativeDiagnosis` fields, but this event wrote both straight from
      // `event.draft` with no check at all — a caller bypassing the picker's own type (a lower-case
      // `"non-binary"`, an invented diagnosis code) reached the movement unrefused. Checked here,
      // before the movement is built, in the same membership discipline as `RECEIVE_REFERRAL`'s
      // `gender` and `tentativeDiagnosis` checks.
      if (event.draft.gender !== undefined && !REFERRAL_GENDERS.includes(event.draft.gender)) {
        return reject(state, event, `RAISE_REFERRAL gender must be chosen from REFERRAL_GENDERS`);
      }
      if (event.draft.tentativeDiagnosis !== undefined && !isTentativeDiagnosisBlock(event.draft.tentativeDiagnosis)) {
        return reject(state, event, `RAISE_REFERRAL tentativeDiagnosis must be chosen from TENTATIVE_DIAGNOSIS_BLOCKS`);
      }
      const created: Movement = {
        id: nextReferralId(sequence),
        originEdId: event.edId,
        openedAt: event.now,
        patientId: event.patientId ?? raisedFrom?.patientId,
        // `undefined` when nobody referred this person — the ordinary case, and a real answer
        // rather than a missing one. Never a manufactured id: the guard above refuses anything
        // that does not resolve.
        referralId: raisedFrom?.id ?? event.referralId,
        /*
         * ⚠️ WHY THE ABSENCE IS WRITTEN DOWN RATHER THAN LEFT EMPTY — owner ruling R-2026-09-04-D.
         *
         * An empty `referralId` had three causes and rendered as one: nobody raised a referral
         * (clinical), the record predates the link (record-keeping), or the raiser was never asked
         * (record-keeping). This branch knows which of the three it is producing. Nothing on this
         * event asks WHICH referral a journey came from unless the caller volunteers one, so a
         * runtime movement with no id is the third case and says so — `not_asked`, not
         * `none_raised`. Only `RECORD_NO_REFERRAL`, where somebody actually answers the question,
         * writes the clinical one.
         *
         * Exactly one of the two fields is ever set here: a resolved referral leaves the absence
         * undefined, and an absence leaves the id undefined.
         */
        referralAbsence: raisedFrom === undefined ? { reason: "not_asked" as const, at: event.now } : undefined,
        // A newly raised movement is never flagged. The flag is an act somebody takes on a
        // patient already in the queue, not a property of arriving.
        flaggedUrgent: false,
        urgency: event.draft.urgency,
        cohort: event.draft.cohort,
        security: event.draft.security,
        sex: event.draft.sex,
        gender: event.draft.gender,
        // T15 (item 12): the ED's own choice REPLACES whatever the linked referral carried — the
        // 29 Aug ruling, "easy to continually adjust and refine along the way". `raisedFrom` is
        // the same resolved referral `referralId` above already shares, so this can never disagree
        // with which referral (if any) this movement links to.
        tentativeDiagnosis: event.draft.tentativeDiagnosis ?? raisedFrom?.tentativeDiagnosis,
        specialling: event.draft.specialling,
        highAcuity: event.draft.highAcuity,
        legalStatus: event.draft.legalStatus,
        // Spread-copied, never aliased: `SELECTABLE_LEGAL_FORMS`'s entries are the picker's
        // own source and must not become mutable state hanging off a movement.
        // The spread keeps `dueAt` OFF the object entirely when none was typed, rather than
        // present-and-undefined: an absent deadline and a deadline explicitly set to nothing must
        // not be two different shapes, or a reader checking `"dueAt" in form` gets a different
        // answer from one checking `form.dueAt !== undefined`.
        legalForm:
          chosenForm === undefined
            ? undefined
            : { ...chosenForm, ...(capturedDueAt === undefined ? {} : { dueAt: capturedDueAt }) },
        /*
         * 🔴 T2r FIX ROUND, FINDING 2 (2026-09-17). Before this fix, a `dueAt` captured HERE never
         * gained a history entry — only `RECORD_LEGAL_FORM_EXPIRY` wrote one — so a movement raised
         * with a typed expiry could carry `legalForm.dueAt` while `legalFormExpiryHistory` stayed
         * empty or undefined, silently breaking the "dueAt always equals the last history entry"
         * invariant from the very first moment a form existed. Written only when a due time was
         * actually captured, on the same "absent means untouched" discipline every optional array
         * on this type already holds to — see `legalFormExpiryHistory`'s own doc comment in
         * `ward-model.ts`.
         */
        legalFormExpiryHistory:
          capturedDueAt === undefined
            ? undefined
            : [{ at: event.now, by: event.role, dueAt: capturedDueAt, basis: "written_on_form" as const }],
        statusChanges: [],
        urgencyChanges: [],
        overrides: [],
        stage: "placement_requested",
        owner: department.name,
        referredUnitIds: [],
        declines: [],
        blocker: "Awaiting coordinator referral",
        withdrawnReferrals: [],
        unwinds: [],
        // Step 1 of the track (Task 4) — `from` absent because there is no previous stage, but an
        // entry is still written, so the creation moment lives inside this array rather than being
        // reachable only through `openedAt` beside it.
        stageChanges: [{ at: event.now, to: "placement_requested", by: event.role }],
        // `formedAt` is deliberately left unset. It used to be stamped in this same branch, on
        // the strength of the status-derived Form 1A that has now been deleted; with that
        // derivation gone there is no rule left to hang it on, and inventing a replacement one
        // would be exactly the kind of hidden rule this change removes. When a patient was
        // formed in the community is a fact only a clinician holds, so until there is a field
        // for it, a runtime-raised referral has no `formedAt` and its legal clock coincides
        // with its department clock. The fixture keeps its own authored values.
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...state,
        movements: [...state.movements, created],
        referralSequence: sequence,
      };
    }

    case "RECORD_MEDICAL_CLEARANCE": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      // ⚠️ RE-RECORDING IS ALLOWED AND OVERWRITING IS THE POINT. Unlike `RECORD_EXAMINATION`
      // above, which refuses a second examination as a data-integrity fault, a medical clearance
      // is a CURRENT STATE that legitimately changes: a patient cleared at 09:00 can deteriorate
      // by 11:00, and refusing the correction would leave the board asserting something the
      // department no longer believes. The `at` stamp is the answer's own time, so the record says
      // WHEN it was true rather than implying it always has been.
      const updated: Referral = {
        ...referral,
        medicalClearance: { cleared: event.cleared, at: event.now },
      };
      const next = replaceReferral(state, referral.id, updated);
      return {
        ...next,
        movements: next.movements.map((movement) =>
          movement.referralId === referral.id &&
          (movement.patientId === undefined || movement.patientId === referral.patientId)
            ? { ...movement, medicalClearance: updated.medicalClearance }
            : movement,
        ),
      };
    }

    /**
     * 🔴 THE ONLY WRITER OF `Referral.inDepartmentAt`, AND THE ONLY DOOR FROM "EXPECT" TO
     * "REFERRAL".
     *
     * Product owner, 2026-09-07: "When expects arrive and are marked as arrived, they become
     * referrals." Before this case existed nothing could move a patient between those lists —
     * `triagedAt` is written only inside `RECEIVE_REFERRAL`, so a referral created without one
     * could never acquire one, and an expects list built on triage could only ever grow.
     */
    case "RECORD_ARRIVED_IN_DEPARTMENT": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /*
       * ⚠️ IDEMPOTENT, AND THE FIRST RECORDING WINS.
       *
       * Two clinicians noticing the same patient is ordinary, not an error, so a second recording
       * is a no-op rather than a rejection — a refusal would read on screen as though the first one
       * had failed. And the EARLIER time is kept: the question this field answers is "since when
       * has this person been in the department", so overwriting with a later observation would
       * shorten a wait that actually happened. That is the opposite of `RECORD_MEDICAL_CLEARANCE`
       * above, which overwrites deliberately because clearance is a current state that changes;
       * arrival is a fact about the past and does not un-happen.
       */
      if (referral.inDepartmentAt !== undefined) return state;
      const updated: Referral = { ...referral, inDepartmentAt: event.now };
      return replaceReferral(state, referral.id, updated);
    }

    case "RECORD_TRANSPORT_NEED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Refused once the journey is over, on `RECORD_EXAMINATION`'s reasoning above: every other
      // movement-scoped handler refuses a closed movement, and an answer about how somebody will
      // travel is meaningless once they have arrived or did not proceed.
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot record a transport need for a closed movement (${movement.closure.reason})`,
        );
      }
      // ⚠️ RE-RECORDING IS ALLOWED AND OVERWRITING IS THE POINT, exactly as for a medical
      // clearance: a patient who could walk at 09:00 may need an escort by 11:00, and refusing the
      // correction would leave the board asserting something the sending team no longer believes.
      // The `at` stamp is the answer's own time, so the record says when it was true.
      // Audit 2026-09-25 §3 item 4: "not needed" used to be written onto a live booked job, which
      // then let PATIENT_ARRIVED close the movement while the vehicle stayed booked. A booked job
      // is cancelled through CANCEL_TRANSPORT first; this answer never silently overrides it.
      if (
        !event.needed &&
        movement.transport !== undefined &&
        movement.transport.cancelledAt === undefined &&
        movement.transport.arrivedAt === undefined
      ) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a booked transport job; cancel it before recording that no transport is needed`,
        );
      }
      const updated: Movement = {
        ...movement,
        transportNeed: { needed: event.needed, at: event.now },
        ...(movement.transport ? { transport: { ...movement.transport, needed: event.needed } } : {}),
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_NO_REFERRAL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot record a referral answer for a closed movement (${movement.closure.reason})`,
        );
      }
      /*
       * ⚠️ THE CONTRADICTION IS REFUSED RATHER THAN STORED. `referralId` and `referralAbsence`
       * answer the same question, and a movement carrying both says a referral exists and that
       * none does. `movementReferralLink` prefers the referral when it meets that pair, but a
       * reader resolving a contradiction is a last line, not a licence to create one here.
       */
      if (movement.referralId !== undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} was raised from referral ${movement.referralId}, so it cannot also record that nobody referred this patient`,
        );
      }
      const updated: Movement = { ...movement, referralAbsence: { reason: "none_raised", at: event.now } };
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * RB3, item 19 (owner answers 2026-09-17). The department that holds the patient records that
     * they no longer need a psychiatric bed search — either going home ("for discharge") or
     * needing community follow-up rather than admission ("for community follow-up"). Unwinds
     * exactly like `WITHDRAW_REFERRAL`'s pre-collection path: any live ward requests are withdrawn,
     * a pulled bed and its admission are released once, and an uncollected transport job is
     * cancelled — see that case's own comment for why the two branches (referred-but-not-accepted,
     * accepted-but-not-collected) are handled the same way here rather than kept apart.
     */
    case "RECORD_ED_OUTCOME": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot record an ED outcome for a closed movement (${movement.closure.reason})`);
      }
      // Same discipline as WITHDRAW_REFERRAL's post-acceptance branch and REFER_TO_COMMUNITY_TEAM:
      // once the patient has been physically collected this is a journey under way, not a bed
      // search to end — STOP_TRANSPORT is the event for stopping it from here.
      if (
        movement.stage === "moving" ||
        movement.transport?.collectedAt !== undefined ||
        (movement.transport &&
          movement.transport.collectedAt !== undefined &&
          movement.transport.arrivedAt === undefined &&
          movement.transport.cancelledAt === undefined)
      ) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s patient is actively in transit; use STOP_TRANSPORT to stop the journey instead of recording an ED outcome`,
        );
      }
      // Owner answer 1 (second round, 2026-09-17): the same gate F4 enforces for
      // REFER_TO_COMMUNITY_TEAM, mirrored here for "for_discharge" only — "for discharge" means the
      // bed search ends because the patient is going home, and a patient on a legal form cannot be
      // found fit to go home before a conclusive examination outcome says so. "further_examination
      // ordered" settles nothing, so it does not unlock this either. "for_community_follow_up"
      // carries no such restriction, exactly as this case's own doc comment already states.
      // Voluntary patients (on no form and no restrictive legal status) are never blocked.
      const isOnLegalFormForDischarge =
        !!movement.legalForm || (movement.legalStatus !== undefined && movement.legalStatus !== "Voluntary");
      if (
        event.outcome === "for_discharge" &&
        isOnLegalFormForDischarge &&
        (!movement.examination || movement.examination.outcome === "further_examination_ordered")
      ) {
        return reject(
          state,
          event,
          `movement ${movement.id} is on a legal form; a conclusive examination outcome must be recorded before recording "for discharge"`,
        );
      }
      // Gives back a bed already pulled (and deletes the admission it created), or does nothing if
      // no bed has been pulled yet — see this helper's own doc comment. A no-op is safe to call
      // unconditionally, which is what "released once" means here.
      const withoutPulledBed = releasePulledBedAndAdmission(state, movement, event.now);
      // Truthful cause: the department recorded an outcome that ends the bed search, not the
      // referrer withdrawing (`WithdrawalReason.ed_outcome_recorded`, `ward-change-reasons.ts`).
      const withdrawnLiveRequests = movement.referredUnitIds.map((unitId) => ({
        unitId,
        at: event.now,
        reason: "ed_outcome_recorded" as const,
      }));
      const reasonLabel = event.outcome === "for_discharge" ? "For discharge" : "For community follow-up";
      // P1-4 (Ward Lead audit, 2026-09-17): captured BEFORE `updatedMovement` overwrites them, the
      // same read-before-write discipline `REFER_TO_COMMUNITY_TEAM`'s own `acceptingUnitId` holds to
      // a few cases below. Nobody was told when an ED outcome ended a bed search: the accepting ward
      // kept believing it was getting this patient (`acceptedUnitId` was never even cleared, so
      // `ed-screen.tsx`'s "Still to be moved" outbox went on showing a discharged patient as "Going
      // to" that ward), the transport officer was never told a booked-but-uncollected job had just
      // been cancelled, and a ward still holding a live (unaccepted) request was never told it had
      // been dropped.
      const acceptingUnitId = movement.acceptedUnitId;
      const hadLiveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      const updatedMovement: Movement = {
        ...movement,
        admissionId: undefined,
        // See `acceptingUnitId` above: left set, this movement would go on reading as accepted at a
        // ward after the bed search that acceptance belonged to had already ended.
        acceptedUnitId: undefined,
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawnLiveRequests],
        edOutcome: event.outcome,
        // Any booked-but-not-collected job is cancelled in the same update that closes the
        // movement — the same discipline WITHDRAW_REFERRAL's post-acceptance branch and
        // REFER_TO_COMMUNITY_TEAM already hold `TransportJob.cancelledAt` to.
        transport:
          movement.transport && movement.transport.cancelledAt === undefined
            ? { ...movement.transport, cancelledAt: event.now }
            : movement.transport,
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: reasonLabel,
        },
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      const next = replaceMovement(withoutPulledBed, movement.id, updatedMovement);
      // Same three-notice shape `REFER_TO_COMMUNITY_TEAM` (below) and `WITHDRAW_REFERRAL`'s
      // post-acceptance branch (above) already raise for the identical unwind: the accepting ward
      // (if any), the transport officer (if a job was live), and every ward still holding a live,
      // unaccepted request (if any) — each its own `NoticeKind`, or its own `count`, so none can
      // collide under `makeNotice`'s id rule.
      const outcomeNotices: Notice[] = [];
      let noticeCount = withoutPulledBed.notices.length;
      if (acceptingUnitId !== undefined) {
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "referral_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            `The referral for ${movement.id} was withdrawn (${reasonLabel.toLowerCase()}); the patient is no longer coming.`,
          ),
        );
      }
      if (hadLiveTransportJob) {
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "transport_cancelled_officer",
            { role: "officer" },
            { movementId: movement.id },
            `Transport for ${movement.id} was cancelled (${reasonLabel.toLowerCase()}); no bed is held and nothing has been rebooked.`,
          ),
        );
      }
      for (const unitId of movement.referredUnitIds) {
        outcomeNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "ward_request_withdrawn",
            { role: "ward", placeId: unitId },
            { movementId: movement.id, unitId },
            `The request for ${movement.id} was withdrawn: ${reasonLabel.toLowerCase()}.`,
          ),
        );
      }
      return appendNotices(next, outcomeNotices);
    }

    /**
     * Ruling 1 (2026-09-16). ED marks a Form 1A as received.
     *
     * 🔴 **CORRECTED 2026-09-17, T2r fix round, finding 10 — "which starts the 24-hour psychiatric
     * examination clock" IS NOW FALSE.** That computed clock was deleted by T2 on owner answer 1:
     * this prototype works out no legal time limits of its own. This case still records the
     * receipt instant; nothing here starts a clock from it any longer.
     */
    case "RECORD_LEGAL_FORM_RECEIVED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot mark legal form received for a closed movement (${movement.closure.reason})`,
        );
      }
      if (movement.legalFormReceivedAt !== undefined) {
        return reject(state, event, `legal form for movement ${movement.id} was already marked as received`);
      }
      // Receipt is a fact about a supported form: 1A, 3A, 3C, 3D, 6A, 6B,
      // 6C, 5A or 5B. Recording receipt against any other code, or against no form at all, would
      // be a fact about a form nobody holds. Refused rather than silently accepted.
      if (!movement.legalForm || !isLegalClockFormCode(movement.legalForm.code)) {
        return reject(
          state,
          event,
          `movement ${movement.id} does not carry a receivable legal form (legal form ${movement.legalForm?.code ?? "none"}), so a legal form receipt cannot be recorded against it`,
        );
      }
      // Ruling "form end times come from the time written on the form": receipt records only the
      // instant of receipt. No statutory deadline is computed here — a clinician's typed expiry
      // (`RECORD_LEGAL_FORM_EXPIRY`) is the only legitimate source of a `dueAt`.
      const updated: Movement = {
        ...movement,
        legalFormReceivedAt: event.now,
      };
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`). The undo
     * `RECORD_LEGAL_FORM_RECEIVED` above has never had: a clinician marked receipt in error, or
     * against the wrong movement, and needs to correct it without losing the fact a receipt was
     * ever recorded. Clears `legalFormReceivedAt` and appends the ORIGINAL instant, who corrected
     * it and the fixed reason they gave to `legalFormReceiptCorrections`, so a second
     * `RECORD_LEGAL_FORM_RECEIVED` can succeed cleanly afterwards.
     */
    case "CORRECT_LEGAL_FORM_RECEIPT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot correct a legal form receipt for a closed movement (${movement.closure.reason})`,
        );
      }
      if (movement.legalFormReceivedAt === undefined) {
        return reject(state, event, `movement ${movement.id} has no recorded legal form receipt to correct`);
      }
      if (!LEGAL_FORM_RECEIPT_CORRECTION_REASONS.includes(event.reason)) {
        return reject(
          state,
          event,
          `CORRECT_LEGAL_FORM_RECEIPT reason "${event.reason}" is not one of the fixed correction reasons`,
        );
      }
      const correction = {
        at: event.now,
        by: event.role,
        reason: event.reason,
        receivedAt: movement.legalFormReceivedAt,
      };
      const updated: Movement = {
        ...movement,
        legalFormReceivedAt: undefined,
        legalFormReceiptCorrections: [...(movement.legalFormReceiptCorrections ?? []), correction],
      };
      // Audited as "legal-form" (`classifyAuditEvent`); without this the stored change was
      // recorded in the audit trail as "denied".
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`), owner answer 1 and item
     * 5 (regional extensions). The clinician types the expiry written on the form in front of
     * them — for any form, not a chosen few — and, on a later occasion, a further extension
     * written on a fresh form. This one event carries both; which it is is read off the state, not
     * off a caller-supplied flag, exactly the discipline `RECORD_LEGAL_FORM_RECEIVED` above holds
     * to for its own "already recorded" check.
     */
    case "RECORD_LEGAL_FORM_EXPIRY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // T2r fix round, finding 11 (2026-09-17): a plain, fixed sentence — matching the other two
      // refusals in this case, and no longer interpolating `movement.closure.reason` (a clinical
      // string built for a different audience) into a form-control's own error text.
      if (movement.closure) {
        return reject(state, event, "This record is closed, so no expiry can be added to it.");
      }
      // §2's exact sentence — there is no form here to attach a typed expiry to, so this refuses
      // rather than inventing one.
      if (!movement.legalForm) {
        return reject(state, event, "There is no legal form on this record to add an expiry to.");
      }
      // T2r fix round, finding 8 (2026-09-17). `Instant` is a bare `number` at the type level, so
      // nothing stops a caller sending `NaN`/`Infinity` at runtime — the same `Number.isFinite`
      // discipline every other instant-shaped field in this codebase already holds callers to
      // (see e.g. `ward-discharge-dates.ts`, `ward-referrals.ts`). A non-finite value is refused
      // before it can become a stored "expiry" nothing can compare or render.
      if (!Number.isFinite(event.dueAt)) {
        return reject(state, event, "Enter the expiry written on the form.");
      }
      const currentDueAt = movement.legalForm.dueAt;
      // Legacy calculated clocks are not paper authority. The six authored fixture values and
      // current entered values are; absence of an old actor-history record does not discard them.
      const legacyCalculatedExpiry =
        movement.legalClock !== undefined && currentDueAt === movement.legalClock.expiresAt;
      const isExtension = currentDueAt !== undefined && !legacyCalculatedExpiry;
      // An extension only ever moves an expiry LATER. Nothing here computes what "later" should
      // be — the clinician types the new expiry off a fresh form, and this only orders it against
      // what is already recorded. §2's exact sentence for the refusal.
      if (isExtension && event.dueAt <= currentDueAt) {
        return reject(state, event, "An extension's new expiry must be later than the expiry already recorded.");
      }
      const basis: "written_on_form" | "extension" = isExtension ? "extension" : "written_on_form";
      const historyEntry = { at: event.now, by: event.role, dueAt: event.dueAt, basis };
      const updated: Movement = {
        ...movement,
        legalForm: { ...movement.legalForm, dueAt: event.dueAt },
        legalClock: undefined,
        legalFormExpiryHistory: [...(movement.legalFormExpiryHistory ?? []), historyEntry],
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * Opus review round 2, 17 September 2026 (P2): the `gender_designation` gate's own refusal
     * text says "Record gender first", and until this case nothing on the running app could act
     * on that — `Movement.gender` was writable only at `RAISE_REFERRAL`/`RECEIVE_REFERRAL`, both
     * before the movement exists to correct. Membership-checked like `RECORD_LEGAL_FORM_EXPIRY`
     * immediately above; refuses a closed movement, an off-list gender, and — unlike an ordinary
     * correction event — an unchanged value, since a "correction" to the same gender the movement
     * already carries is not a change this event exists to make.
     */
    case "RECORD_MOVEMENT_GENDER": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot record gender for a closed movement (${movement.closure.reason})`);
      }
      if (!REFERRAL_GENDERS.includes(event.gender)) {
        return reject(state, event, `RECORD_MOVEMENT_GENDER gender must be chosen from REFERRAL_GENDERS`);
      }
      if (movement.gender === event.gender) {
        return reject(state, event, `movement ${movement.id} is already recorded as gender ${event.gender}`);
      }
      const changeEntry = { at: event.now, by: event.role, from: movement.gender, to: event.gender };
      const updated: Movement = {
        ...movement,
        gender: event.gender,
        genderChanges: [...(movement.genderChanges ?? []), changeEntry],
      };
      const next = replaceMovement(state, movement.id, updated);
      /*
       * P1-3 (Ward Lead ruling, 17 September 2026): a correction landing while an acceptance or a
       * bed is already held (`accepted_awaiting_bed` through `moving`) means a unit was chosen
       * under the gender this event just replaced — `heldUnitGenderRefusal` (above) only catches
       * that the NEXT time the movement tries to move forward, which may be a while, or never if
       * the movement sits at `moving` until arrival (a stage this file's own rule deliberately never
       * re-checks). The coordinator is told immediately instead of waiting on the next dispatch.
       *
       * Deliberately NOT raised for `placement_requested` or `destination_review` (nothing is held
       * yet — `REFER_TO_UNITS`/`ACCEPT_IN_PRINCIPLE` will re-ask the gate themselves) or `arrived`
       * (the movement is closed to further placement decisions; nothing to check).
       */
      const HELD_STAGES_FOR_GENDER_NOTICE: readonly MovementStage[] = [
        "accepted_awaiting_bed",
        "pulled",
        "handover_ready",
        "moving",
      ];
      if (!HELD_STAGES_FOR_GENDER_NOTICE.includes(movement.stage)) return next;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "movement_gender_recorded_after_placement",
          { role: "coordinator" },
          { movementId: movement.id },
          `Gender recorded after a ward was chosen for ${movement.id}. Check the placement still suits.`,
        ),
      ]);
    }

    /**
     * Ruling 16 (2026-09-16), Item 14 & 48 (2026-09-17). Direct ED-to-CMHT referral pathway when inpatient admission is not needed.
     * Creates a real community referral, notifies the destination team, and records the outcome.
     */
    case "REFER_TO_COMMUNITY_TEAM": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot refer a closed movement (${movement.closure.reason})`);
      }
      if (!communityTeamOptions().includes(event.team)) {
        return reject(state, event, `team "${event.team}" is not a valid community mental health team`);
      }
      // Fix round (2026-09-16 audit): this used to have no collection check at all, so a `moving`
      // movement (transport already collected) could be referred to community — freeing the bed,
      // deleting the admission and stamping `cancelledAt` on a job that had already been collected.
      // `WITHDRAW_REFERRAL` refuses the equivalent case and points at `STOP_TRANSPORT`; this does
      // the same.
      if (movement.transport?.collectedAt !== undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of referring to a community team`,
        );
      }
      // F4 (Opus adversarial review, 2026-09-17): the same gate `communityReferralBlockedReason`
      // (ed-screen.tsx) already advertises, now actually enforced here — before this fix the
      // screen refused to OFFER the control on a not-yet-examined patient on a form, but nothing
      // stopped the event itself from being dispatched. Owner answer 14: a patient on a legal
      // form cannot be referred to a community team until a conclusive examination outcome is
      // recorded; "further examination ordered" does not unlock it. Voluntary patients (on no
      // form and no restrictive legal status) are never blocked by this check.
      const isOnForm =
        !!movement.legalForm || (movement.legalStatus !== undefined && movement.legalStatus !== "Voluntary");
      if (isOnForm && (!movement.examination || movement.examination.outcome === "further_examination_ordered")) {
        return reject(
          state,
          event,
          `movement ${movement.id} is on a legal form; a conclusive examination outcome must be recorded before referring to a community team`,
        );
      }
      const withoutPulledBed = releasePulledBedAndAdmission(state, movement, event.now);
      const linkedReferral = withoutPulledBed.referrals.find((r) => r.id === movement.referralId);
      const originEd = allEmergencyDepartments().find((d) => d.id === movement.originEdId);
      const originSite = originEd ? siteByCode(originEd.siteCode) : undefined;

      // Finding 3 (2026-09-17 review): if the linked referral already carries a QUEUED arm to this
      // exact team, this dispatch must reuse it rather than raising a second referral (or a second
      // arm) asking the same team the same question twice. `state === "queued"` only — an already
      // `accepted`/`declined`/`cancelled` arm is a settled outcome, not a standing request this call
      // could be answering again.
      const existingQueuedArm = linkedReferral?.destinations.find(
        (addressing) =>
          addressing.destination.kind === "community_team" &&
          addressing.destination.teamName === event.team &&
          addressing.state === "queued" &&
          addressing.withdrawnAt === undefined,
      );

      const sequence = existingQueuedArm
        ? withoutPulledBed.frontDoorReferralSequence
        : withoutPulledBed.frontDoorReferralSequence + 1;
      const referralId = existingQueuedArm && linkedReferral ? linkedReferral.id : nextFrontDoorReferralId(sequence);

      // F6 (Opus adversarial review, 2026-09-17): with no linked referral this used to invent
      // `suburb: { kind: "named", name: originSite?.name ?? "Perth" }` — a HOSPITAL'S name stored
      // in a field that means "the patient's home suburb," which is not merely unrecorded, it is
      // wrong. `ReferralSuburb`'s own `{ kind: "unknown", reason: "not_known" }` variant exists
      // exactly for this: a stated absence rather than a fabricated value (`ward-movements.ts`'s
      // own seed already uses it the same way). `homeRegion` has no equivalent unknown member —
      // `HOME_REGIONS` is a closed list of ten real WA regions with no catch-all — so that field's
      // "Perth Metropolitan" fallback is left as-is; widening the model to add one is outside this
      // fix.
      //
      // Finding 3: `undefined` when reusing an existing queued arm — nothing new to raise.
      const newReferral: Referral | undefined = existingQueuedArm
        ? undefined
        : {
            id: referralId,
            patientId: linkedReferral?.patientId,
            ageBand: movement.cohort,
            homeRegion: linkedReferral?.homeRegion ?? "Perth Metropolitan",
            suburb: linkedReferral?.suburb ?? { kind: "unknown", reason: "not_known" },
            source: "ed_medical",
            originSiteCode: originSite?.code ?? "ARM",
            raisedAt: event.now,
            urgency: movement.urgency,
            destinations: [
              {
                destination: { kind: "community_team", teamName: event.team },
                state: "queued",
              },
            ],
            transportNeeded: false,
            // Finding 4 (2026-09-17 review): an unlinked movement (no `linkedReferral` at all) used
            // to leave `history` as an empty string — a blank field reads as "nothing to say" on a
            // community team's own screen, not as "this system holds no record", the actual state
            // here. A stated absence, the same discipline `suburb`'s own `{ kind: "unknown", reason:
            // "not_known" }` above already holds to for the identical "movement carries no linked
            // referral" case. Never applied when a linked referral exists, even one whose own
            // `history` happens to be empty — that is a real referral's own recorded fact, not this
            // event's to overwrite.
            history: linkedReferral
              ? linkedReferral.history
              : "Referred from the emergency department; no written referral history was recorded.",
          };

      // F10 (Opus adversarial review, 2026-09-17): wording corrected to the plan's own §4 text —
      // "{ED} referred a patient for community follow-up: referral {id}." — rather than a sentence
      // this task invented independently. Finding 3: reusing an existing queued arm says so, rather
      // than reading as a second, brand-new referral to the same team.
      const communityNotice = makeNotice(
        event.now,
        withoutPulledBed.notices.length,
        "community_referral_received",
        { role: "community", placeId: communityTeamSlug(event.team) },
        { movementId: movement.id, referralId },
        existingQueuedArm
          ? `${originEd?.name ?? "Emergency Department"} referred a patient for community follow-up: reusing the existing queued referral ${referralId} rather than raising a second one to the same team.`
          : `${originEd?.name ?? "Emergency Department"} referred a patient for community follow-up: referral ${referralId}.`,
      );

      // F5 (Opus adversarial review, 2026-09-17): this used to leave `referredUnitIds` and
      // `acceptedUnitId` untouched — a movement referred to a community team while still showing
      // as queued or accepted at a ward, which is exactly the phantom-occupant shape
      // `WITHDRAW_REFERRAL` already exists to prevent for its own case. Unwound the same way here:
      // any live requests are withdrawn (recorded, not silently dropped — but with its own
      // `ed_outcome_recorded` reason, 2026-09-17: the department recorded an outcome here, it did
      // not withdraw a live referral the way `WITHDRAW_REFERRAL`'s own branches do), and an
      // accepting ward is told it is no longer getting this patient, same as `WITHDRAW_REFERRAL`'s
      // post-acceptance branch.
      const acceptingUnitId = movement.acceptedUnitId;
      // P1-4 (Ward Lead audit, 2026-09-17): captured before `updated` overwrites it, the same
      // read-before-write discipline `acceptingUnitId` immediately above already holds to. Neither
      // the officer nor a ward still holding a live (unaccepted) request was ever told this journey
      // had ended — the same gap `RECORD_ED_OUTCOME`'s own P1-4 fix closes, above.
      const hadLiveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      // Truthful cause: the department recorded an outcome that ends the bed search, not the
      // referrer withdrawing (`WithdrawalReason.ed_outcome_recorded`, `ward-change-reasons.ts`).
      const withdrawnLiveRequests = movement.referredUnitIds.map((unitId) => ({
        unitId,
        at: event.now,
        reason: "ed_outcome_recorded" as const,
      }));
      const updated: Movement = {
        ...movement,
        admissionId: undefined,
        acceptedUnitId: undefined,
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawnLiveRequests],
        edOutcome: "for_community_follow_up",
        transport:
          movement.transport && movement.transport.cancelledAt === undefined
            ? { ...movement.transport, cancelledAt: event.now }
            : movement.transport,
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: event.reason ?? `Referred to community mental health team: ${event.team}`,
        },
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };

      const withMovement = replaceMovement(withoutPulledBed, movement.id, updated);
      // Finding 3: no `newReferral` at all when reusing an existing queued arm — the linked
      // referral's own array is left exactly as it was, never a second arm appended beside it.
      const withReferral: WardFlowState =
        newReferral === undefined
          ? withMovement
          : {
              ...withMovement,
              referrals: [...withMovement.referrals, newReferral],
              frontDoorReferralSequence: sequence,
            };
      const notices: Notice[] = [communityNotice];
      let noticeCount = withoutPulledBed.notices.length + 1;
      if (acceptingUnitId !== undefined) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "referral_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            `The referral for ${movement.id} was referred to a community team instead; the patient is no longer coming.`,
          ),
        );
      }
      // P1-4: the officer's half, the same "job cancelled, nothing rebooked" shape
      // `CANCEL_TRANSPORT`'s own notice and `RECORD_ED_OUTCOME`'s P1-4 fix (above) already hold to.
      if (hadLiveTransportJob) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "transport_cancelled_officer",
            { role: "officer" },
            { movementId: movement.id },
            `Transport for ${movement.id} was cancelled (referred to a community team instead); no bed is held and nothing has been rebooked.`,
          ),
        );
      }
      // P1-4: every ward still holding a live, unaccepted request is told it is not being asked any
      // more — `WITHDRAW_WARD_REQUEST`'s own `ward_request_withdrawn` shape, reused rather than
      // duplicated (`ward-model.ts`'s own `NoticeKind` doc comment on that kind).
      for (const unitId of movement.referredUnitIds) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "ward_request_withdrawn",
            { role: "ward", placeId: unitId },
            { movementId: movement.id, unitId },
            `The request for ${movement.id} was withdrawn: referred to a community team instead.`,
          ),
        );
      }
      return appendNotices(withReferral, notices);
    }

    case "RECORD_LEFT_DEPARTMENT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.leftDepartmentAt !== undefined) {
        return reject(state, event, `movement ${movement.id} has already been recorded as left department`);
      }
      if (movement.edOutcome === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has no ed outcome recorded; record an outcome before marking left department`,
        );
      }
      const updated: Movement = {
        ...movement,
        leftDepartmentAt: event.now,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_EXAMINATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Defence in depth, added 2026-08-24. Every other movement-scoped handler already refuses a
      // closed movement; this one did not, so an examination could be recorded against a patient
      // who had already ARRIVED and its `did_not_proceed` closure would overwrite the arrival —
      // reproduced by walking WF-001 to `arrived` and dispatching a `revoked` examination, which
      // was accepted with zero rejections. Pre-existing (it was previously reachable only for a
      // Form 1A) and widened by this change to every code and to no form at all. Not reachable
      // from the ED screen today, which lists only open movements, so this closes the reducer
      // path rather than a live defect.
      if (movement.closure) {
        return reject(state, event, `cannot record an examination for a closed movement (${movement.closure.reason})`);
      }
      // No form gate. An examination may be recorded for ANY patient, whatever form they carry
      // and whether or not they carry one (product owner, 2026-08-24) — the software no longer
      // decides which form a patient is on, so it has no business deciding who may be examined.
      // The guard below is different in kind and stays: recording two examinations against one
      // movement is a data-integrity fault, not a form rule.
      //
      // 🔴 Owner item 7 (2026-09-17): *"a repeat examination is a new record, with a 'further
      // examination ordered' outcome."* A second examination is refused UNLESS the current
      // record's own outcome is `"further_examination_ordered"` — the one outcome that settles
      // nothing and exists only to say a repeat is coming. Superseding APPENDS the current record
      // to `supersededExaminations` rather than discarding it, so the movement never loses the
      // fact that an earlier examination happened; every write below carries `supersededExaminations`
      // through unchanged when there is nothing new to append.
      const previousExamination = movement.examination;
      if (previousExamination && previousExamination.outcome !== "further_examination_ordered") {
        return reject(state, event, `movement ${movement.id} was already examined`);
      }
      const supersededExaminations = previousExamination
        ? [...(movement.supersededExaminations ?? []), previousExamination]
        : movement.supersededExaminations;

      if (event.outcome === "inpatient_order" || event.outcome === "further_examination_ordered") {
        // Both are recorded and NOTHING else changes. `"further_examination_ordered"` closes
        // nothing and refunds nothing (owner item 7) — the same "record and stop" shape
        // `"inpatient_order"` already had, which is why they share a branch. The 1A-to-3B
        // replacement that used to happen here for `"inpatient_order"` is deleted: a form now
        // changes only when a clinician changes it.
        const updated: Movement = {
          ...movement,
          examination: { at: event.now, outcome: event.outcome },
          supersededExaminations,
        };
        return replaceMovement(state, movement.id, updated);
      }

      /*
       * 🔴 WLQ-4 (owner, 2026-09-15): *"a revoked examination after transport is booked or the
       * patient is moving does NOT release the bed."* Before this, the `pulledStages` refund just
       * below fired for `handover_ready` and `moving` exactly as it did for `pulled` — refunding
       * `unit.allocatable` while the admission-deletion half (scoped to `pulled` only, see its own
       * comment further down) did NOT run at those two stages, so the unit's own count said the bed
       * was free while an `Admission` still stood — a PHANTOM OCCUPANT, the same shape
       * `RELEASE_PULL`'s own fix already closed for a different event.
       *
       * The owner's answer here is not "also delete the admission at those stages" (extending the
       * `pulled`-only fix would still be an AUTOMATIC release, which is exactly what he refused);
       * it is "do neither automatically once transport is already committed" — refunding the bed
       * and cancelling the job are both judgements about a moving vehicle and an occupied admission
       * that only a coordinator should make once transport has progressed this far.
       *
       * So at `handover_ready` and `moving`: the bed is NOT refunded, the admission is NOT deleted,
       * and `movement.transport` is left completely untouched — no `cancelledAt`. The examination
       * is still RECORDED, because it is a real clinical fact, but `movement.closure` is
       * DELIBERATELY NOT SET. Closing here would be the one thing that actually builds a dead end:
       * `STEP_BACK_STAGE` and `RELEASE_PULL` both refuse a closed movement as their own first guard
       * (so does `CANCEL_TRANSPORT`), so a closed-but-flagged movement could never be acted on
       * again by anybody. Leaving it open is what keeps the coordinator's release path reachable:
       * `STEP_BACK_STAGE` to `pulled` (touches nothing but `stage` — its own doc comment), then
       * `RELEASE_PULL` (valid again once stage is `pulled`), which refunds the bed and deletes the
       * admission exactly as it already does for any other pulled bed. `CANCEL_TRANSPORT` is also
       * reachable at `handover_ready` (not at `moving`, where `transport.collectedAt` is always set
       * — see `PATIENT_COLLECTED` — and `CANCEL_TRANSPORT`'s own guard already refuses that), and
       * lets the coordinator formally unwind the errant booking, though it is not required for the
       * release itself. Proved end to end in `tests/ward-flow-reducer.test.ts`'s own WLQ-4 block.
       *
       * ✅ **TRANSPORT PATHWAY (2026-09-20):** `TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE`
       * and `PATIENT_COLLECTED` now refuse while this flag (or a revoked/community_order examination
       * still holding a bed) is unresolved. `PATIENT_ARRIVED` stays reachable by owner answer 5
       * (second round, 2026-09-17) so a ward can still record physical arrival if it already happened.
       *
       * ⚠️ **ALSO ESTABLISHED, NOT ASSUMED: `RECORD_EXAMINATION` cannot run at all once a patient
       * has ARRIVED.** `PATIENT_ARRIVED` unconditionally sets `movement.closure` (outcome
       * `"arrived"`), and this case's own first guard refuses any closed movement — so the window
       * this branch exists for is exactly `handover_ready` and `moving`, never `arrived`.
       *
       * 🔴 WFA-004: `STEP_BACK_STAGE` can move the stage label back to `pulled` while leaving
       * `transport.collectedAt` set — physical collection is not erased by a stage correction.
       * Retention therefore also keys off `collectedAt`, not stage alone.
       */
      const patientPhysicallyCollected = movement.transport?.collectedAt !== undefined;
      const transportAlreadyCommitted =
        patientPhysicallyCollected || movement.stage === "handover_ready" || movement.stage === "moving";
      if (transportAlreadyCommitted) {
        const flagged: Movement = {
          ...movement,
          examination: { at: event.now, outcome: event.outcome },
          supersededExaminations,
          blocker: STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease,
        };
        const next = replaceMovement(state, movement.id, flagged);
        // Item 48, Q3 (owner, 2026-09-17): the accepting ward is told, but only for a `"revoked"`
        // examination — the owner named that outcome alone, not its sibling `"community_order"`,
        // which also reaches this branch — and only when there is an accepting ward to tell.
        if (event.outcome !== "revoked" || movement.acceptedUnitId === undefined) return next;
        return appendNotices(next, [
          makeNotice(
            event.now,
            state.notices.length,
            "examination_revoked_ward",
            { role: "ward", placeId: movement.acceptedUnitId },
            { movementId: movement.id, unitId: movement.acceptedUnitId },
            `The examination for ${movement.id} was revoked after transport was booked. The bed stays held until a person decides whether to release it.`,
          ),
        ]);
      }

      // community_order or revoked at any OTHER stage (in practice, `pulled` — the branch above
      // returns first for `handover_ready`/`moving`, and an earlier stage never carries a pulled
      // bed to refund): the patient does not proceed to an inpatient bed, so the record closes.
      // The form is deliberately LEFT AS IT IS — clearing it here was one of the three hidden
      // rules deleted on 2026-08-24. Everything else this closure does is unaffected and
      // load-bearing: it has to unwind whatever downstream placement state the movement was
      // carrying — an in-flight transport job and a bed already pulled at the accepted unit —
      // rather than leaving both dangling: every downstream handler below now also rejects once
      // `movement.closure` is set (the same signal `isOpenMovement` in ward-derivations.ts already
      // treats as authoritative), but that only stops *further* progress; it does not by itself
      // give back capacity already reserved by an earlier PULL_PATIENT.
      //
      // 🔴 T7 (2026-09-17): now calls the shared `releasePulledBedAndAdmission` (this file,
      // above) instead of refunding the unit and deleting the phantom admission inline** — the
      // same helper `RELEASE_PULL` and the other release paths already share, so there is exactly
      // one place that knows how to give a pulled bed back (see that function's own doc comment
      // for the OR condition it checks and why). Its OR is `stage === "pulled" || "handover_ready"
      // || "moving" || admissionId !== undefined`; the last two stages are never true here, because
      // the `transportAlreadyCommitted` branch above already returned for both, so the net effect
      // on this branch is identical to the inline `holdsBed` check it replaces (`stage === "pulled"
      // || admissionId !== undefined`). The helper only touches `state.units`, `state.admissions`
      // and `state.dischargeRevisions` — this movement's own `admissionId` is still cleared below
      // whenever the helper would have released (any pre-collection hold, including a stage
      // correction back past `pulled` that left `admissionId` standing — WFA-004).
      const withoutPulledBed = releasePulledBedAndAdmission(state, movement, event.now);
      const updated: Movement = {
        ...movement,
        examination: { at: event.now, outcome: event.outcome },
        supersededExaminations,
        transport:
          movement.transport && movement.transport.cancelledAt === undefined
            ? { ...movement.transport, cancelledAt: event.now }
            : movement.transport,
        closure: { at: event.now, outcome: "did_not_proceed", reason: `examination outcome ${event.outcome}` },
        // Same reasoning as `WITHDRAW_REFERRAL`'s own closure: the movement is over, so nothing is
        // holding it up.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
        // The record deleted above (inside the shared helper) is being un-joined here — a
        // surviving id pointing at a deleted admission is the dangling reference this fix is
        // about. Cleared whenever we are on this auto-release branch (post-collection retains
        // above); stage alone must not keep a stale join after a step-back.
        admissionId: undefined,
      };
      const next = replaceMovement(withoutPulledBed, movement.id, updated);
      // Item 48, Q3 (owner, 2026-09-17): the accepting ward's other branch — the bed has already
      // been given back by `releasePulledBedAndAdmission` above, so the sentence says so, rather
      // than reusing the "stays held" wording the `transportAlreadyCommitted` branch above sends.
      // Same "revoked" only, same "no accepting ward, no notice" guard as that branch.
      if (event.outcome !== "revoked" || movement.acceptedUnitId === undefined) return next;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "examination_revoked_ward",
          { role: "ward", placeId: movement.acceptedUnitId },
          { movementId: movement.id, unitId: movement.acceptedUnitId },
          `The examination for ${movement.id} was revoked. The patient is not coming and the bed has been released.`,
        ),
      ]);
    }

    case "REFER_TO_UNITS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot refer a closed movement (${movement.closure.reason})`);
      }
      /*
       * RA1 (item 18, owner answer 18, 2026-09-17): re-referring ADDS wards and never silently
       * drops one already live. `referredUnitIds` used to be REPLACED wholesale by `event.unitIds`
       * — a re-referral that omitted a previously-referred ward dropped it with no record at all,
       * and rewrote `referredAt` every time regardless. `liveUnitIds` is the standing set nothing
       * below may lose; `newUnitIds` is the caller's own list minus whatever is already live — only
       * THESE enter the eligibility gate and the cap check, so an already-live ward (the shortlist
       * panel's own pre-selected, locked candidates) is neither re-checked nor double-counted.
       */
      const liveUnitIds = movement.referredUnitIds;
      const newUnitIds = event.unitIds.filter((unitId) => !liveUnitIds.includes(unitId));
      // The cap now counts LIVE plus NEW, never `event.unitIds.length` alone — three wards already
      // live plus one addition is four, over the cap of three, whether or not the caller re-sent
      // the three live ids alongside the new one.
      const combinedCount = liveUnitIds.length + newUnitIds.length;
      if (combinedCount > state.configuration.parallelReferralCap) {
        return reject(
          state,
          event,
          `cannot refer to ${combinedCount} units at once — the parallel cap is ${state.configuration.parallelReferralCap}`,
        );
      }
      if (!REFERRABLE_MOVEMENT_STAGES.includes(movement.stage)) {
        return reject(
          state,
          event,
          `cannot refer a movement at its current stage (${stageCopy[movement.stage].label})`,
        );
      }
      const unknown = newUnitIds.find((unitId) => !findUnit(state, unitId));
      if (unknown) {
        return reject(state, event, `no unit found for id ${unknown}`);
      }
      // Membership-checked, not truthiness-checked -- the same discipline as every other reason
      // in this reducer. A caller sending a reason outside the list is refused rather than having
      // an unrecognised string written into an accountability record.
      if (event.overrideReason !== undefined && !OVERRIDE_REASONS.includes(event.overrideReason)) {
        return reject(state, event, `REFER_TO_UNITS overrideReason must be chosen from OVERRIDE_REASONS`);
      }
      /*
       * 🔴 T12 (item 9, owner answer 9): A `Non-binary` MOVEMENT MAY BE REFERRED ONLY TO UNITS A
       * COORDINATOR HAS ALREADY CHECKED WITH THE WARD FOR, OR IS CHECKING RIGHT NOW.
       *
       * Runs BEFORE the per-ward eligibility loop below and refuses the WHOLE event rather than
       * holding back individual wards — this is a PROCEDURAL requirement, never a bed-suitability
       * judgement a ward-specific reason can buy past (`GenderPlacement`'s own doc comment,
       * `ward-model.ts`, explains why this is not an `Override`).
       *
       * ⚠️ **NO ROLE CHECK HERE, AND THAT IS NOT A GAP.** `EVENT_ROLE.REFER_TO_UNITS` is already
       * `["coordinator"]`, enforced before this `switch` even runs (`event.role` cannot be
       * anything else by the time this line executes) — a second check here would be dead code
       * asserting a fact the dispatcher already guarantees. "Ward and ED staff cannot bypass it"
       * (owner answer 9) is real, but it is enforced on `ACCEPT_REFERRAL` below, which — unlike
       * this event — a ward or an ED role can actually reach.
       */
      let genderPlacementAddition:
        | {
            at: Instant;
            by: WardFlowRole;
            unitIds: string[];
            reason: (typeof GENDER_PLACEMENT_REASONS)[number];
            wardChecked: true;
          }
        | undefined;
      // R7 (owner ruling, 25 September 2026): widened from `"Non-binary"` alone to any gender or
      // recorded sex that is not female or male, including not recorded (`genderReviewNeeded`).
      if (genderReviewNeeded(movement.gender, movement.sex)) {
        const uncovered = newUnitIds.filter(
          (unitId) => !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(unitId)),
        );
        if (uncovered.length > 0) {
          if (event.genderPlacementReason === undefined || event.genderPlacementChecked !== true) {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (!GENDER_PLACEMENT_REASONS.includes(event.genderPlacementReason)) {
            return reject(
              state,
              event,
              `REFER_TO_UNITS genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS`,
            );
          }
          genderPlacementAddition = {
            at: event.now,
            by: event.role,
            unitIds: uncovered,
            reason: event.genderPlacementReason,
            // The event's own `genderPlacementChecked` field is `true` exactly here (validated
            // two lines up) — `wardChecked` stores that fact on the RECORD, per `GenderPlacement`'s
            // own doc comment on `ward-model.ts`, rather than leaving it implied by the reason text.
            wardChecked: true,
          };
        }
      }

      /*
       * ⚠️ THE ELIGIBILITY GATE, PER WARD — and this event is NOT the same shape as the other two.
       * It carries a LIST of wards, so "refuse if ineligible" had to be decided rather than copied.
       *
       * OWNER'S RULING, 2026-09-02, choosing between three options he was given:
       * **the suitable wards proceed; an unsuitable one is HELD BACK unless a reason is given for
       * it.** Per ward, never per referral.
       *
       * He rejected refusing the whole referral — that punishes a four-ward search for one bad
       * entry, which is how a system teaches people to stop using it. He rejected one reason
       * covering the whole list — that would wave through wards nobody looked at.
       *
       * ⚠️ A HELD-BACK WARD IS RECORDED, NEVER SILENTLY DROPPED. The coordinator asked for it and
       * must be told it did not happen; a referral that quietly goes to three of four wards is the
       * silent-failure shape this reducer already carries a warning about. So each held-back ward
       * appends its own rejection naming its own failing gate, and the referral proceeds with the
       * rest. If EVERY ward is held back, nothing is referred and the movement does not move.
       *
       * RA1: runs over `newUnitIds` ONLY. An already-live ward already passed this gate the moment
       * it was first referred; re-running it here on every re-referral could silently drop a live
       * referral the instant a ward's own capacity changed — exactly the silent loss item 18 exists
       * to end. A live ward is carried forward unconditionally, below.
       */
      const targets: NonNullable<AuditDecision["targets"]>[number][] = [];
      decision.targets = targets;
      const heldBack: string[] = [];
      const permitted: string[] = [];
      // 🔴 Owner reversal, item 2: `genderPlacementAddition` above is the record THIS event is
      // about to write, not yet on `movement` — the per-unit `gender_designation` gate must see it
      // now, in the same act, or a coordinator could never clear a single-gender ward's designation
      // gate and the placement gate in one act. Never persisted from here; `updated` below still
      // computes the real, committed `genderPlacements` independently.
      const movementForEligibility: Movement =
        genderPlacementAddition === undefined
          ? movement
          : { ...movement, genderPlacements: [...(movement.genderPlacements ?? []), genderPlacementAddition] };
      for (const unitId of newUnitIds) {
        const candidate = findUnit(state, unitId);
        const refusal = candidate ? eligibilityRefusal(event, movementForEligibility, candidate, event.now) : null;
        targets.push({
          unitId: uniqueRecord(state.units, unitId)?.id ?? null,
          outcome: refusal ? "denied" : "accepted",
          reasonCode: refusal ? "transition" : "none",
        });
        if (refusal) heldBack.push(refusal);
        else permitted.push(unitId);
      }
      const withHeldBack = heldBack.reduce((carried, refusal) => reject(carried, event, refusal), state);
      // Refuse loudly when something NEW was attempted and every one of it was held back — but a
      // caller that attempted nothing new (every id already live) has nothing to fail, so that
      // case falls through to the harmless re-assertion below rather than a refusal about zero
      // wards.
      if (newUnitIds.length > 0 && permitted.length === 0) return withHeldBack;

      // Re-referral: this movement is ALREADY at `destination_review`, so adding wards is not a
      // fresh transition — see the `stageChanges` field below.
      const isReReferral = movement.stage === "destination_review";

      const updated: Movement = {
        ...movement,
        // RA1: the union of what was already live and what just got through the gate — never a
        // replacement. Order keeps every live ward's own position stable and appends new ones after.
        referredUnitIds: [...liveUnitIds, ...permitted],
        // Owner instruction 2026-09-02, RA1-preserved: the FIRST referral's own moment, never
        // rewritten by a later re-referral — every seeded movement still carries none, and a row
        // without it goes on saying so rather than borrowing `openedAt`.
        referredAt: movement.referredAt ?? event.now,
        // OD-3: the reason is KEPT. It used to live in the shortlist panel's own `useState` and be
        // discarded on the next selection, while the governance page said override reasons were
        // recorded. Appended rather than replaced, because a movement can be overridden more than
        // once and the earlier one is not undone by the later.
        overrides:
          event.overrideReason === undefined
            ? movement.overrides
            : [
                ...movement.overrides,
                {
                  at: event.now,
                  by: WARD_FLOW_ROLE_LABELS[event.role],
                  reason: event.overrideReason,
                  // The NEWLY added wards this call actually referred to, not the wards asked for and
                  // never a ward already live — an accountability record names what THIS act did.
                  unitIds: [...permitted],
                },
              ],
        // T12 (item 9): narrowed to the units this call ACTUALLY referred to (`permitted`), the
        // same discipline `overrides.unitIds` immediately above holds to — a unit held back by
        // eligibility was never referred, so recording it here would be a false "checked and
        // referred" claim.
        genderPlacements:
          genderPlacementAddition === undefined
            ? movement.genderPlacements
            : [
                ...(movement.genderPlacements ?? []),
                {
                  ...genderPlacementAddition,
                  unitIds: genderPlacementAddition.unitIds.filter((unitId) => permitted.includes(unitId)),
                },
              ].filter((record) => record.unitIds.length > 0),
        stage: "destination_review",
        // The creation value, "Awaiting coordinator referral", stops being true at exactly this
        // line — the coordinator has now referred. Restated unconditionally, including on a
        // re-referral: adding a ward is new information that can contradict a standing sentence
        // like `wardRequestWithdrawn` ("No ward is being asked") or a stale human note — see
        // `STAGE_TRANSITION_BLOCKERS`'s own comment on when this table restates.
        blocker: STAGE_TRANSITION_BLOCKERS.referred,
        // RA1: a re-referral adds wards without a fresh stage transition — the movement was already
        // at `destination_review`, so nothing here CHANGED that a new entry would record. `DECLINE`
        // appends unconditionally because it marks a distinct clinical fact (a ward said no) at the
        // moment it happens; a re-referral repeats the SAME fact ("referrals are live") the first
        // referral already recorded once. `ward-movement-stage-changes.test.ts`'s "every derived
        // case appends exactly one entry" floor is proved against the FIRST referral only, which
        // still transitions from `placement_requested` and still appends exactly one.
        stageChanges: isReReferral
          ? movement.stageChanges
          : [
              ...movement.stageChanges,
              { at: event.now, from: movement.stage, to: "destination_review", by: event.role },
            ],
      };
      // `withHeldBack`, not `state` — any ward refused above must survive into the returned state,
      // or the coordinator is told nothing and the referral silently shrank.
      decision.outcome = heldBack.length ? "partial" : "accepted";
      decision.reasonCode = heldBack.length ? "transition" : "none";
      decision.overrideFactRecorded = event.overrideReason !== undefined;
      return replaceMovement(withHeldBack, movement.id, updated);
    }

    case "ACCEPT_IN_PRINCIPLE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept a closed movement (${movement.closure.reason})`);
      }
      if (movement.acceptedUnitId) {
        const already = findUnit(state, movement.acceptedUnitId);
        const attemptedUnit = findUnit(state, event.unitId);
        return reject(
          state,
          event,
          `movement ${movement.id} is already accepted at ${already?.name ?? movement.acceptedUnitId}; the referral to ${attemptedUnit?.name ?? event.unitId} was withdrawn`,
        );
      }
      if (movement.stage !== "destination_review") {
        return reject(
          state,
          event,
          `cannot accept a movement at its current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      const acceptedUnit = findUnit(state, event.unitId);
      if (!acceptedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);

      // T12 (item 9): `ACCEPT_IN_PRINCIPLE` never WRITES a gender-placement record — only
      // `REFER_TO_UNITS` does, at the moment the coordinator chose these wards — it only refuses
      // when nothing on the movement already names this unit. See `GenderPlacement`'s own doc
      // comment (`ward-model.ts`) for why this cannot be bought past with a reason here.
      if (
        genderReviewNeeded(movement.gender, movement.sex) &&
        !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(event.unitId))
      ) {
        return reject(state, event, GENDER_PLACEMENT_REFUSAL);
      }

      /*
       * ⚠️ THE ELIGIBILITY GATE — and this is the event that most needed it. `ACCEPT_IN_PRINCIPLE`
       * is the ward saying yes to a bed, the closest thing on the movement path to a placement, and
       * before the owner's 2026-09-02 ruling it ran NO eligibility check of any kind — only a
       * `referredUnitIds` membership test. See `eligibilityRefusal` for the four-row contract and
       * for why the override is not a loophole.
       */
      const acceptRefusal = eligibilityRefusal(event, movement, acceptedUnit, event.now);
      if (acceptRefusal) return reject(state, event, acceptRefusal);
      // An override is filed here only when it is NEW: a gate genuinely fails for this unit, and no
      // override already on the movement covers it. A reason against a unit that passes every gate
      // bought nothing (the rule `referralAcceptanceRefusal` follows), and the override that
      // REFER_TO_UNITS filed for this unit already accounts for the acceptance, as PULL_PATIENT
      // relies on. 6eec76bd85 filed one on every supplied reason (tests/ward-audit.test.ts).
      const overrideApplied =
        event.overrideReason !== undefined &&
        !eligibility(movement, acceptedUnit, event.now).eligible &&
        !movement.overrides.some((override) => override.unitIds.includes(event.unitId));

      const withdrawn = movement.referredUnitIds
        .filter((unitId) => unitId !== event.unitId)
        .map((unitId) => ({
          unitId,
          at: event.now,
          // 🔴 FD-23, and TWO defects in one string. It read `withdrawn — placed at
          // ${acceptedUnit.name}`, and the ward page renders this field verbatim — so the LOSING
          // ward read the WINNER's name out of the record of its own loss. The second defect
          // survives the first fix: "placed" asserts a transfer that has not happened, because
          // this event leaves the movement at `accepted_awaiting_bed`. A code, never a sentence:
          // see WITHDRAWAL_REASONS. The coordinator reads `acceptedUnitId` for the destination.
          reason: "another_unit_accepted" as const,
        }));

      const updated: Movement = {
        ...movement,
        acceptedUnitId: event.unitId,
        // OD-3 (2026-09-02): an overridden acceptance is made accountable, never impossible — the
        // reason that bought the gate past is recorded, exactly as REFER_TO_UNITS records its own.
        overrides:
          overrideApplied && event.overrideReason !== undefined
            ? [
                ...movement.overrides,
                {
                  at: event.now,
                  by: WARD_FLOW_ROLE_LABELS[event.role],
                  reason: event.overrideReason,
                  unitIds: [event.unitId],
                },
              ]
            : movement.overrides,
        // Fix round 1 (Task 9): the instant this acceptance happened, recorded directly rather
        // than left to survive only as an incidental `withdrawnReferrals` side effect of a
        // multi-unit referral. See `Movement.acceptedAt`'s own doc comment.
        acceptedAt: event.now,
        stage: "accepted_awaiting_bed",
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawn],
        // Nobody is waiting on a destination response any more — one arrived. What is outstanding
        // is the bed, and that is all this sentence claims: the seed's richer "Bed being made
        // ready" is a ward's own observation and only a human may write it.
        blocker: STAGE_TRANSITION_BLOCKERS.accepted,
        // `acceptedAt` above and this entry are written together and must never diverge — see
        // `StageChange`'s doc comment: `acceptedAt` agrees with the FIRST entry with
        // `to: accepted_awaiting_bed`, which this always is on the acceptance path (RELEASE_PULL
        // later adds a SECOND one without touching `acceptedAt`, and must never rewrite it here).
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "accepted_awaiting_bed", by: event.role },
        ],
      };
      const next = replaceMovement(state, movement.id, updated);
      // Communication addendum §1.3: "the answer to the question they asked" — the referring
      // emergency department is told a ward has said yes in principle. `acceptedUnit` was already
      // resolved and gated above, so it is guaranteed to exist here.
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      decision.overrideFactRecorded = overrideApplied;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "accepted_in_principle",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: event.unitId },
          `${acceptedUnit.name} has accepted ${movement.id} in principle.`,
        ),
      ]);
    }

    /**
     * THE REFERRER TAKES THE REFERRAL BACK — the second way a referral can end, and until today
     * there was only one.
     *
     * The only writer of `withdrawnReferrals` was `ACCEPT_IN_PRINCIPLE`, so the only way a
     * referral ever ended was another unit winning it. A patient who improved, went home or went
     * elsewhere left the request live in every receiving ward's list, and nobody could say it was
     * over. That is a flow gap rather than a missing screen: the state simply had no way to exist.
     *
     * ⚠️ **IT WITHDRAWS EVERY LIVE REFERRAL AT ONCE, and that is the meaning rather than a
     * shortcut.** The referrer is saying this patient no longer needs a bed, which is true of all
     * of them or none. Withdrawing from one ward while leaving others live is a different act —
     * changing your mind about a destination, not about the admission — and it does not exist yet.
     *
     * The reason code is `referrer_withdrew` and is NOT taken from the event. `WITHDRAWAL_REASONS`
     * says adding a member is a governance decision, and the reasons a referrer would give — the
     * patient improved, went home, went elsewhere, died — are clinical facts about a person. So the
     * flow exists and the vocabulary is left to the owner.
     */
    case "WITHDRAW_REFERRAL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Already finished, by arrival or otherwise. Withdrawing a closed movement would append a
      // withdrawal to a record that has already ended, and every count derived from
      // withdrawnReferrals would then include a referral that was never live at that moment.
      if (movement.closure) {
        return reject(state, event, `movement ${movement.id} has already closed and cannot be withdrawn`);
      }

      /*
       * 🔴 WLQ-38 (owner, 2026-09-15), verbatim: *"This should also be the referring doctors
       * responsibility as well to be able to revoke the transport as well as referral in addition
       * to the coordinator."* Before this, EVERY role was refused here once `acceptedUnitId` was
       * set — "a bed has been given... undoing that is the ward's own decline, not a withdrawal by
       * the referrer." That is still true of `community` and `ward`; it is no longer true of the
       * referrer (`ed`) or the coordinator, who may now revoke an ACCEPTED referral, once, up until
       * the patient is collected — see `STOP_TRANSPORT` for the case after collection.
       *
       * This branch runs BEFORE the pre-acceptance `referredUnitIds.length === 0` guard below on
       * purpose: `ACCEPT_IN_PRINCIPLE` always empties `referredUnitIds` on acceptance, so an
       * accepted movement legitimately holds no live referral, and falling through to that guard
       * would refuse this branch's own happy path with the wrong reason.
       */
      if (movement.acceptedUnitId) {
        /*
         * ⚠️ **`ed` IS PERMITTED BY ROLE ALONE, NOT CHECKED AGAINST `movement.originEdId`.** The
         * referrer for a movement is the emergency department it began in, but this event (like
         * every other ED-raised event except `RAISE_REFERRAL` itself) carries no acting-ED
         * identity field to compare — the same absence `EVENT_ROLE.CANCEL_TRANSPORT`'s own comment
         * already names for `community` ("no event carries which community team is acting", R2, no
         * viewer identity). Widening this model to let one ED tell itself apart from another is an
         * owner decision, not an implementer's.
         */
        if (event.role !== "coordinator" && event.role !== "ed") {
          return reject(
            state,
            event,
            `movement ${movement.id} has already been accepted by ${movement.acceptedUnitId}; only the referrer or the coordinator may revoke it now`,
          );
        }
        // Once the patient has been physically collected this is a journey under way, not a
        // referral to take back — `STOP_TRANSPORT` is the event for stopping it from here.
        if (movement.transport?.collectedAt !== undefined) {
          return reject(
            state,
            event,
            `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of withdrawing the referral`,
          );
        }

        // Gives back a bed already pulled (and deletes the admission it created), or does nothing
        // if the movement is still only accepted and no bed has been pulled yet — the same shared
        // helper `RELEASE_PULL` uses, reused rather than copied. See its own doc comment.
        const withoutPulledBed = releasePulledBedAndAdmission(state, movement, event.now);
        const revokedByCoordinator = event.role === "coordinator";
        const acceptingUnitId = movement.acceptedUnitId;
        const revoked: Movement = {
          ...movement,
          admissionId: undefined,
          // A revoked acceptance holds no ward: cleared here, as RECORD_ED_OUTCOME and
          // REFER_TO_COMMUNITY_TEAM do, so no board reads a closed movement as still going to it.
          acceptedUnitId: undefined,
          // Any booked-but-not-collected job is cancelled in the same update that closes the
          // movement — the same discipline `RECORD_EXAMINATION`'s own `community_order`/`revoked`
          // branch already holds `TransportJob.cancelledAt` to (see that field's own doc comment):
          // a closing event that left a live job behind would be the phantom job `orphanedTransport`
          // (`ward-derivations.ts`) assumes can never happen once `movement.closure` is set.
          transport:
            movement.transport && movement.transport.cancelledAt === undefined
              ? { ...movement.transport, cancelledAt: event.now }
              : movement.transport,
          closure: {
            at: event.now,
            outcome: "did_not_proceed",
            reason: revokedByCoordinator
              ? "The coordinator revoked the accepted referral"
              : "The referrer revoked the accepted referral",
          },
          // Nothing is blocking a movement that is over — same reasoning as the pre-acceptance
          // path below, and it overwrites WLQ-4's `examinationRevokedAwaitingRelease` too, if that
          // was standing: the movement this revocation just closed no longer needs releasing.
          blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
        };
        const next = replaceMovement(withoutPulledBed, movement.id, revoked);
        // Communication addendum §1.3's own principle, extended by WLQ-38 (see `NoticeKind`'s own
        // doc comment for the addendum-row debt this records rather than silently drifting past):
        // a ward that believed it was getting this patient must be told it is not. `acceptingUnitId`
        // is guaranteed to resolve — it is `movement.acceptedUnitId`, read before this handler's own
        // writes touched it.
        return appendNotices(next, [
          makeNotice(
            event.now,
            state.notices.length,
            "referral_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            `The referral for ${movement.id} was revoked after being accepted; the patient is no longer coming.`,
          ),
        ]);
      }

      if (movement.referredUnitIds.length === 0) {
        return reject(state, event, `movement ${movement.id} holds no live referral to withdraw`);
      }

      const withdrawn = movement.referredUnitIds.map((unitId) => ({
        unitId,
        at: event.now,
        reason: "referrer_withdrew" as const,
      }));
      const updated: Movement = {
        ...movement,
        acceptedUnitId: undefined,
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawn],
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: "The referrer withdrew the referral",
        },
        // Nothing is blocking a movement that is over. Left saying "Awaiting destination response"
        // it would keep a withdrawn patient looking like a live obstruction.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "WITHDRAW_WARD_REQUEST": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot withdraw a ward request for a closed movement (${movement.closure.reason})`,
        );
      }
      // Membership, not truthiness — the same discipline `DECLINE`/`ACCEPT_IN_PRINCIPLE` already
      // hold to for `referredUnitIds`. An already-accepted, already-declined or already-withdrawn
      // unit holds no live referral to take back.
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      if (!WARD_REQUEST_WITHDRAWAL_REASONS.includes(event.reason)) {
        return reject(state, event, `WITHDRAW_WARD_REQUEST reason must be chosen from WARD_REQUEST_WITHDRAWAL_REASONS`);
      }

      const remainingUnitIds = movement.referredUnitIds.filter((unitId) => unitId !== event.unitId);
      const updated: Movement = {
        ...movement,
        referredUnitIds: remainingUnitIds,
        // `reason` says WHO — a role, never a person, the same discipline `another_unit_accepted`/
        // `referrer_withdrew` already hold to. `detail` says WHY, from the coordinator's own §2
        // pick — never folded into `reason`, which stays a closed three-member union.
        withdrawnReferrals: [
          ...movement.withdrawnReferrals,
          { unitId: event.unitId, at: event.now, reason: "coordinator_withdrew", detail: event.reason },
        ],
        // RA1: withdrawing one ward while others stay live touches `blocker` not at all —
        // `STAGE_TRANSITION_BLOCKERS.referred` is still true while any live request stands. Only
        // the LAST one going sets the new sentence: nothing is currently asking, and the
        // coordinator must refer again before anyone is.
        blocker: remainingUnitIds.length === 0 ? STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn : movement.blocker,
      };
      const next = replaceMovement(state, movement.id, updated);
      // Addendum §1.3's own principle, extended by RA1: a ward that was holding a live request must
      // be told it is not being asked any more — the same "a party learns they are not coming/not
      // needed" shape `CANCEL_TRANSPORT`'s ward half and `WITHDRAW_REFERRAL`'s WLQ-38 half already
      // carry. Addressed to the one ward named, never to every referred ward.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "ward_request_withdrawn",
          { role: "ward", placeId: event.unitId },
          { movementId: movement.id, unitId: event.unitId },
          `The request for ${movement.id} was withdrawn: ${wardRequestWithdrawalReasonLabels[event.reason]}.`,
        ),
      ]);
    }

    case "PULL_PATIENT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot pull a bed for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "accepted_awaiting_bed") {
        return reject(
          state,
          event,
          `cannot pull a bed at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (movement.acceptedUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `movement ${movement.id} was accepted at ${movement.acceptedUnitId ?? "no unit"}, not ${event.unitId}`,
        );
      }
      // P1-3 (Ward Lead ruling, 17 September 2026): was the T12 (item 9) non-binary-only check
      // alone — "the same defence `ACCEPT_IN_PRINCIPLE` already holds, checked again here rather
      // than trusted from that earlier step". `heldUnitGenderRefusal` now covers that AND the
      // binary `gender_designation` gate, because by the time a movement reaches `PULL_PATIENT` it
      // is already accepted (`movement.acceptedUnitId` set, matched against `event.unitId` above),
      // so EITHER gender judgement failing here means a correction landed after acceptance, not a
      // front-door mismatch — see that function's own doc comment for why the wording differs from
      // `eligibilityRefusal`'s.
      const heldGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (heldGenderRefusal) return reject(state, event, heldGenderRefusal);
      /*
       * A MOVEMENT THAT STILL HOLDS A BED IS RESTORED TO `pulled`, NEVER GIVEN A SECOND BED.
       * `STEP_BACK_STAGE` keeps the bed and `admissionId` by design (rulings E/F), so a movement
       * stepped back from `pulled` arrives here still holding both. Before 2026-09-14 this handler
       * took another bed and orphaned the first admission; the next fix refused outright, which left
       * the patient holding a bed with no way forward. Owner decision 2026-09-15: pulling again
       * restores the pull on the bed already held.
       *
       * Runs BEFORE every capacity and eligibility check, deliberately: nothing is consumed, and the
       * held admission is itself one of the places those checks count, so re-asking them would refuse
       * a patient for occupying their own bed.
       */
      if (movement.admissionId !== undefined) {
        const held = state.admissions.find((admission) => admission.id === movement.admissionId);
        if (!held || held.unitId !== event.unitId) {
          return reject(
            state,
            event,
            `movement ${movement.id} points at admission ${movement.admissionId}, which is not a bed held at ${event.unitId}; it cannot be restored or pulled again`,
          );
        }
        const restoreUnit = findUnit(state, event.unitId);
        if (!restoreUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
        // Second pull re-runs one-to-one and acuity checks and does not count this person's own held bed.
        const admissionsExcludingOwn = state.admissions.filter((admission) => admission.id !== movement.admissionId);
        const speciallingAnsweredRestore =
          event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
        if (
          !speciallingAnsweredRestore &&
          movement.specialling &&
          remainingSpeciallingCapacity(restoreUnit, admissionsExcludingOwn) <= 0
        ) {
          return reject(
            state,
            event,
            `${restoreUnit.name} has no one-to-one specialling capacity left; this patient needs specialling and the ward cannot staff another`,
          );
        }
        const acuityOverrideNeededRestore =
          movement.highAcuity && remainingHighAcuityCapacity(restoreUnit, admissionsExcludingOwn) <= 0;
        const acuityAnsweredRestore =
          event.overrideReason !== undefined &&
          OVERRIDE_REASONS.includes(event.overrideReason) &&
          event.numConsulted === true;
        if (!acuityAnsweredRestore && acuityOverrideNeededRestore) {
          return reject(
            state,
            event,
            `${restoreUnit.name} ${HIGH_ACUITY_STAFFING_REFUSAL}. This placement ${OVERRIDE_REASON_REQUIRED} and the nurse unit manager consulted.`,
          );
        }
        const restored: Movement = {
          ...movement,
          overrides: pullOverrides(movement, restoreUnit, admissionsExcludingOwn, event, false),
          stage: "pulled",
          waitlistedUnitIds: undefined,
          stageChanges: [
            ...movement.stageChanges,
            { at: event.now, from: movement.stage, to: "pulled", by: event.role },
          ],
        };
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        decision.overrideFactRecorded = restored.overrides.length > movement.overrides.length;
        return replaceMovement(state, movement.id, restored);
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      if (unit.allocatable.value <= 0) {
        /*
         * 🔴 THIS NAMED A CAUSE THE GUARD NEVER CHECKED. The parenthetical used to carry the
         * `DECLINE_REASONS` code for a bed pulled for an earlier referral — a specific cause — while
         * the guard tests only `unit.allocatable.value <= 0`.
         *
         * ⚠️ **`CONFIRM_CAPACITY` sets `allocatable.value` straight from a ward's own self-report.**
         * So: accept in principle, the ward corrects its count to zero for an unrelated reason, then
         * pull — and the software told the coordinator an earlier referral had taken the bed. **No
         * pull had happened, and they would go looking for the patient who took it.**
         *
         * 🔴 **AND NO DISCRIMINATOR EXISTS, WHICH IS WHY THE CAUSE GOES RATHER THAN GETTING A
         * CONDITION.** `allocatable.source` cannot separate the two: `PULL_PATIENT` decrements the
         * value while SPREADING the existing figure, so it preserves whatever source a prior
         * `CONFIRM_CAPACITY` set. A unit whose count reached zero by pulling still reports
         * `source: "ward"`.
         *
         * ✅ The two guards immediately below show what a scoped cause looks like when one is
         * justified — each states "ONLY WHEN X IS THE CAUSE" and checks X. This one had no such
         * reasoning and none was available.
         *
         * So it reports the fact it actually read. A refusal may restate what it checked; it may not
         * name a cause it did not.
         */
        return reject(
          state,
          event,
          `no allocatable bed remains at ${unit.name} (the ward's allocatable count is ${unit.allocatable.value})`,
        );
      }
      /*
       * ⚠️ **A PULL IS REFUSED AGAINST A BED THAT IS NOT READY.** Owner ruling, 2026-09-01:
       * *"A pull cannot occur unless the bed is actually available and open, not pending (i.e. being
       * cleaned)"*.
       *
       * **Before this line a patient could be pulled to a bed that was still being cleaned.** The
       * check above reads `allocatable`, which is the ward's own claim about what it can staff, and
       * `availableNow` reads no readiness field at all — `ward-bed-availability.ts` says so
       * deliberately, on the reasoning that a bed being prepared is still worth counting because the
       * pull takes hours anyway. **The owner has overruled that reasoning.**
       *
       * **The refusal lives HERE and not on a screen, and that is the whole point.** A test asserting
       * that a ward's page says "pending" passes against a build in which this refusal was never
       * written. The property that matters is that the state transition cannot happen.
       *
       * `availableNow` is deliberately NOT changed — he was asked whether cleaning should drop the
       * ward's number or only refuse the pull, and chose the refusal, because the ward has not changed
       * what it can staff and its figures should not lurch as cleaning starts and stops.
       */
      /*
       * ⚠️ **ONLY WHEN PREPARATION IS THE CAUSE.** Written first as `openBedsNow(...) <= 0` alone,
       * which also fired when the ward simply had no free bed — hijacking a different guard's case and
       * reporting "still being made ready (0 pending)", which is untrue and hides the real reason. It
       * broke `refuses an arrival once the unit's physically empty beds are exhausted`, which is how it
       * was caught. A refusal must state the reason that actually applies.
       */
      const pending = bedsPendingPreparation(unit.id, state.bedReleases);
      if (pending > 0 && openBedsNow(unit, state.bedReleases) <= 0) {
        return reject(
          state,
          event,
          `every free bed at ${unit.name} is still being made ready (${pending} pending); a patient cannot be pulled to a bed that is not open`,
        );
      }
      /*
       * ⚠️ **A PULL FOR SOMEBODY NEEDING ONE-TO-ONE OBSERVATION IS REFUSED WHEN THE WARD HAS
       * NOBODY LEFT TO WATCH THEM.** Owner ruling, 2026-09-01 (ruling 1 of fourteen): one-to-one
       * nursing is recorded as the ward's staffing of the bed, and `Unit.speciallingCapacity` is
       * what that recording counts.
       *
       * **Before this line the ward handed out a bed it could not staff, without limit.** The only
       * check that existed — `eligibility()`'s `specialling` gate — asks `speciallingCapacity > 0`,
       * a figure authored per unit that no reducer path has ever changed. So it could say whether a
       * ward had ANY capacity and never whether it had any LEFT: the second, third and fourth
       * one-to-one patient all passed the same gate as the first.
       *
       * **The refusal lives HERE and not only on that screen, and that is the whole point.** A test
       * asserting a ward's page shows a specialling gate passes against a build where this refusal
       * was never written — the same reasoning the pending-preparation refusal above records. The
       * property that matters is that the state transition cannot happen.
       *
       * ⚠️ **ONLY WHEN SPECIALLING IS THE CAUSE, and the guard above is the cautionary tale.** It
       * is gated on `movement.specialling` first, so an ordinary pull into a ward with no
       * one-to-one headroom left is untouched and still meets whichever guard actually applies. A
       * refusal must state the reason that really applies; naming "no bed" here, or naming
       * specialling for a movement that needs none, is a refusal that hides the real cause.
       *
       * The remaining figure is DERIVED from the beds — never a counter this handler decrements.
       * See `remainingSpeciallingCapacity`.
       */
      /*
       * 🔴 **OWNER RULING 2026-09-12 — THIS REFUSAL IS NOW ANSWERABLE BY A RECORDED REASON, AND
       * THE BED CHECK ABOVE IS NOT.** He was asked the question directly: should the staffing check
       * work like the authorisation one, or stay absolute? He ruled overridable.
       *
       * ⚠️ **HIS REASONING, WHICH IS THE SAME ONE THAT MADE `authorisation` OVERRIDABLE:** under
       * pressure the placement happens anyway, and a gate nobody can pass does not stop the
       * admission — it stops the admission being WRITTEN DOWN. An override does not permit the
       * placement; it protects the record of who took responsibility.
       *
       * 🔴 **AND THIS SEPARATES SPECIALLING FROM THE BED CHECK, WHICH THEY WERE PAIRED IN.** The
       * bed guard above is untouched and still runs FIRST and still reads no reason at all. *No
       * reason typed into a form creates a bed* remains true and remains enforced. What changed is
       * that "nobody free to watch this patient" is now treated as answerable by a named person
       * taking responsibility, the way a stale bed count was in the 2026-09-02 ruling.
       *
       * ⚠️ **MEMBERSHIP-CHECKED, NEVER TRUTHINESS-CHECKED** — the same discipline as every other
       * override site in this file. An unrecognised string must not buy past a clinical refusal;
       * it falls through to `eligibilityRefusal`, which rejects it by name.
       *
       * ✅ **THE DELIBERATE NON-EDIT: `specialling` was NOT added to `SUITABILITY_GATES`.** That
       * would have loosened a DIFFERENT question. `eligibility()`'s `specialling` gate asks whether
       * the ward has ANY capacity — a static authored figure. This check asks whether any is LEFT,
       * derived from the beds. Adding the gate name would have made the static question overridable
       * and left this one absolute: the ruling implemented in appearance only.
       */
      const speciallingAnswered = event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
      if (!speciallingAnswered && movement.specialling && remainingSpeciallingCapacity(unit, state.admissions) <= 0) {
        return reject(
          state,
          event,
          `${unit.name} has no one-to-one specialling capacity left (${unit.speciallingCapacity} staffable, all in use); this patient needs specialling and the ward cannot staff another`,
        );
      }

      /*
       * 🔴 **OWNER RULING 2026-09-10 (`docs/ward-flow/owner-decisions-2026-09-09.md` §5) —
       * HIGH-ACUITY NURSING IS ALSO A STAFFING-CAPACITY CHECK, ANSWERABLE THE SAME WAY SPECIALLING
       * IS ABOVE.** `eligibility()`'s own `acuity` gate (`ward-eligibility.ts`) can only ask whether
       * this ward is staffed for a high-acuity place AT ALL, from the authored total — it is handed
       * no admissions, so it cannot know what is LEFT. `remainingHighAcuityCapacity(unit,
       * admissions)` is the only thing that does, and until now nothing called it here: a ward
       * staffed for exactly one high-acuity place could be pulled into without limit, the identical
       * defect `remainingSpeciallingCapacity` closed one guard above.
       *
       * Mirrors the specialling guard exactly, including the override mechanism: a valid reason from
       * `OVERRIDE_REASONS` answers it, an unrecognised string does not (membership, never
       * truthiness), and `acuity` is deliberately NOT added to `SUITABILITY_GATES` — that would make
       * `eligibility()`'s static "does this ward staff any at all" question overridable, a different
       * question from this derived "is any LEFT" one.
       *
       * 🔴 **ITEM 10, OWNER ANSWERS 17 SEPTEMBER 2026 — AND THIS IS WHERE IT DIVERGES FROM
       * SPECIALLING.** A reason alone used to be enough, exactly like specialling above, and the
       * override was never written anywhere: `speciallingAnswered`'s own construction was copied
       * for acuity, but nothing on this movement's update ever touched `overrides` for either gate.
       * The owner's ruling adds a SECOND fact this one gate needs — "the nurse unit manager
       * consulted" — and requires the answer to be written down. Specialling is deliberately
       * untouched: `speciallingAnswered` above still reads a reason alone, because the owner's
       * ruling names only high-acuity staffing.
       *
       * `acuityOverrideNeeded` is captured once, here, rather than re-derived at the movement
       * update below: `remainingHighAcuityCapacity` reads `state.admissions`, which this handler
       * does not mutate before that point, so re-deriving it there would only be able to agree or
       * silently drift if that ever changed. One value, read twice, cannot drift from itself.
       */
      const acuityOverrideNeeded = movement.highAcuity && remainingHighAcuityCapacity(unit, state.admissions) <= 0;
      const acuityAnswered =
        event.overrideReason !== undefined &&
        OVERRIDE_REASONS.includes(event.overrideReason) &&
        event.numConsulted === true;
      if (!acuityAnswered && acuityOverrideNeeded) {
        return reject(
          state,
          event,
          `${unit.name} ${HIGH_ACUITY_STAFFING_REFUSAL} (${unit.highAcuityCapacity} staffable, all in use). This placement ${OVERRIDE_REASON_REQUIRED} and the nurse unit manager consulted.`,
        );
      }

      /*
       * 🔴 ITEM 11, OWNER ANSWER 11 (17 SEPTEMBER 2026): *"voluntary patients take open beds first,
       * and secure patients take locked beds first."* Read as: bed kind belongs to the REQUEST —
       * `movement.security`, not to the patient's legal status — so "voluntary" above is taken as
       * `security: "Open"`.
       *
       * ⚠️ **THIS IS A CAPACITY CHECK, NOT THE `security` SUITABILITY GATE `eligibility()` ALREADY
       * EMITS.** That gate (`ward-eligibility.ts`) asks only whether the WARD HAS ANY LOCKED BEDS AT
       * ALL (`unitHasLockedBeds`), a fact that never changes as beds fill — its own comment names the
       * residual this closes: "a Secure movement passes a mixed ward whose locked beds are all
       * occupied while its open beds are free." Before this line nothing ever asked whether one was
       * CURRENTLY FREE, and nothing ever decremented `unit.allocatableLocked` at all — `PULL_PATIENT`
       * decremented `allocatable` only, so `lockedBedsFree` overstated after every locked pull.
       *
       * Placed in the SAME capacity block as the specialling and acuity checks above, before
       * `eligibilityRefusal` — physical facts about beds, not judgements about the patient, and
       * `PULL_PATIENT` is the only event that consumes one (see `eligibilityRefusal`'s own comment
       * on why that ordering is safe).
       *
       * An Open request takes an open bed while one is free, falling back to a locked one with NO
       * override needed — a voluntary patient may be nursed in a locked bed (`eligibility()`'s own
       * `security` gate says so already). A Secure request takes a locked bed while one is free;
       * only when none is free does it need an override, and only then falls back to an open bed —
       * `bedKindTaken` below computes exactly this, once, and is read by both the refusal check and
       * the admission literal, so the two can never disagree about which kind was actually taken.
       */
      const secureBedNeeded = movement.security === "Secure";
      const noLockedBedFree = lockedBedsFree(unit) <= 0;
      const bedKindOverrideNeeded = secureBedNeeded && noLockedBedFree;
      const bedKindAnswered = event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
      if (!bedKindAnswered && bedKindOverrideNeeded) {
        return reject(
          state,
          event,
          `No locked bed is free at ${unit.name}. This placement ${OVERRIDE_REASON_REQUIRED} to use an open bed.`,
        );
      }
      const bedKindTaken: "locked" | "open" = secureBedNeeded
        ? noLockedBedFree
          ? "open"
          : "locked"
        : openBedsFree(unit) > 0
          ? "open"
          : "locked";

      /*
       * ⚠️ THE ELIGIBILITY GATE GOES LAST, AFTER EVERY EXISTING REFUSAL, and that ordering is a
       * decision rather than an accident. Ward Lead's ruling, 2026-09-02: the refusals above are
       * cheaper, more specific, and mostly about the world rather than the patient — wrong stage,
       * no allocatable bed, a bed still being prepared, no specialling staff. **A coordinator who
       * pulled at the wrong stage should be told THAT, not told about cohort.**
       *
       * ⚠️ AND IT IS WHY A RED HERE PROVES NOTHING ON ITS OWN. The specialling refusal directly
       * above fires for a patient who fails BOTH that check and an eligibility gate, and reading it
       * as "the engine now enforces eligibility" nearly closed this finding falsely. **Prove this
       * gate on a pair whose ONLY failing gate is cohort.**
       */
      const pullRefusal = eligibilityRefusal(event, movement, unit, event.now);
      if (pullRefusal) return reject(state, event, pullRefusal);

      const updatedUnit: Unit = {
        ...unit,
        allocatable: { ...unit.allocatable, value: unit.allocatable.value - 1, confirmedAt: event.now },
        // Item 11, owner answer 11 — decremented ONLY when the bed taken was one of the locked
        // ones, exactly mirroring the restore in `releasePulledBedAndAdmission`. Taking an open bed
        // leaves this untouched: the locked ones remaining are exactly as many as before.
        allocatableLocked: bedKindTaken === "locked" ? unit.allocatableLocked - 1 : unit.allocatableLocked,
      };
      /**
       * TASK 17. The patient becomes a person in a bed, and this is the line whose absence made
       * them vanish.
       *
       * Before this, arrival closed the movement and moved two numbers on the unit. `isOpen` then
       * removed the closed movement from ten surfaces, so the demonstration lost sight of somebody
       * at the exact moment it had succeeded in placing them. The bed count changed and the person
       * did not exist anywhere.
       *
       * Built in the SAME SHAPE the seed builds, so every consumer that already renders an occupant
       * renders this one too, with no second kind of occupant to learn about.
       *
       * 🔴 **R4 (`docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md`), 2026-09-17 —
       * `referralId` AND `homeRegion` USED TO BE WRITTEN `null` UNCONDITIONALLY, EVEN WHEN THE
       * MOVEMENT CARRIED A REAL, RESOLVED `referralId`.** Every runtime admission this event ever
       * built therefore had `referralId: null`, so `admissionBelongsToTeam`
       * (`community/community-derivations.ts`) — which reads exactly that field — was `false` for
       * every one of them without exception: a community team's own referred patient vanished from
       * its team page at the exact instant the ward gave them a bed. Both fields are now DERIVED
       * from `resolvedReferral` below, the same "resolve, never merely store" discipline
       * `patientId` beside them already held to, and for the identical reason `RAISE_REFERRAL`
       * refuses a dangling `referralId` rather than storing one: an id or a region that joins to
       * nothing is worse than an honest absence.
       *
       * `null` remains the correct, honest answer in exactly two cases, and each still says
       * something true rather than missing:
       *
       *   `referralId`  - `null` when the movement carries no `referralId` at all (a walk-in, or a
       *                   movement whose referral answer is `referralAbsence` instead of a link) —
       *                   this admission came from a `Movement` with no linked `Referral`, and
       *                   minting an id pointing at nothing would be worse than saying so.
       *   `homeRegion`  - `null` for the identical reason: no resolved referral means no fact to
       *                   copy. Deriving one from the origin emergency department would still be
       *                   inventing it — where somebody was admitted from is not where they live —
       *                   so a movement with no referral link gets no home region, exactly as
       *                   before. Every consumer says "home region not recorded" rather than
       *                   guessing, and the out-of-area figures skip them rather than counting them
       *                   wrongly.
       *
       * ⚠️ **`state` IS `"pulled"` AND `arrivedAt` IS `null`, AND UNTIL 2026-09-01 BOTH WERE WRONG.**
       * This record was written `state: "occupied"` with `arrivedAt: event.now` — so the instant a
       * ward gave a bed away, the system recorded that the person had ARRIVED IN IT. They had not.
       * They were usually still in an emergency department waiting for transport that had not been
       * booked yet: this event is three stages before `PATIENT_ARRIVED`.
       *
       * **Owner ruling, 2026-09-01:** *"a patient is not marked as arrived until the ward says they
       * have arrived. The pull just means the bed is allocated to them."* `PATIENT_ARRIVED` is the
       * ward saying so, and it is the only event that may write `arrivedAt`.
       *
       * **Nothing was red, and the damage was silent and one-directional.** `daysInBed` counts from
       * `arrivedAt`, so every stay begun by a pull was inflated by the whole transport delay — a
       * plausible number, never a broken one. `ADMISSION_STATES` has carried `"pulled"` and
       * `bedIsOccupied` has counted it since the day it was written; the bed is still gone from this
       * instant, so no availability figure changes. Only the claim about the PERSON does.
       *
       * `pulledAt` is `event.now`: this event IS the pull. It read `movement.transport?.collectedAt`,
       * which is a second defect of the same shape — a movement at `accepted_awaiting_bed` has no
       * transport job (`BOOK_TRANSPORT` comes two stages later), so that expression was `null` on
       * every path that could reach it, and the field it defends against overstating was simply never
       * written at all.
       */
      /*
       * D-14 / R4. Derived, never invented — the identical resolution `referralForMovement`
       * (`ward-derivations.ts`) already performs for `Movement.referralId`, inlined rather than
       * imported because `ward-derivations.ts` itself imports `REFERRABLE_MOVEMENT_STAGES` from
       * THIS file, and importing back would be a circular module edge. `undefined` when the
       * movement carries no `referralId` at all, OR when that id does not resolve to a referral
       * this state holds — the same discipline `RAISE_REFERRAL` already enforces on
       * `Movement.referralId` itself, so a dangling id can never survive onto the admission it
       * produces. Computed ONCE and shared by every field below that copies from it, so
       * `referralId`, `patientId` and `homeRegion` can never disagree about which referral (or
       * whether one) resolved.
       */
      const resolvedReferral =
        movement.referralId === undefined
          ? undefined
          : state.referrals.find((referral) => referral.id === movement.referralId);
      const admission: Admission = {
        id: `AD-ARR-${String(state.admissionSequence + 1).padStart(2, "0")}`,
        unitId: unit.id,
        // The ward's own commitment to staff this bed one-to-one, copied from the movement, where a
        // person ticked it at intake. Never derived from anything else about the patient, and the
        // only runtime writer of this field — see `Admission.specialling`.
        specialling: movement.specialling,
        // The ward's commitment of a HIGH-ACUITY PLACE to this bed, copied from the movement, which
        // carried it from the referral, where the REFERRING CLINICIAN marked it (owner ruling
        // 2026-09-10). The only runtime writer, and never derived from `specialling` beside it: a
        // ward can staff a one-to-one nurse in a bed that is not one of its high-acuity places.
        highAcuity: movement.highAcuity,
        referralId: resolvedReferral?.id ?? null,
        movementId: movement.id,
        patientId: resolvedReferral?.patientId ?? movement.patientId ?? event.patientId ?? null,
        sex: movement.sex,
        gender: movement.gender,
        // R4 — the same resolved referral `referralId` and `patientId` above already share. A home
        // region is a fact about the PERSON, carried on `Referral.homeRegion`, never invented from
        // where the movement's emergency department happens to sit. `null` for the identical reason
        // `referralId` is null: no resolved referral means no fact to copy.
        homeRegion: resolvedReferral?.homeRegion ?? null,
        // T15 (item 12): copied from the movement — which carried it from the referral this
        // journey was raised from, or from the ED's own choice, which replaces it — and `null`
        // only when nobody has recorded one at all. Never the resolved referral directly: the
        // movement is the one record `RAISE_REFERRAL` actually writes this onto, and reading the
        // referral here instead would let a diagnosis recorded on the referral AFTER this journey
        // was raised silently reach an admission that never carried it.
        tentativeDiagnosis: movement.tentativeDiagnosis ?? null,
        // Item 11, owner answer 11 — the kind of bed ACTUALLY TAKEN, computed once above and shared
        // with the refusal check and the capacity decrement, so none of the three can disagree about
        // which kind this admission holds. See `Admission.bedKind`'s own doc comment.
        bedKind: bedKindTaken,
        state: "pulled",
        pulledAt: event.now,
        arrivedAt: null,
        // Null, and it is a statement rather than a default: nobody is away at an emergency
        // department in the sense this field means — a ward sending an occupant of ITS OWN bed out
        // for a medical problem. This person has not reached the ward at all yet, which is what
        // `state: "pulled"` and a null `arrivedAt` already say.
        awayAtEmergencyDepartmentSince: null,
        expectedDischargeAt: null,
        dischargeDateMoves: 0,
        dischargeDateSetAt: null,
        dischargeDateSetBy: null,
        dischargeConfirmedAt: null,
        dischargeConfirmedBy: null,
        blockReason: null,
        leavingDestination: null,
        leftAt: null,
        followUp: null,
        careJourney: emptyCareJourney(),
        dischargeBarrier: null,
        stepDownCandidate: false,
      };

      const updatedMovement: Movement = {
        ...movement,
        stage: "pulled",
        waitlistedUnitIds: undefined,
        pullExpiresAt: event.now + state.configuration.pullHoldMinutes,
        // The join `RELEASE_PULL` needs to undo exactly this record, and `PATIENT_ARRIVED` needs to
        // mark exactly this one as having arrived. See `Movement.admissionId`.
        admissionId: admission.id,
        stageChanges: [...movement.stageChanges, { at: event.now, from: movement.stage, to: "pulled", by: event.role }],
        overrides: pullOverrides(movement, unit, state.admissions, event, true),
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      const withPerson: WardFlowState = {
        ...withUnit,
        admissions: [...withUnit.admissions, admission],
        admissionSequence: withUnit.admissionSequence + 1,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      decision.overrideFactRecorded = updatedMovement.overrides.length > movement.overrides.length;
      return replaceMovement(withPerson, movement.id, updatedMovement);
    }

    case "DECLINE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot decline for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "destination_review") {
        return reject(
          state,
          event,
          `cannot decline at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      if (event.reason === GENDER_MISMATCH_DECLINE_REASON || (event.reason as string) === "sex_mix") {
        return reject(
          state,
          event,
          `Gender mismatch does not decline a referral; it only filters which bed can be offered`,
        );
      }
      if ((WAITLIST_INSTEAD_OF_DECLINE_REASONS as readonly string[]).includes(event.reason)) {
        const waitlistedUnitIds = [...(movement.waitlistedUnitIds ?? [])];
        if (!waitlistedUnitIds.includes(event.unitId)) {
          if (waitlistedUnitIds.length >= state.configuration.parallelReferralCap) {
            return reject(
              state,
              event,
              `movement ${movement.id} is already waitlisted at ${state.configuration.parallelReferralCap} wards; release one before waitlisting another`,
            );
          }
          waitlistedUnitIds.push(event.unitId);
        }
        const updated: Movement = {
          ...movement,
          waitlistedUnitIds,
          declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }],
        };
        const next = replaceMovement(state, movement.id, updated);
        return appendNotices(next, [
          makeNotice(
            event.now,
            state.notices.length,
            "referral_waitlisted",
            { role: "ed", placeId: movement.originEdId },
            { movementId: movement.id, unitId: event.unitId },
            `${unitName(state, event.unitId)} waitlisted ${movement.id} (no bed yet).`,
          ),
        ]);
      }
      if (!DECLINE_REASONS.includes(event.reason)) {
        /*
         * Runtime membership, not merely the type — the rule `CANCEL_TRANSPORT` and
         * `STEP_BACK_STAGE` both state and this case predates: **a type-only guarantee passes
         * `vitest run` with no `tsc` involved.** Added 2026-09-06 with three siblings, after a
         * source-scanning guard found that FOUR reason-carrying events had no check, not one.
         */
        /*
         * ⚠️ **`DECLINE_REASONS`, NOT `REFERRAL_DECLINE_REASONS` — TWO NEAR-NAMESAKE LISTS ON TWO
         * DIFFERENT EVENTS, AND SWAPPING THEM WOULD BE INVISIBLE.** `DECLINE` is a ward refusing a
         * MOVEMENT and carries `DeclineReason` (`ward-model.ts`); `DECLINE_REFERRAL` is a ward
         * refusing a REFERRAL and carries `ReferralDeclineReason`. A check naming the wrong one
         * would refuse valid reasons and accept invalid ones **while reading as a working check**,
         * which is why `tests/ward-reason-checks-use-their-own-list.test.ts` derives the expected
         * pairing from each event's own declared type rather than from a hand-written table.
         *
         * ⚠️ **AND THIS ONE RENDERS WORSE THAN AN UNLABELLED REASON.** The workspace timeline reads
         * `declineReasonLabels[decline.reason]` with no fallback, so a value outside the list
         * printed the literal string "undefined" beside a ward's name on the audit trail.
         */
        return reject(state, event, `DECLINE reason must be chosen from DECLINE_REASONS`);
      }
      const remainingReferredUnitIds = movement.referredUnitIds.filter((unitId) => unitId !== event.unitId);
      const updated: Movement = {
        ...movement,
        referredUnitIds: remainingReferredUnitIds,
        declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }],
        stage: "destination_review",
        // A decline that leaves the movement at the stage it was already at — ruling 4: labelled
        // a Decline on the tracker, never a step-back, which is why `declines` above is the
        // clinical record and this entry exists only for the derived-case-list floor (every case
        // that assigns `stage:` appends exactly one entry, whether or not the value changes).
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "destination_review", by: event.role, reason: event.reason },
        ],
        // Finding 2 (2026-09-17 review): the same rule `WITHDRAW_WARD_REQUEST` already holds to —
        // `STAGE_TRANSITION_BLOCKERS.referred` ("Awaiting destination response") is only still true
        // while a live request stands. Declining the LAST one, with nothing accepted (guaranteed
        // here — `ACCEPT_IN_PRINCIPLE` refuses once `acceptedUnitId` is set, and this case requires
        // `destination_review`, a stage acceptance always leaves), left the sentence claiming a
        // destination was still being asked when nobody was being asked at all.
        blocker:
          remainingReferredUnitIds.length === 0 && !movement.acceptedUnitId
            ? STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn
            : movement.blocker,
      };
      const next = replaceMovement(state, movement.id, updated);
      // Communication addendum §1.3 ("DECLINE_REFERRAL / DECLINE — the referrer"): the referring
      // emergency department is told this unit said no. Shares `NoticeKind` "referral_declined"
      // with `DECLINE_REFERRAL` below — see that kind's own doc comment (`ward-model.ts`) for why
      // one shared kind is correct here.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "referral_declined",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: event.unitId },
          `${unitName(state, event.unitId)} declined ${movement.id} (${event.reason.replace(/_/g, " ")}).`,
        ),
      ]);
    }

    case "HANDOVER_READY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot ready a handover for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled") {
        return reject(
          state,
          event,
          `cannot ready a handover at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      /*
       * 🔴 THIS FABRICATED A TRANSPORT JOB AND ANSWERED A CLINICAL QUESTION NOBODY HAD ASKED.
       *
       * It created `transport` on the spot with `escortRequired: movement.legalStatus !==
       * "Voluntary"` — a judgement made by no person, rendered on screen as though a clinician had
       * made it, and wrong in BOTH directions: a voluntary patient can need an escort, and a
       * detained one settled enough to travel may not. `TR-D1` names escort as one of the two facts
       * the sending team is booking BECAUSE it knows them. The provider was fabricated too, taking
       * `TRANSPORT_PROVIDERS[0]` whenever the event carried no choice.
       *
       * It survived `BOOK_TRANSPORT` landing by an hour, deliberately: removing it before a booking
       * control existed would have dead-ended "Mark handover ready" on a screen this session does
       * not own. The control landed at `caacf1eda` with the escort question blank and the provider
       * unchosen, so the bridge goes.
       *
       * ⚠️ **HANDOVER READY NOW REQUIRES A BOOKED TRANSPORT rather than inventing one.** The two
       * changes cannot be apart: a stage that can be reached with no transport, on a model where
       * nothing else creates one, is a patient marked ready to hand over with no way to move them.
       */
      const noTransportNeeded = (movement.transportNeed?.needed ?? movement.transport?.needed) === false;
      if (!movement.transport && !noTransportNeeded) {
        return reject(state, event, `cannot ready a handover before transport is booked (BOOK_TRANSPORT)`);
      }
      // P1-3 (Ward Lead ruling, 17 September 2026): re-run at every forward step while a bed is
      // held — see `heldUnitGenderRefusal`'s own doc comment for why only these two judgements and
      // why `PATIENT_ARRIVED` below is deliberately exempt.
      const handoverGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (handoverGenderRefusal) return reject(state, event, handoverGenderRefusal);
      const updated: Movement = {
        ...movement,
        stage: "handover_ready",
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "handover_ready", by: event.role },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_ACCEPTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept transport for a closed movement (${movement.closure.reason})`);
      }

      // WLQ-4 close-out (2026-09-20): while examinationRevokedAwaitingRelease (or a revoked/
      // community_order examination still holding a bed), do not advance the transport pathway.
      // PATIENT_COLLECTED already refused this; PATIENT_ARRIVED stays reachable by owner answer 5.
      {
        const examinationOutcome = movement.examination?.outcome;
        const examinationRevokedHoldingBed =
          (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
          movement.admissionId !== undefined;
        const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
        if (examinationRevokedHoldingBed || awaitingRelease) {
          return reject(
            state,
            event,
            `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still held — a coordinator must release the bed first`,
          );
        }
      }
      if (movement.stage !== "handover_ready" || !movement.transport) {
        return reject(
          state,
          event,
          `cannot accept transport at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      // Instant 0 is a recorded midnight, not "unset" — never truthiness-check timestamps.
      if (movement.transport.acceptedAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already accepted`);
      }
      // P1-3 (Ward Lead ruling, 17 September 2026) — see `heldUnitGenderRefusal`'s own doc comment.
      const transportAcceptedGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (transportAcceptedGenderRefusal) return reject(state, event, transportAcceptedGenderRefusal);
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, acceptedAt: event.now },
        // ⚠️ THE PROVIDER HAS NOW ANSWERED, so `"Awaiting a transport provider response"` — which
        // `BOOK_TRANSPORT` wrote and nothing had replaced — is not merely stale here, it is
        // CONTRADICTED BY THE RECORD BESIDE IT: `acceptedAt` on the same movement, on the same
        // screen, holds the answer the sentence says is outstanding.
        blocker: STAGE_TRANSITION_BLOCKERS.transportAccepted,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_EN_ROUTE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot move transport for a closed movement (${movement.closure.reason})`);
      }

      // WLQ-4 close-out (2026-09-20): while examinationRevokedAwaitingRelease (or a revoked/
      // community_order examination still holding a bed), do not advance the transport pathway.
      // PATIENT_COLLECTED already refused this; PATIENT_ARRIVED stays reachable by owner answer 5.
      {
        const examinationOutcome = movement.examination?.outcome;
        const examinationRevokedHoldingBed =
          (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
          movement.admissionId !== undefined;
        const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
        if (examinationRevokedHoldingBed || awaitingRelease) {
          return reject(
            state,
            event,
            `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still held — a coordinator must release the bed first`,
          );
        }
      }
      /*
       * 🔴 THIS MESSAGE USED TO NAME ONE CAUSE FOR A GUARD THAT TESTS TWO, AND IT WAS FALSE AT ONE
       * REACHABLE STAGE. It asserted that transport had not been accepted. ⚠️ The wording is
       * deliberately NOT spelled out, and this line says so on purpose: a comment that quotes the
       * string it removed puts that string back in the file, so a search for the false claim finds
       * this file and cannot tell a removal from a survival. Do not restore it for clarity.
       *
       * The guard is `stage !== "handover_ready" || acceptedAt === undefined`. At stage `moving` the
       * first half fires while `transport.acceptedAt` IS set — `moving` is only reachable through
       * `PATIENT_COLLECTED`, which requires `enRouteAt`, which requires this very event to have
       * succeeded, which required `acceptedAt`. `transport.acceptedAt` has exactly ONE writer
       * (`TRANSPORT_ACCEPTED`) and is never cleared; the `acceptedAt: undefined` in
       * `WITHDRAW_ACCEPTANCE` is `Movement.acceptedAt`, the BED acceptance, a different field that
       * looks identical.
       *
       * ⚠️ So a coordinator re-dispatching after the patient was already collected was told to go
       * and get the transport accepted — which had happened, and the patient had already left.
       *
       * The repair reports the two facts the guard actually checked, rather than naming one of them
       * as the cause. It cannot assert something other than what is stored.
       *
       * Instant 0 is a recorded midnight — compare with `=== undefined`, never truthiness.
       */
      if (movement.stage !== "handover_ready" || movement.transport?.acceptedAt === undefined) {
        return reject(
          state,
          event,
          `cannot mark transport en route: the movement must be at ${stageCopy.handover_ready.label} ` +
            `with transport accepted (it is at ${stageCopy[movement.stage].label}, transport ` +
            `${movement.transport?.acceptedAt !== undefined ? "accepted" : "not accepted"})`,
        );
      }
      if (movement.transport.enRouteAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} is already en route`);
      }
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, enRouteAt: event.now },
        // The vehicle is moving. This is the instant the old sentence was worst: a coordinator
        // reading "Awaiting a transport provider response" chased a patient whose ambulance was
        // already on the road. Still an ACTIVE blocker — nobody has been collected — so the
        // operational score is unchanged by the rewording.
        blocker: STAGE_TRANSITION_BLOCKERS.transportEnRoute,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PATIENT_COLLECTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot collect a patient for a closed movement (${movement.closure.reason})`);
      }
      // T9, owner answer 5 (second round, 2026-09-17): while a withdrawn or revoked examination
      // still holds this movement's bed, collection is refused until a person releases the bed or
      // records a repeat examination — `PATIENT_ARRIVED` carries no such guard and must stay
      // reachable regardless. `examinationRevokedWhileBedHeld`'s own definition
      // (`ward-derivations.ts`), inlined for the identical reason the gender-check guard above
      // inlines `isOpen` rather than importing `ward-derivations.ts` — that module imports FROM
      // this file, so importing back would close a circular module edge.
      const examinationOutcome = movement.examination?.outcome;
      const examinationRevokedHoldingBed =
        (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
        movement.admissionId !== undefined;
      if (examinationRevokedHoldingBed) {
        return reject(
          state,
          event,
          `cannot collect a patient for movement ${movement.id}: the examination was revoked and this movement still holds a bed — a person must release the bed first`,
        );
      }
      /*
       * 🔴 THE SAME DEFECT AS `TRANSPORT_EN_ROUTE` ABOVE, and false at the same stage. The old
       * message asserted that transport was not yet en route. ⚠️ Deliberately not spelled out here,
       * and this line says so on purpose — see the note above for why.
       *
       * At stage `moving` the stage half of the guard fires while `transport.enRouteAt` IS set,
       * because reaching `moving` requires having already SUCCEEDED at this very event.
       * `enRouteAt` has one writer and is never cleared.
       *
       * ⚠️ So a coordinator re-dispatching after the patient was already collected was told
       * transport had not set off, when collection had already happened.
       */
      // Instant 0 is a recorded midnight — compare with `=== undefined`, never truthiness.
      if (movement.stage !== "handover_ready" || movement.transport?.enRouteAt === undefined) {
        return reject(
          state,
          event,
          `cannot collect a patient: the movement must be at ${stageCopy.handover_ready.label} ` +
            `with transport en route (it is at ${stageCopy[movement.stage].label}, transport ` +
            `${movement.transport?.enRouteAt !== undefined ? "en route" : "not en route"})`,
        );
      }
      // P1-3 (Ward Lead ruling, 17 September 2026) — see `heldUnitGenderRefusal`'s own doc comment.
      // The last of the four re-checks: `PATIENT_ARRIVED` deliberately has none.
      const collectedGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (collectedGenderRefusal) return reject(state, event, collectedGenderRefusal);
      const updated: Movement = {
        ...movement,
        stage: "moving",
        transport: { ...movement.transport, collectedAt: event.now },
        // Nothing is blocking a patient who is in a vehicle — and the SEED already says so in these
        // exact words on its two `moving` movements. Reused verbatim rather than reworded.
        blocker: STAGE_TRANSITION_BLOCKERS.collected,
        // `transport.collectedAt` above and this entry's `at` are the same `event.now` — see
        // `StageChange`'s doc comment.
        stageChanges: [...movement.stageChanges, { at: event.now, from: movement.stage, to: "moving", by: event.role }],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PATIENT_ARRIVED": {
      // Audit follow-up 2026-09-25: `event.now` used to be written unchecked into
      // `closure.at`/`transport.arrivedAt`/`stageChanges` below, so a non-finite value (NaN)
      // reached stored state. Refused here, at the top, before any other PATIENT_ARRIVED
      // logic runs — deliberately narrow; see the reducer's `finiteInstant` for the same check
      // used elsewhere.
      if (finiteInstant(event.now) === null) {
        return reject(state, event, "PATIENT_ARRIVED now must be a finite instant");
      }
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot arrive a patient for a closed movement (${movement.closure.reason})`);
      }
      if (movement.transport?.diversion) {
        return reject(
          state,
          event,
          `movement ${movement.id} was diverted; use RELEASE_DIVERTED_BED rather than recording arrival`,
        );
      }
      /*
       * OWNER ANSWER 10 (second round, 2026-09-17): *"'No transport needed' is recorded at pull,
       * booking is skipped, and the ward records the arrival."* `RECORD_TRANSPORT_NEED(needed:
       * false)` already exists and already refuses to overwrite a movement whose journey is over,
       * but until now it only ever fed the informational `transportNeedState` derivation — nothing
       * actually let a movement reach `arrived` without a transport job, so PATIENT_ARRIVED always
       * demanded the full `moving` + `collectedAt` chain the boxed sentence below states.
       *
       * This is that gap closed: when a person has already recorded no transport is needed, and no
       * transport job was ever booked, the ward may record arrival straight from `pulled` — no
       * `HANDOVER_READY`, no vehicle, nothing to collect. Both halves are required together —
       * `transportNeed.needed === false` alone would also match a movement that later got a job
       * booked anyway (an override staff are free to make), and that movement must still go through
       * the ordinary chain like any other.
       */
      // Audit 2026-09-25 §3 item 4: "no transport job was ever booked" is now actually checked. A
      // live (uncancelled) job means the ordinary chain applies, whatever the need flag says, so a
      // booked vehicle can never be left open for a patient already on the ward.
      const liveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      const noTransportNeeded =
        (movement.transportNeed?.needed ?? movement.transport?.needed) === false &&
        !liveTransportJob &&
        movement.transport?.collectedAt === undefined;
      if (noTransportNeeded) {
        if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
          return reject(
            state,
            event,
            `cannot arrive a patient with no transport needed at the movement's current stage (${stageCopy[movement.stage].label}); the bed must be pulled first`,
          );
        }
      } else if (movement.stage !== "moving" || movement.transport?.collectedAt === undefined) {
        return reject(
          state,
          event,
          `cannot arrive a patient at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted destination unit`);
      }
      // Fix round (2026-09-16 audit): an omitted `actingUnitId` used to skip this check entirely
      // — `event.actingUnitId &&` short-circuited past the comparison whenever it was absent, so a
      // `ward` caller stating no identity at all was waved through. `BOOK_TRANSPORT` and
      // `CANCEL_TRANSPORT` both refuse a `ward` caller with no `actingUnitId` outright; this now
      // does the same, before the comparison that needs it to be present.
      if (event.role === "ward" && !event.actingUnitId) {
        return reject(
          state,
          event,
          `PATIENT_ARRIVED raised as ward must state its actingUnitId, and it has no default`,
        );
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `ward ${event.actingUnitId} cannot confirm arrival for a patient accepted at ${movement.acceptedUnitId}`,
        );
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);

      const isBedTurnaround = unit.empty.value <= 0;

      // Owner ruling 2026-09-25: occupant counts follow gender (recorded sex for a non-binary person).
      const arriverSex = mixSexOf(movement.gender, movement.sex);
      const updatedUnit: Unit = {
        ...unit,
        empty: { ...unit.empty, value: Math.max(0, unit.empty.value - 1), confirmedAt: event.now },
        sexMix: adjustSexMix(unit.sexMix, arriverSex, 1),
      };
      const updatedMovement: Movement = {
        ...movement,
        stage: "arrived",
        // `noTransportNeeded` (above) means no LIVE job was ever booked, but a cancelled job may
        // still sit on `movement.transport` — this route never writes `arrivedAt` onto it. Every
        // other path keeps writing `arrivedAt` onto the real job exactly as before.
        transport:
          movement.transport === undefined || noTransportNeeded
            ? movement.transport
            : { ...movement.transport, arrivedAt: event.now },
        closure: {
          at: event.now,
          outcome: "arrived",
          reason: noTransportNeeded
            ? "Patient arrived at the accepting unit (no transport needed)"
            : "Patient arrived at the accepting unit",
        },
        // When empty beds are exhausted, arrival enters a holding state awaiting bed turnaround.
        blocker: isBedTurnaround ? "Arrived — Bed Turnaround" : STAGE_TRANSITION_BLOCKERS.arrived,
        // `closure.at` above agrees with this entry's `at` — see `StageChange`'s doc comment.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "arrived", by: event.role },
        ],
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      /*
       * ⚠️ **THIS IS THE EVENT THAT MAY WRITE `arrivedAt`, AND IT IS THE ONLY ONE.** Owner ruling,
       * 2026-09-01: *"a patient is not marked as arrived until the ward says they have arrived."*
       * `PULL_PATIENT` creates the record `pulled`, with a null `arrivedAt`; this is where the ward
       * says they got here, so this is where the person becomes `occupied` and the stay clock starts.
       *
       * **The admission is looked up by id, never searched for by unit and state.** Two people
       * pulled to one ward is ordinary, and a search would flip whichever one it found first.
       *
       * **Absent is a real case and is left exactly alone.** A movement whose `pulled` stage was
       * hand-authored in the seed rather than reached by dispatching `PULL_PATIENT` has no
       * `admissionId`, so no record exists to mark. Fabricating one here would invent an occupant
       * this reducer never created — and the seed already authors its own ward occupants.
       */
      const pulledAdmission =
        movement.admissionId === undefined ? undefined : findAdmission(withUnit, movement.admissionId);
      let withPerson: WardFlowState;
      // Audit 2026-09-25 §3 items 2, 5, 6: a branch here used to invent an "AD-ARR-" admission when
      // none existed — locked without taking a locked bed (so the free locked count crept up on
      // leaving), back-dated to when the referral opened, at discharge revision 1. Removed: the
      // rule stated above stands, and an absent admission is left exactly alone.
      if (pulledAdmission && pulledAdmission.state === "pulled") {
        withPerson = replaceAdmission(withUnit, pulledAdmission.id, {
          ...pulledAdmission,
          state: "occupied",
          arrivedAt: event.now,
          ...(isBedTurnaround ? { blockReason: "Awaiting clean" } : {}),
        });
      } else {
        withPerson = withUnit;
      }
      return replaceMovement(withPerson, movement.id, updatedMovement);
    }

    /**
     * A PATIENT LEAVES. The mirror of `PATIENT_ARRIVED` above, and deliberately written beside it.
     *
     * Until this existed the prototype could admit somebody and never discharge them. Patients
     * arrived and stayed forever, so the second half of this project's own claim — following one
     * person through to their bed being free again — had never been seen working.
     *
     * WHAT IT DOES TO THE UNIT, and why it is exactly the inverse of arrival rather than more:
     *
     *   `empty` RISES, because a bed that was physically occupied is now physically vacant. Arrival
     *   lowered it by one; leaving raises it by one. Clamped to `unit.beds` for the same reason
     *   `RELEASE_BED` clamps: `unitCapacity`'s reconciliation identity depends on `empty.value`
     *   never exceeding the ward's real bed count, and an unclamped write breaks it from the write
     *   side rather than the read side.
     *
     *   `sexMix` FALLS for this person's sex, because it counts current occupants and this person
     *   is no longer one. Floored at zero: authored data that already disagrees with itself must
     *   not be able to drive a count negative.
     *
     *   `allocatable` rises with `empty`, once. Owner decision 2026-09-25: leaving is the discharge,
     *   and it completes the person's bed release if they have one. A bed that is not ready for
     *   another reason is recorded by the blocked and closed-bed records, and a bed being cleaned is
     *   refused to a pull by `openBedsNow`.
     *
     * The admission itself is not deleted. It ends: `state: "departed"`, with the instant and the
     * destination. Every "live admissions" reader already filters `state !== "departed"`, so the person
     * leaves the ward's lists by ending rather than by being erased — which is what lets the board,
     * the discharge dates and the community hub still see that they went, and where.
     */
    case "RECORD_LEAVING": {
      if (finiteInstant(event.now) === null || !isLeavingDestination(event.leavingDestination)) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, "Departure needs a finite time and a listed destination");
      }
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_LEAVING was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Refused rather than treated as a no-op: a second discharge would overwrite `leftAt` with a
      // later instant and silently shorten the recorded stay of somebody who left hours earlier.
      if (admission.state === "departed") {
        return reject(state, event, `admission ${admission.id} has already left`);
      }
      // Only somebody who is actually in a bed can leave one. A `waitlisted` or `pulled` admission
      // has never occupied a bed, so ending it is not a discharge — giving back a pull is
      // `RELEASE_PULL`'s job, and routing it through here would credit the ward a bed it never lost.
      if (admission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${admission.id} is ${admission.state}, and only somebody occupying a bed can leave one`,
        );
      }
      if (admission.arrivedAt !== null && event.now < admission.arrivedAt) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, "Departure cannot precede this admission's arrival");
      }

      // Discharge blocked while in transit: a patient cannot be discharged while their transfer
      // ambulance is actively on the road.
      const linkedMovement = dischargeMovement(state, admission);
      if (
        linkedMovement &&
        (linkedMovement.stage === "moving" ||
          (linkedMovement.transport?.collectedAt !== undefined &&
            linkedMovement.transport.arrivedAt === undefined &&
            linkedMovement.transport.cancelledAt === undefined))
      ) {
        return reject(
          state,
          event,
          `cannot record leaving for admission ${admission.id}: patient is actively in transit (movement ${linkedMovement.id})`,
        );
      }

      // Involuntary patient discharge boundary (WA Mental Health Act 2014)
      const linkedPatient = admission.patientId ? state.patients.find((p) => p.id === admission.patientId) : undefined;
      if (
        patientRecordIsInvoluntary(linkedPatient?.legalStatus) ||
        (linkedMovement?.legalStatus !== undefined && linkedMovement.legalStatus !== "Voluntary")
      ) {
        if (
          event.leavingDestination === "discharged-to-the-community" ||
          event.leavingDestination === "left-against-advice"
        ) {
          if (
            !recordedCommunityTransition(admission, linkedMovement?.statusChanges.at(-1)?.at, event.leavingDestination)
          ) {
            return reject(
              state,
              event,
              `cannot record leaving for involuntary patient ${linkedPatient?.id ?? admission.id}: involuntary legal status prohibits unrevoked discharge to the community or left-against-advice`,
            );
          }
        }
      }

      const unit = findUnit(state, admission.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${admission.unitId}`);

      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return departAdmission(state, admission, unit, event.now, event.leavingDestination);
    }

    /**
     * AWAY AT AN EMERGENCY DEPARTMENT, AND BACK AGAIN — the two halves of one fact, written
     * together because half of it is the defect.
     *
     * `Admission.awayAtEmergencyDepartmentSince` shipped on 2026-08-30 with a renderer, a seed and
     * NO EVENT AT EITHER END. Nothing could set it and nothing could clear it, so the seeded rows
     * counted upward for as long as the demonstration ran and every occupant without the badge read
     * as physically in their bed.
     *
     * ⚠️ **NEITHER CASE TOUCHES A UNIT.** No `replaceUnit`, no `empty`, no `allocatable`, no
     * `sexMix` — deliberately, and it is the single most important property of both. The ward is
     * holding this bed because the person is coming back; `bedIsOccupied` counts them throughout
     * and no availability figure moves in either direction. A coordinator must never be offered
     * this bed. Pinned in `tests/ward-away-at-emergency-department.test.ts`.
     */
    /**
     * SOMEBODY SAYS WHAT IS ACTUALLY HOLDING THIS PATIENT UP.
     *
     * ⚠️ **`Movement.blocker` — the free-prose one — and NOT `BedRelease.blocker`**, the
     * `BedReleaseBlocker` enum written by `BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK` further
     * down this file. Two different fields share that name and this case touches only the first.
     *
     * The field had ONE runtime writer, `RAISE_REFERRAL`, stamping `"Awaiting coordinator
     * referral"` at creation, and nothing after it. `STAGE_TRANSITION_BLOCKERS` now restates it
     * wherever a transition contradicts it; this is the other half, and it is the half that
     * matters most, because the
     * things a coordinator actually needs to read — a single room not yet clean, a family not yet
     * reached, an escort provider still finding a vehicle — are facts NOTHING in this model can
     * compute. Only a person can put them here.
     *
     * ⚠️ **THE VALUE IS NOT MEMBERSHIP-CHECKED, WHICH IS A DEPARTURE FROM EVERY OTHER REASON IN
     * THIS REDUCER, AND IT IS DELIBERATE.** `BLOCK_BED_RELEASE` checks its blocker against
     * `BED_RELEASE_BLOCKERS`; `REFER_TO_UNITS` checks its override reason against
     * `OVERRIDE_REASONS`. This one has no list to check against, on the owner's 2026-09-01 ruling:
     * a fixed list cannot hold an absence together with its reason (`"None — in transit"` versus
     * `"None — handover complete"`), and it cannot hold activity by parties the model has no field
     * for. Constraining it would lose exactly what deriving it would lose.
     *
     * The one check is that something was actually said. A blank is refused rather than stored:
     * `Movement.blocker` has no null, so an empty string would be indistinguishable from a field
     * nobody had reached, which is the ambiguity this event exists to end.
     *
     * ⚠️ **NO ROLE IS RECORDED ALONGSIDE IT.** Four roles may raise this and the record does not
     * say which did — deliberately, because inventing an attribution is worse than omitting one,
     * and this field has never claimed to be attributed. If who said it ever matters, that is a
     * new field with its own ruling, not a quiet addition here.
     */
    /**
     * THE URGENT FLAG, ON AND OFF — the mechanism the owner asked for on 2026-08-30 and that
     * nobody could reach until 2026-09-01.
     *
     * `Movement.flaggedUrgent` was added with a ranking rule above it (`queueOrder` in
     * ward-priority.ts puts it ABOVE all three urgency tiers) and a badge below it (the coordinator
     * queue's "Flagged urgent"). The only writer was the literal `false` in `RAISE_REFERRAL`, and
     * exactly one hand-authored movement carried `true`. **A fully built feature with no way in.**
     *
     * ⚠️ **BOTH HALVES, and the clearing half is the one that stops this becoming a new permanent
     * state.** A flag nobody can remove sits above every tier for the rest of the demonstration on
     * a patient whose situation has resolved, and the seeded `true` could never be cleared at all.
     *
     * ⚠️ **A REASON, AN AUTHOR AND AN INSTANT ARE NOW RECORDED TOO — item 37, 2026-09-17,** closing
     * the part of the owner's "I will build on it later" that this pair used to leave open.
     * `event.reason` is checked against `URGENT_MARK_REASONS` at runtime (a type-only guarantee
     * passes `vitest run` with no `tsc` involved — the same discipline `CHANGE_URGENCY` and every
     * other reason-carrying case in this file already hold to) and, together with `event.role` and
     * `event.now`, is written to `Movement.urgentFlag`. Clearing stays reason-free: taking a flag
     * back down cannot promote anybody, so there is nothing here for a reason to justify.
     *
     * ⚠️ **AND A HISTORY SURVIVES A CLEAR — review fix-forward item 6, 2026-09-17.** `urgentFlag`
     * is overwritten by every raise and erased by every clear; `urgentFlagHistory` is append-only.
     * Raising pushes a new entry with `clearedAt`/`clearedBy` both absent; clearing fills those two
     * on the OPEN entry (the last one with no `clearedAt`) rather than pushing a second entry, so
     * one raise-then-clear cycle is one row. `findLastIndex` rather than `find` from the front: the
     * open entry is always the newest one, and a movement flagged, cleared, then flagged again has
     * an OLDER closed entry ahead of it that must never be the one clearing touches.
     */
    case "FLAG_MOVEMENT_URGENT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // A closed movement is off `queueOrder` entirely (`isOpen` removes it), so flagging one would
      // change nothing and report that it had. Refused rather than accepted as a silent no-op, the
      // same discipline every other movement-scoped handler here holds to.
      if (movement.closure) {
        return reject(state, event, `cannot flag a closed movement as urgent (${movement.closure.reason})`);
      }
      if (movement.flaggedUrgent) {
        return reject(state, event, `movement ${movement.id} is already flagged urgent`);
      }
      if (!URGENT_MARK_REASONS.includes(event.reason)) {
        return reject(state, event, `FLAG_MOVEMENT_URGENT reason must be chosen from URGENT_MARK_REASONS`);
      }
      return replaceMovement(state, movement.id, {
        ...movement,
        flaggedUrgent: true,
        urgentFlag: { at: event.now, by: event.role, reason: event.reason },
        urgentFlagHistory: [
          ...(movement.urgentFlagHistory ?? []),
          { raisedAt: event.now, raisedBy: event.role, reason: event.reason },
        ],
      });
    }

    case "CLEAR_MOVEMENT_URGENT_FLAG": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // ⚠️ NO `closure` CHECK, unlike flagging above, and the asymmetry is the point. Removing a
      // flag can never promote anybody, so refusing it has no protective value — while a flag that
      // could not be cleared on some future path is the exact permanent state this pair exists to
      // prevent. The guard below is the only one needed: it proves there is something to clear.
      if (!movement.flaggedUrgent) {
        return reject(state, event, `movement ${movement.id} is not flagged urgent`);
      }
      // `undefined` stays `undefined` — a movement flagged before this history existed (WF-018)
      // has nothing to update, and clearing it must not invent an empty log where there was none.
      const history = movement.urgentFlagHistory;
      const openIndex = history?.findLastIndex((entry) => entry.clearedAt === undefined) ?? -1;
      const updatedHistory =
        history === undefined || openIndex === -1
          ? history
          : history.map((entry, index) =>
              index === openIndex ? { ...entry, clearedAt: event.now, clearedBy: event.role } : entry,
            );
      // Clears the provenance together with the boolean — the two fields can never disagree about
      // whether a flag is live (see `Movement.urgentFlag`'s own doc comment).
      return replaceMovement(state, movement.id, {
        ...movement,
        flaggedUrgent: false,
        urgentFlag: undefined,
        urgentFlagHistory: updatedHistory,
      });
    }

    case "RECORD_MOVEMENT_BLOCKER": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Refused for a closed movement, the same as every other movement-scoped handler here. A
      // closed movement is off every open board and its blocker is the closing one — a later edit
      // would describe an obstruction to something that is no longer happening.
      if (movement.closure) {
        return reject(state, event, `cannot record a blocker for a closed movement (${movement.closure.reason})`);
      }
      const blocker = event.blocker.trim();
      if (blocker.length === 0) {
        return reject(state, event, `RECORD_MOVEMENT_BLOCKER blocker must say something — a blank is not a statement`);
      }
      /*
       * ⚠️ A NEAR-MISS OF A "NOTHING IS BLOCKING" SENTINEL IS REFUSED, AND SENT TO THE RIGHT EVENT.
       *
       * `hasActiveBlocker` (ward-priority.ts) compares against `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`
       * by exact equality, so `"none — in transit"` in lower case would be stored as an ACTIVE
       * blocker worth ten points in `operationalScore` — a wrong score on a movement nobody is
       * holding up, which is the computed kind of wrong rather than the displayed kind.
       *
       * ⚠️ **THIS IS EXACT EQUALITY IGNORING CASE AGAINST A CLOSED SET, AND MUST NEVER BECOME A
       * PATTERN.** That boundary is the whole reason it is safe: `"None of the secure units can
       * take him"` is not case-insensitively equal to any member, so it is stored as the real
       * blocker it is — the case `tests/ward-priority.test.ts` pins. A `/^none/i` here would
       * swallow it, which is precisely the fix that was refused.
       *
       * It does NOT catch every way of typing "nothing is blocking" and is not meant to.
       * `"Nothing outstanding"` and `"N/A"` are still stored as obstructions, because this set does
       * not interpret English and must not start. `CLEAR_MOVEMENT_BLOCKER` is what a person uses,
       * and this refusal names it rather than leaving them to guess.
       */
      const nearMiss = BLOCKERS_MEANING_NOTHING_IS_BLOCKING.find(
        (inactive) => inactive.toLowerCase() === blocker.toLowerCase() && inactive !== blocker,
      );
      if (nearMiss !== undefined) {
        return reject(
          state,
          event,
          `"${blocker}" differs from "${nearMiss}" only in case, and would be stored as an active blocker — use CLEAR_MOVEMENT_BLOCKER to say nothing is holding this up`,
        );
      }
      // Trimmed, never as typed: trailing whitespace would make two identical statements compare
      // unequal, and `hasActiveBlocker` (ward-priority.ts) trims before matching its "nothing is
      // blocking" shapes — a stored `"None — in transit "` would score ten points there.
      return replaceMovement(state, movement.id, { ...movement, blocker });
    }

    /**
     * NOTHING IS HOLDING THIS PATIENT UP ANY MORE.
     *
     * ⚠️ **CLEARING IS REPRESENTED, NOT INTERPRETED, AND THAT IS THE WHOLE POINT OF THE EVENT.**
     * `RECORD_MOVEMENT_BLOCKER` shipped earlier the same day accepting any non-blank prose, while
     * `hasActiveBlocker` recognised "nothing is blocking" by case-sensitive match against a small
     * vocabulary. A person clearing a blocker by typing `"none — resolved"` or `"no blocker"` left
     * the movement scoring ten points as obstructed in `operationalScore`, and so ranked above
     * patients who really were blocked — silently, with nothing red.
     *
     * Widening the recogniser was refused: the next phrasing is missed too, and a case-insensitive
     * `/^none/i` would swallow `"None of the secure units can take him"`, a real blocker the
     * priority tests pin. Instead this writes ONE sentinel from
     * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`, so the recogniser only ever knows a closed set.
     *
     * `"None — cleared"` rather than `"No blocker"`: an absence WITH its reason. "No blocker" means
     * nobody ever recorded one; this means somebody looked and said it is gone. That is the same
     * distinction `"None — in transit"` and `"None — handover complete"` exist to preserve, and it
     * is the property the owner's ruling against deriving this field turns on.
     */
    case "CLEAR_MOVEMENT_BLOCKER": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot clear the blocker on a closed movement (${movement.closure.reason})`);
      }
      // Refused rather than accepted as a no-op, the same discipline as the flag pair above: a
      // control that reports success for an act that changed nothing is the untruth this prototype
      // names as mattering most. `"None — cleared"` and the other sentinels are all already
      // "nothing is blocking", so there is nothing to clear.
      if (BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === movement.blocker.trim())) {
        return reject(state, event, `movement ${movement.id} already records that nothing is holding it up`);
      }
      return replaceMovement(state, movement.id, { ...movement, blocker: "None — cleared" });
    }

    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Only somebody actually IN a bed can leave the ward and still have it kept for them. A
      // `waitlisted` or `pulled` admission has never reached the ward — they are usually sitting in
      // an emergency department already, which is the mirror image of what this field means and
      // exactly the confusion `Admission.awayAtEmergencyDepartmentSince`'s own doc comment warns
      // about. A `departed` admission has no bed to hold at all.
      if (admission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${admission.id} is ${admission.state}, and only somebody occupying a bed can be away from it`,
        );
      }
      // Refused rather than treated as a no-op, the same reasoning `RECORD_LEAVING` uses for a
      // second discharge: overwriting the instant with a later one would silently SHORTEN the
      // recorded trip of somebody who has been in an emergency department for six hours, and the
      // board renders that number in words.
      if (admission.awayAtEmergencyDepartmentSince !== null) {
        return reject(state, event, `admission ${admission.id} is already recorded as away at an emergency department`);
      }
      return replaceAdmission(state, admission.id, { ...admission, awayAtEmergencyDepartmentSince: event.now });
    }

    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Refused rather than silently written as `null`. `null` already means "on the ward", so a
      // return recorded for somebody who was never away would be indistinguishable from a no-op —
      // and a control that reports success for an act that did not happen is the one untruth this
      // prototype's own history names as mattering most.
      if (admission.awayAtEmergencyDepartmentSince === null) {
        return reject(state, event, `admission ${admission.id} is not recorded as away at an emergency department`);
      }
      // `state` is deliberately NOT checked here, unlike the event above. Somebody may only GO
      // while occupying a bed, but the guard directly above already proves this admission is away,
      // and refusing their return on a state check would strand the badge permanently if any future
      // path ever moved an away admission's state. A flag nobody can clear is the defect being
      // repaired, so the clearing half is guarded on the flag itself and nothing else.
      return replaceAdmission(state, admission.id, { ...admission, awayAtEmergencyDepartmentSince: null });
    }

    case "CONFIRM_CAPACITY": {
      // The role check above only proves *a* ward raised this. It does not say *which* ward, so
      // before this a ward user on unit A could restate unit B's allocatable count.
      //
      // What this check does: it compares the unit the caller said it was acting as against the
      // unit being written to, and refuses the event when they differ. What it does not do: prove
      // the claim. `actingUnitId` is whatever the call site put on the event — the ward screen
      // reads it from its own `/mockups/ward-flow/ward/[unitId]` route, but nothing here verifies
      // that, and this prototype carries no authenticated actor identity to verify it against.
      // This is a recorded assertion by the caller, not an authorisation decision, and must not
      // be described or extended as one.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // The ward screen already bounds its own input (`min={0} max={unit.beds}`), but a screen
      // check is bypassed by every other call site and by every hand-built event, and this reducer
      // is the trust boundary. Without this a ward could restate more allocatable beds than the
      // building has, and the figure would render as that ward's own confirmed claim.
      //
      // ⚠️ THE BOUND IS `unit.beds`, NEVER `empty.value`. A ward restating what it can allocate is
      // ALLOWED to disagree with a stale feed figure — that is what a ward confirmation is for, and
      // `tests/ward-flow-reducer.test.ts`'s "arrival capacity floor" depends on it, restating 5
      // against a seeded empty of 2 to prove `PATIENT_ARRIVED` still refuses once physically empty
      // beds run out. Beds are a fact about the building; empty is a claim about right now.
      //
      // ⚠️ AND IT REFUSES RATHER THAN CLAMPING. Clamping 30 to 20 would record a number the ward
      // never said and read back to them as agreement. A refusal names both figures and leaves the
      // previous confirmation untouched, stamp included.
      if (!Number.isInteger(event.value) || event.value < 0) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY on unit ${unit.id} was given ${event.value}, which is not a whole number of beds`,
        );
      }
      if (event.value > unit.beds) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY says unit ${unit.id} can allocate ${event.value} beds, which is more than the ${unit.beds} beds it has`,
        );
      }
      // WF-08 optimistic-concurrency: a caller that read revision N and now writes must be told
      // when any resource change has since landed, rather than silently overwriting it.
      if (
        !Number.isSafeInteger(event.expectedRevision) ||
        (unit.allocatable.revision ?? 0) !== event.expectedRevision
      ) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY on unit ${unit.id} is stale: expected revision ${event.expectedRevision}, current ${unit.allocatable.revision ?? 0}`,
        );
      }
      const updatedUnit: Unit = {
        ...unit,
        allocatable: {
          ...unit.allocatable,
          value: event.value,
          source: "ward",
          confirmedAt: event.now,
          revision: (unit.allocatable.revision ?? 0) + 1,
        },
      };
      return replaceUnit(state, unit.id, updatedUnit);
    }

    case "RECORD_WARD_INTAKE_CONSTRAINTS": {
      // Same claim-not-proof discipline as CONFIRM_CAPACITY immediately above (see that case's own
      // comment in full).
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `RECORD_WARD_INTAKE_CONSTRAINTS was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const constrainedUnit = findUnit(state, event.unitId);
      if (!constrainedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Chosen, never typed: a typed caller cannot construct this event with a code outside
      // `WARD_INTAKE_CONSTRAINTS` (a required union-member array, not a plain `string[]`), and this
      // check is the runtime half of that discipline for an untyped caller, the same pattern
      // `FLAG_BED_RELEASE`'s `blocker` membership check uses below.
      if (event.codes.some((code) => !WARD_INTAKE_CONSTRAINTS.includes(code))) {
        return reject(
          state,
          event,
          "RECORD_WARD_INTAKE_CONSTRAINTS codes must all be chosen from WARD_INTAKE_CONSTRAINTS",
        );
      }
      const updatedConstrainedUnit: Unit = { ...constrainedUnit, intakeConstraints: event.codes };
      return replaceUnit(state, constrainedUnit.id, updatedConstrainedUnit);
    }

    case "FLAG_BED_RELEASE": {
      // Same claim-not-proof discipline as CONFIRM_CAPACITY (see that case's own comment in
      // full): this compares what the caller SAID it was acting as against the unit the release
      // is being written to, and refuses when they differ. It does not authenticate anything —
      // `FLAG_BED_RELEASE` is `ward`-only, so unlike RELEASE_PULL/CANCEL_TRANSPORT there is no
      // coordinator caller to exempt, and the comparison always runs.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `FLAG_BED_RELEASE was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const flaggedUnit = findUnit(state, event.unitId);
      if (!flaggedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Owner decision 2026-09-25: a bed release is a named patient's discharge. These five checks
      // are what makes `admissionId` real rather than decorative — see `BedRelease.admissionId`'s
      // own doc comment for why this exists and what it replaces (a ward-wide count guess with two
      // hard-coded id exceptions).
      const flaggedAdmission = findAdmission(state, event.admissionId);
      if (!flaggedAdmission) {
        return reject(state, event, `no admission found for id ${event.admissionId}`);
      }
      if (flaggedAdmission.unitId !== event.unitId) {
        return reject(
          state,
          event,
          `FLAG_BED_RELEASE names admission ${flaggedAdmission.id} on unit ${flaggedAdmission.unitId}, not unit ${event.unitId}`,
        );
      }
      if (flaggedAdmission.state === "departed") {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} has already left, and a bed release completes when they leave`,
        );
      }
      if (flaggedAdmission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} is ${flaggedAdmission.state}, and only somebody occupying a bed can have a bed release`,
        );
      }
      const flaggedLiveRelease = state.bedReleases.find(
        (r) => r.admissionId === flaggedAdmission.id && r.state !== "discharged",
      );
      if (flaggedLiveRelease) {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} already has a live bed release (${flaggedLiveRelease.id})`,
        );
      }
      // Review Finding 1: a typed caller cannot construct this event with a `blocker` outside
      // `BED_RELEASE_BLOCKERS` — it is a required union member, not a plain `string`. This check
      // exists for the untyped caller anyway: "Blockers are chosen, never typed" (binding spec)
      // is a runtime rule, not merely a compile-time one, so a defined `blocker` is checked by
      // real membership, not by truthiness alone.
      if (event.blocker !== undefined && !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(state, event, `FLAG_BED_RELEASE blocker must be chosen from BED_RELEASE_BLOCKERS`);
      }
      // Bed-model rework (2026-08-28): a flag ALWAYS creates a `"expected"` release, and a
      // blocker sets the blocked FLAG on it rather than choosing a different state. Spec D3's
      // old "blocked xor expected" rule is gone with the fourth state it described — a bed
      // that is coming free but currently held up is a prediction AND a block, and pretending
      // those were alternatives is what let `capacityBreakdown` count such a release nowhere.
      // `waitingOn` is therefore kept on both paths, because the release is expected on both.
      // Fix round 2 (P1): `expectedAt` now carries the ward's own estimate of when the bed will
      // actually be free (`event.expectedAt`, collected on the flag form exactly like
      // `expectedReturn` on the leave-bed form) rather than `event.now`. Before this fix every
      // release a ward flagged at runtime was stamped with the instant it was REPORTED, which
      // `releaseBand()` (spec D5) then always classified `now` — the four planning bands
      // (now / by-midday / by-1600 / tonight) only ever worked for the hand-authored fixture,
      // never for anything a ward actually flagged.
      //
      // `confirmedAt` is deliberately kept as `event.now` — it is a genuinely different fact,
      // when the ward made this report — while `expectedAt` is when the ward expects the bed to
      // be free. The two can differ (a ward flagging now that a bed will be free by 1600), and
      // conflating them was exactly the bug. Neither field carries anything about the departing
      // PATIENT's own timing (binding spec §4): `expectedAt` is an operational estimate about the
      // BED, the same category `expectedReturn` on `RECORD_LEAVE_BED` already sits in and is
      // already permitted to carry — see that event's own doc comment and `LeaveBed`'s type.
      const flaggingRole = `NUM ${flaggedUnit.name}`;
      const release: BedRelease = {
        // "WR-9NN" mirrors `nextReferralId`'s own "9" prefix above — visibly distinct at a
        // glance from the hand-authored "WR-00N" fixture ids, same reasoning as
        // RAISE_REFERRAL's "WF-9NN". Safe to derive from `state.bedReleases.length` here
        // (unlike `RECORD_LEAVE_BED`'s own id below, see that case's comment): nothing in
        // this reducer ever removes an entry from `bedReleases` — every other bed-release
        // case transitions a release in place via `replaceBedRelease`, so the array only ever
        // grows and its length is a safe, collision-free id source.
        id: `WR-9${String(state.bedReleases.length).padStart(2, "0")}`,
        unitId: flaggedUnit.id,
        admissionId: flaggedAdmission.id,
        state: "expected",
        expectedAt: event.expectedAt,
        waitingOn: event.waitingOn,
        blocker: event.blocker ?? null,
        blockedBy: event.blocker !== undefined ? flaggingRole : null,
        // A bed nobody has yet left is not being made ready. Preparation only ever begins after
        // `RELEASE_BED`, and only through `SET_BED_PREPARATION` — see that case.
        preparing: false,
        preparationNote: null,
        confirmedAt: event.now,
        confirmedBy: flaggingRole,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return { ...state, bedReleases: [...state.bedReleases, release] };
    }

    case "CONFIRM_BED_RELEASE": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      // Same claim-not-proof discipline as FLAG_BED_RELEASE (see that case's own comment in
      // full): this compares what the caller SAID it was acting as against the unit the release
      // belongs to, and refuses when they differ. `CONFIRM_BED_RELEASE` is `ward`-only, so unlike
      // RELEASE_PULL/CANCEL_TRANSPORT there is no coordinator caller to exempt.
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: expected -> confirmed. Nothing else. Naming both the current state and
      // the attempted target keeps a refusal readable without having to cross-reference the state
      // machine comment above. (Before the 2026-08-28 rework this also accepted `blocked ->
      // confirmed`; there is no such state now, and a blocked release is confirmed from whichever
      // stage it is actually in, keeping its flag.)
      if (release.state !== "expected") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to confirmed`);
      }
      // Fix round 2 (P2, spec D7): `confirmedAt` restates to `event.now` on every accepted
      // transition, not just at creation — before this fix a transition spread `...release` and
      // kept the ORIGINAL `confirmedAt`, so `WardFreshness` on this row kept reporting when the
      // release was first flagged rather than when its current state was last reported, which
      // defeats D7's whole point ("every screen states when its data was last true"). `confirmedBy`
      // is deliberately NOT restated: the guard above already refuses this event whenever
      // `event.actingUnitId !== release.unitId`, so the acting ward on every accepted transition
      // is, by construction, always the same ward that produced the existing `confirmedBy` — there
      // is no other unit's role this could ever become, so restating it would write back the exact
      // same string it already holds.
      //
      // `blocker`/`blockedBy` are deliberately CARRIED THROUGH untouched (bed-model rework,
      // 2026-08-28): "a discharge that is decided and stuck is exactly that — still confirmed,
      // and flagged". Clearing the flag here would re-create the counting defect this rework
      // exists to close, just from the other end, by making a confirmation quietly assert the
      // bed is unstuck. `CLEAR_BED_RELEASE_BLOCK` is the one and only way a flag comes off.
      const updated: BedRelease = {
        ...release,
        state: "confirmed",
        waitingOn: null,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(state, release.id, updated);
    }

    case "REVERT_BED_RELEASE": {
      // The reversal the four-stage model forbade (bed-model rework, 2026-08-28). It is recorded
      // exactly like every other change — `confirmedAt` restated to `event.now`, `confirmedBy`
      // left alone for the reason CONFIRM_BED_RELEASE's own case sets out — because a reversal
      // that cannot be recorded honestly gets recorded dishonestly instead.
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `REVERT_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: confirmed -> expected. `discharged` is terminal and `expected` is
      // already there, so both fall into the same refusal.
      if (release.state !== "confirmed") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to expected`);
      }
      // Membership check, not truthiness — the same discipline BLOCK_BED_RELEASE's own blocker
      // check holds to, and for the same reason: a runtime rule, not merely a compile-time one.
      if (!BED_RELEASE_WAITING_ON.includes(event.waitingOn)) {
        return reject(state, event, `REVERT_BED_RELEASE waitingOn must be chosen from BED_RELEASE_WAITING_ON`);
      }
      // The blocked flag survives: reversing the discharge decision does not unstick the bed.
      const reverted: BedRelease = {
        ...release,
        state: "expected",
        waitingOn: event.waitingOn,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(state, release.id, reverted);
    }

    case "BLOCK_BED_RELEASE": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `BLOCK_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // A typed caller cannot construct this event without `blocker` — it is a required field,
      // not the optional one `FLAG_BED_RELEASE` carries. This check exists for the untyped
      // caller anyway: "blocked with no blocker" is a contradiction in terms (spec D3) and must
      // be refused at runtime, not merely disallowed at compile time. Review Finding 1: this used
      // to be a truthiness test (`!event.blocker`), which refuses a missing or empty value but
      // accepts any other non-empty string — a real membership test against
      // `BED_RELEASE_BLOCKERS` is what "Blockers are chosen, never typed" (binding spec) actually
      // requires.
      if (!event.blocker || !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(state, event, `BLOCK_BED_RELEASE requires a blocker chosen from BED_RELEASE_BLOCKERS`);
      }
      // Bed-model rework (2026-08-28): this sets a FLAG and moves no stage at all. A blocked
      // release keeps whichever stage it was in — `expected` stays expected, and a confirmed
      // discharge that gets stuck stays CONFIRMED and keeps counting as confirmed. Only
      // `discharged` is refused: the bed is already free, so there is nothing left to hold up.
      const blockedUnit = findUnit(state, release.unitId);
      if (!blockedUnit) return reject(state, event, `no unit found for id ${release.unitId}`);
      if (release.state === "discharged") {
        return reject(state, event, `cannot block release ${release.id} because it is already released`);
      }
      // Fix round 2 (P2, spec D7): same freshness restatement as CONFIRM_BED_RELEASE's own case
      // (see its comment in full) — `confirmedAt` moves to `event.now` on this write too, and
      // `confirmedBy` stays untouched for the same reason. `blockedBy` is a separate role field
      // rather than a reuse of `confirmedBy` because "who says this bed is stuck" and "who last
      // reported its stage" are different questions once a block outlives a stage change.
      const updated: BedRelease = {
        ...release,
        blocker: event.blocker,
        blockedBy: `NUM ${blockedUnit.name}`,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(state, release.id, updated);
    }

    case "CLEAR_BED_RELEASE_BLOCK": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CLEAR_BED_RELEASE_BLOCK was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Refused rather than silently accepted as a no-op: "this bed is no longer stuck" is a
      // claim about a bed that WAS stuck, and a screen offering it on an unflagged release is a
      // defect the reducer should surface on the rejections list, not absorb.
      if (release.blocker === null) {
        return reject(state, event, `release ${release.id} carries no blocked flag to clear`);
      }
      const unblocked: BedRelease = {
        ...release,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(state, release.id, unblocked);
    }

    case "SET_BED_PREPARATION": {
      // Q4 (2026-08-28): a bed may carry a short indication that it is being MADE READY. This
      // writes that indication and NOTHING else — it touches no unit field, no capacity figure
      // and no availability. `capacityBreakdown` derives `availableNow` from the unit own
      // `allocatable`/`empty` and never reads a release, so a bed being prepared is still
      // offered, still counted and still allocatable, exactly as the owner requires. Do not add
      // a unit write here to "hold" a bed while it is cleaned; that is the delay his answer
      // says does not exist.
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Membership check, same discipline as the blocker checks above: "notes are chosen, never
      // typed" is a RUNTIME rule, not merely a compile-time one, so an untyped caller supplying
      // anything outside `BED_PREPARATION_NOTES` is refused rather than stored.
      //
      // The owner supplied that list on 2026-08-28, so this now accepts the two real notes where
      // it previously refused everything. The `string | undefined` binding and the `readonly
      // string[]` widening are kept deliberately: they were what made this guard compile while
      // `BedPreparationNote` was `never`, they cost nothing now, and they are what keeps the
      // check honest if a future edit ever empties the array again.
      const requestedNote: string | undefined = event.note;
      if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) {
        return reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`);
      }
      const prepared: BedRelease = {
        ...release,
        preparing: event.preparing,
        // Clearing the flag clears the note with it — "being made ready, waiting on nothing" is
        // a state, "not being made ready, waiting on a clean" is a contradiction.
        preparationNote: event.preparing ? (event.note ?? null) : null,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(state, release.id, prepared);
    }

    case "RELEASE_BED": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `RELEASE_BED was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transitions: confirmed -> discharged and expected -> discharged. `discharged` is
      // terminal, so only a release already in it is refused. The stage is `discharged` and the
      // word "released" below belongs to the retired FOUR-stage model, kept only where it
      // describes that model's own history — owner ruling 2026-08-30, discharged not released. Expected is accepted deliberately:
      // "the person has left" is a statement of fact about an empty bed, not a prediction being
      // promoted into availability, and the four-stage model already permitted the same journey
      // via `expected -> blocked -> released`. Narrowing it during the rework would have refused
      // a path wards could already take.
      if (release.state === "discharged") {
        return reject(state, event, `release ${release.id} is already discharged and cannot be discharged again`);
      }
      const unit = findUnit(state, release.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${release.unitId}`);
      // Owner decision 2026-09-25: this completes a release only once its named admission has
      // actually left. While they are still in the bed, record the leaving instead
      // (`RECORD_LEAVING`) — that is what now completes the release, in the same write that raises
      // the unit's figures. See `departAdmission`'s own comment.
      const releasedAdmission = findAdmission(state, release.admissionId);
      if (!releasedAdmission) {
        return reject(
          state,
          event,
          `release ${release.id} names admission ${release.admissionId}, which does not exist`,
        );
      }
      if (releasedAdmission.state !== "departed") {
        return reject(
          state,
          event,
          `release ${release.id} completes when admission ${releasedAdmission.id} is recorded as having left (RECORD_LEAVING); they are still ${releasedAdmission.state}`,
        );
      }
      // Fix round 2 (P2, spec D7): same freshness restatement as CONFIRM_BED_RELEASE's own case
      // (see its comment in full) — `confirmedAt` moves to `event.now` on this transition too,
      // and `confirmedBy` stays untouched for the same reason.
      // The blocked flag comes off here, and here only besides `CLEAR_BED_RELEASE_BLOCK`: once
      // the bed is actually free there is nothing left being held up, so a surviving flag would
      // be a claim about a discharge that has already happened.
      const updatedRelease: BedRelease = {
        ...release,
        state: "discharged",
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
      };
      // RELEASE_BED is the one event in this six-case group that changes an actual bed count,
      // not just a record about one — this is where the expected/confirmed expectation
      // `FLAG_BED_RELEASE`/`CONFIRM_BED_RELEASE` only anticipated becomes the physical fact.
      // `capacityBreakdown`'s `availableNow` is deliberately blind to `bedReleases` itself (Task
      // 2: nothing expected or confirmed-but-unreleased may ever be added into it), so the only
      // way a release ever moves that number is through the unit's own fields, here. Both
      // `allocatable.value` and `empty.value` rise by one: the bed is now truly free, not merely
      // reserved (`allocatable` alone) or physically vacant while still pulled for someone else
      // (`empty` alone) — mirroring `PATIENT_ARRIVED`'s and `PULL_PATIENT`'s own single-field writes,
      // just on both fields at once, because this bed had never been decremented by either of
      // those handlers to begin with.
      //
      // Fix round 1 (Critical): both writes are clamped to `unit.beds`, the unit's own physical
      // ceiling. Without this clamp, repeated legal FLAG_BED_RELEASE -> CONFIRM_BED_RELEASE ->
      // RELEASE_BED cycles on one unit can walk `empty.value` past `unit.beds` — nothing in this
      // handler or in `FLAG_BED_RELEASE` caps how many releases a unit accumulates against its
      // own occupied-bed count. `unitCapacity`'s reconciliation identity
      // (`available + held + blocked + occupied === unit.beds`, `tests/ward-capacity-reconciliation.test.ts`)
      // depends on `empty.value` never exceeding `unit.beds` — once it does, `notEmpty` collapses
      // to zero and the four figures stop summing to the unit's real bed count, which is exactly
      // the sentence `ward-screen.tsx` tells a coordinator is always true. `unitCapacity` itself
      // clamps every figure it derives so that already-over/under-counted authored data is never
      // taken at face value; an unclamped write here broke that discipline from the write side
      // instead of the read side. Do not remove this clamp to "simplify" the arithmetic.
      // The person has already left (refused above otherwise), and `departAdmission` moved the
      // figures then. This event now only records the stage. It never moves a count.
      const departureAlreadyIncremented = true;

      // `sexMix` is NOT touched here: a release does not say who left, and occupant counts follow
      // the leaver's gender (owner rulings 2026-09-25), so the count moves when the admission
      // departs (`departAdmission`), never by guessing a sex here. 5d7f438126's guess (decrement
      // the larger bucket) was removed 2026-09-25; it also subtracted twice when the occupant later left.
      const updatedUnit: Unit = departureAlreadyIncremented
        ? {
            ...unit,
            allocatable: { ...unit.allocatable, confirmedAt: event.now },
            empty: { ...unit.empty, confirmedAt: event.now },
          }
        : {
            ...unit,
            allocatable: {
              ...unit.allocatable,
              value: Math.min(unit.beds, unit.allocatable.value + 1),
              confirmedAt: event.now,
            },
            empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1), confirmedAt: event.now },
          };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(withUnit, release.id, updatedRelease);
    }

    case "RECORD_LEAVE_BED": {
      // Same claim-not-proof discipline as FLAG_BED_RELEASE's own field: this compares what the
      // caller SAID it was acting as against the unit the leave bed is being recorded against.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `RECORD_LEAVE_BED was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Owner ruling 2026-09-25: a leave bed names the stay it belongs to, never a guessed one.
      const onLeave = findAdmission(state, event.admissionId);
      if (!onLeave) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (onLeave.unitId !== event.unitId) {
        return reject(
          state,
          event,
          `RECORD_LEAVE_BED names admission ${onLeave.id} on unit ${onLeave.unitId}, not unit ${event.unitId}`,
        );
      }
      if (onLeave.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${onLeave.id} is ${onLeave.state}, and only somebody occupying a bed can be on leave from it`,
        );
      }
      const current = state.leaveBeds.find((bed) => bed.admissionId === onLeave.id);
      if (current) return reject(state, event, `admission ${onLeave.id} is already on leave (${current.id})`);
      const sequence = state.leaveBedSequence + 1;
      const created: LeaveBed = {
        id: nextLeaveBedId(sequence),
        unitId: unit.id,
        admissionId: onLeave.id,
        expectedReturn: event.expectedReturn,
        confirmedAt: event.now,
        confirmedBy: `NUM ${unit.name}`,
        kind: event.kind ?? "off_ward",
      };
      return { ...state, leaveBeds: [...state.leaveBeds, created], leaveBedSequence: sequence };
    }

    case "END_LEAVE_BED": {
      const leaveBed = findLeaveBed(state, event.leaveBedId);
      if (!leaveBed) return reject(state, event, `no leave bed found for id ${event.leaveBedId}`);
      if (event.actingUnitId !== leaveBed.unitId) {
        return reject(
          state,
          event,
          `END_LEAVE_BED was raised acting as unit ${event.actingUnitId} but leave bed ${leaveBed.id} belongs to unit ${leaveBed.unitId}`,
        );
      }
      return { ...state, leaveBeds: state.leaveBeds.filter((candidate) => candidate.id !== leaveBed.id) };
    }

    case "REQUEST_CAPACITY_REFRESH": {
      // Spec D12: the one thing a coordinator may do to a ward's bed data. This changes no
      // number at all — no field on any unit, release or leave bed is read or written below — it
      // only records that somebody asked, with the time and the requesting role. Nothing leaves
      // the sandbox and no message is sent.
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      return {
        ...state,
        refreshRequests: [...state.refreshRequests, { unitId: unit.id, at: event.now, byRole: event.role }],
      };
    }

    case "RECEIVE_REFERRAL": {
      // Fix round B (review finding I2): the role check above used to be the ONLY guard, and
      // this reducer's own comment said so — `source`, `homeRegion`, `ageBand`, `urgency` and
      // `originSiteCode` all passed through unvalidated. That contradicts the spec's Failure
      // behaviour directly: "a referral missing a required field, or carrying an unknown source
      // … → refused with a visible `Rejection`. Never silently queued, never defaulted." Every
      // check below is a membership check (or, for `originSiteCode`, a resolution against the
      // real site list), not a truthiness test — same discipline as `DECLINE_REFERRAL`'s own
      // `reason` guard below, added in the same commit as the gap this closes. Each failure names
      // what was wrong so a rejected intake is never mistaken for a silent success.
      if (!COHORTS.includes(event.ageBand)) {
        return reject(state, event, `RECEIVE_REFERRAL ageBand must be chosen from COHORTS`);
      }
      // Review finding M1: `sex` was the ONE enum-shaped field on this event with no membership
      // check, though `SEXES` exists for exactly this. It is not a theoretical gap — a non-form
      // caller (a demo control, a Playwright fixture, the guided tour) sending `sex: "F"` used to
      // queue silently, after which `unit.sexMix["F"] ?? 0` is 0 everywhere and
      // `sexDesignationAccepts("Female only", "F")` is false, so the referral matches almost
      // nothing with plausible-looking per-unit reasons instead of being visibly refused.
      //
      // Since the destination union landed, `sex` exists only on the ward arm, so the check is
      // guarded by the arm rather than dropped: the runtime hole this closes is an untyped caller,
      // and an untyped caller can just as easily send a malformed ward destination.
      // FD-21: one act, several destinations, up to the cap. Each of these refusals names a
      // different way the list can be wrong, because "invalid destinations" tells a caller nothing.
      if (event.destinations.length === 0) {
        return reject(state, event, `RECEIVE_REFERRAL needs at least one destination`);
      }
      if (event.destinations.length > state.configuration.parallelReferralCap) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL may address at most ${state.configuration.parallelReferralCap} destinations, not ${event.destinations.length}`,
        );
      }
      const kinds = event.destinations.map((destination) => destination.kind);
      if (new Set(kinds).size !== kinds.length) {
        // Asking one kind twice is asking twice, not addressing two destinations. Refused rather
        // than de-duplicated: silently collapsing it would make the cap count something other than
        // what the referrer chose.
        return reject(state, event, `RECEIVE_REFERRAL cannot address the same destination kind twice`);
      }
      if (kinds.some((kind) => !REFERRAL_DESTINATION_KINDS.includes(kind))) {
        return reject(state, event, `RECEIVE_REFERRAL destination kind must be chosen from REFERRAL_DESTINATION_KINDS`);
      }
      /*
       * ⚠️ THE ED ARM GETS THE SAME TREATMENT AS `originSiteCode`, FOR THE SAME REASON.
       *
       * That field's own comment three checks below says it: "resolved against the real network
       * rather than merely checked for non-emptiness, so '12 Wellington St, Perth' cannot pass as a
       * code." When the ED arm gained `edId` and `purpose` it got neither — so a referral could
       * queue at an empty or invented department and read like an answer.
       *
       * ⚠️ **This is the check that would have caught the shortcut two sessions agreed must not be
       * made.** When the arm grew required fields, three call sites stopped compiling and the
       * tempting repair was a cast or an `edId: ""` stub — a form offering a destination the
       * application cannot construct, while looking finished. That stub was mutation-tested and
       * broke only new SCREEN-level guards and no pre-existing test. A screen guard is the wrong
       * last line: it is one component away from being bypassed, and every path goes through here.
       *
       * ⚠️ **And non-emptiness is not the check.** `edId: "not-a-department"` is as wrong as `""`
       * and far more convincing — it survives every truthiness test, reads as a plausible
       * identifier, and queues a real person at a hospital that does not exist. So it resolves.
       */
      const edDestination = event.destinations.find((destination) => destination.kind === "emergency_department");
      if (edDestination?.kind === "emergency_department") {
        if (!allEmergencyDepartments().some((department) => department.id === edDestination.edId)) {
          return reject(state, event, `RECEIVE_REFERRAL edId must resolve to a real emergency department`);
        }
        if (!REFERRAL_PURPOSES.includes(edDestination.purpose)) {
          return reject(state, event, `RECEIVE_REFERRAL purpose must be chosen from REFERRAL_PURPOSES`);
        }
      }
      const wardDestination = event.destinations.find((destination) => destination.kind === "psychiatric_ward");
      if (wardDestination?.kind === "psychiatric_ward" && !RECORDED_SEXES.includes(wardDestination.sex)) {
        return reject(state, event, `RECEIVE_REFERRAL sex must be chosen from RECORDED_SEXES`);
      }
      // T10, item 8: the ward arm's own gender, checked the same way `sex` immediately above is
      // — membership, never truthiness — and only when supplied at all, since absent means not
      // yet recorded rather than a caller who forgot to answer.
      if (
        wardDestination?.kind === "psychiatric_ward" &&
        wardDestination.gender !== undefined &&
        !REFERRAL_GENDERS.includes(wardDestination.gender)
      ) {
        return reject(state, event, `RECEIVE_REFERRAL gender must be chosen from REFERRAL_GENDERS`);
      }
      if (!REFERRAL_SOURCES.includes(event.source)) {
        return reject(state, event, `RECEIVE_REFERRAL source must be chosen from REFERRAL_SOURCES`);
      }
      // R9 (owner item 23, 2026-09-17): "only `ed_medical` is raised as `ed`, and `ed` with any
      // other source is refused. Everything else, including GP, stays `community`." `EVENT_ROLE`
      // alone cannot express this — it only says role `ed` is SOMETIMES valid for this event type —
      // so the pairing is checked here, once the source itself is known to be real. The reverse
      // pairing (role `community` with source `ed_medical`, raised directly at the front door
      // rather than through the ED's own screen) is left open on purpose —
      // `tests/ward-ed-to-community-referral.test.ts` already depends on it.
      //
      // Checked BEFORE the psychiatric_ward-specific originUnitId check below: an `ed`-role
      // referral naming source `psychiatric_ward` is wrong on the pairing alone, and must be
      // refused for that reason even when `originUnitId` is also missing, rather than surfacing
      // the unrelated originUnitId message and never reaching the pairing rule at all.
      if (event.role === "ed" && event.source !== "ed_medical") {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL raised as role ed must carry source ed_medical, not ${event.source}`,
        );
      }
      if (event.source === "psychiatric_ward") {
        if (!event.originUnitId || !findUnit(state, event.originUnitId)) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL source psychiatric_ward must name a real originUnitId (the sending ward)`,
          );
        }
      }
      // Fix round B (this task's own addition): `homeRegion` is a REGION from a fixed list —
      // never an address, never free text. Membership-checking it here is what makes that
      // distinction real rather than a naming convention; see `HOME_REGIONS`'s own doc comment.
      if (!HOME_REGIONS.includes(event.homeRegion)) {
        return reject(state, event, `RECEIVE_REFERRAL homeRegion must be chosen from HOME_REGIONS`);
      }
      // The suburb is resolved against the real catchment table, never merely checked for
      // non-emptiness — the same reason `edId` and `originSiteCode` below resolve rather than
      // measure. "12 Wellington St, Perth" is non-empty, and letting it through would put a street
      // address in the one field whose defence is that it is coarser than one (`PD-3`).
      if (!referralSuburbIsAnswered(event.suburb)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL suburb must name a suburb the catchment source knows, or state that it is not known`,
        );
      }
      if (event.urgency !== 1 && event.urgency !== 2 && event.urgency !== 3) {
        return reject(state, event, `RECEIVE_REFERRAL urgency must be 1, 2 or 3`);
      }
      // A synthetic site code, never an address — resolved against the real network rather than
      // merely checked for non-emptiness, so "12 Wellington St, Perth" cannot pass as a code.
      const originSite = siteByCode(event.originSiteCode);
      if (!originSite) {
        return reject(state, event, `RECEIVE_REFERRAL originSiteCode must resolve to a real site`);
      }
      /*
       * ⚠️ A REFERRAL FROM ED MEDICAL STAFF MUST COME FROM A HOSPITAL THAT HAS AN ED — the first
       * check here that compares TWO fields rather than validating one.
       *
       * `source` and `originSiteCode` are each independently valid and were never compared, so
       * `{ source: "ed_medical", originSiteCode: "FRE" }` passed both membership tests and
       * described a referral from the emergency department of a hospital that has no emergency
       * department. **Nine sites in `wardSites` have none** — Fremantle, Bentley and the country
       * sites.
       *
       * ⚠️ **NOTHING DOWNSTREAM COULD HAVE CAUGHT IT, WHICH IS WHY IT BELONGS AT THE DOOR.** The
       * row renders complete: no missing value, no blank, no implausible number. Every screen
       * shows a source and a hospital and both are real; only their combination is impossible.
       *
       * ⚠️ **THE CHECK READS THE SITE'S OWN RECORD, NEVER A LIST OF CODES.** `wardSites` is where
       * a hospital's emergency department is declared. A hand-written array of "sites that have
       * one" here would be a second home for that fact and would go stale the first time the
       * network changes — the failure `docs/ward-flow-changeable-data-rule.md` exists for.
       */
      if (event.source === "ed_medical" && !originSite.emergencyDepartment) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL source ed_medical requires an origin site with an emergency department`,
        );
      }
      // A triage instant in the FUTURE would put a patient in the department before they got
      // there, and `referralClocks` clamps at zero rather than printing a negative — so the wrong
      // value would render as a plausible "0m" instead of an obvious error. Refused at the door.
      if (event.triagedAt !== undefined && event.triagedAt > event.now) {
        return reject(state, event, `RECEIVE_REFERRAL triagedAt cannot be later than the referral itself`);
      }
      /*
       * ⚠️ THREE STATES, NOT TWO — and the guard below must only ever separate the second from
       * the third. `event.patientId`'s own doc comment (above, on the event type) says a referral
       * raised outside the patient flow LEGITIMATELY has nobody on file, so ABSENT is a real
       * answer that must keep sailing through untouched — exactly as `created.patientId` below is
       * still "COPIED THROUGH, NEVER DEFAULTED". What was never checked is the other failure
       * shape: a `patientId` that IS present but names nobody `state.patients` holds — a fabricated
       * link that would render as a referral belonging to a patient who is not there, the mistyped-
       * web-address case the front door has no defence against otherwise.
       *
       * This is not a new standard — it matches the sibling that already does this exact job.
       * `RAISE_REFERRAL.referralId` (this file, `case "RAISE_REFERRAL"`, the `findReferral`
       * lookup) refuses an id naming no referral with a visible `Rejection` rather than storing
       * it, on the same "optional because most journeys have none, resolved when present" shape
       * this field's own doc comment cites by name. Read that guard before touching this one.
       *
       * So: absent → `event.patientId === undefined` short-circuits the `&&` and this line does
       * nothing (state 1, fine). Present and real → `.some` finds it and this line does nothing
       * (state 2, fine). Present and naming nobody → `.some` finds nothing and this REFUSES (state
       * 3). Collapsing state 1 into state 3 — dropping the presence check — would refuse every
       * referral raised with no person on file, which is the front door this field exists to keep
       * open.
       */
      if (event.patientId !== undefined && !state.patients.some((patient) => patient.id === event.patientId)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL patientId must name a patient this system already holds, and ${event.patientId} names none`,
        );
      }
      /*
       * ⚠️ THE WRITTEN HISTORY — THE ONLY FIELD ON THIS EVENT THE REDUCER CANNOT MEMBERSHIP-CHECK.
       *
       * Every guard above resolves a value against a closed set. There is no set to check prose
       * against, so exactly two things are enforced here and nothing else is even attempted:
       *
       *   1. It is a string at all — see the shape note below.
       *   2. It does not exceed its limit in `REFERRAL_HISTORY_LIMITS`.
       *
       * ⚠️ **A BLANK STORY IS NO LONGER REFUSED.** It was, until the owner's ruling of 2026-09-05:
       * one story box, OPTIONAL. The rejection that lived here — "a referral needs an account of
       * why it was raised" — was a good sentence about a rule this product no longer has, and the
       * front door no longer goes inert on an empty box either. **`""` is a complete answer.**
       *
       * ⚠️ **AN OVER-LENGTH VALUE IS REFUSED, NEVER TRUNCATED.** `.slice(0, limit)` here would
       * accept the referral and silently drop the tail of somebody's risk note, and the intake
       * would report success. A refusal is visible; a truncation is not, and the part most likely
       * to be cut is the part written last, which on a risk note is usually the part that matters.
       *
       * ⚠️ **NOTHING ELSE IS INSPECTED.** No keyword scan for a name, no check that it "looks
       * clinical", no urgency inferred from its wording. The moment this reducer reads meaning out
       * of this field, the prototype is doing clinical decision support — see `Referral.history`.
       */
      /*
       * ⚠️ THE SHAPE CHECK COMES FIRST, AND IT IS NOT DEFENSIVE PROGRAMMING FOR ITS OWN SAKE.
       *
       * The first version of this block went straight to `.trim()`, which threw a TypeError on any
       * caller that omitted the field — and the reducer's own commentary on `sex` describes exactly
       * who those callers are: "a non-form caller (a demo control, a Playwright fixture, the guided
       * tour)". Three suites found it within a minute of the field landing.
       *
       * **A crash and a refusal are not the same outcome.** A refusal is a `Rejection` a clinician
       * can read; a thrown TypeError unwinds out of `dispatch`, leaves the state untouched, and
       * presents as a button that did nothing at all — the phantom-press failure this file already
       * has a comment about on the officer screen. Every other guard here checks membership before
       * it uses a value, and this one must too — **and it matters MORE now the field is optional**,
       * because an omitted field and a deliberately blank one are the same keystroke away and the
       * loop below is the only thing that tells a caller which mistake it made.
       */
      for (const field of Object.keys(REFERRAL_HISTORY_LIMITS) as ReferralHistoryField[]) {
        if (typeof event[field] !== "string") {
          return reject(state, event, `RECEIVE_REFERRAL ${field} must be text, even when it is empty text`);
        }
      }
      for (const [field, limit] of Object.entries(REFERRAL_HISTORY_LIMITS) as [ReferralHistoryField, number][]) {
        if (event[field].length > limit) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL ${field} is ${event[field].length} characters and the limit is ${limit} — it is refused rather than shortened`,
          );
        }
      }
      /*
       * THE SENDING TEAM'S NAME, AND BOTH REFUSALS ARE DELIBERATE.
       *
       * ⚠️ **A blank-but-present value is REFUSED rather than normalised to `undefined`.** Quietly
       * turning "  " into "no team recorded" would accept a caller's bug and store a different
       * answer from the one it sent -- and a referral that says nobody was recorded, when the
       * front door did try to record somebody, is indistinguishable afterwards from a referral
       * where nobody was asked.
       *
       * ⚠️ **An over-length value is refused rather than shortened**, the same rule `history`
       * follows above: a truncated team name is a DIFFERENT team's name, and it renders as a clean
       * plausible row nothing contradicts.
       */
      if (event.sendingTeamName !== undefined) {
        if (event.sendingTeamName.trim() === "") {
          return reject(
            state,
            event,
            "RECEIVE_REFERRAL sendingTeamName is present but blank — omit the field to record no " +
              "sending team, rather than sending an empty one",
          );
        }
        if (event.sendingTeamName.length > SENDING_TEAM_NAME_LIMIT) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL sendingTeamName is ${event.sendingTeamName.length} characters and the ` +
              `limit is ${SENDING_TEAM_NAME_LIMIT} — it is refused rather than shortened, because a ` +
              `truncated team name is a different team's name`,
          );
        }
      }
      // T15 (item 12): membership-checked exactly like every other closed-list field on this
      // event — `isTentativeDiagnosisBlock` is the same discipline `sex`/`gender`'s own checks
      // above hold to, never a truthiness test. Only checked when supplied at all, since absent
      // means nobody has recorded one.
      if (event.tentativeDiagnosis !== undefined && !isTentativeDiagnosisBlock(event.tentativeDiagnosis)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL tentativeDiagnosis must be chosen from TENTATIVE_DIAGNOSIS_BLOCKS`,
        );
      }
      const sequence = state.frontDoorReferralSequence + 1;
      const created: Referral = {
        id: nextFrontDoorReferralId(sequence),
        // ⚠️ COPIED THROUGH, NEVER DEFAULTED. `undefined` here means the referral was raised
        // without a person on file — which is a real case, not a gap to be filled. Inventing an id
        // to avoid an empty field is how a referral comes to point at the wrong human being.
        patientId: event.patientId,
        ageBand: event.ageBand,
        // Every destination starts queued: the referrer chose them, nobody has answered yet.
        destinations: event.destinations.map((destination) => ({ destination, state: "queued" as const })),
        homeRegion: event.homeRegion,
        suburb: event.suburb,
        source: event.source,
        originUnitId: event.source === "psychiatric_ward" ? event.originUnitId : undefined,
        // Copied through, never defaulted: `undefined` means no sending team was recorded, which
        // is a real answer for a police or ambulance referral and not a gap to be filled.
        sendingTeamName: event.sendingTeamName,
        raisedAt: event.now,
        // Absent for a community expect, which is a real state and not a missing value.
        triagedAt: event.triagedAt,
        urgency: event.urgency,
        originSiteCode: event.originSiteCode,
        transportNeeded: event.transportNeeded,
        // ⚠️ BYTE FOR BYTE, AND THE UNTRIMMED ORIGINAL. The blank check above trims to decide
        // whether anything was written; it does not trim what is kept. A referrer's leading
        // indent and paragraph breaks are part of what they wrote, and a reducer that tidies
        // prose is a reducer that has an opinion about prose.
        history: event.history,
        // T15 (item 12): absent means nobody has recorded one — never defaulted, never derived
        // from anything else on the referral.
        tentativeDiagnosis: event.tentativeDiagnosis,
      };
      return { ...state, referrals: [...state.referrals, created], frontDoorReferralSequence: sequence };
    }

    case "ACCEPT_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /*
       * ⚠️ THE ROLE MUST MATCH THE DESTINATION IT IS ANSWERING — the narrowing half of `FD-3`.
       *
       * `FD-3` was superseded by the owner ("every referral is declinable, and NO CODE PATH MAY
       * RENDER A REFERRAL WITH NO DECLINE AFFORDANCE"), so `ed` joined this event's permitted roles
       * — the ED hub acts as `ed`, and without it an emergency department could not answer a
       * referral addressed to it. Before that, the available workaround was to dispatch as `ward`
       * or `coordinator`, which compiles, works, and writes a FALSE `decidedBy`: the record would
       * say a ward refused a patient an emergency department refused. That is the exact defect
       * `decidedBy` exists to prevent, and nothing would have failed.
       *
       * ⚠️ **But the widening alone is too wide.** With `ed` merely added, an emergency department
       * could accept or refuse a PSYCHIATRIC WARD destination — deciding on a bed in a ward it has
       * nothing to do with — and the resulting record reads as a legitimate refusal. The same hole
       * already existed for `ward`, which could answer an emergency department's destination.
       *
       * So a role answers its own kind and nothing else. The coordinator is exempt because it is
       * the only role that sees the whole picture (`CO-D2`), which is the same reason it may cancel
       * a transport it did not book. `community_team` has no acting role yet; when one arrives it
       * joins this map rather than widening the lists.
       *
       * ⚠️ **THE MAP USED TO BE `Partial`, WHICH MADE THE COORDINATOR'S EXEMPTION INDISTINGUISHABLE
       * FROM A ROLE NOBODY HAD DECIDED ABOUT.** `answerableBy[event.role]` came back `undefined` for
       * any role absent from the map — true of the coordinator's deliberate `CO-D2` exemption, but
       * EQUALLY true of any role added to `WardFlowRole` in future and simply never added here.
       * Nothing would fail; the new role would pass this guard for every destination kind,
       * unnoticed. `answerableBy` is now a TOTAL record over `WardFlowRole` — no `Partial` — with
       * each entry spelled `ReferralDestinationKind | "any"`. A role missing an entry is now a
       * compiler error naming this map, not a silent bypass.
       *
       * `coordinator: "any"` IS `CO-D2` — written down now, rather than implied by absence.
       * `officer`, `demo` and `community` are also `"any"` here, not because any of the three may
       * decide a referral, but because none of them can reach this line at all: `EVENT_ROLE`
       * (checked first, before this switch, at the top of this reducer) permits only `ward`,
       * `coordinator` and `ed` to raise `ACCEPT_REFERRAL`/`DECLINE_REFERRAL`. Their entries exist
       * only so the record type-checks as total — they reproduce the OLD `Partial` map's behaviour
       * at this exact line (absent from the map → unconditional pass) rather than asserting that any
       * of the three owns a destination. Widening `EVENT_ROLE` to let one of them reach this code is
       * a separate, deliberate decision — the same kind of decision that added `ed`, above — and
       * does not follow from this entry existing.
       */
      const answerableBy: Record<WardFlowRole, ReferralDestinationKind | "any"> = {
        ward: "psychiatric_ward",
        ed: "emergency_department",
        coordinator: "any",
        officer: "any",
        demo: "any",
        /*
         * 🔴 `community_team`, NOT `"any"` — owner ruling 2026-09-06, and the comment above
         * predicted this exact edit: "`community_team` has no acting role yet; when one arrives it
         * joins this map rather than widening the lists."
         *
         * It arrived. `EVENT_ROLE.DECLINE_REFERRAL` now permits `community`, so this role CAN reach
         * this line — and `"any"` would have let a community team decline a psychiatric ward's bed.
         * Set in BOTH the accept and decline handlers although `community` is only permitted to
         * decline: if the accept list is ever widened, the ownership check is already correct rather
         * than silently open.
         */
        community: "community_team",
        bed_manager: "any",
        executive: "any",
      };
      const ownKind = answerableBy[event.role];
      if (ownKind !== "any" && ownKind !== event.destinationKind) {
        return reject(
          state,
          event,
          `${event.type} was raised by role ${event.role}, which may only answer ${ownKind.replace(/_/g, " ")} destinations, not ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const addressing = referral.destinations.find(
        (candidate) => candidate.destination.kind === event.destinationKind,
      );
      if (!addressing) {
        return reject(
          state,
          event,
          `referral ${referral.id} was not addressed to ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      // FD-22: the first acceptance ends the placement. A second destination accepting afterwards
      // would mean two places believing they had taken the same person -- the exact outcome the
      // automatic cancellation exists to prevent, so it is refused rather than recorded.
      //
      // 🔴 RB5 (item 16): NOT for a community arm. `referralState` already excludes a community
      // acceptance from "the placement is settled" WHILE a ward or ED destination is still queued
      // (see that function's own doc comment) -- but once a ward or ED HAS accepted, referralState
      // reads "accepted" too, and a bare `referralState(referral) === "accepted"` check here would
      // then refuse the community team's own accept, exactly the "ward and ED arms stay answerable,
      // and the community arm stays answerable after they say yes" target this item exists for. A
      // community answer never competes for the placement (FD-22's own exemption, below), so it is
      // never blocked by one -- this is that same exemption, at the guard that decides whether an
      // answer is even attempted.
      if (event.destinationKind !== "community_team" && referralState(referral) === "accepted") {
        return reject(state, event, `referral ${referral.id} has already been accepted elsewhere`);
      }
      // Per-destination, not per-referral: another destination having declined leaves this one
      // free to answer (FD-24). Only THIS destination being already decided is a refusal.
      if (addressing.state !== "queued") {
        return reject(
          state,
          event,
          `${event.destinationKind.replace(/_/g, " ")} has already answered referral ${referral.id} (${addressing.state})`,
        );
      }
      /*
       * ⚠️ **`RECORD_REFERRER_WITHDRAWAL` STAMPS `withdrawnAt`, NEVER `state` — O-17.11, and that is
       * deliberate: `state` has exactly one `switch` over it in `src` with no `never` guard, so a
       * fifth state would have bought almost no compiler help. The guard above therefore cannot see
       * a withdrawal at all**, and this destination could still be accepted after the referrer took
       * the whole referral back. Checked here, its own guard, not folded into the `state !== "queued"`
       * check above: `state` and `withdrawnAt` are two different facts about this destination, and
       * conflating them is exactly the trap O-17.11 was written to avoid on every OTHER reader too.
       */
      if (addressing.withdrawnAt !== undefined) {
        return reject(
          state,
          event,
          `referral ${referral.id} was withdrawn by its referrer, so ${event.destinationKind.replace(/_/g, " ")} cannot accept it`,
        );
      }

      let accepted: ReferralAddressing;
      // T12 (item 9): set only inside the ward branch below, when this acceptance is the FIRST
      // thing to clear a `Non-binary` referral for this specific unit.
      let genderPlacementAddition:
        | {
            at: Instant;
            by: WardFlowRole;
            unitIds: string[];
            reason: (typeof GENDER_PLACEMENT_REASONS)[number];
            wardChecked: true;
          }
        | undefined;
      if (addressing.destination.kind === "psychiatric_ward") {
        /*
         * P2-6 (Ward Lead audit, 2026-09-17): a front-door referral can be addressed to a
         * psychiatric ward AND an emergency department at once, and `RAISE_REFERRAL`'s own
         * uniqueness guard (above) only stops a SECOND movement being raised from this referral —
         * it says nothing about the ward arm answering while the FIRST one, raised from the ED
         * arm, is still under way. Left unguarded, a ward could accept this referral into a bed
         * while the ED's own movement carries on as an open journey for the same patient: two
         * places both believing they have taken the same person, the same double-journey shape
         * `RAISE_REFERRAL`'s guard exists to prevent from the movement side. `isOpen`'s own
         * definition, inlined for the identical reason `RAISE_REFERRAL`'s guard inlines it rather
         * than importing `ward-derivations.ts` (see that guard's own comment on the circular
         * module edge).
         */
        const openLinkedMovement = state.movements.find(
          (movement) => movement.referralId === referral.id && !movement.closure && movement.stage !== "arrived",
        );
        if (openLinkedMovement) {
          return reject(
            state,
            event,
            `referral ${referral.id} already has an open movement (${openLinkedMovement.id}); it cannot also be accepted into a ward while that movement is open`,
          );
        }
        // Only a ward acceptance names a unit, and only a ward acceptance runs the bed gates.
        if (!event.unitId) {
          return reject(state, event, `ACCEPT_REFERRAL into a psychiatric ward must name a unit`);
        }
        const unit = findUnit(state, event.unitId);
        if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
        /*
         * 🔴 T12 (item 9, owner answer 9): the front door's own half of the same rule
         * `REFER_TO_UNITS` holds on the movement path — see `GenderPlacement`'s own doc comment
         * (`ward-model.ts`). Checked here, before the eligibility gate, and refuses the WHOLE
         * acceptance rather than something a reason can buy past.
         */
        if (
          genderReviewNeeded(addressing.destination.gender, addressing.destination.sex) &&
          !(referral.genderPlacements ?? []).some((record) => record.unitIds.includes(unit.id))
        ) {
          if (event.role !== "coordinator") {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (event.genderPlacementReason === undefined || event.genderPlacementChecked !== true) {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (!GENDER_PLACEMENT_REASONS.includes(event.genderPlacementReason)) {
            return reject(
              state,
              event,
              `ACCEPT_REFERRAL genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS`,
            );
          }
          genderPlacementAddition = {
            at: event.now,
            by: event.role,
            unitIds: [unit.id],
            reason: event.genderPlacementReason,
            // Same discipline as `REFER_TO_UNITS`'s own write above: the tick is validated `true`
            // two lines up, and `wardChecked` stores it on the record rather than the reason text.
            wardChecked: true,
          };
        }
        // The failing gate is named in the rejection, not just "ineligible" -- `referralEligibility`
        // (ward-eligibility.ts) already produces a human-readable detail per gate; reusing it here
        // is what keeps this refusal and the match view's own "why not here?" reading identically.
        // 🔴 Owner reversal, item 2: same same-act fix as `REFER_TO_UNITS`'s own
        // `movementForEligibility` above — `genderPlacementAddition` is this event's own pending
        // write, not yet on `referral`, and the `gender_designation` gate must see it now so a
        // coordinator can clear a single-gender ward's designation and its placement record in one
        // acceptance. `referral` itself is committed unchanged below; only this local eligibility
        // read is widened.
        const referralForEligibility: Referral =
          genderPlacementAddition === undefined
            ? referral
            : { ...referral, genderPlacements: [...(referral.genderPlacements ?? []), genderPlacementAddition] };
        const acceptRefusal = referralAcceptanceRefusal(
          event,
          referralForEligibility,
          addressing.destination,
          unit,
          event.now,
        );
        if (acceptRefusal.refusal) return reject(state, event, acceptRefusal.refusal);
        decision.overrideFactRecorded = acceptRefusal.overrideApplied;
        accepted = {
          ...addressing,
          state: "accepted",
          acceptedUnitId: unit.id,
          decidedAt: event.now,
          decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
          // Written unconditionally, not only in the override branch: `...addressing` above could
          // otherwise carry a reason forward from an earlier state onto a clean acceptance, which
          // would read afterwards as a rule bent that nobody bent.
          acceptOverrideReason: acceptRefusal.overrideApplied ? event.overrideReason : undefined,
        };
      } else {
        // An ED, a medical ward and a community team are answered by a person or a team. There is
        // no bed to gate on and no unit to name, so a `unitId` sent with one of these would be a
        // caller's mistake rather than a detail to ignore.
        if (event.unitId) {
          return reject(
            state,
            event,
            `${event.destinationKind.replace(/_/g, " ")} is answered by a team, not a bed — it cannot name a unit`,
          );
        }
        accepted = {
          ...addressing,
          state: "accepted",
          decidedAt: event.now,
          decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
        };
      }

      // FD-22, and the reason it is here rather than on a screen: the first acceptance cancels
      // every destination still waiting, automatically, with no coordination step. A DECLINED
      // destination is left exactly as it was -- its refusal, its time and its reason stay on the
      // record, which is the surviving half of the decision FD-24 retired.
      /*
       * ⚠️ **BEFORE YOU CHANGE WHAT THIS CANCELS, READ THIS. THREE CHANGES COMBINE TO HIDE A
       * PATIENT, AND NONE OF THE THREE POINTS AT THE OTHER TWO.** Established 2026-09-01 by Ward
       * Builder Two and Ward Verifier and re-verified against both trees by Ward Lead; recorded
       * HERE because this is the only one of the three sites a person editing the cancellation
       * will certainly open.
       *
       *   A. **The symmetry change** — an acceptance of a LEAVING destination cancels nothing,
       *      the mirror of the community carve-out immediately below. Not made; parked on the
       *      owner as question 7.
       *   B. **Wiring `coordinatorWorksReferral` to a real screen.** `coordinatorWorklistReferrals`
       *      (ward-referral-visibility.ts) is defined and used by NOTHING — measured, with a
       *      known-positive control, at `124376628`. It will be wired later for reasons that have
       *      nothing to do with this block.
       *   C. **Branch 2 answering from a lone accepted arm**, ignoring anything still queued
       *      beside it. Fixed on `claude/ward-builder-two` (`1b86cee6e`); NOT yet on this line.
       *
       * **Any two are harmless. All three hide a patient**: a person physically in an emergency
       * department, still awaiting a psychiatric decision, drops off the coordinator's work list
       * because a community team accepted their discharge follow-up — and no record says anybody
       * refused them, because nobody did.
       *
       * ⚠️ **THE TRAP IS THAT A IS THE SAFE-LOOKING ONE.** A stops something being cancelled. It
       * reads as strictly protective and, on its own today, it is. It turns harmful only in
       * combination with a wiring step somebody does months later for unrelated reasons. **So the
       * rule is not an order of work — it is: A and B must not both be on this line while C is.**
       * Folding `claude/ward-builder-two` satisfies it permanently and is the simplest route.
       *
       * ⚠️ **AND A IS NOT A ONE-LINE CHANGE. IT TURNS A PRIVACY TEST RED IN A FILE THIS HANDLER
       * DOES NOT OWN, AND THE RED WILL NOT LOOK LIKE YOUR CHANGE.** Established 2026-09-01 by Ward
       * Builder Two and Ward Verifier, each refuting the other's first answer, and re-verified here.
       *
       * `multiDestinationReferral()` in `tests/ward-referral-visibility.test.ts` gets its
       * `"cancelled"` marker from a coordinator accepting the community arm, which cancels the
       * queued emergency-department arm. **After A, a leaving acceptance cancels nothing, the marker
       * vanishes, and the positive control that proves the FD-23 privacy sweep is non-vacuous goes
       * red.** It will present as the privacy sweep breaking. Nothing in that file points here.
       *
       * ⚠️ **DO NOT RESHAPE THAT FIXTURE, AND DO NOT REMOVE `"cancelled"` FROM THE MARKER LIST.**
       * The file already names the second move as forbidden — it is making a red test green by
       * weakening a privacy sweep — and it is exactly the move the red invites. The first move has
       * been worked through and provably does not exist. `ELSEWHERE_MARKERS` requires BOTH
       * `"cancelled"` and `"Flow coordinator"`, so the coordinator must decide something AND an
       * arriving acceptance must cancel a queued sibling; with the ward declined (which that fixture
       * must keep, because the ward saying no while somebody else says yes IS the privacy case it
       * exists for), every arrangement fails:
       *
       *   coordinator accepts community  → post-A, cancels nothing
       *   coordinator accepts ED         → only remaining sibling is community, which is protected
       *   ward accepts                   → cancels the ED arm, but `decidedBy` is
       *                                    `WARD_FLOW_ROLE_LABELS[event.role]`, so it writes
       *                                    "Ward manager" and "Flow coordinator" disappears instead
       *   a fourth destination           → refused by `PARALLEL_REFERRAL_CAP` (3)
       *   a second emergency department  → breaks the field-set allowlists (an ED arm carries
       *                                    `edId` and `purpose`, a community arm carries `teamName`)
       *
       * **The fault is one level above the fixture and A merely reveals it: one marker set is doing
       * two jobs.** `"cancelled"` belongs to its own small fixture; this one belongs to the privacy
       * sweep. **The repair is to split them, and it lives in that test file, not here.** Reshaping
       * that fixture is what built the trap — it has already been reshaped twice today, both times
       * by the two halves of the same owner ruling.
       *
       * ⚠️ **AND NOTHING TESTS THIS BLOCK'S CENTRAL BEHAVIOUR.** Every existing test drives a WARD
       * acceptance; none drives a community one, so whether a community acceptance cancels the
       * queued arriving arms is pinned by nothing at all (Ward Verifier, 2026-09-01). The test is
       * deliberately unwritten rather than forgotten: **written today it must assert the
       * cancellation, and after A it must assert the opposite.** Write it with A, not before it.
       */
      const destinations = referral.destinations.map((candidate) => {
        if (candidate === addressing) return accepted;
        if (candidate.state !== "queued") return candidate;
        /*
         * 🔴 **RB5 (item 16): A COMMUNITY ACCEPTANCE CANCELS NOTHING.** The exemption two lines
         * below protects a community_team destination from being cancelled by somebody ELSE's
         * acceptance -- it says nothing about the reverse. Before this fix, a community team
         * accepting its OWN arm still ran this same map over every other queued destination and
         * cancelled the ward and the ED, because neither of THEM is `community_team`. That is
         * exactly the "cancel queued arms when a community team accepts" defect this item exists
         * to close: a community acceptance decides nothing about the bed (see `referralState`'s own
         * doc comment), so it must cancel nothing either -- FD-22 governs destinations competing
         * for the SAME placement, and a follow-up team was never in that race regardless of which
         * side of the acceptance it sits on.
         */
        if (accepted.destination.kind === "community_team") return candidate;
        /*
         * ⚠️ **A COMMUNITY TEAM IS NEVER CANCELLED BY SOMEBODY ELSE'S ACCEPTANCE.** Owner ruling,
         * 2026-09-01, and his definition is the reason rather than the rule: *"Community referral
         * means a patient is about to be discharged"*.
         *
         * **A community referral does not COMPETE with a bed — it means the patient is on their way
         * OUT.** So cancelling it because a ward said yes was the app cancelling DISCHARGE PLANNING at
         * the exact moment admission was confirmed. FD-22 is about destinations racing for the same
         * placement; a follow-up team is not in that race.
         *
         * ⚠️ **THIS DEFECT DISPLAYED NOWHERE, WHICH IS THE FRAGILE KIND OF CORRECT.**
         * `admissionBelongsToTeam` reads a destination's kind and team name and never its state —
         * deliberately, because a cancelled referral still named that team. So nothing showed it, and
         * anyone later "tightening" the hub to respect state would have made it live and people would
         * have vanished from team pages. Fixing it here removes the trap at source.
         */
        if (candidate.destination.kind === "community_team") return candidate;
        return { ...candidate, state: "cancelled" as const, decidedAt: event.now };
      });
      // Spec D14: acceptance decides only that the network takes this referral -- it creates NO
      // `Movement`. Wiring an accepted referral into one needs an `originEdId`, a legal status
      // and a stage machine, every one of which is entangled with Phase 8's geography work; that
      // seam is deliberate, not an oversight, and `tests/ward-referral-reducer.test.ts` asserts
      // it explicitly so a future change has to argue with a test rather than slip past.
      const next = replaceReferral(state, referral.id, {
        ...referral,
        destinations,
        // T12 (item 9): appended only when this acceptance itself supplied a fresh clearance —
        // absent (`undefined`) leaves `referral.genderPlacements` untouched, same "nothing to add"
        // discipline `REFER_TO_UNITS`'s own `movement.genderPlacements` update holds to.
        genderPlacements:
          genderPlacementAddition === undefined
            ? referral.genderPlacements
            : [...(referral.genderPlacements ?? []), genderPlacementAddition],
      });
      /*
       * Communication addendum §1.3: "ACCEPT_REFERRAL — the referrer and the receiving ward —
       * both sides of a commitment." Two independent, optional notices, each with its own
       * `NoticeKind` (never sharing one, so the two can never collide under `makeNotice`'s
       * `(subject, kind, count)` id rule even though both share `about.referralId`):
       *
       *   - the referrer, ONLY when `referralReferrer` can resolve one safely (see that function's
       *     own doc comment for why four of `REFERRAL_SOURCES`' five other members never do);
       *   - the receiving ward, ONLY when this acceptance is a psychiatric-ward one — the only
       *     destination kind that names a unit at all. An ED or community-team acceptance commits
       *     a team, not a ward, and the addendum's own words name "the receiving WARD" specifically.
       *
       * Fix round 1 (review finding, Minor — "fix this one too"): the referrer's own sentence names
       * the actual unit, not merely the destination KIND, whenever a unit is known. `event.unitId`
       * is only ever present and validated to a real unit on the psychiatric-ward branch (the same
       * guard the ward-side notice below relies on), so `unitName` never falls back to a bare id
       * here in practice — the destination-kind wording stays only for the ED/community-team
       * acceptances that never name a unit at all.
       */
      const referralNotices: Notice[] = [];
      const referrer = referralReferrer(referral);
      if (referrer !== undefined) {
        const acceptedBy =
          addressing.destination.kind === "psychiatric_ward" && event.unitId !== undefined
            ? unitName(state, event.unitId)
            : event.destinationKind.replace(/_/g, " ");
        referralNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "referral_accepted_referrer",
            referrer,
            { referralId: referral.id },
            `${acceptedBy} accepted referral ${referral.id}.`,
          ),
        );
      }
      if (addressing.destination.kind === "psychiatric_ward" && event.unitId !== undefined) {
        referralNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "referral_accepted_ward",
            { role: "ward", placeId: event.unitId },
            { referralId: referral.id, unitId: event.unitId },
            `${unitName(state, event.unitId)} accepted referral ${referral.id}. No bed is pulled and no movement is created.`,
          ),
        );
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return appendNotices(next, referralNotices);
    }

    case "DECLINE_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /*
       * ⚠️ THE ROLE MUST MATCH THE DESTINATION IT IS ANSWERING — the narrowing half of `FD-3`.
       *
       * `FD-3` was superseded by the owner ("every referral is declinable, and NO CODE PATH MAY
       * RENDER A REFERRAL WITH NO DECLINE AFFORDANCE"), so `ed` joined this event's permitted roles
       * — the ED hub acts as `ed`, and without it an emergency department could not answer a
       * referral addressed to it. Before that, the available workaround was to dispatch as `ward`
       * or `coordinator`, which compiles, works, and writes a FALSE `decidedBy`: the record would
       * say a ward refused a patient an emergency department refused. That is the exact defect
       * `decidedBy` exists to prevent, and nothing would have failed.
       *
       * ⚠️ **But the widening alone is too wide.** With `ed` merely added, an emergency department
       * could accept or refuse a PSYCHIATRIC WARD destination — deciding on a bed in a ward it has
       * nothing to do with — and the resulting record reads as a legitimate refusal. The same hole
       * already existed for `ward`, which could answer an emergency department's destination.
       *
       * So a role answers its own kind and nothing else. The coordinator is exempt because it is
       * the only role that sees the whole picture (`CO-D2`), which is the same reason it may cancel
       * a transport it did not book. `community_team` has no acting role yet; when one arrives it
       * joins this map rather than widening the lists.
       *
       * ⚠️ **THE MAP USED TO BE `Partial`, WHICH MADE THE COORDINATOR'S EXEMPTION INDISTINGUISHABLE
       * FROM A ROLE NOBODY HAD DECIDED ABOUT.** `answerableBy[event.role]` came back `undefined` for
       * any role absent from the map — true of the coordinator's deliberate `CO-D2` exemption, but
       * EQUALLY true of any role added to `WardFlowRole` in future and simply never added here.
       * Nothing would fail; the new role would pass this guard for every destination kind,
       * unnoticed. `answerableBy` is now a TOTAL record over `WardFlowRole` — no `Partial` — with
       * each entry spelled `ReferralDestinationKind | "any"`. A role missing an entry is now a
       * compiler error naming this map, not a silent bypass.
       *
       * `coordinator: "any"` IS `CO-D2` — written down now, rather than implied by absence.
       * `officer`, `demo` and `community` are also `"any"` here, not because any of the three may
       * decide a referral, but because none of them can reach this line at all: `EVENT_ROLE`
       * (checked first, before this switch, at the top of this reducer) permits only `ward`,
       * `coordinator` and `ed` to raise `ACCEPT_REFERRAL`/`DECLINE_REFERRAL`. Their entries exist
       * only so the record type-checks as total — they reproduce the OLD `Partial` map's behaviour
       * at this exact line (absent from the map → unconditional pass) rather than asserting that any
       * of the three owns a destination. Widening `EVENT_ROLE` to let one of them reach this code is
       * a separate, deliberate decision — the same kind of decision that added `ed`, above — and
       * does not follow from this entry existing.
       */
      const answerableBy: Record<WardFlowRole, ReferralDestinationKind | "any"> = {
        ward: "psychiatric_ward",
        ed: "emergency_department",
        coordinator: "any",
        officer: "any",
        demo: "any",
        /*
         * 🔴 `community_team`, NOT `"any"` — owner ruling 2026-09-06, and the comment above
         * predicted this exact edit: "`community_team` has no acting role yet; when one arrives it
         * joins this map rather than widening the lists."
         *
         * It arrived. `EVENT_ROLE.DECLINE_REFERRAL` now permits `community`, so this role CAN reach
         * this line — and `"any"` would have let a community team decline a psychiatric ward's bed.
         * Set in BOTH the accept and decline handlers although `community` is only permitted to
         * decline: if the accept list is ever widened, the ownership check is already correct rather
         * than silently open.
         */
        community: "community_team",
        bed_manager: "any",
        executive: "any",
      };
      const ownKind = answerableBy[event.role];
      if (ownKind !== "any" && ownKind !== event.destinationKind) {
        return reject(
          state,
          event,
          `${event.type} was raised by role ${event.role}, which may only answer ${ownKind.replace(/_/g, " ")} destinations, not ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const addressing = referral.destinations.find(
        (candidate) => candidate.destination.kind === event.destinationKind,
      );
      if (!addressing) {
        return reject(
          state,
          event,
          `referral ${referral.id} was not addressed to ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      // RB5 (item 16): the same community exemption as `ACCEPT_REFERRAL`'s own guard, above -- a
      // community team may still decline its own arm after a ward or ED has accepted.
      if (event.destinationKind !== "community_team" && referralState(referral) === "accepted") {
        return reject(state, event, `referral ${referral.id} has already been accepted elsewhere`);
      }
      if (addressing.state !== "queued") {
        return reject(
          state,
          event,
          `${event.destinationKind.replace(/_/g, " ")} has already answered referral ${referral.id} (${addressing.state})`,
        );
      }
      // Same gap as ACCEPT_REFERRAL's own withdrawal guard above, and the same reasoning: O-17.11's
      // `withdrawnAt` is a separate fact from `state` and the guard above cannot see it.
      if (addressing.withdrawnAt !== undefined) {
        return reject(
          state,
          event,
          `referral ${referral.id} was withdrawn by its referrer, so ${event.destinationKind.replace(/_/g, " ")} cannot decline it`,
        );
      }
      // Membership check, not truthiness -- same discipline as FLAG_BED_RELEASE's own comment on
      // this exact shape of check above. Phase 5 shipped a truthiness test in this position
      // (`!event.blocker`, which refuses a missing/empty value but accepts any other non-empty
      // string) and review caught it; "chosen from a fixed list, never typed" is a runtime rule.
      //
      // ⚠️ **SCOPED TO THE DESTINATION KIND THAT IS ANSWERING, NOT TO ONE SHARED LIST — O-16.6,
      // community-decline engine fix, 2026-09-17.** A community team's decline and a ward's decline
      // are different acts with ZERO overlap in meaning (`COMMUNITY_DECLINE_REASONS`'s own doc
      // comment, `ward-model.ts`, records the measurement), so checking `event.reason` against the
      // union of every vocabulary would accept a bed-placement reason for a community refusal —
      // exactly the wrong-reason-is-worse-than-no-reason failure that ruling exists to prevent. Each
      // destination kind is checked only against ITS OWN list; `psychiatric_ward` keeps the full
      // `REFERRAL_DECLINE_REASONS` it always answered from, unchanged.
      const declineReasonsFor: Record<
        ReferralDestinationKind,
        readonly (ReferralDeclineReason | CommunityDeclineReason)[]
      > = {
        psychiatric_ward: REFERRAL_DECLINE_REASONS,
        emergency_department: ED_DECLINE_REASONS,
        community_team: COMMUNITY_DECLINE_REASONS,
      };
      const declineReasonListName: Record<ReferralDestinationKind, string> = {
        psychiatric_ward: "REFERRAL_DECLINE_REASONS",
        emergency_department: "ED_DECLINE_REASONS",
        community_team: "COMMUNITY_DECLINE_REASONS",
      };
      if (!declineReasonsFor[event.destinationKind].includes(event.reason)) {
        return reject(
          state,
          event,
          `DECLINE_REFERRAL reason must be chosen from ${declineReasonListName[event.destinationKind]}, the vocabulary for ${event.destinationKind.replace(/_/g, " ")} destinations`,
        );
      }
      // ⚠️ **ONE FIELD, TWO VOCABULARIES, BY NECESSITY RATHER THAN CHOICE — moved here from
      // `ReferralAddressing.declineReason`'s own doc comment (`ward-model.ts`) on 2026-09-17, so
      // that field carries a sentence rather than this reasoning.** `ReferralAddressing` is not
      // discriminated on `destination.kind` (see that type's own history — every arm's own fields
      // live on `ReferralDestination` instead), so nothing on the field itself can narrow
      // `declineReason`'s type PER destination kind without a much larger restructure. The check just
      // above is what actually holds the two vocabularies apart at runtime, by refusing any
      // `event.reason` not drawn from `event.destinationKind`'s own list before ever writing below —
      // so a `community_team` addressing's `declineReason` is a `ReferralDeclineReason` only in the
      // type system, never in fact.
      //
      // FD-24: this destination declines and NOTHING ELSE CHANGES. The other destinations stay
      // queued, this ward is not locked out of anything later, and the refusal stays on the record
      // with its time and its reason.
      const destinations = referral.destinations.map((candidate) =>
        candidate === addressing
          ? {
              ...candidate,
              state: "declined" as const,
              declineReason: event.reason,
              decidedAt: event.now,
              decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
            }
          : candidate,
      );
      const next = replaceReferral(state, referral.id, { ...referral, destinations });
      // Communication addendum §1.3 ("DECLINE_REFERRAL / DECLINE — the referrer") and FD-23: the
      // decline reason reaches THAT referral's referrer and no other team. `referralReferrer`
      // returns `undefined` for every source but `ed_medical` (see its own doc comment), so no
      // notice is raised at all for the other five — no notice is safer than a wrongly-addressed
      // one. Shares `NoticeKind` "referral_declined" with the movement-level `DECLINE` above.
      const referrer = referralReferrer(referral);
      if (referrer === undefined) return next;
      // Fix round 1 (review finding, Important 3): the reason half of this sentence reads through
      // `DECLINE_REASON_LABELS` — this repo's one spelling of a decline reason
      // (`ward-referrals.ts`) — never `event.reason.replace(/_/g, " ")`. That idiom is correct for
      // the other three reason enums, which have no label map; it is wrong here specifically
      // because `another_reason`'s curated label ("Another reason — needs follow-up") carries real
      // meaning the plain de-underscored text drops, and the referrer is exactly the person who
      // must do the following up.
      //
      // ⚠️ **TWO LABEL MAPS NOW, ONE FOR EACH VOCABULARY — O-16.6, 2026-09-17.** `event.reason` is
      // `ReferralDeclineReason | CommunityDeclineReason`, so a single `Record` keyed by either alone
      // cannot index it without a cast — the same `as Record<string, string>` fallback pattern
      // `referral-board.tsx`'s own `refusalLines` and `referralAddressingStateLabel`
      // (`ward-referrals.ts`) already use for this identical shape, kept consistent here rather than
      // invented afresh.
      const declineLabel =
        (DECLINE_REASON_LABELS as Record<string, string>)[event.reason] ??
        (COMMUNITY_DECLINE_REASON_LABELS as Record<string, string>)[event.reason] ??
        event.reason;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "referral_declined",
          referrer,
          { referralId: referral.id },
          `${event.destinationKind.replace(/_/g, " ")} declined referral ${referral.id} (${declineLabel}).`,
        ),
      ]);
    }

    /**
     * 🔴 **FD-5 — THE REFERRER TOOK THE REFERRAL BACK (O-17.11).**
     *
     * **A FIELD, NOT A FIFTH STATE, and the reason is the codebase's own weakness rather than a
     * preference:** exactly one switch in `src` covers `addressing.state` and it carries no `never`
     * guard, so a fifth state would buy almost no compiler help — every existing `=== "queued"`
     * comparison would silently keep its old meaning and a withdrawn referral would go on counting as
     * open, green all the way. **The state is deliberately left untouched here.**
     *
     * ⚠️ **UNSCOPED, EVERY WAITING DESTINATION, NOT ONE.** A decline names its destination because
     * one service is answering. An unscoped withdrawal carries no `destinationKind` because the
     * SENDER is taking back the whole referral. 🔴 **A destination that already answered keeps its
     * answer** — a refusal is a recorded clinical decision and is never unmade by somebody else
     * changing their mind.
     *
     * 🔴 **OWNER RULING 11 (2026-09-17) IS THE ONE NAMED EXCEPTION** — `destinationKind:
     * "community_team"` withdraws that one arm alone, checked and returned from in its own branch
     * below before any of the unscoped logic runs. See this event's own doc comment
     * (`ward-flow-events.ts`) for the ruling.
     */
    case "RECORD_REFERRER_WITHDRAWAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);

      /*
       * 🔴 OWNER RULING 11 (2026-09-17) — THE SCOPED BRANCH, checked first and returned from
       * entirely separately from the whole-referral path below. See this event's own doc comment
       * (`ward-flow-events.ts`) for the ruling. Kept as its own self-contained branch rather than
       * woven into the unscoped logic below, so every existing whole-referral behaviour — and every
       * test pinning it — is untouched when `destinationKind` is absent.
       */
      if (event.destinationKind === "community_team") {
        const addressing = referral.destinations.find((candidate) => candidate.destination.kind === "community_team");
        if (!addressing) {
          return reject(state, event, `referral ${referral.id} was not addressed to a community team`);
        }
        if (addressing.withdrawnAt !== undefined) {
          return reject(state, event, `the community team on referral ${referral.id} was already withdrawn`);
        }
        // A team that already answered (accepted or declined) keeps its answer — the same "a
        // destination that already answered is not withdrawn" rule the unscoped path below holds
        // to, checked here against just this one destination rather than the whole referral, which
        // is exactly what lets a still-queued community arm be taken back after a DIFFERENT
        // destination (the ward) has already accepted (RB5's own DECLINE_REFERRAL exemption reads
        // the identical way: "a community team is not in the race FD-22 governs").
        if (addressing.state !== "queued") {
          return reject(
            state,
            event,
            `the community team on referral ${referral.id} has already answered (${addressing.state}), so its arm cannot be withdrawn`,
          );
        }
        if (event.reason === undefined || !WARD_REQUEST_WITHDRAWAL_REASONS.includes(event.reason)) {
          return reject(
            state,
            event,
            `RECORD_REFERRER_WITHDRAWAL scoped to community_team must give a reason from WARD_REQUEST_WITHDRAWAL_REASONS`,
          );
        }
        const destinations = referral.destinations.map((candidate) =>
          candidate === addressing
            ? {
                ...candidate,
                withdrawnAt: event.now,
                withdrawalRecordedBy: WARD_FLOW_ROLE_LABELS[event.role],
                withdrawalReason: event.reason,
              }
            : candidate,
        );
        const next: WardFlowState = {
          ...state,
          referrals: state.referrals.map((candidate) =>
            candidate.id === referral.id ? { ...candidate, destinations } : candidate,
          ),
        };
        // Guaranteed by the `find` above (it only matches a `community_team` destination), read
        // defensively rather than asserted — the same conservative-failure shape `ward-place.ts`
        // holds throughout: an unresolvable name degrades to "no notice", never a wrong one.
        const teamName = addressing.destination.kind === "community_team" ? addressing.destination.teamName : undefined;
        if (teamName === undefined) return next;
        return appendNotices(next, [
          makeNotice(
            event.now,
            next.notices.length,
            "community_referral_withdrawn",
            { role: "community", placeId: communityTeamSlug(teamName) },
            { referralId: referral.id },
            `The referrer withdrew this referral's request to your team; referral ${referral.id}.`,
          ),
        ]);
      }

      /*
       * ⚠️ A referral somebody has already accepted is not withdrawable: the person has a bed, or is
       * on their way to one. A record saying the referrer took it back would contradict an admission
       * that is already happening — and `referralState` is the one place that question is answered,
       * rather than a second scan over `destinations` here.
       */
      if (referralState(referral) === "accepted") {
        return reject(state, event, `referral ${referral.id} has already been accepted, so it cannot be withdrawn`);
      }
      if (
        referral.destinations.some(
          (addressing) => addressing.destination.kind !== "community_team" && addressing.withdrawnAt !== undefined,
        )
      ) {
        return reject(state, event, `referral ${referral.id} has already been recorded as withdrawn by its referrer`);
      }
      /*
       * ⚠️ Nothing left waiting means nothing to withdraw — every destination has answered. Refused
       * rather than written as a no-op, because a silent success would put a withdrawal time on a
       * referral where it changes no figure and later reads as evidence somebody withdrew in time.
       */
      const waiting = referral.destinations.filter(
        (addressing) => addressing.state === "queued" && addressing.withdrawnAt === undefined,
      );
      if (waiting.length === 0) {
        return reject(state, event, `every destination on referral ${referral.id} has already answered`);
      }

      const destinations = referral.destinations.map((addressing) =>
        addressing.state === "queued" && addressing.withdrawnAt === undefined
          ? { ...addressing, withdrawnAt: event.now, withdrawalRecordedBy: WARD_FLOW_ROLE_LABELS[event.role] }
          : addressing,
      );
      /*
       * Invariant I-07: cascade referral withdrawal to EVERY linked open movement, not only one.
       *
       * 🔴 FIX ROUND (2026-09-16 audit): this used to find ONE linked open movement (`.find`) and
       * close it, releasing nothing — no bed given back, no admission deleted, no in-flight
       * transport cancelled. Nothing here or in `RAISE_REFERRAL` prevents a referral linking to
       * more than one open movement, and every one of them needed the same unwind
       * `WITHDRAW_REFERRAL` and `STOP_TRANSPORT` already give a single movement — see
       * `releasePulledBedAndAdmission`, shared with both rather than copied a third time.
       *
       * A linked movement whose transport has already been COLLECTED is refused outright, not
       * guessed at: `WITHDRAW_REFERRAL` treats a collected journey as a decision only
       * `STOP_TRANSPORT` may make, and this event has no equivalent "stop the vehicle" act to fall
       * back on. Choosing what a referrer withdrawal should do to a vehicle already on the road is
       * a decision this brief does not cover, so the whole event is refused — state unchanged —
       * rather than this handler picking a behaviour for it.
       */
      const linkedOpenMovements = state.movements.filter((m) => m.referralId === referral.id && !m.closure);
      const collectedLinkedMovement = linkedOpenMovements.find((m) => m.transport?.collectedAt !== undefined);
      if (collectedLinkedMovement) {
        return reject(
          state,
          event,
          `referral ${referral.id} is linked to movement ${collectedLinkedMovement.id}, whose transport has already been collected; this needs a coordinator decision (see STOP_TRANSPORT) rather than an automatic withdrawal`,
        );
      }
      const stateAfterReleases = linkedOpenMovements.reduce(
        (carried, m) => releasePulledBedAndAdmission(carried, m, event.now),
        state,
      );
      const linkedIds = new Set(linkedOpenMovements.map((m) => m.id));
      const nextMovements = stateAfterReleases.movements.map((m) =>
        linkedIds.has(m.id)
          ? {
              ...m,
              admissionId: undefined,
              transport:
                m.transport && m.transport.cancelledAt === undefined
                  ? { ...m.transport, cancelledAt: event.now }
                  : m.transport,
              closure: {
                at: event.now,
                outcome: "did_not_proceed" as const,
                reason: "The referral was recorded as withdrawn by its referrer",
              },
              blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
            }
          : m,
      );
      return {
        ...stateAfterReleases,
        movements: nextMovements,
        referrals: stateAfterReleases.referrals.map((candidate) =>
          candidate.id === referral.id ? { ...candidate, destinations } : candidate,
        ),
      };
    }

    /**
     * 🔴 **RB7 — CORRECTION NOTES, build plan item 27 (2026-09-17).** Appends a new, attributed,
     * timestamped note to `referral.corrections`. See `Referral.corrections`'s own doc comment for
     * why this is structurally kept apart from `history`, and note that this case body deliberately
     * NEVER assigns `history:` — `tests/ward-referral-history-immutable.test.ts` is the static
     * proof of that, not merely a convention followed by eye.
     *
     * No referral-state precondition: unlike `RECORD_REFERRER_WITHDRAWAL` above, a correction is not
     * a decision about the referral's own outcome — it is a note added on top of whatever has
     * already happened, at any point in a referral's life, and the plan names none.
     */
    case "ADD_REFERRAL_CORRECTION": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      // Trimmed for the blank check, the same discipline `RECORD_MOVEMENT_BLOCKER` already holds a
      // typed, must-say-something field to — a whitespace-only note is not a correction.
      const note = event.note.trim();
      if (note.length === 0) {
        return reject(state, event, `ADD_REFERRAL_CORRECTION note must say something — a blank is not a correction`);
      }
      // ⚠️ Refused, never shortened — the same rule `history` and `sendingTeamName` are held to on
      // `RECEIVE_REFERRAL` above: a truncated correction silently drops whatever was typed last.
      if (note.length > REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS) {
        return reject(
          state,
          event,
          `ADD_REFERRAL_CORRECTION note is ${note.length} characters and the limit is ${REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS} — it is refused rather than shortened`,
        );
      }
      const correction: ReferralCorrection = { at: event.now, by: event.role, note };
      const corrected: Referral = {
        ...referral,
        corrections: [...(referral.corrections ?? []), correction],
      };
      return replaceReferral(state, referral.id, corrected);
    }

    case "RECORD_LOCAL_BED_SOUGHT": {
      // Phase 8 (spec D8-6). Optional by design: nothing requires this to have happened, nothing
      // reads its absence as a failing, and `ACCEPT_REFERRAL` neither checks it nor cares. It is
      // a record that a coordinator looked closer to home, and when.
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      // A search for a local bed is a thing done while the referral is still undecided. Recording
      // one against an already-decided referral would be recording it after the fact, so the
      // refused state is named exactly as `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` name theirs.
      if (referralState(referral) !== "queued") {
        return reject(state, event, `referral ${referral.id} was already decided (${referralState(referral)})`);
      }
      // One-shot, the same discipline `ACCEPT_REFERRAL`'s already-decided guard uses: a second
      // record would silently overwrite the first, losing the time and role of the search that
      // actually happened.
      if (referral.localBedSought !== undefined) {
        return reject(state, event, `referral ${referral.id} already records a local bed search`);
      }
      // `by` is the raising ROLE, taken from the event rather than from any caller-supplied
      // string, so a person's name cannot be written here even by a caller that wanted to.
      const sought: Referral = { ...referral, localBedSought: { at: event.now, by: event.role } };
      return replaceReferral(state, referral.id, sought);
    }

    case "RECORD_ESCALATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot escalate a closed movement (${movement.closure.reason})`);
      }
      const updated: Movement = {
        ...movement,
        escalation: { at: event.now, triedUnitIds: [...event.triedUnitIds], contact: event.contact },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "CHANGE_URGENCY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot change urgency for a closed movement (${movement.closure.reason})`);
      }
      if (!URGENCY_CHANGE_REASONS.includes(event.reason)) {
        /*
         * Runtime membership, not merely the type — the rule `CANCEL_TRANSPORT` and
         * `STEP_BACK_STAGE` both state and this case predates: **a type-only guarantee passes
         * `vitest run` with no `tsc` involved.** Added 2026-09-06 with three siblings, after a
         * source-scanning guard found that FOUR reason-carrying events had no check, not one.
         */
        /*
         * Renders through `changeReasonLabels[change.reason]` with no fallback, so an unlisted
         * value printed "undefined" on the movement workspace's status-and-urgency panel — beside a
         * tier change a clinician made.
         */
        return reject(state, event, `CHANGE_URGENCY reason must be chosen from URGENCY_CHANGE_REASONS`);
      }
      // Nothing auto-allocates. This records who changed the tier, when and why; it never
      // re-sorts, re-suggests, un-accepts or re-refers the patient — that rule does not bend
      // because the trigger was a status change (Global Constraint 3, spec D2).
      const updated: Movement = {
        ...movement,
        urgency: event.urgency,
        urgencyChanges: [
          ...movement.urgencyChanges,
          { at: event.now, from: movement.urgency, to: event.urgency, by: event.role, reason: event.reason },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "CHANGE_LEGAL_STATUS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot change legal status for a closed movement (${movement.closure.reason})`);
      }
      if (!LEGAL_STATUS_CHANGE_REASONS.includes(event.reason)) {
        /*
         * Runtime membership, not merely the type — the rule `CANCEL_TRANSPORT` and
         * `STEP_BACK_STAGE` both state and this case predates: **a type-only guarantee passes
         * `vitest run` with no `tsc` involved.** Added 2026-09-06 with three siblings, after a
         * source-scanning guard found that FOUR reason-carrying events had no check, not one.
         */
        /*
         * ⚠️ **THE MOST CONSEQUENTIAL OF THE FOUR.** This records why a patient's status under the
         * Mental Health Act changed. An unlisted value renders "undefined" as the reason on the
         * legal-and-forms panel, which is the panel a reviewer reads first.
         */
        return reject(state, event, `CHANGE_LEGAL_STATUS reason must be chosen from LEGAL_STATUS_CHANGE_REASONS`);
      }
      // A legal status change can make an already-accepted destination unlawful — see
      // `destinationNoLongerLawful` in ward-derivations.ts, which surfaces that as an exception
      // for a human. This handler NEVER reacts to that itself: it records the change and nothing
      // else. `stage`, `acceptedUnitId`, `referredUnitIds`, `declines`, `transport`, `legalForm`
      // and `pullExpiresAt` are all untouched.
      const updated: Movement = {
        ...movement,
        legalStatus: event.legalStatus,
        statusChanges: [
          ...movement.statusChanges,
          { at: event.now, from: movement.legalStatus, to: event.legalStatus, by: event.role, reason: event.reason },
        ],
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    case "RELEASE_PULL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot release a pull for a closed movement (${movement.closure.reason})`);
      }
      // WFA-004: `STEP_BACK_STAGE` can put the stage label back at `pulled` while leaving
      // `transport.collectedAt` set. Physical collection is not erased by a stage correction —
      // releasing the bed after collection is `STOP_TRANSPORT`, never `RELEASE_PULL`.
      if (movement.transport?.collectedAt !== undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of releasing the pull`,
        );
      }
      // A booked (uncollected) transport job must not be silently deleted by releasing the pull —
      // cancel it explicitly first so the officer and receiving ward are told, never left believing.
      if (movement.transport !== undefined && movement.transport.cancelledAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the pull`,
        );
      }
      if (movement.stage !== "pulled") {
        return reject(
          state,
          event,
          `cannot release a pull at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      // Same claim-not-proof discipline as CONFIRM_CAPACITY: this compares what the caller SAID
      // it was acting as against the unit actually holding the bed, and refuses when they differ.
      // Unused for a coordinator caller, who may act on behalf of any unit.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_PULL was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is pulled at ${movement.acceptedUnitId}`,
        );
      }
      if (!RELEASE_PULL_REASONS.includes(event.reason)) {
        /*
         * 🔴 **THE LAST OF FIVE. `DECLINE_REFERRAL`, `CANCEL_TRANSPORT`, `STEP_BACK_STAGE` and
         * `WITHDRAW_ACCEPTANCE` each check their reason list at runtime; this one did not, and it
         * is the oldest of the five.**
         *
         * ⚠️ **FOUND BY A TYPE ERROR NO TEST COULD SEE, WHICH IS THE WHOLE ARGUMENT FOR THE CHECK.**
         * A test scaffold passed `bed_needed_for_a_more_urgent_patient` — not a member of
         * `RELEASE_PULL_REASONS` — and this case ACCEPTED it. Every test passed, because
         * `vitest run` involves no `tsc`. `CANCEL_TRANSPORT`'s own comment states the principle
         * exactly: *"a type-only guarantee passes `vitest run` with no `tsc` involved"*, and
         * `STEP_BACK_STAGE` repeats it. The rule was written down twice and this case predates both.
         *
         * ⚠️ **THE CONSEQUENCE WAS SILENT, WHICH IS WHY IT SURVIVED.** A bogus reason is written
         * into `stageChanges` and `unwinds`, reaches the audit timeline, and
         * `stageChangeReasonLabel` finds no map holding it — so the line renders the fact with NO
         * reason, indistinguishable from an act nobody gave a reason for. Nothing is red, nothing
         * looks wrong, and the record has quietly lost why a ward gave a bed back.
         *
         * Placed before the unit lookups below so a malformed event is refused on its own terms
         * rather than after this case has started reasoning about beds.
         */
        return reject(state, event, `RELEASE_PULL reason must be chosen from RELEASE_PULL_REASONS`);
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted unit holding a bed`);
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);

      // The EXACT inverse of PULL_PATIENT's own writes (ruling P4-1) — every field PULL_PATIENT sets,
      // undone, and nothing else touched. PULL_PATIENT writes four fields: `unit.allocatable.value`
      // (-1), `unit.allocatable.confirmedAt` (event.now), `movement.stage` ("pulled") and
      // `movement.pullExpiresAt` (event.now + 60). It does NOT touch `Unit.held` — that field is
      // seed-only data; the live held count on every screen is `unitCapacity()`'s own derivation
      // from `empty` and `allocatable`, so giving back the bed by raising `allocatable.value` is
      // the whole correction, on both fields PULL_PATIENT actually wrote to the unit.
      //
      // ⚠️ **AND THE PERSON THE PULL PUT IN THE BED GOES WITH IT.** Until 2026-09-01 this handler
      // gave the bed back to the unit and left the admission standing, so a cancelled pull left a
      // PHANTOM OCCUPANT: the ward board drew somebody in a bed nobody had pulled, `bedIsOccupied`
      // counted them, and the movement they belonged to was back at `accepted_awaiting_bed` waiting
      // for a bed the board said was full.
      //
      // ⚠️ **DELETED, NOT ENDED — and that is the one place this differs from `RECORD_LEAVING`.** A
      // departure is a thing that HAPPENED to a person who was really there, so it ends the record
      // (`state: "departed"`) and keeps it. A released pull is the assertion being RETRACTED: nobody
      // was ever in this bed, so leaving a `departed` record behind would put a discharge in the
      // ward's history for an admission that never occurred, and every discharge count would rise.
      // `admissionSequence` is deliberately NOT rewound: it is a monotonic id source, and reusing an
      // id a released pull already spent would give two different people the same admission id in
      // one session.
      //
      // Both halves above — since WLQ-38 (owner, 2026-09-15) — are `releasePulledBedAndAdmission`
      // (this file, above), shared with a post-acceptance `WITHDRAW_REFERRAL` and `STOP_TRANSPORT`
      // rather than copied a second and third time. This case still resolves and validates `unit`
      // itself above (the reject just above needs it), so the helper's own defensive `findUnit`
      // re-lookup is redundant here and harmless.
      const withoutPhantom = releasePulledBedAndAdmission(state, movement, event.now);
      // Never closes the movement, never clears `legalForm`, never touches `referredUnitIds` —
      // the patient survives and keeps their acceptance; only the pull itself unwinds.
      const updatedMovement: Movement = {
        ...movement,
        stage: "accepted_awaiting_bed",
        // 🔴 FOURTH FIX ROUND (owner follow-up, 2026-09-17): this release put the record back at
        // `accepted_awaiting_bed` — the exact stage `ACCEPT_IN_PRINCIPLE` itself lands on — without
        // ever writing `blocker`, so it kept reading whatever `BOOK_TRANSPORT` (or later) had last
        // written, most often `STAGE_TRANSITION_BLOCKERS.transportBooked`: "Awaiting a transport
        // provider response". False the moment the bed is given back — a provider answering does
        // not get this patient a bed. `STAGE_TRANSITION_BLOCKERS`'s own doc comment is explicit that
        // every transition overwrites the last one's prose ("the situation genuinely changed; a
        // note about the old one is exactly the staleness this table exists to end") — this
        // transition was simply never wired to. The record now reads exactly as it did the moment
        // this movement first reached `accepted_awaiting_bed`, unconditionally: whether a transport
        // job is still standing (orphaned — `orphanedTransport`, `ward-derivations.ts`, is what
        // flags that) is a fact about the job, not about what is blocking the PATIENT, and this
        // sentence is only ever about the latter.
        blocker: STAGE_TRANSITION_BLOCKERS.accepted,
        pullExpiresAt: undefined,
        // The record the pull created was deleted above (by the shared helper), so the join to it
        // goes with it. A surviving id pointing at a deleted admission is the dangling reference
        // this whole fix is about.
        admissionId: undefined,
        transport: undefined,
        unwinds: [...movement.unwinds, { at: event.now, kind: "pull_released", by: event.role, reason: event.reason }],
        // ⚠️ THIS APPENDS A SECOND `to: accepted_awaiting_bed` ENTRY AND MUST NEVER TOUCH
        // `acceptedAt`. `acceptedAt` agrees with the FIRST such entry (`ACCEPT_IN_PRINCIPLE`
        // above) precisely because a release is not a re-acceptance — the patient survives and
        // keeps their original acceptance, and the record of WHEN that happened must not move
        // just because a bed reservation was undone. See `StageChange`'s own doc comment.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "accepted_awaiting_bed", by: event.role, reason: event.reason },
        ],
      };
      const next = replaceMovement(withoutPhantom, movement.id, updatedMovement);
      // Communication addendum §1.3, the named ruling: "a referrer not told goes on believing a
      // bed is coming." `unit` above is the ward the pull was released from, resolved before this
      // handler's own writes touched it.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "bed_pull_released",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: unit.id },
          `${unit.name} released the bed it had pulled for ${movement.id} (${event.reason.replace(/_/g, " ")}).`,
        ),
      ]);
    }

    case "BOOK_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot book transport for a closed movement (${movement.closure.reason})`);
      }
      // Owner answer 30 (2026-09-17), build plan item 30: "no automatic rebooking; a person books
      // again" — including from `handover_ready`. Before this ruling `CANCEL_TRANSPORT` always
      // left a replacement job standing while a bed was held, so nobody needed to book from
      // `handover_ready`: a job was always already there. Now `CANCEL_TRANSPORT` removes the job
      // in every case (see that case's own comment), so a cancel reached after `HANDOVER_READY`
      // has run must be reachable here too, or the movement is stuck with a held bed and no way to
      // book transport for it again.
      if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
        return reject(
          state,
          event,
          `cannot book transport at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      // A second booking would replace a job a provider may already have accepted, and the
      // acceptance timestamps would vanish with it. Cancel first (`CANCEL_TRANSPORT`), then rebook.
      if (movement.transport && movement.transport.cancelledAt === undefined) {
        return reject(state, event, `transport for movement ${movement.id} is already booked`);
      }
      if (!TRANSPORT_PROVIDERS.includes(event.provider)) {
        return reject(state, event, `BOOK_TRANSPORT provider must be chosen from TRANSPORT_PROVIDERS`);
      }
      // ⚠️ A MISSING ESCORT ANSWER IS REFUSED RATHER THAN DEFAULTED, and that is the whole event.
      // The control opens blank; storing `false` for a question nobody answered would put "no
      // escort required" on screen as though a clinician had said so, which is exactly the defect
      // `HANDOVER_READY`'s derivation commits and the reason `TR-D1` puts booking on the team that
      // knows. `typeof` because the payload reaches this from JavaScript, where the field can be
      // absent whatever the type says.
      if (typeof event.escortRequired !== "boolean") {
        return reject(state, event, `BOOK_TRANSPORT escortRequired must be answered, and it has no default`);
      }
      // Owner's third ruling, 2026-09-17: booking this control LOGS a booking already made by
      // phone, and the three facts the caller was given on that call are all required, never
      // defaulted — the identical "answered by a person" discipline `escortRequired` just above
      // already holds to. `typeof`/membership checks throughout, because the payload reaches this
      // from JavaScript, where a field can be absent or wrong-shaped whatever the type says.
      if (typeof event.cadNumber !== "string" || event.cadNumber.trim().length === 0) {
        return reject(state, event, `BOOK_TRANSPORT cadNumber must be answered, and it has no default`);
      }
      if (!TRANSPORT_LEGAL_STATUSES.includes(event.transportLegalStatus)) {
        return reject(state, event, `BOOK_TRANSPORT transportLegalStatus must be chosen from TRANSPORT_LEGAL_STATUSES`);
      }
      if (typeof event.estimatedAt !== "number" || !Number.isFinite(event.estimatedAt)) {
        return reject(state, event, `BOOK_TRANSPORT estimatedAt must be answered, and it has no default`);
      }
      // WLQ-11 (owner, 2026-09-15): `CANCEL_TRANSPORT`'s `ward` branch needs to tell the booking
      // ward from any other later, so a `ward` booker must state its claim now — a booking this
      // field cannot name could never be matched against a later cancellation claim. Same
      // discipline as `escortRequired` just above: required and never defaulted.
      if (event.role === "ward" && !event.actingUnitId) {
        return reject(state, event, `BOOK_TRANSPORT raised as ward must state its actingUnitId, and it has no default`);
      }
      // Opus adversarial review, 2026-09-17, P2 finding 1: the check above only tested PRESENCE,
      // never that the claimed unit is real. `bookedBy.unitId` (below) is later compared against a
      // `ward` canceller's own claim (`CANCEL_TRANSPORT`'s own comment), so an invented unit id would
      // be stored as though it named a real ward and could never be matched against anything real.
      if (event.role === "ward" && event.actingUnitId !== undefined && !findUnit(state, event.actingUnitId)) {
        return reject(state, event, `BOOK_TRANSPORT actingUnitId ${event.actingUnitId} does not name a real unit`);
      }
      // Owner's third ruling, 2026-09-17 (answer 9): "only the community team that booked
      // transport may cancel it" — a `community` booker must state its claim now, the identical
      // reason and identical discipline as the `ward` pair of checks just above.
      if (event.role === "community" && !event.actingPlaceId) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT raised as community must state its actingPlaceId, and it has no default`,
        );
      }
      if (event.role === "community" && event.actingPlaceId !== undefined && !communityTeamById(event.actingPlaceId)) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT actingPlaceId ${event.actingPlaceId} does not name a real community team`,
        );
      }
      if (!movement.acceptedUnitId && !movement.admissionId) {
        return reject(
          state,
          event,
          `cannot book transport for movement ${movement.id} without an accepted destination ward or admission`,
        );
      }
      if (
        event.role === "ed" &&
        event.actingPlaceId &&
        movement.originEdId &&
        event.actingPlaceId !== movement.originEdId
      ) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT raised as ED acting as ${event.actingPlaceId} may only book transport for movements originating from its own ED (${movement.originEdId})`,
        );
      }
      // 🔴 THIRD FIX ROUND (Opus debugger, 3b3f215ba1, via `CANCEL_TRANSPORT`'s own no-bed-held
      // branch): a plain `${movement.id}-transport` collides with an earlier job the same movement
      // had cancelled while no bed was held — `CANCEL_TRANSPORT` removes that job outright rather
      // than replacing it (nothing to replace when no bed is held), so a later re-pull's booking
      // reaches here with the identical template and would mint the SAME id a second time, even
      // though it names a different job with its own timestamps. Counted off `unwinds`, the one
      // append-only record already proven immune to this movement's own history (see
      // `CANCEL_TRANSPORT`'s replacement-id counter just below, which counts the same way) —
      // deterministic, no `Date.now`, no random value. The common case (no prior cancellation) is
      // unchanged: the id stays exactly `${movement.id}-transport`, so every existing booking this
      // movement has never had cancelled keeps its familiar id.
      const priorTransportCancellations = movement.unwinds.filter(
        (entry) => entry.kind === "transport_cancelled",
      ).length;
      const booked: Movement = {
        ...movement,
        transport: {
          id:
            priorTransportCancellations === 0
              ? `${movement.id}-transport`
              : `${movement.id}-transport-${priorTransportCancellations + 1}`,
          provider: event.provider,
          escortRequired: event.escortRequired,
          // Owner's third ruling, 2026-09-17: the phone-logged facts, required and stored exactly
          // as answered — see each field's own doc comment on `TransportJob` (`ward-model.ts`).
          cadNumber: event.cadNumber,
          transportLegalStatus: event.transportLegalStatus,
          estimatedAt: event.estimatedAt,
          // Carried forward from RECORD_TRANSPORT_NEED so the "no transport needed" branches in
          // HANDOVER_READY / PATIENT_ARRIVED can read a runtime-booked job the same way they read a
          // seed-authored one.
          needed: movement.transportNeed?.needed,
          // WLQ-11 (owner, 2026-09-15) / third ruling (2026-09-17): who booked this job. `unitId`
          // is recorded only for a `ward` booker, `placeId` only for a `community` booker — see
          // `TransportJob.bookedBy`'s own doc comment for why `ed` carries a role and nothing more.
          bookedBy: {
            role: event.role,
            ...(event.role === "ward" ? { unitId: event.actingUnitId } : {}),
            ...(event.role === "community" ? { placeId: event.actingPlaceId } : {}),
            ...(event.role === "ed" && event.actingPlaceId ? { placeId: event.actingPlaceId } : {}),
          },
        },
        // A job now exists and the provider has not answered it. Deliberately says only that: which
        // provider, and whether an escort was asked for, are already on the job itself and
        // `transportStatusLabel` renders them — restating them here would be two sentences for one
        // fact, the drift this codebase produces most reliably.
        blocker: STAGE_TRANSITION_BLOCKERS.transportBooked,
      };
      return replaceMovement(state, movement.id, booked);
    }

    case "CANCEL_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot cancel transport for a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to cancel`);
      }
      if (movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already cancelled`);
      }
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `cannot cancel transport for movement ${movement.id} — the patient has arrived`);
      }
      if (movement.transport.collectedAt !== undefined) {
        return reject(state, event, `cannot cancel transport for movement ${movement.id} — the patient has departed`);
      }
      /*
       * ⚠️ THIS CHECK USED TO BE TR-D6 INVERTED, AND IT READ AS OBVIOUSLY CORRECT.
       *
       * It was: `if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId)
       * reject` — permitting a ward caller ONLY when it was the accepted unit. That is, only the
       * RECEIVING ward: the one party the owner's ruling excludes by name. Every other ward was
       * refused. It carried a careful comment about claim-not-proof discipline while doing exactly
       * the wrong thing, because "a ward may act on its own patient" is such a natural sentence
       * that it survives review.
       *
       * TR-D6 (owner, 2026-08-30): a transport may be cancelled by the team that BOOKED it and by
       * the coordinator. The receiving ward may not — it did not book the job, and a booking
       * cancelled by the destination is indistinguishable on the sending board from one that
       * failed, so the sending team cannot tell "they changed their mind" from "it never went
       * through". They re-book, or they wait for a vehicle nobody is sending.
       *
       * `ward` was then removed from `EVENT_ROLE.CANCEL_TRANSPORT` altogether, because the role
       * gate alone could not tell the receiving ward from the booking one — excluding every ward
       * was the only safe fix available with `BOOK_TRANSPORT` recording no booker at all.
       *
       * 🔴 WLQ-11 (owner, 2026-09-15): *"whoever booked transport may cancel it; the receiving
       * ward still may not."* `ward` is back in `EVENT_ROLE.CANCEL_TRANSPORT`, and the finer
       * distinction TR-D6 could not make is made HERE instead, against `transport.bookedBy`
       * (`BOOK_TRANSPORT`'s own new field — see its doc comment). Same claim-not-proof discipline
       * as everywhere else `actingUnitId` appears: this compares what the caller SAID it was
       * acting as against who is recorded as having booked, and refuses when they differ —
       * including when they differ because `bookedBy` is entirely absent, which is every transport
       * job booked before this ruling existed. TR-D6's original coordinator/ED-only rule is
       * therefore UNCHANGED for those jobs. Unused for a coordinator or `ed` caller, whose rights
       * remain unconditional (`ed` is still the sending team on every movement today).
       *
       * 🔴 **`community` GAINED THE IDENTICAL CHECK, AGAINST `bookedBy.placeId`, UNDER THE OWNER'S
       * THIRD RULING (2026-09-17, answer 9) — see that branch just below.** This paragraph used to
       * say `community` "cannot be checked the same way"; that was true only for as long as
       * nothing plumbed a community identity claim into `BOOK_TRANSPORT`, and the third ruling is
       * what plumbed one (`actingPlaceId`, the same claim-not-proof discipline as `actingUnitId`).
       */
      if (event.role === "ward") {
        if (
          movement.transport.bookedBy?.role !== "ward" ||
          !event.actingUnitId ||
          movement.transport.bookedBy.unitId !== event.actingUnitId
        ) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as ward acting as ${event.actingUnitId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      // 🔴 Owner's third ruling, 2026-09-17 (answer 9): "only the community team that booked
      // transport may cancel it." Same shape as the `ward` branch just above, against
      // `bookedBy.placeId` instead of `bookedBy.unitId` — a `community` caller whose claim does
      // not match the recorded booker is refused, including when `bookedBy` was never a
      // `community` booking at all or predates this ruling and carries no `placeId`.
      if (event.role === "community") {
        if (
          movement.transport.bookedBy?.role !== "community" ||
          !event.actingPlaceId ||
          movement.transport.bookedBy.placeId !== event.actingPlaceId
        ) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as community acting as ${event.actingPlaceId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      if (event.role === "ed" && event.actingPlaceId) {
        if (movement.transport.bookedBy?.placeId && movement.transport.bookedBy.placeId !== event.actingPlaceId) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as ED acting as ${event.actingPlaceId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      if (!CANCEL_TRANSPORT_REASONS.includes(event.reason)) {
        /*
         * Runtime membership, not merely the type. `reason` is declared required on the event, but
         * a type-only guarantee passes `vitest run` with no `tsc` involved — and a caller omitting
         * it was accepted, writing `reason: undefined` into the unwind record. TR-D6 says this must
         * not be weakened to optional; an unenforced requirement already is.
         */
        return reject(state, event, `CANCEL_TRANSPORT reason must be chosen from CANCEL_TRANSPORT_REASONS`);
      }
      // Never closes the movement — the patient stays open, only the transport job unwinds. The
      // cancelled job remains named in the audit trail while a clean replacement follows the
      // ordinary acceptance path. The bed itself is untouched by this handler.
      //
      // 🔴 FIX ROUND (2026-09-16 audit): this used to set `stage: "handover_ready"` unconditionally,
      // whatever stage the movement was actually at. `BOOK_TRANSPORT` runs at `pulled`, and nothing
      // advances the stage to `handover_ready` except `HANDOVER_READY` itself — so a job cancelled
      // right after booking, before the ED ever marked the handover ready, was pushed straight to
      // `handover_ready` anyway, skipping that act entirely.
      //
      // 🔴 SECOND FIX ROUND (adversarial review of 65aa7c54a6): the first repair replaced the
      // unconditional jump with `movement.stage === "pulled" ? "pulled" : "handover_ready"`, whose
      // own comment claimed `handover_ready` was the ONLY other stage reachable here. FALSE.
      // `STEP_BACK_STAGE` can move a movement with a booked, uncollected transport job back to ANY
      // strictly-earlier stage without touching `transport` at all (its own "TOUCH NOTHING ELSE"
      // rule) — including `accepted_awaiting_bed`. `RELEASE_PULL` reaches the same stage the same
      // way: it releases the BED, never the transport, and lands back at `accepted_awaiting_bed`
      // with the booked job still standing. Both paths then hit this handler with
      // `movement.stage === "accepted_awaiting_bed"`, and the ternary jumped them forward to
      // `handover_ready` anyway — the exact defect the first fix round believed it had closed.
      // See `tests/ward-cancel-transport-stage.test.ts` for both reproductions.
      //
      // The correct rule needs no case analysis at all: `CANCEL_TRANSPORT` unwinds a transport job,
      // and nothing about unwinding a job changes where the PATIENT currently sits in the pathway.
      // The stage is therefore left exactly as found, in every reachable case.
      //
      // 🔴 THIRD FIX ROUND (Opus debugger, 3b3f215ba1): a replacement job was installed
      // UNCONDITIONALLY, even when no bed is held at all — `RELEASE_PULL` (or a `STEP_BACK_STAGE`
      // that lands the same way) can put a movement back at a stage strictly before `pulled` while
      // a transport job is still standing (`orphanedTransport`, `ward-derivations.ts`, is the
      // existing name for exactly that shape). Installing a fresh replacement there kept the
      // orphan flagged forever — every cancel just minted `-replacement-N`, the officer and the
      // receiving ward kept being told a replacement was coming for a patient with nowhere to go,
      // and a re-pull's `BOOK_TRANSPORT` refused with "already booked" against a job nobody wanted.
      //
      // `MOVEMENT_STAGES`'s own order distinguished the two branches: at or after `pulled` the bed
      // is held (or was, moments ago); strictly before `pulled`, no bed is held. Until the fix
      // round immediately below, only the no-bed branch removed the job — the bed-held branch kept
      // installing a fresh `-replacement-N`, exactly the way this round's own comment describes.
      //
      // 🔴 FIFTH FIX ROUND, owner answer 30 (2026-09-17), build plan item 30: *"Cancelling
      // transport while a bed is held: no automatic rebooking; a person books again."* The
      // bed-held branch's replacement job is deleted by this round, not merely reworded — see
      // `tests/ward-transport-cancel-no-rebook.test.ts` and the rewritten control test in
      // `tests/ward-cancel-transport-no-bed-held.test.ts`. Both branches now remove the job for the
      // SAME reason `orphanedTransport` already reads "no job" as "nothing to flag" on the no-bed
      // branch: a cancelled job is gone, whichever branch cancelled it. `BOOK_TRANSPORT`'s own
      // stage guard is widened (see its case above) so a person CAN book again from `handover_ready`
      // as well as `pulled` — before this round nobody needed to, because a job was always already
      // standing there.
      const cancelledTransport = movement.transport;
      // WFA-001 / same OR as `releasePulledBedAndAdmission`: `STEP_BACK_STAGE` can leave
      // `admissionId` standing at a stage strictly before `pulled`, and the bed is still held.
      // Stage alone is not enough — a cancelled job while the admission remains must say so.
      const bedIsHeld =
        movement.admissionId !== undefined ||
        MOVEMENT_STAGES.indexOf(movement.stage) >= MOVEMENT_STAGES.indexOf("pulled");
      const updatedMovement: Movement = {
        ...movement,
        // `stage` is deliberately NOT written here — see the SECOND FIX ROUND comment above:
        // cancelling a transport job never advances or reverts the movement's stage, in every
        // reachable case, so the spread above already carries the right value forward.
        //
        // FIFTH FIX ROUND: no branch replaces the job any more — `orphanedTransport` already reads
        // an absent job as "nothing to flag" (its own first line: `if (movement.transport ===
        // undefined) return undefined`), and an absent job is what lets `BOOK_TRANSPORT` succeed
        // again instead of refusing with "already booked", on the bed-held branch exactly as it
        // already did on the no-bed one.
        transport: undefined,
        // 🔴 FOURTH FIX ROUND (owner follow-up, 2026-09-17), same defect and same fix as
        // `RELEASE_PULL`'s own comment just above it in this file: on the no-bed branch the job is
        // GONE, so whatever `blocker` last said ("Awaiting a transport provider response", or an
        // even later provider-progress sentence) is now false; the movement reads exactly as it did
        // the moment it first reached `accepted_awaiting_bed`.
        //
        // FIFTH FIX ROUND: the bed-held branch used to leave `blocker` exactly as found, which was
        // correct only while the job survived (replaced, not removed). Now the job is gone there
        // too, so the same discipline applies for the same reason — `STAGE_TRANSITION_BLOCKERS.
        // transportCancelled` states the fact the record now supports: the bed is still held, and
        // nobody has booked again yet.
        blocker: bedIsHeld ? STAGE_TRANSITION_BLOCKERS.transportCancelled : STAGE_TRANSITION_BLOCKERS.accepted,
        unwinds: [
          ...movement.unwinds,
          {
            at: event.now,
            kind: "transport_cancelled",
            by: event.role,
            reason: event.reason,
            transportId: cancelledTransport.id,
            cadNumber: cancelledTransport.cadNumber,
          },
        ],
        // No entry appended — `stage` never moves here (see above), so an append-only stage
        // HISTORY recording a transition would misstate what this cancellation did. Every other
        // writer in this file only ever appends when `to` differs from the stage it read; here
        // `to` and `from` would always be identical, so there is nothing to record.
        stageChanges: movement.stageChanges,
      };
      const next = replaceMovement(state, movement.id, updatedMovement);
      /*
       * Communication addendum §1.3: "CANCEL_TRANSPORT — the officer and the receiving ward —
       * somebody is expecting a person who is no longer coming." Two independent notices, each
       * its own `NoticeKind` so the two can never collide under `makeNotice`'s id rule.
       *
       * The officer is always notified: `officer` carries no `placeId` in this model (a single
       * role, never split by place — see `Addressee`'s own doc comment). The receiving ward is
       * `movement.acceptedUnitId`, which every movement reaching `CANCEL_TRANSPORT` has: transport
       * can only be booked (`BOOK_TRANSPORT`) once a movement is `pulled`, and a movement cannot
       * reach `pulled` without an accepted unit first (`PULL_PATIENT`). Guarded rather than
       * asserted, so a future relaxation of that chain degrades to "no ward notice" instead of a
       * runtime crash.
       *
       * 🔴 THIRD FIX ROUND: "a replacement is being arranged" is false on the no-bed branch — there
       * is nothing to arrange a replacement FOR, and telling the officer and the receiving ward
       * otherwise is the same misleading-notice defect this whole round exists to close. Each
       * sentence states the two facts the record actually supports instead: the job was cancelled,
       * and nothing has been rebooked.
       *
       * 🔴 FIFTH FIX ROUND, owner answer 30 (2026-09-17): "a replacement is being arranged" is now
       * ALSO false on the bed-held branch — nothing is arranging anything any more, on either
       * branch, because this round deletes the automatic replacement outright (see the reducer's
       * own comment above `cancelledTransport`). Wording from the build plan's exact on-screen
       * wording table (`docs/ward-flow/plans/2026-09-17-build-plan-referrals-transport.md` §4, T1).
       */
      const cancelledNote = bedIsHeld
        ? "the bed is still held and nothing has been rebooked."
        : "no bed is held and nothing has been rebooked.";
      const transportNotices: Notice[] = [
        makeNotice(
          event.now,
          state.notices.length,
          "transport_cancelled_officer",
          { role: "officer" },
          { movementId: movement.id },
          `Transport for ${movement.id} was cancelled (${event.reason.replace(/_/g, " ")}); ${cancelledNote}`,
        ),
      ];
      if (movement.acceptedUnitId !== undefined) {
        const receivingUnitId = movement.acceptedUnitId;
        transportNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "transport_cancelled_ward",
            { role: "ward", placeId: receivingUnitId },
            { movementId: movement.id, unitId: receivingUnitId },
            `The transport bringing your patient for ${movement.id} was cancelled (${event.reason.replace(/_/g, " ")}); ${cancelledNote}`,
          ),
        );
      }
      return appendNotices(next, transportNotices);
    }

    /**
     * THE REFERRER OR THE COORDINATOR STOPS A COLLECTED JOURNEY — WLQ-38 (owner, 2026-09-15). See
     * this event's own doc comment in `ward-flow-events.ts` for the ruling and for why `ed` is
     * permitted by role alone. `EVENT_ROLE.STOP_TRANSPORT` already restricts the caller to
     * `coordinator`/`ed` before this case runs, so — unlike `WITHDRAW_REFERRAL` above, which must
     * permit four roles pre-acceptance and narrow two of them away after — nothing here re-checks
     * `event.role`.
     */
    case "STOP_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot stop transport for a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to stop`);
      }
      if (movement.transport.collectedAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s transport has not been collected yet; use CANCEL_TRANSPORT instead`,
        );
      }
      // Belt and braces alongside the `movement.closure` check above: `PATIENT_ARRIVED` always sets
      // both `transport.arrivedAt` and `movement.closure` in the same update (see `TransportJob`'s
      // own doc comment), so this can only ever fire if that invariant is ever broken elsewhere —
      // and if it is, refusing here on the right symptom beats silently trusting the wrong field.
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `movement ${movement.id}'s patient has already arrived`);
      }
      if (movement.transport.diversion) {
        return reject(
          state,
          event,
          `movement ${movement.id} was diverted; use RELEASE_DIVERTED_BED rather than STOP_TRANSPORT`,
        );
      }
      if (movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already stopped or cancelled`);
      }
      if (!STOP_TRANSPORT_REASONS.includes(event.reason)) {
        // Runtime membership, not merely the type — the same discipline every other reason-carrying
        // event in this file holds to, because `vitest run` alone involves no `tsc`.
        return reject(state, event, `STOP_TRANSPORT reason must be chosen from STOP_TRANSPORT_REASONS`);
      }
      if (!TRANSPORT_WHEREABOUTS.includes(event.whereabouts)) {
        // Build plan item 31 (T3, 2026-09-17): the same runtime-membership discipline as the reason
        // check just above, for the same reason — `vitest run` alone involves no `tsc`, so a type
        // guarantee alone would never catch a hand-built or malformed dispatch.
        return reject(state, event, `STOP_TRANSPORT whereabouts must be chosen from TRANSPORT_WHEREABOUTS`);
      }

      // Owner answer 8 (second round, 2026-09-17): the bed no longer comes back automatically here
      // — see `STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease`'s own doc comment.
      // `acceptedUnitId` and `admissionId` are left exactly as `movement` already carries them, so
      // whatever bed is held stays held until a `RELEASE_HELD_BED` from the coordinator, the ward,
      // or the referrer.
      const stoppedTransport = movement.transport;
      const stopped: Movement = {
        ...movement,
        transport: {
          ...stoppedTransport,
          // Both written together: `cancelledAt` is the general "this job is over" signal every
          // other reader (`transportStatusLabel`, `orphanedTransport`) already understands, and
          // `stoppedAt`/`stoppedBy`/`stopReason`/`stoppedWhereabouts` are this event's own more
          // specific record of who stopped it, why, and where the patient is — see `TransportJob`'s
          // own doc comment on all four.
          cancelledAt: event.now,
          stoppedAt: event.now,
          stoppedBy: event.role,
          stopReason: event.reason,
          stoppedWhereabouts: event.whereabouts,
        },
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          // The reason IS the closure reason: `STOP_TRANSPORT_REASONS`' three members are already
          // full sentences (Ward Lead's own wording), so restating them differently here would be
          // two strings for one fact.
          reason: event.reason,
        },
        // ACTIVE, not "None — …": the journey is over but the bed is still held pending a release
        // decision — this overwrites WLQ-4's `examinationRevokedAwaitingRelease` sentence if it was
        // standing, which is correct: that flag was about the SAME bed, and this is the newer,
        // more specific fact about it now.
        blocker: STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease,
      };
      const next = replaceMovement(state, movement.id, stopped);
      // Communication addendum §1.3's own principle, extended by WLQ-38 and by build plan item 31 —
      // see `NoticeKind`'s own doc comment for the addendum-row debt this records. The officer is
      // ALWAYS told where the patient now is (the officer is the one who reported it and the one
      // who has to act on it, the same "no placeId, a single role" shape `transport_cancelled_officer`
      // already holds — see `Addressee`'s own doc comment). The receiving ward, if there is one,
      // believed a patient was on the way; it is not coming — unchanged from WLQ-38.
      const stopNotices: Notice[] = [
        makeNotice(
          event.now,
          state.notices.length,
          "transport_stopped_officer",
          { role: "officer" },
          { movementId: movement.id },
          `Transport for ${movement.id} was stopped (${event.reason}). Where the patient is now: ${event.whereabouts}.`,
        ),
      ];
      if (movement.acceptedUnitId !== undefined) {
        const receivingUnitId = movement.acceptedUnitId;
        stopNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "transport_stopped_ward",
            { role: "ward", placeId: receivingUnitId },
            { movementId: movement.id, unitId: receivingUnitId },
            `The transport bringing your patient for ${movement.id} was stopped (${event.reason}); the patient is not coming.`,
          ),
        );
      }
      return appendNotices(next, stopNotices);
    }

    /**
     * RELEASES A BED `STOP_TRANSPORT` LEFT HELD — owner answer 8 (second round, 2026-09-17). See
     * this event's own doc comment in `ward-flow-events.ts` for the full ruling and why this is a
     * new case rather than a loosened `RELEASE_PULL`.
     */
    case "RELEASE_HELD_BED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.transport?.stoppedAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} was not stopped by STOP_TRANSPORT, so there is no held bed to release this way`,
        );
      }
      if (movement.admissionId === undefined) {
        return reject(state, event, `movement ${movement.id} holds no bed — it may already have been released`);
      }
      // Same claim-not-proof discipline as RELEASE_PULL and CANCEL_TRANSPORT: this compares what
      // the caller SAID it was acting as against the unit actually holding the bed, and refuses
      // when they differ. Unused for a coordinator or ed caller, who may act regardless.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_HELD_BED was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is held at ${movement.acceptedUnitId}`,
        );
      }
      const withoutHeldBed = releasePulledBedAndAdmission(state, movement, event.now);
      const released: Movement = {
        ...movement,
        admissionId: undefined,
        // Nothing is blocking any more — the release this sentence describes is the one thing that
        // was outstanding.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      return replaceMovement(withoutHeldBed, movement.id, released);
    }

    /**
     * Build plan item 29 (T4a, 2026-09-17) / R2-7: record a diversion on a collected journey.
     * The bed stays held and the movement stays OPEN until `RELEASE_DIVERTED_BED`.
     */
    case "RECORD_DIVERSION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot divert a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to divert`);
      }
      if (movement.transport.collectedAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s transport has not been collected yet; diversion is only for a journey already under way`,
        );
      }
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `movement ${movement.id}'s patient has already arrived`);
      }
      if (movement.transport.stoppedAt !== undefined || movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `movement ${movement.id}'s transport was already stopped or cancelled`);
      }
      if (movement.transport.diversion) {
        return reject(state, event, `movement ${movement.id} was already diverted`);
      }
      if (!DIVERSION_REASONS.includes(event.reason)) {
        return reject(state, event, `RECORD_DIVERSION reason must be chosen from DIVERSION_REASONS`);
      }
      if (!TRANSPORT_WHEREABOUTS.includes(event.place)) {
        return reject(state, event, `RECORD_DIVERSION place must be chosen from TRANSPORT_WHEREABOUTS`);
      }

      const diverted: Movement = {
        ...movement,
        transport: {
          ...movement.transport,
          diversion: {
            at: event.now,
            by: event.role,
            place: event.place,
            reason: event.reason,
          },
        },
        blocker: STAGE_TRANSITION_BLOCKERS.divertedAwaitingRelease,
      };
      const next = replaceMovement(state, movement.id, diverted);
      const diversionNotices: Notice[] = [];
      if (movement.acceptedUnitId !== undefined) {
        const receivingUnitId = movement.acceptedUnitId;
        diversionNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "diversion_recorded_ward",
            { role: "ward", placeId: receivingUnitId },
            { movementId: movement.id, unitId: receivingUnitId },
            `The patient for ${movement.id} was diverted (${event.reason}). Where they are now: ${event.place}. The bed stays held until it is released.`,
          ),
        );
      }
      diversionNotices.push(
        makeNotice(
          event.now,
          state.notices.length + diversionNotices.length,
          "diversion_recorded_ed",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id },
          `The patient for ${movement.id} was diverted (${event.reason}). Where they are now: ${event.place}.`,
        ),
      );
      return appendNotices(next, diversionNotices);
    }

    /**
     * Build plan item 29 (T4a, 2026-09-17) / OA-29: release a bed left held by a diversion.
     */
    case "RELEASE_DIVERTED_BED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.transport?.diversion === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} was not diverted, so there is no diverted bed to release this way`,
        );
      }
      if (movement.admissionId === undefined) {
        return reject(state, event, `movement ${movement.id} holds no bed — it may already have been released`);
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_DIVERTED_BED was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is held at ${movement.acceptedUnitId}`,
        );
      }
      const withoutHeldBed = releasePulledBedAndAdmission(state, movement, event.now);
      const diversionReason = movement.transport.diversion.reason;
      const released: Movement = {
        ...movement,
        admissionId: undefined,
        transport: {
          ...movement.transport,
          cancelledAt: event.now,
        },
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: diversionReason,
        },
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      const next = replaceMovement(withoutHeldBed, movement.id, released);
      if (event.role === "ward" || movement.acceptedUnitId === undefined) {
        return next;
      }
      const receivingUnitId = movement.acceptedUnitId;
      return appendNotices(next, [
        makeNotice(
          event.now,
          next.notices.length,
          "diversion_bed_released_ward",
          { role: "ward", placeId: receivingUnitId },
          { movementId: movement.id, unitId: receivingUnitId },
          `The bed held for diverted patient ${movement.id} was released.`,
        ),
      ]);
    }

    /**
     * THE COORDINATOR'S OWN RECORD CORRECTION — Task 5 (ward-flow movement step-track plan,
     * 2026-09-04), owner rulings E and F. See `STEP_BACK_STAGE`'s own doc comment in
     * `ward-flow-events.ts` for what this is and is not.
     */
    case "STEP_BACK_STAGE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.stage === "arrived" || movement.transport?.arrivedAt !== undefined) {
        return reject(
          state,
          event,
          `cannot step back an arrived movement (invariant I-05: physical arrival is irreversible)`,
        );
      }
      if (movement.closure) {
        return reject(state, event, `cannot step back a closed movement (${movement.closure.reason})`);
      }
      const fromIndex = MOVEMENT_STAGES.indexOf(movement.stage);
      const toIndex = MOVEMENT_STAGES.indexOf(event.to);
      if (toIndex >= fromIndex) {
        return reject(
          state,
          event,
          `STEP_BACK_STAGE target must be strictly before the movement's current stage (movement ${movement.id} is at ${stageCopy[movement.stage].label}, target was ${stageCopy[event.to].label})`,
        );
      }
      if (!STEP_BACK_REASONS.includes(event.reason)) {
        /*
         * Runtime membership, not merely the type — the same discipline `CANCEL_TRANSPORT` above
         * already states in its own comment: a type-only requirement passes `vitest run` with no
         * `tsc` involved.
         */
        return reject(state, event, `STEP_BACK_STAGE reason must be chosen from STEP_BACK_REASONS`);
      }
      // 🔴 TOUCH NOTHING ELSE — F3 and ruling E's "does not release the bed / does not cancel the
      // transport" in one sentence. Never write `acceptedUnitId`, `acceptedAt`, `pullExpiresAt`,
      // `admissionId`, `transport`, or any `Unit.allocatable` field, no matter how far back
      // `event.to` goes. The entire side effect is the two appends below and the `stage` field.
      const updatedMovement: Movement = {
        ...movement,
        stage: event.to,
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: event.to, by: event.role, reason: event.reason },
        ],
        unwinds: [
          ...movement.unwinds,
          { at: event.now, kind: "stage_corrected", by: event.role, reason: event.reason },
        ],
      };
      return replaceMovement(state, movement.id, updatedMovement);
    }

    /**
     * THE COORDINATOR UNDOES A WARD'S "YES" — Task 5, same plan and rulings as `STEP_BACK_STAGE`
     * above. See `WITHDRAW_ACCEPTANCE`'s own doc comment in `ward-flow-events.ts`.
     */
    case "WITHDRAW_ACCEPTANCE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot withdraw an acceptance for a closed movement (${movement.closure.reason})`);
      }
      /*
       * 🔴 THIS MESSAGE USED TO NAME A CAUSE, AND THE CAUSE WAS FALSE AT THE TWO EARLIEST STAGES.
       *
       * It named a single cause — it asserted that a bed had already been pulled. ⚠️ **That wording
       * is deliberately NOT spelled out here, and this line says so on purpose:** a comment that
       * quotes the string it removed puts that string back in the file, so a search for the false
       * claim finds this file and cannot tell a removal from a survival. Do not "restore it for
       * clarity". The guard is
       * `!== "accepted_awaiting_bed"`, so it does not test one cause — it tests one CONDITION, and
       * five stages can reach it:
       *
       *     placement_requested   before any acceptance; NO BED EXISTS TO HAVE BEEN PULLED
       *     destination_review    before any acceptance; NO BED EXISTS TO HAVE BEEN PULLED
       *     pulled                a bed was pulled                                  (true)
       *     handover_ready        after `pulled`                                    (true)
       *     moving                after `pulled`                                    (true)
       *
       * ⚠️ **`arrived` cannot reach here at all** — its only writer (`PATIENT_ARRIVED`) sets
       * `closure` in the same object literal as the stage, so the `movement.closure` branch above
       * always returns first. Five reachable, not the six a subtraction from `MOVEMENT_STAGES`
       * suggests: what the type can express is not what the code can reach.
       *
       * 🔴 **SO THE OLD SENTENCE WAS TRUE THREE TIMES OUT OF FIVE, AND THAT IS WHY IT SURVIVED.**
       * It is wrong only at the two EARLIEST stages, and right at the three where a withdrawal is
       * most plausibly attempted — so anyone checking it from a realistic mid-pathway movement read
       * an accurate sentence and moved on. A falsehood with a high true rate is harder to find than
       * one with a low one, and it is concealed by the very thing that makes a manual check feel
       * representative.
       *
       * ⚠️ And it was an ACTIONABLE falsehood: *"a bed has been pulled"* tells a coordinator a bed
       * left the pool. They go looking for it, or stop chasing one they still need.
       *
       * The repair states the CONDITION, which is true at all five without being vague — a sentence
       * true everywhere by saying nothing ("this cannot be withdrawn") would trade a false specific
       * for an empty general, which is the same defect's other half.
       *
       * ⚠️ **`stageCopy`'s label is deliberately NOT used here, and that is a constraint rather than
       * a preference.** `ward-derivations.ts` imports from THIS file, so importing back would close
       * a cycle — and it also imports `lucide-react`, which would drag icon components into the
       * reducer. This file has met that constraint before and inlined rather than imported (see the
       * `referralForMovement` note above). `.replace(/_/g, " ")` is this file's own established
       * idiom for the same job, used at a dozen other sites — and it yields sentence-case text,
       * which reads better mid-sentence than a label written for a column heading.
       */
      if (movement.stage !== "accepted_awaiting_bed") {
        return reject(
          state,
          event,
          `cannot withdraw an acceptance unless the movement is still awaiting a bed ` +
            `(movement ${movement.id} is at ${stageCopy[movement.stage].label})`,
        );
      }
      if (!STEP_BACK_REASONS.includes(event.reason)) {
        return reject(state, event, `WITHDRAW_ACCEPTANCE reason must be chosen from STEP_BACK_REASONS`);
      }
      /*
       * ⚠️ A MOVEMENT STEPPED BACK FROM `pulled` IS AT THIS STAGE AND STILL HOLDS A BED. Withdrawing
       * here cleared the acceptance and left the admission and the bed behind, orphaned. Releasing
       * the bed instead would widen this event to a bed-holding withdrawal, which the owner kept as
       * his own open question (ruling 2 of 2026-09-04, see the event's doc comment). So it refuses,
       * and names the route that already exists: restore the pull, release it, then withdraw.
       */
      if (movement.admissionId !== undefined) {
        return reject(
          state,
          event,
          `cannot withdraw an acceptance while movement ${movement.id} still holds a bed (admission ${movement.admissionId}); pull it again to restore it, release the pull, then withdraw`,
        );
      }
      // Read before clearing — the whole point of `UnwindRecord.unitId` is naming which ward's
      // acceptance this was, which nothing else on the record would say once `acceptedUnitId`
      // below is cleared.
      const withdrawnUnitId = movement.acceptedUnitId;
      const updatedMovement: Movement = {
        ...movement,
        acceptedUnitId: undefined,
        acceptedAt: undefined,
        stage: "destination_review",
        // Deliberately NOT pushed back into `referredUnitIds` (owner ruling 3, 2026-09-04):
        // withdrawing an acceptance is not the same act as re-referring, and reviving a "live
        // referral" the ward never re-received would be a false claim on that ward's own screen.
        stageChanges: [
          ...movement.stageChanges,
          {
            at: event.now,
            from: "accepted_awaiting_bed",
            to: "destination_review",
            by: event.role,
            reason: event.reason,
          },
        ],
        unwinds: [
          ...movement.unwinds,
          {
            at: event.now,
            kind: "acceptance_withdrawn",
            by: event.role,
            reason: event.reason,
            unitId: withdrawnUnitId,
          },
        ],
      };
      const next = replaceMovement(state, movement.id, updatedMovement);
      // Item 48, Q3 (owner, 2026-09-17): the ward whose acceptance was just undone must be told —
      // the same "a party who believed something was settled learns it is not" shape
      // `referral_revoked_ward` already carries. `withdrawnUnitId` is guaranteed to resolve: it is
      // read from `movement.acceptedUnitId` above, before this handler's own writes cleared it,
      // and every writer of `stage: "accepted_awaiting_bed"` sets `acceptedUnitId` in the same
      // object literal (`ACCEPT_IN_PRINCIPLE`, `ACCEPT_REFERRAL`), which this case's own stage
      // guard above already requires.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "acceptance_withdrawn_ward",
          { role: "ward", placeId: withdrawnUnitId },
          { movementId: movement.id, unitId: withdrawnUnitId },
          `The coordinator withdrew this ward's acceptance of ${movement.id}. The patient is not coming unless this ward is asked again.`,
        ),
      ]);
    }

    /**
     * ITEM 48, Q2 (owner answer 48, 2026-09-17): A NOTICE COUNTS AS READ ONLY WHEN IT IS MARKED AS
     * READ. `Notice.readAt` (`ward-model.ts`) has existed since the communication addendum landed,
     * but nothing before this case ever wrote it — every notice sat "unread" forever, and Activity
     * counted every notice it could see as though nobody had ever opened it. See
     * `MARK_NOTICE_READ`'s own doc comment in `ward-flow-events.ts` for why this is the only writer.
     *
     * ⚠️ **THE ADDRESSEE ITSELF, NEVER "WHOEVER CAN SEE IT."** `noticeIsForWardChrome`
     * (`ward-chrome-role.ts`) already scopes which chrome a notice APPEARS on; visibility and the
     * authority to act on it are different questions, so this case re-checks the claim against the
     * record rather than trusting the role gate above alone — the same claim-not-proof discipline
     * `actingUnitId` holds throughout this file. `event.role`/`event.actingPlaceId` must equal
     * `notice.to.role`/`notice.to.placeId` EXACTLY, including the `undefined` case (`officer`, which
     * has no place in this model).
     *
     * ⚠️ **NOT IDEMPOTENT.** A second mark is refused rather than silently re-accepted — the same
     * "a state entered once is refused on retry" discipline `COMPLETE_INBOX_ITEM` below holds for an
     * already-complete row — so a caller cannot overwrite an earlier `readAt`/`readBy` pair with a
     * later one claimed under a different role.
     */
    case "MARK_NOTICE_READ":
    case "ACKNOWLEDGE_INBOX_ITEM":
    case "COMPLETE_INBOX_ITEM":
    case "REOPEN_INBOX_ITEM": {
      const next = reduceInboxEvent(state, event, decision, reject);
      if (next) return next;
      return state;
    }

    case "SET_ARRIVAL_DETAILS": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);

      const arrivalDetails = {
        mode: event.arrivalMode,
        trackingNumber: event.trackingNumber?.trim() || undefined,
        estimatedArrivalAt: event.estimatedArrivalAt,
        recordedAt: event.now,
        recordedBy: event.role,
      };

      let updatedMovement: Movement = {
        ...movement,
        arrivalDetails,
        pullExpiresAt: undefined, // Default 4h countdown timer is removed as arrival is sorted
      };

      let next = {
        ...state,
        movements: state.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
      };

      if (
        isArrivalLate(event.estimatedArrivalAt, updatedMovement.stage, event.now) &&
        updatedMovement.arrivalLateNotifiedAt === undefined
      ) {
        updatedMovement = { ...updatedMovement, arrivalLateNotifiedAt: event.now };
        next = {
          ...next,
          movements: next.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
        };
        const notices = [
          makeNotice(
            event.now,
            next.notices.length,
            "arrival_late_referrer",
            { role: "ed", placeId: movement.originEdId },
            { movementId: movement.id },
            `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
          ),
        ];
        if (movement.acceptedUnitId) {
          notices.push(
            makeNotice(
              event.now,
              next.notices.length + 1,
              "arrival_late_ward",
              { role: "ward", placeId: movement.acceptedUnitId },
              { movementId: movement.id, unitId: movement.acceptedUnitId },
              `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
            ),
          );
        }
        return appendNotices(next, notices);
      }

      return next;
    }

    case "SET_STEP_DOWN_CANDIDATE": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      // Same claim-not-proof discipline as RECORD_LEAVING: a ward may only touch its own admission.
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `SET_STEP_DOWN_CANDIDATE was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
        );
      }

      const updatedAdmission: Admission = {
        ...admission,
        stepDownCandidate: event.stepDownCandidate,
      };

      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? updatedAdmission : a)),
      };
    }

    case "SET_DISCHARGE_BARRIER": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `SET_DISCHARGE_BARRIER was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
        );
      }

      const stay = daysInBed(admission, event.now) ?? 0;
      if (stay < 7 && event.barrier !== null && event.barrier !== "None") {
        return reject(
          state,
          event,
          `Cannot set discharge barrier: patient length of stay (${stay} days) is less than 7 days`,
        );
      }

      const updatedAdmission: Admission = {
        ...admission,
        dischargeBarrier: event.barrier === "None" ? null : event.barrier,
      };

      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? updatedAdmission : a)),
      };
    }

    case "RECORD_MOVEMENT_MEDICAL_CLEARANCE": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);

      const updatedMovement: Movement = {
        ...movement,
        medicalClearance: { cleared: event.cleared, at: event.now },
      };

      let referrals = state.referrals;
      if (movement.referralId) {
        referrals = referrals.map((r) =>
          r.id === movement.referralId && (movement.patientId === undefined || movement.patientId === r.patientId)
            ? { ...r, medicalClearance: { cleared: event.cleared, at: event.now } }
            : r,
        );
      }

      return {
        ...state,
        movements: state.movements.map((m) =>
          m.id === movement.id ||
          (movement.referralId !== undefined &&
            m.referralId === movement.referralId &&
            referrals.some(
              (r) =>
                r.id === movement.referralId &&
                (movement.patientId === undefined || movement.patientId === r.patientId) &&
                (m.patientId === undefined || m.patientId === r.patientId),
            ))
            ? { ...m, medicalClearance: updatedMovement.medicalClearance }
            : m,
        ),
        referrals,
      };
    }

    case "UPLOAD_PATIENT_FORM": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);

      // This prototype records document details only; empty details are not a document.
      if (
        typeof event.formName !== "string" ||
        event.formName.trim().length === 0 ||
        typeof event.fileName !== "string" ||
        event.fileName.trim().length === 0
      ) {
        return reject(state, event, "Enter the document name and file name.");
      }
      const sizeBytes = event.sizeBytes;
      if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
        return reject(state, event, "Document details need a non-empty file with a valid byte size.");
      }

      const newForm = {
        id: `FORM-${event.now}-${(movement.uploadedForms?.length ?? 0) + 1}`,
        formName: event.formName,
        fileName: event.fileName,
        sizeBytes,
        uploadedAt: event.now,
        uploadedBy: event.role,
      };

      const updatedMovement: Movement = {
        ...movement,
        uploadedForms: [...(movement.uploadedForms ?? []), newForm],
      };

      return {
        ...state,
        movements: state.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
      };
    }

    case "RECORD_LEGAL_FORM_WRITTEN": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot record a written form for a closed movement (${movement.closure.reason})`);
      }
      if (
        (event.region !== undefined && !["metro", "country"].includes(event.region)) ||
        !Number.isFinite(event.writtenAt) ||
        (event.paperExpiresAt !== undefined && !Number.isFinite(event.paperExpiresAt))
      ) {
        return reject(state, event, "Enter the time and expiry written on the form.");
      }
      if (!isLegalClockFormCode(event.formCode)) {
        return reject(state, event, `Form ${event.formCode} is not a recognised legal form in this prototype`);
      }
      if (event.formCode === "3C" && form3CRefusedAfter3D(movement.legalForm?.code ?? movement.legalClock?.code)) {
        return reject(state, event, `Form 3C is refused when the person arrived on a Form 3D`);
      }
      const kind =
        event.formCode === "1A"
          ? ("examination" as const)
          : event.formCode === "3A" || event.formCode === "3C" || event.formCode === "3D"
            ? ("detention" as const)
            : undefined;
      // Editing the current form's written time preserves its recorded paper facts. A different
      // form starts new facts; a legacy calculated expiry is never promoted to paper authority.
      const sameFormTimeEdit = movement.legalForm?.code === event.formCode && event.paperExpiresAt === undefined;
      const currentPaperExpiry =
        movement.legalClock !== undefined && movement.legalForm?.dueAt === movement.legalClock.expiresAt
          ? undefined
          : movement.legalForm?.dueAt;
      const dueAt = event.paperExpiresAt ?? (sameFormTimeEdit ? currentPaperExpiry : undefined);
      const updated: Movement = {
        ...movement,
        formedAt: event.writtenAt,
        legalForm: {
          code: event.formCode,
          kind,
          ...(event.region
            ? { region: event.region }
            : sameFormTimeEdit && movement.legalForm?.region
              ? { region: movement.legalForm.region }
              : {}),
          ...(dueAt === undefined ? {} : { dueAt }),
        },
        legalClock: undefined,
        legalFormReceivedAt: sameFormTimeEdit ? movement.legalFormReceivedAt : undefined,
        legalFormExpiryHistory:
          event.paperExpiresAt === undefined
            ? movement.legalFormExpiryHistory
            : [
                ...(movement.legalFormExpiryHistory ?? []),
                { at: event.now, by: event.role, dueAt: event.paperExpiresAt, basis: "written_on_form" },
              ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_COUNTRY_EXTENSION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure || event.paperExpiresAt === undefined || !Number.isFinite(event.paperExpiresAt))
        return reject(
          state,
          event,
          "Country extensions are recorded as a typed expiry. Enter the new expiry written on the country extension form.",
        );
      if (!countryExtensionEligible(movement))
        return reject(
          state,
          event,
          "A country extension requires a current Form 1A with its paper setting recorded as country.",
        );
      const next = reduceClinicalEvent(
        state,
        {
          type: "RECORD_LEGAL_FORM_EXPIRY",
          role: event.role,
          now: event.now,
          movementId: event.movementId,
          dueAt: event.paperExpiresAt,
        },
        decision,
      );
      if (next.rejections.length === state.rejections.length) {
        decision.outcome = "accepted";
        decision.reasonCode = "none";
      }
      return next;
    }

    case "RECORD_LEGAL_FORM_CONTINUATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This record is closed, so no continuation can be added.");
      if (
        (event.region !== undefined && !["metro", "country"].includes(event.region)) ||
        !Number.isFinite(event.startedAt) ||
        (event.paperExpiresAt !== undefined && !Number.isFinite(event.paperExpiresAt))
      ) {
        return reject(state, event, "Enter the time and expiry written on the form.");
      }
      if (!isLegalClockFormCode(event.formCode)) {
        return reject(state, event, `Form ${event.formCode} is not a recognised legal form in this prototype`);
      }
      const expiryHistory =
        event.paperExpiresAt === undefined
          ? movement.legalFormExpiryHistory
          : [
              ...(movement.legalFormExpiryHistory ?? []),
              { at: event.now, by: event.role, dueAt: event.paperExpiresAt, basis: "written_on_form" as const },
            ];
      // Owner ruling 2026-09-25: a Form 5B CONTINUES a current Form 5A (one community treatment
      // order) rather than replacing it. The 5A record, its start (`formedAt`) and its receipt stay;
      // the 5B is recorded as `continuedBy`, and the current end is the 5B's typed end (unknown if
      // none was typed). The 5A's own typed end is kept on `continuedBy`. Nothing is computed.
      if (event.formCode === "5B" && movement.legalForm?.code === "5A") {
        // A second 5B updates the continuation; the 5A's own typed end is kept from the first.
        const { dueAt: currentDueAt, continuedBy: earlier, ...fiveA } = movement.legalForm;
        const continuedFormDueAt = earlier === undefined ? currentDueAt : earlier.continuedFormDueAt;
        const continued: Movement = {
          ...movement,
          legalForm: {
            ...fiveA,
            ...(event.paperExpiresAt === undefined ? {} : { dueAt: event.paperExpiresAt }),
            continuedBy: {
              code: event.formCode,
              startedAt: event.startedAt,
              recordedAt: event.now,
              by: event.role,
              ...(continuedFormDueAt === undefined ? {} : { continuedFormDueAt }),
            },
          },
          legalClock: undefined,
          legalFormExpiryHistory: expiryHistory,
        };
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        return replaceMovement(state, movement.id, continued);
      }
      // Any other continuation replaces current paper facts while retaining the earlier expiry history.
      const updated: Movement = {
        ...movement,
        formedAt: event.startedAt,
        legalForm: {
          code: event.formCode,
          ...(event.region ? { region: event.region } : {}),
          ...(event.paperExpiresAt === undefined ? {} : { dueAt: event.paperExpiresAt }),
        },
        legalClock: undefined,
        legalFormReceivedAt: undefined,
        legalFormExpiryHistory: expiryHistory,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    case "EVALUATE_ARRIVAL_LATENESS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      if (movement.arrivalLateNotifiedAt !== undefined) return state;
      if (!isArrivalLate(movement.arrivalDetails?.estimatedArrivalAt, movement.stage, event.now)) {
        return state;
      }
      const updated: Movement = { ...movement, arrivalLateNotifiedAt: event.now };
      const next = replaceMovement(state, movement.id, updated);
      const notices = [
        makeNotice(
          event.now,
          next.notices.length,
          "arrival_late_referrer",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id },
          `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
        ),
      ];
      if (movement.acceptedUnitId) {
        notices.push(
          makeNotice(
            event.now,
            next.notices.length + 1,
            "arrival_late_ward",
            { role: "ward", placeId: movement.acceptedUnitId },
            { movementId: movement.id, unitId: movement.acceptedUnitId },
            `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
          ),
        );
      }
      return appendNotices(next, notices);
    }

    case "RELEASE_AND_REOPEN_SEARCH": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot release and reopen a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled" && movement.stage !== "accepted_awaiting_bed") {
        return reject(
          state,
          event,
          `cannot release and reopen at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (movement.transport !== undefined && movement.transport.cancelledAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing and reopening the search`,
        );
      }
      if (!RELEASE_PULL_REASONS.includes(event.reason)) {
        return reject(state, event, `RELEASE_AND_REOPEN_SEARCH reason must be chosen from RELEASE_PULL_REASONS`);
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_AND_REOPEN_SEARCH was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is at ${movement.acceptedUnitId}`,
        );
      }
      const withoutPhantom = releasePulledBedAndAdmission(state, movement, event.now);
      const updatedMovement: Movement = {
        ...movement,
        stage: "placement_requested",
        acceptedUnitId: undefined,
        acceptedAt: undefined,
        admissionId: undefined,
        pullExpiresAt: undefined,
        waitlistedUnitIds: undefined,
        referredUnitIds: [],
        transport: undefined,
        blocker: STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn,
        unwinds: [...movement.unwinds, { at: event.now, kind: "pull_released", by: event.role, reason: event.reason }],
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "placement_requested", by: event.role, reason: event.reason },
        ],
      };
      const next = replaceMovement(withoutPhantom, movement.id, updatedMovement);
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "bed_pull_released",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: event.actingUnitId },
          `Bed released and search reopened for ${movement.id} (${event.reason.replace(/_/g, " ")}).`,
        ),
      ]);
    }

    case "CLEAR_EXPECT_FLAG": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      if (!movement.expectFlag || movement.expectFlag.clearedAt !== undefined) {
        return reject(state, event, `movement ${movement.id} has no open expect flag to clear`);
      }
      const updated: Movement = {
        ...movement,
        expectFlag: { ...movement.expectFlag, clearedAt: event.now, clearedBy: event.role },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RAISE_EXPECT_FLAG": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      if (movement.expectFlag && movement.expectFlag.clearedAt === undefined) {
        return reject(state, event, `movement ${movement.id} already has an open expect flag`);
      }
      // A type-only union passes `vitest run` with no tsc, so membership is enforced at runtime too.
      if (event.kind !== "voluntary_48h" && event.kind !== "involuntary_7d") {
        return reject(state, event, `RAISE_EXPECT_FLAG kind must be "voluntary_48h" or "involuntary_7d"`);
      }
      const updated: Movement = {
        ...movement,
        expectFlag: { raisedAt: event.now, kind: event.kind },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "FLAG_LEGAL_MISMATCH": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      const involuntary = movement.legalStatus !== "Voluntary";
      const derived =
        involuntary && !unit.authorised
          ? ("involuntary_on_voluntary_ward" as const)
          : movement.legalStatus === "Voluntary" && unit.lockedBeds > 0 && unit.beds - unit.lockedBeds <= 0
            ? ("voluntary_on_locked_ward" as const)
            : null;
      if (!derived || event.kind !== derived)
        return reject(state, event, "The selected legal mismatch must match the current ward and patient status.");
      const kind = derived;
      const updated: Movement = {
        ...movement,
        legalMismatch: { at: event.now, unitId: event.unitId, kind },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "EVALUATE_LEAVE_BED_WARNINGS": {
      let noticeCount = state.notices.length;
      const notices: Notice[] = [];
      const leaveBeds = state.leaveBeds.map((leaveBed) => {
        if (leaveBed.openWarningAt !== undefined) return leaveBed;
        if (!leaveBedNeedsOpenWarning(leaveBed.confirmedAt, leaveBed.openWarningAt, event.now)) {
          return leaveBed;
        }
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "leave_bed_open_warning",
            { role: "ward", placeId: leaveBed.unitId },
            { unitId: leaveBed.unitId },
            `Leave bed ${leaveBed.id} has been away for more than 24 hours — consider opening it.`,
          ),
        );
        return { ...leaveBed, openWarningAt: event.now };
      });
      const next = { ...state, leaveBeds };
      return notices.length === 0 ? next : appendNotices(next, notices);
    }

    case "CONFIRM_MORNING_ROLLUP": {
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Same claim-not-proof discipline as CONFIRM_CAPACITY: a caller stating a different unit than
      // the one being written to is refused, so one ward cannot confirm another ward's morning count.
      if (
        (event.role === "ward" && event.actingUnitId === undefined) ||
        (event.actingUnitId !== undefined && event.actingUnitId !== event.unitId)
      ) {
        return reject(
          state,
          event,
          `CONFIRM_MORNING_ROLLUP was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      if (!Number.isSafeInteger(event.expectedDischarges) || event.expectedDischarges < 0) {
        return reject(state, event, "expectedDischarges must be a finite, non-negative whole number");
      }
      return {
        ...state,
        morningRollupConfirmations: {
          ...state.morningRollupConfirmations,
          [event.unitId]: {
            confirmedAt: event.now,
            confirmedByRole: event.role,
            expectedDischarges: event.expectedDischarges,
          },
        },
      };
    }

    case "SEND_WARD_BUZZ": {
      if (
        !WARD_BUZZ_MESSAGES.includes(event.message) ||
        (event.urgent !== undefined && typeof event.urgent !== "boolean")
      )
        return reject(state, event, "Choose a valid ward refresh message.");
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      return {
        ...state,
        refreshRequests: [
          ...state.refreshRequests,
          {
            unitId: unit.id,
            at: event.now,
            byRole: event.role,
            message: event.message,
            urgent: event.urgent,
          },
        ],
      };
    }

    case "RECORD_HANDOVER_SIGN_OFF": {
      // Role and time only. Never a note, a name, or a claim that anyone was notified.
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const recorded: HandoverSignOffRecord = { at: event.now, by: event.role };
      const existing = Array.isArray(state.handoverSignOffs) ? state.handoverSignOffs : [];
      return { ...state, handoverSignOffs: [...existing, recorded] };
    }

    case "RECORD_REPATRIATION": {
      // Phone-log only. Never mints a transport job and never claims a booking went through.
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      const existing = Array.isArray(state.repatriations) ? state.repatriations : [];
      if (existing.some((record) => record.admissionId === admission.id)) {
        return reject(state, event, `admission ${admission.id} already has a repatriation record`);
      }
      if (!siteByCode(event.homeHospital)) {
        return reject(state, event, `RECORD_REPATRIATION homeHospital ${event.homeHospital} does not name a real site`);
      }
      if (typeof event.receivingWardAgreed !== "boolean") {
        return reject(state, event, `RECORD_REPATRIATION receivingWardAgreed must be answered, and it has no default`);
      }
      if (!(REPATRIATION_MODES as readonly string[]).includes(event.mode)) {
        return reject(state, event, `RECORD_REPATRIATION mode must be chosen from REPATRIATION_MODES`);
      }
      if (!(TRANSPORT_PROVIDERS as readonly string[]).includes(event.provider)) {
        return reject(state, event, `RECORD_REPATRIATION provider must be chosen from TRANSPORT_PROVIDERS`);
      }
      if (typeof event.cadNumber !== "string" || event.cadNumber.trim().length === 0) {
        return reject(state, event, `RECORD_REPATRIATION cadNumber must be answered, and it has no default`);
      }
      if (!TRANSPORT_LEGAL_STATUSES.includes(event.transportLegalStatus)) {
        return reject(
          state,
          event,
          `RECORD_REPATRIATION transportLegalStatus must be chosen from TRANSPORT_LEGAL_STATUSES`,
        );
      }
      if (typeof event.estimatedAt !== "number" || !Number.isFinite(event.estimatedAt)) {
        return reject(state, event, `RECORD_REPATRIATION estimatedAt must be answered, and it has no default`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const recorded: RepatriationRecord = {
        admissionId: admission.id,
        at: event.now,
        by: event.role,
        homeHospital: event.homeHospital,
        receivingWardAgreed: event.receivingWardAgreed,
        mode: event.mode,
        provider: event.provider,
        cadNumber: event.cadNumber.trim(),
        transportLegalStatus: event.transportLegalStatus,
        estimatedAt: event.estimatedAt,
      };
      let nextMovements = state.movements;
      let nextSequence = state.referralSequence;
      if (event.receivingWardAgreed) {
        nextSequence = state.referralSequence + 1;
        let returnMovementId = nextReferralId(nextSequence);
        while (state.movements.some((m) => m.id === returnMovementId)) {
          nextSequence++;
          returnMovementId = nextReferralId(nextSequence);
        }
        const currentUnit = findUnit(state, admission.unitId);
        const currentSite = currentUnit?.siteCode ? siteByCode(currentUnit.siteCode) : undefined;
        const currentEdId =
          currentSite?.emergencyDepartment?.id ??
          allEmergencyDepartments().find((ed) => ed.siteCode === currentSite?.code)?.id ??
          allEmergencyDepartments()[0]?.id ??
          "rph-ed";
        const targetSite = siteByCode(event.homeHospital);
        const targetHealthService = targetSite?.service ?? "North Metro";

        const returnMovement: Movement = {
          id: returnMovementId,
          patientId: admission.patientId ?? undefined,
          originEdId: currentEdId,
          openedAt: event.now,
          referralId: admission.referralId ?? undefined,
          referralAbsence: admission.referralId ? undefined : { reason: "not_asked", at: event.now },
          flaggedUrgent: false,
          urgency: 2,
          cohort: currentUnit?.cohort ?? "Adult",
          security:
            admission.bedKind === "locked" || (currentUnit ? currentUnit.lockedBeds > 0 : false) ? "Secure" : "Open",
          sex: admission.sex,
          gender: admission.gender,
          tentativeDiagnosis: admission.tentativeDiagnosis ?? undefined,
          specialling: admission.specialling,
          highAcuity: admission.highAcuity,
          legalStatus: event.transportLegalStatus === "involuntary" ? "Involuntary inpatient" : "Voluntary",
          statusChanges: [],
          urgencyChanges: [],
          overrides: [],
          stage: "placement_requested",
          owner: currentSite?.name ?? "Outside Hospital",
          referredUnitIds: [],
          declines: [],
          blocker: `Repatriation to ${targetSite?.name ?? event.homeHospital} (${targetHealthService}) agreed; awaiting destination bed placement`,
          withdrawnReferrals: [],
          unwinds: [],
          stageChanges: [{ at: event.now, to: "placement_requested", by: event.role }],
          homeRegion: admission.homeRegion ?? undefined,
          admissionId: admission.id,
        };
        nextMovements = [...state.movements, returnMovement];
      }
      return {
        ...state,
        repatriations: [...existing, recorded],
        movements: nextMovements,
        referralSequence: nextSequence,
      };
    }

    case "RECORD_CLINICAL_CONTACT": {
      // Contacting a team is this record, not a sent message.
      const team = communityTeamById(event.teamId);
      if (!team)
        return reject(state, event, `RECORD_CLINICAL_CONTACT teamId ${event.teamId} does not name a real team`);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const recorded: ClinicalContactRecord = { teamId: team.id, at: event.now, by: event.role };
      const existing = Array.isArray(state.clinicalContacts) ? state.clinicalContacts : [];
      return { ...state, clinicalContacts: [...existing, recorded] };
    }

    case "DISPATCH_BROADCAST_ALERT":
    case "ACKNOWLEDGE_BROADCAST_ALERT":
    case "STAND_DOWN_BROADCAST_ALERT": {
      const next = reduceBroadcastAlertEvent(state, event, decision, reject);
      if (next) return next;
      return state;
    }
  }
  return state;
}
