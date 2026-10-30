"use client";

import { useCallback, useMemo, useState } from "react";

import type { WfTone } from "@/components/wf";
import {
  changesSinceInstant,
  changesSinceLastLook,
  takeLastLookSnapshot,
  type ChangesSinceLastLook,
  type LastLookSnapshot,
  type LastLookWorld,
} from "@/components/ward-management/coordinator/since-last-look";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { dayOf, MINUTES_PER_DAY, type DueSoonThresholds, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { communityOriginLabel } from "@/components/ward-management/ward-movement-origin";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * Mock-up only: the Changes tab of the redesigned Activity panel. Every line comes from the real
 * "since last look" comparison (`since-last-look.ts`): before any review this shift it reads
 * recorded times since the shift began (`changesSinceInstant`); after a review it compares the
 * world with the picture taken when the panel was opened (`changesSinceLastLook`). Each line counts
 * once: a ward's ready beds going up is one line, never one per bed.
 */
type ChangeGroupId = "escalations" | "referrals" | "journeys" | "acceptances" | "beds" | "delays" | "discharges";

export const CHANGE_GROUPS: readonly { id: ChangeGroupId; label: string }[] = [
  { id: "escalations", label: "Escalations" },
  { id: "referrals", label: "Referrals" },
  { id: "journeys", label: "New ED journeys" },
  { id: "acceptances", label: "Acceptances withdrawn" },
  { id: "beds", label: "Beds" },
  { id: "delays", label: "Delays" },
  { id: "discharges", label: "Discharges" },
];

export type ChangeLine = {
  id: string;
  group: ChangeGroupId;
  tone: WfTone;
  /** Surname first (D-83), or a ward's name for a bed line. */
  who: string;
  href?: string;
  text: string;
  at?: Instant;
  /** An escalation that is also an open alert: reviewing here never acknowledges it. */
  alsoInAlerts?: boolean;
};

type LineContext = {
  referrals: readonly Referral[];
  movements: readonly Movement[];
  admissions: readonly Admission[];
  base: LastLookSnapshot | undefined;
  nameOf: (subject: Movement | Referral | Admission) => ResolvedPatientInfo;
  alertMovementIds: ReadonlySet<string>;
};

function person(info: ResolvedPatientInfo): Pick<ChangeLine, "who" | "href"> {
  return { who: info.formalName, ...(info.patient ? { href: patientHref(info.patient.id) } : {}) };
}

function originOf(movement: Movement, edNames: ReadonlyMap<string, string>): string {
  return movement.originEdId === undefined
    ? communityOriginLabel(movement.originCommunity)
    : (edNames.get(movement.originEdId) ?? movement.originEdId);
}

/** One line per change, newest first within each group, groups in `CHANGE_GROUPS` order. */
function changeLines(changes: ChangesSinceLastLook, context: LineContext): ChangeLine[] {
  const { referrals, movements, admissions, base, nameOf, alertMovementIds } = context;
  const edNames = new Map(allEmergencyDepartments().map((ed) => [ed.id, ed.name]));
  const movementById = new Map<string, Movement>(movements.map((movement) => [movement.id, movement]));
  const referralById = new Map(referrals.map((referral) => [referral.id, referral]));
  const lines: ChangeLine[] = [];

  for (const id of changes.newEscalationIds) {
    const movement = movementById.get(id);
    if (!movement) continue;
    lines.push({
      id: `escalation:${id}`,
      group: "escalations",
      tone: "warning",
      ...person(nameOf(movement)),
      text: movement.escalation ? `escalated to ${movement.escalation.contact}` : "escalated",
      at: movement.escalation?.at,
      alsoInAlerts: alertMovementIds.has(id),
    });
  }
  for (const id of changes.newReferralIds) {
    const referral = referralById.get(id);
    if (!referral) continue;
    lines.push({
      id: `referral:${id}`,
      group: "referrals",
      tone: "info",
      ...person(nameOf(referral)),
      text: `new referral from ${referral.originSiteCode} · ${referral.ageBand}, ${referral.homeRegion}`,
      at: referral.raisedAt,
    });
  }
  for (const id of changes.newMovementIds) {
    const movement = movementById.get(id);
    if (!movement) continue;
    lines.push({
      id: `journey:${id}`,
      group: "journeys",
      tone: "neutral",
      ...person(nameOf(movement)),
      text: `journey opened at ${originOf(movement, edNames)}`,
      at: movement.openedAt,
    });
  }
  for (const row of changes.acceptanceWithdrawn ?? []) {
    const movement = movementById.get(row.movementId);
    if (!movement) continue;
    const last = movement.unwinds.filter((unwind) => unwind.kind === "acceptance_withdrawn").at(-1);
    lines.push({
      id: `withdrawn:${row.movementId}:${last?.at ?? 0}`,
      group: "acceptances",
      tone: "warning",
      ...person(nameOf(movement)),
      text: `acceptance withdrawn${row.unitName ? ` by ${row.unitName}` : ""}`,
      at: last?.at,
    });
  }
  for (const row of changes.bedsFreed) {
    const before = base?.readyByUnit[row.unitId];
    lines.push({
      id: `beds:${row.unitId}:${(before ?? 0) + row.count}`,
      group: "beds",
      tone: "success",
      who: row.unitName,
      text: before === undefined ? `ready beds up by ${row.count}` : `ready beds ${before} to ${before + row.count}`,
    });
  }
  for (const row of changes.newDelays) {
    const movement = movementById.get(row.movementId);
    if (!movement) continue;
    lines.push({
      id: `delay:${row.movementId}:${row.title}`,
      group: "delays",
      tone: "warning",
      ...person(nameOf(movement)),
      text: `new delay: ${row.title.toLowerCase()}`,
    });
  }
  const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
  for (const row of changes.dischargeDatesMoved ?? []) {
    const admission = admissionById.get(row.admissionId);
    if (!admission) continue;
    lines.push({
      id: `discharge-moved:${row.admissionId}:${admission.dischargeDateSetAt ?? 0}`,
      group: "discharges",
      tone: "neutral",
      ...person(nameOf(admission)),
      text: `expected discharge date moved${row.unitName ? ` · ${row.unitName}` : ""}`,
      at: admission.dischargeDateSetAt ?? undefined,
    });
  }

  const order = new Map(CHANGE_GROUPS.map((group, index) => [group.id, index]));
  return lines.sort((a, b) => (order.get(a.group) ?? 0) - (order.get(b.group) ?? 0) || (b.at ?? 0) - (a.at ?? 0));
}

/**
 * A review the coordinator made: the picture it covers, and the review before it (for Undo). The
 * mock-up's starting review has no picture (none was taken at 09:30), so it reads recorded times
 * from that instant instead.
 */
type Review = { at: Instant; snapshot?: LastLookSnapshot; previous: Review | undefined };

/** Preview only: the demo opens as if the coordinator last reviewed at 09:30 this shift. */
const DEMO_LAST_REVIEW_MINUTE = 9 * 60 + 30;

function demoStartingReview(now: Instant): Review | undefined {
  const at = dayOf(now) * MINUTES_PER_DAY + DEMO_LAST_REVIEW_MINUTE;
  return at > currentShiftStartInstant(now) && at < now ? { at, previous: undefined } : undefined;
}

/** What the open panel shows: the lines captured when it opened, and the picture taken then. */
type Capture = { snapshot: LastLookSnapshot; lines: readonly ChangeLine[] };

/**
 * Explicit review, held in component state for the mock-up (nothing in the app's reducer or
 * storage changes). Opening, scrolling, switching tabs and closing mark nothing. "Mark reviewed"
 * covers the captured lines only: anything that arrives while the panel is open is compared against
 * the picture taken at opening, so it stays new.
 */
export function useExplicitReview({
  world,
  now,
  thresholds,
  lineContext,
}: {
  world: LastLookWorld;
  now: Instant;
  thresholds: DueSoonThresholds;
  lineContext: Omit<LineContext, "base">;
}) {
  const [review, setReview] = useState<Review | undefined>(() => demoStartingReview(now));
  const [capture, setCapture] = useState<Capture | undefined>(undefined);
  const [lastReviewed, setLastReviewed] = useState<{ count: number; at: Instant } | undefined>(undefined);
  const shiftStart = currentShiftStartInstant(now);

  const linesFor = useCallback(
    (basis: Review | undefined): ChangeLine[] => {
      const current = takeLastLookSnapshot(world, now, thresholds);
      // The window never starts before this shift began, whatever the last review was.
      const inShift = basis !== undefined && basis.at >= shiftStart;
      const compared = inShift && basis.snapshot ? changesSinceLastLook(basis.snapshot, current, world) : undefined;
      const changes = compared ?? changesSinceInstant(world, inShift ? basis.at : shiftStart, now);
      return changeLines(changes, { ...lineContext, base: compared ? basis?.snapshot : undefined });
    },
    [world, now, thresholds, shiftStart, lineContext],
  );

  /** Lines awaiting review right now (the hero chip's count). */
  const live = useMemo(() => linesFor(review), [linesFor, review]);
  const capturedIds = useMemo(() => new Set(capture?.lines.map((line) => line.id)), [capture]);
  const arrived = capture ? live.filter((line) => !capturedIds.has(line.id)) : [];

  const recapture = useCallback(
    (basis: Review | undefined) =>
      setCapture({ snapshot: takeLastLookSnapshot(world, now, thresholds), lines: linesFor(basis) }),
    [world, now, thresholds, linesFor],
  );

  return {
    live,
    shown: capture?.lines ?? live,
    arrived,
    reviewedAt: review && review.at >= shiftStart ? review.at : undefined,
    shiftStart,
    lastReviewed,
    /** Called when the panel opens: the lines it shows are fixed until Show or a review. */
    capture: () => {
      setLastReviewed(undefined);
      recapture(review);
    },
    /** "N more arrived since you opened this · Show". */
    showArrived: () => recapture(review),
    markReviewed: () => {
      if (!capture) return;
      const next: Review = { at: now, snapshot: capture.snapshot, previous: review };
      setReview(next);
      setLastReviewed({ count: capture.lines.length, at: now });
      recapture(next);
    },
    undo: () => {
      const previous = review?.previous;
      setReview(previous);
      setLastReviewed(undefined);
      recapture(previous);
    },
  };
}
