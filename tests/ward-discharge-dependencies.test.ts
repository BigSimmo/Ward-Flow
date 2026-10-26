import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { MINUTES_PER_DAY, perthMidnight } from "@/components/ward-management/ward-clock";
import { ageText, confirmationAge } from "@/components/ward-management/ward-confirmation-age";
import {
  changesSinceConfirmed,
  dependencySummary,
  outstandingDependencies,
} from "@/components/ward-management/discharges/discharge-dependencies";
import { nextNonWorkingClosure } from "@/components/ward-management/discharges/discharge-service-hours";

const NOW = NOW_ANCHOR;

function liveRelease(state: WardFlowState, withoutLogistics = true) {
  const found = state.bedReleases.find(
    (release) => release.state !== "discharged" && (!withoutLogistics || release.dependencies === undefined),
  );
  if (!found) throw new Error("the seed has no live bed release");
  return found;
}

function dependency(
  state: WardFlowState,
  releaseId: string,
  unitId: string,
  fields: Partial<Extract<WardFlowEvent, { type: "RECORD_DISCHARGE_DEPENDENCY" }>> = {},
) {
  return wardFlowReducer(state, {
    type: "RECORD_DISCHARGE_DEPENDENCY",
    role: "ward",
    now: NOW + 1,
    releaseId,
    actingUnitId: unitId,
    kind: "pharmacy",
    owner: "pharmacy",
    state: "done",
    ...fields,
  });
}

function planChange(
  state: WardFlowState,
  releaseId: string,
  unitId: string,
  fields: Partial<Extract<WardFlowEvent, { type: "RECORD_DISCHARGE_PLAN_CHANGE" }>>,
) {
  return wardFlowReducer(state, {
    type: "RECORD_DISCHARGE_PLAN_CHANGE",
    role: "coordinator",
    now: NOW + 10,
    releaseId,
    actingUnitId: unitId,
    ...fields,
  });
}

describe("discharge dependencies (closing-the-loop package B)", () => {
  it("records several independent items without touching the release's stage, blocker or date", () => {
    const seed = seedWardFlowState();
    const release = liveRelease(seed);
    let state = dependency(seed, release.id, release.unitId);
    state = dependency(state, release.id, release.unitId, {
      kind: "transport",
      owner: "patient_transport",
      state: "outstanding",
    });
    expect(state.rejections).toHaveLength(0);
    const after = state.bedReleases.find((candidate) => candidate.id === release.id)!;
    expect(after.dependencies?.map((item) => [item.kind, item.state])).toEqual([
      ["pharmacy", "done"],
      ["transport", "outstanding"],
    ]);
    expect(after.dependencies?.[0]).toMatchObject({ at: NOW + 1, by: expect.stringMatching(/^NUM /) });
    expect(after.state).toBe(release.state);
    expect(after.blocker).toBe(release.blocker);
    expect(after.expectedAt).toBe(release.expectedAt);
    expect(state.admissions).toBe(seed.admissions);
    expect(state.units).toBe(seed.units);
    expect(outstandingDependencies(after).map((item) => item.kind)).toEqual(["transport"]);
  });

  it("refuses another ward, a departed person and an unchosen value in plain words", () => {
    const seed = seedWardFlowState();
    const release = liveRelease(seed);
    const other = seed.units.find((unit) => unit.id !== release.unitId)!;
    expect(dependency(seed, release.id, other.id).rejections.at(-1)?.reason).toMatch(/^This discharge belongs to /);
    const gone = seed.bedReleases.find((candidate) => candidate.state === "discharged")!;
    expect(dependency(seed, gone.id, gone.unitId).rejections.at(-1)?.reason).toBe(
      "This person has already left, so nothing was recorded.",
    );
    const bad = dependency(seed, release.id, release.unitId, { kind: "laundry" as never });
    expect(bad.rejections.at(-1)?.reason).toBe("Choose what it is, who owns it and where it stands.");
  });

  it("flags a done item after the expected time moves, shows the change, and clears on reconfirm", () => {
    const seed = seedWardFlowState();
    const release = liveRelease(seed);
    let state = dependency(seed, release.id, release.unitId);
    state = planChange(state, release.id, release.unitId, { expectedAt: release.expectedAt + 120 });
    expect(state.rejections).toHaveLength(0);
    let after = state.bedReleases.find((candidate) => candidate.id === release.id)!;
    expect(after.expectedAt).toBe(release.expectedAt + 120);
    const pharmacy = after.dependencies![0]!;
    expect(changesSinceConfirmed(after, pharmacy)).toEqual([
      {
        fact: "expected_date",
        previousExpectedAt: release.expectedAt,
        expectedAt: release.expectedAt + 120,
        at: NOW + 10,
        by: "Bed coordinator",
      },
    ]);
    // Nothing is cancelled: the item is still recorded as done.
    expect(pharmacy.state).toBe("done");
    expect(dependencySummary(after).needsChecking).toBe(1);
    state = wardFlowReducer(state, {
      type: "RECORD_DISCHARGE_DEPENDENCY",
      role: "ward",
      now: NOW + 20,
      releaseId: release.id,
      actingUnitId: release.unitId,
      kind: "pharmacy",
      owner: "pharmacy",
      state: "done",
    });
    after = state.bedReleases.find((candidate) => candidate.id === release.id)!;
    expect(dependencySummary(after).needsChecking).toBe(0);
  });

  it("flags transport after the destination changes, but a first destination is not a change", () => {
    const seed = seedWardFlowState();
    const release = liveRelease(seed);
    let state = dependency(seed, release.id, release.unitId, { kind: "transport", owner: "patient_transport" });
    state = planChange(state, release.id, release.unitId, { leavingDestination: "discharged-to-the-community" });
    let after = state.bedReleases.find((candidate) => candidate.id === release.id)!;
    expect(after.plannedDestination?.leavingDestination).toBe("discharged-to-the-community");
    expect(after.planChanges).toBeUndefined();
    state = planChange(state, release.id, release.unitId, {
      leavingDestination: "moved-to-residential-care",
      now: NOW + 30,
    });
    after = state.bedReleases.find((candidate) => candidate.id === release.id)!;
    expect(changesSinceConfirmed(after, after.dependencies![0]!)).toMatchObject([
      {
        fact: "destination",
        previousLeavingDestination: "discharged-to-the-community",
        leavingDestination: "moved-to-residential-care",
      },
    ]);
    expect(
      planChange(state, release.id, release.unitId, { leavingDestination: "moved-to-residential-care" }).rejections.at(
        -1,
      )?.reason,
    ).toBe("That destination is already recorded.");
    expect(planChange(state, release.id, release.unitId, {}).rejections.at(-1)?.reason).toBe(
      "Change either the expected time or the destination.",
    );
  });

  it("restores saved logistics and rejects damaged ones", () => {
    const seed = seedWardFlowState();
    const release = liveRelease(seed);
    let state = dependency(seed, release.id, release.unitId);
    state = planChange(state, release.id, release.unitId, { expectedAt: release.expectedAt + 60 });
    const saved = JSON.parse(JSON.stringify(state)) as WardFlowState;
    expect(isValidStoredWardFlowState(saved)).toBe(true);
    const damaged = (patch: object) => ({
      ...saved,
      bedReleases: saved.bedReleases.map((candidate) =>
        candidate.id === release.id ? { ...candidate, ...patch } : candidate,
      ),
    });
    const item = { kind: "pharmacy", owner: "pharmacy", state: "done", at: NOW, by: "Ward manager" };
    expect(isValidStoredWardFlowState(damaged({ dependencies: [{ ...item, kind: "laundry" }] }))).toBe(false);
    expect(isValidStoredWardFlowState(damaged({ dependencies: [item, item] }))).toBe(false);
    expect(isValidStoredWardFlowState(damaged({ planChanges: [{ fact: "mood" }] }))).toBe(false);
  });

  it("seeds visible examples, including one item needing checking for each kind of change", () => {
    const seed = seedWardFlowState();
    const withLogistics = seed.bedReleases.filter((release) => release.dependencies !== undefined);
    expect(withLogistics.length).toBeGreaterThanOrEqual(3);
    const flagged = withLogistics.flatMap((release) =>
      release.dependencies!.flatMap((item) => changesSinceConfirmed(release, item).map((change) => change.fact)),
    );
    expect(new Set(flagged)).toEqual(new Set(["expected_date", "destination"]));
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(seed)))).toBe(true);
    // A single recorded blocker still sits beside the list.
    expect(withLogistics.some((release) => release.blocker !== null)).toBe(true);
  });
});

