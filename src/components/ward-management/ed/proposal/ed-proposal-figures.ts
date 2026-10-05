/**
 * ED Hub and emergency department redesign proposal (5 October 2026): the figures every proposal
 * panel reads. One board predicate, one step per person, one set of counts, so the hub row for a
 * department and that department's own strip cannot disagree.
 *
 * Pure functions over shared Ward Flow state; nothing here is stored or dispatched.
 */
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import { stageCopy, unitCapacity } from "@/components/ward-management/ward-derivations";
import type {
  BedRelease,
  Cohort,
  EmergencyDepartment,
  Movement,
  Referral,
  Unit,
} from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edArrivedFor, edExpectsFor } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

/** The same closures the current ED screen keeps on its board: the department's own withdrawal. */
const ED_INITIATED_WITHDRAWAL_REASONS = [
  "The referrer withdrew the referral",
  "The referrer revoked the accepted referral",
] as const;

function isEdInitiatedWithdrawal(movement: Movement): boolean {
  return (
    movement.closure !== undefined &&
    (ED_INITIATED_WITHDRAWAL_REASONS as readonly string[]).includes(movement.closure.reason)
  );
}

/** Who is on a department's psychiatry list. The current ED screen's own predicate, unchanged. */
export function onEdList(movement: Movement, edId: string): boolean {
  return (
    movement.originEdId === edId &&
    movement.stage !== "arrived" &&
    (!movement.closure ||
      (movement.edOutcome !== undefined && !movement.leftDepartmentAt) ||
      isEdInitiatedWithdrawal(movement))
  );
}

/** Where a person is up to, in the order the work happens. Every person has exactly one. */
export type EdStep = "no_bed" | "accepted" | "pulled" | "handover_ready" | "in_transit" | "closed_here";

export const ED_STEPS: { id: EdStep; label: string; hint: string }[] = [
  { id: "no_bed", label: "No bed yet", hint: "Placement requested or destination under review" },
  { id: "accepted", label: stageCopy.accepted_awaiting_bed.label, hint: "A ward has said yes; bed not pulled" },
  { id: "pulled", label: stageCopy.pulled.label, hint: "Bed held for this person" },
  { id: "handover_ready", label: stageCopy.handover_ready.label, hint: "Transport and handover in place" },
  { id: "in_transit", label: "Left, in transit", hint: "Left the department; ward to mark arrival" },
  { id: "closed_here", label: "Outcome recorded", hint: "ED outcome or withdrawal; still in the department" },
];

export function edStep(movement: Movement): EdStep {
  if (movement.closure) return "closed_here";
  switch (movement.stage) {
    case "accepted_awaiting_bed":
      return "accepted";
    case "pulled":
      return "pulled";
    case "handover_ready":
      return "handover_ready";
    case "moving":
      return "in_transit";
    default:
      return "no_bed";
  }
}

export type Tone = "danger" | "warn" | "good" | "quiet";

export type EdPatientRow = {
  movement: Movement;
  initials: string;
  umrn: string;
  step: EdStep;
  /** Minutes since the referral was received — the access clock (`openedAt`), not time in the building. */
  sinceReferral: number;
  pastTarget: boolean;
  reviewed: boolean;
  destination?: string;
  form?: string;
  cleared: "cleared" | "not_cleared" | "not_recorded";
  next: { label: string; tone: Tone };
};

/** Initials only: proposal screens never show a patient's name. */
function initialsOf(displayName: string): string {
  const parts = displayName.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0 || displayName === "Unknown Patient") return "—";
  return parts.map((part) => `${part[0].toUpperCase()}.`).join(" ");
}

function unitName(units: readonly Unit[], id: string | undefined): string | undefined {
  if (!id) return undefined;
  return units.find((unit) => unit.id === id)?.name ?? id;
}

