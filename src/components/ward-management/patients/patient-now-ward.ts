import type { LucideIcon } from "lucide-react";
import { CalendarDays, DoorOpen } from "lucide-react";
import type { WfTone } from "@/components/wf";
import {
  daysInBed,
  isPastExpectedDischarge,
  stayDayNumber,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { ABSENCE_STEP_BAR_LABELS, ABSENCE_STEP_LABELS, absenceStepsFor } from "@/components/ward-management/ward-model";
import {
  dayOf,
  daysBetween,
  formatInstantWithDay,
  perthDayLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import { plural } from "@/components/ward-management/ward-plural";
import type { PatientMode } from "./patient-mode";
import type { PatientStatusContext } from "./patient-status-card";

/**
 * The patient page's Now tab for a person on the ward, on leave, absent or at ED (Josh's approved
 * list, 3 Nov 2026): the one next step, stay progress, discharge readiness and the last 24 hours.
 * Every line reads a recorded field. Nothing here scores, ranks or works out a clinical fact, and a
 * legal time is shown as typed, never as a countdown.
 */

/* ---------------- Next step ---------------- */

export type NextStepAction = {
  label: string;
  icon?: LucideIcon;
  ariaLabel?: string;
  /** The event the button raises, so the desk's role can limit it with its reason. */
  event?: WardFlowEventType;
  onClick?: () => void;
  /** A place to go instead of a handler (the ward's discharges list). */
  href?: string;
};

export type NextStep = {
  key: string;
  title: string;
  detail: string;
  tone: WfTone;
  action?: NextStepAction;
};

/**
 * The single thing due now for this mode, from the recorded stay. Every action reuses a handler the
 * screen already has (discharge date form, record return, the absence steps, return from ED).
 */
export function patientNextStep(
  mode: PatientMode,
  ctx: PatientStatusContext,
  options: { voluntary: boolean; confirmHref?: string },
): NextStep | null {
  const { admission, now } = ctx;
  if (mode === "ward") {
    if (!admission || admission.state !== "occupied") return null;
    if (admission.expectedDischargeAt === null)
      return {
        key: "set-discharge",
        title: "Set a discharge date",
        detail: "No expected discharge date is recorded for this stay.",
        tone: "neutral",
        action: ctx.onDischargeDate
          ? {
              label: "Set a discharge date",
              icon: CalendarDays,
              event: "UPDATE_EXPECTED_DISCHARGE",
              onClick: ctx.onDischargeDate,
            }
          : undefined,
      };
    const day = perthDayLabel(admission.expectedDischargeAt, ctx.dayZero);
    // The expected day has gone by unconfirmed: the useful step is a new date, not a confirm.
    if (admission.dischargeConfirmedAt === null && isPastExpectedDischarge(admission, now))
      return {
        key: "update-discharge",
        title: "Update the discharge date",
        detail: `Expected ${day} has passed and was not confirmed.`,
        tone: "warning",
        action: ctx.onDischargeDate
          ? {
              label: "Update the discharge date",
              icon: CalendarDays,
              event: "UPDATE_EXPECTED_DISCHARGE",
              onClick: ctx.onDischargeDate,
            }
          : undefined,
      };
    if (admission.dischargeConfirmedAt === null)
      return {
        key: "confirm-discharge",
        title: "Confirm discharge date",
        detail: options.confirmHref
          ? `Expected ${day}, not yet confirmed. The ward confirms it on its discharges list.`
          : `Expected ${day}, not yet confirmed. The ward confirms it on its own discharges list.`,
        tone: "info",
        action: options.confirmHref
          ? { label: "Confirm discharge date", icon: DoorOpen, event: "CONFIRM_BED_RELEASE", href: options.confirmHref }
          : undefined,
      };
    return {
      key: "nothing",
      title: "Nothing due now",
      detail: `Discharge confirmed for ${day}.`,
      tone: "success",
    };
  }
  if (mode === "leave" && ctx.leaveBed) {
    const bed = ctx.leaveBed;
    const overdue = now > bed.expectedReturn;
    return {
      key: "leave-return",
      title: "Record return",
      detail: `Due back ${formatInstantWithDay(bed.expectedReturn, now)}, typed by the ward.${
        overdue ? " That time has passed." : ""
      }`,
      tone: overdue ? "warning" : "neutral",
      action: { label: "Record return", event: "END_LEAVE_BED", onClick: ctx.onRecordReturn },
    };
  }
  if (mode === "awol" && ctx.leaveBed?.absentWithoutLeave) {
    const absence = ctx.leaveBed.absentWithoutLeave;
    const steps = absenceStepsFor(options.voluntary);
    const done = steps.filter((step) => absence.steps.some((entry) => entry.step === step)).length;
    const next = steps.find((step) => !absence.steps.some((entry) => entry.step === step));
    if (next)
      return {
        key: `awol-${next}`,
        title: ABSENCE_STEP_LABELS[next],
        detail: `Missing person steps: ${done} of ${steps.length} recorded. This one is next on the list.`,
        tone: "danger",
        action: {
          label: ABSENCE_STEP_BAR_LABELS[next],
          event: "RECORD_ABSENCE_STEP",
          onClick: () => ctx.onAbsenceStep(next),
        },
      };
    return {
      key: "awol-return",
      title: "Record return",
      detail: `Every missing person step is recorded. Record the return when they are back.`,
      tone: "neutral",
      action: { label: "Record return", event: "END_LEAVE_BED", onClick: ctx.onRecordReturn },
    };
  }
  if (mode === "ed" && admission?.awayAtEmergencyDepartmentSince != null) {
    return {
      key: "ed-return",
      title: "Record return from ED",
      detail: `At ED since ${formatInstantWithDay(admission.awayAtEmergencyDepartmentSince, now)}. The bed is held.`,
      tone: "warning",
      action: ctx.onReturnFromEd
        ? {
            label: "Record return",
            ariaLabel: "Record return from ED",
            event: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
            onClick: ctx.onReturnFromEd,
          }
        : undefined,
    };
  }
  return null;
}

/* ---------------- Stay progress ---------------- */

export type StayProgress = {
  /** Day of the stay, arrival day is Day 1. */
  day: number;
  /** The planned length in days, arrival to the expected date inclusive, or null with no date. */
  planned: number | null;
  /** "Day 7 of a planned 10", or "Day 7". */
  headline: string;
  /** "3 days to the expected date", "2 days past the expected date", or "No discharge date set". */
  note: string;
  past: boolean;
};

export function stayProgress(admission: Admission | undefined, now: Instant): StayProgress | null {
  if (!admission || admission.arrivedAt === null) return null;
  const day = stayDayNumber(daysInBed(admission, now));
  if (day === null) return null;
  const expected = admission.expectedDischargeAt;
  if (expected === null || !Number.isFinite(expected))
    return { day, planned: null, headline: `Day ${day}`, note: "No discharge date set", past: false };
  const planned = Math.max(1, daysBetween(admission.arrivedAt, expected) + 1);
  const past = isPastExpectedDischarge(admission, now);
  let note: string;
  if (past) {
    const daysPast = daysBetween(expected, now);
    note = daysPast >= 1 ? `${plural(daysPast, "day", "days")} past the expected date` : "Past the expected time today";
  } else {
    const remaining = dayOf(expected) - dayOf(now);
    note =
      remaining <= 0
        ? "Expected discharge today"
        : remaining === 1
          ? "Expected discharge tomorrow"
          : `${remaining} days to the expected date`;
  }
  return {
    day,
    planned,
    headline: past ? `Day ${day}, planned ${planned}` : `Day ${day} of a planned ${planned}`,
    note,
    past,
  };
}

/** A tel: address for a synthetic number, digits and a leading plus only. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/gu, "")}`;
}