describe("confirmation age", () => {
  it("reads two recorded times, never a judgement", () => {
    expect(ageText(100, 100)).toBe("just now");
    expect(ageText(100, 145)).toBe("45 min ago");
    expect(ageText(100, 100 + 185)).toBe("3 h ago");
    expect(ageText(0, MINUTES_PER_DAY * 2 + 5)).toBe("2 days ago");
    expect(confirmationAge(0, 180, "NUM Ward 4A")).toBe("confirmed 3 h ago by NUM Ward 4A");
  });
});

describe("weekend and public holiday closures", () => {
  // Day 0 is Friday 23 October 2026 (Perth).
  const friday = perthMidnight(2026, 9, 23);

  it("names Saturday's pharmacy close before a closed Sunday, from a Friday", () => {
    const closure = nextNonWorkingClosure("pharmacy", 10 * 60, friday)!;
    // Friday 17:00 is an ordinary close (it opens Saturday); Saturday 12:00 runs over Sunday.
    expect(closure.closesAt).toBe(MINUTES_PER_DAY + 12 * 60);
    expect(closure.reopensAt).toBe(3 * MINUTES_PER_DAY + 8 * 60 + 30);
    expect(closure.closedFor).toEqual(["Weekend"]);
  });

  it("names the Friday close for a weekday-only service", () => {
    const closure = nextNonWorkingClosure("community_team", 10 * 60, friday)!;
    expect(closure.closesAt).toBe(17 * 60);
    expect(closure.closedFor).toEqual(["Weekend"]);
  });

  it("says already closed on a Sunday, and never lists the ward team", () => {
    const sunday = nextNonWorkingClosure("social_work", 2 * MINUTES_PER_DAY + 9 * 60, friday)!;
    expect(sunday.closesAt).toBeNull();
    expect(sunday.reopensAt).toBe(3 * MINUTES_PER_DAY + 8 * 60 + 30);
    expect(nextNonWorkingClosure("ward", 10 * 60, friday)).toBeNull();
  });

  it("names a public holiday", () => {
    // Day 0 is Thursday 24 December 2026: Christmas Day, then Boxing Day and the additional day.
    const christmasEve = perthMidnight(2026, 11, 24);
    const closure = nextNonWorkingClosure("social_work", 10 * 60, christmasEve)!;
    expect(closure.closesAt).toBe(16 * 60 + 30);
    expect(closure.closedFor).toEqual(["Christmas Day", "Boxing Day", "Weekend", "Boxing Day (additional day)"]);
    expect(closure.reopensAt).toBe(5 * MINUTES_PER_DAY + 8 * 60 + 30);
  });
});
