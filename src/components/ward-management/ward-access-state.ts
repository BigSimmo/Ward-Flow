/**
 * **THE WHOLE SAVED WORKSPACE, SCOPED TO ONE ROLE AT ONE PLACE (role access plan PR 2, server half).**
 *
 * `scopeWorkspace` (`ward-access-scope.ts`) decides which people a desk sees. The shared server
 * sends the whole saved `WardFlowState`, so this module carries that same rule across every other
 * field of the state: a field that holds people is narrowed to the people the desk sees, and a
 * field that only describes places or counters is kept. `FIELD_RULES` names every field of
 * `WardFlowState`, so a field added later fails the typecheck until someone decides who may see it.
 *
 * `commandScopeRefusal` is the matching write check: a command naming any record outside the
 * desk's scope, or a record seen only through break glass, is refused before the reducer runs.
 *
 * Pure and browser free: the backend bundles this module through `build-engine.mjs`, so the server
 * and the screens use one rule.
 */
import { meetingActionOfInboxId } from "./bed-meeting/bed-meeting-actions";
import { sharedHistoryLine, type AuditEvent, type AuditReview } from "@/components/ward-management/ward-audit";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { syntheticGovernanceAuditEvents } from "@/components/ward-management/ward-governance-seed";
import { OUTSIDE_PLACE, placeRuleRefusal, teamIsOwn } from "@/components/ward-management/ward-permit-place-rules";
import { adjustSexMix, mixSexOf } from "@/components/ward-management/ward-eligibility";
import { plannedAdmissionLegalStatus } from "@/components/ward-management/ward-discharge-records";
import type { PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";
import type { Sex, Unit } from "@/components/ward-management/ward-model";
import {
  auditDetailWardInScope,
  bookingPersonShown,
  communityTeamKey,
  countsOnlyBedRelease,
  countsOnlyLeaveBed,
  countsOnlyPlannedAdmission,
  scopeBroadcastAlerts,
  scopeWorkspace,
  seenThroughBreakGlass,
  withBookedPatients,
  type BreakGlassGrant,
} from "@/components/ward-management/ward-access-scope";
import {
  accessIsWholeNetwork,
  ROLE_SCREENS,
  unitInScope,
  type PlaceLookup,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { returnEarlyNoticesFor } from "./out-of-area/return-early";
import { diversionReturnsForTeam } from "./community/diversion-return-review";
import { CLINICAL_VALUES } from "./ward-clinical-values";
import { MINUTES_PER_DAY } from "./ward-clock";
import { isBreakGlassReviewId } from "./ward-break-glass-review-id";

type Context = {
  readonly state: WardFlowState;
  readonly access: WardAccess;
  readonly scoped: ReturnType<typeof scopeWorkspace<WardFlowState>>;
  readonly coordinator: boolean;
  readonly unitIn: (unitId: string) => boolean;
  readonly places: PlaceLookup;
  readonly admissionIds: ReadonlySet<string>;
  /** Movement, stay and planned admission ids an inbox row may name after its prefix. */
  readonly inboxSubjectIds: ReadonlySet<string>;
  readonly auditEvents: readonly AuditEvent[];
  readonly reviewableBreakGlassEventIds: ReadonlySet<string>;
  /** The time the copy is cut at, for the windowed derivations below. */
  readonly now: number;
};

const keep =
  <K extends keyof WardFlowState>(key: K) =>
  (context: Context): WardFlowState[K] =>
    context.state[key];

/**
 * D-152: the community desk's own returns to ED after a diversion, from the whole workspace. Any
 * other desk gets none: a ward, ED, officer or coordinator copy never carries them.
 */
function diversionReturnsForDesk(context: Context): NonNullable<WardFlowState["diversionReturns"]> {
  const { access } = context;
  if (access.role !== "community" || access.scope.kind !== "team") return [];
  const ownTeam = communityTeamKey(access.scope.teamName);
  if (ownTeam === "") return [];
  const sent = new Set(context.scoped.referrals.map((referral) => referral.id));
  return diversionReturnsForTeam(
    context.state,
    (teamName) => communityTeamKey(teamName) === ownTeam,
    CLINICAL_VALUES.diversionReturnReview.value * MINUTES_PER_DAY,
    context.now,
  ).filter((record) => sent.has(record.referralId));
}

/** Every ward of the site is inside the desk's scope (and the site has a ward). */
function siteWithinScope(context: Pick<Context, "state" | "unitIn">, siteCode: string): boolean {
  const wards = context.state.units.filter((unit) => unit.siteCode === siteCode);
  return wards.length > 0 && wards.every((unit) => context.unitIn(unit.id));
}

/** The desks that may book a planned admission (`BOOK_PLANNED_ADMISSION`), and so see whom they booked. */
function bookingDesk(role: WardAccess["role"]): boolean {
  return (EVENT_ROLE.BOOK_PLANNED_ADMISSION as readonly string[]).includes(role);
}

/**
 * The planned bookings a desk is sent, read by the server copy and the browser's own projection
 * alike (Josh, 27 Oct 2026). A desk that books gets those for its own wards, with whom they name, so
 * its Capacity forecast counts the same arrivals the coordinator's does. The executive gets only the
 * open ones, as counts: an arrived booking would name its admission's person, and the forecast reads
 * only those still booked. Every other desk gets none.
 */
export function plannedAdmissionsForDesk(
  bookings: readonly PlannedAdmission[],
  role: WardAccess["role"],
  unitIn: (unitId: string) => boolean,
): PlannedAdmission[] {
  if (bookingDesk(role)) return bookings.filter((booking) => unitIn(booking.unitId));
  if (role !== "executive") return [];
  return bookings
    .filter((booking) => booking.state === "booked" && unitIn(booking.unitId))
    .map(countsOnlyPlannedAdmission);
}

/** An inbox map keeps only the rows about the desk's own movements, stays and bookings. */
const inboxRows =
  <K extends "inboxAcknowledgements" | "inboxCompletions" | "inboxOwnership" | "inboxSnoozes">(key: K) =>
  (context: Context): WardFlowState[K] =>
    context.access.role === "executive"
      ? ({} as WardFlowState[K])
      : (Object.fromEntries(
          Object.entries(context.state[key]).filter(([rowId]) => {
            const category = Object.values(INBOX_CATEGORIES).find(({ idPrefix }) => rowId.startsWith(idPrefix));
            const subjectId =
              meetingActionOfInboxId(rowId)?.subject.id ??
              (category ? rowId.slice(category.idPrefix.length) : undefined);
            return subjectId !== undefined && context.inboxSubjectIds.has(subjectId);
          }),
        ) as WardFlowState[K]);

/** D-222: a line a desk acted on another ward's behalf stays with that ward's desks. */
function actedInScope(event: AuditEvent, unitIn: (unitId: string) => boolean): boolean {
  const acting = event.actor.actingUnitId;
  return acting === null || unitIn(acting);
}

/** Is an audit entry about something the desk sees. Configuration and unresolved entries are not. */
function auditSubjectInScope(event: AuditEvent, context: Context): boolean {
  const subject = event.subject;
  const has = (ids: readonly { id: string }[], id: string) => ids.some((item) => item.id === id);
  switch (subject.kind) {
    case "admission":
      return context.admissionIds.has(subject.admissionId);
    case "movement":
      return has(context.scoped.movements, subject.movementId);
    case "referral":
      return has(context.scoped.referrals, subject.referralId);
    case "bed-release":
      return context.unitIn(subject.unitId);
    // D-222: a line about a person this desk sees, or about one of its wards. A bed call stays out.
    case "patient":
      return context.scoped.patients.some((patient) => patient.id === subject.patientId);
    case "unit":
      return context.unitIn(subject.unitId);
    default:
      return false;
  }
}

/**
 * The seeded governance entries (`ward-governance-seed.ts`) a coordinator's own screens show. They
 * are derived, never stored, and the browser derives them from the workspace it was sent, from its
 * own first journeys, referral and stay. The server derives them the same way, so a review is sent,
 * and may be made, exactly when the desk's screens show its entry. Each id names its subject, so desks
 * share a review only when they show the same entry about the same record.
 */
function seededAuditIds(sent: Pick<WardFlowState, "movements" | "referrals" | "admissions">, state: WardFlowState) {
  return new Set(syntheticGovernanceAuditEvents({ ...state, ...sent }).map((event) => event.id));
}

/**
 * An admission or transfer notification belongs to the ward the person arrived on. A sending ward
 * still sees its outbound move, but never the receiving ward's notes about it (review on PR #365).
 */
function notifiesOnArrival(
  context: Pick<Context, "unitIn"> & { readonly wholeNetwork: boolean },
  movement: { acceptedUnitId?: string | null },
): boolean {
  // A service coordinator sees notes only from wards in its own service, as a ward desk does. With
  // no receiving ward recorded the notes belong to no service, so only the statewide desk sees them.
  return typeof movement.acceptedUnitId === "string" ? context.unitIn(movement.acceptedUnitId) : context.wholeNetwork;
}

/**
 * The support notifications one desk sees: a discharge note only for a stay it is sent in full, an
 * arrival note only from a ward it covers. The scoped state and the browser shell share this rule.
 * An emergency department sees only the advocacy notice on a move it can see that has not yet
 * arrived, the one record it may make (item 15, D-134), so its checklist shows it as done.
 */
export function supportNotificationsForDesk<R extends { occasion: string; subjectId: string; party: string }>(
  records: readonly R[] | undefined,
  desk: Pick<Context, "coordinator" | "unitIn"> & {
    readonly wholeNetwork: boolean;
    readonly role: WardAccess["role"];
    readonly movements: readonly { id: string; acceptedUnitId?: string | null; closure?: unknown }[];
    readonly wholeStay: (admissionId: string) => boolean;
  },
): R[] {
  if (desk.role === "ed")
    return (records ?? []).filter(
      (record) =>
        record.occasion === "admission" &&
        record.party === "mhas" &&
        desk.movements.some((movement) => movement.id === record.subjectId && movement.closure === undefined),
    );
  if (!desk.coordinator && desk.role !== "ward") return [];
  return (records ?? []).filter((record) =>
    record.occasion === "discharge"
      ? desk.wholeStay(record.subjectId)
      : desk.movements.some((movement) => movement.id === record.subjectId && notifiesOnArrival(desk, movement)),
  );
}

/** A stay this desk is sent in full: in its scope, and not cut to ward and dates only. */
function wholeStay(context: Context, admissionId: string): boolean {
  return context.admissionIds.has(admissionId) && !context.scoped.datesOnlyAdmissionIds.has(admissionId);
}

/** Batch 3 items 21 and 23: a record about one stay or bed request goes only with that stay or request. */
function stayOrRequestVisible(context: Context, record: { admissionId?: string; movementId?: string }): boolean {
  if (record.admissionId !== undefined) return wholeStay(context, record.admissionId);
  return (
    record.movementId !== undefined && context.scoped.movements.some((movement) => movement.id === record.movementId)
  );
}

/**
 * Who may see each field of the saved workspace. Every field is listed, so the typecheck fails when
 * a new one arrives unclassified. "keep" fields describe places, settings or counters, never people.
 */
const FIELD_RULES: { readonly [K in keyof WardFlowState]-?: (context: Context) => WardFlowState[K] } = {
  // Counters, settings and places.
  worldGeneration: keep("worldGeneration"),
  auditSequence: keep("auditSequence"),
  auditReviewSequence: keep("auditReviewSequence"),
  auditCaptureStartedAt: keep("auditCaptureStartedAt"),
  clockOffsetMinutes: keep("clockOffsetMinutes"),
  referralSequence: keep("referralSequence"),
  leaveBedSequence: keep("leaveBedSequence"),
  frontDoorReferralSequence: keep("frontDoorReferralSequence"),
  patientSequence: keep("patientSequence"),
  admissionSequence: keep("admissionSequence"),
  broadcastSequence: keep("broadcastSequence"),
  plannedAdmissionSequence: keep("plannedAdmissionSequence"),
  scenario: keep("scenario"),
  // M12: a world setting, no person. Every desk reads it for the Tools panel and Reset demo.
  workedExamples: keep("workedExamples"),
  configuration: keep("configuration"),
  // D-72: a ward's seclusion and restraint record goes to the desks that open the Seclusion view and
  // hold the ward, which still see an episode whose patient has left so they can record its end.
  // Other such desks get only their own stays' episodes, and no other ward's room or incidents. A
  // role without the view, such as an access admin or an executive, gets none of it. F-150: scoped units.
  units: (context) => {
    const seesView = ROLE_SCREENS[context.access.role].seclusion !== undefined;
    return context.scoped.units.map((unit) =>
      !unit.restrictivePractice || (seesView && context.unitIn(unit.id))
        ? unit
        : {
            ...unit,
            restrictivePractice: {
              incidents: [],
              episodes: seesView
                ? unit.restrictivePractice.episodes.filter((episode) => context.admissionIds.has(episode.admissionId))
                : [],
            },
          },
    );
  },
  morningRollupConfirmations: keep("morningRollupConfirmations"),
  // Role, time and ward only, no person. Decision 41 (Josh, 31 Oct 2026): a desk is sent the
  // sign-offs of its own wards' sheets. One that names no ward (a whole-network sign-off, or any
  // saved before 31 Oct 2026) is never given a guessed ward, so only the statewide desk, which is
  // sent the state unchanged, sees it, as "Ward not recorded".
  handoverSignOffs: (context) =>
    (Array.isArray(context.state.handoverSignOffs) ? context.state.handoverSignOffs : []).filter(
      (signOff) => typeof signOff.unitId === "string" && context.unitIn(signOff.unitId),
    ),
  // Q61 (Josh, 31 Oct 2026): a site's handover sign-off goes to the site bed manager of that site, and
  // to a coordinator whose scope holds every ward of the site. No ward, ED or team desk is sent one.
  siteHandoverSignOffs: (context) =>
    (Array.isArray(context.state.siteHandoverSignOffs) ? context.state.siteHandoverSignOffs : []).filter((record) =>
      context.access.role === "bed_manager"
        ? context.access.scope.kind === "site" && context.access.scope.siteCode === record.siteCode
        : context.coordinator && siteWithinScope(context, record.siteCode),
    ),
  // Which team was contacted and when: a team's own desk sees its own, and nobody else's.
  clinicalContacts: (context) =>
    context.state.clinicalContacts.filter((contact) => teamIsOwn(context.access, contact.teamId, context.places)),
  // People, through the one scoping rule.
  movements: (context) => context.scoped.movements,
  referrals: (context) => context.scoped.referrals,
  patients: (context) =>
    withBookedPatients(
      context.scoped.patients,
      context.state.patients,
      bookingDesk(context.access.role)
        ? plannedAdmissionsForDesk(context.state.plannedAdmissions, context.access.role, context.unitIn)
        : [],
    ),
  admissions: (context) => context.scoped.admissions,
  notices: (context) => context.scoped.notices,
  dischargeRevisions: (context) =>
    Object.fromEntries(
      Object.entries(context.state.dischargeRevisions).filter(([admissionId]) => wholeStay(context, admissionId)),
    ),
  // A bed release or leave bed is one person's stay, so it goes where the stay goes, and never with
  // a stay sent as ward and dates only.
  bedReleases: (context) =>
    context.state.bedReleases
      .filter((release) => wholeStay(context, release.admissionId))
      .map((release) => (context.access.role === "executive" ? countsOnlyBedRelease(release) : release)),
  leaveBeds: (context) =>
    context.state.leaveBeds
      .filter((bed) => wholeStay(context, bed.admissionId))
      .map((bed) => (context.access.role === "executive" ? countsOnlyLeaveBed(bed) : bed)),
  inboxAcknowledgements: inboxRows("inboxAcknowledgements"),
  inboxCompletions: inboxRows("inboxCompletions"),
  inboxOwnership: inboxRows("inboxOwnership"),
  inboxSnoozes: inboxRows("inboxSnoozes"),
  broadcastAlerts: (context) =>
    scopeBroadcastAlerts(context.state.broadcastAlerts, context.access, context.state.units, context.places),
  // Audit: a coordinator's own scope; every other desk keeps only the record-access receipts its
  // own stays need, because an opened discharge record is read against its receipt.
  auditEvents: (context) => context.auditEvents,
  auditReviews: (context) => {
    if (!context.coordinator) return [];
    const kept = seededAuditIds(context.scoped, context.state);
    for (const event of context.auditEvents) kept.add(event.id);
    // Openings live outside the world. Only the server's current-place lookup can authorise
    // their review marks; an id prefix alone carries no authority.
    return context.state.auditReviews.filter((review: AuditReview) =>
      isBreakGlassReviewId(review.eventId)
        ? context.reviewableBreakGlassEventIds.has(review.eventId)
        : kept.has(review.eventId),
    );
  },
  // Coordinator records, narrowed to the coordinator's own service.
  rejections: () => [],
  refreshRequests: (context) =>
    context.coordinator ? context.state.refreshRequests.filter((request) => context.unitIn(request.unitId)) : [],
  // Closing-the-loop (package E): directory checks name a mock directory entry and a desk, never a
  // person, so every desk keeps them.
  directoryChecks: (context) => context.state.directoryChecks ?? [],
  // Staff needed (feature 10): a ward, a shift, a count and chosen reasons. Each desk keeps its wards'.
  staffRequests: (context) => (context.state.staffRequests ?? []).filter((record) => context.unitIn(record.unitId)),
  // Batch 4 (10 Nov 2026): a site switch names a site and a listed feature, never a person, so every
  // desk keeps them all (a switched-off feature is off for everyone at that site). Pack print times
  // go to the desks of the wards they were printed for; an outage window is the whole workspace's.
  siteFeatureSwitches: (context) => context.state.siteFeatureSwitches ?? [],
  downtimePackPrints: (context) =>
    (context.state.downtimePackPrints ?? []).filter((record) => context.unitIn(record.unitId)),
  outageWindows: (context) => context.state.outageWindows ?? [],
  // Batch 3 item 23: a carer callback goes where its stay or bed request goes. No name, no number.
  carerCallbacks: (context) =>
    (context.state.carerCallbacks ?? []).filter((record) => stayOrRequestVisible(context, record)),
  // Batch 3 item 21: a hand-over goes with the record its item is on, so it names nobody a desk cannot see.
  handedItems: (context) =>
    (context.state.handedItems ?? []).filter((record) =>
      record.item.kind === "referral"
        ? context.scoped.referrals.some(
            (referral) => referral.id === (record.item as { referralId: string }).referralId,
          )
        : record.item.kind === "callback"
          ? (context.state.carerCallbacks ?? []).some(
              (callback) =>
                callback.id === (record.item as { callbackId: string }).callbackId &&
                stayOrRequestVisible(context, callback),
            )
          : stayOrRequestVisible(context, record.item),
    ),
  // Closing-the-loop (package E): the coordinator's return plan, as repatriations below.
  homeServiceReturns: (context) =>
    context.coordinator
      ? (context.state.homeServiceReturns ?? []).filter((record) => context.admissionIds.has(record.admissionId))
      : [],
  // Out of area "Flag early" (Josh, 3 Nov 2026): a stay, a site, a time and a role. Sent only with a
  // stay this desk is already sent in full, so the flag never tells a desk about a person it cannot see.
  returnEarlyFlags: (context) =>
    (context.state.returnEarlyFlags ?? []).filter((record) => wholeStay(context, record.admissionId)),
  // Triage and risk (7 Nov 2026): codes about one person, sent only with a person this desk is sent.
  triages: (context) =>
    (context.state.triages ?? []).filter((record) =>
      context.scoped.patients.some((patient) => patient.id === record.patientId),
    ),
  // Shared mode (Josh, 4 Nov 2026, "Show it without the name"): the home hospital's wards, community and
  // Transport hear a flag on a stay they cannot see as a nameless notice: a site and a time, no stay id.
  returnEarlyNotices: (context) =>
    returnEarlyNoticesFor(context.state.returnEarlyFlags, context.state.admissions, {
      role: context.access.role,
      seesSite: (siteCode) => context.state.units.some((unit) => unit.siteCode === siteCode && context.unitIn(unit.id)),
      seesStay: (admissionId) => wholeStay(context, admissionId),
    }),
  // Shared mode (D-152, item 28): a community desk is not sent the later ED request, so the return
  // is found in the whole workspace. Only the taking team hears it, as a referral id it is already
  // sent and the time back: never the ED, the movement or anything typed.
  diversionReturns: (context) => diversionReturnsForDesk(context),
  repatriations: (context) =>
    context.coordinator
      ? context.state.repatriations.filter((record) => context.admissionIds.has(record.admissionId))
      : [],
  plannedAdmissions: (context) =>
    plannedAdmissionsForDesk(context.state.plannedAdmissions, context.access.role, context.unitIn),
  supportNotifications: (context) =>
    supportNotificationsForDesk(context.state.supportNotifications, {
      coordinator: context.coordinator,
      wholeNetwork: accessIsWholeNetwork(context.access),
      unitIn: context.unitIn,
      role: context.access.role,
      movements: context.scoped.movements,
      wholeStay: (admissionId) => wholeStay(context, admissionId),
    }),
  // Whole before and after records: the statewide desk's only.
  undoRecords: () => [],
};

export type StateScopeOptions = {
  readonly now: number;
  readonly places: PlaceLookup;
  readonly grants?: readonly BreakGlassGrant[];
  /** Server-resolved openings in the current desk's ordinary scope. Never browser input. */
  readonly reviewableBreakGlassEventIds?: ReadonlySet<string>;
};

/**
 * The saved workspace one role at one place may be sent. A statewide coordinator gets the state
 * itself, unchanged. `breakGlassPatientIds` lists people seen only through a grant: read only.
 */
export function scopeWardFlowState(
  state: WardFlowState,
  access: WardAccess,
  options: StateScopeOptions,
): {
  state: WardFlowState;
  breakGlassPatientIds: ReadonlySet<string>;
  scoped: ReturnType<typeof scopeWorkspace<WardFlowState>>;
} {
  if (accessIsWholeNetwork(access)) {
    const emptyGrants = new Set<string>();
    return {
      state,
      breakGlassPatientIds: emptyGrants,
      scoped: { ...state, breakGlassPatientIds: emptyGrants, datesOnlyAdmissionIds: emptyGrants },
    };
  }
  const { places } = options;
  const scoped = scopeWorkspace(state, access, { now: options.now, places, grants: options.grants });
  const unitIn = (unitId: string) => unitInScope(access.scope, unitId, places);
  const admissionIds = new Set(scoped.admissions.map((admission) => admission.id));
  const coordinator = access.role === "coordinator";
  const inboxSubjectIds = new Set<string>([
    ...scoped.movements.map((movement) => movement.id),
    ...admissionIds,
    ...(bookingDesk(access.role)
      ? state.plannedAdmissions.filter((booking) => unitIn(booking.unitId)).map((b) => b.id)
      : []),
  ]);
  const partial = {
    state,
    access,
    scoped,
    coordinator,
    unitIn,
    places,
    admissionIds,
    inboxSubjectIds,
    reviewableBreakGlassEventIds: options.reviewableBreakGlassEventIds ?? new Set<string>(),
    now: options.now,
  };
  const inScope = (event: AuditEvent) =>
    auditSubjectInScope(event, { ...partial, auditEvents: [] }) && auditDetailWardInScope(event, unitIn);
  const auditEvents = state.auditEvents.flatMap((event): AuditEvent[] => {
    if (access.role === "executive") return [];
    if (coordinator) return inScope(event) ? [event] : [];
    const receipt =
      event.category === "record-access" &&
      event.subject.kind === "admission" &&
      admissionIds.has(event.subject.admissionId) &&
      // A dates-only stay opens no record, so it has no receipt to read (audit 26 Oct).
      !scoped.datesOnlyAdmissionIds.has(event.subject.admissionId);
    if (receipt) return [event];
    // D-222 (choice 1): accepted lines about records this desk sees, without their before/after facts.
    const shared = inScope(event) && actedInScope(event, unitIn) ? sharedHistoryLine(event) : null;
    return shared ? [shared] : [];
  });
  const context: Context = { ...partial, auditEvents };
  const next = {} as Record<keyof WardFlowState, unknown>;
  for (const key of Object.keys(FIELD_RULES) as (keyof WardFlowState)[]) next[key] = FIELD_RULES[key](context);
  // An optional field the saved state never had stays absent, as the stored-state check expects.
  if (state.supportNotifications === undefined) delete next.supportNotifications;
  if (state.undoRecords === undefined) delete next.undoRecords;
  if (state.siteHandoverSignOffs === undefined) delete next.siteHandoverSignOffs;
  if (state.returnEarlyFlags === undefined) delete next.returnEarlyFlags;
  if (state.triages === undefined) delete next.triages;
  if (state.staffRequests === undefined) delete next.staffRequests;
  if (state.siteFeatureSwitches === undefined) delete next.siteFeatureSwitches;
  if (state.downtimePackPrints === undefined) delete next.downtimePackPrints;
  if (state.outageWindows === undefined) delete next.outageWindows;
  if (state.handedItems === undefined) delete next.handedItems;
  if (state.carerCallbacks === undefined) delete next.carerCallbacks;
  if ((next.returnEarlyNotices as unknown[]).length === 0) delete next.returnEarlyNotices;
  if ((next.diversionReturns as unknown[]).length === 0) delete next.diversionReturns;
  return {
    state: closeReferences(next as WardFlowState, scoped.datesOnlyAdmissionIds, state, access.role !== "executive"),
    breakGlassPatientIds: scoped.breakGlassPatientIds,
    scoped,
  };
}

/**
 * A ward over its beds lists each arrival that took it over (`arrivalCapacityConflicts`), and the
 * saved-state check allows one occupant over `beds` per listed arrival. When the desk is not sent
 * an arrival's movement, its entry is cut, so the counts would break that check. The authoritative
 * counts are kept whenever they still fit. Otherwise each cut arrival is taken out of the bucket of
 * its own recorded sex (the bucket its arrival added to), never a guessed one, until they fit. The
 * server still checks every placement against the whole workspace.
 */
function withinArrivalAllowance(
  unit: Unit,
  kept: readonly { movementId: string }[] | undefined,
  sexOfArrival: (movementId: string) => Sex | undefined,
): Unit["sexMix"] {
  let excess = unit.sexMix.Female + unit.sexMix.Male - (unit.beds + (kept?.length ?? 0));
  if (excess <= 0) return unit.sexMix;
  const keptIds = new Set((kept ?? []).map((conflict) => conflict.movementId));
  let mix = unit.sexMix;
  for (const conflict of unit.arrivalCapacityConflicts ?? []) {
    if (excess <= 0) break;
    if (keptIds.has(conflict.movementId)) continue;
    const sex = sexOfArrival(conflict.movementId);
    if (sex === undefined || mix[sex] <= 0) continue;
    mix = adjustSexMix(mix, sex, -1);
    excess -= 1;
  }
  return mix;
}

/**
 * Bug list row 28: a stay whose referral this desk is not sent keeps its person, not a link it
 * cannot follow. The patient resolver rightly treats an unresolved referral link as broken and
 * names nobody, so a ward's own bed read "Name not recorded". The server copy already cuts the
 * link (`closeReferences`); the browser's own scoping now does the same. Only the link goes: the
 * stay's `patientId` still names the person, and a referral missing from the WHOLE workspace is
 * left alone, so a truly broken link still reads as broken.
 */
export function withStayReferralsInView<A extends { referralId: string | null }>(
  admissions: readonly A[],
  shownReferralIds: ReadonlySet<string>,
  allReferralIds: ReadonlySet<string>,
): A[] {
  return admissions.map((admission) =>
    admission.referralId !== null &&
    !shownReferralIds.has(admission.referralId) &&
    allReferralIds.has(admission.referralId)
      ? { ...admission, referralId: null }
      : admission,
  );
}

/** A copy without the optional link fields that point at a record the desk is not sent. */
function withoutLinks<T extends object>(record: T, links: readonly (keyof T)[], present: (id: string) => boolean): T {
  const dangling = links.filter((key) => typeof record[key] === "string" && !present(record[key] as string));
  if (dangling.length === 0) return record;
  const copy = { ...record };
  for (const key of dangling) delete copy[key];
  return copy;
}

/**
 * A scoped workspace still links to records outside it: a stay's referral, a movement's earlier
 * stay, a ward's history of arrivals. Those links name records the desk was not sent, and the
 * browser refuses a workspace whose links dangle, so they are cut here. The desk loses nothing it
 * could have opened.
 */
function closeReferences(
  scoped: WardFlowState,
  datesOnlyAdmissionIds: ReadonlySet<string>,
  whole: WardFlowState,
  includePlannedLegalStatus: boolean,
): WardFlowState {
  const wholeMovements = new Map<string, WardFlowState["movements"][number]>(
    whole.movements.map((movement) => [movement.id, movement]),
  );
  const sexOfArrival = (movementId: string) => {
    const movement = wholeMovements.get(movementId);
    return movement ? mixSexOf(movement.gender, movement.sex) : undefined;
  };
  const ids = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id));
  const movements = ids(scoped.movements);
  const admissions = ids(scoped.admissions);
  const fullAdmissions = new Set(
    scoped.admissions.filter((admission) => !datesOnlyAdmissionIds.has(admission.id)).map((admission) => admission.id),
  );
  const referrals = ids(scoped.referrals);
  const patients = ids(scoped.patients);
  const has = (set: ReadonlySet<string>) => (id: string) => set.has(id);
  return {
    ...scoped,
    units: scoped.units.map((unit) => {
      if (unit.arrivalCapacityConflicts === undefined && unit.reservationReleaseCapacityConflicts === undefined)
        return unit;
      const own = <C extends { movementId: string; admissionId?: string }>(conflicts: readonly C[] | undefined) =>
        conflicts
          ?.filter((conflict) => movements.has(conflict.movementId))
          .map((conflict) => withoutLinks(conflict, ["admissionId"], has(fullAdmissions)));
      const keptArrivalConflicts = own(unit.arrivalCapacityConflicts);
      const sexMix = withinArrivalAllowance(unit, keptArrivalConflicts, sexOfArrival);
      return {
        ...unit,
        sexMix,
        ...(unit.arrivalCapacityConflicts && { arrivalCapacityConflicts: keptArrivalConflicts }),
        ...(unit.reservationReleaseCapacityConflicts && {
          reservationReleaseCapacityConflicts: own(unit.reservationReleaseCapacityConflicts),
        }),
      };
    }),
    movements: scoped.movements.map((movement) =>
      withoutLinks(
        withoutLinks(
          withoutLinks(movement, ["admissionId"], has(fullAdmissions)),
          ["sourceAdmissionId", "referralSourceAdmissionId"],
          has(admissions),
        ),
        ["referralId"],
        has(referrals),
      ),
    ),
    admissions: scoped.admissions.map((admission) => {
      // Older converted bookings predate the admission's retained status. Carry the joined
      // provenance before this projection drops the ward's bookings or movement references.
      // Executive and dates-only views never carry it, even when the admission already does:
      // take it out of the spread and add it back only for a view allowed to see it.
      const { plannedLegalStatus: retained, ...rest } = admission;
      const plannedLegalStatus =
        includePlannedLegalStatus && !datesOnlyAdmissionIds.has(admission.id)
          ? plannedAdmissionLegalStatus(whole, admission)
          : undefined;
      const referralId =
        admission.referralId !== null && !referrals.has(admission.referralId) ? null : admission.referralId;
      const movementId =
        admission.movementId !== null && !movements.has(admission.movementId) ? null : admission.movementId;
      return referralId === admission.referralId &&
        movementId === admission.movementId &&
        plannedLegalStatus === retained &&
        (plannedLegalStatus !== undefined || !Object.hasOwn(admission, "plannedLegalStatus"))
        ? admission
        : { ...rest, referralId, movementId, ...(plannedLegalStatus === undefined ? {} : { plannedLegalStatus }) };
    }),
    plannedAdmissions: scoped.plannedAdmissions.filter(
      (booking) =>
        bookingPersonShown(booking, patients) &&
        (booking.state !== "arrived" ||
          (typeof booking.admissionId === "string" && admissions.has(booking.admissionId))),
    ),
  };
}

