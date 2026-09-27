import { describe, expect, it } from "vitest";

import { isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "../src/components/ward-management/ward-model";
import type { Admission } from "../src/components/ward-management/ward-admissions";
import { patientCohort } from "../src/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "../src/components/ward-management/ward-patient-resolver";
import { edById, unitById } from "../src/components/ward-management/ward-sites";

/**
 * Audit T8 (`D:/Temp/claude/seed-patient-link-audit.md`): the guard that every seeded person
 * links to a real patient, and that the link it names does not contradict itself.
 *
 * ⚠️ **EXPECTED RED TODAY.** The seed-link work that makes this pass (tasks T0 through T3 —
 * adding the ~317 synthetic patients and pointing every record at one) lives on other branches
 * and is not yet folded here. This file only adds the guard; it does not fix the seed.
 *
 * Owner rule (option A), for the sex/gender comparisons below: `sex` is one of "Female", "Male",
 * "Another term" or "Not recorded"; `gender` is one of "Female", "Male", "Non-binary", "Different
 * term" or "Not recorded". An absent value or an explicit "Not recorded" is never treated as a
 * mismatch — only two values that are BOTH actually recorded, and disagree, count.
 */

const DEMONSTRATION_DAY = new Date("2026-08-15T00:00:00");

function firstTen(ids: readonly string[]): string {
  const shown = ids.slice(0, 10).join(", ");
  return ids.length > 10 ? `${shown} (+${ids.length - 10} more, ${ids.length} total)` : shown || "(none)";
}

/** Never a mismatch: an unrecorded value on either side, or the "Not recorded" sentinel. */
function isRecorded(value: string | undefined): value is string {
  return value !== undefined && value !== "Not recorded";
}

/** A referral's sex/gender live on its psychiatric-ward destination, not on the referral itself —
 *  the only destination kind that carries either field (`ReferralDestination` in ward-model.ts). */
function referralWardDestination(referral: Referral) {
  const addressing = referral.destinations.find((entry) => entry.destination.kind === "psychiatric_ward");
  return addressing && addressing.destination.kind === "psychiatric_ward" ? addressing.destination : undefined;
}

/** A referral counts as open while it still has a live destination — nothing left queued or
 *  accepted means it is no longer currently claiming a place anywhere. */
function referralIsOpen(referral: Referral): boolean {
  return referral.destinations.some((entry) => entry.state === "queued" || entry.state === "accepted");
}

/** `departed` is the only terminal admission state; waitlisted/pulled/occupied are all still open. */
function admissionIsOpen(admission: Admission): boolean {
  return admission.state !== "departed";
}

/** Every open movement is still physically at its origin ED — arrival is what closes a movement
 *  (`isOpen`'s own doc comment), so the origin ED is the whole answer for the open case. */
function siteForMovement(movement: Movement): string | undefined {
  return edById(movement.originEdId)?.siteCode;
}

function siteForAdmission(admission: Admission): string | undefined {
  return unitById(admission.unitId)?.siteCode;
}

type SeedState = ReturnType<typeof seedWardFlowState>;

/**
 * Every patient on open records at more than one site, as "PT-x: A@SITE vs B@SITE". A bed pulled
 * for a movement, or the stay an accepted referral names, is the SAME journey as that movement or
 * referral when the two are linked by id AND resolve to the same patient (the seed-link plan: one
 * person covers both), so it is not counted as a second place. Every other open record is.
 */
function openRecordConflicts(state: SeedState): string[] {
  const { movements, referrals, admissions } = state;
  const openRecordsByPatient = new Map<string, { recordId: string; site: string }[]>();
  const add = (patientId: string | undefined, recordId: string, site: string | undefined) => {
    if (!patientId || !site) return;
    const list = openRecordsByPatient.get(patientId) ?? [];
    list.push({ recordId, site });
    openRecordsByPatient.set(patientId, list);
  };

  for (const movement of movements) {
    if (!isOpen(movement)) continue;
    add(resolveSubjectPatient(movement, state).patient?.id, movement.id, siteForMovement(movement));
  }
  for (const referral of referrals) {
    if (!referralIsOpen(referral)) continue;
    add(resolveSubjectPatient(referral, state).patient?.id, referral.id, referral.originSiteCode);
  }
  // Each open linking record absorbs at most one admission: a second bed held for the same movement,
  // or a second stay for the same referral, is a second place.
  const absorbedBy = new Set<string>();
  for (const admission of admissions) {
    if (!admissionIsOpen(admission)) continue;
    const patientId = resolveSubjectPatient(admission, state).patient?.id;
    const samePatient = (subject: Movement | Referral) =>
      patientId !== undefined && resolveSubjectPatient(subject, state).patient?.id === patientId;
    const linkingMovement = movements.find(
      (movement) =>
        isOpen(movement) &&
        (movement.admissionId === admission.id || movement.id === admission.movementId) &&
        samePatient(movement) &&
        !absorbedBy.has(movement.id),
    );
    const linkingReferral = linkingMovement
      ? undefined
      : referrals.find(
          (referral) =>
            referralIsOpen(referral) &&
            referral.id === admission.referralId &&
            samePatient(referral) &&
            !absorbedBy.has(referral.id),
        );
    const linking = linkingMovement ?? linkingReferral;
    if (linking) {
      absorbedBy.add(linking.id);
      continue;
    }
    add(patientId, admission.id, siteForAdmission(admission));
  }

  const conflicts: string[] = [];
  for (const [patientId, records] of openRecordsByPatient) {
    const sites = new Set(records.map((record) => record.site));
    if (sites.size > 1) {
      conflicts.push(`${patientId}: ${records.map((record) => `${record.recordId}@${record.site}`).join(" vs ")}`);
    }
  }
  return conflicts;
}

describe("every seeded person links to a real patient (audit T8, expected red until T0-T3 fold)", () => {
  const state = seedWardFlowState();
  const { movements, referrals, admissions, patients } = state;

  // A guard that ran over an empty population would pass for the wrong reason.
  it("checks a non-empty population", () => {
    expect(movements.length, "no movements in the seed").toBeGreaterThan(0);
    expect(referrals.length, "no referrals in the seed").toBeGreaterThan(0);
    expect(admissions.length, "no admissions in the seed").toBeGreaterThan(0);
    expect(patients.length, "no patients in the seed").toBeGreaterThan(0);
  });

  it("resolves every movement to a real patient, never 'Unknown Patient'", () => {
    const unknown = movements.filter(
      (movement) => resolveSubjectPatient(movement, state).displayName === "Unknown Patient",
    );
    expect(
      unknown.map((movement) => movement.id),
      `${unknown.length} of ${movements.length} movements resolve to 'Unknown Patient': ${firstTen(unknown.map((movement) => movement.id))}`,
    ).toEqual([]);
  });

  it("names a real patientId on every admission", () => {
    const patientIds = new Set(patients.map((patient) => patient.id));
    const missing = admissions.filter((admission) => !admission.patientId || !patientIds.has(admission.patientId));
    expect(
      missing.map((admission) => admission.id),
      `${missing.length} of ${admissions.length} admissions have no real patientId: ${firstTen(missing.map((admission) => admission.id))}`,
    ).toEqual([]);
  });

  it("names a real patientId on every referral", () => {
    const patientIds = new Set(patients.map((patient) => patient.id));
    const missing = referrals.filter((referral) => !referral.patientId || !patientIds.has(referral.patientId));
    expect(
      missing.map((referral) => referral.id),
      `${missing.length} of ${referrals.length} referrals have no real patientId: ${firstTen(missing.map((referral) => referral.id))}`,
    ).toEqual([]);
  });

  it("agrees on sex with its linked patient, where both are recorded", () => {
    const mismatches: string[] = [];

    for (const movement of movements) {
      const patient = resolveSubjectPatient(movement, state).patient;
      if (patient && isRecorded(movement.sex) && isRecorded(patient.sex) && movement.sex !== patient.sex) {
        mismatches.push(`${movement.id} (record ${movement.sex} vs patient ${patient.sex})`);
      }
    }
    for (const referral of referrals) {
      const patient = resolveSubjectPatient(referral, state).patient;
      const sex = referralWardDestination(referral)?.sex;
      if (patient && isRecorded(sex) && isRecorded(patient.sex) && sex !== patient.sex) {
        mismatches.push(`${referral.id} (record ${sex} vs patient ${patient.sex})`);
      }
    }
    for (const admission of admissions) {
      const patient = resolveSubjectPatient(admission, state).patient;
      if (patient && isRecorded(admission.sex) && isRecorded(patient.sex) && admission.sex !== patient.sex) {
        mismatches.push(`${admission.id} (record ${admission.sex} vs patient ${patient.sex})`);
      }
    }

    expect(mismatches, `${mismatches.length} sex mismatches: ${firstTen(mismatches)}`).toEqual([]);
  });

  it("agrees on gender with its linked patient, where both are recorded", () => {
    const mismatches: string[] = [];

    for (const movement of movements) {
      const patient = resolveSubjectPatient(movement, state).patient;
      if (
        patient &&
        isRecorded(movement.gender) &&
        isRecorded(patient.gender) &&
        movement.gender !== patient.gender
      ) {
        mismatches.push(`${movement.id} (record ${movement.gender} vs patient ${patient.gender})`);
      }
    }
    for (const referral of referrals) {
      const patient = resolveSubjectPatient(referral, state).patient;
      const gender = referralWardDestination(referral)?.gender;
      if (patient && isRecorded(gender) && isRecorded(patient.gender) && gender !== patient.gender) {
        mismatches.push(`${referral.id} (record ${gender} vs patient ${patient.gender})`);
      }
    }

    expect(mismatches, `${mismatches.length} gender mismatches: ${firstTen(mismatches)}`).toEqual([]);
  });

  it("agrees on age band with its linked patient, on the demonstration day", () => {
    const mismatches: string[] = [];

    for (const movement of movements) {
      const patient = resolveSubjectPatient(movement, state).patient;
      if (!patient) continue;
      const patientBand = patientCohort(patient.dateOfBirth, DEMONSTRATION_DAY);
      if (movement.cohort !== patientBand) {
        mismatches.push(`${movement.id} (record ${movement.cohort} vs patient ${patientBand})`);
      }
    }
    for (const referral of referrals) {
      const patient = resolveSubjectPatient(referral, state).patient;
      if (!patient) continue;
      const patientBand = patientCohort(patient.dateOfBirth, DEMONSTRATION_DAY);
      if (referral.ageBand !== patientBand) {
        mismatches.push(`${referral.id} (record ${referral.ageBand} vs patient ${patientBand})`);
      }
    }

    expect(mismatches, `${mismatches.length} age band mismatches: ${firstTen(mismatches)}`).toEqual([]);
  });

  it("never puts one patient on two open records at two different sites", () => {
    const conflicts = openRecordConflicts(state);
    expect(conflicts, `${conflicts.length} patients on open records at conflicting sites: ${firstTen(conflicts)}`).toEqual(
      [],
    );
  });

  /**
   * The check above skips a record that belongs to another open record's own journey: the bed pulled
   * for a movement, or the stay an accepted referral names, linked by id and resolving to the same
   * patient. These cases prove that exception is no wider than that (asked for by the coordinator,
   * 26 Sept 2026). Each builds a contradiction into a copy of the seed and must be caught.
   */
  describe("still catches what the linked-journey exception must not hide", () => {
    const hasPatient = (subject: Admission | Movement) => resolveSubjectPatient(subject, state).patient !== undefined;
    const patientOf = (subject: Admission | Movement | Referral) => resolveSubjectPatient(subject, state).patient!.id;
    const openUnlinkedAdmissions = admissions.filter(
      (admission) =>
        admissionIsOpen(admission) &&
        !admission.movementId &&
        !admission.referralId &&
        !movements.some((movement) => movement.admissionId === admission.id) &&
        hasPatient(admission),
    );
    const pairMovement = movements.find(
      (movement) =>
        isOpen(movement) &&
        movement.admissionId !== undefined &&
        admissions.some((admission) => admission.id === movement.admissionId && admissionIsOpen(admission)),
    );
    const referralStay = admissions.find(
      (admission) =>
        admissionIsOpen(admission) &&
        admission.referralId !== null &&
        referrals.some(
          (referral) =>
            referral.id === admission.referralId &&
            referralIsOpen(referral) &&
            resolveSubjectPatient(referral, state).patient?.id === resolveSubjectPatient(admission, state).patient?.id,
        ),
    );
    const closedMovement = movements.find((movement) => !isOpen(movement) && hasPatient(movement));
    const otherSite = (site: string | undefined) =>
      openUnlinkedAdmissions.find((admission) => siteForAdmission(admission) !== site)!;
    const conflictFor = (conflicts: string[], patientId: string, recordId: string) =>
      conflicts.some((line) => line.startsWith(`${patientId}:`) && line.includes(recordId));
    const asPatient = (patientId: string) => ({ patientId: patientId as Admission["patientId"] });

    function withChanges(
      admissionChanges: Record<string, Partial<Admission>>,
      movementChanges: Record<string, Partial<Movement>> = {},
      extraAdmissions: Admission[] = [],
    ): SeedState {
      return {
        ...state,
        admissions: [
          ...admissions.map((admission) => ({ ...admission, ...admissionChanges[admission.id] })),
          ...extraAdmissions,
        ],
        movements: movements.map((movement) => ({ ...movement, ...movementChanges[movement.id] })),
      };
    }

    it("has the records these cases need", () => {
      expect(openUnlinkedAdmissions.length).toBeGreaterThan(2);
      expect(pairMovement, "no open movement with its own open pulled bed in the seed").toBeDefined();
      expect(referralStay, "no open stay named by an open referral for the same patient").toBeDefined();
      expect(closedMovement, "no closed movement in the seed").toBeDefined();
    });

    it("counts a movement plus its pulled bed, and an accepted referral plus its stay, as one place each", () => {
      const conflicts = openRecordConflicts(state);
      expect(conflicts.some((line) => line.startsWith(`${patientOf(pairMovement!)}:`))).toBe(false);
      expect(conflicts.some((line) => line.startsWith(`${patientOf(referralStay!)}:`))).toBe(false);
    });

    it("(a) the same patient on two open records that are not linked to each other", () => {
      const first = openUnlinkedAdmissions[0];
      const second = otherSite(siteForAdmission(first));
      const patientId = patientOf(first);
      const conflicts = openRecordConflicts(withChanges({ [second.id]: asPatient(patientId) }));
      expect(conflictFor(conflicts, patientId, second.id)).toBe(true);
    });

    it("(b) a linked pair plus a third unlinked open record for the same patient", () => {
      const patientId = patientOf(pairMovement!);
      const third = otherSite(siteForMovement(pairMovement!));
      const conflicts = openRecordConflicts(withChanges({ [third.id]: asPatient(patientId) }));
      expect(conflictFor(conflicts, patientId, third.id)).toBe(true);
    });

    it("(c) a link to a record that belongs to a different patient", () => {
      // The movement's own pulled bed is handed to somebody already on an open record at another
      // site. The link no longer joins one person's journey, so the bed counts as a place.
      const pulledBed = admissions.find((admission) => admission.id === pairMovement!.admissionId)!;
      const other = otherSite(siteForAdmission(pulledBed));
      const otherPatientId = patientOf(other);
      const conflicts = openRecordConflicts(withChanges({ [pulledBed.id]: asPatient(otherPatientId) }));
      expect(conflictFor(conflicts, otherPatientId, pulledBed.id)).toBe(true);
    });

    it("(d) an admission linked only from a closed movement", () => {
      // A closed movement names an open stay for the same person, who is also on an open record at
      // another site. A closed movement is not counted, so it cannot absorb the stay.
      const stay = openUnlinkedAdmissions[0];
      const elsewhere = otherSite(siteForAdmission(stay));
      const patientId = patientOf(stay);
      const conflicts = openRecordConflicts(
        withChanges(
          { [elsewhere.id]: asPatient(patientId) },
          { [closedMovement!.id]: { admissionId: stay.id, patientId: patientId as Movement["patientId"] } },
        ),
      );
      expect(conflictFor(conflicts, patientId, stay.id)).toBe(true);
    });

    it("(e) two admissions linked to one movement", () => {
      // The movement's pulled bed is absorbed; a second bed for the same movement is a second place.
      const patientId = patientOf(pairMovement!);
      const second = otherSite(siteForMovement(pairMovement!));
      const extra: Admission = {
        ...second,
        id: `${second.id}-SECOND`,
        movementId: pairMovement!.id,
        ...asPatient(patientId),
      };
      const conflicts = openRecordConflicts(withChanges({}, {}, [extra]));
      expect(conflicts.some((line) => line.startsWith(`${patientId}:`))).toBe(true);
    });
  });
});
