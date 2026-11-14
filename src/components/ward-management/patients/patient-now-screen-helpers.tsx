"use client";

// The patient page's small shared pieces: the stage detail and transport legal-status readings, the
// record tab keys. Split out of `patient-now-screen.tsx` so
// the screen and its section files share them without importing one another.
import type { Movement } from "@/components/ward-management/ward-model";
import { recordedByWords } from "@/components/ward-management/ward-flow-roles";
import type { PatientMode } from "./patient-mode";
import { type PatientStatusContext, buildPatientStatus } from "./patient-status-card";
import { STAGES, clock } from "./patient-now-records";

/**
 * Ward, site and emergency-department names read from the one data layer (`ward-sites.ts`) that
 * owns them, rather than typed a second time here — `tests/ward-flow-data-boundary.test.ts` fails
 * closed on any file outside that layer stating one of these names as its own string literal.
 */
export interface StagePresentationDetail {
  statusText: string;
  badgeTone: "good" | "danger" | "warn" | "neutral" | "accent";
  summary: string;
  milestones: Array<{ time?: string; label: string; detail: string }>;
}

export function getStageBedflowDetail(stageId: string, liveMovement?: Movement): StagePresentationDetail {
  if (!liveMovement)
    return {
      statusText: "Not recorded",
      badgeTone: "neutral",
      summary: "No linked movement displayed.",
      milestones: [],
    };
  const changes = liveMovement.stageChanges.filter((change) => change.to === stageId);
  const current = liveMovement.stage === stageId;
  const stageIndex = STAGES.findIndex((stage) => stage.id === stageId);
  const currentIndex = STAGES.findIndex((stage) => stage.id === liveMovement.stage);
  // A stage before the current one with no recorded change is placed, never marked complete: no
  // transition or time is inferred.
  const earlier = !current && stageIndex >= 0 && currentIndex >= 0 && stageIndex < currentIndex;
  return {
    statusText: current
      ? "Current stage"
      : changes.length
        ? "Recorded"
        : earlier
          ? "No time recorded"
          : "Not reached yet",
    badgeTone: current ? "accent" : "neutral",
    summary: current
      ? `Current movement stage: ${STAGES.find((stage) => stage.id === stageId)?.label ?? stageId}.`
      : changes.length
        ? "Recorded stage changes for this stage."
        : earlier
          ? "Before the current stage."
          : "Not reached yet.",
    milestones: changes.map((change) => ({
      time: clock(change.at),
      label: "Stage recorded",
      detail: `Recorded by ${recordedByWords(change.by)}${change.reason ? `: ${change.reason}` : ""}.`,
    })),
  };
}

export function formatTransportLegalStatus(status?: string): string {
  if (!status) return "Not recorded";
  if (status === "involuntary") return "Involuntary";
  if (status === "voluntary") return "Voluntary";
  return status;
}

export type TabKey = "now" | "history" | "community" | "details" | "documents";

/**
 * R-MOVE-8 (REG2-6): the header's one movement figure after the wait. The stage rail is the page's
 * one progress count, so this says the ward ETA (when one exists) and the next step, never a count
 * that changes meaning between "clear to move" and "steps done".
 */
export function etaAndNext(
  mode: PatientMode,
  context: PatientStatusContext,
): { value: string; label: string; next: string } {
  const movement = context.movement;
  const job = movement?.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
  const etaAt = movement?.arrivalDetails?.estimatedArrivalAt ?? job?.estimatedAt;
  let next: string;
  if (job?.diversion !== undefined) {
    next = "review the bed";
  } else if (mode === "find") {
    next = "bed agreed";
  } else if (mode === "held") {
    const gate = buildPatientStatus(mode, context).cells.find((cell) => !cell.clear);
    next =
      gate === undefined
        ? "handover"
        : gate.key === "bed"
          ? "pull bed"
          : gate.key === "clearance"
            ? "clearance"
            : "transport booked";
  } else {
    next = job?.collectedAt === undefined ? "collection" : "arrival";
  }
  if (job?.diversion !== undefined || etaAt === undefined) return { value: next, label: "next step", next };
  return { value: clock(etaAt), label: `ward ETA · next: ${next}`, next };
}
