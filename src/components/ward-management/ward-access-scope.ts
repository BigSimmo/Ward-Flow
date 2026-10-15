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
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
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
};

function activeGrantIds(grants: readonly BreakGlassGrant[] | undefined, now: Instant): Set<string> {
  return new Set((grants ?? []).filter((grant) => grant.until > now).map((grant) => grant.patientId));
}

/** The units a movement touches: where it was accepted and every ward it was sent to. */
function movementUnitIds(movement: Movement): string[] {
  return movement.acceptedUnitId ? [movement.acceptedUnitId, ...movement.referredUnitIds] : [...movement.referredUnitIds];
}

/** Has this movement finished, and when. `undefined` while it is still open. */
function movementEndedAt(movement: Movement): Instant | undefined {
  return movement.closure?.at;
}

function referralDestinationUnitIds(referral: Referral): string[] {
  return referral.destinations.flatMap((addressing) => {
    const destination = addressing.destination;
    const ids: string[] = [];
    if (destination.kind === "psychiatric_ward" && destination.unitId) ids.push(destination.unitId);
    if (addressing.acceptedUnitId) ids.push(addressing.acceptedUnitId);
    return ids;
  });
}

/** Keep only the destination lines a predicate allows. A referral left with none is not this role's. */
function trimReferral(referral: Referral, keep: (addressing: Referral["destinations"][number]) => boolean): Referral | undefined {
  const destinations = referral.destinations.filter(keep);
  if (destinations.length === 0) return undefined;
  return destinations.length === referral.destinations.length ? referral : { ...referral, destinations };
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
    dateOfBirth: patient.dateOfBirth,
    ...(patient.sex === undefined ? {} : { sex: patient.sex }),
    ...(patient.gender === undefined ? {} : { gender: patient.gender }),
    ...(patient.legalStatus === undefined ? {} : { legalStatus: patient.legalStatus }),
  } as Patient;
}

/** An admission with dates and ward only, for a community team watching its catchment client. */
function datesOnlyAdmission(admission: Admission): Admission {
  return { ...admission, tentativeDiagnosis: null };
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
  if (accessIsWholeNetwork(access)) return { ...workspace, breakGlassPatientIds: NO_GRANTS };

  const scope = access.scope;
  const unitIn = (unitId: string) => unitInScope(scope, unitId, places);
  const edIn = (edId: string) => edInScope(scope, edId, places);
  const edWindow = CLINICAL_VALUES.edHandoffWindow.value * MINUTES_PER_HOUR;
  const wardWindow = CLINICAL_VALUES.wardHandoffWindow.value * MINUTES_PER_DAY;

  let movements: Movement[] = [];
  let referrals: Referral[] = [];
  let admissions: Admission[] = [];
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
        referrals = referrals.map((referral) => {
          const { intake: _intake, ...rest } = referral;
          return rest as Referral;
        });
      }
      break;
    }
    case "bed_manager": {
      movements = workspace.movements.filter(
        (movement) => edIn(movement.originEdId) || movementUnitIds(movement).some(unitIn),
      );
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
      admissions = workspace.admissions.filter(
        (admission) => unitIn(admission.unitId) && (admission.leftAt === null || now - admission.leftAt <= wardWindow),
      );
      const referralIds = new Set(
        [...movements.map((movement) => movement.referralId), ...admissions.map((admission) => admission.referralId)].filter(
          (id): id is string => typeof id === "string",
        ),
      );
      referrals = workspace.referrals.flatMap((referral) => {
        if (!referralIds.has(referral.id) && !referralDestinationUnitIds(referral).some(unitIn)) return [];
        const trimmed = trimReferral(referral, (addressing) => addressing.destination.kind === "psychiatric_ward");
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
            (addressing) => addressing.destination.kind === "emergency_department" && edIn(addressing.destination.edId),
          ),
      );
      break;
    }
    case "community": {
      const teamName = scope.kind === "team" ? scope.teamName : undefined;
      referrals = workspace.referrals.flatMap((referral) => {
        const trimmed = trimReferral(
          referral,
          (addressing) => addressing.destination.kind === "community_team" && addressing.destination.teamName === teamName,
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
        workspace.patients.filter((patient) => patient.catchmentCommunityTeam === teamName).map((patient) => patient.id),
      );
      admissions = workspace.admissions.flatMap((admission) => {
        if (admission.referralId !== null && referralIds.has(admission.referralId)) return [admission];
        if (admission.patientId !== null && catchment.has(admission.patientId)) return [datesOnlyAdmission(admission)];
        return [];
      });
      break;
    }
    case "officer": {
      movements = workspace.movements.filter(
        (movement) => movement.transport !== undefined && movement.transport.arrivedAt === undefined && movement.closure === undefined,
      );
      officer = true;
      break;
    }
    case "admin":
      break;
  }

  // Break glass: one patient's own records, read only, for the granted time.
  if (grantIds.size > 0) {
    const have = {
      movements: new Set(movements.map((movement) => movement.id)),
      admissions: new Set(admissions.map((admission) => admission.id)),
      referrals: new Set(referrals.map((referral) => referral.id)),
    };
    for (const movement of workspace.movements)
      if (movement.patientId && grantIds.has(movement.patientId) && !have.movements.has(movement.id)) movements.push(movement);
    for (const admission of workspace.admissions)
      if (admission.patientId && grantIds.has(admission.patientId) && !have.admissions.has(admission.id))
        admissions.push(admission);
    for (const referral of workspace.referrals)
      if (referral.patientId && grantIds.has(referral.patientId) && !have.referrals.has(referral.id)) referrals.push(referral);
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
  for (const id of grantIds) visibleOnlyByGrant.add(id);

  return { ...workspace, movements, referrals, admissions, patients, notices, breakGlassPatientIds: visibleOnlyByGrant };
}

/**
 * Executive figures: any count under the small number line shows as "fewer than N", and a total
 * whose parts include a hidden one is rounded so the hidden part cannot be worked back.
 */
export function smallNumberText(count: number): string {
  const line = CLINICAL_VALUES.smallNumberHidden.value;
  if (count > 0 && count < line) return `fewer than ${line}`;
  return String(count);
}
