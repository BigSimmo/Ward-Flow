/**
 * The handover sheet's rows, read from the engine (refined Handover A, 9 Oct 2026).
 *
 * One `HandoverRow` per open movement and one `HandoverWard` per ward. Every value is either a
 * recorded field or derived from one; nothing here is typed by hand. Patients are named by their
 * record and UMRN only (D-39), never by the journey id. Form times are the typed ones (D5): this
 * file never computes a legal time limit.
 */
import { durMinutes } from "@/components/wf";
import { bedHold, bedHoldLapsed } from "@/components/ward-management/ward-bed-hold";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  formatInstantWithDay,
  MINUTES_PER_DAY,
  minuteOfDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { isStoppedTransportAwaitingRelease, transportLeg } from "@/components/ward-management/ward-derivations";
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
import { bedStates, readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { isConstantObservation, observationSummary } from "@/components/ward-management/ward-observation";
import { communityOriginLabel } from "@/components/ward-management/ward-movement-origin";

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
  return id === "am" && minuteOfDay(now) >= LAST_HANDOVER_MINUTE ? today + MINUTES_PER_DAY : today;
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

/**
 * Audit TC2-02: the handover a page has chosen, held as the instant it meant when chosen. Re-read
 * against each new "now", a page left open over midnight meant tonight's handover instead, and its
 * "new since" lay in the future, so the page read "Nothing has changed". A held handover more than
 * a day from now (a page left for a day, or a demo jump) starts again from the next one.
 */
export type HeldHandover = { id: HandoverShiftId; at: Instant };

export function holdHandover(id: HandoverShiftId, now: Instant): HeldHandover {
  return { id, at: handoverAt(id, now) };
}

export function currentHeldHandover(held: HeldHandover, now: Instant): HeldHandover {
  return Math.abs(held.at - now) <= MINUTES_PER_DAY ? held : holdHandover(defaultHandoverShift(now), now);
}

/** "Due by" for the handover held at `at`: its own time, or the next one still to come once it has passed. */
export function heldHandoverCutoff(at: Instant, now: Instant): Instant {
  return at > now ? at : handoverAt(defaultHandoverShift(now), now);
}

/** "New since" for the handover held at `at`: the one before it, and never later than now. */
export function heldHandoverNewSince(at: Instant, now: Instant): Instant {
  return Math.min(at - 8 * 60, now);
}

/**
 * When this handover was signed off, or null. Sign-off closes once the handover starts, so a
 * record belongs to the handover whose window (from the one before it up to its start) holds it.
 */
export function handoverSignedAt(
  signOffs: readonly { at: Instant }[],
  id: HandoverShiftId,
  now: Instant,
): Instant | null {
  return handoverSignedBefore(signOffs, handoverAt(id, now));
}

/** The latest sign-off in the window before the handover at `to`, or null. */
export function handoverSignedBefore(signOffs: readonly { at: Instant }[], to: Instant): Instant | null {
  const from = to - 8 * 60;
  let signed: Instant | null = null;
  for (const record of signOffs) {
    if (record.at >= from && record.at < to && (signed === null || record.at > signed)) signed = record.at;
  }
  return signed;
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
  "Bed coordinator": "Coordinator",
  "Ward nurse in charge": "Ward NIC",
};

/** The coordinator using this page. Owner names are role labels in this model. */
export const HANDOVER_ME = "Bed coordinator";

/** Urgent first; otherwise "Constant" for a level that takes observation staff (fix plan item 10). */
export type HandoverObs = "Standard" | "Urgent" | "Constant";

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
  /**
   * Audit r1 item 3: the risk flags recorded on this journey's referral intake, read as recorded.
   * `undefined` when no referral intake is linked, so the Assessment says "not recorded".
   */
  riskFlags?: readonly string[];
  /** The referring clinician's high-acuity nursing mark, carried on the movement. */
  highAcuity?: boolean;
  to?: { unitId: string; name: string };
  asked: { unitId: string; name: string }[];
  declines: { unitId: string; name: string; reason: string; at: Instant }[];
  pullExpiresAt?: Instant;
  transport?: { provider: string; escort: boolean; leg?: string };
  escalated: boolean;
  urgent: boolean;
  eta?: Instant;
  /**
   * Whether the shared act-now list (`activeActNowItems`, `ward-act-now-items.ts`, the one the
   * Alerts page and Tasks lead with) holds a row for this journey. Set by the page from the live
   * state; a row built without it falls back to its own recorded times (`isActNow`).
   */
  actNow?: boolean;
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
  const community = movement.originEdId === undefined ? communityOriginLabel(movement.originCommunity) : undefined;
  const ed = community ? { short: community, full: community } : edNames(movement.originEdId!);
  const accepted = movement.acceptedUnitId;
  const leg = transportLeg(movement.transport);
  const toUnit = accepted === undefined ? undefined : units.find((unit) => unit.id === accepted);
  return {
    movement,
    id: movement.id,
    name: identity.formalName,
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
    obs: movement.flaggedUrgent ? "Urgent" : isConstantObservation(movement.observation) ? "Constant" : "Standard",
    riskFlags:
      movement.referralId === undefined
        ? undefined
        : referrals.find((referral) => referral.id === movement.referralId)?.intake?.riskFlags,
    highAcuity: movement.highAcuity,
    to: accepted === undefined ? undefined : { unitId: accepted, name: unitName(units, accepted) },
    asked:
      accepted === undefined ? movement.referredUnitIds.map((id) => ({ unitId: id, name: unitName(units, id) })) : [],
    declines: movement.declines.map((decline) => ({
      unitId: decline.unitId,
      name: unitName(units, decline.unitId),
      reason: (decline.reason && declineReasonLabels[decline.reason]) || "Reason not recorded",
      at: decline.at,
    })),
    pullExpiresAt: movement.pullExpiresAt,
    transport:
      movement.transport !== undefined && isStoppedTransportAwaitingRelease(movement)
        ? {
            provider: movement.transport.provider,
            escort: movement.transport.escortRequired,
            leg: "Stopped",
          }
        : movement.transport === undefined || leg === "Cancelled"
          ? undefined
          : {
              provider: movement.transport.provider,
              escort: movement.transport.escortRequired,
              leg: movement.transport.cancelledAt !== undefined ? "Stopped" : leg,
            },
    escalated: movement.escalation !== undefined,
    urgent: movement.flaggedUrgent,
    eta: movement.arrivalDetails?.estimatedArrivalAt ?? movement.transport?.estimatedAt,
  };
}

