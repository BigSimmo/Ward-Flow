import { describe, expect, it } from "vitest";
import {
  lateNoticeSentence,
  lateNoticeTargets,
  reconcileLateNotices,
  type LateNoticeMovement,
  type LateNoticePlan,
} from "@/components/ward-management/ward-late-notices";
import { appendNotices, makeNotice, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { Movement, Notice } from "@/components/ward-management/ward-model";

/**
 * Late arrivals (D-221 items 2, 4, 6, 7): the stored late notice, scheduled at the save with
 * raisedAt = expected time + 60, reconciled on a new time, arrival and diversion. Pure planning
 * only; the reducer applies the plan in phase 2. Synthetic records only.
 */

const ETA = 11 * 60 + 5; // 11:05 am
const LATE_AT = ETA + 60; // 12:05 pm
const SAVED = ETA - 40;

type Job = NonNullable<Movement["transport"]>;

function journey(
  options: {
    wardEta?: number;
    bookingEta?: number;
    job?: Partial<Job>;
    stage?: Movement["stage"];
    closed?: boolean;
    originEdId?: string;
    community?: string;
    acceptedUnitId?: string | null;
  } = {},
): LateNoticeMovement {
  const hasJob = options.bookingEta !== undefined || options.job !== undefined;
  return {
    id: "WF-SYN-1",
    stage: options.stage ?? "moving",
    originEdId: options.community !== undefined ? undefined : (options.originEdId ?? "syn-ed"),
    originCommunity: options.community !== undefined ? { teamName: options.community, siteCode: "SYN" } : undefined,
    acceptedUnitId: options.acceptedUnitId === null ? undefined : (options.acceptedUnitId ?? "syn-ward"),
    closure: options.closed ? { at: 0, outcome: "did_not_proceed", reason: "synthetic" } : undefined,
    arrivalDetails:
      options.wardEta === undefined
        ? undefined
        : { mode: "hospital_transfer", estimatedArrivalAt: options.wardEta, recordedAt: 0, recordedBy: "ed" },
    transport: hasJob
      ? {
          id: "TR-SYN",
          provider: "Patient transport service",
          escortRequired: false,
          estimatedAt: options.bookingEta,
          ...options.job,
        }
      : undefined,
  } as LateNoticeMovement;
}

/** What the phase-2 reducer will do with a plan: drop the cancelled ids, add the drafts through the
 * existing notice id rule and gate, and set the marker. */
function apply(notices: readonly Notice[], plan: LateNoticePlan, movement: LateNoticeMovement) {
  const kept = notices.filter((notice) => !plan.cancel.includes(notice.id));
  const drafts = plan.schedule.map((draft, index) =>
    makeNotice(draft.raisedAt, kept.length + index, draft.kind, draft.to, draft.about, draft.sentence),
  );
  const state = appendNotices({ ...seedWardFlowState(), notices: kept }, drafts);
  return { notices: state.notices, movement: { ...movement, arrivalLateNotifiedAt: plan.marker } };
}

/** Reconcile one save (before -> after) and apply it. */
function save(
  notices: readonly Notice[],
  before: LateNoticeMovement | undefined,
  after: LateNoticeMovement,
  now: number,
) {
  const plan = reconcileLateNotices({ before, after, notices, now });
  return { plan, ...apply(notices, plan, after) };
}

function late(notices: readonly Notice[]) {
  return notices.filter((notice) => notice.kind === "arrival_late_referrer" || notice.kind === "arrival_late_ward");
}

describe("scheduling at the save", () => {
  it("a saved ETA schedules one pair at ETA + 60, to the sending ED and the accepting ward", () => {
    const { plan, notices, movement } = save([], undefined, journey({ wardEta: ETA }), SAVED);
    expect(plan.cancel).toEqual([]);
    expect(plan.marker).toBe(LATE_AT);
    expect(movement.arrivalLateNotifiedAt).toBe(LATE_AT);
    expect(late(notices).map((notice) => [notice.kind, notice.to, notice.raisedAt])).toEqual([
      ["arrival_late_referrer", { role: "ed", placeId: "syn-ed" }, LATE_AT],
      ["arrival_late_ward", { role: "ward", placeId: "syn-ward" }, LATE_AT],
    ]);
    expect(notices[1]!.about).toEqual({ movementId: "WF-SYN-1", unitId: "syn-ward" });
    expect(notices[0]!.sentence).toBe(
      "Arrival is more than 60 minutes past the estimate (11:05 am) and they have not arrived.",
    );
  });

  it("is hidden from the desk until the minute it is raised", () => {
    const { notices } = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const forWard = (now: number) =>
      notices.filter((notice) => noticeIsForWardChrome(notice, "ward", "syn-ward", now)).length;
    expect(forWard(LATE_AT - 1)).toBe(0);
    expect(forWard(LATE_AT)).toBe(1);
    expect(forWard(LATE_AT + 1)).toBe(1);
  });

  it("is idempotent: the same ETA saved again adds nothing", () => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const again = save(first.notices, first.movement, journey({ wardEta: ETA }), SAVED + 5);
    expect(again.plan).toEqual({ schedule: [], cancel: [], marker: LATE_AT });
    expect(again.notices).toEqual(first.notices);
  });

  it("an untouched journey (same reference) plans nothing", () => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    expect(reconcileLateNotices({ before: first.movement, after: first.movement, notices: [], now: SAVED })).toEqual({
      schedule: [],
      cancel: [],
      marker: LATE_AT,
    });
  });

  it("uses the booking estimate when no ward ETA is recorded, and names it", () => {
    const { notices } = save([], undefined, journey({ bookingEta: ETA }), SAVED);
    expect(late(notices).map((notice) => notice.raisedAt)).toEqual([LATE_AT, LATE_AT]);
    expect(notices[0]!.sentence).toContain("past the booking estimate (11:05 am)");
  });

  it("a community referrer is told on its team page (D-221 item 4)", () => {
    const { notices } = save([], undefined, journey({ wardEta: ETA, community: "Synthetic Hills Team" }), SAVED);
    expect(notices[0]!.to).toEqual({ role: "community", placeId: communityTeamSlug("Synthetic Hills Team") });
    expect(noticeIsForWardChrome(notices[0]!, "community", "synthetic-hills-team", LATE_AT)).toBe(true);
  });

  it("leaves out an addressee that does not resolve", () => {
    expect(lateNoticeTargets(journey({ wardEta: ETA, acceptedUnitId: null })).map((t) => t.kind)).toEqual([
      "arrival_late_referrer",
    ]);
    expect(
      lateNoticeTargets(journey({ wardEta: ETA, community: "" })).map((target) => target.kind),
      "no ED and no named team: no referrer notice",
    ).toEqual(["arrival_late_ward"]);
    const nobody = save([], undefined, journey({ wardEta: ETA, community: "", acceptedUnitId: null }), SAVED);
    expect(nobody.plan).toEqual({ schedule: [], cancel: [], marker: undefined });
  });
});

