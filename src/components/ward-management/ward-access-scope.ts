/**
 * **THE SCOPED WORKSPACE — what one role at one place is given to look at (role access plan,
 * sections 4, 5, 7 and 15, Josh's go 15 Oct 2026).**
 *
 * Every screen and every piece of shell chrome reads the workspace through this function once the
 * `role-access` flag is on, so a role's screens are never handed records outside its care. Hiding a
 * screen is courtesy. Not handing over the data is the control.
 *
 * Rules, in order:
 * - A statewide coordinator gets everything, unchanged (same references, no cost).
 * - Every other role starts from nothing and is given only what its scope reaches.
 * - Unresolvable records (no place this module can name) go to coordinators only. That is the
 *   opposite of the service filter's display rule (`ward-service-scope.ts` shows them to every
 *   service) on purpose: a display filter should show more, an access rule should give less.
 * - A referral is trimmed to the role's own destination line, so a ward never learns where else
 *   the person was sent (FD-23).
 * - Hand-off windows keep a sender's view of the outcome for a set time, from the clinical values
 *   module.
 * - Break glass grants add one patient's own records, read only.
 *
 * Pure and browser free: the backend applies the same function to every reply (plan PR 2).
 */
import { directiveDesks } from "@/components/ward-management/alerts/global-alert-view";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { AuditSubject } from "@/components/ward-management/ward-audit";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
import { STAGE_TRANSITION_BLOCKERS } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Notice, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import {
  edInScope,
  unitInScope,
  type PlaceLookup,
  type WardAccess,
  accessIsWholeNetwork,
} from "@/components/ward-management/ward-role-access";

const NO_GRANTS: ReadonlySet<string> = new Set<string>();
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** The parts of the workspace that hold people. Everything else (units, configuration) is place
 *  information every role may read. */
export type ScopableWorkspace = {
  readonly movements: readonly Movement[];
  readonly referrals: readonly Referral[];
  readonly patients: readonly Patient[];
  readonly admissions: readonly Admission[];
  readonly notices: readonly Notice[];
  readonly units: readonly Unit[];
};

/** A break glass grant: one patient, read only, until a time. */
export type BreakGlassGrant = {
  readonly patientId: string;
  readonly until: Instant;
};

export type ScopeOptions = {
  readonly now: Instant;
  readonly places: PlaceLookup;
  readonly grants?: readonly BreakGlassGrant[];
};

/** What the scoped workspace adds about itself, for the screens and the tests. */
export type ScopedWorkspace<T extends ScopableWorkspace> = T & {
  /** Patients visible only through break glass, so a screen can label them read only. */
  readonly breakGlassPatientIds: ReadonlySet<string>;
  /** Stays sent as ward and dates only, so nothing hung off them (leave, a release) goes too. */
  readonly datesOnlyAdmissionIds: ReadonlySet<string>;
};

function activeGrantIds(grants: readonly BreakGlassGrant[] | undefined, now: Instant): Set<string> {
  return new Set((grants ?? []).filter((grant) => grant.until > now).map((grant) => grant.patientId));
}

/** The units a movement touches: where it was accepted and every ward it was sent to. */
function movementUnitIds(movement: Movement): string[] {
  return movement.acceptedUnitId
    ? [movement.acceptedUnitId, ...movement.referredUnitIds]
    : [...movement.referredUnitIds];
}

/**
 * Only the desk's own wards in a movement's list of wards asked, so a ward never learns which other
 * wards the person was sent to (review on PR #330). The accepted ward stays: it is where the person
 * is going, and the stage reads from it.
 */
function ownReferredUnits(movement: Movement, unitIn: (unitId: string) => boolean): Movement {
  const own = movement.referredUnitIds.filter(unitIn);
  return own.length === movement.referredUnitIds.length ? movement : { ...movement, referredUnitIds: own };
}

/** Has this movement finished, and when. `undefined` while it is still open. */
function movementEndedAt(movement: Movement): Instant | undefined {
  return movement.closure?.at;
}

type Addressing = Referral["destinations"][number];

