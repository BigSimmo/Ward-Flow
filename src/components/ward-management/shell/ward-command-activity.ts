import { clockState, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type {
  BedRelease,
  LeaveBed,
  Movement,
  Referral,
  Rejection,
  Unit,
} from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { edPressure, type EdPressure } from "@/components/ward-management/ward-pressure";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

import type { WardActivityCategory, WardActivityContent } from "./ward-shell-types";

export type WardActivityEventTone = "info" | "warning" | "danger";

type ActivityEvent = {
  at: Instant;
  id: string;
  text: string;
  tone: WardActivityEventTone;
  category: WardActivityCategory;
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
  now: Instant;
};

/**
 * Command has no append-only event stream. Its Activity feed therefore reads the timestamped
 * records the reducer already keeps and says so in the UI. This is a projection of current
 * synthetic state, not a claim that a provider is connected or that every transition is retained.
 */
export function deriveCommandActivity(input: CommandActivityInput): CommandActivity {
  const { movements, units, referrals, rejections, bedReleases, leaveBeds, refreshRequests, now } = input;
  const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
  const departmentNames = new Map(allEmergencyDepartments().map((department) => [department.id, department.name]));
  const events: ActivityEvent[] = [];

  for (const movement of movements) {
    const department = departmentNames.get(movement.originEdId) ?? movement.originEdId;
    // The opening tier is whatever the FIRST recorded urgency change moved it FROM. An empty
    // `urgencyChanges` means the tier never changed, so the current tier was also the opening
    // one (ward-model.ts). Using `movement.urgency` here would print today's tier on an event
    // timestamped when the movement opened, which is wrong whenever urgency changed since.
    const openingUrgency = movement.urgencyChanges[0]?.from ?? movement.urgency;
    events.push({
      at: movement.openedAt,
      id: `movement-opened:${movement.id}`,
      text: `${movement.id} opened at ${department}, Tier ${openingUrgency}.`,
      tone: "info",
      category: "other",
    });

    movement.urgencyChanges.forEach((change, index) => {
      events.push({
        at: change.at,
        id: `urgency-change:${movement.id}:${change.at}:${index}`,
        text: `${movement.id} urgency changed from Tier ${change.from} to Tier ${change.to}.`,
        tone: "info",
        category: "other",
      });
    });

    const dueAt = movement.legalForm?.dueAt;
    if (dueAt !== undefined && clockState(dueAt, now) === "breached") {
      events.push({
        at: dueAt,
        id: `legal-deadline:${movement.id}:${dueAt}`,
        text: `${movement.id} passed its recorded legal deadline at ${department}.`,
        tone: "danger",
        category: "other",
      });
    }

    movement.declines.forEach((decline, index) => {
      events.push({
        at: decline.at,
        id: `decline:${movement.id}:${decline.unitId}:${decline.at}:${index}`,
        text: `${unitNames.get(decline.unitId) ?? decline.unitId} declined ${movement.id}. ${decline.reason.replaceAll("_", " ")}.`,
        tone: "warning",
        category: "decline",
      });
    });

    if (movement.escalation) {
      events.push({
        at: movement.escalation.at,
        id: `escalation:${movement.id}:${movement.escalation.at}`,
        text: `${movement.id} escalated to ${movement.escalation.contact}.`,
        tone: "warning",
        category: "escalation",
      });
    }

    movement.overrides.forEach((override, index) => {
      const destinations = override.unitIds.map((unitId) => unitNames.get(unitId) ?? unitId).join(", ");
      events.push({
        at: override.at,
        id: `override:${movement.id}:${override.at}:${index}`,
        text: `Override recorded on ${movement.id}${destinations ? ` for ${destinations}` : ""}.`,
        tone: "warning",
        category: "other",
      });
    });

    movement.stageChanges.forEach((change, index) => {
      events.push({
        at: change.at,
        id: `stage:${movement.id}:${change.at}:${index}`,
        text: `${movement.id} moved to ${change.to.replaceAll("_", " ")}.`,
        tone: "info",
        category: "transfer",
      });
    });
  }

  for (const referral of referrals) {
    events.push({
      at: referral.raisedAt,
      id: `referral-raised:${referral.id}`,
      text: `${referral.id} referral raised. ${referral.ageBand}, ${referral.homeRegion}.`,
      tone: "info",
      category: "referral",
    });
    if (referral.triagedAt !== undefined) {
      events.push({
        at: referral.triagedAt,
        id: `referral-triaged:${referral.id}:${referral.triagedAt}`,
        text: `${referral.id} triaged.`,
        tone: "info",
        category: "referral",
      });
    }
  }

  for (const rejection of rejections) {
    events.push({
      at: rejection.at,
      id: `rejection:${rejection.id}`,
      text: `${rejection.movementId}: ${rejection.attempted} was refused. ${rejection.reason}`,
      tone: "danger",
      category: "other",
    });
  }

  refreshRequests.forEach((request, index) => {
    events.push({
      at: request.at,
      id: `capacity-refresh:${request.unitId}:${request.at}:${index}`,
      text: `Capacity refresh requested from ${unitNames.get(request.unitId) ?? request.unitId} by ${request.byRole}.`,
      tone: "info",
      category: "other",
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
      })),
    },
    lastEventAt: ordered[0]?.at,
    tones: Object.fromEntries(shown.map((event) => [event.id, event.tone])),
  };
}
