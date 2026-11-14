import { placeDisplayName } from "@/components/ward-management/ward-place-names";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import { bedIsOccupied, type Admission, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { isTimePassed, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { targetHoursText } from "@/components/ward-management/ward-target-hours";
import { decisionTargetReading } from "@/components/ward-management/ward-decision-targets";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { communityOriginLabel } from "@/components/ward-management/ward-movement-origin";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * Home's Planned list (Home and Activity design, approved by Josh 31 Oct 2026). The rest of the shift in time order, built only from times
 * the records already hold: a planned move or a booked transport's stated time, an expected
 * discharge, a planned admission, and the coordinator's own operational targets from Settings
 * (`configuration`) coming due. Records (not targets) for the rest of today follow under "After
 * your shift", so today's expected discharges are not lost at 15:00. Nothing is predicted and no
 * legal time is computed or counted down (D-70): legal form times stay as typed on Legal forms.
 *
 * Past planned time (root-cause fix 2.2, approved by Josh 13 Nov 2026): a record whose time has
 * passed with nothing done stays in view, first, instead of dropping off the list. A planned move
 * and a planned admission stay until someone acts (the move leaves, the arrival is recorded or the
 * booking changes). A booked transport stays until its own inbox item, "Booking estimate passed",
 * appears. An expected discharge stays for the rest of today; earlier ones already read "Date
 * passed" on Capacity, the census, Discharges and Handover.
 */
type PlannedKind = "move" | "transport" | "discharge" | "admission" | "target";

export type PlannedRow = {
  id: string;
  at: Instant;
  kind: PlannedKind;
  what: string;
  /** Surname first (D-83), or the initials a booking holds when no person is linked. */
  who: string;
  where: string;
  /** The person's record, when one is linked. */
  recordId?: string;
  /** After the shift ends (later today). Targets are never listed here. */
  later: boolean;
  /** The time has passed and nobody has acted yet ("Past planned time"). Targets are never listed here. */
  past: boolean;
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
  /**
   * The end of today: records (not targets) up to here follow the shift's rows. A night shift that
   * runs past midnight lists its records to the shift end, as its targets are (audit M3).
   */
  endOfDay: Instant;
  /** The start of today: an expected discharge that passed earlier today stays under Past planned time. */
  startOfDay?: Instant;
  nameOf: (subject: Movement | Admission | PlannedAdmission) => ResolvedPatientInfo;
};

const BOOKING_ESTIMATE_PASSED_AFTER_MINUTES = CLINICAL_VALUES.bookingEstimatePassed.value;

const STEP_WORDS: Record<string, string> = {
  referral_decision: "Referral decision target",
  transfer_acceptance: "Bed pull target",
  transport_booked: "Transport booking target",
};

export function plannedRows(input: PlannedInput): PlannedRow[] {
  const { movements, admissions, plannedAdmissions, units, configuration, now, until, endOfDay, nameOf } = input;
  const startOfDay = input.startOfDay ?? endOfDay - 24 * 60;
  // Targets: the rest of the shift only. Records: the rest of today, or the rest of the shift when
  // it ends after midnight (audit M3, D-MCA (Josh, 14 Nov 2026)): from 23:00 a 01:00 planned move
  // on the night shift is listed, as the night shift's targets at that hour already were.
  // A time still to come is one that has not passed by the one clock rule (`isTimePassed`, audit
  // L2): at its own minute it is still listed.
  const recordsEnd = Math.max(endOfDay, until + 1);
  const upcoming = (at: Instant | null | undefined): at is Instant =>
    typeof at === "number" && Number.isFinite(at) && !isTimePassed(at, now);
  const within = (at: Instant | null | undefined): at is Instant => upcoming(at) && at <= until;
  const today = (at: Instant | null | undefined): at is Instant => upcoming(at) && at < recordsEnd;
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]));
  const edName = new Map(allEmergencyDepartments().map((ed) => [ed.id, ed.name]));
  const origin = (movement: Movement) =>
    movement.originEdId === undefined
      ? communityOriginLabel(movement.originCommunity)
      : (edName.get(movement.originEdId) ?? movement.originEdId);
  const ward = (unitId: string | undefined) =>
    unitId ? (unitName.get(unitId) ?? placeDisplayName(unitId)) : "Ward not chosen";
  const who = (info: ResolvedPatientInfo) => ({
    who: info.formalName,
    ...(info.patient ? { recordId: info.patient.id } : {}),
  });
  // Past planned time: the time has passed. Each kind below says how long its row stays.
  // The one clock rule (audit L2): passed once the clock is strictly after the minute.
  const passed = (at: Instant | null | undefined): at is Instant => isTimePassed(at, now);
  const rows: Omit<PlannedRow, "later" | "past">[] = [];

  for (const movement of movements) {
    if (!isOpen(movement)) continue;
    const person = who(nameOf(movement));
    // A late move stays until it leaves (moving) or closes.
    const moveAt = movement.plannedMoveAt;
    const moveLate = movement.stage !== "moving" && passed(moveAt);
    if (movement.acceptedUnitId && moveAt !== undefined && moveAt !== null && (today(moveAt) || moveLate)) {
      rows.push({
        id: `move:${movement.id}`,
        at: moveAt,
        kind: "move",
        what: movement.stage === "accepted_awaiting_bed" ? "Planned move, bed not pulled yet" : "Planned move",
        ...person,
        where: `${origin(movement)} to ${ward(movement.acceptedUnitId)}`,
      });
    }
    const job = movement.transport;
    if (job && job.cancelledAt === undefined && job.arrivedAt === undefined && job.stoppedAt === undefined) {
      // A passed estimate stays until the inbox's "Booking estimate passed" item takes over.
      const estimatedAt = job.estimatedAt;
      const transportLate = passed(estimatedAt) && now - estimatedAt < BOOKING_ESTIMATE_PASSED_AFTER_MINUTES;
      if (estimatedAt !== undefined && (today(estimatedAt) || transportLate)) {
        rows.push({
          id: `transport:${movement.id}:${job.id}`,
          at: estimatedAt,
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
        what: `Reaches your ED access target (${targetHoursText(configuration.edAccessTargetMinutes)})`,
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
    const dischargeAt = admission.expectedDischargeAt;
    if (admission.state === "departed" || dischargeAt === null || dischargeAt === undefined) continue;
    // A discharge that passed earlier today stays; earlier days already read "Date passed" elsewhere.
    if (!today(dischargeAt) && !(passed(dischargeAt) && dischargeAt >= startOfDay)) continue;
    rows.push({
      id: `discharge:${admission.id}`,
      at: dischargeAt,
      kind: "discharge",
      what: admission.dischargeConfirmedAt ? "Discharge, confirmed" : "Expected discharge, not yet confirmed",
      ...who(nameOf(admission)),
      where: ward(admission.unitId),
    });
  }

  for (const booking of plannedAdmissions) {
    // A late booking stays until the arrival is recorded or the booking is changed or cancelled.
    if (booking.state !== "booked" || !(today(booking.expectedArrivalAt) || passed(booking.expectedArrivalAt)))
      continue;
    // The resolver reads the booking's own link (archived D-14 keeps that read in one place).
    const info = nameOf(booking);
    rows.push({
      id: `admission:${booking.id}`,
      at: booking.expectedArrivalAt,
      kind: "admission",
      what: "Planned admission, expected arrival",
      ...(info.patient ? who(info) : { who: booking.initials ? `Initials ${booking.initials}` : "Name not recorded" }),
      where: ward(booking.unitId),
    });
  }

  return rows
    .map((row) => ({ ...row, later: row.at > until, past: isTimePassed(row.at, now) }))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/**
 * Tomorrow on Home (six features build, Josh 9 Nov 2026): the expected discharges and planned
 * admissions wards have already recorded for tomorrow (the Perth calendar day after `now`). Nothing
 * is predicted or scored: a discharge counts only because its ward recorded that expected date.
 */
export type TomorrowOutlook = {
  /** Start of tomorrow. */
  dayStart: Instant;
  discharges: PlannedRow[];
  /** Of the discharges, how many the ward has confirmed. */
  confirmed: number;
  admissions: PlannedRow[];
};

export function tomorrowOutlook(
  input: Pick<PlannedInput, "admissions" | "plannedAdmissions" | "units" | "nameOf"> & {
    endOfDay: Instant;
    /**
     * The end of the shift, when Later today lists records past midnight (audit M3): a record up to
     * here is already listed above, so tomorrow does not list it twice.
     */
    shiftEnd?: Instant;
  },
): TomorrowOutlook {
  const { admissions, plannedAdmissions, units, nameOf, endOfDay, shiftEnd } = input;
  const dayEnd = endOfDay + 24 * 60;
  const listedAbove = (at: Instant) => shiftEnd !== undefined && at <= shiftEnd;
  const tomorrow = (at: Instant | null | undefined): at is Instant =>
    at !== undefined && at !== null && at >= endOfDay && at < dayEnd && !listedAbove(at);
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]));
  const ward = (unitId: string) => unitName.get(unitId) ?? placeDisplayName(unitId);
  const who = (info: ResolvedPatientInfo) => ({
    who: info.formalName,
    ...(info.patient ? { recordId: info.patient.id } : {}),
  });
  const byTime = (a: PlannedRow, b: PlannedRow) => a.at - b.at || a.id.localeCompare(b.id);

  let confirmed = 0;
  const discharges: PlannedRow[] = [];
  for (const admission of admissions) {
    if (!bedIsOccupied(admission) || !tomorrow(admission.expectedDischargeAt)) continue;
    if (admission.dischargeConfirmedAt !== null) confirmed += 1;
    discharges.push({
      id: `tomorrow-discharge:${admission.id}`,
      at: admission.expectedDischargeAt,
      kind: "discharge",
      what: admission.dischargeConfirmedAt !== null ? "Discharge, confirmed" : "Expected discharge, not yet confirmed",
      ...who(nameOf(admission)),
      where: ward(admission.unitId),
      later: true,
      past: false,
    });
  }

  const booked: PlannedRow[] = [];
  for (const booking of plannedAdmissions) {
    if (booking.state !== "booked" || !tomorrow(booking.expectedArrivalAt)) continue;
    const info = nameOf(booking);
    booked.push({
      id: `tomorrow-admission:${booking.id}`,
      at: booking.expectedArrivalAt,
      kind: "admission",
      what: "Planned admission, expected arrival",
      ...(info.patient ? who(info) : { who: booking.initials ? `Initials ${booking.initials}` : "Name not recorded" }),
      where: ward(booking.unitId),
      later: true,
      past: false,
    });
  }

  return { dayStart: endOfDay, discharges: discharges.sort(byTime), confirmed, admissions: booked.sort(byTime) };
}