/* ------------------------------------------------------------------ groups */

export type HandoverGroupId = "act" | "urg" | "due" | "rel" | "bed" | "acc" | "mov";
export type HandoverTone = "act" | "due" | "calm";

/**
 * Act now on the sheet. L1 (site review, 12 Oct 2026): Handover read "Act now 3" while Alerts read
 * 2, because the sheet kept its own list. With `actNow` set the sheet reads the shared act-now list
 * (`activeActNowItems`), so a snoozed alert leaves both together. A journey flagged urgent by a
 * person is a human safety call the sheet must not drop: Audit 6 (Josh, 20 Oct 2026) moved it from
 * Act now to its own Flagged urgent group straight beneath, so Act now is exactly Alerts' red rows.
 */
export function isCollected(row: HandoverRow): boolean {
  // A stopped (or cancelled) journey is no longer in transit: its held bed must still be able to lapse.
  const transport = row.movement?.transport;
  if (row.movement?.closure !== undefined || transport?.cancelledAt !== undefined) return false;
  return row.stage === "moving" || transport?.collectedAt !== undefined;
}

/**
 * Owner ruling 2026-10-13 22:13 AWST (PR #279): a journey whose transport was stopped after
 * collection, with its bed still held, is its own row state: "Transport stopped, release pulled bed".
 */
export function isStoppedAwaitingRelease(row: HandoverRow): boolean {
  return row.movement !== undefined && isStoppedTransportAwaitingRelease(row.movement);
}

/**
 * The bed hold the sheet may show. Owner ruling 2026-10-13 22:13 AWST: while the patient is collected
 * and in a live vehicle no "Pull expired" is shown anywhere (table, print, copy, detail).
 */
export function shownBedHold(row: HandoverRow, now: Instant) {
  return isCollected(row) ? null : bedHold(row.pullExpiresAt, now);
}
export function pullHasLapsed(row: HandoverRow, now: Instant): boolean {
  return !isCollected(row) && bedHoldLapsed(row.pullExpiresAt, now);
}

export function isActNow(row: HandoverRow, now: Instant): boolean {
  if (row.actNow !== undefined) return row.actNow;
  return pullHasLapsed(row, now) || (row.formDueAt !== undefined && row.formDueAt <= now);
}

