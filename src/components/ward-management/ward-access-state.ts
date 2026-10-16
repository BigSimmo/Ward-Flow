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
import { COORDINATOR_DESK_ACKNOWLEDGER_ID } from "@/components/ward-management/alerts/ward-broadcast-model";
import type { AuditEvent, AuditReview } from "@/components/ward-management/ward-audit";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { syntheticGovernanceAuditEvents } from "@/components/ward-management/ward-governance-seed";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";
import {
  bookingPersonShown,
  scopeBroadcastAlerts,
  scopeWorkspace,
  seenThroughBreakGlass,
  withBookedPatients,
  type BreakGlassGrant,
} from "@/components/ward-management/ward-access-scope";
import {
  accessIsWholeNetwork,
  edInScope,
  unitInScope,
  type PlaceLookup,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";

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
    Object.fromEntries(
      Object.entries(context.state[key]).filter(([rowId]) => {
        const category = Object.values(INBOX_CATEGORIES).find(({ idPrefix }) => rowId.startsWith(idPrefix));
        return category !== undefined && context.inboxSubjectIds.has(rowId.slice(category.idPrefix.length));
      }),
    ) as WardFlowState[K];

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
 * and may be made, exactly when the desk's screens show its entry. The ids are fixed, so every desk
 * that shows an entry shares its reviews.
 */
function seededAuditIds(sent: Pick<WardFlowState, "movements" | "referrals" | "admissions">, state: WardFlowState) {
  return new Set(syntheticGovernanceAuditEvents({ ...state, ...sent }).map((event) => event.id));
}

/** Is this team id or name the community desk's own team. */
function teamIsOwn(access: WardAccess, teamId: string, places: PlaceLookup): boolean {
  const scope = access.scope;
  return scope.kind === "team" && (teamId === scope.teamName || teamId === places.teamSlug(scope.teamName));
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
  units: keep("units"),
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
  bedReleases: (context) => context.state.bedReleases.filter((release) => wholeStay(context, release.admissionId)),
  leaveBeds: (context) => context.state.leaveBeds.filter((bed) => wholeStay(context, bed.admissionId)),
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
    context.coordinator
      ? (context.state.supportNotifications ?? []).filter((record) => context.inboxSubjectIds.has(record.subjectId))
      : [],
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
): { state: WardFlowState; breakGlassPatientIds: ReadonlySet<string> } {
  if (accessIsWholeNetwork(access)) return { state, breakGlassPatientIds: new Set() };
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
  const auditEvents = state.auditEvents.filter((event) =>
    coordinator
      ? auditSubjectInScope(event, { ...partial, auditEvents: [] })
      : event.category === "record-access" &&
        event.subject.kind === "admission" &&
        admissionIds.has(event.subject.admissionId),
  );
  const context: Context = { ...partial, auditEvents };
  const next = {} as Record<keyof WardFlowState, unknown>;
  for (const key of Object.keys(FIELD_RULES) as (keyof WardFlowState)[]) next[key] = FIELD_RULES[key](context);
  // An optional field the saved state never had stays absent, as the stored-state check expects.
  if (state.supportNotifications === undefined) delete next.supportNotifications;
  if (state.undoRecords === undefined) delete next.undoRecords;
  return { state: closeReferences(next as WardFlowState), breakGlassPatientIds: scoped.breakGlassPatientIds };
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
function closeReferences(scoped: WardFlowState): WardFlowState {
  const ids = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id));
  const movements = ids(scoped.movements);
  const admissions = ids(scoped.admissions);
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
          .map((conflict) => withoutLinks(conflict, ["admissionId"], has(admissions)));
      return {
        ...unit,
        ...(unit.arrivalCapacityConflicts && { arrivalCapacityConflicts: own(unit.arrivalCapacityConflicts) }),
        ...(unit.reservationReleaseCapacityConflicts && {
          reservationReleaseCapacityConflicts: own(unit.reservationReleaseCapacityConflicts),
        }),
      };
    }),
    movements: scoped.movements.map((movement) =>
      withoutLinks(
        withoutLinks(movement, ["admissionId", "sourceAdmissionId"], has(admissions)),
        ["referralId"],
        has(referrals),
      ),
    ),
    admissions: scoped.admissions.map((admission) => {
      const referralId =
        admission.referralId !== null && !referrals.has(admission.referralId) ? null : admission.referralId;
      const movementId =
        admission.movementId !== null && !movements.has(admission.movementId) ? null : admission.movementId;
      return referralId === admission.referralId && movementId === admission.movementId
        ? admission
        : { ...admission, referralId, movementId };
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
  const { state: scoped, breakGlassPatientIds } = scopeWardFlowState(state, access, options);
  const glass = (item: { patientId?: string | null }) => seenThroughBreakGlass(item, breakGlassPatientIds);
  const writable = recordIds({
    ...scoped,
    patients: scoped.patients.filter((patient) => !breakGlassPatientIds.has(patient.id)),
    movements: scoped.movements.filter((movement) => !glass(movement)),
    admissions: scoped.admissions.filter((admission) => !glass(admission)),
    referrals: scoped.referrals.filter((referral) => !glass(referral)),
  });
  const all = recordIds(state);
  // A seeded governance entry can be reviewed, so its id counts as a record too. A coordinator may
  // name only the ones its own screens show.
  for (const event of syntheticGovernanceAuditEvents(state)) all.add(event.id);
  if (access.role === "coordinator") for (const id of seededAuditIds(scoped, state)) writable.add(id);
  for (const text of commandStrings(command)) {
    if (all.has(text) && !writable.has(text)) return outside;
    const category = Object.values(INBOX_CATEGORIES).find(({ idPrefix }) => text.startsWith(idPrefix));
    const subject = category ? text.slice(category.idPrefix.length) : undefined;
    if (subject !== undefined && all.has(subject) && !writable.has(subject)) return outside;
  }
  const scope = access.scope;
  const placeIn = (id: string) => unitInScope(scope, id, places) || edInScope(scope, id, places);
  // Where a desk acts from: its ward, ED or team, or the coordinator desk itself.
  const actsFrom = (id: string) =>
    placeIn(id) || teamIsOwn(access, id, places) || (access.role === "coordinator" && id === "coordinator");
  if (typeof command.actingUnitId === "string" && !unitInScope(scope, command.actingUnitId, places)) return outside;
  if (typeof command.originUnitId === "string" && !unitInScope(scope, command.originUnitId, places)) return outside;
  const targets = [command.unitId, ...(Array.isArray(command.unitIds) ? command.unitIds : [])];
  for (const target of targets)
    if (
      typeof target === "string" &&
      !placeIn(target) &&
      !(access.role === "coordinator" && target === COORDINATOR_DESK_ACKNOWLEDGER_ID)
    )
      return outside;
  for (const from of [command.actingPlaceId, command.edId])
    if (typeof from === "string" && !actsFrom(from)) return outside;
  if (typeof command.actingTeamId === "string" && !teamIsOwn(access, command.actingTeamId, places)) return outside;
  return null;
}