/** The one next step for a person, from the same rules the current Needs attention list uses. */
export function nextStep(movement: Movement, now: number): { label: string; tone: Tone } {
  if (movement.legalForm?.dueAt !== undefined && movement.legalForm.dueAt < now)
    return { label: "Renew or discharge the form", tone: "danger" };
  if (movement.closure) return { label: "Record when they leave", tone: "quiet" };
  if (movement.stage === "pulled" && !movement.transport && (movement.transportNeed?.needed ?? true) !== false)
    return { label: "Book transport", tone: "warn" };
  if (movement.declines.length > 0 && !movement.acceptedUnitId && movement.referredUnitIds.length === 0)
    return { label: "Ask another ward", tone: "warn" };
  switch (movement.stage) {
    case "placement_requested":
    case "destination_review":
      if (movement.referredUnitIds.length > 0)
        return {
          label: `Wait for ${movement.referredUnitIds.length === 1 ? "the ward" : `${movement.referredUnitIds.length} wards`} to answer`,
          tone: "quiet",
        };
      return { label: movement.examination ? "Ask a ward" : "Psychiatric review", tone: "warn" };
    case "accepted_awaiting_bed":
      return { label: "Ward to pull the bed", tone: "quiet" };
    case "pulled":
      return { label: "Mark the handover ready", tone: "quiet" };
    case "handover_ready":
      return { label: "Hand over and leave", tone: "good" };
    case "moving":
      return { label: "Ward to mark arrival", tone: "quiet" };
    default:
      return { label: "No step recorded", tone: "quiet" };
  }
}

export function edRows(
  edId: string,
  world: {
    movements: readonly Movement[];
    referrals: readonly Referral[];
    patients: readonly Patient[];
    units: readonly Unit[];
  },
  now: number,
  accessTargetMinutes: number,
): EdPatientRow[] {
  return world.movements
    .filter((movement) => onEdList(movement, edId))
    .map((movement) => {
      const who = resolveSubjectPatient(movement, world);
      const clearance =
        movement.medicalClearance ??
        (movement.referralId
          ? world.referrals.find((referral) => referral.id === movement.referralId)?.medicalClearance
          : undefined);
      const sinceReferral = Math.max(now - movement.openedAt, 0);
      return {
        movement,
        initials: initialsOf(who.displayName),
        umrn: who.umrn,
        step: edStep(movement),
        sinceReferral,
        pastTarget: !movement.closure && sinceReferral > accessTargetMinutes,
        reviewed: !!movement.examination || movement.edOutcome !== undefined,
        destination: unitName(world.units, movement.acceptedUnitId),
        form: movement.legalForm?.code,
        cleared: clearance ? (clearance.cleared ? "cleared" : "not_cleared") : "not_recorded",
        next: nextStep(movement, now),
      } satisfies EdPatientRow;
    })
    .sort((a, b) => b.sinceReferral - a.sinceReferral);
}

export type EdCounts = {
  onList: number;
  noBed: number;
  bedFound: number;
  inTransit: number;
  notReviewed: number;
  underForm: number;
  pastTarget: number;
  longest: number | undefined;
  steps: Record<EdStep, number>;
};

export function edCounts(rows: readonly EdPatientRow[]): EdCounts {
  const steps = Object.fromEntries(ED_STEPS.map((step) => [step.id, 0])) as Record<EdStep, number>;
  for (const row of rows) steps[row.step] += 1;
  return {
    onList: rows.length,
    noBed: steps.no_bed,
    bedFound: steps.accepted + steps.pulled + steps.handover_ready,
    inTransit: steps.in_transit,
    notReviewed: rows.filter((row) => !row.reviewed && row.step !== "closed_here").length,
    underForm: rows.filter((row) => row.form !== undefined && row.step !== "closed_here").length,
    pastTarget: rows.filter((row) => row.pastTarget).length,
    longest: rows.length ? Math.max(...rows.map((row) => row.sinceReferral)) : undefined,
    steps,
  };
}

