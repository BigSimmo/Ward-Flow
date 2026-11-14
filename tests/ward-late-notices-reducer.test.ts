import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { arrivalTiming } from "@/components/ward-management/ward-arrival-timing";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import { raisedNotices } from "@/components/ward-management/ward-late-notices";
import type { Movement, Notice } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-221 (Josh, 14 Nov 2026), the reducer wiring: every save that changes a journey reconciles its
 * stored late notices (scheduled at the save, raised at the first late minute), the backfill event
 * reconciles on request, a notice not yet raised cannot be marked read, and the seed's late journey
 * has its pair. Synthetic records only.
 */

const NOW = NOW_ANCHOR;
const LATE_KINDS = new Set<Notice["kind"]>(["arrival_late_referrer", "arrival_late_ward"]);

/** One open synthetic journey accepted by a ward, sent from an ED, with no time recorded yet. */
function start(): { state: WardFlowState; movement: Movement } {
  const seed = seedWardFlowState();
  const source = seed.movements.find(
    (movement) => movement.originEdId && movement.acceptedUnitId && !movement.closure && movement.stage === "pulled",
  )!;
  expect(source, "a seeded pulled journey").toBeDefined();
  const movement: Movement = { ...source, id: "WF-SYN-LATE", arrivalDetails: undefined, transport: undefined };
  delete movement.arrivalLateNotifiedAt;
  return { state: { ...seed, movements: [...seed.movements, movement] }, movement };
}

function setEta(state: WardFlowState, movementId: string, eta: number, now = NOW): WardFlowState {
  return wardFlowReducer(state, {
    type: "SET_ARRIVAL_DETAILS",
    role: "coordinator",
    now,
    movementId,
    arrivalMode: "hospital_transfer",
    estimatedArrivalAt: eta,
  });
}

const lateFor = (state: WardFlowState, movementId: string) =>
  state.notices.filter((notice) => notice.about.movementId === movementId && LATE_KINDS.has(notice.kind));
const journey = (state: WardFlowState, movementId: string) =>
  state.movements.find((movement) => movement.id === movementId)!;

describe("a saved ETA stores the late pair", () => {
  it("schedules both notices at the first minute the tag reads late, by the desk that saved", () => {
    const { state, movement } = start();
    const eta = NOW + 30;
    const saved = setEta(state, movement.id, eta);
    expect(saved.rejections).toEqual(state.rejections);
    const pair = lateFor(saved, movement.id);
    expect(pair.map((notice) => [notice.kind, notice.raisedAt])).toEqual([
      ["arrival_late_referrer", eta + 61],
      ["arrival_late_ward", eta + 61],
    ]);
    expect(journey(saved, movement.id).arrivalLateNotifiedAt).toBe(eta + 61);
    // The tag and the notice appear at the same minute, never one before the other.
    for (const minute of [eta + 60, eta + 61]) {
      const tagLate = arrivalTiming(journey(saved, movement.id), minute).state === "late";
      const shown = noticeIsForWardChrome(pair[1]!, "ward", movement.acceptedUnitId, minute);
      expect(shown, `minute ETA + ${minute - eta}`).toBe(tagLate);
    }
  });

  it("a new ETA moves the unraised pair; arrival withdraws it", () => {
    const { state, movement } = start();
    const first = setEta(state, movement.id, NOW + 30);
    const moved = setEta(first, movement.id, NOW + 90, NOW + 5);
    expect(lateFor(moved, movement.id).map((notice) => notice.raisedAt)).toEqual([NOW + 151, NOW + 151]);
    // No transport needed (recorded at the pull), so the ward can confirm arrival from here.
    const onTheWay: WardFlowState = {
      ...moved,
      movements: moved.movements.map((candidate) =>
        candidate.id === movement.id ? { ...candidate, transportNeed: { needed: false, at: NOW } } : candidate,
      ),
    };
    const arrived = wardFlowReducer(onTheWay, {
      type: "PATIENT_ARRIVED",
      role: "coordinator",
      now: NOW + 40,
      movementId: movement.id,
    });
    expect(arrived.rejections.slice(onTheWay.rejections.length).map((r) => r.reason)).toEqual([]);
    expect(journey(arrived, movement.id).stage).toBe("arrived");
    expect(lateFor(arrived, movement.id)).toEqual([]);
    expect(journey(arrived, movement.id).arrivalLateNotifiedAt).toBeUndefined();
  });

  it("a typed ETA already over an hour past is raised now", () => {
    const { state, movement } = start();
    const saved = setEta(state, movement.id, NOW - 90);
    expect(lateFor(saved, movement.id).map((notice) => notice.raisedAt)).toEqual([NOW, NOW]);
  });
});

