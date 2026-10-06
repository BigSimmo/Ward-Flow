import { clockState, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type {
  BedRelease,
  LeaveBed,
  Movement,
  MovementStage,
  Referral,
  Rejection,
  Unit,
} from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import {
  createPatientResolver,
  type PatientResolutionSubject,
} from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import { edPressure, type EdPressure } from "@/components/ward-management/ward-pressure";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

import type {
  WardActivityCategory,
  WardActivityContent,
  WardActivityKind,
  WardActivitySubject,
} from "./ward-shell-types";

export type WardActivityEventTone = "info" | "warning" | "danger";

const STAGE_PHRASE: Record<MovementStage, string> = {
  placement_requested: "placement requested",
  destination_review: "destination review",
  accepted_awaiting_bed: "accepted, awaiting a bed",
  pulled: "bed pulled",
  handover_ready: "handover ready",
  moving: "moving",
  arrived: "arrived",
};

type ActivityEvent = {
  at: Instant;
  id: string;
  text: string;
  tone: WardActivityEventTone;
  category: WardActivityCategory;
  kind: WardActivityKind;
  subject?: WardActivitySubject;
};

export type CommandActivity = {
  departments: EdPressure[];
  content: WardActivityContent;
  lastEventAt: Instant | undefined;
  tones: Readonly<Record<string, WardActivityEventTone>>;
};

export type CommandActivityInput = {
  movements: Movement[];
  units: Unit[];
  referrals: Referral[];
  rejections: Rejection[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  refreshRequests: { unitId: string; at: Instant; byRole: string }[];
  patients: Patient[];
  now: Instant;
};

function stagePhrase(stage: string): string {
  return STAGE_PHRASE[stage as MovementStage] ?? stage.replaceAll("_", " ");
}

function sentenceCase(value: string): string {
  const text = value.replaceAll("_", " ");
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Command has no append-only event stream. Its Activity feed therefore reads the timestamped
 * records the reducer already keeps and says so in the UI. This is a projection of current
 * synthetic state, not a claim that a provider is connected or that every transition is retained.
 */
export function deriveCommandActivity(input: CommandActivityInput): CommandActivity {
  const { movements, units, referrals, rejections, bedReleases, leaveBeds, refreshRequests, patients, now } = input;
  const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
  const departmentNames = new Map(allEmergencyDepartments().map((department) => [department.id, department.name]));
  const resolvePatient = createPatientResolver({ patients, referrals, movements });
  const person = (subject: PatientResolutionSubject): WardActivitySubject | undefined => {
    const resolved = resolvePatient(subject);
    if (!resolved.patient) return undefined;
    return { name: resolved.displayName, umrn: resolved.umrn };
  };
  const events: ActivityEvent[] = [];

  for (const movement of movements) {
    const department = departmentNames.get(movement.originEdId) ?? movement.originEdId;
    const who = person(movement);
    // The opening tier is whatever the FIRST recorded urgency change moved it FROM. An empty
    // `urgencyChanges` means the tier never changed, so the current tier was also the opening
    // one (ward-model.ts). Using `movement.urgency` here would print today's tier on an event
    // timestamped when the movement opened, which is wrong whenever urgency changed since.
    const openingUrgency = movement.urgencyChanges[0]?.from ?? movement.urgency;
    events.push({
      at: movement.openedAt,
      id: `movement-opened:${movement.id}`,
      text: `Opened at ${department}, Tier ${openingUrgency}.`,
      tone: "info",
      category: "other",
      kind: "opened",
      subject: who,
    });

    movement.urgencyChanges.forEach((change, index) => {
      events.push({
        at: change.at,
        id: `urgency-change:${movement.id}:${change.at}:${index}`,
        text: `Urgency changed from Tier ${change.from} to Tier ${change.to}.`,
        tone: "info",
        category: "other",
        kind: "urgency",
        subject: who,
      });
    });

    const dueAt = movement.legalForm?.dueAt;
    if (dueAt !== undefined && clockState(dueAt, now) === "breached") {
      events.push({
        at: dueAt,
        id: `legal-deadline:${movement.id}:${dueAt}`,
        text: `Passed its recorded legal deadline at ${department}.`,
        tone: "danger",
        category: "other",
        kind: "deadline",
        subject: who,
      });
    }

    movement.declines.forEach((decline, index) => {
      events.push({
        at: decline.at,
        id: `decline:${movement.id}:${decline.unitId}:${decline.at}:${index}`,
        text: `${unitNames.get(decline.unitId) ?? decline.unitId} declined. ${sentenceCase(decline.reason)}.`,
        tone: "warning",
        category: "decline",
        kind: "decline",
        subject: who,
      });
    });

    if (movement.escalation) {
      events.push({
        at: movement.escalation.at,
        id: `escalation:${movement.id}:${movement.escalation.at}`,
        text: `Escalated to ${movement.escalation.contact}.`,
        tone: "warning",
        category: "escalation",
        kind: "escalation",
        subject: who,
      });
    }

    movement.overrides.forEach((override, index) => {
      const destinations = override.unitIds.map((unitId) => unitNames.get(unitId) ?? unitId).join(", ");
      events.push({
        at: override.at,
        id: `override:${movement.id}:${override.at}:${index}`,
        text: `Override recorded${destinations ? ` for ${destinations}` : ""}.`,
        tone: "warning",
        category: "other",
        kind: "override",
        subject: who,
      });
    });

    movement.stageChanges.forEach((change, index) => {
      events.push({
        at: change.at,
        id: `stage:${movement.id}:${change.at}:${index}`,
        text: `Moved to ${stagePhrase(change.to)}.`,
        tone: "info",
        category: "transfer",
        kind: "transfer",
        subject: who,
      });
    });
  }

  for (const referral of referrals) {
    const who = person(referral);
    events.push({
      at: referral.raisedAt,
      id: `referral-raised:${referral.id}`,
      text: `Referral raised. ${referral.ageBand}, ${referral.homeRegion}.`,
      tone: "info",
      category: "referral",
      kind: "referral",
      subject: who,
    });
    if (referral.triagedAt !== undefined) {
      events.push({
        at: referral.triagedAt,
        id: `referral-triaged:${referral.id}:${referral.triagedAt}`,
        text: "Referral triaged.",
        tone: "info",
        category: "referral",
        kind: "referral",
        subject: who,
      });
    }
  }

  for (const rejection of rejections) {
    events.push({
      at: rejection.at,
      id: `rejection:${rejection.id}`,
      text: `${sentenceCase(rejection.attempted)} was refused. ${rejection.reason}`,
      tone: "danger",
      category: "other",
      kind: "refused",
      subject: person({ movementId: rejection.movementId }),
    });
  }

  refreshRequests.forEach((request, index) => {
    events.push({
      at: request.at,
      id: `capacity-refresh:${request.unitId}:${request.at}:${index}`,
      text: `Capacity refresh requested from ${unitNames.get(request.unitId) ?? request.unitId} by ${request.byRole}.`,
      tone: "info",
      category: "other",
      kind: "capacity",
    });
  });

  const ordered = events.filter((event) => event.at <= now).sort((left, right) => right.at - left.at);
  const counts = wardNavCounts({ movements, units, referrals, bedReleases, leaveBeds, now });
  const openMovements = counts.movements?.value ?? movements.filter(isOpen).length;
  const queuedReferrals = counts.referrals?.value ?? 0;
  const bedsReady = counts.capacity?.value ?? 0;
  const urgentDelays = counts.delays?.value ?? 0;
  const shown = ordered.slice(0, 20);

  return {
    departments: edPressure(now, movements),
    content: {
      pageTitle: "Command",
      tiles: [
        { label: "Open movements", value: String(openMovements) },
        { label: "Beds ready", value: String(bedsReady), tone: bedsReady > 0 ? "good" : "warning" },
        { label: "Queued referrals", value: String(queuedReferrals), tone: queuedReferrals > 0 ? "warning" : "good" },
        { label: "Urgent delays", value: String(urgentDelays), tone: urgentDelays > 0 ? "danger" : "good" },
      ],
      changes: shown.map((event) => ({
        id: event.id,
        time: formatInstantWithDay(event.at, now),
        text: event.text,
        category: event.category,
        kind: event.kind,
        subject: event.subject,
      })),
    },
    lastEventAt: ordered[0]?.at,
    tones: Object.fromEntries(shown.map((event) => [event.id, event.tone])),
  };
}
