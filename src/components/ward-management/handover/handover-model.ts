/**
 * The handover sheet's rows, read from the engine (refined Handover A, 9 Oct 2026).
 *
 * One `HandoverRow` per open movement and one `HandoverWard` per ward. Every value is either a
 * recorded field or derived from one; nothing here is typed by hand. Patients are named by their
 * record and UMRN only (D-39), never by the journey id. Form times are the typed ones (D5): this
 * file never computes a legal time limit.
 */
import { durMinutes } from "@/components/wf";
import { formatInstantWithDay, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import { transportLeg } from "@/components/ward-management/ward-derivations";
import type { Patient } from "@/components/ward-management/ward-patients";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import type {
  BedRelease,
  HealthService,
  LegalStatus,
  Movement,
  MovementStage,
  Referral,
  Unit,
} from "@/components/ward-management/ward-model";
import { bedIsOccupied, daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import { edById } from "@/components/ward-management/ward-sites";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";

/* ------------------------------------------------------------------ shifts */

export type HandoverShiftId = "am" | "pm" | "ev";

/** The three handovers, at the starts of the app's shift pattern (07:00, 15:00, 23:00). */
export const HANDOVER_SHIFTS: readonly { id: HandoverShiftId; minute: number; label: string }[] = [
  { id: "am", minute: 7 * 60, label: "Night to day" },
  { id: "pm", minute: 15 * 60, label: "Day to evening" },
  { id: "ev", minute: 23 * 60, label: "Evening to night" },
];

export function handoverShift(id: HandoverShiftId) {
  return HANDOVER_SHIFTS.find((shift) => shift.id === id) ?? HANDOVER_SHIFTS[1]!;
}

const LAST_HANDOVER_MINUTE = HANDOVER_SHIFTS[HANDOVER_SHIFTS.length - 1]!.minute;

/**
 * The instant of a handover: today's, except that once the last one of the day has started the
 * morning handover means tomorrow's, so the next handover can still be chosen and signed.
 */
export function handoverAt(id: HandoverShiftId, now: Instant): Instant {
  const today = now - minuteOfDay(now) + handoverShift(id).minute;
  return id === "am" && minuteOfDay(now) >= LAST_HANDOVER_MINUTE ? today + 24 * 60 : today;
}

/** The next handover still to come, which after the last one of the day is tomorrow morning's. */
export function defaultHandoverShift(now: Instant): HandoverShiftId {
  return HANDOVER_SHIFTS.find((shift) => handoverAt(shift.id, now) > now)?.id ?? "am";
}

export function handoverHasPassed(id: HandoverShiftId, now: Instant): boolean {
  return handoverAt(id, now) <= now;
}

/** "Due by" reads to the chosen handover, or to the next one still to come when it has passed. */
export function handoverCutoff(id: HandoverShiftId, now: Instant): Instant {
  if (!handoverHasPassed(id, now)) return handoverAt(id, now);
  return handoverAt(defaultHandoverShift(now), now);
}

/** "New since" is the handover before the chosen one. */
export function handoverNewSince(id: HandoverShiftId, now: Instant): Instant {
  return handoverAt(id, now) - 8 * 60;
}

/* ------------------------------------------------------------------ rows */

export const STAGE_LABEL: Record<MovementStage, string> = {
  placement_requested: "Placement requested",
  destination_review: "Ward reviewing",
  accepted_awaiting_bed: "Accepted, awaiting bed",
  pulled: "Bed pulled",
  moving: "Moving",
  handover_ready: "Ready to hand over",
  arrived: "Arrived",
};

const OWNER_SHORT: Record<string, string> = {
  "ED mental health team": "ED team",
  "Flow coordinator": "Coordinator",
  "Ward nurse in charge": "Ward NIC",
};

/** The coordinator using this page. Owner names are role labels in this model. */
export const HANDOVER_ME = "Flow coordinator";

export type HandoverObs = "Standard" | "Urgent" | "1:1 specialling";

export type HandoverRow = {
  movement: Movement;
  id: string;
  name: string;
  umrn: string;
  patientId?: string;
  tier: number;
  edShort: string;
  edFull: string;
  service?: HealthService;
  openedAt: Instant;
  stage: MovementStage;
  owner: string;
  ownerShort: string;
  legalStatus: LegalStatus;
  formCode?: string;
  formDueAt?: Instant;
  obs: HandoverObs;
  to?: { unitId: string; name: string };
  asked: { unitId: string; name: string }[];
  declines: { unitId: string; name: string; reason: string; at: Instant }[];
  pullExpiresAt?: Instant;
  transport?: { provider: string; escort: boolean; leg?: string };
  escalated: boolean;
  urgent: boolean;
  eta?: Instant;
};

function unitName(units: Unit[], id: string): string {
  return units.find((unit) => unit.id === id)?.name ?? "Ward not recorded";
}

export function edNames(edId: string): { short: string; full: string } {
  const ed = edById(edId);
  if (ed === undefined) return { short: "ED not recorded", full: "ED not recorded" };
  return { short: `${ed.siteCode} ED`, full: ed.name };
}

export function toHandoverRow(
  movement: Movement,
  units: Unit[],
  patients: Patient[],
  referrals: Referral[],
): HandoverRow {
  const identity = resolveSubjectPatient(movement, { patients, referrals });
  const ed = edNames(movement.originEdId);
  const accepted = movement.acceptedUnitId;
  const declinedIds = new Set(movement.declines.map((decline) => decline.unitId));
  const leg = transportLeg(movement.transport);
  const toUnit = accepted === undefined ? undefined : units.find((unit) => unit.id === accepted);
  return {
    movement,
    id: movement.id,
    name: identity.displayName,
    umrn: identity.umrn,
    patientId: identity.patient?.id,
    tier: movement.urgency,
    edShort: ed.short,
    edFull: ed.full,
    service: toUnit === undefined ? undefined : unitHealthService(toUnit),
    openedAt: movement.openedAt,
    stage: movement.stage,
    owner: movement.owner || "No owner recorded",
    ownerShort: OWNER_SHORT[movement.owner] ?? (movement.owner || "No owner recorded"),
    legalStatus: movement.legalStatus,
    formCode: movement.legalForm?.code,
    formDueAt: movement.legalForm?.dueAt,
    obs: movement.flaggedUrgent ? "Urgent" : movement.specialling ? "1:1 specialling" : "Standard",
    to: accepted === undefined ? undefined : { unitId: accepted, name: unitName(units, accepted) },
    asked:
      accepted === undefined
        ? movement.referredUnitIds
            .filter((id) => !declinedIds.has(id))
            .map((id) => ({ unitId: id, name: unitName(units, id) }))
        : [],
    declines: movement.declines.map((decline) => ({
      unitId: decline.unitId,
      name: unitName(units, decline.unitId),
      reason: declineReasonLabels[decline.reason] ?? "Reason not recorded",
      at: decline.at,
    })),
    pullExpiresAt: movement.pullExpiresAt,
    transport:
      movement.transport === undefined || leg === "Cancelled"
        ? undefined
        : { provider: movement.transport.provider, escort: movement.transport.escortRequired, leg },
    escalated: movement.escalation !== undefined,
    urgent: movement.flaggedUrgent,
    eta: movement.arrivalDetails?.estimatedArrivalAt ?? movement.transport?.estimatedAt,
  };
}

/* ------------------------------------------------------------------ groups */

export type HandoverGroupId = "act" | "due" | "bed" | "acc" | "mov";
export type HandoverTone = "act" | "due" | "calm";

export function isActNow(row: HandoverRow, now: Instant): boolean {
  return (
    row.urgent ||
    (row.pullExpiresAt !== undefined && row.pullExpiresAt <= now) ||
    (row.formDueAt !== undefined && row.formDueAt <= now)
  );
}

export function isDueBy(row: HandoverRow, now: Instant, cutoff: Instant): boolean {
  if (isActNow(row, now)) return false;
  return (
    (row.pullExpiresAt !== undefined && row.pullExpiresAt <= cutoff) ||
    (row.formDueAt !== undefined && row.formDueAt <= cutoff)
  );
}

export const isWaitingForBed = (row: HandoverRow) =>
  row.stage === "placement_requested" || row.stage === "destination_review";
export const isMoving = (row: HandoverRow) => row.stage === "moving" || row.stage === "handover_ready";

export function groupOf(row: HandoverRow, now: Instant, cutoff: Instant): HandoverGroupId {
  if (isActNow(row, now)) return "act";
  if (isDueBy(row, now, cutoff)) return "due";
  if (isWaitingForBed(row)) return "bed";
  if (row.stage === "accepted_awaiting_bed" || row.stage === "pulled") return "acc";
  return "mov";
}

export function handoverGroups(cutoff: Instant, now: Instant) {
  return [
    { id: "act", title: "Act now", why: "Flagged urgent, typed form time passed or bed pull expired" },
    {
      id: "due",
      title: `Due by ${formatInstantWithDay(cutoff, now)}`,
      why: "Bed pulls and typed form times before then",
    },
    { id: "bed", title: "Waiting for a bed", why: "Placement requested or a ward is reviewing" },
    { id: "acc", title: "Accepted, bed not ready", why: "Ward accepted, bed not yet free" },
    { id: "mov", title: "Moving", why: "Transport accepted or collected" },
  ] as const satisfies readonly { id: HandoverGroupId; title: string; why: string }[];
}

/* ------------------------------------------------------------------ text */

export function legalShort(row: HandoverRow): string {
  if (row.formCode) return `Form ${row.formCode}`;
  if (row.legalStatus === "Referred for psychiatric examination") return "Referred";
  return row.legalStatus;
}

export function legalLong(row: HandoverRow): string {
  return row.formCode ? `${row.legalStatus}, Form ${row.formCode}` : row.legalStatus;
}

export function obsLong(row: HandoverRow): string {
  return row.obs === "Standard" ? "Standard obs" : row.obs === "Urgent" ? "Flagged urgent" : "1:1 specialling";
}

export function destinationText(row: HandoverRow): string {
  if (row.to) return row.to.name;
  if (row.asked.length === 1) return `${row.asked[0]!.name} reviewing`;
  if (row.asked.length > 1) return `${row.asked.length} wards reviewing`;
  if (row.declines.length) return `${row.declines.length} declined, none asked`;
  return "No ward asked yet";
}

/** Short due text for the table: a bed hold first, then a typed form time. */
export function dueShort(row: HandoverRow, now: Instant): string | null {
  if (row.pullExpiresAt !== undefined) {
    const left = row.pullExpiresAt - now;
    return left <= 0
      ? `Pull over by ${durMinutes(-left)}`
      : `Pull ends ${formatInstantWithDay(row.pullExpiresAt, now)}`;
  }
  if (row.formDueAt !== undefined) return `${row.formCode ?? "Form"} due ${formatInstantWithDay(row.formDueAt, now)}`;
  return null;
}

export function dueLong(row: HandoverRow, now: Instant): string | null {
  if (row.pullExpiresAt !== undefined) {
    const left = row.pullExpiresAt - now;
    return left <= 0
      ? `Pull expired ${durMinutes(-left)} ago`
      : `Pull ends ${formatInstantWithDay(row.pullExpiresAt, now)}, ${durMinutes(left)} left`;
  }
  if (row.formDueAt !== undefined) {
    return row.formDueAt <= now
      ? `Form ${row.formCode} time passed`
      : `Form ${row.formCode} due ${formatInstantWithDay(row.formDueAt, now)} as typed`;
  }
  return null;
}

/** The one next step each journey is waiting on, from its stage and the times it holds. */
export function nextStep(
  row: HandoverRow,
  now: Instant,
  cutoff: Instant,
  readyBeds: (unitId: string) => number,
): { text: string; tone: HandoverTone } {
  const tone: HandoverTone = isActNow(row, now) ? "act" : isDueBy(row, now, cutoff) ? "due" : "calm";
  let text: string;
  const hold = row.pullExpiresAt === undefined ? null : row.pullExpiresAt - now;
  if (row.stage === "pulled") {
    text =
      hold !== null && hold <= 0
        ? `Pull expired ${durMinutes(-hold)} ago. Move or release`
        : row.pullExpiresAt !== undefined
          ? `Move by ${formatInstantWithDay(row.pullExpiresAt, now)}`
          : "Move to the pulled bed";
  } else if (row.stage === "moving") {
    text =
      row.transport?.leg === "Collected"
        ? `Confirm arrival at ${row.to?.name ?? "the ward"}`
        : `Confirm collection for ${row.to?.name ?? "the ward"}`;
  } else if (row.stage === "handover_ready") {
    text = `Hand over to ${row.to?.name ?? "the ward"}`;
  } else if (row.stage === "accepted_awaiting_bed") {
    const ready = row.to ? readyBeds(row.to.unitId) : 0;
    text =
      ready > 0
        ? `Pull a bed, ${row.to!.name} shows ${ready} ready`
        : `Wait for a bed at ${row.to?.name ?? "the ward"}`;
  } else if (row.asked.length) {
    text =
      row.asked.length === 1
        ? `Chase ${row.asked[0]!.name} for a decision`
        : `Chase ${row.asked.length} wards for a decision`;
  } else if (row.declines.length) {
    text = `Ask another ward, ${row.declines.length} declined${row.escalated ? ", escalated" : ""}`;
  } else {
    text = row.escalated ? "Ask a ward, escalated to state desk" : "Ask a ward";
  }
  if (row.formDueAt !== undefined && row.formDueAt <= now) text = `Form ${row.formCode} time passed. ${text}`;
  return { text, tone };
}

function backgroundLine(row: HandoverRow, now: Instant): string {
  if (row.declines.length) {
    const last = row.declines[row.declines.length - 1]!;
    return `${row.declines.length} declined, last ${last.name} ${formatInstantWithDay(last.at, now)}${row.escalated ? ", escalated" : ""}`;
  }
  if (row.to) return `Accepted by ${row.to.name}`;
  if (row.asked.length)
    return `Asked ${row.asked.map((ward) => ward.name).join(", ")}${row.escalated ? ", escalated" : ""}`;
  return row.escalated ? "Escalated to state desk" : "No ward asked yet";
}

function recommendationLine(row: HandoverRow, now: Instant): string {
  const due = dueLong(row, now);
  if (row.stage === "moving") {
    return `${row.ownerShort} receives, ${row.transport?.leg === "Collected" ? "collected" : "transport accepted"}${
      row.transport ? ` by ${row.transport.provider}` : ""
    }`;
  }
  if (row.stage === "handover_ready")
    return `${row.ownerShort} hands over on arrival${due ? `, ${due.toLowerCase()}` : ""}`;
  return `${row.ownerShort}, ${STAGE_LABEL[row.stage].toLowerCase()}${due ? `, ${due.charAt(0).toLowerCase()}${due.slice(1)}` : ""}`;
}

export type IsbarLine = { key: "I" | "S" | "B" | "A" | "R"; label: string; text: string };

export function isbarLines(row: HandoverRow, now: Instant): IsbarLine[] {
  const form =
    row.formCode && row.formDueAt !== undefined
      ? `, Form ${row.formCode} due ${formatInstantWithDay(row.formDueAt, now)} as typed`
      : row.formCode
        ? `, Form ${row.formCode}, no due time typed`
        : "";
  return [
    { key: "I", label: "Identify", text: `${row.umrn}, ${legalLong(row)}` },
    {
      key: "S",
      label: "Situation",
      text: `${row.edShort} since ${formatInstantWithDay(row.openedAt, now)}, ${STAGE_LABEL[row.stage]}`,
    },
    { key: "B", label: "Background", text: backgroundLine(row, now) },
    { key: "A", label: "Assessment", text: `${obsLong(row)}${form}` },
    { key: "R", label: "Recommendation", text: recommendationLine(row, now) },
  ];
}

export function isbarText(row: HandoverRow, now: Instant): string {
  return [`${row.name} ${row.umrn}`, ...isbarLines(row, now).map((line) => `${line.label}: ${line.text}`)].join("\n");
}

/* ------------------------------------------------------------------ highlight, sort, group */

export type HandoverPill = "act" | "due" | "bed" | "mov" | "new";
export type HandoverChip = "spec" | "form" | "dec" | "day" | "mine" | "esc";

export const HANDOVER_CHIPS: { id: HandoverChip; label: string; test: (row: HandoverRow, now: Instant) => boolean }[] =
  [
    { id: "spec", label: "1:1", test: (row) => row.obs === "1:1 specialling" },
    { id: "form", label: "Form recorded", test: (row) => row.formCode !== undefined },
    { id: "dec", label: "Declined", test: (row) => row.declines.length > 0 },
    { id: "day", label: "Over a day", test: (row, now) => now - row.openedAt >= 24 * 60 },
    { id: "mine", label: "Mine", test: (row) => row.owner === HANDOVER_ME },
    { id: "esc", label: "Escalated", test: (row) => row.escalated },
  ];

export function pillTest(pill: HandoverPill, row: HandoverRow, now: Instant, cutoff: Instant, newSince: Instant) {
  switch (pill) {
    case "act":
      return groupOf(row, now, cutoff) === "act";
    case "due":
      return groupOf(row, now, cutoff) === "due";
    case "bed":
      return isWaitingForBed(row);
    case "mov":
      return isMoving(row);
    case "new":
      return row.openedAt >= newSince;
  }
}

export type HandoverSort = "wait" | "tier" | "due";
export type HandoverGrouping = "meet" | "ed" | "ward" | "owner" | "none";

export function sortRows(rows: HandoverRow[], sort: HandoverSort): HandoverRow[] {
  const dueKey = (row: HandoverRow) => row.pullExpiresAt ?? row.formDueAt ?? Number.MAX_SAFE_INTEGER;
  const compare: Record<HandoverSort, (a: HandoverRow, b: HandoverRow) => number> = {
    wait: (a, b) => a.openedAt - b.openedAt,
    tier: (a, b) => a.tier - b.tier || a.openedAt - b.openedAt,
    due: (a, b) => dueKey(a) - dueKey(b) || a.openedAt - b.openedAt,
  };
  return [...rows].sort(compare[sort]);
}

export type RowGroup = { id: string; title: string; why: string; tone?: HandoverGroupId; rows: HandoverRow[] };

export function groupRows(
  rows: HandoverRow[],
  grouping: HandoverGrouping,
  sort: HandoverSort,
  now: Instant,
  cutoff: Instant,
): RowGroup[] {
  if (grouping === "none") return [{ id: "all", title: "All open", why: "", rows: sortRows(rows, sort) }];
  if (grouping === "meet") {
    return handoverGroups(cutoff, now).map((group) => ({
      id: group.id,
      title: group.title,
      why: group.why,
      tone: group.id,
      rows: sortRows(
        rows.filter((row) => groupOf(row, now, cutoff) === group.id),
        sort,
      ),
    }));
  }
  const key = (row: HandoverRow) =>
    grouping === "ed" ? row.edShort : grouping === "ward" ? (row.to?.name ?? "No ward yet") : row.ownerShort;
  const keys = [...new Set(rows.map(key))].sort((a, b) => a.localeCompare(b));
  return keys.map((value) => ({
    id: `g-${value}`,
    title: value,
    why: "",
    rows: sortRows(
      rows.filter((row) => key(row) === value),
      sort,
    ),
  }));
}

/* ------------------------------------------------------------------ wards */

export type HandoverWard = {
  unit: Unit;
  id: string;
  name: string;
  service: HealthService | "Not recorded";
  beds: number;
  occupied: number;
  empty: number;
  ready: number;
  /** Free beds still being made ready: counted in ready, but a pull is refused until they are done. */
  pendingPreparation: number;
  confirmedAt: Instant;
  staleAfter: number;
  held: number;
  longStays: number;
  pastEdd: number;
  outToday: number;
  holds: number;
};

export function toHandoverWard(
  unit: Unit,
  admissions: Admission[],
  now: Instant,
  bedReleases: BedRelease[] = [],
): HandoverWard {
  const here = admissions.filter((admission) => admission.unitId === unit.id && bedIsOccupied(admission));
  const dayEnd = now - minuteOfDay(now) + 24 * 60;
  return {
    unit,
    id: unit.id,
    name: unit.name,
    service: unitHealthService(unit) ?? "Not recorded",
    beds: unit.beds,
    occupied: here.length,
    empty: unit.empty.value,
    ready: unit.allocatable.value,
    pendingPreparation: bedsPendingPreparation(unit.id, bedReleases),
    confirmedAt: unit.empty.confirmedAt,
    staleAfter: unit.empty.staleAfterMinutes,
    held: unit.held,
    longStays: here.filter((admission) => (daysInBed(admission, now) ?? 0) >= 7).length,
    pastEdd: here.filter((admission) => admission.expectedDischargeAt !== null && admission.expectedDischargeAt < now)
      .length,
    outToday: here.filter(
      (admission) =>
        admission.expectedDischargeAt !== null &&
        admission.expectedDischargeAt >= now &&
        admission.expectedDischargeAt < dayEnd,
    ).length,
    holds: here.filter((admission) => admission.blockReason !== null).length,
  };
}

export const wardIsStale = (ward: HandoverWard, now: Instant) => now - ward.confirmedAt > ward.staleAfter;

export type HeldDischarge = {
  admission: Admission;
  name: string;
  umrn: string;
  ward: string;
  days: number | null;
  reason: string;
};

export function heldDischarges(
  admissions: Admission[],
  wards: HandoverWard[],
  patients: Patient[],
  referrals: Referral[],
  now: Instant,
): HeldDischarge[] {
  const byId = new Map(wards.map((ward) => [ward.id, ward]));
  return admissions
    .filter((admission) => bedIsOccupied(admission) && admission.blockReason !== null && byId.has(admission.unitId))
    .map((admission) => {
      const identity = resolveSubjectPatient(admission, { patients, referrals });
      return {
        admission,
        name: identity.displayName,
        umrn: identity.umrn,
        ward: byId.get(admission.unitId)!.name,
        days: daysInBed(admission, now),
        reason: admission.blockReason ?? "",
      };
    })
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
}

/* ------------------------------------------------------------------ copy summary */

export function summaryText(
  groups: RowGroup[],
  scopeLabel: string,
  shiftLabel: string,
  takenAt: Instant,
  now: Instant,
): string {
  const lines = [
    `Handover sheet, ${scopeLabel}, ${shiftLabel}`,
    `Taken ${formatInstantWithDay(takenAt, now)} AWST. Synthetic data.`,
  ];
  for (const group of groups) {
    if (group.rows.length === 0) continue;
    lines.push("", `${group.title} (${group.rows.length})`);
    for (const row of group.rows) {
      const due = dueLong(row, now);
      lines.push(
        `- ${row.name} ${row.umrn}, T${row.tier}, ${row.edShort}, waiting ${durMinutes(now - row.openedAt)}, ${
          STAGE_LABEL[row.stage]
        }, ${row.ownerShort}${due ? `, ${due}` : ""}`,
      );
    }
  }
  return lines.join("\n");
}