function referralDestinationUnitIds(
  referral: Referral,
  keepLine: (addressing: Addressing) => boolean = () => true,
): string[] {
  return referral.destinations.flatMap((addressing) => {
    if (!keepLine(addressing)) return [];
    const destination = addressing.destination;
    const ids: string[] = [];
    if (destination.kind === "psychiatric_ward" && destination.unitId) ids.push(destination.unitId);
    if (addressing.acceptedUnitId) ids.push(addressing.acceptedUnitId);
    return ids;
  });
}

/** Keep only the destination lines a predicate allows. A referral left with none is not this role's. */
function trimReferral(
  referral: Referral,
  keep: (addressing: Referral["destinations"][number]) => boolean,
): Referral | undefined {
  const destinations = referral.destinations.filter(keep);
  if (destinations.length === 0) return undefined;
  return destinations.length === referral.destinations.length ? referral : { ...referral, destinations };
}

/**
 * Is a destination line still the desk's business: open, or decided inside the hand-off window. A
 * line decided longer ago no longer brings its person to the desk (review on PR #330), the same
 * window that ends a finished movement.
 */
function lineIsCurrent(referral: Referral, addressing: Addressing, now: Instant, window: number): boolean {
  return addressing.state === "queued" || now - (addressing.decidedAt ?? referral.raisedAt) <= window;
}

/** A movement without the working diagnosis, for roles that never need it (review on PR #330). */
function withoutDiagnosis(movement: Movement): Movement {
  if (movement.tentativeDiagnosis === undefined) return movement;
  const rest: Movement = { ...movement };
  delete rest.tentativeDiagnosis;
  return rest;
}

const ENGINE_BLOCKERS: ReadonlySet<string> = new Set(Object.values(STAGE_TRANSITION_BLOCKERS));

/** What a collection reads beyond the always present fields, copied only when recorded. */
const COLLECTION_FIELDS = [
  "patientId",
  "referralId",
  "transportNeed",
  "gender",
  "legalForm",
  "acceptedUnitId",
  "acceptedAt",
  "heldBedNumber",
  "allocatedBed",
  "transport",
  "closure",
  "admissionId",
  "examination",
  "pullExpiresAt",
  "plannedMoveAt",
  "arrivalMode",
  "arrivalDetails",
  "arrivalException",
  "medicalClearance",
  "uploadedForms",
] as const satisfies readonly (keyof Movement)[];

/**
 * An open transport job with only what a collection needs (role access plan, Josh's yes 15 Oct
 * 2026): who, from where, to which ward, legal status, safety and the job itself. Built field by
 * field, never spread, so no diagnosis, decline, referral answer, override, owner or change history
 * reaches the officer. The required histories it never reads are empty, and only cancelled
 * transports are kept from the unwind trail.
 */
function collectionMovement(movement: Movement): Movement {
  const trimmed: Record<string, unknown> = {
    id: movement.id,
    originEdId: movement.originEdId,
    openedAt: movement.openedAt,
    flaggedUrgent: movement.flaggedUrgent,
    urgency: movement.urgency,
    cohort: movement.cohort,
    security: movement.security,
    sex: movement.sex,
    specialling: movement.specialling,
    highAcuity: movement.highAcuity,
    legalStatus: movement.legalStatus,
    stage: movement.stage,
    owner: "",
    referredUnitIds: [],
    declines: [],
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    withdrawnReferrals: [],
    stageChanges: [],
    unwinds: movement.unwinds.filter((unwind) => unwind.kind === "transport_cancelled"),
    // The officer reads the blocker only to spot the engine's own sentences. A person's typed
    // blocker note is not a collection field (review on PR #345).
    blocker: ENGINE_BLOCKERS.has(movement.blocker) ? movement.blocker : "",
  };
  for (const field of COLLECTION_FIELDS) if (movement[field] !== undefined) trimmed[field] = movement[field];
  return trimmed as Movement;
}

/** A referral with only what a count needs: no typed history, corrections, diagnosis or intake. */
function countsOnlyReferral(referral: Referral): Referral {
  const rest: Referral = { ...referral, history: "" };
  delete rest.intake;
  delete rest.corrections;
  delete rest.tentativeDiagnosis;
  return rest;
}

