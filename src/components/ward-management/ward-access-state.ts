import { isPatientRegistrationScope, registrationIsInScope } from "./ward-patient-registration";
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
import {
  BROADCAST_TARGET_SCOPES,
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  broadcastKind,
  pullNowWards,
  type BroadcastTargetScope,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import { directiveDesks, wardsInBroadcastScope } from "./alerts/global-alert-view";
import type { AuditEvent, AuditReview } from "@/components/ward-management/ward-audit";
import { movementSourceAdmission, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { syntheticGovernanceAuditEvents } from "@/components/ward-management/ward-governance-seed";
import { adjustSexMix, mixSexOf } from "@/components/ward-management/ward-eligibility";
import { plannedAdmissionLegalStatus } from "@/components/ward-management/ward-discharge-records";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";
import type { Sex, Unit } from "@/components/ward-management/ward-model";
import {
  bookingPersonShown,
  communityTeamKey,
  countsOnlyBedRelease,
  countsOnlyLeaveBed,
  scopeBroadcastAlerts,
  scopeWorkspace,
  seenThroughBreakGlass,
  withBookedPatients,
  type BreakGlassGrant,
} from "@/components/ward-management/ward-access-scope";
import {
  accessIsWholeNetwork,
  edInScope,
  ROLE_SCREENS,
  unitInScope,
  type PlaceLookup,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";
import { siteByCode } from "./ward-sites";
import { referralSentByDesk } from "./ward-referral-sender";

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
};

const keep =
  <K extends keyof WardFlowState>(key: K) =>
  (context: Context): WardFlowState[K] =>
    context.state[key];

/** An inbox map keeps only the rows about the desk's own movements, stays and bookings. */
const inboxRows =
  <K extends "inboxAcknowledgements" | "inboxCompletions" | "inboxOwnership" | "inboxSnoozes">(key: K) =>
  (context: Context): WardFlowState[K] =>
    context.access.role === "executive"
      ? ({} as WardFlowState[K])
      : (Object.fromEntries(
          Object.entries(context.state[key]).filter(([rowId]) => {
            const category = Object.values(INBOX_CATEGORIES).find(({ idPrefix }) => rowId.startsWith(idPrefix));
            return category !== undefined && context.inboxSubjectIds.has(rowId.slice(category.idPrefix.length));
          }),
        ) as WardFlowState[K]);

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

/** Is this team id or name the community desk's own team. */
function teamIsOwn(access: WardAccess, teamId: string, places: PlaceLookup): boolean {
  const scope = access.scope;
  if (scope.kind !== "team") return false;
  const ownTeam = communityTeamKey(scope.teamName);
  return ownTeam !== "" && (communityTeamKey(teamId) === ownTeam || teamId === places.teamSlug(scope.teamName));
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
 */
export function supportNotificationsForDesk<R extends { occasion: string; subjectId: string }>(
  records: readonly R[] | undefined,
  desk: Pick<Context, "coordinator" | "unitIn"> & {
    readonly wholeNetwork: boolean;
    readonly role: WardAccess["role"];
    readonly movements: readonly { id: string; acceptedUnitId?: string | null }[];
    readonly wholeStay: (admissionId: string) => boolean;
  },
): R[] {
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
  configuration: keep("configuration"),
  // D-72: a ward's seclusion and restraint record goes to the desks that open the Seclusion view and
  // hold the ward, which still see an episode whose patient has left so they can record its end.
  // Other such desks get only their own stays' episodes, and no other ward's room or incidents. A
  // role without the view, such as an access admin or an executive, gets none of it.
  units: (context) => {
    const seesView = ROLE_SCREENS[context.access.role].seclusion !== undefined;
    return context.state.units.map((unit) =>
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
  // Role and time only, no person.
  handoverSignOffs: keep("handoverSignOffs"),
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
      context.coordinator ? context.state.plannedAdmissions.filter((booking) => context.unitIn(booking.unitId)) : [],
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
    return context.state.auditReviews.filter((review: AuditReview) => kept.has(review.eventId));
  },
  // Coordinator records, narrowed to the coordinator's own service.
  rejections: () => [],
  refreshRequests: (context) =>
    context.coordinator ? context.state.refreshRequests.filter((request) => context.unitIn(request.unitId)) : [],
  repatriations: (context) =>
    context.coordinator
      ? context.state.repatriations.filter((record) => context.admissionIds.has(record.admissionId))
      : [],
  plannedAdmissions: (context) =>
    context.coordinator ? context.state.plannedAdmissions.filter((booking) => context.unitIn(booking.unitId)) : [],
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
    ...(coordinator ? state.plannedAdmissions.filter((booking) => unitIn(booking.unitId)).map((b) => b.id) : []),
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
  };
  const auditEvents = state.auditEvents.filter(
    (event) =>
      access.role !== "executive" &&
      (coordinator
        ? auditSubjectInScope(event, { ...partial, auditEvents: [] })
        : event.category === "record-access" &&
          event.subject.kind === "admission" &&
          admissionIds.has(event.subject.admissionId)),
  );
  const context: Context = { ...partial, auditEvents };
  const next = {} as Record<keyof WardFlowState, unknown>;
  for (const key of Object.keys(FIELD_RULES) as (keyof WardFlowState)[]) next[key] = FIELD_RULES[key](context);
  // An optional field the saved state never had stays absent, as the stored-state check expects.
  if (state.supportNotifications === undefined) delete next.supportNotifications;
  if (state.undoRecords === undefined) delete next.undoRecords;
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
          ["sourceAdmissionId"],
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

/** Every record id a command could name, by the list it lives in, audit entries and reviews included. */
function recordIds(state: WardFlowState): Set<string> {
  return new Set<string>([
    ...state.patients.map((patient) => patient.id),
    ...state.movements.map((movement) => movement.id),
    ...state.admissions.map((admission) => admission.id),
    ...state.referrals.map((referral) => referral.id),
    ...state.plannedAdmissions.map((booking) => booking.id),
    ...state.bedReleases.map((release) => release.id),
    ...state.leaveBeds.map((bed) => bed.id),
    ...state.notices.map((notice) => notice.id),
    ...state.broadcastAlerts.map((alert) => alert.id),
    ...state.auditEvents.map((event) => event.id),
    ...state.auditReviews.map((review) => review.id),
  ]);
}

/** Every string inside a command, however deep. */
function commandStrings(value: unknown, into: string[] = [], depth = 0): string[] {
  if (depth > 8) return into;
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) for (const item of value) commandStrings(item, into, depth + 1);
  else if (value && typeof value === "object")
    for (const item of Object.values(value as Record<string, unknown>)) commandStrings(item, into, depth + 1);
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
  const outside = "This change names a record outside your role's place.";
  const { places } = options;
  // Configuration is one workspace-wide object, even when no command field names a place.
  if (command.type === "SET_CONFIGURATION") return "Only the statewide coordinator may change global settings.";
  const scope = access.scope;
  const placeIn = (id: string) => unitInScope(scope, id, places) || edInScope(scope, id, places);
  // Resolve the recipients from the whole workspace before projecting it for the caller. Seeing
  // one part of an alert permits a local answer, not extending or ending it for every recipient.
  if (command.type === "DISPATCH_BROADCAST_ALERT") {
    const targetScope = command.targetScope as BroadcastTargetScope;
    if (!BROADCAST_TARGET_SCOPES.includes(targetScope)) return outside;
    const recipients =
      command.kind === "bed_call"
        ? wardsInBroadcastScope(state.units, targetScope)
        : directiveDesks({ targetScope } as Parameters<typeof directiveDesks>[0], state.units);
    if (recipients.some((id) => !placeIn(id))) return outside;
  }
  if (command.type === "STAND_DOWN_BROADCAST_ALERT" || command.type === "EXTEND_BROADCAST_ALERT") {
    const alert = state.broadcastAlerts.find((candidate) => candidate.id === command.alertId);
    if (alert) {
      const recipients =
        broadcastKind(alert) === "directive"
          ? directiveDesks(alert, state.units)
          : (alert.targetUnitIds ?? wardsInBroadcastScope(state.units, alert.targetScope));
      if (recipients.some((id) => !placeIn(id))) return outside;
    }
  }
  if (command.type === "RAISE_PULL_NOW") {
    const movement = state.movements.find((candidate) => candidate.id === command.movementId);
    if (
      movement &&
      pullNowWards(movement, (id) => state.units.some((unit) => unit.id === id)).some((id) => !placeIn(id))
    )
      return outside;
  }
  // Origin and sender identity come from membership plus the stored record, never the presence
  // of an optional acting-place claim in a client command.
  if (
    command.type === "RECEIVE_REFERRAL" &&
    (access.role === "ed" || (access.role === "coordinator" && command.source === "ed_medical"))
  ) {
    const origin =
      typeof command.originSiteCode === "string"
        ? siteByCode(command.originSiteCode)?.emergencyDepartment?.id
        : undefined;
    if (!origin || !edInScope(scope, origin, places)) return outside;
  }
  // The sender's own tools, for the desk that sent the referral only: a ward's or team's scope also
  // takes in referrals sent to it (role access plan v2, D-80).
  if (
    command.type === "ADD_REFERRAL_CORRECTION" ||
    command.type === "RECORD_REFERRER_WITHDRAWAL" ||
    command.type === "MARK_REFERRAL_INFORMATION_MET"
  ) {
    const referral = state.referrals.find((candidate) => candidate.id === command.referralId);
    if (referral && !referralSentByDesk(referral, access, places)) return outside;
  }
  if (command.type === "RECORD_TRANSPORT_NEED") {
    const movement = state.movements.find((candidate) => candidate.id === command.movementId);
    if (movement && access.role === "ward") {
      const referral = state.referrals.find((candidate) => candidate.id === movement.referralId);
      const sendingWard =
        referral?.originUnitId ??
        movementSourceAdmission(state, movement)?.unitId ??
        (movement as { originUnitId?: string }).originUnitId;
      if (!sendingWard || !unitInScope(scope, sendingWard, places)) return outside;
    }
    if (movement && access.role === "ed" && !edInScope(scope, movement.originEdId, places)) return outside;
    if (movement && access.role === "community") {
      const referral = state.referrals.find((candidate) => candidate.id === movement.referralId);
      if (
        referral?.source !== "community" ||
        referral.sendingTeamName === undefined ||
        !teamIsOwn(access, referral.sendingTeamName, places)
      )
        return outside;
    }
  }
  // A ward or team changes a journey's urgency, legal status or form receipt only on a journey it
  // sent: the person's journey to it is the receiving ward's to answer, not to amend (D-80).
  if (
    (access.role === "ward" || access.role === "community") &&
    (command.type === "CHANGE_URGENCY" ||
      command.type === "CHANGE_LEGAL_STATUS" ||
      command.type === "RECORD_LEGAL_FORM_RECEIVED" ||
      command.type === "CORRECT_LEGAL_FORM_RECEIPT")
  ) {
    const movement = state.movements.find((candidate) => candidate.id === command.movementId);
    if (movement) {
      const referral = state.referrals.find((candidate) => candidate.id === movement.referralId);
      const sendingWard =
        referral?.originUnitId ??
        movementSourceAdmission(state, movement)?.unitId ??
        (movement as { originUnitId?: string }).originUnitId;
      const sent =
        access.role === "ward"
          ? sendingWard !== undefined && unitInScope(scope, sendingWard, places)
          : referral !== undefined && referralSentByDesk(referral, access, places);
      if (!sent) return outside;
    }
  }
  // Every desk names its own place when it adds a patient, so the record it adds stays in its own
  // view (review on PR #606). Only a whole-network desk, returned above, adds one with no place.
  if (
    command.type === "ADD_PATIENT" &&
    (command.registrationScope === undefined ||
      !isPatientRegistrationScope(command.registrationScope, state.units) ||
      !registrationIsInScope(command.registrationScope, access, places))
  )
    return outside;
  const { state: scopedWithoutGrants } = scopeWardFlowState(state, access, { ...options, grants: undefined });
  const { breakGlassPatientIds } = options.grants?.length
    ? scopeWardFlowState(state, access, options)
    : { breakGlassPatientIds: new Set<string>() };
  const glass = (item: { patientId?: string | null }) => seenThroughBreakGlass(item, breakGlassPatientIds);
  const writable = recordIds({
    ...scopedWithoutGrants,
    patients: scopedWithoutGrants.patients.filter((patient) => !breakGlassPatientIds.has(patient.id)),
    movements: scopedWithoutGrants.movements.filter((movement) => !glass(movement)),
    admissions: scopedWithoutGrants.admissions.filter((admission) => !glass(admission)),
    referrals: scopedWithoutGrants.referrals.filter((referral) => !glass(referral)),
  });
  const all = recordIds(state);
  // A seeded governance entry can be reviewed, and the whole workspace finds one about any record
  // (`governanceAuditEntry`), so every seeded id counts as a record. A coordinator may name only the
  // ones its own screens show.
  if (access.role === "coordinator") for (const id of seededAuditIds(scopedWithoutGrants, state)) writable.add(id);
  if (
    (access.role === "ward" || access.role === "coordinator") &&
    (command.type === "RECORD_SUPPORT_NOTIFICATION" || command.type === "UNDO_SUPPORT_NOTIFICATION") &&
    typeof command.movementId === "string"
  ) {
    const movement = state.movements.find((candidate) => candidate.id === command.movementId);
    if (
      movement &&
      (typeof movement.acceptedUnitId === "string"
        ? !unitInScope(access.scope, movement.acceptedUnitId, places)
        : !accessIsWholeNetwork(access))
    )
      return outside;
  }
  for (const text of commandStrings(command)) {
    if ((all.has(text) || text.startsWith("audit-seed-")) && !writable.has(text)) return outside;
    const category = Object.values(INBOX_CATEGORIES).find(({ idPrefix }) => text.startsWith(idPrefix));
    const subject = category ? text.slice(category.idPrefix.length) : undefined;
    if (subject !== undefined && all.has(subject) && !writable.has(subject)) return outside;
  }
  // Where a desk acts from: its ward, ED or team, or the coordinator desk itself.
  const actsFrom = (id: string) =>
    placeIn(id) || teamIsOwn(access, id, places) || (access.role === "coordinator" && id === "coordinator");
  if (typeof command.actingUnitId === "string" && !unitInScope(scope, command.actingUnitId, places)) return outside;
  if (typeof command.originUnitId === "string" && !unitInScope(scope, command.originUnitId, places)) return outside;
  const targets = [command.unitId, command.acceptedUnitId, ...(Array.isArray(command.unitIds) ? command.unitIds : [])];
  for (const target of targets)
    if (
      typeof target === "string" &&
      !placeIn(target) &&
      !(access.role === "coordinator" && target === COORDINATOR_DESK_ACKNOWLEDGER_ID)
    )
      return outside;
  // The named ED is always in scope, including on an accepted referral's continuation: the
  // accepting ward does not get past the ED check because it accepted (owner, 19 Oct 2026).
  for (const from of [command.actingPlaceId, command.edId])
    if (typeof from === "string" && !actsFrom(from)) return outside;
  if (typeof command.actingTeamId === "string" && !teamIsOwn(access, command.actingTeamId, places)) return outside;
  return null;
}
