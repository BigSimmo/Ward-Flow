import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import {
  ARRIVAL_LATE_GRACE_MINUTES,
  arrivalTiming,
  type ArrivalTimeSource,
  type ArrivalTimingMovement,
} from "@/components/ward-management/ward-arrival-timing";
import { formatClockAmPmWithDay } from "@/components/ward-management/ward-clock-am-pm";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Notice } from "@/components/ward-management/ward-model";

/**
 * THE STORED LATE NOTICE, SCHEDULED WHEN THE TIME IS SAVED (Josh, 14 Nov 2026, D-221 items 2, 4, 7).
 *
 * The late moment is fixed by the saved time: expected arrival plus the signed grace. So the save
 * that records (or changes) the time stores the referrer's and the accepting ward's notices at
 * once, with `raisedAt` = that moment. Every desk view already hides a notice until
 * `raisedAt <= now` (`noticeIsForWardChrome`), so they appear on the minute with no timer, no
 * system actor and no server sweep, and the desk that saved the time is the true writer.
 *
 * This file only PLANS: given a journey before and after a save and the notices already stored, it
 * says which late notices to add and which not-yet-raised ones to remove. Applying the plan (ids
 * through `makeNotice`, `appendNotices`, the marker) is the reducer's job in phase 2.
 *
 * Rules, per journey:
 * - Wanted while `arrivalTiming` gives an expected time: open, not arrived (by stage or by
 *   transport), not diverted. Diverted, arrived, closed or no time: nothing new, and every
 *   unraised late notice is removed (nobody has seen it, so nothing is lost).
 * - Not yet late: exactly one pair at `lateAt`; any other unraised pair is removed. A new ETA
 *   therefore swaps the pair, and re-arms after an earlier lateness was already notified.
 * - Already late when saved (a typed time already past, or an old record touched): a pair raised
 *   now, unless that addressee was already told at or after this `lateAt`.
 * - Raised notices always stay, read or not: they are the record of what somebody was told.
 * - Idempotent: planning again over the applied result gives an empty plan.
 */
type LateNoticeKind = Extract<Notice["kind"], "arrival_late_referrer" | "arrival_late_ward">;

const LATE_NOTICE_KINDS: ReadonlySet<Notice["kind"]> = new Set<LateNoticeKind>([
  "arrival_late_referrer",
  "arrival_late_ward",
]);

/** A notice to store, without its id: the reducer gives it one through `makeNotice`. */
type LateNoticeDraft = Pick<Notice, "raisedAt" | "to" | "about" | "sentence"> & { kind: LateNoticeKind };

export type LateNoticePlan = {
  schedule: LateNoticeDraft[];
  /** Ids of stored, unraised, unread late notices to remove. */
  cancel: string[];
  /** The value for `arrivalLateNotifiedAt`: the wanted pair's `raisedAt`, or cleared. */
  marker: Instant | undefined;
};

export type LateNoticeMovement = ArrivalTimingMovement &
  Pick<Movement, "id" | "originEdId" | "originCommunity" | "acceptedUnitId" | "arrivalLateNotifiedAt">;

type LateNoticeTarget = Pick<LateNoticeDraft, "kind" | "to" | "about">;

/**
 * Who is told: the referrer (the sending ED, or the referring community team, D-221 item 4) and
 * the accepting ward. A referrer that resolves to no place is left out rather than addressed to a
 * placeless `ed`, which only statewide seats could ever see.
 */
export function lateNoticeTargets(movement: LateNoticeMovement): LateNoticeTarget[] {
  const targets: LateNoticeTarget[] = [];
  const teamName = movement.originCommunity?.teamName;
  if (movement.originEdId !== undefined) {
    targets.push({
      kind: "arrival_late_referrer",
      to: { role: "ed", placeId: movement.originEdId },
      about: { movementId: movement.id },
    });
  } else if (teamName !== undefined && teamName !== "") {
    targets.push({
      kind: "arrival_late_referrer",
      to: { role: "community", placeId: communityTeamSlug(teamName) },
      about: { movementId: movement.id },
    });
  }
  if (movement.acceptedUnitId !== undefined) {
    targets.push({
      kind: "arrival_late_ward",
      to: { role: "ward", placeId: movement.acceptedUnitId },
      about: { movementId: movement.id, unitId: movement.acceptedUnitId },
    });
  }
  return targets;
}

