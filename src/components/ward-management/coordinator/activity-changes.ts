"use client";

import { useCallback, useMemo, useState } from "react";
import { HOME_REGION_NOT_RECORDED, ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";

import type { WfTone } from "@/components/wf";
import {
  changesSinceInstant,
  changesSinceLastLook,
  type ChangesSinceLastLook,
  type LastLookSnapshot,
  lookIsUsable,
} from "./since-last-look";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import { isQueueItem } from "@/components/ward-management/alerts/alerts-model";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { useSinceLastLook } from "./since-last-look-panel";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { shiftLookWindowStart } from "@/components/ward-management/shift-first-look";
import { nightMovementChanges, type NightMovementChange } from "@/components/ward-management/night-movement-changes";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { communityOriginLabel } from "@/components/ward-management/ward-movement-origin";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * The Changes tab of Home's Activity panel (Home and Activity design, approved by Josh 31 Oct 2026). Every line comes from the real
 * "since last look" comparison (`since-last-look.ts`): before any review this shift it reads
 * recorded times since the previous shift began (`changesSinceInstant`, item 11: the day
 * coordinator's first look covers the whole night); after a review it compares the
 * world with the picture saved at that review (`changesSinceLastLook`). Each line counts
 * once: a ward's ready beds going up is one line, never one per bed.
 */
type ChangeGroupId =
  | "escalations"
  | "absences"
  | "referrals"
  | "journeys"
  | "transfers"
  | "acceptances"
  | "beds"
  | "delays"
  | "discharges";

export const CHANGE_GROUPS: readonly { id: ChangeGroupId; label: string }[] = [
  { id: "escalations", label: "Escalations" },
  { id: "absences", label: "Absent without leave" },
  { id: "referrals", label: "Referrals" },
  { id: "journeys", label: "New ED movements" },
  { id: "transfers", label: "Transfers" },
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

/**
 * Copy as handover text (Josh, 31 Oct 2026): the changes shown, by group. Patient lines carry what
 * changed and when, never the person's name; a bed line keeps its ward. The clipboard helper adds
 * the synthetic line first and strips record numbers (D-71).
 */
export function changesHandoverText(
  lines: readonly ChangeLine[],
  sinceLabel: string,
  clock: (at: Instant) => string,
): string {
  const head = `Changes ${sinceLabel.charAt(0).toLowerCase()}${sinceLabel.slice(1)}: ${lines.length}`;
  const groups = CHANGE_GROUPS.flatMap((group) => {
    const shown = lines.filter((line) => line.group === group.id);
    if (shown.length === 0) return [];
    return [
      `${group.label} (${shown.length})`,
      ...shown.map((line) => {
        const when = line.at === undefined ? "" : `${clock(line.at)} `;
        return group.id === "beds" ? `- ${when}${line.who}: ${line.text}` : `- ${when}${line.text}`;
      }),
    ];
  });
  return [head, ...groups].join("\n");
}

type LineContext = {
  referrals: readonly Referral[];
  movements: readonly Movement[];
  admissions: readonly Admission[];
  base: LastLookSnapshot | undefined;
  nameOf: (subject: Movement | Referral | Admission) => ResolvedPatientInfo;
  alertMovementIds: ReadonlySet<string>;
  /** Item 11: absences and transfers in the window, from recorded times (`night-movement-changes.ts`). */
  nightMoves: readonly NightMovementChange[];
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
      text: `new referral from ${referral.originSiteCode ?? ORIGIN_NOT_RECORDED} · ${referral.ageBand}, ${referral.homeRegion ?? HOME_REGION_NOT_RECORDED}`,
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

  for (const move of context.nightMoves) {
    const admission = admissionById.get(move.admissionId);
    lines.push({
      id: `${move.kind}:${move.admissionId}:${move.at}`,
      group: move.kind === "absence" ? "absences" : "transfers",
      tone: move.kind === "absence" ? "warning" : "neutral",
      ...(admission ? person(nameOf(admission)) : { who: "Patient not recorded" }),
      text: move.text,
      at: move.at,
    });
  }

  const order = new Map(CHANGE_GROUPS.map((group, index) => [group.id, index]));
  return lines.sort((a, b) => (order.get(a.group) ?? 0) - (order.get(b.group) ?? 0) || (b.at ?? 0) - (a.at ?? 0));
}

/** What the open panel shows: the lines captured when it opened, and the picture taken then. */
type Capture = {
  snapshot: LastLookSnapshot;
  lines: readonly ChangeLine[];
  reviewedAt?: Instant;
  shiftStart: Instant;
  /** Where unreviewed lines count from: the previous shift's start on a first look (item 11). */
  windowStart: Instant;
};

/**
 * Home's changes since the coordinator's last review, read from the store, so the hero chip and the
 * Activity panel (wherever it opens from) count the same lines. The last review is saved in this
 * browser session only (`useSinceLastLook` in its explicit mode): opening, scrolling, switching tabs,
 * closing or leaving the screen marks nothing.
 */
function useHomeChanges(now: Instant) {
  const store = useWardFlowSelect(
    "scenario",
    "referrals",
    "movements",
    "units",
    "bedReleases",
    "admissions",
    "configuration",
    "inboxSnoozes",
    "patients",
    "supportNotifications",
    "plannedAdmissions",
    "leaveBeds",
  );
  const { scenario, referrals, movements, units, bedReleases, admissions, leaveBeds } = store;
  const world = useMemo(
    () => ({ scenario, referrals, movements, units, bedReleases, admissions }),
    [scenario, referrals, movements, units, bedReleases, admissions],
  );
  const { previous: stored, current, saveReview } = useSinceLastLook(world, now, { explicit: true });
  const nameOf = usePatientOf();
  // An escalation that is also an open alert says so, from the same task list as the header badge.
  const alertMovementIds = useMemo(() => {
    const items = activeTaskItems(
      {
        movements: store.movements,
        units: store.units,
        configuration: store.configuration,
        inboxSnoozes: store.inboxSnoozes,
        admissions: store.admissions,
        patients: store.patients,
        referrals: store.referrals,
        supportNotifications: store.supportNotifications,
        plannedAdmissions: store.plannedAdmissions,
        leaveBeds: store.leaveBeds,
        stuckHandoverMinutes: store.configuration.transportBookedTargetMinutes,
      },
      now,
    );
    return new Set(items.filter(isQueueItem).flatMap((item) => (item.movementId ? [item.movementId] : [])));
  }, [store, now]);
  const shiftStart = currentShiftStartInstant(now);
  // A review from an earlier shift, another account or another world counts from the shift start,
  // and the words then say so ("since 07:00"), never "since your review".
  // Audit L4, D-210 (Josh, 14 Nov 2026): Home's since banner takes or sets aside the same review by
  // the same test (`lookIsUsable`), and counts from the same window.
  const usable = useCallback(
    (basis: LastLookSnapshot | undefined): basis is LastLookSnapshot => lookIsUsable(basis, current, now),
    [now, current],
  );
  const reviewedAt = usable(stored) ? stored.at : undefined;
  // Item 11: with no review this shift, lines count from the previous shift's start.
  const windowStart = shiftLookWindowStart(undefined, now);

  const linesFor = useCallback(
    (basis: LastLookSnapshot | undefined): ChangeLine[] => {
      const compared = usable(basis) ? changesSinceLastLook(basis, current, world) : undefined;
      const changes = compared ?? changesSinceInstant(world, windowStart, now);
      const since = compared ? compared.since : windowStart;
      const nightMoves = nightMovementChanges({ admissions, leaveBeds, units }, since, now);
      return changeLines(changes, {
        nightMoves,
        referrals,
        movements,
        admissions,
        nameOf,
        alertMovementIds,
        base: compared ? basis : undefined,
      });
    },
    [
      usable,
      windowStart,
      now,
      current,
      world,
      referrals,
      movements,
      admissions,
      leaveBeds,
      units,
      nameOf,
      alertMovementIds,
    ],
  );
  /** Lines awaiting review right now (the hero chip's count). */
  const live = useMemo(() => linesFor(stored), [linesFor, stored]);
  return {
    live,
    linesFor,
    reviewedAt,
    shiftStart,
    windowStart,
    stored,
    current,
    validReview: usable,
    save: saveReview,
  };
}

/**
 * Explicit review for the open Activity panel. "Mark reviewed" covers the captured lines only:
 * anything that arrives while the panel is open is compared against the picture taken at opening, so
 * it stays new. Undo puts the previous review back.
 */
export function useExplicitReview(now: Instant) {
  const changes = useHomeChanges(now);
  const [capture, setCapture] = useState<Capture | undefined>(undefined);
  const [lastReviewed, setLastReviewed] = useState<
    { count: number; at: Instant; previous: LastLookSnapshot | undefined } | undefined
  >(undefined);
  const { live, linesFor, stored, current, save, validReview, shiftStart, windowStart } = changes;
  const capturedIds = useMemo(() => new Set(capture?.lines.map((line) => line.id)), [capture]);
  const arrived = capture ? live.filter((line) => !capturedIds.has(line.id)) : [];
  const recapture = useCallback(
    (basis: LastLookSnapshot | undefined) =>
      setCapture({
        snapshot: current,
        lines: linesFor(basis),
        reviewedAt: validReview(basis) ? basis.at : undefined,
        shiftStart,
        windowStart,
      }),
    [current, linesFor, validReview, shiftStart, windowStart],
  );

  return {
    live,
    shown: capture?.lines ?? live,
    arrived,
    reviewedAt: capture ? capture.reviewedAt : changes.reviewedAt,
    shiftStart: capture ? capture.shiftStart : changes.shiftStart,
    windowStart: capture ? capture.windowStart : changes.windowStart,
    lastReviewed,
    /** Called when the panel opens: the lines it shows are fixed until Show or a review. */
    capture: () => {
      setLastReviewed(undefined);
      recapture(stored);
    },
    /** "N more arrived since you opened this · Show". */
    showArrived: () => recapture(stored),
    markReviewed: () => {
      if (!capture) return;
      save(capture.snapshot);
      setLastReviewed({ count: capture.lines.length, at: now, previous: stored });
      recapture(capture.snapshot);
    },
    undo: () => {
      const previous = lastReviewed?.previous;
      save(previous);
      setLastReviewed(undefined);
      recapture(previous);
    },
  };
}