export type EdHubRow = {
  ed: EmergencyDepartment;
  code: string;
  service: string;
  counts: EdCounts;
  awaitingReview: number;
  expected: number;
};

export function hubRows(world: Parameters<typeof edRows>[1], now: number, accessTargetMinutes: number): EdHubRow[] {
  return allEmergencyDepartments()
    .map((ed) => {
      const site = siteByCode(ed.siteCode);
      return {
        ed,
        code: site?.code ?? ed.siteCode,
        service: site?.service ?? "Service not identified",
        counts: edCounts(edRows(ed.id, world, now, accessTargetMinutes)),
        awaitingReview: edArrivedFor(world.referrals, ed.id, "psychiatric_review").length,
        expected: edExpectsFor(world.referrals, ed.id, "psychiatric_review").length,
      };
    })
    .sort(
      (a, b) =>
        b.counts.pastTarget - a.counts.pastTarget ||
        b.counts.noBed - a.counts.noBed ||
        b.counts.onList - a.counts.onList ||
        a.ed.name.localeCompare(b.ed.name),
    );
}

export function sumCounts(rows: readonly EdHubRow[]): EdCounts {
  return {
    onList: rows.reduce((sum, row) => sum + row.counts.onList, 0),
    noBed: rows.reduce((sum, row) => sum + row.counts.noBed, 0),
    bedFound: rows.reduce((sum, row) => sum + row.counts.bedFound, 0),
    inTransit: rows.reduce((sum, row) => sum + row.counts.inTransit, 0),
    notReviewed: rows.reduce((sum, row) => sum + row.counts.notReviewed, 0),
    underForm: rows.reduce((sum, row) => sum + row.counts.underForm, 0),
    pastTarget: rows.reduce((sum, row) => sum + row.counts.pastTarget, 0),
    longest: rows.some((row) => row.counts.longest !== undefined)
      ? Math.max(...rows.map((row) => row.counts.longest ?? 0))
      : undefined,
    steps: Object.fromEntries(
      ED_STEPS.map((step) => [step.id, rows.reduce((sum, row) => sum + row.counts.steps[step.id], 0)]),
    ) as Record<EdStep, number>,
  };
}

/** The attention list: only what someone must do now. Acceptances and departures live on the board. */
export type AttentionItem = { tone: Tone; title: string; who: string; why: string; movementId?: string };

export function attentionItems(
  rows: readonly EdPatientRow[],
  units: readonly Unit[],
  awaitingReview: readonly { referral: Referral }[],
  now: number,
  initialsForReferral: (referral: Referral) => string,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const row of rows) {
    const m = row.movement;
    if (m.legalForm?.dueAt !== undefined && m.legalForm.dueAt < now)
      items.push({
        tone: "danger",
        title: "Recorded form deadline has passed",
        who: row.initials,
        why: `Form ${m.legalForm.code}: the deadline written on the form has passed.`,
        movementId: m.id,
      });
    if (row.next.label === "Book transport")
      items.push({
        tone: "warn",
        title: "Bed held, transport not booked",
        who: row.initials,
        why: `${unitName(units, m.acceptedUnitId) ?? "A ward"} holds the bed. The handover cannot be marked ready until transport is booked.`,
        movementId: m.id,
      });
    if (row.next.label === "Ask another ward")
      items.push({
        tone: "warn",
        title: "Every ward asked has declined",
        who: row.initials,
        why: `${m.declines.length} ${m.declines.length === 1 ? "ward has" : "wards have"} declined and no ward has been asked since.`,
        movementId: m.id,
      });
    if (row.pastTarget)
      items.push({
        tone: "warn",
        title: "Past the access target",
        who: row.initials,
        why: "Waiting longer than this department's access target since the referral was received (your default, not a legal limit).",
        movementId: m.id,
      });
  }
  for (const { referral } of awaitingReview) {
    const triaged = referral.triagedAt;
    // A referral whose person already has an examination recorded on a movement is not "unseen".
    const examined = rows.some((row) => row.movement.referralId === referral.id && row.reviewed);
    if (!examined && triaged !== undefined && now - triaged > 60)
      items.push({
        tone: "warn",
        title: "Referral waiting for psychiatric review",
        who: initialsForReferral(referral),
        why: "Triaged over an hour ago with no psychiatric review recorded.",
      });
  }
  const rank: Record<Tone, number> = { danger: 0, warn: 1, good: 2, quiet: 3 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

/** Beds ready now: the same `unitCapacity().available` sum the sidebar and current screen show. */
export function readyBeds(units: readonly Unit[], bedReleases: BedRelease[]): number {
  return units.reduce((sum, unit) => sum + (unitCapacity(unit, bedReleases).available ?? 0), 0);
}

/** Of the ready beds, how many a ward has noted are still being made ready (owner ruling, 5 Sept 2026). */
export function bedsBeingPrepared(units: readonly Unit[], bedReleases: BedRelease[]): number {
  return units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0);
}