/**
 * One key for a community team's spellings, so a desk named "Midland" finds patients whose
 * catchment team is "Midland Community Team" (review on PR #330). An empty name matches nothing.
 */
export function communityTeamKey(name: string | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/ community team$/u, "");
}

/** A patient with only what a transport officer needs: who to collect and how to keep them safe. */
function officerPatient(patient: Patient): Patient {
  return {
    id: patient.id,
    umrn: "",
    givenName: patient.givenName,
    familyName: patient.familyName,
    dateOfBirth: patient.dateOfBirth,
    ...(patient.preferredName === undefined ? {} : { preferredName: patient.preferredName }),
    ...(patient.gender === undefined ? {} : { gender: patient.gender }),
    ...(patient.sex === undefined ? {} : { sex: patient.sex }),
    ...(patient.interpreterLanguage === undefined ? {} : { interpreterLanguage: patient.interpreterLanguage }),
    ...(patient.legalStatus === undefined ? {} : { legalStatus: patient.legalStatus }),
  } as Patient;
}

/** A patient with no identity at all, for counts. */
function anonymousPatient(patient: Patient): Patient {
  return {
    id: patient.id,
    umrn: "",
    givenName: "Hidden",
    familyName: "",
    // Year only: a full birth date can identify someone even without a name (review on PR #330).
    dateOfBirth: `${patient.dateOfBirth.slice(0, 4)}-01-01`,
    ...(patient.sex === undefined ? {} : { sex: patient.sex }),
    ...(patient.gender === undefined ? {} : { gender: patient.gender }),
    ...(patient.legalStatus === undefined ? {} : { legalStatus: patient.legalStatus }),
  } as Patient;
}

/**
 * An admission with ward and dates only, for a community team watching its catchment client. Built
 * field by field, never spread, so nothing clinical (diagnosis, care journey, blockers, absence,
 * follow-up detail, the referral and movement joins) reaches the team (review on PR #330).
 */
function datesOnlyAdmission(admission: Admission): Admission {
  return {
    id: admission.id,
    unitId: admission.unitId,
    patientId: admission.patientId,
    sex: admission.sex,
    state: admission.state,
    pulledAt: admission.pulledAt,
    arrivedAt: admission.arrivedAt,
    expectedDischargeAt: admission.expectedDischargeAt,
    dischargeConfirmedAt: admission.dischargeConfirmedAt,
    leftAt: admission.leftAt,
    leavingDestination: admission.leavingDestination,
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: null,
    homeRegion: null,
    tentativeDiagnosis: null,
    awayAtEmergencyDepartmentSince: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    followUp: null,
  };
}

function noticeInScope(notice: Notice, access: WardAccess, places: PlaceLookup): boolean {
  if (notice.to.role !== access.role) return false;
  const placeId = notice.to.placeId;
  if (placeId === undefined) return access.scope.kind === "statewide" || access.scope.kind === "jobs";
  const scope = access.scope;
  switch (scope.kind) {
    case "statewide":
      return true;
    case "service":
      return places.unitService(placeId) === scope.service || places.edService(placeId) === scope.service;
    case "ward":
      return scope.unitIds.includes(placeId);
    case "ed":
      return scope.edId === placeId;
    case "team":
      return placeId === scope.teamName || placeId === places.teamSlug(scope.teamName);
    case "site":
      return places.unitSiteCode(placeId) === scope.siteCode || places.edSiteCode(placeId) === scope.siteCode;
    case "jobs":
      return true;
  }
}

/**
 * The workspace one role at one place may see. Returns the input itself, untouched, for a
 * statewide coordinator, so the whole view costs nothing.
 */