/**
 * The stored words. No record numbers (D-39). The time carries its day relative to the moment the
 * notice is raised, which is the moment it is true for; the notice's own `raisedAt` sits beside it.
 */
export function lateNoticeSentence(eta: Instant, source: ArrivalTimeSource, raisedAt: Instant): string {
  const estimate = source === "ward" ? "the estimate" : "the booking estimate";
  return `Arrival is more than ${ARRIVAL_LATE_GRACE_MINUTES} minutes past ${estimate} (${formatClockAmPmWithDay(eta, raisedAt)}) and they have not arrived.`;
}

function isLateNoticeFor(notice: Notice, movementId: string): boolean {
  return notice.about.movementId === movementId && LATE_NOTICE_KINDS.has(notice.kind);
}

function sameTarget(notice: Pick<Notice, "kind" | "to" | "about">, target: LateNoticeTarget): boolean {
  return (
    notice.kind === target.kind &&
    notice.to.role === target.to.role &&
    notice.to.placeId === target.to.placeId &&
    notice.about.unitId === target.about.unitId
  );
}

function sameDraft(notice: Notice, draft: LateNoticeDraft): boolean {
  return sameTarget(notice, draft) && notice.raisedAt === draft.raisedAt && notice.sentence === draft.sentence;
}

export function reconcileLateNotices({
  before,
  after,
  notices,
  now,
}: {
  /** The journey before the save; `undefined` for a seed or backfill pass. */
  before: LateNoticeMovement | undefined;
  /** The journey after the save; `undefined` when the save removed it (an Undo). */
  after: LateNoticeMovement | undefined;
  /** Every stored notice after the save's own notices were added. */
  notices: readonly Notice[];
  now: Instant;
}): LateNoticePlan {
  // Untouched journey: nothing to plan (the reducer compares references, as here).
  if (after !== undefined && before === after) {
    return { schedule: [], cancel: [], marker: after.arrivalLateNotifiedAt };
  }
  const movementId = after?.id ?? before?.id;
  if (movementId === undefined) return { schedule: [], cancel: [], marker: undefined };

  const stored = notices.filter((notice) => isLateNoticeFor(notice, movementId));
  const unraised = stored.filter((notice) => notice.raisedAt > now && notice.readAt === undefined);
  const timing = after === undefined ? ({ state: "none" } as const) : arrivalTiming(after, now);

  if (after === undefined || timing.state === "none" || timing.state === "diverted") {
    return { schedule: [], cancel: unraised.map((notice) => notice.id), marker: undefined };
  }

  const targets = lateNoticeTargets(after);
  const { lateAt } = timing;

  if (lateAt > now) {
    const wanted = targets.map((target): LateNoticeDraft => ({
      ...target,
      raisedAt: lateAt,
      sentence: lateNoticeSentence(timing.eta, timing.source, lateAt),
    }));
    const kept = unraised.filter((notice) => wanted.some((draft) => sameDraft(notice, draft)));
    return {
      schedule: wanted.filter((draft) => !kept.some((notice) => sameDraft(notice, draft))),
      cancel: unraised.filter((notice) => !kept.includes(notice)).map((notice) => notice.id),
      marker: wanted.length > 0 ? lateAt : undefined,
    };
  }

  // Already late when saved: tell anyone not yet told about THIS lateness, now.
  const schedule: LateNoticeDraft[] = [];
  let marker: Instant | undefined;
  for (const target of targets) {
    const told = stored.filter(
      (notice) => notice.raisedAt <= now && notice.raisedAt >= lateAt && sameTarget(notice, target),
    );
    if (told.length > 0) {
      const at = Math.max(...told.map((notice) => notice.raisedAt));
      marker = marker === undefined ? at : Math.max(marker, at);
      continue;
    }
    schedule.push({ ...target, raisedAt: now, sentence: lateNoticeSentence(timing.eta, timing.source, now) });
    marker = now;
  }
  return { schedule, cancel: unraised.map((notice) => notice.id), marker };
}