describe("the backfill event and reading", () => {
  it("EVALUATE_ARRIVAL_LATENESS stores the pair for an old record, then changes nothing", () => {
    const { state, movement } = start();
    const old: WardFlowState = {
      ...state,
      movements: state.movements.map((candidate) =>
        candidate.id === movement.id
          ? {
              ...candidate,
              arrivalDetails: {
                mode: "hospital_transfer",
                estimatedArrivalAt: NOW - 90,
                recordedAt: NOW - 120,
                recordedBy: "ed",
              },
            }
          : candidate,
      ),
    };
    const event = { type: "EVALUATE_ARRIVAL_LATENESS" as const, role: "coordinator" as const, movementId: movement.id };
    const once = wardFlowReducer(old, { ...event, now: NOW });
    expect(lateFor(once, movement.id)).toHaveLength(2);
    const twice = wardFlowReducer(once, { ...event, now: NOW + 10 });
    expect(twice.notices).toBe(once.notices);
  });

  it("a notice not yet raised cannot be marked read; once raised it can", () => {
    const { state, movement } = start();
    const eta = NOW + 30;
    const saved = setEta(state, movement.id, eta);
    const ward = lateFor(saved, movement.id).find((notice) => notice.kind === "arrival_late_ward")!;
    const read = (now: number) =>
      wardFlowReducer(saved, {
        type: "MARK_NOTICE_READ",
        role: "ward",
        now,
        noticeId: ward.id,
        actingPlaceId: movement.acceptedUnitId,
      });
    const early = read(eta + 60);
    expect(early.rejections.length).toBe(saved.rejections.length + 1);
    expect(early.rejections.at(-1)!.reason).toMatch(/not been raised yet/u);
    const onTime = read(eta + 61);
    expect(onTime.rejections).toEqual(saved.rejections);
    expect(onTime.notices.find((notice) => notice.id === ward.id)!.readAt).toBe(eta + 61);
  });
});

describe("listing", () => {
  it("lists a stored late notice from its first late minute, keeping the array while nothing changes", () => {
    const { state, movement } = start();
    const eta = NOW + 30;
    const saved = setEta(state, movement.id, eta);
    const pending = new Set(lateFor(saved, movement.id).map((notice) => notice.id));
    const early = raisedNotices(saved.notices, eta + 60);
    expect(early.some((notice) => pending.has(notice.id))).toBe(false);
    expect(raisedNotices(saved.notices, eta + 59)).toBe(early);
    const raised = raisedNotices(saved.notices, eta + 61);
    expect(raised).toBe(saved.notices);
    expect(raisedNotices(state.notices, NOW)).toBe(state.notices);
  });
});

describe("the seed", () => {
  it("every seeded journey already late has its stored pair, and a marker that matches", () => {
    const seed = seedWardFlowState();
    const late = seed.movements.filter((movement) => arrivalTiming(movement, NOW).state === "late");
    for (const movement of late) {
      expect(lateFor(seed, movement.id).length, movement.id).toBeGreaterThan(0);
      expect(movement.arrivalLateNotifiedAt, movement.id).toBeDefined();
    }
  });
});
