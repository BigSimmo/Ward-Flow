import { describe, expect, it } from "vitest";
import {
  delayTimelineScale,
  delayTimelineSegments,
  delayCatchments,
  delayRadarBand,
  delayRadarGroups,
} from "@/components/ward-management/delays/delays-view-model";
import type { Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const arrivalOnly: Movement = {
  ...wardMovements[0],
  openedAt: NOW_ANCHOR - 480,
  declines: [],
  withdrawnReferrals: [],
  transport: undefined,
  escalation: undefined,
  referredAt: undefined,
  formedAt: undefined,
  examination: undefined,
  closure: undefined,
  referralAbsence: undefined,
};

describe("delay timeline measurements", () => {
  it("uses a common linear scale that includes waits beyond 24 hours", () => {
    const longWait = { ...arrivalOnly, openedAt: NOW_ANCHOR - 29 * 60 };
    const scale = delayTimelineScale([arrivalOnly, longWait], NOW_ANCHOR);
    expect(scale).toBe(32 * 60);
    expect(delayTimelineSegments(arrivalOnly, NOW_ANCHOR, scale).totalWidth).toBe(25);
    expect(delayTimelineSegments(longWait, NOW_ANCHOR, scale).totalWidth).toBe(90.625);
  });

  it("does not present opening the journey as a subsequent update", () => {
    const segment = delayTimelineSegments(arrivalOnly, NOW_ANCHOR, 720);
    expect(segment.activity).toBeUndefined();
    expect(segment.beforeWidth).toBe(0);
    expect(segment.quiet).toBe(480);
    expect(segment.quietWidth).toBeCloseTo(66.6667);
  });

  it("locates a recorded update on the same scale as the wait end", () => {
    const segment = delayTimelineSegments({ ...arrivalOnly, referredAt: NOW_ANCHOR - 300 }, NOW_ANCHOR, 720);
    expect(segment.activity?.what).toBe("referral raised");
    expect(segment.beforeWidth).toBe(25);
    expect(segment.quiet).toBe(300);
    expect(segment.beforeWidth + segment.quietWidth).toBeCloseTo(segment.totalWidth);
  });

  it("ignores future updates and produces finite values for an empty population or zero wait", () => {
    expect(delayTimelineScale([], NOW_ANCHOR)).toBe(720);
    const future = delayTimelineSegments({ ...arrivalOnly, referredAt: NOW_ANCHOR + 20 }, NOW_ANCHOR, 720);
    expect(future.activity).toBeUndefined();
    const zero = delayTimelineSegments({ ...arrivalOnly, openedAt: NOW_ANCHOR }, NOW_ANCHOR, 720);
    expect(zero.totalWidth).toBe(0);
    expect(zero.quietWidth).toBe(0);
  });
});

describe("delay graph population and boundaries", () => {
  const state = seedWardFlowState();
  const rows = delayGroups(state.movements, state.units, NOW_ANCHOR).flatMap((group) =>
    group.movements.map((movement) => ({ movement, cause: group.cause })),
  );
  it("counts every origin once despite cross-service referral or destination membership", () => {
    const stats = delayCatchments(rows, NOW_ANCHOR);
    expect(stats.map((entry) => [entry.origin, entry.total, entry.over8, entry.over24])).toEqual([
      ["North Metro", 12, 5, 1],
      ["East Metro", 35, 7, 2],
      ["South Metro", 23, 7, 2],
      ["WACHS", 0, 0, 0],
    ]);
    expect(stats.reduce((sum, entry) => sum + entry.total, 0)).toBe(rows.length);
    expect(new Set(stats.flatMap((entry) => entry.people.map((record) => record.movement.id))).size).toBe(rows.length);
  });
  it("keeps unrecorded origins visible and uses minutes at both wait thresholds", () => {
    const records = [479, 480, 1439, 1440].map((wait, index) => ({
      movement: {
        ...arrivalOnly,
        id: `WF-unknown-${index}` as const,
        originEdId: "ED-UNKNOWN",
        openedAt: NOW_ANCHOR - wait,
      },
      cause: "awaiting_coordinator" as const,
    }));
    const unknown = delayCatchments(records, NOW_ANCHOR).find((entry) => entry.origin === "unrecorded");
    expect(unknown).toMatchObject({
      total: 4,
      over8: 3,
      over12: 2,
      over24: 1,
      stillWaiting4hAgo: 4,
      stillWaiting8hAgo: 3,
      expectedOver8: 4,
      expectedOver12: 3,
    });
  });
  it("reconciles grouped radar intervals and keeps all outliers outside the linear axis", () => {
    const graph = delayRadarGroups(rows, NOW_ANCHOR);
    expect(graph.lanes.map((lane) => lane.all.length)).toEqual([0, 1, 15, 54]);
    expect(graph.lanes[2].bins.map((bin) => bin.people.length)).toEqual([3, 7, 3, 2]);
    expect(graph.lanes[3].bins.map((bin) => bin.people.length)).toEqual([29, 12, 4, 4]);
    expect(graph.visible.length).toBe(65);
    expect(graph.beyond.length).toBe(5);
    expect(graph.lanes.flatMap((lane) => lane.bins.flatMap((bin) => bin.people))).toHaveLength(graph.visible.length);
  });
  it("includes exact 24h in the last interval and places 24h1m in the outlier list", () => {
    const records = [239, 240, 1439, 1440, 1441].map((wait, index) => ({
      movement: {
        ...arrivalOnly,
        id: `WF-boundary-${index}` as const,
        legalForm: undefined,
        urgency: 3 as const,
        openedAt: NOW_ANCHOR - wait,
      },
      cause: "awaiting_coordinator" as const,
    }));
    const graph = delayRadarGroups(records, NOW_ANCHOR);
    expect(graph.visible).toHaveLength(4);
    expect(graph.beyond).toHaveLength(1);
    expect(graph.lanes[3].bins.map((bin) => bin.people.length)).toEqual([1, 1, 2]);
  });
  it("gives recorded due times precedence over T1 and never invents a deadline", () => {
    const timed = rows.find(({ movement }) => movement.legalForm?.dueAt !== undefined)!.movement;
    for (const [due, band] of [
      [-1, "breached"],
      [0, "imminent"],
      [60, "imminent"],
      [61, "severe"],
      [180, "severe"],
      [181, "routine"],
    ] as const) {
      expect(
        delayRadarBand(
          { ...timed, urgency: 1, legalForm: { ...timed.legalForm!, dueAt: NOW_ANCHOR + due } },
          NOW_ANCHOR,
        ),
      ).toBe(band);
    }
    expect(delayRadarBand({ ...arrivalOnly, legalForm: undefined, urgency: 1 }, NOW_ANCHOR)).toBe("severe");
    expect(delayRadarBand({ ...arrivalOnly, legalForm: undefined, urgency: 3 }, NOW_ANCHOR)).toBe("routine");
  });
});