/** Flagged urgent by a person and not already act now: the sheet's own line beneath Act now. */
export function isFlaggedUrgent(row: HandoverRow, now: Instant): boolean {
  return row.urgent && !isActNow(row, now);
}

/** Drawn in danger: act now, or flagged urgent on its own line. Counts never use this. */
export function isActOrUrgent(row: HandoverRow, now: Instant): boolean {
  return isActNow(row, now) || isFlaggedUrgent(row, now);
}

export function isDueBy(row: HandoverRow, now: Instant, cutoff: Instant): boolean {
  if (isActNow(row, now) || isFlaggedUrgent(row, now)) return false;
  return pullHasLapsed(row, cutoff) || (row.formDueAt !== undefined && row.formDueAt <= cutoff);
}

export const isWaitingForBed = (row: HandoverRow) =>
  row.stage === "placement_requested" || row.stage === "destination_review";
export const isMoving = (row: HandoverRow) => row.stage === "moving" || row.stage === "handover_ready";

export function groupOf(row: HandoverRow, now: Instant, cutoff: Instant): HandoverGroupId {
  if (isActNow(row, now)) return "act";
  if (isFlaggedUrgent(row, now)) return "urg";
  if (isDueBy(row, now, cutoff)) return "due";
  if (isStoppedAwaitingRelease(row)) return "rel";
  if (isWaitingForBed(row)) return "bed";
  if (row.stage === "accepted_awaiting_bed" || row.stage === "pulled") return "acc";
  return "mov";
}