describe("re-arming on a new ETA", () => {
  it("a new ETA before lateness swaps the unraised pair", () => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const second = save(first.notices, first.movement, journey({ wardEta: ETA + 30 }), SAVED + 10);
    expect(second.plan.cancel).toEqual(first.notices.map((notice) => notice.id));
    expect(late(second.notices).map((notice) => notice.raisedAt)).toEqual([LATE_AT + 30, LATE_AT + 30]);
    expect(second.notices[0]!.sentence).toContain("(11:35 am)");
    expect(second.movement.arrivalLateNotifiedAt).toBe(LATE_AT + 30);
  });

  it("after a lateness was raised, a new ETA keeps the raised pair and schedules a new one", () => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const now = LATE_AT + 20; // the first pair has been raised
    const newEta = now + 15;
    const second = save(first.notices, first.movement, journey({ wardEta: newEta }), now);
    expect(second.plan.cancel).toEqual([]);
    expect(late(second.notices).map((notice) => notice.raisedAt)).toEqual([LATE_AT, LATE_AT, newEta + 60, newEta + 60]);
    expect(second.movement.arrivalLateNotifiedAt).toBe(newEta + 60);
    expect(new Set(second.notices.map((notice) => notice.id)).size).toBe(4);
  });

  it("a ward changing its answer moves the unraised ward notice to the new ward", () => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const moved = journey({ wardEta: ETA, acceptedUnitId: "syn-ward-2" });
    const second = save(first.notices, first.movement, moved, SAVED + 5);
    expect(second.plan.cancel).toEqual([first.notices[1]!.id]);
    expect(second.plan.schedule.map((draft) => draft.to)).toEqual([{ role: "ward", placeId: "syn-ward-2" }]);
  });
});

