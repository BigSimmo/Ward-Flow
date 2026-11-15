/**
 * D-222 (choice 1): the History lines about one person, for their History tab. Every save writes a
 * line naming the desk that made it; this picks the person's: lines about their journeys, referrals
 * and stays. (Lines about the person record itself wait on a D-14 allowlist decision.) A desk other
 * than the coordinator sees accepted
 * lines only, with no before/after facts (`sharedHistoryLine`); refusals stay with the coordinator.
 * Pure.
 */
import { sharedHistoryLine, type AuditEvent } from "@/components/ward-management/ward-audit";
import {
  historyActorLabel,
  historyLineWording,
  type HistoryPlaceNames,
} from "@/components/ward-management/ward-history-lines";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WfTone } from "@/components/wf";

export type PatientHistoryLine = { at: number; tone: WfTone; text: string };

export type PatientHistoryLineInput = {
  events: readonly AuditEvent[];
  /** The coordinator sees every line, refusals too. */
  coordinator: boolean;
  movementIds: readonly string[];
  referralIds: readonly string[];
  admissionIds: readonly string[];
  places?: HistoryPlaceNames;
};

function aboutThisPerson(event: AuditEvent, input: PatientHistoryLineInput): boolean {
  const subject = event.subject;
  switch (subject.kind) {
    case "movement":
      return input.movementIds.includes(subject.movementId);
    case "referral":
      return input.referralIds.includes(subject.referralId);
    case "admission":
      return input.admissionIds.includes(subject.admissionId);
    default:
      return false;
  }
}

/** "What changed · desk", newest first. Each line has a time; a line with none is left out. */
export function patientHistoryLines(input: PatientHistoryLineInput): PatientHistoryLine[] {
  const lines: PatientHistoryLine[] = [];
  for (const event of input.events) {
    if (event.at === null || !aboutThisPerson(event, input)) continue;
    const line = input.coordinator ? event : sharedHistoryLine(event);
    if (line === null) continue;
    const facts = (line.details as { kind?: unknown; line?: unknown }).kind === "history-line" ? line.details : null;
    const what = historyLineWording(
      line.action as WardFlowEvent["type"],
      facts ? ((facts as { line: Parameters<typeof historyLineWording>[1] }).line ?? null) : null,
      input.places,
    );
    const refused = line.outcome === "accepted" ? "" : " (refused)";
    lines.push({
      at: event.at,
      tone: line.outcome === "accepted" ? "neutral" : "danger",
      text: `${what}${refused} · ${historyActorLabel(line.actor, input.places)}`,
    });
  }
  return lines.sort((a, b) => b.at - a.at);
}
