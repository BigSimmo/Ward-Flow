"use client";

// The patient page's small shared pieces: the stage detail and transport legal-status readings, the
// record tab keys and the phone hero's clear-cells figure. Split out of `patient-now-screen.tsx` so
// the screen and its section files share them without importing one another.
import type { Movement } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";
import { type PatientStatusContext, buildPatientStatus } from "./patient-status-card";
import { STAGES, clock } from "./patient-now-records";
import { StatusGlyph } from "@/components/wf";
import styles from "./patient-now.module.css";

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
          ? "This stage comes before the current one. No stage change was recorded for it, so no time is shown."
          : "This movement has not reached this stage.",
    milestones: changes.map((change) => ({
      time: clock(change.at),
      label: "Stage recorded",
      detail: `Recorded by ${change.by}${change.reason ? `: ${change.reason}` : ""}.`,
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
 * v10 phone movement hero: how many of the "Cannot move" cells are clear. Its own component, so the
 * status context (whose clearance handler remembers its trigger in a ref) is read as a prop rather
 * than during the screen's render.
 */
export function PhoneClearFact({ mode, context }: { mode: PatientMode; context: PatientStatusContext }) {
  const status = buildPatientStatus(mode, context);
  const clear = status.cells.filter((cell) => cell.clear).length;
  return (
    <span className={styles.v6HeroFact}>
      <strong className={styles.v6HeroWait}>
        {clear} of {status.cells.length}
      </strong>
      <span className={styles.phFigLabel}>
        {clear < status.cells.length ? (
          <StatusGlyph tone={status.tone === "danger" ? "danger" : "warning"} size={9} />
        ) : null}
        Clear
      </span>
    </span>
  );
}