/** Existing-record pointers only. Creation/correlation ids and text are not record lookups. */
const COMMAND_RECORD_FIELDS = {
  patientId: "patients",
  movementId: "movements",
  admissionId: "admissions",
  referralId: "referrals",
  plannedAdmissionId: "plannedAdmissions",
  releaseId: "bedReleases",
  leaveBedId: "leaveBeds",
  noticeId: "notices",
  alertId: "broadcastAlerts",
  eventId: "auditEvents",
  reviewId: "auditReviews",
  // Batch 3 items 21 and 23: a hand-over or call back is checked like the stay or request it is on.
  handedItemId: "handedItems",
  callbackId: "carerCallbacks",
} as const;
type CommandRecordCollection = (typeof COMMAND_RECORD_FIELDS)[keyof typeof COMMAND_RECORD_FIELDS] | "invalid";
type CommandRecordReference = { collection: CommandRecordCollection; id: string };

function inboxRecordReference(rowId: string): CommandRecordReference | null {
  rowId = rowId.trim();
  const category = Object.entries(INBOX_CATEGORIES)
    .filter(([, { idPrefix }]) => rowId.startsWith(idPrefix))
    .sort((a, b) => b[1].idPrefix.length - a[1].idPrefix.length)[0];
  if (!category) return { collection: "invalid", id: rowId };
  const [kind, { idPrefix }] = category;
  const id = rowId.slice(idPrefix.length);
  switch (kind) {
    case "daily_check":
      return null;
    case "bed_meeting_action": {
      const action = meetingActionOfInboxId(rowId);
      return action
        ? { collection: action.subject.kind === "movement" ? "movements" : "admissions", id: action.subject.id }
        : { collection: "invalid", id: rowId };
    }
    case "support_notification_discharge":
    case "absent_without_leave":
      return { collection: "admissions", id };
    case "planned_arrival_overdue":
      return { collection: "plannedAdmissions", id };
    case "duplicate_bed_request":
      return { collection: "patients", id };
    case "bed_held_elsewhere":
      return { collection: "referrals", id };
    default:
      return { collection: "movements", id };
  }
}

