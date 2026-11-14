import { describe, expect, it } from "vitest";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { dayOf, MINUTES_PER_DAY, minuteOfDay } from "@/components/ward-management/ward-clock";
import { tonightIntakeWindow } from "@/components/ward-management/ward-intake-window";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * Time audit G1 (13 Nov 2026). A demo opened at another hour reseeds with `seedWardFlowStateAt`, which
 * moved EVERY instant by the same number of minutes. Seeds that belong to a time of day or a calendar
 * day then landed at the wrong clock face: the intake window read "admit 04:18 to 09:18", the staff
 * request named a shift hours away, discharges "due today" fell to tomorrow and a "ready since"
 * midnight was no longer a midnight. Offsets cover just after midnight, mid afternoon and late evening.
 */
const OFFSETS = [-637, 300, 768] as const;

function dueToday(state: WardFlowState, now: number): number {
  return state.admissions.filter(
    (stay) =>
      stay.state === "occupied" && stay.expectedDischargeAt !== null && dayOf(stay.expectedDischargeAt) === dayOf(now),
  ).length;
}

describe.each(OFFSETS)("a seed reopened %i minutes from the anchor", (offset) => {
  const now = NOW_ANCHOR + offset;
  const state = seedWardFlowStateAt(offset);
  const pinned = seedWardFlowState();

  it("keeps each seeded intake window at its own clock times and set this morning", () => {
    const expected: Record<string, [number, number]> = {
      "rgh-adult-secure": [21 * 60, 2 * 60],
      "sjgs-adult-open": [19 * 60, 23 * 60],
      "ger-adult-open": [22 * 60, 5 * 60],
    };
    for (const [unitId, [from, to]] of Object.entries(expected)) {
      const unit = state.units.find((candidate) => candidate.id === unitId)!;
      expect(unit.intakeWindow, unitId).toBeDefined();
      expect(minuteOfDay(unit.intakeWindow!.from), unitId).toBe(from);
      expect(minuteOfDay(unit.intakeWindow!.to), unitId).toBe(to);
      expect(tonightIntakeWindow(unit, now), `${unitId} shows as tonight's window`).not.toBeNull();
    }
  });

  it("asks for staff on the shift that is on now", () => {
    expect(state.staffRequests?.[0]).toMatchObject({
      shiftStartAt: currentShiftStartInstant(now),
      requestedAt: now - 35,
    });
  });

  it("keeps calendar-day fields on their day and clock face", () => {
    for (const [index, stay] of state.admissions.entries()) {
      const before = pinned.admissions[index]!;
      expect(stay.id).toBe(before.id);
      if (stay.clinicallyReadySince != null) expect(minuteOfDay(stay.clinicallyReadySince), stay.id).toBe(0);
      if (stay.expectedDischargeAt !== null && before.expectedDischargeAt !== null) {
        const moved = stay.expectedDischargeAt - before.expectedDischargeAt;
        // A same-day date stays put unless it would sit before the arrival it belongs to.
        if (moved !== 0) expect(stay.expectedDischargeAt - offset, stay.id).toBe(before.expectedDischargeAt);
        if (stay.arrivedAt !== null) expect(stay.expectedDischargeAt, stay.id).toBeGreaterThanOrEqual(stay.arrivedAt);
      }
      const trail = stay.dischargeDateTrail;
      if (trail && stay.expectedDischargeAt !== null) {
        expect(trail.revisions.at(-1)?.expectedAt ?? trail.firstExpectedAt, stay.id).toBe(stay.expectedDischargeAt);
        expect((trail.firstExpectedAt - before.dischargeDateTrail!.firstExpectedAt) % MINUTES_PER_DAY).toBe(
          (stay.expectedDischargeAt - before.expectedDischargeAt!) % MINUTES_PER_DAY,
        );
      }
    }
    expect(dueToday(state, now), "discharges due today").toBe(dueToday(pinned, NOW_ANCHOR));
  });

  it("keeps each seeded bed release on its stay's expected date", () => {
    for (const release of state.bedReleases) {
      const stay = state.admissions.find((candidate) => candidate.id === release.admissionId);
      const pinnedRelease = pinned.bedReleases.find((candidate) => candidate.id === release.id)!;
      const pinnedStay = pinned.admissions.find((candidate) => candidate.id === release.admissionId);
      if (!stay || !pinnedStay || pinnedRelease.expectedAt !== pinnedStay.expectedDischargeAt) continue;
      expect(release.expectedAt, release.id).toBe(stay.expectedDischargeAt);
    }
  });

  it("keeps network scenarios' discharges due today on today", () => {
    const network = seedWardFlowStateAt(offset, "emhs-demo");
    const pinnedNetwork = seedWardFlowState("emhs-demo");
    expect(dueToday(pinnedNetwork, NOW_ANCHOR)).toBeGreaterThan(0);
    expect(dueToday(network, now)).toBe(dueToday(pinnedNetwork, NOW_ANCHOR));
  });
});

describe("whole Perth days", () => {
  it("moves calendar-day fields by whole days when the board is on another day", () => {
    const offset = MINUTES_PER_DAY + 300;
    const state = seedWardFlowStateAt(offset);
    const pinned = seedWardFlowState();
    const ready = state.admissions.filter((stay) => stay.clinicallyReadySince != null);
    expect(ready.length).toBeGreaterThan(0);
    for (const stay of ready) {
      const before = pinned.admissions.find((candidate) => candidate.id === stay.id)!;
      expect(stay.clinicallyReadySince! - before.clinicallyReadySince!, stay.id).toBe(MINUTES_PER_DAY);
    }
  });

  it("still moves time-of-event instants by the exact offset", () => {
    const state = seedWardFlowStateAt(768);
    const pinned = seedWardFlowState();
    expect(state.movements[0]!.openedAt - pinned.movements[0]!.openedAt).toBe(768);
    expect(state.auditCaptureStartedAt).toBe(NOW_ANCHOR + 768);
  });

  it("is the pinned seed at offset zero", () => {
    expect(seedWardFlowStateAt(0)).toEqual(seedWardFlowState());
  });
});
