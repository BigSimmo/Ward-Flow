import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * One discharge, one answer (release gate, 15 Oct 2026). The ward's Confirm and Revert act on the
 * bed release, while the bed board's shift list, the patient card and the discharge board read the
 * stay's own `dischargeConfirmedAt`. Before this, a confirmed release still showed "Expected
 * discharge" on the board. The release and its stay now move together.
 */
describe("confirming a bed release confirms the stay's discharge", () => {
  function expectedReleaseOnOccupiedStay() {
    const state = seedWardFlowState();
    const release = state.bedReleases.find(
      (candidate) =>
        candidate.state === "expected" &&
        state.admissions.some(
          (stay) =>
            stay.id === candidate.admissionId && stay.state === "occupied" && stay.dischargeConfirmedAt === null,
        ),
    );
    if (!release) throw new Error("the seed has no expected release on an unconfirmed occupied stay");
    return { state, release };
  }

  it("CONFIRM_BED_RELEASE stamps the stay as confirmed by the ward manager at the same instant", () => {
    const { state, release } = expectedReleaseOnOccupiedStay();
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
    });
    expect(next.rejections).toHaveLength(state.rejections.length);
    const stay = next.admissions.find((candidate) => candidate.id === release.admissionId);
    expect(stay?.dischargeConfirmedAt).toBe(NOW_ANCHOR);
    expect(stay?.dischargeConfirmedBy).toBe("Ward manager");
    // Only that stay changes.
    const others = (list: typeof state.admissions) => list.filter((candidate) => candidate.id !== release.admissionId);
    expect(others(next.admissions)).toEqual(others(state.admissions));
  });

  it("REVERT_BED_RELEASE clears the stay's confirmation again", () => {
    const { state, release } = expectedReleaseOnOccupiedStay();
    const confirmed = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
    });
    const reverted = wardFlowReducer(confirmed, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR + 5,
      releaseId: release.id,
      actingUnitId: release.unitId,
      waitingOn: "Nothing outstanding",
    });
    const stay = reverted.admissions.find((candidate) => candidate.id === release.admissionId);
    expect(stay?.dischargeConfirmedAt).toBeNull();
    expect(stay?.dischargeConfirmedBy).toBeNull();
  });

  it("a stay confirmed earlier keeps its own confirmation time", () => {
    const { state: seed, release } = expectedReleaseOnOccupiedStay();
    const earlier = NOW_ANCHOR - 60;
    const state = {
      ...seed,
      admissions: seed.admissions.map((stay) =>
        stay.id === release.admissionId
          ? { ...stay, dischargeConfirmedAt: earlier, dischargeConfirmedBy: "Ward manager" as const }
          : stay,
      ),
    };
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
    });
    expect(next.bedReleases.find((candidate) => candidate.id === release.id)?.state).toBe("confirmed");
    const stay = next.admissions.find((candidate) => candidate.id === release.admissionId);
    expect(stay?.dischargeConfirmedAt).toBe(earlier);
  });

  it("a coordinator's confirmation records the time but does not name the ward manager", () => {
    const { state, release } = expectedReleaseOnOccupiedStay();
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "coordinator",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
    });
    expect(next.rejections).toHaveLength(state.rejections.length);
    const stay = next.admissions.find((candidate) => candidate.id === release.admissionId);
    expect(stay?.dischargeConfirmedAt).toBe(NOW_ANCHOR);
    expect(stay?.dischargeConfirmedBy).toBeNull();
  });

  it("confirming and reverting each move the stay's discharge revision", () => {
    const { state, release } = expectedReleaseOnOccupiedStay();
    const before = state.dischargeRevisions[release.admissionId] ?? 0;
    const confirmed = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
    });
    expect(confirmed.dischargeRevisions[release.admissionId]).toBe(before + 1);
    const reverted = wardFlowReducer(confirmed, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR + 5,
      releaseId: release.id,
      actingUnitId: release.unitId,
      waitingOn: "Nothing outstanding",
    });
    expect(reverted.dischargeRevisions[release.admissionId]).toBe(before + 2);
  });

  it("a refused confirmation leaves the stay untouched", () => {
    const { state, release } = expectedReleaseOnOccupiedStay();
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: `${release.unitId}-not-this-ward`,
    });
    expect(next.rejections.length).toBeGreaterThan(state.rejections.length);
    expect(next.admissions).toEqual(state.admissions);
  });
});