/** Includes named pointers in nested observation targets, never arbitrary string values or ids. */
function commandRecordReferences(
  value: unknown,
  into: CommandRecordReference[] = [],
  depth = 0,
): CommandRecordReference[] {
  if (depth > 8) return into;
  if (Array.isArray(value)) for (const item of value) commandRecordReferences(item, into, depth + 1);
  else if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && Object.hasOwn(COMMAND_RECORD_FIELDS, key))
        into.push({ collection: COMMAND_RECORD_FIELDS[key as keyof typeof COMMAND_RECORD_FIELDS], id: item });
      else if (key === "inboxItemId" && typeof item === "string") {
        const reference = inboxRecordReference(item);
        if (reference) into.push(reference);
      } else commandRecordReferences(item, into, depth + 1);
    }
  return into;
}

/**
 * Why this desk may not send this command, or `null` when it may. The command may name only
 * records the desk sees in its own right: any patient, movement, stay, referral, booking, bed
 * release, leave bed, notice or alert outside its scope, or seen only through break glass, refuses
 * it. A desk acts only from its own place (`actingUnitId`, `actingPlaceId`, `actingTeamId`, and the
 * referral's origin `originUnitId` and `edId`), and every ward or ED a command aims at (`unitId`,
 * `unitIds`) must be inside it. A service coordinator therefore refers only to wards in its own
 * service; asking wards across services is the statewide coordinator's. A referral's destinations
 * and the team a contact is made with are requests to another place, so they may lie outside it.
 */