export function handoverGroups(cutoff: Instant, now: Instant) {
  return [
    { id: "act", title: "Act now", why: "On the act-now alerts" },
    { id: "urg", title: "Flagged urgent", why: "Flagged urgent by a person, not on the act-now alerts" },
    {
      id: "due",
      title: `Due by ${formatInstantWithDay(cutoff, now)}`,
      why: "Bed pulls and typed form times before then",
    },
    {
      id: "rel",
      title: "Transport stopped, release pulled bed",
      why: "Journey stopped after collection; the bed is still pulled",
    },
    { id: "bed", title: "Finding a ward", why: "Placement requested or a ward is reviewing" },
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

/** The recorded observation level, with the urgent flag first when set: "Flagged urgent, General, hourly". */
export function obsLong(row: HandoverRow): string {
  const level = observationSummary(row.movement.observation);
  return row.obs === "Urgent" ? `Flagged urgent, ${level}` : level;
}

/** The separate Obs column preserves the recorded level, interval/ratio and urgent flag. */
export function obsShort(row: HandoverRow): string {
  return obsLong(row);
}

export function destinationText(row: HandoverRow): string {
  if (row.to) return row.to.name;
  if (row.asked.length === 1) return `${row.asked[0]!.name} reviewing`;
  if (row.asked.length > 1) return `${row.asked.length} wards reviewing`;
  if (row.declines.length) return `${row.declines.length} declined, none asked`;
  return "No ward asked yet";
}

/** Short due text for the table: whichever comes first of a bed hold and a typed form time. */
export function dueShort(row: HandoverRow, now: Instant): string | null {
  const collected = isCollected(row);
  const hold = collected ? null : bedHold(row.pullExpiresAt, now);
  if (hold !== null && (row.formDueAt === undefined || hold.expiresAt <= row.formDueAt)) {
    return hold.state === "lapsed" ? hold.label : `Pull ends ${formatInstantWithDay(hold.expiresAt, now)}`;
  }
  if (row.formDueAt !== undefined) return `${row.formCode ?? "Form"} due ${formatInstantWithDay(row.formDueAt, now)}`;
  return collected ? "In transit" : null;
}

/**
 * The Due cell in two parts: the time or length on its own line, which is never cut, and what it is
 * ("Pull over by", "Pull ends", "1A due"), which may truncate (device audit 11 Oct 2026).
 */
export function dueParts(row: HandoverRow, now: Instant): { when: string; what: string; atRisk?: boolean } | null {
  const collected = isCollected(row);
  if (
    !collected &&
    row.pullExpiresAt !== undefined &&
    (row.formDueAt === undefined || row.pullExpiresAt <= row.formDueAt)
  ) {
    // Audit A4-3: the one bed-hold rule. Under an hour left carries the amber at-risk dot (not Act now).
    // A pull time that is not a real instant (NaN, Infinity) yields no hold; fall through to the form.
    const hold = bedHold(row.pullExpiresAt, now);
    if (hold !== null) {
      if (hold.state === "lapsed") {
        return { when: durMinutes(hold.minutes), what: "Pull expired" };
      }
      return {
        when: formatInstantWithDay(hold.expiresAt, now),
        what: "Pull ends",
        ...(hold.state === "at-risk" ? { atRisk: true } : {}),
      };
    }
  }
  if (row.formDueAt !== undefined)
    return { when: formatInstantWithDay(row.formDueAt, now), what: `${row.formCode ?? "Form"} due` };
  return collected ? { when: "In transit", what: "Collected" } : null;
}

/** Long due text for the panel: the bed hold and the typed form time, both when both are held. */
export function dueLong(row: HandoverRow, now: Instant): string | null {
  const parts: string[] = [];
  const hold = shownBedHold(row, now);
  if (hold) {
    parts.push(
      hold.state === "lapsed" ? hold.label : `Pull ends ${formatInstantWithDay(hold.expiresAt, now)}, ${hold.short}`,
    );
  }
  if (row.formDueAt !== undefined) {
    parts.push(
      row.formDueAt <= now
        ? `Form ${row.formCode} time passed`
        : `Form ${row.formCode} due ${formatInstantWithDay(row.formDueAt, now)} as typed`,
    );
  }
  return parts.length ? parts.join(". ") : null;
}

/** The one next step each journey is waiting on, from its stage and the times it holds. */
export function nextStep(
  row: HandoverRow,
  now: Instant,
  cutoff: Instant,
  readyBeds: (unitId: string) => number,
): { text: string; tone: HandoverTone } {
  const tone: HandoverTone = isActOrUrgent(row, now) ? "act" : isDueBy(row, now, cutoff) ? "due" : "calm";
  let text: string;
  const hold = shownBedHold(row, now);
  if (isStoppedAwaitingRelease(row)) {
    text = `Transport stopped. Release the pulled bed at ${row.to?.name ?? "the ward"}`;
  } else if (row.stage === "pulled") {
    text =
      hold?.state === "lapsed"
        ? `${hold.label}. ${hold.nextStep}`
        : hold
          ? `Move by ${formatInstantWithDay(hold.expiresAt, now)}, ${hold.short}`
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

/**
 * Audit A4-26: the Situation from the journey's latest state, never the bare stage label, which
 * went stale ("Ward reviewing" with every ward declined, "Bed pulled" after the pull expired).
 */
export function situationState(row: HandoverRow, now: Instant): string {
  const to = row.to?.name ?? "the ward";
  if (isStoppedAwaitingRelease(row)) return `Transport stopped, bed pulled at ${to} awaiting release`;
  if (row.stage === "pulled") {
    if (row.pullExpiresAt === undefined) return `Bed pulled at ${to}`;
    return row.pullExpiresAt <= now
      ? `Bed pull at ${to} expired ${durMinutes(now - row.pullExpiresAt)} ago`
      : `Bed pulled at ${to} until ${formatInstantWithDay(row.pullExpiresAt, now)}`;
  }
  if (row.stage === "placement_requested" || row.stage === "destination_review") return destinationText(row);
  if (row.stage === "accepted_awaiting_bed") return `Accepted by ${to}, awaiting a bed`;
  if (row.stage === "moving")
    return row.transport?.leg === "Collected" ? `Collected, on the way to ${to}` : `Awaiting collection for ${to}`;
  if (row.stage === "handover_ready") return `Ready to hand over to ${to}`;
  return STAGE_LABEL[row.stage];
}

/**
 * Audit r1 item 3 (wording for Josh's sign-off): the Assessment names the recorded risk flags and
 * high-acuity mark in neutral words, never a derived score.
 */
export function riskWords(row: HandoverRow): string {
  const acuity = row.highAcuity ? ", high acuity nursing" : "";
  if (row.riskFlags === undefined) return `${acuity}, risk flags not recorded`;
  if (row.riskFlags.length === 0) return `${acuity}, no risk flags recorded`;
  return `${acuity}, risk flags ${row.riskFlags.join(", ")}`;
}

/** Audit A4-26: the Recommendation is the owner and the one next step, from the same rule as the sheet. */
function recommendationLine(row: HandoverRow, now: Instant, readyBeds: (unitId: string) => number): string {
  return `${row.ownerShort}: ${nextStep(row, now, now, readyBeds).text}`;
}

export type IsbarLine = { key: "I" | "S" | "B" | "A" | "R"; label: string; text: string };

export function isbarLines(
  row: HandoverRow,
  now: Instant,
  readyBeds: (unitId: string) => number = () => 0,
): IsbarLine[] {
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
      text: `${row.edShort} since ${formatInstantWithDay(row.openedAt, now)}, ${situationState(row, now)}`,
    },
    { key: "B", label: "Background", text: backgroundLine(row, now) },
    { key: "A", label: "Assessment", text: `${obsLong(row)}${riskWords(row)}${form}` },
    { key: "R", label: "Recommendation", text: recommendationLine(row, now, readyBeds) },
  ];
}

export function isbarText(row: HandoverRow, now: Instant, readyBeds: (unitId: string) => number = () => 0): string {
  return [
    "Synthetic demonstration · Not approved for clinical use",
    `${row.name} ${row.umrn}`,
    ...isbarLines(row, now, readyBeds).map((line) => `${line.label}: ${line.text}`),
  ].join("\n");
}

/* ------------------------------------------------------------------ highlight, sort, group */

export type HandoverPill = "act" | "urg" | "due" | "bed" | "mov" | "new";
export type HandoverChip = "spec" | "form" | "dec" | "day" | "mine" | "esc";

export const HANDOVER_CHIPS: { id: HandoverChip; label: string; test: (row: HandoverRow, now: Instant) => boolean }[] =
  [
    { id: "spec", label: "Constant obs", test: (row) => isConstantObservation(row.movement.observation) },
    { id: "form", label: "Form recorded", test: (row) => row.formCode !== undefined },
    { id: "dec", label: "Declined", test: (row) => row.declines.length > 0 },
    { id: "day", label: "Over a day", test: (row, now) => now - row.openedAt >= MINUTES_PER_DAY },
    { id: "mine", label: "Mine", test: (row) => row.owner === HANDOVER_ME },
    { id: "esc", label: "Escalated", test: (row) => row.escalated },
  ];

export function pillTest(pill: HandoverPill, row: HandoverRow, now: Instant, cutoff: Instant, newSince: Instant) {
  switch (pill) {
    case "act":
      return groupOf(row, now, cutoff) === "act";
    case "urg":
      return groupOf(row, now, cutoff) === "urg";
    case "due":
      return groupOf(row, now, cutoff) === "due";
    // Waiting and Moving name their meeting group, so a highlight, its count and the group heading
    // agree (device audit 11 Oct 2026: hero 40 and 13 against groups 39 and 9).
    case "bed":
      return groupOf(row, now, cutoff) === "bed";
    case "mov":
      return groupOf(row, now, cutoff) === "mov";
    case "new":
      return row.openedAt >= newSince;
  }
}

export type HandoverSort = "wait" | "tier" | "due";
export type HandoverGrouping = "meet" | "ed" | "ward" | "owner" | "none";

export function sortRows(rows: HandoverRow[], sort: HandoverSort): HandoverRow[] {
  const dueKey = (row: HandoverRow) =>
    Math.min(row.pullExpiresAt ?? Number.MAX_SAFE_INTEGER, row.formDueAt ?? Number.MAX_SAFE_INTEGER);
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
  const dayEnd = now - minuteOfDay(now) + MINUTES_PER_DAY;
  return {
    unit,
    id: unit.id,
    name: unit.name,
    service: unitHealthService(unit) ?? "Not recorded",
    beds: unit.beds,
    occupied: here.length,
    empty: unit.empty.value,
    // Audit 6 (Josh, 20 Oct 2026): the one ready figure, leaving out beds pulled for an incoming patient.
    ready: readyBedsNow(unit, admissions, bedReleases),
    pendingPreparation: bedsPendingPreparation(unit.id, bedReleases),
    confirmedAt: unit.empty.confirmedAt,
    staleAfter: unit.empty.staleAfterMinutes,
    // Audit 24-4 NA2-03: the Pulled box Capacity and Home print, never closed beds.
    held: bedStates(unit, admissions, bedReleases, []).pulled,
    longStays: here.filter((admission) => (daysInBed(admission, now) ?? 0) >= CLINICAL_VALUES.longStayPrompt.value)
      .length,
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
        name: identity.formalName,
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