export function scopeWorkspace<T extends ScopableWorkspace>(
  workspace: T,
  access: WardAccess,
  options: ScopeOptions,
): ScopedWorkspace<T> {
  const { now, places } = options;
  const grantIds = activeGrantIds(options.grants, now);
  if (accessIsWholeNetwork(access))
    return { ...workspace, breakGlassPatientIds: NO_GRANTS, datesOnlyAdmissionIds: NO_GRANTS };

  const scope = access.scope;
  const unitIn = (unitId: string) => unitInScope(scope, unitId, places);
  const edIn = (edId: string) => edInScope(scope, edId, places);
  const edWindow = CLINICAL_VALUES.edHandoffWindow.value * MINUTES_PER_HOUR;
  const wardWindow = CLINICAL_VALUES.wardHandoffWindow.value * MINUTES_PER_DAY;

  let movements: Movement[] = [];
  let referrals: Referral[] = [];
  let admissions: Admission[] = [];
  const datesOnlyAdmissionIds = new Set<string>();
  let anonymise = false;
  let officer = false;

  switch (access.role) {
    case "coordinator":
    case "executive": {
      // A service coordinator or executive: everything that touches the service. An item with no
      // resolvable place is the coordinator's only when statewide, which was handled above.
      movements = workspace.movements.filter(
        (movement) => edIn(movement.originEdId) || movementUnitIds(movement).some(unitIn),
      );
      admissions = workspace.admissions.filter((admission) => unitIn(admission.unitId));
      referrals = workspace.referrals.filter(
        (referral) =>
          referral.destinations.some(
            (addressing) => addressing.destination.kind === "emergency_department" && edIn(addressing.destination.edId),
          ) || referralDestinationUnitIds(referral).some(unitIn),
      );
      if (access.role === "executive") {
        // Statewide executives count the whole network; names never reach them.
        if (scope.kind === "statewide") {
          movements = [...workspace.movements];
          admissions = [...workspace.admissions];
          referrals = [...workspace.referrals];
        }
        anonymise = true;
        // Counts only: no typed narrative or working diagnosis reaches an executive (review on PR #330).
        referrals = referrals.map(countsOnlyReferral);
        movements = movements.map(withoutDiagnosis);
        admissions = admissions.map((admission) =>
          admission.tentativeDiagnosis === null ? admission : { ...admission, tentativeDiagnosis: null },
        );
      }
      break;
    }
    case "bed_manager": {
      movements = workspace.movements
        .filter((movement) => edIn(movement.originEdId) || movementUnitIds(movement).some(unitIn))
        .map((movement) => ownReferredUnits(movement, unitIn));
      admissions = workspace.admissions.filter((admission) => unitIn(admission.unitId));
      const referralIds = new Set(movements.map((movement) => movement.referralId).filter(Boolean));
      referrals = workspace.referrals.flatMap((referral) => {
        const linked = referralIds.has(referral.id) || referralDestinationUnitIds(referral).some(unitIn);
        if (!linked) return [];
        // Own site's lines only (plan section 5).
        const trimmed = trimReferral(
          referral,
          (addressing) =>
            (addressing.destination.kind === "psychiatric_ward" &&
              (addressing.destination.unitId === undefined || unitIn(addressing.destination.unitId))) ||
            (addressing.destination.kind === "emergency_department" && edIn(addressing.destination.edId)),
        );
        return trimmed ? [trimmed] : [];
      });
      break;
    }
    case "ward": {
      movements = workspace.movements.filter((movement) => {
        if (!movementUnitIds(movement).some(unitIn)) return false;
        const ended = movementEndedAt(movement);
        return ended === undefined || now - ended <= wardWindow;
      });
      movements = movements.map((movement) => ownReferredUnits(movement, unitIn));
      admissions = workspace.admissions.filter(
        (admission) => unitIn(admission.unitId) && (admission.leftAt === null || now - admission.leftAt <= wardWindow),
      );
      const referralIds = new Set(
        [
          ...movements.map((movement) => movement.referralId),
          ...admissions.map((admission) => admission.referralId),
        ].filter((id): id is string => typeof id === "string"),
      );
      referrals = workspace.referrals.flatMap((referral) => {
        const current = (addressing: Addressing) => lineIsCurrent(referral, addressing, now, wardWindow);
        if (!referralIds.has(referral.id) && !referralDestinationUnitIds(referral, current).some(unitIn)) return [];
        // Only this ward's own lines: a parallel referral never tells it which other wards were asked
        // or what they said (review on PR #330). A line naming no ward yet stays, as it is open to all.
        const trimmed = trimReferral(
          referral,
          (addressing) =>
            addressing.destination.kind === "psychiatric_ward" &&
            (addressing.acceptedUnitId !== undefined
              ? unitIn(addressing.acceptedUnitId)
              : addressing.destination.unitId === undefined || unitIn(addressing.destination.unitId)),
        );
        return trimmed ? [trimmed] : [];
      });
      break;
    }
    case "ed": {
      movements = workspace.movements.filter((movement) => {
        if (!edIn(movement.originEdId)) return false;
        const ended = movementEndedAt(movement);
        return ended === undefined || now - ended <= edWindow;
      });
      const referralIds = new Set(movements.map((movement) => movement.referralId).filter(Boolean));
      // An ED sees its own referrals whole: it sent them, so it knows where they went.
      referrals = workspace.referrals.filter(
        (referral) =>
          referralIds.has(referral.id) ||
          referral.destinations.some(
            (addressing) =>
              addressing.destination.kind === "emergency_department" &&
              edIn(addressing.destination.edId) &&
              lineIsCurrent(referral, addressing, now, edWindow),
          ),
      );
      break;
    }
    case "community": {
      const teamKey = communityTeamKey(scope.kind === "team" ? scope.teamName : undefined);
      const ownTeam = (name: string | undefined) => teamKey !== "" && communityTeamKey(name) === teamKey;
      referrals = workspace.referrals.flatMap((referral) => {
        const trimmed = trimReferral(
          referral,
          (addressing) => addressing.destination.kind === "community_team" && ownTeam(addressing.destination.teamName),
        );
        return trimmed ? [trimmed] : [];
      });
      const referralIds = new Set(referrals.map((referral) => referral.id));
      movements = workspace.movements.filter(
        (movement) => movement.referralId !== undefined && referralIds.has(movement.referralId),
      );
      // Own team's stays in full, and catchment clients' stays as ward and dates only (round 3,
      // decision 2) so the team can make the 7 day follow up.
      const catchment = new Set(
        workspace.patients.filter((patient) => ownTeam(patient.catchmentCommunityTeam)).map((patient) => patient.id),
      );
      admissions = workspace.admissions.flatMap((admission) => {
        if (admission.referralId !== null && referralIds.has(admission.referralId)) return [admission];
        if (admission.patientId !== null && catchment.has(admission.patientId)) {
          datesOnlyAdmissionIds.add(admission.id);
          return [datesOnlyAdmission(admission)];
        }
        return [];
      });
      break;
    }
    case "officer": {
      movements = workspace.movements.filter(
        (movement) =>
          movement.transport !== undefined &&
          movement.transport.arrivedAt === undefined &&
          movement.closure === undefined,
      );
      // A collection needs who, where, legal status and safety, never the working diagnosis
      // (review on PR #330) or the rest of the journey's record (Josh's yes, 15 Oct 2026).
      movements = movements.map(collectionMovement);
      officer = true;
      break;
    }
    case "admin":
      break;
  }

  // Patients the desk sees in its own right, before any grant.
  const ownPatientIds = new Set<string>();
  for (const item of [...movements, ...admissions, ...referrals]) if (item.patientId) ownPatientIds.add(item.patientId);

  // Break glass: one patient's own records, read only, for the granted time.
  if (grantIds.size > 0) {
    const have = {
      movements: new Set(movements.map((movement) => movement.id)),
      admissions: new Set(admissions.map((admission) => admission.id)),
      referrals: new Set(referrals.map((referral) => referral.id)),
    };
    for (const movement of workspace.movements)
      if (movement.patientId && grantIds.has(movement.patientId) && !have.movements.has(movement.id))
        movements.push(movement);
    for (const admission of workspace.admissions)
      if (admission.patientId && grantIds.has(admission.patientId) && !have.admissions.has(admission.id))
        admissions.push(admission);
    for (const referral of workspace.referrals)
      if (referral.patientId && grantIds.has(referral.patientId) && !have.referrals.has(referral.id))
        referrals.push(referral);
  }

  const patientIds = new Set<string>(grantIds);
  for (const movement of movements) if (movement.patientId) patientIds.add(movement.patientId);
  for (const admission of admissions) if (admission.patientId) patientIds.add(admission.patientId);
  for (const referral of referrals) if (referral.patientId) patientIds.add(referral.patientId);

  let patients = workspace.patients.filter((patient) => patientIds.has(patient.id));
  if (officer) patients = patients.map(officerPatient);
  if (anonymise) patients = workspace.patients.filter((patient) => patientIds.has(patient.id)).map(anonymousPatient);

  const notices = workspace.notices.filter((notice) => noticeInScope(notice, access, places));

  const visibleOnlyByGrant = new Set<string>();
  for (const id of grantIds) if (!ownPatientIds.has(id)) visibleOnlyByGrant.add(id);

  return {
    ...workspace,
    movements,
    referrals,
    admissions,
    patients,
    notices,
    breakGlassPatientIds: visibleOnlyByGrant,
    datesOnlyAdmissionIds,
  };
}

