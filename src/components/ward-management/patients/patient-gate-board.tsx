"use client";

import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";
import { Button, Card, CardHead, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import type { LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import {
  MINUTES_PER_DAY,
  type Instant,
  daysBetween,
  formatInstantWithDay,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import type { PatientNowRecord } from "./patient-now-records";
import styles from "./patient-gate-board.module.css";

/**
 * The Gate board (Josh, 9 Oct 2026). One record, nine modes, read from the engine in this order:
 * an open movement (finding a bed, bed held, in transit), then an occupied bed (absent without
 * leave, at an emergency department, on leave, on the ward), otherwise not active or on a community
 * treatment order. Now shows only what is true at this moment; the past lives in History.
 */
export type PatientMode = "finding" | "held" | "transit" | "ward" | "leave" | "away_ed" | "awol" | "inactive" | "cto";

export type ModeTone = WfTone | "dash";

export const PATIENT_MODES: Record<PatientMode, { label: string; tone: ModeTone; open: boolean }> = {
  finding: { label: "Finding a bed", tone: "warning", open: true },
  held: { label: "Bed held", tone: "info", open: true },
  transit: { label: "In transit", tone: "info", open: true },
  ward: { label: "On ward", tone: "success", open: true },
  leave: { label: "On leave", tone: "neutral", open: true },
  away_ed: { label: "At ED", tone: "warning", open: true },
  awol: { label: "Absent without leave", tone: "danger", open: true },
  inactive: { label: "Not active", tone: "dash", open: false },
  cto: { label: "On a CTO", tone: "dash", open: false },
};

export type PatientNowTab = "now" | "history" | "community" | "details" | "documents";

export type GateContext = {
  mode: PatientMode;
  now: Instant;
  patient?: Patient;
  /** The open movement, only while it is in live bedflow. */
  movement?: Movement;
  /** The occupied bed, when there is one. */
  admission?: Admission;
  leaveBed?: LeaveBed;
  /** The most recent stay that has ended. */
  lastStay?: Admission;
  /** Every recorded stay for this person, newest first. */
  stays: Admission[];
  units: readonly Unit[];
  originName?: string;
  record: PatientNowRecord;
};

export type GateActions = {
  openPlacement: () => void;
  openClearance: (event: MouseEvent<HTMLButtonElement>) => void;
  openArrivalTime: () => void;
  openUploadForms: () => void;
  openTab: (tab: PatientNowTab) => void;
};

const CTO_PATTERN = /community treatment order/iu;

export function isOnCommunityTreatmentOrder(patient?: Patient): boolean {
  return CTO_PATTERN.test(patient?.legalStatus ?? "");
}

export function buildGateContext({
  patient,
  movement,
  isLiveBedflow,
  liveAdmission,
  admissions,
  leaveBeds,
  units,
  now,
  originName,
  record,
}: {
  patient?: Patient;
  movement?: Movement;
  isLiveBedflow: boolean;
  liveAdmission?: Admission;
  admissions: readonly Admission[];
  leaveBeds: readonly LeaveBed[];
  units: readonly Unit[];
  now: Instant;
  originName?: string;
  record: PatientNowRecord;
}): GateContext {
  const mine = (admission: Admission) =>
    (patient !== undefined && admission.patientId === patient.id) ||
    (movement !== undefined && (admission.movementId === movement.id || admission.id === movement.admissionId));
  const stays = admissions
    .filter(mine)
    .slice()
    .sort((a, b) => (b.leftAt ?? b.arrivedAt ?? 0) - (a.leftAt ?? a.arrivedAt ?? 0));
  const base = { now, patient, units, originName, record, stays };
  const lastStay = stays
    .filter((admission) => admission.state === "departed" && admission.leftAt !== null)
    .sort((a, b) => (b.leftAt ?? 0) - (a.leftAt ?? 0))[0];

  if (movement && isLiveBedflow) {
    const mode: PatientMode =
      movement.stage === "placement_requested" || movement.stage === "destination_review"
        ? "finding"
        : movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled"
          ? "held"
          : "transit";
    return { ...base, mode, movement, lastStay };
  }

  const admission =
    liveAdmission?.state === "occupied"
      ? liveAdmission
      : admissions.find((candidate) => candidate.state === "occupied" && mine(candidate));
  if (admission) {
    const leaveBed = leaveBeds.find((bed) => bed.admissionId === admission.id);
    const mode: PatientMode =
      admission.absentWithoutLeaveSince !== null
        ? "awol"
        : admission.awayAtEmergencyDepartmentSince !== null
          ? "away_ed"
          : leaveBed
            ? "leave"
            : "ward";
    return { ...base, mode, admission, leaveBed, lastStay };
  }

  return { ...base, mode: isOnCommunityTreatmentOrder(patient) ? "cto" : "inactive", lastStay };
}

/* ---------------------------------------------------------------- shared pieces */

function unitName(ctx: GateContext, id?: string): string | undefined {
  return id ? ctx.units.find((unit) => unit.id === id)?.name : undefined;
}

function when(ctx: GateContext, instant?: Instant | null): string | undefined {
  return instant === undefined || instant === null ? undefined : formatInstantWithDay(instant, ctx.now);
}

export function ModeGlyph({ tone, size = 10 }: { tone: ModeTone; size?: number }) {
  if (tone === "dash") return <span className={styles.dash} aria-hidden="true" />;
  return <StatusGlyph tone={tone} size={size} />;
}

/** The state pill beside the name. */
export function PatientStatePill({ mode, quiet }: { mode: PatientMode; quiet?: boolean }) {
  const meta = PATIENT_MODES[mode];
  return (
    <span className={cx(styles.statePill, quiet && styles.statePillQuiet)} data-testid="ward-patient-state-pill">
      <ModeGlyph tone={meta.tone} size={9} />
      {meta.label}
    </span>
  );
}

/** Remembers the rejection count before a dispatch so the card can say when the engine refused. */
function useAttempt() {
  const { rejections } = useWardFlow();
  const [startedAt, setStartedAt] = useState<number>();
  const refusal = startedAt === undefined ? undefined : rejections.slice(startedAt).at(-1)?.reason;
  return {
    begin: () => setStartedAt(rejections.length),
    refusal,
  };
}

type GateCell = {
  key: string;
  label: string;
  owner?: string;
  tone: WfTone;
  value: ReactNode;
  sub?: ReactNode;
  time?: string;
  action?: ReactNode;
};

type GateStep = { key: string; label: string; detail?: string; done?: boolean; action?: ReactNode };

type GateStatus = {
  tone: WfTone;
  title: string;
  /** Gates cleared out of the total, for the meter. */
  meter?: { cleared: number; total: number; label: string };
  cells?: GateCell[];
  steps?: GateStep[];
};

function clearanceCell(ctx: GateContext, movement: Movement, actions: GateActions): GateCell {
  const clearance = movement.medicalClearance;
  return {
    key: "clearance",
    label: "Medical clearance",
    owner: "ED team",
    tone: clearance ? (clearance.cleared ? "success" : "danger") : "neutral",
    value: clearance ? (clearance.cleared ? "Cleared" : "Not cleared") : "Not recorded",
    time: when(ctx, clearance?.at),
    action:
      clearance?.cleared === true ? undefined : (
        <Button size="sm" onClick={actions.openClearance}>
          Record
        </Button>
      ),
  };
}

function legalCell(ctx: GateContext, movement: Movement, actions: GateActions): GateCell {
  const form = movement.legalForm;
  const received = movement.legalFormReceivedAt;
  return {
    key: "legal",
    label: "Legal paperwork",
    owner: "ED team",
    tone: form ? (received !== undefined ? "success" : "warning") : "neutral",
    value: form ? legalFormName(form) : (movement.legalStatus ?? "Not recorded"),
    sub: form ? (received !== undefined ? "Original received" : "Original not received") : "No form recorded",
    time: when(ctx, received),
    action: (
      <Button size="sm" variant="ghost" onClick={() => actions.openTab("documents")}>
        Forms
      </Button>
    ),
  };
}

function transportJob(movement: Movement) {
  const job = movement.transport;
  return job && job.cancelledAt === undefined ? job : undefined;
}

function noTransportNeeded(movement: Movement): boolean {
  return movement.transportNeed?.needed === false && !transportJob(movement);
}

function arrivalEta(movement: Movement): Instant | undefined {
  return movement.arrivalDetails?.estimatedArrivalAt ?? transportJob(movement)?.estimatedAt;
}

export function isArrivalOverdue(movement: Movement, now: Instant): boolean {
  const eta = movement.arrivalDetails?.estimatedArrivalAt;
  return eta !== undefined && now > eta + LATE_ARRIVAL_GRACE_MINUTES && movement.stage !== "arrived";
}

/* ---------------------------------------------------------------- status per mode */

function useGateStatus(ctx: GateContext, actions: GateActions, begin: () => void): GateStatus {
  const { dispatch } = useWardFlow();
  const { now } = ctx;
  const movement = ctx.movement;
  const admission = ctx.admission;

  if (ctx.mode === "finding" && movement) {
    const asked = movement.referredUnitIds.length;
    const declined = movement.declines.filter((decline) => movement.referredUnitIds.includes(decline.unitId)).length;
    const waiting = Math.max(0, asked - declined);
    const bed: GateCell = {
      key: "bed",
      label: "Bed",
      owner: "Bed desk",
      tone: asked === 0 || waiting === 0 ? "danger" : "neutral",
      value:
        asked === 0
          ? "No ward asked"
          : waiting === 0
            ? "Every ward declined"
            : `${waiting} ward${waiting === 1 ? "" : "s"} deciding`,
      sub: asked === 0 ? "Shortlist the wards that fit" : `${asked} asked, ${declined} declined`,
      time: when(ctx, movement.referredAt),
      action: (
        <Button size="sm" onClick={actions.openPlacement}>
          Shortlist
        </Button>
      ),
    };
    const clearance = clearanceCell(ctx, movement, actions);
    const legal = legalCell(ctx, movement, actions);
    const cleared = [false, clearance.tone === "success", legal.tone === "success"].filter(Boolean).length;
    return {
      tone: "danger",
      title: "Cannot move yet",
      meter: { cleared, total: 3, label: `${cleared} of 3 cleared` },
      cells: [bed, clearance, legal],
    };
  }

  if (ctx.mode === "held" && movement) {
    const ward = unitName(ctx, movement.acceptedUnitId) ?? "Receiving ward";
    const pulled = movement.stage === "pulled";
    const expired = pulled && movement.pullExpiresAt !== undefined && now >= movement.pullExpiresAt;
    const pulledAt = movement.stageChanges.filter((change) => change.to === "pulled").at(-1)?.at;
    const bed: GateCell = pulled
      ? {
          key: "bed",
          label: "Bed",
          owner: ward,
          tone: expired ? "danger" : "success",
          value: `Held at ${ward}`,
          sub:
            movement.pullExpiresAt !== undefined
              ? `Hold ${pullHoldRemainingLabel(movement.pullExpiresAt, now)}`
              : "Hold time not recorded",
          time: when(ctx, pulledAt),
        }
      : {
          key: "bed",
          label: "Bed",
          owner: ward,
          tone: "warning",
          value: `Accepted by ${ward}`,
          sub: "Bed not pulled yet",
          time: when(ctx, movement.acceptedAt),
          action: movement.acceptedUnitId ? (
            <Button
              size="sm"
              onClick={() => {
                begin();
                dispatch({
                  type: "PULL_PATIENT",
                  role: "coordinator",
                  now,
                  movementId: movement.id,
                  unitId: movement.acceptedUnitId!,
                });
              }}
            >
              Pull bed
            </Button>
          ) : undefined,
        };
    const clearance = clearanceCell(ctx, movement, actions);
    const job = transportJob(movement);
    const transport: GateCell = noTransportNeeded(movement)
      ? { key: "transport", label: "Transport", owner: "ED team", tone: "success", value: "Not needed" }
      : job
        ? {
            key: "transport",
            label: "Transport",
            owner: "ED team",
            tone: "success",
            value: job.provider,
            sub:
              [
                job.cadNumber ? `CAD ${job.cadNumber}` : undefined,
                job.estimatedAt !== undefined ? `ETA ${when(ctx, job.estimatedAt)}` : undefined,
              ]
                .filter(Boolean)
                .join(" · ") || "Booked",
            action: pulled ? (
              <Button
                size="sm"
                onClick={() => {
                  begin();
                  dispatch({ type: "HANDOVER_READY", role: "ed", now, movementId: movement.id });
                }}
              >
                Handover ready
              </Button>
            ) : undefined,
          }
        : {
            key: "transport",
            label: "Transport",
            owner: "ED team",
            tone: pulled ? "danger" : "neutral",
            value: "Not booked",
            sub: pulled ? "Phone the provider, then log it" : "Book once the bed is pulled",
            action: pulled ? (
              <Button size="sm" onClick={actions.openPlacement}>
                Log booking
              </Button>
            ) : undefined,
          };
    const cleared = [pulled && !expired, clearance.tone === "success", transport.tone === "success"].filter(
      Boolean,
    ).length;
    return {
      tone: cleared === 3 ? "success" : expired ? "danger" : "warning",
      title: expired ? "Bed hold has run out" : cleared === 3 ? "Ready for handover" : "Bed held, not ready to move",
      meter: { cleared, total: 3, label: `${cleared} of 3 cleared` },
      cells: [bed, clearance, transport],
    };
  }

  if (ctx.mode === "transit" && movement) {
    const ward = unitName(ctx, movement.acceptedUnitId);
    const job = transportJob(movement);
    const moving = movement.stage === "moving";
    const overdue = isArrivalOverdue(movement, now);
    const eta = arrivalEta(movement);
    const next = !job
      ? undefined
      : moving
        ? undefined
        : job.acceptedAt === undefined
          ? { label: "Accepted", type: "TRANSPORT_ACCEPTED" as const }
          : job.enRouteAt === undefined
            ? { label: "En route", type: "TRANSPORT_EN_ROUTE" as const }
            : { label: "Collected", type: "PATIENT_COLLECTED" as const };
    const transport: GateCell = {
      key: "transport",
      label: "Transport",
      owner: job?.provider ?? "ED team",
      tone: moving ? "info" : "neutral",
      value: !job
        ? noTransportNeeded(movement)
          ? "Not needed"
          : "Not booked"
        : moving
          ? "Collected"
          : job.enRouteAt !== undefined
            ? "Vehicle en route"
            : job.acceptedAt !== undefined
              ? "Provider accepted"
              : "Waiting for provider",
      sub: movement.arrivalDetails?.trackingNumber ?? (job?.cadNumber ? `CAD ${job.cadNumber}` : undefined),
      time: when(ctx, job?.collectedAt ?? job?.enRouteAt ?? job?.acceptedAt),
      action: next ? (
        <Button
          size="sm"
          onClick={() => {
            begin();
            dispatch({ type: next.type, role: "officer", now, movementId: movement.id });
          }}
        >
          {next.label}
        </Button>
      ) : undefined,
    };
    const arrival: GateCell = {
      key: "arrival",
      label: "Arrival",
      owner: "ED team",
      tone: overdue ? "danger" : eta !== undefined ? "neutral" : "warning",
      value: eta !== undefined ? (when(ctx, eta) ?? "Not set") : "Not set",
      sub:
        overdue && eta !== undefined
          ? `${splitDuration(now - eta)} late`
          : eta !== undefined
            ? "Expected"
            : "No arrival time",
      action: (
        <Button size="sm" variant="ghost" onClick={actions.openArrivalTime}>
          Update
        </Button>
      ),
    };
    const canArrive = moving || noTransportNeeded(movement);
    const receiving: GateCell = {
      key: "ward",
      label: "Receiving ward",
      owner: ward,
      tone: "success",
      value: ward ?? "Not recorded",
      sub: "Bed held",
      action:
        canArrive && movement.acceptedUnitId ? (
          <Button
            size="sm"
            variant="pri"
            onClick={() => {
              begin();
              dispatch({
                type: "PATIENT_ARRIVED",
                role: "ward",
                now,
                movementId: movement.id,
                actingUnitId: movement.acceptedUnitId!,
              });
            }}
          >
            Record arrival
          </Button>
        ) : undefined,
    };
    const cleared = [true, moving, false].filter(Boolean).length;
    return {
      tone: overdue ? "danger" : "info",
      title: overdue ? "Arrival overdue" : moving ? "On the way" : "Waiting for collection",
      meter: { cleared, total: 3, label: `${cleared} of 3 cleared` },
      cells: [transport, arrival, receiving],
    };
  }

  if (admission && (ctx.mode === "ward" || ctx.mode === "leave" || ctx.mode === "away_ed" || ctx.mode === "awol")) {
    const ward = unitName(ctx, admission.unitId) ?? "Ward";
    const day = admission.arrivedAt !== null ? daysBetween(admission.arrivedAt, now) + 1 : undefined;

    if (ctx.mode === "awol") {
      const since = admission.absentWithoutLeaveSince ?? now;
      return {
        tone: "danger",
        title: `Absent without leave for ${splitDuration(Math.max(0, now - since))}`,
        steps: [
          { key: "recorded", label: "Recorded absent", detail: when(ctx, since), done: true },
          { key: "search", label: "Search the ward and grounds" },
          { key: "tell", label: "Tell the nurse in charge and the treating psychiatrist" },
          { key: "phone", label: "Phone the patient, then their carer or next of kin" },
          { key: "police", label: "Ask police to help if local policy requires it" },
          {
            key: "return",
            label: "Record return when they are back",
            action: (
              <Button
                size="sm"
                variant="pri"
                onClick={() => {
                  begin();
                  dispatch({
                    type: "RECORD_RETURNED_FROM_ABSENCE",
                    role: "ward",
                    now,
                    admissionId: admission.id,
                    actingUnitId: admission.unitId,
                  });
                }}
              >
                Record return
              </Button>
            ),
          },
        ],
      };
    }

    const bedHeld: GateCell = {
      key: "bed",
      label: "Bed",
      owner: ward,
      tone: "success",
      value: `Held at ${ward}`,
      sub: day !== undefined ? `Day ${day} of this stay` : undefined,
    };

    if (ctx.mode === "away_ed") {
      const since = admission.awayAtEmergencyDepartmentSince ?? now;
      return {
        tone: "warning",
        title: "At an emergency department",
        cells: [
          {
            key: "away",
            label: "Away since",
            owner: ward,
            tone: "warning",
            value: when(ctx, since) ?? "Not recorded",
            sub: `${splitDuration(Math.max(0, now - since))} away`,
          },
          bedHeld,
          {
            key: "return",
            label: "Return",
            owner: ward,
            tone: "neutral",
            value: "Not back yet",
            action: (
              <Button
                size="sm"
                variant="pri"
                onClick={() => {
                  begin();
                  dispatch({
                    type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
                    role: "ward",
                    now,
                    admissionId: admission.id,
                    actingUnitId: admission.unitId,
                  });
                }}
              >
                Record return
              </Button>
            ),
          },
        ],
      };
    }

    if (ctx.mode === "leave" && ctx.leaveBed) {
      const leave = ctx.leaveBed;
      const overdue = now > leave.expectedReturn;
      return {
        tone: overdue ? "danger" : "info",
        title: overdue ? "Not back from leave" : "On leave",
        cells: [
          {
            key: "leave",
            label: "Leave",
            owner: ward,
            tone: "neutral",
            value: leave.kind === "medical_trip" ? "Medical trip" : "Off-ward leave",
            sub: leave.openWarningAt !== undefined ? "Away over 24 hours" : undefined,
            time: `Left ${when(ctx, leave.confirmedAt)}`,
          },
          {
            key: "back",
            label: "Expected back",
            owner: ward,
            tone: overdue ? "danger" : "neutral",
            value: when(ctx, leave.expectedReturn) ?? "Not recorded",
            sub: overdue
              ? `${splitDuration(now - leave.expectedReturn)} overdue`
              : `${splitDuration(leave.expectedReturn - now)} to go`,
          },
          {
            ...bedHeld,
            action: (
              <Button
                size="sm"
                variant="pri"
                onClick={() => {
                  begin();
                  dispatch({
                    type: "END_LEAVE_BED",
                    role: "ward",
                    now,
                    leaveBedId: leave.id,
                    actingUnitId: leave.unitId,
                  });
                }}
              >
                Record return
              </Button>
            ),
          },
        ],
      };
    }

    // On the ward.
    const expected = admission.expectedDischargeAt;
    const confirmed = admission.dischargeConfirmedAt !== null;
    const barrier = admission.blockReason ?? admission.dischargeBarrier ?? null;
    const followUp = admission.followUp;
    const steps = [expected !== null, confirmed, followUp?.state === "arranged"];
    const cleared = steps.filter(Boolean).length;
    return {
      tone: "success",
      title: day !== undefined ? `On the ward, day ${day}` : "On the ward",
      meter: { cleared, total: 3, label: `${cleared} of 3 discharge steps` },
      cells: [
        {
          key: "ward",
          label: "Ward",
          owner: ward,
          tone: "success",
          value: ward,
          sub: admission.specialling ? "1:1 specialling" : admission.highAcuity ? "High acuity" : undefined,
          time: admission.arrivedAt !== null ? `Arrived ${when(ctx, admission.arrivedAt)}` : undefined,
        },
        {
          key: "discharge",
          label: "Expected discharge",
          owner: ward,
          tone: confirmed ? "success" : barrier ? "warning" : expected !== null ? "neutral" : "neutral",
          value: expected !== null ? (when(ctx, expected) ?? "Not set") : "Not set",
          sub: confirmed
            ? "Confirmed"
            : (barrier ??
              (admission.dischargeDateMoves > 0 ? `Moved ${admission.dischargeDateMoves} times` : undefined)),
        },
        {
          key: "followup",
          label: "Follow-up",
          owner: "Community team",
          tone: followUp ? (followUp.state === "arranged" ? "success" : "warning") : "neutral",
          value: followUp ? (followUp.state === "arranged" ? "Arranged" : "Not arranged") : "Not recorded",
          time: when(ctx, followUp?.recordedAt),
          action: (
            <Link href="/mockups/ward-flow/discharges" className={buttonClass({ size: "sm", variant: "ghost" })}>
              Discharges
            </Link>
          ),
        },
      ],
    };
  }

  // Not active, or on a community treatment order.
  const stay = ctx.lastStay;
  const stayWard = unitName(ctx, stay?.unitId);
  const destination = stay?.leavingDestination
    ? LEAVING_DESTINATIONS.find((item) => item.id === stay.leavingDestination)?.label
    : undefined;
  const daysOut = stay?.leftAt !== null && stay?.leftAt !== undefined ? daysBetween(stay.leftAt, now) : undefined;
  const inFollowUpWindow = daysOut !== undefined && daysOut < 7;
  const followUp = stay?.followUp;
  const cells: GateCell[] = [
    {
      key: "stay",
      label: "Last stay",
      tone: "neutral",
      value: stayWard ?? "None recorded",
      sub: destination,
      time: stay?.leftAt !== null && stay?.leftAt !== undefined ? `Left ${when(ctx, stay.leftAt)}` : undefined,
    },
    {
      key: "followup",
      label: "7-day follow-up",
      owner: "Community team",
      tone: !inFollowUpWindow
        ? "neutral"
        : followUp?.state === "arranged"
          ? "success"
          : followUp
            ? "danger"
            : "warning",
      value: !inFollowUpWindow
        ? "Not due"
        : followUp
          ? followUp.state === "arranged"
            ? "Arranged"
            : "Not arranged"
          : "Not recorded",
      sub: inFollowUpWindow ? `Day ${daysOut + 1} of 7 after discharge` : undefined,
      action: inFollowUpWindow ? (
        <Link href="/mockups/ward-flow/discharges" className={buttonClass({ size: "sm", variant: "ghost" })}>
          Discharges
        </Link>
      ) : undefined,
    },
    ctx.mode === "cto"
      ? {
          key: "legal",
          label: "Legal status",
          owner: ctx.patient?.catchmentCommunityTeam,
          tone: "neutral",
          value: "Community treatment order",
          sub: "Recorded status",
        }
      : {
          key: "team",
          label: "Community team",
          tone: "neutral",
          value: ctx.patient?.catchmentCommunityTeam ?? "Not recorded",
          sub: "Recorded catchment",
        },
  ];
  return {
    tone: "neutral",
    title: ctx.mode === "cto" ? "On a community treatment order" : "No open referral or bed",
    cells,
  };
}

/** The status card: the verdict, the gates meter and three cells, or the AWOL steps. */
export function PatientStatusCard({ ctx, actions }: { ctx: GateContext; actions: GateActions }) {
  const { begin, refusal } = useAttempt();
  const status = useGateStatus(ctx, actions, begin);
  const quiet = !PATIENT_MODES[ctx.mode].open;
  return (
    <Card
      className={cx(styles.statusCard, quiet && styles.statusCardQuiet)}
      aria-label="Current status"
      data-testid="ward-patient-status-card"
      data-mode={ctx.mode}
    >
      <div className={styles.statusHead}>
        <span className={styles.verdict}>
          <ModeGlyph tone={quiet ? "dash" : status.tone} size={12} />
          {status.title}
        </span>
        {status.meter ? (
          <span className={styles.meterWrap}>
            <span className={styles.meter} aria-hidden="true">
              {Array.from({ length: status.meter.total }, (_, index) => (
                <i key={index} data-on={index < status.meter!.cleared} />
              ))}
            </span>
            <span className={styles.meterLabel}>{status.meter.label}</span>
          </span>
        ) : null}
      </div>
      {status.cells ? (
        <div className={styles.cells}>
          {status.cells.map((cell) => (
            <div key={cell.key} className={styles.cell} data-cell={cell.key}>
              <span className={styles.cellLabel}>
                {cell.label}
                {cell.owner ? <span className={styles.cellOwner}>{cell.owner}</span> : null}
              </span>
              <strong className={styles.cellValue}>
                <StatusGlyph tone={cell.tone} size={10} />
                <span>{cell.value}</span>
              </strong>
              {cell.sub ? <span className={styles.cellSub}>{cell.sub}</span> : null}
              {cell.time ? <span className={styles.cellTime}>{cell.time}</span> : null}
              {cell.action ? <span className={styles.cellAction}>{cell.action}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {status.steps ? (
        <ol className={styles.steps}>
          {status.steps.map((step, index) => (
            <li key={step.key} className={styles.step} data-done={step.done ?? false}>
              <span className={styles.stepMark} aria-hidden="true">
                {step.done ? <StatusGlyph tone="success" size={10} /> : index + 1}
              </span>
              <span className={styles.stepText}>
                {step.label}
                {step.detail ? <span className={styles.cellTime}>{step.detail}</span> : null}
              </span>
              {step.action ?? null}
            </li>
          ))}
        </ol>
      ) : null}
      {refusal ? (
        <p className={styles.refusal} role="alert">
          Not recorded: {refusal}
        </p>
      ) : null}
    </Card>
  );
}

/* ---------------------------------------------------------------- Now cards */

function WardsAskedCard({ ctx, movement, actions }: { ctx: GateContext; movement: Movement; actions: GateActions }) {
  const rows = movement.referredUnitIds.map((unitId) => {
    const decline = movement.declines.filter((item) => item.unitId === unitId).at(-1);
    const accepted = movement.acceptedUnitId === unitId;
    const waitlisted = movement.waitlistedUnitIds?.includes(unitId) ?? false;
    return {
      unitId,
      name: unitName(ctx, unitId) ?? "Ward not recorded",
      tone: (accepted ? "success" : decline ? "closed" : waitlisted ? "warning" : "neutral") as WfTone,
      outcome: accepted
        ? "Accepted"
        : decline
          ? `Declined, ${declineReasonLabels[decline.reason].toLowerCase()}`
          : waitlisted
            ? "Waitlisted"
            : "Deciding",
      time: decline ? when(ctx, decline.at) : undefined,
    };
  });
  return (
    <Card className={styles.nowCard} aria-labelledby="gate-wards-asked">
      <CardHead id="gate-wards-asked" title="Wards asked" meta={rows.length > 0 ? `${rows.length}` : undefined} />
      {rows.length > 0 ? (
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.unitId} className={styles.row}>
              <StatusGlyph tone={row.tone} size={10} />
              <span className={styles.rowMain}>{row.name}</span>
              <span className={styles.rowValue}>{row.outcome}</span>
              <span className={styles.rowTime}>{row.time ?? ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <span>No ward asked yet</span>
          <Button size="sm" onClick={actions.openPlacement}>
            Open shortlist
          </Button>
        </div>
      )}
      {movement.escalation ? (
        <div className={styles.cardFoot}>
          <StatusGlyph tone="warning" size={10} />
          <span>
            Escalated to {movement.escalation.contact} {when(ctx, movement.escalation.at)}
          </span>
        </div>
      ) : null}
    </Card>
  );
}

function BeforeCollectionCard({ ctx, movement }: { ctx: GateContext; movement: Movement }) {
  const job = transportJob(movement);
  const items: Array<{ key: string; label: string; done: boolean; value: string }> = [
    {
      key: "pulled",
      label: "Bed pulled",
      done: movement.stage === "pulled",
      value: movement.stage === "pulled" ? (unitName(ctx, movement.acceptedUnitId) ?? "Held") : "Not yet",
    },
    {
      key: "form",
      label: "Original legal form received",
      done: movement.legalFormReceivedAt !== undefined,
      value:
        movement.legalFormReceivedAt !== undefined
          ? (when(ctx, movement.legalFormReceivedAt) ?? "")
          : movement.legalForm
            ? "Not received"
            : "No form recorded",
    },
    {
      key: "transport",
      label: "Transport booked",
      done: Boolean(job) || noTransportNeeded(movement),
      value: job ? job.provider : noTransportNeeded(movement) ? "Not needed" : "Not booked",
    },
    {
      key: "arrival",
      label: "Arrival time set",
      done: movement.arrivalDetails !== undefined,
      value: movement.arrivalDetails
        ? [when(ctx, movement.arrivalDetails.estimatedArrivalAt), movement.arrivalDetails.trackingNumber]
            .filter(Boolean)
            .join(" · ")
        : "Not set",
    },
    {
      key: "documents",
      label: "Transport documents",
      done: (movement.uploadedForms?.length ?? 0) > 0,
      value: (movement.uploadedForms?.length ?? 0) > 0 ? `${movement.uploadedForms!.length} recorded` : "None recorded",
    },
  ];
  const done = items.filter((item) => item.done).length;
  return (
    <Card className={styles.nowCard} aria-labelledby="gate-before-collection">
      <CardHead id="gate-before-collection" title="Before collection" meta={`${done} of ${items.length}`} />
      <ul className={styles.rows}>
        {items.map((item) => (
          <li key={item.key} className={styles.row}>
            <StatusGlyph tone={item.done ? "success" : "neutral"} size={10} />
            <span className={styles.rowMain}>{item.label}</span>
            <span className={styles.rowValue}>{item.value}</span>
            <span className={styles.rowTime} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function JourneyCard({ ctx, movement }: { ctx: GateContext; movement: Movement }) {
  const job = transportJob(movement);
  const eta = arrivalEta(movement);
  const overdue = isArrivalOverdue(movement, ctx.now);
  const points = [
    {
      key: "from",
      label: ctx.originName ?? "Sending site",
      detail: job?.collectedAt !== undefined ? `Collected ${when(ctx, job.collectedAt)}` : "Waiting",
      on: true,
    },
    {
      key: "now",
      label: movement.stage === "moving" ? "On the road" : "Waiting for collection",
      detail: job?.enRouteAt !== undefined ? `Vehicle left ${when(ctx, job.enRouteAt)}` : undefined,
      on: movement.stage === "moving",
    },
    {
      key: "to",
      label: unitName(ctx, movement.acceptedUnitId) ?? "Receiving ward",
      detail: eta !== undefined ? `${overdue ? "Was due" : "Due"} ${when(ctx, eta)}` : "No arrival time",
      on: false,
    },
  ];
  return (
    <Card className={styles.nowCard} aria-labelledby="gate-journey">
      <CardHead id="gate-journey" title="Journey" meta={overdue ? "Late" : undefined} />
      <ol className={styles.route}>
        {points.map((point) => (
          <li key={point.key} className={styles.routePoint} data-on={point.on}>
            <span className={styles.routeDot} aria-hidden="true" />
            <strong>{point.label}</strong>
            {point.detail ? <span>{point.detail}</span> : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

const DAY_OPTIONS = [
  { value: 0, label: "Today" },
  { value: 1, label: "Tomorrow" },
  { value: 2, label: "In 2 days" },
  { value: 3, label: "In 3 days" },
  { value: 7, label: "In 7 days" },
];

function timeAndDayToInstant(time: string, dayOffset: number, now: Instant): Instant | undefined {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(time.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY + dayOffset * MINUTES_PER_DAY + hours * 60 + minutes;
}

/** Leave, ED and AWOL, the three ways a person on the ward can be away from it. */
function AwayFromWardCard({ ctx, admission }: { ctx: GateContext; admission: Admission }) {
  const { dispatch } = useWardFlow();
  const { begin, refusal } = useAttempt();
  const [open, setOpen] = useState<"none" | "leave" | "discharge">("none");
  const [time, setTime] = useState("");
  const [day, setDay] = useState(0);
  const [kind, setKind] = useState<"off_ward" | "medical_trip">("off_ward");
  const parsed = timeAndDayToInstant(time, day, ctx.now);
  const valid = parsed !== undefined && (open !== "leave" || parsed > ctx.now);
  const actingUnitId = admission.unitId;
  return (
    <Card className={styles.nowCard} aria-labelledby="gate-away">
      <CardHead id="gate-away" title="Record a change" />
      <div className={styles.actionRow}>
        <Button size="sm" aria-pressed={open === "leave"} onClick={() => setOpen(open === "leave" ? "none" : "leave")}>
          Leave
        </Button>
        <Button
          size="sm"
          onClick={() => {
            begin();
            dispatch({
              type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
              role: "ward",
              now: ctx.now,
              admissionId: admission.id,
              actingUnitId,
            });
          }}
        >
          Gone to ED
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            begin();
            dispatch({
              type: "RECORD_ABSENT_WITHOUT_LEAVE",
              role: "ward",
              now: ctx.now,
              admissionId: admission.id,
              actingUnitId,
            });
          }}
        >
          Absent without leave
        </Button>
        <Button
          size="sm"
          aria-pressed={open === "discharge"}
          onClick={() => setOpen(open === "discharge" ? "none" : "discharge")}
        >
          Discharge date
        </Button>
      </div>
      {open !== "none" ? (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid || parsed === undefined) return;
            begin();
            if (open === "leave") {
              dispatch({
                type: "RECORD_LEAVE_BED",
                role: "ward",
                now: ctx.now,
                unitId: admission.unitId,
                actingUnitId,
                admissionId: admission.id,
                expectedReturn: parsed,
                kind,
              });
            } else {
              dispatch({
                type: "UPDATE_EXPECTED_DISCHARGE",
                role: "ward",
                now: ctx.now,
                admissionId: admission.id,
                expectedDischargeAt: parsed,
                actingUnitId,
              });
            }
            setOpen("none");
            setTime("");
          }}
        >
          {open === "leave" ? (
            <div className={styles.choiceRow} role="group" aria-label="Kind of leave">
              {(["off_ward", "medical_trip"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={styles.choice}
                  aria-pressed={kind === option}
                  onClick={() => setKind(option)}
                >
                  {option === "off_ward" ? "Off-ward leave" : "Medical trip"}
                </button>
              ))}
            </div>
          ) : null}
          <label className={styles.field}>
            <span>{open === "leave" ? "Expected back" : "Expected discharge"}</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              aria-label={open === "leave" ? "Expected back time" : "Expected discharge time"}
            />
          </label>
          <label className={styles.field}>
            <span>Day</span>
            <select value={day} onChange={(event) => setDay(Number(event.target.value))} aria-label="Day">
              {DAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm" variant="pri" disabled={!valid}>
            {open === "leave" ? "Record leave" : "Save date"}
          </Button>
        </form>
      ) : null}
      {refusal ? (
        <p className={styles.refusal} role="alert">
          Not recorded: {refusal}
        </p>
      ) : null}
    </Card>
  );
}

function DischargeCard({ ctx, admission }: { ctx: GateContext; admission: Admission }) {
  const destination = admission.leavingDestination
    ? LEAVING_DESTINATIONS.find((item) => item.id === admission.leavingDestination)?.label
    : undefined;
  const rows = [
    {
      key: "date",
      label: "Expected date",
      done: admission.expectedDischargeAt !== null,
      value: admission.expectedDischargeAt !== null ? (when(ctx, admission.expectedDischargeAt) ?? "") : "Not set",
    },
    {
      key: "confirmed",
      label: "Confirmed by the ward",
      done: admission.dischargeConfirmedAt !== null,
      value: admission.dischargeConfirmedAt !== null ? (when(ctx, admission.dischargeConfirmedAt) ?? "") : "Not yet",
    },
    {
      key: "barrier",
      label: "Barrier",
      done: !admission.blockReason && !admission.dischargeBarrier,
      value: admission.blockReason ?? admission.dischargeBarrier ?? "None recorded",
    },
    {
      key: "destination",
      label: "Going to",
      done: destination !== undefined,
      value: destination ?? "Not recorded",
    },
    {
      key: "followup",
      label: "Follow-up arranged",
      done: admission.followUp?.state === "arranged",
      value: admission.followUp
        ? admission.followUp.state === "arranged"
          ? "Arranged"
          : "Not arranged"
        : "Not recorded",
    },
  ];
  return (
    <Card className={styles.nowCard} aria-labelledby="gate-discharge">
      <CardHead
        id="gate-discharge"
        title="Discharge readiness"
        meta={`${rows.filter((row) => row.done).length} of ${rows.length}`}
      />
      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.key} className={styles.row}>
            <StatusGlyph tone={row.done ? "success" : row.key === "barrier" ? "warning" : "neutral"} size={10} />
            <span className={styles.rowMain}>{row.label}</span>
            <span className={styles.rowValue}>{row.value}</span>
            <span className={styles.rowTime} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function IfNotBackCard({ ctx }: { ctx: GateContext }) {
  const { dispatch } = useWardFlow();
  const { begin, refusal } = useAttempt();
  const leave = ctx.leaveBed;
  const admission = ctx.admission;
  if (!leave || !admission) return null;
  return (
    <Card className={styles.nowCard} aria-labelledby="gate-not-back">
      <CardHead id="gate-not-back" title="If not back on time" />
      <ol className={styles.plainSteps}>
        <li>Phone the patient, then their carer</li>
        <li>Tell the nurse in charge and the treating team</li>
        <li>Record them absent without leave and follow local policy</li>
      </ol>
      <div className={styles.cardFoot}>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            begin();
            dispatch({
              type: "END_LEAVE_BED",
              role: "ward",
              now: ctx.now,
              leaveBedId: leave.id,
              actingUnitId: leave.unitId,
            });
            dispatch({
              type: "RECORD_ABSENT_WITHOUT_LEAVE",
              role: "ward",
              now: ctx.now,
              admissionId: admission.id,
              actingUnitId: admission.unitId,
            });
          }}
        >
          Not returned, record absent
        </Button>
      </div>
      {refusal ? (
        <p className={styles.refusal} role="alert">
          Not recorded: {refusal}
        </p>
      ) : null}
    </Card>
  );
}

function NewReferralCard({ ctx }: { ctx: GateContext }) {
  const href = ctx.patient
    ? `/mockups/ward-flow/referrals/new?patientId=${encodeURIComponent(ctx.patient.id)}`
    : "/mockups/ward-flow/referrals/new";
  const rows = [
    { key: "who", label: "Patient", value: ctx.patient?.umrn ?? "Not recorded" },
    { key: "legal", label: "Legal status", value: ctx.patient?.legalStatus ?? "Not recorded" },
    { key: "team", label: "Community team", value: ctx.patient?.catchmentCommunityTeam ?? "Not recorded" },
    { key: "gp", label: "GP", value: ctx.patient?.generalPractitioner ?? "Not recorded" },
  ];
  return (
    <Card className={styles.nowCard} aria-labelledby="gate-new-referral">
      <CardHead id="gate-new-referral" title="New referral" meta="Carries these details" />
      <dl className={styles.facts}>
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.cardFoot}>
        <Link href={href} className={buttonClass({ size: "sm" })}>
          Start referral
        </Link>
      </div>
    </Card>
  );
}

/** The mode's own cards, in the Now tab's main column. */
export function PatientNowBoard({ ctx, actions }: { ctx: GateContext; actions: GateActions }) {
  const { movement, admission } = ctx;
  return (
    <div className={styles.board} data-testid="ward-patient-now-board" data-mode={ctx.mode}>
      {ctx.mode === "finding" && movement ? <WardsAskedCard ctx={ctx} movement={movement} actions={actions} /> : null}
      {ctx.mode === "held" && movement ? <BeforeCollectionCard ctx={ctx} movement={movement} /> : null}
      {ctx.mode === "transit" && movement ? <JourneyCard ctx={ctx} movement={movement} /> : null}
      {ctx.mode === "ward" && admission ? (
        <>
          <DischargeCard ctx={ctx} admission={admission} />
          <AwayFromWardCard ctx={ctx} admission={admission} />
        </>
      ) : null}
      {ctx.mode === "leave" ? <IfNotBackCard ctx={ctx} /> : null}
      {ctx.mode === "away_ed" ? (
        <Card className={styles.nowCard} aria-labelledby="gate-at-ed">
          <CardHead id="gate-at-ed" title="While they are at ED" />
          <ol className={styles.plainSteps}>
            <li>Phone the emergency department for an update each shift</li>
            <li>Keep the bed held unless the ward decides to release it</li>
            <li>Record the return as soon as they are back</li>
          </ol>
        </Card>
      ) : null}
      {ctx.mode === "inactive" || ctx.mode === "cto" ? <NewReferralCard ctx={ctx} /> : null}
    </div>
  );
}

/** The Now rail: legal authority in force, who to call and why they are here. */
export function PatientNowRail({ ctx, actions }: { ctx: GateContext; actions: GateActions }) {
  const { movement, patient, record } = ctx;
  const legalStatus = movement?.legalStatus ?? patient?.legalStatus ?? "Not recorded";
  const form = movement?.legalForm;
  const needs = movement
    ? [
        movement.security,
        movement.cohort,
        movement.specialling ? "1:1 specialling" : undefined,
        movement.highAcuity ? "High acuity" : undefined,
      ].filter((item): item is string => Boolean(item))
    : ctx.admission
      ? [
          ctx.admission.specialling ? "1:1 specialling" : undefined,
          ctx.admission.highAcuity ? "High acuity" : undefined,
        ].filter((item): item is string => Boolean(item))
      : [];
  return (
    <div className={styles.rail}>
      <Card className={styles.railCard} aria-labelledby="gate-legal-now">
        <CardHead
          id="gate-legal-now"
          title="Legal now"
          action={
            <Button size="sm" variant="ghost" onClick={() => actions.openTab("documents")}>
              Documents
            </Button>
          }
        />
        <dl className={styles.facts}>
          <div>
            <dt>Status</dt>
            <dd>{legalStatus}</dd>
          </div>
          {form ? (
            <div>
              <dt>Form in force</dt>
              <dd>
                {legalFormName(form)}
                {form.dueAt !== undefined ? <small>Typed due {when(ctx, form.dueAt)}</small> : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>
      <Card className={styles.railCard} aria-labelledby="gate-who-to-call">
        <CardHead id="gate-who-to-call" title="Who to call" />
        {record.ring.length > 0 ? (
          <ul className={styles.contacts}>
            {record.ring.map((contact, index) => (
              <li key={`${contact.who}-${index}`}>
                <strong>{contact.who}</strong>
                <span>{contact.role}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.railEmpty}>No contacts recorded</p>
        )}
      </Card>
      {PATIENT_MODES[ctx.mode].open ? (
        <Card className={styles.railCard} aria-labelledby="gate-why-here">
          <CardHead id="gate-why-here" title="Why they're here" />
          <p className={styles.reason}>{record.reason}</p>
          {needs.length > 0 ? (
            <ul className={styles.needs}>
              {needs.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

/** History: every recorded stay, read only. The past lives here, never on Now. */
export function PatientWardStays({ ctx }: { ctx: GateContext }) {
  if (ctx.stays.length === 0) return null;
  return (
    <Card className={styles.nowCard} aria-labelledby="gate-ward-stays" data-testid="ward-patient-ward-stays">
      <CardHead id="gate-ward-stays" title="Ward stays" meta={`${ctx.stays.length}`} />
      <ul className={styles.rows}>
        {ctx.stays.map((stay) => {
          const destination = stay.leavingDestination
            ? LEAVING_DESTINATIONS.find((item) => item.id === stay.leavingDestination)?.label
            : undefined;
          const open = stay.state !== "departed";
          return (
            <li key={stay.id} className={styles.row}>
              <StatusGlyph tone={open ? "success" : "closed"} size={10} />
              <span className={styles.rowMain}>{unitName(ctx, stay.unitId) ?? "Ward not recorded"}</span>
              <span className={styles.rowValue}>
                {open
                  ? stay.state === "occupied"
                    ? "Current stay"
                    : "Bed held"
                  : [
                      destination,
                      stay.followUp
                        ? stay.followUp.state === "arranged"
                          ? "follow-up arranged"
                          : "follow-up not arranged"
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Left"}
              </span>
              <span className={styles.rowTime}>
                {[when(ctx, stay.arrivedAt), when(ctx, stay.leftAt)].filter(Boolean).join(" to ")}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
