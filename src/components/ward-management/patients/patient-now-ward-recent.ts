// PT1 round 3: the facts behind Discharge readiness and Last 24 hours. Split from
// patient-now-ward.ts so they load with the lazily loaded ward cards, not with the page.
import type { Admission } from "@/components/ward-management/ward-admissions";
import { ABSENCE_STEP_LABELS, type LeaveBed, type Movement } from "@/components/ward-management/ward-model";
import { perthDayLabel, type Instant } from "@/components/ward-management/ward-clock";
import { observationSummary } from "@/components/ward-management/ward-observation";
import { recordExtrasFor } from "./patient-record-extras";
import type { Patient } from "@/components/ward-management/ward-patients";
/* ---------------- Discharge readiness ---------------- */

export type ReadinessRow = {
  key: "date" | "team" | "contact";
  done: boolean;
  label: string;
  detail: string;
};

/** Recorded facts as ticks, never a score: date confirmed, community team named, next contact booked. */
export function dischargeReadiness(
  admission: Admission | undefined,
  patient: Patient | undefined,
  dayZero: Date,
): ReadinessRow[] {
  const active = recordExtrasFor(patient?.id)?.community?.find((item) => item.status === "active");
  const team = patient?.catchmentCommunityTeam ?? active?.team;
  const expected = admission?.expectedDischargeAt ?? null;
  const confirmed = admission?.dischargeConfirmedAt != null;
  return [
    {
      key: "date",
      done: confirmed,
      label: confirmed ? "Date confirmed" : "Date not confirmed",
      detail:
        expected === null
          ? "No discharge date set"
          : confirmed
            ? `Confirmed for ${perthDayLabel(expected, dayZero)}`
            : `Expected ${perthDayLabel(expected, dayZero)}`,
    },
    {
      key: "team",
      done: Boolean(team),
      label: team ? "Community team named" : "No community team named",
      detail: team ?? "Not on the record",
    },
    {
      key: "contact",
      done: Boolean(active?.nextContact),
      label: active?.nextContact ? "Next contact booked" : "No next contact booked",
      detail: active?.nextContact ?? (active ? `None recorded by ${active.team}` : "No community care recorded"),
    },
  ];
}

/* ---------------- Last 24 hours ---------------- */

export type RecentEvent = { key: string; at: Instant; text: string };

/**
 * The newest recorded events for this stay in the last 24 hours, newest first, at most `limit`.
 * Read from recorded fields only: arrival, observation changes, leave and absence, ED, discharge
 * date moves and confirmation, and legal forms or status recorded on the stay's movement.
 */
export function recentStayEvents({
  admission,
  leaveBed,
  movement,
  patient,
  now,
  dayZero,
  withholdObservation = false,
  limit = 4,
}: {
  admission: Admission | undefined;
  leaveBed?: LeaveBed;
  movement?: Movement;
  patient?: Patient;
  now: Instant;
  dayZero: Date;
  withholdObservation?: boolean;
  limit?: number;
}): RecentEvent[] {
  const events: RecentEvent[] = [];
  const add = (key: string, at: Instant | null | undefined, text: string) => {
    if (at === null || at === undefined || !Number.isFinite(at)) return;
    if (at > now || at <= now - 1440) return;
    events.push({ key, at, text });
  };
  if (admission) {
    add("arrived", admission.arrivedAt, "Arrived on the ward");
    if (!withholdObservation)
      (admission.observationChanges ?? []).forEach((change, index) =>
        add(`obs-${index}`, change.at, `Observation changed to ${observationSummary(change.to)}`),
      );
    add("ed", admission.awayAtEmergencyDepartmentSince, "Gone to ED, bed held");
    if (admission.expectedDischargeAt !== null)
      add(
        "discharge-date",
        admission.dischargeDateSetAt,
        `${admission.dischargeDateMoves > 0 ? "Discharge date moved to" : "Discharge date set for"} ${perthDayLabel(
          admission.expectedDischargeAt,
          dayZero,
        )}`,
      );
    add("discharge-confirmed", admission.dischargeConfirmedAt, "Discharge date confirmed");
  }
  if (leaveBed && (!admission || leaveBed.admissionId === admission.id)) {
    add("leave", leaveBed.confirmedAt, leaveBed.kind === "medical_trip" ? "Left for a medical trip" : "Left on leave");
    if (leaveBed.absentWithoutLeave) {
      add("absent", leaveBed.absentWithoutLeave.since, "Marked absent");
      leaveBed.absentWithoutLeave.steps.forEach((entry) =>
        add(`step-${entry.step}`, entry.at, `${ABSENCE_STEP_LABELS[entry.step]}, recorded`),
      );
    }
  }
  if (movement) {
    movement.statusChanges.forEach((change, index) =>
      add(`status-${index}`, change.at, `Legal status recorded as ${change.to}`),
    );
    if (movement.legalForm) {
      add("form-received", movement.legalFormReceivedAt, `Form ${movement.legalForm.code} received`);
      const continued = movement.legalForm.continuedBy;
      if (continued) add("form-continued", continued.recordedAt, `Form ${continued.code} recorded`);
    }
  }
  const order = patient?.communityTreatmentOrder;
  if (order) add("cto", order.recordedAt, `Form ${order.form} recorded`);
  return events.sort((a, b) => b.at - a.at).slice(0, limit);
}