/**
 * The broadcast alerts a desk other than the coordinator may read (review on PR #330). A directive
 * reaches every desk, or only the desks its target covers. A bed call or Pull now keeps only the
 * desk's own wards, their answers and their acknowledgements, so a ward never learns which other
 * wards were asked.
 */
export function scopeBroadcastAlerts(
  alerts: readonly BroadcastAlert[],
  access: WardAccess,
  units: readonly Unit[],
  places: PlaceLookup,
): BroadcastAlert[] {
  const unitIn = (unitId: string) => unitInScope(access.scope, unitId, places);
  const deskIn = (id: string) => unitIn(id) || edInScope(access.scope, id, places);
  return alerts.flatMap((alert) => {
    if (alert.targetUnitIds === undefined) {
      if (alert.targetScope !== "all" && !directiveDesks(alert, units).some(deskIn)) return [];
      // Only the desk's own acknowledgements, so no desk counts or names another's (review on PR #330).
      const acknowledged = alert.acknowledgedUnits.filter(deskIn);
      return [
        acknowledged.length === alert.acknowledgedUnits.length ? alert : { ...alert, acknowledgedUnits: acknowledged },
      ];
    }
    const own = alert.targetUnitIds.filter(unitIn);
    if (own.length === 0) return [];
    if (own.length === alert.targetUnitIds.length) return [alert];
    const names = own.map((id) => units.find((unit) => unit.id === id)?.name ?? id);
    return [
      {
        ...alert,
        targetUnitIds: own,
        acknowledgedUnits: alert.acknowledgedUnits.filter(unitIn),
        ...(alert.replies ? { replies: alert.replies.filter((reply) => unitIn(reply.unitId)) } : {}),
        targetScopeLabel: names.length === 1 ? names[0] : `${names.length} wards`,
      },
    ];
  });
}

