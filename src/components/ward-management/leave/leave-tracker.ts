import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import { bedStates, networkNamedHolds, type ReservationReferral } from "@/components/ward-management/ward-bed-states";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed, Movement, Referral, Unit } from "@/components/ward-management/ward-model";

import { leaveOpenWarning } from "@/components/ward-management/ward-leave-open-warning";

export { leaveOpenWarning };

/**
 * Leave, shared by the Tools sheet's "Leave due" and the Leave page (feature 23, Josh 9 Nov 2026).
 *
 * No new clinical threshold: a leave is Overdue once its recorded expected return has passed, Due
 * back today when that return falls on today, and Absent without leave while the ward's absence
 * record stands. These are the same reads the Leave due tool already made.
 */

/** Due back by the end of today, or already overdue. An absence without leave is not "due back". */
export function leaveDueToday(leave: LeaveBed, now: Instant): boolean {
  return !leave.absentWithoutLeave && dayOf(leave.expectedReturn) <= dayOf(now);
}

/**
 * The bed a leave record holds: the number the ward board shows for that stay. That is the stay's
 * recorded bed number, else its fixed seat (`wardStaySeats`, the same seat the board's layout uses),
 * and only for a stay with neither the board's own order (ready beds first, then each leave record).
 */
export function leaveBedLabels(
  unit: Unit,
  unitLeave: readonly LeaveBed[],
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
  /** The named holds (`networkNamedHolds`), so Ready here is the board's and Capacity's (3.4). */
  namedHolds: readonly ReservationReferral[],
): Map<string, string> {
  const ready = bedStates(unit, admissions, bedReleases, leaveBeds, namedHolds).ready;
  const labels = new Map<string, string>();
  const seats = wardStaySeats(
    unit,
    admissions.filter((admission) => admission.unitId === unit.id),
  );
  unitLeave.forEach((leave, index) => {
    const recorded = admissions.find((admission) => admission.id === leave.admissionId)?.bedNumber;
    const number = recorded ?? seats.get(leave.admissionId) ?? ready + index + 1;
    labels.set(leave.id, `Bed ${String(number).padStart(2, "0")}`);
  });
  return labels;
}

export type LeaveStatus = "absent" | "overdue" | "due_today" | "on_leave";

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  absent: "Absent without leave",
  overdue: "Overdue",
  due_today: "Due back today",
  on_leave: "On leave",
};

const STATUS_ORDER: Record<LeaveStatus, number> = { absent: 0, overdue: 1, due_today: 2, on_leave: 3 };

export function leaveStatus(leave: LeaveBed, now: Instant): LeaveStatus {
  if (leave.absentWithoutLeave) return "absent";
  if (leave.expectedReturn < now) return "overdue";
  if (dayOf(leave.expectedReturn) === dayOf(now)) return "due_today";
  return "on_leave";
}

const LEAVE_KIND_LABEL: Record<NonNullable<LeaveBed["kind"]>, string> = {
  off_ward: "Off-ward leave",
  medical_trip: "Medical trip",
};

export type LeaveTrackerRow = {
  id: string;
  unitId: string;
  wardName: string;
  bedLabel: string;
  admission: Admission | undefined;
  kind: string;
  leftAt: Instant;
  expectedReturn: Instant;
  status: LeaveStatus;
  /** The 24-hour "consider opening the bed" words, once that long on leave. */
  openWarning: string | undefined;
};

/** Everyone on leave on the given wards: the most pressing first, then by expected return. */
export function leaveTrackerRows(
  input: {
    leaveBeds: readonly LeaveBed[];
    units: readonly Unit[];
    admissions: readonly Admission[];
    bedReleases: BedRelease[];
    movements: readonly Movement[];
    referrals: readonly Referral[];
  },
  now: Instant,
  includeUnit: (unitId: string) => boolean,
  wardName: (unit: Unit) => string = (unit) => unit.name,
): LeaveTrackerRow[] {
  const rows: LeaveTrackerRow[] = [];
  for (const unit of input.units) {
    if (!includeUnit(unit.id)) continue;
    const unitLeave = input.leaveBeds.filter((leave) => leave.unitId === unit.id);
    if (unitLeave.length === 0) continue;
    const labels = leaveBedLabels(
      unit,
      unitLeave,
      input.admissions,
      input.bedReleases,
      input.leaveBeds,
      networkNamedHolds(input.movements, input.referrals),
    );
    for (const leave of unitLeave) {
      rows.push({
        id: leave.id,
        unitId: unit.id,
        wardName: wardName(unit),
        bedLabel: labels.get(leave.id) ?? "Bed on leave",
        admission: input.admissions.find((admission) => admission.id === leave.admissionId),
        kind: LEAVE_KIND_LABEL[leave.kind ?? "off_ward"],
        leftAt: leave.confirmedAt,
        expectedReturn: leave.expectedReturn,
        status: leaveStatus(leave, now),
        openWarning: leaveOpenWarning(leave, now),
      });
    }
  }
  return rows.sort(
    (left, right) =>
      STATUS_ORDER[left.status] - STATUS_ORDER[right.status] || left.expectedReturn - right.expectedReturn,
  );
}