describe("already late when saved", () => {
  it("a typed ETA already more than an hour past raises the pair now", () => {
    const now = LATE_AT + 30;
    const { plan, notices } = save([], undefined, journey({ wardEta: ETA }), now);
    expect(plan.marker).toBe(now);
    expect(late(notices).map((notice) => notice.raisedAt)).toEqual([now, now]);
  });

  it("touching it again does not tell anyone twice", () => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const touched = save(
      first.notices,
      first.movement,
      { ...journey({ wardEta: ETA }), stage: "moving" },
      LATE_AT + 90,
    );
    expect(touched.plan).toEqual({ schedule: [], cancel: [], marker: LATE_AT });
    expect(touched.notices).toEqual(first.notices);
  });

  it("an old record touched with no notice yet gets its pair (backfill)", () => {
    const backfill = save([], undefined, journey({ wardEta: ETA }), LATE_AT + 300);
    expect(late(backfill.notices)).toHaveLength(2);
    const again = save(backfill.notices, backfill.movement, journey({ wardEta: ETA }), LATE_AT + 301);
    expect(again.plan.schedule).toEqual([]);
  });
});

describe("clearing: arrival, transport arrived unconfirmed, diversion, closure", () => {
  const cases: [string, LateNoticeMovement][] = [
    ["ward confirmed arrival", journey({ wardEta: ETA, stage: "arrived" })],
    ["transport arrived, ward not yet confirmed (not late)", journey({ wardEta: ETA, job: { arrivedAt: ETA + 5 } })],
    [
      "diversion replaces late",
      journey({
        wardEta: ETA,
        job: { diversion: { at: ETA, by: "officer", place: "synthetic", reason: "synthetic" } },
      }),
    ],
    ["journey closed", journey({ wardEta: ETA, closed: true })],
    ["time removed", journey()],
  ];

  it.each(cases)("%s removes the unraised pair and clears the marker", (_name, after) => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const cleared = save(first.notices, first.movement, after, SAVED + 20);
    expect(cleared.plan).toEqual({
      schedule: [],
      cancel: first.notices.map((notice) => notice.id),
      marker: undefined,
    });
    expect(late(cleared.notices)).toEqual([]);
  });

  it.each(cases)("%s after the notice was raised keeps it as history", (_name, after) => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const cleared = save(first.notices, first.movement, after, LATE_AT + 10);
    expect(cleared.plan.cancel).toEqual([]);
    expect(cleared.plan.schedule).toEqual([]);
    expect(cleared.notices).toEqual(first.notices);
  });

  it("a removed journey (Undo) drops its unraised pair", () => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    expect(
      reconcileLateNotices({ before: first.movement, after: undefined, notices: first.notices, now: SAVED + 1 }),
    ).toEqual({ schedule: [], cancel: first.notices.map((notice) => notice.id), marker: undefined });
  });

  it("never removes another journey's notice, or a read one", () => {
    const first = save([], undefined, journey({ wardEta: ETA }), SAVED);
    const other = first.notices.map((notice): Notice => ({
      ...notice,
      id: `${notice.id}-other`,
      about: { movementId: "WF-SYN-2" },
    }));
    const read = { ...first.notices[0]!, readAt: SAVED + 1 };
    const plan = reconcileLateNotices({
      before: first.movement,
      after: journey({ wardEta: ETA, stage: "arrived" }),
      notices: [read, first.notices[1]!, ...other],
      now: SAVED + 2,
    });
    expect(plan.cancel).toEqual([first.notices[1]!.id]);
  });
});

describe("across midnight", () => {
  it("an 11:45 pm ETA is raised at 12:45 am the next day, and its words say so", () => {
    const eta = 23 * 60 + 45;
    const { notices } = save([], undefined, journey({ wardEta: eta }), eta - 30);
    expect(late(notices).map((notice) => notice.raisedAt)).toEqual([MINUTES_PER_DAY + 45, MINUTES_PER_DAY + 45]);
    expect(notices[0]!.sentence).toBe(
      "Arrival is more than 60 minutes past the estimate (11:45 pm yesterday) and they have not arrived.",
    );
    expect(lateNoticeSentence(eta, "ward", eta + 5)).toContain("(11:45 pm)");
  });
});