/**
 * Executive figures (Josh's yes, 15 Oct 2026): a count of people under the small number line words
 * as "fewer than N". `useStatisticsCounts` applies it to every Statistics figure, table and chart
 * of people and to their export. Beds and bed states stay exact.
 */
export function smallNumberText(count: number): string {
  const line = CLINICAL_VALUES.smallNumberHidden.value;
  if (count > 0 && count < line) return `fewer than ${line}`;
  return String(count);
}

/** A part withheld only so a hidden part beside it cannot be worked back from their total. */
export const SMALL_NUMBER_NOT_SHOWN = "not shown";

/**
 * The parts of a breakdown whose total is on screen (role access plan, high finding 8). Each part
 * under the line words as "fewer than N". When exactly one part is worded, the smallest other part
 * above zero reads "not shown" too, or the hidden one could be worked back by subtraction. A worded
 * part is a string and an exact one stays a number.
 */
export function smallNumberParts(counts: readonly number[]): (number | string)[] {
  const parts: (number | string)[] = counts.map((count) => {
    const text = smallNumberText(count);
    return text === String(count) ? count : text;
  });
  if (parts.filter((part) => typeof part === "string").length !== 1) return parts;
  let pick = -1;
  counts.forEach((count, index) => {
    if (typeof parts[index] === "number" && count > 0 && (pick < 0 || count < counts[pick]!)) pick = index;
  });
  if (pick >= 0) parts[pick] = SMALL_NUMBER_NOT_SHOWN;
  return parts;
}