/** Wards with a bed ready now for a cohort somebody here is still waiting in. */
export function fittingWards(
  units: readonly Unit[],
  bedReleases: BedRelease[],
  cohorts: readonly Cohort[],
): { unit: Unit; service: string; ready: number; pendingPreparation: number }[] {
  const wanted = new Set(cohorts);
  return units
    .map((unit) => ({
      unit,
      service: siteByCode(unit.siteCode)?.service ?? "",
      ready: unitCapacity(unit, bedReleases).available ?? 0,
      pendingPreparation: bedsPendingPreparation(unit.id, bedReleases),
    }))
    .filter((entry) => entry.ready > 0 && wanted.has(entry.unit.cohort))
    .sort((a, b) => b.ready - a.ready || a.unit.name.localeCompare(b.unit.name));
}

export type EdEvent = {
  at: number;
  kind: "Referral" | "Review" | "Bed search" | "Movement";
  text: string;
  who: string;
};

/** The last 24 hours, strictly. A referral being received is never called an arrival. */
export function recentEvents(rows: readonly EdPatientRow[], units: readonly Unit[], now: number): EdEvent[] {
  const events: EdEvent[] = [];
  const within = (at: number | undefined): at is number => at !== undefined && now - at <= 24 * 60 && at <= now;
  for (const row of rows) {
    const m = row.movement;
    if (within(m.openedAt))
      events.push({ at: m.openedAt, kind: "Referral", text: "Referral received", who: row.initials });
    if (within(m.examination?.at))
      events.push({
        at: m.examination.at,
        kind: "Review",
        text: "Psychiatric examination recorded",
        who: row.initials,
      });
    if (within(m.legalFormReceivedAt) && m.legalForm)
      events.push({
        at: m.legalFormReceivedAt,
        kind: "Review",
        text: `Form ${m.legalForm.code} received`,
        who: row.initials,
      });
    for (const decline of m.declines)
      if (within(decline.at))
        events.push({
          at: decline.at,
          kind: "Bed search",
          text: `${unitName(units, decline.unitId)} declined: ${declineReasonLabels[decline.reason] ?? "reason recorded"}`,
          who: row.initials,
        });
    if (within(m.acceptedAt) && m.acceptedUnitId)
      events.push({
        at: m.acceptedAt,
        kind: "Bed search",
        text: `${unitName(units, m.acceptedUnitId)} accepted`,
        who: row.initials,
      });
    for (const change of m.stageChanges)
      if (within(change.at) && change.to !== "placement_requested")
        events.push({ at: change.at, kind: "Movement", text: stageCopy[change.to].label, who: row.initials });
    if (within(m.leftDepartmentAt))
      events.push({ at: m.leftDepartmentAt, kind: "Movement", text: "Left the department", who: row.initials });
  }
  return events.sort((a, b) => b.at - a.at);
}
