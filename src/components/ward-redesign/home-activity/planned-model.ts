import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { decisionTargetReading } from "@/components/ward-management/ward-decision-targets";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { communityOriginLabel } from "@/components/ward-management/ward-movement-origin";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * Mock-up only: Home's Planned list. The rest of the shift in time order, built only from times
 * the records already hold: a planned move or a booked transport's stated time, an expected
 * discharge, a planned admission, and the coordinator's own operational targets from Settings
 * (`configuration`) coming due. Records (not targets) for the rest of today follow under "After
 * your shift", so today's expected discharges are not lost at 15:00. Nothing is predicted and no
 * legal time is computed or counted down (D-70): legal form times stay as typed on Legal forms.
 */
export type PlannedKind = "move" | "transport" | "discharge" | "admission" | "target";

export type PlannedRow = {
  id: string;
  at: Instant;
  kind: PlannedKind;
  what: string;
  /** Surname first (D-83), or the initials a booking holds when no person is linked. */
  who: string;
  where: string;
  /** The person's record, when one is linked. */
  patientId?: string;
  /** After the shift ends (later today). Targets are never listed here. */
  later: boolean;
};

type PlannedInput = {
  movements: readonly Movement[];
  admissions: readonly Admission[];
  plannedAdmissions: readonly PlannedAdmission[];
  units: readonly Unit[];
  configuration: WardConfiguration;
  now: Instant;
  /** The end of the coordinator's shift. */
  until: Instant;
  /** The end of today: records (not targets) up to here follow the shift's rows. */
  endOfDay: Instant;
  nameOf: (subject: Movement | Admission | { patientId?: string | null }) => ResolvedPatientInfo;
};

const STEP_WORDS: Record<string, string> = {
  referral_decision: "Referral decision target",
  transfer_acceptance: "Bed pull target",
  transport_booked: "Transport booking target",
};

export function plannedRows(input: PlannedInput): PlannedRow[] {
  const { movements, admissions, plannedAdmissions, units, configuration, now, until, endOfDay, nameOf } = input;
  // Targets: the rest of the shift only. Records: the rest of today.
  const within = (at: Instant | null | undefined): at is Instant =>
    at !== undefined && at !== null && at > now && at <= until;
  const today = (at: Instant | null | undefined): at is Instant =>
    at !== undefined && at !== null && at > now && at < endOfDay;
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]));
  const edName = new Map(allEmergencyDepartments().map((ed) => [ed.id, ed.name]));
  const origin = (movement: Movement) =>
    movement.originEdId === undefined
      ? communityOriginLabel(movement.originCommunity)
      : (edName.get(movement.originEdId) ?? movement.originEdId);
  const ward = (unitId: string | undefined) => (unitId ? (unitName.get(unitId) ?? unitId) : "Ward not chosen");
  const who = (info: ResolvedPatientInfo) => ({
    who: info.formalName,
    ...(info.patient ? { patientId: info.patient.id } : {}),
  });
  const rows: Omit<PlannedRow, "later">[] = [];

  for (const movement of movements) {
    if (!isOpen(movement)) continue;
    const person = who(nameOf(movement));
    if (movement.acceptedUnitId && today(movement.plannedMoveAt)) {
      rows.push({
        id: `move:${movement.id}`,
        at: movement.plannedMoveAt,
        kind: "move",
        what: movement.stage === "accepted_awaiting_bed" ? "Planned move, bed not pulled yet" : "Planned move",
        ...person,
        where: `${origin(movement)} to ${ward(movement.acceptedUnitId)}`,
      });
    }
    const job = movement.transport;
    if (job && job.cancelledAt === undefined && job.arrivedAt === undefined && job.stoppedAt === undefined) {
      if (today(job.estimatedAt)) {
        rows.push({
          id: `transport:${movement.id}:${job.id}`,
          at: job.estimatedAt,
          kind: "transport",
          what: `Transport booked (${job.provider}), time the booker was given`,
          ...person,
          where: `${origin(movement)} to ${ward(movement.acceptedUnitId)}`,
        });
      }
    }
    if (isWaitingInEd(movement) && within(movement.openedAt + configuration.edAccessTargetMinutes)) {
      rows.push({
        id: `ed-target:${movement.id}`,
        at: movement.openedAt + configuration.edAccessTargetMinutes,
        kind: "target",
        what: `Reaches your ${splitDuration(configuration.edAccessTargetMinutes)} ED access target`,
        ...person,
        where: origin(movement),
      });
    }
    if (movement.stage === "pulled" && within(movement.pullExpiresAt)) {
      rows.push({
        id: `pull-limit:${movement.id}`,
        at: movement.pullExpiresAt,
        kind: "target",
        what: "Pull time limit ends",
        ...person,
        where: ward(movement.acceptedUnitId),
      });
    }
    const reading = decisionTargetReading(movement, now, configuration);
    if (reading && !reading.overdue && within(reading.dueAt)) {
      rows.push({
        id: `step-target:${movement.id}:${reading.step}`,
        at: reading.dueAt,
        kind: "target",
        what: `${STEP_WORDS[reading.step] ?? reading.label} (${splitDuration(reading.targetMinutes)})`,
        ...person,
        where:
          reading.step === "referral_decision"
            ? `${origin(movement)}, ${movement.referredUnitIds.length} ${movement.referredUnitIds.length === 1 ? "ward" : "wards"} asked`
            : `${origin(movement)} to ${ward(movement.acceptedUnitId)}`,
      });
    }
  }

  for (const admission of admissions) {
    if (admission.state === "departed" || !today(admission.expectedDischargeAt)) continue;
    rows.push({
      id: `discharge:${admission.id}`,
      at: admission.expectedDischargeAt,
      kind: "discharge",
      what: admission.dischargeConfirmedAt ? "Discharge, confirmed" : "Expected discharge, not yet confirmed",
      ...who(nameOf(admission)),
      where: ward(admission.unitId),
    });
  }

  for (const booking of plannedAdmissions) {
    if (booking.state !== "booked" || !today(booking.expectedArrivalAt)) continue;
    const info = booking.patientId ? nameOf({ patientId: booking.patientId }) : undefined;
    rows.push({
      id: `admission:${booking.id}`,
      at: booking.expectedArrivalAt,
      kind: "admission",
      what: "Planned admission, expected arrival",
      ...(info?.patient ? who(info) : { who: booking.initials ? `Initials ${booking.initials}` : "Name not recorded" }),
      where: ward(booking.unitId),
    });
  }

  return rows.map((row) => ({ ...row, later: row.at > until })).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