type ScopedAuditEvent = {
  id: string;
  subject: AuditSubject;
  actor?: { actingUnitId: string | null };
  details?: unknown;
};

/**
 * Commands about the person alone, with no stay, journey or ward: the reducer refuses a community
 * treatment order while the person holds a bed or has an open placement, so it can name nothing else.
 */
const PERSON_REFUSALS: ReadonlySet<string> = new Set([
  "RECORD_COMMUNITY_TREATMENT_ORDER",
  "END_COMMUNITY_TREATMENT_ORDER",
]);

/**
 * Which coordinator records a service coordinator keeps (Josh's yes, 15 Oct 2026): those about its
 * own service's wards, journeys, referrals, stays and bed releases. A record naming anything outside
 * the scope, or naming nothing at all (a configuration change), stays the statewide desk's.
 */
export function coordinatorRecordScope(
  scoped: {
    movements: readonly { id: string }[];
    referrals: readonly { id: string }[];
    admissions: readonly { id: string }[];
    patients?: readonly { id: string }[];
  },
  bedReleases: readonly { id: string; unitId: string }[],
  unitIn: (unitId: string) => boolean,
  edIn: (edId: string) => boolean = () => false,
  leaveBeds: readonly { id: string; unitId: string }[] = [],
): {
  movementIds: ReadonlySet<string>;
  subject(subject: AuditSubject): boolean;
  /**
   * The events in scope. An event acted by, or naming a ward target, outside the scope is left out
   * whole, so no other service's ward or outcome is shown. One about another audit event (a review)
   * follows the event it is about.
   */
  auditEvents<E extends ScopedAuditEvent>(events: readonly E[]): E[];
  /**
   * A refusal's subject id: a journey, referral, stay, release, leave bed, ward or ED in scope, or
   * "none". A person alone is not enough, because one person can be known to two services.
   */
  rejectionSubject(id: string): boolean;
  /**
   * Which refusals are in scope. A refused record command names no subject ("none"), so it follows
   * the audit row the reducer writes with it (`record-rejection-N` with `audit-N`), and another
   * service's refused record command is left out. A refused community treatment order names only the
   * person, and nothing in the record ties a community patient or team to a service, so it is kept
   * when this desk's own scope already shows that person and their order (`PERSON_REFUSALS`).
   */
  refusals(
    auditEvents: readonly ScopedAuditEvent[],
  ): (rejection: { id: string; movementId: string; attempted?: string }) => boolean;
  logEntry(entry: EventLogEntry): boolean;
} {
  const movementIds = new Set(scoped.movements.map((movement) => movement.id));
  const referralIds = new Set(scoped.referrals.map((referral) => referral.id));
  const admissionIds = new Set(scoped.admissions.map((admission) => admission.id));
  const releaseIds = new Set(bedReleases.filter((release) => unitIn(release.unitId)).map((release) => release.id));
  const leaveBedIds = new Set(leaveBeds.filter((bed) => unitIn(bed.unitId)).map((bed) => bed.id));
  const patientIds = new Set((scoped.patients ?? []).map((patient) => patient.id));
  const subject = (record: AuditSubject): boolean => {
    switch (record.kind) {
      case "admission":
        return admissionIds.has(record.admissionId) && unitIn(record.unitId);
      case "movement":
        return movementIds.has(record.movementId);
      case "referral":
        return referralIds.has(record.referralId);
      case "bed-release":
        return releaseIds.has(record.releaseId) && unitIn(record.unitId);
      default:
        return false;
    }
  };
  const logEntry = (entry: EventLogEntry): boolean => {
    const named = [
      entry.movementId === undefined ? undefined : movementIds.has(entry.movementId),
      entry.referralId === undefined ? undefined : referralIds.has(entry.referralId),
      entry.admissionId === undefined ? undefined : admissionIds.has(entry.admissionId),
      entry.releaseId === undefined ? undefined : releaseIds.has(entry.releaseId),
      entry.unitId === undefined ? undefined : unitIn(entry.unitId),
      entry.actingUnitId === undefined ? undefined : unitIn(entry.actingUnitId),
      // A planned admission is the statewide desk's booking list.
      entry.plannedAdmissionId === undefined ? undefined : false,
    ].filter((answer): answer is boolean => answer !== undefined);
    return named.length > 0 && named.every(Boolean);
  };
  const wardsInScope = (event: ScopedAuditEvent): boolean => {
    const acting = event.actor?.actingUnitId;
    if (acting !== undefined && acting !== null && !unitIn(acting)) return false;
    const targets = (event.details as { targets?: readonly { unitId: string | null }[] } | undefined)?.targets;
    return (targets ?? []).every((target) => target.unitId === null || unitIn(target.unitId));
  };
  const auditEvents = <E extends ScopedAuditEvent>(events: readonly E[]): E[] => {
    const kept = new Set(
      events.filter((event) => subject(event.subject) && wardsInScope(event)).map((event) => event.id),
    );
    // A review of a review follows its chain, so repeat until nothing more joins.
    for (let grew = true; grew;) {
      grew = false;
      for (const event of events)
        if (
          event.subject.kind === "audit-event" &&
          !kept.has(event.id) &&
          kept.has(event.subject.eventId) &&
          wardsInScope(event)
        ) {
          kept.add(event.id);
          grew = true;
        }
    }
    return events.filter((event) => kept.has(event.id));
  };
  const rejectionSubject = (id: string): boolean =>
    id === "none" ||
    movementIds.has(id) ||
    referralIds.has(id) ||
    admissionIds.has(id) ||
    releaseIds.has(id) ||
    leaveBedIds.has(id) ||
    unitIn(id) ||
    edIn(id);
  const refusals = (events: readonly ScopedAuditEvent[]) => {
    const kept = new Set(auditEvents(events).map((event) => event.id));
    return (rejection: { id: string; movementId: string; attempted?: string }) => {
      const paired = /^record-rejection-(\d+)$/.exec(rejection.id);
      if (paired) return kept.has(`audit-${paired[1]}`);
      if (rejection.attempted !== undefined && PERSON_REFUSALS.has(rejection.attempted)) {
        return patientIds.has(rejection.movementId);
      }
      return rejectionSubject(rejection.movementId);
    };
  };
  return { movementIds, subject, auditEvents, rejectionSubject, refusals, logEntry };
}

/**
 * D-59: the people a coordinator's own bookings name, added to its view, so a booking for one of its
 * wards keeps its person even when nothing else links them there. Nobody else is added.
 */
export function withBookedPatients<P extends { id: string }>(
  shown: readonly P[],
  all: readonly P[],
  bookings: readonly { patientId: string | null }[],
): P[] {
  const present = new Set(shown.map((patient) => patient.id));
  const booked = new Set(
    bookings.map((booking) => booking.patientId).filter((id): id is string => id !== null && !present.has(id)),
  );
  return booked.size === 0 ? [...shown] : [...shown, ...all.filter((patient) => booked.has(patient.id))];
}

/** Whether a booking's person is in view. An initials-only booking names nobody, so it always is. */
export function bookingPersonShown(booking: { patientId: string | null }, patients: ReadonlySet<string>): boolean {
  return booking.patientId === null || patients.has(booking.patientId);
}

/** Whether a record belongs to a person this desk sees only through break glass, so it stays read only. */
export function seenThroughBreakGlass(
  record: { patientId?: string | null },
  breakGlassPatientIds: ReadonlySet<string>,
): boolean {
  return typeof record.patientId === "string" && breakGlassPatientIds.has(record.patientId);
}