export function commandScopeRefusal(
  state: WardFlowState,
  access: WardAccess,
  command: Record<string, unknown>,
  options: StateScopeOptions,
): string | null {
  if (accessIsWholeNetwork(access)) return null;
  // R-STRUCT-1 (D-223): every place rule lives in one table, `PLACE_RULES`, which `permit()` asks too.
  // The rules that answer in their own words come first in the table, and every other refusal here
  // reads `OUTSIDE_PLACE`, so running the table before the record-reference pass gives the same words.
  const placeRefusal = placeRuleRefusal({ state, access, command, places: options.places });
  if (placeRefusal) return placeRefusal.refusal;
  const { state: scopedWithoutGrants } = scopeWardFlowState(state, access, { ...options, grants: undefined });
  const { breakGlassPatientIds } = options.grants?.length
    ? scopeWardFlowState(state, access, options)
    : { breakGlassPatientIds: new Set<string>() };
  const glass = (item: { patientId?: string | null }) => seenThroughBreakGlass(item, breakGlassPatientIds);
  const writableState = {
    ...scopedWithoutGrants,
    patients: scopedWithoutGrants.patients.filter((patient) => !breakGlassPatientIds.has(patient.id)),
    movements: scopedWithoutGrants.movements.filter((movement) => !glass(movement)),
    admissions: scopedWithoutGrants.admissions.filter((admission) => !glass(admission)),
    referrals: scopedWithoutGrants.referrals.filter((referral) => !glass(referral)),
  };
  // A seeded governance entry can be reviewed, and the whole workspace finds one about any record
  // (`governanceAuditEntry`), so every seeded id counts as a record. A coordinator may name only the
  // ones its own screens show.
  const seeded = access.role === "coordinator" ? seededAuditIds(scopedWithoutGrants, state) : new Set<string>();
  const references = commandRecordReferences(command);
  if (
    (command.type === "RECORD_BED_MEETING_ACTION" ||
      command.type === "COMPLETE_BED_MEETING_ACTION" ||
      command.type === "UNDO_BED_MEETING_ACTION") &&
    command.subject &&
    typeof command.subject === "object"
  ) {
    // These are the only command contracts whose generic `id` is an existing-record pointer.
    // Other generic ids may be creation/correlation values and are never looked up globally.
    const subject = command.subject as { kind?: unknown; id?: unknown };
    if (typeof subject.id === "string")
      references.push({
        collection: subject.kind === "movement" ? "movements" : subject.kind === "admission" ? "admissions" : "invalid",
        id: subject.id,
      });
  }
  for (const { collection, id } of references) {
    // Hidden and absent references fail identically. Never consult the whole world's id set:
    // doing so made a scoped refusal distinguish an existing hidden record from a missing one.
    if (collection === "invalid" || !(writableState[collection] ?? []).some((record) => record.id === id)) {
      // D-80 item 14: a coordinator also reviews break glass openings, which the workspace does not
      // hold. The shared server also checks the opening exists and is of a record in the
      // coordinator's own service (`breakGlassReviewRefusal` in backend/ward-flow/postgres.mjs).
      if (
        collection !== "auditEvents" ||
        !(seeded.has(id) || (access.role === "coordinator" && isBreakGlassReviewId(id)))
      )
        return OUTSIDE_PLACE;
    }
  }
  return null;
}
