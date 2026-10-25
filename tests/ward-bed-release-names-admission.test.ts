import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { seedWardFlowStateAt, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { capacityBreakdown, openBedsNow } from "../src/components/ward-management/ward-bed-availability";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-event-roles";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";

const NOW = NOW_ANCHOR;

/**
 * Owner decision, Josh, 25 September 2026: a bed release is a named patient's discharge. Before
 * this, `RELEASE_BED` (removed by audit 24-1 decision 4, 24 Oct 2026) paired with a departure by comparing ward-wide counts (`runtimeDeparted` vs
 * `runtimeDischarged`), with two hard-coded exceptions (`WR-008`, the `AD-LEFT-` prefix) standing
 * in for what an `admissionId` now states directly. See `ward-model.ts`'s own doc comment on
 * `BedRelease.admissionId` for the full rationale, and `D:/Temp/claude/bed-release-link-plan.md`
 * for the plan this file's tests (T1-T10) are drawn from.
 */

function seeded() {
  return seedWardFlowStateAt(0);
}

function unit(state: WardFlowState, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

function admission(state: WardFlowState, id: string) {
  const found = state.admissions.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing admission ${id}`);
  return found;
}

/** An occupied admission with no live (non-discharged) bed release, chosen from state rather than
 *  hard-coded so a seed change cannot silently make a test exercise a different case than it names. */
function anUnreleasedOccupant(state: WardFlowState) {
  const found = state.admissions.find(
    (a) => a.state === "occupied" && !state.bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
  );
  if (!found) throw new Error("the seed contains nobody occupying a bed with no live release");
  return found;
}

function flag(
  state: WardFlowState,
  person: { id: string; unitId: string },
  extra: Partial<{
    waitingOn: "Nothing outstanding";
    blocker: "Awaiting clean";
  }> = {},
) {
  return wardFlowReducer(state, {
    type: "FLAG_BED_RELEASE",
    role: "ward",
    now: NOW,
    unitId: person.unitId,
    actingUnitId: person.unitId,
    admissionId: person.id,
    waitingOn: extra.waitingOn ?? "Nothing outstanding",
    expectedAt: NOW + 60,
    ...(extra.blocker ? { blocker: extra.blocker } : {}),
  });
}

function leave(state: WardFlowState, person: { id: string; unitId: string }) {
  return wardFlowReducer(state, {
    type: "RECORD_LEAVING",
    role: "ward",
    now: NOW,
    admissionId: person.id,
    actingUnitId: person.unitId,
    leavingDestination: "discharged-to-the-community",
  });
}

function liveReleaseFor(state: WardFlowState, admissionId: string) {
  return state.bedReleases.find((r) => r.admissionId === admissionId && r.state !== "discharged");
}

describe("a bed release names its admission (owner decision, 2026-09-25)", () => {
  it("T1: a duplicate release for one person no longer inflates the free-bed count — today's defect", () => {
    const state = seeded();
    const person = anUnreleasedOccupant(state);
    const before = unit(state, person.unitId).empty.value;

    const firstFlag = flag(state, person);
    expect(firstFlag.rejections).toHaveLength(0);
    const firstRelease = liveReleaseFor(firstFlag, person.id);
    if (!firstRelease) throw new Error("expected a live release after the first flag");

    const secondFlag = flag(firstFlag, person);
    expect(secondFlag.rejections.length).toBeGreaterThan(0);

    const afterLeaving = leave(secondFlag, person);
    // Leaving itself adds no new rejection; the one above is the intentional second-flag refusal.
    expect(afterLeaving.rejections.length).toBe(secondFlag.rejections.length);
    expect(unit(afterLeaving, person.unitId).empty.value).toBe(before + 1);
  });

  it("T2: leaving completes the named release", () => {
    const state = seeded();
    const person = anUnreleasedOccupant(state);
    const beforeEmpty = unit(state, person.unitId).empty.value;
    const beforeAllocatable = unit(state, person.unitId).allocatable.value;

    const afterFlag = flag(state, person);
    expect(afterFlag.rejections).toHaveLength(0);
    const release = liveReleaseFor(afterFlag, person.id);
    if (!release) throw new Error("expected a live release");

    const afterConfirm = wardFlowReducer(afterFlag, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: release.id,
      actingUnitId: person.unitId,
    });
    expect(afterConfirm.rejections).toHaveLength(0);

    const afterLeaving = leave(afterConfirm, person);
    expect(afterLeaving.rejections).toHaveLength(0);

    const completed = afterLeaving.bedReleases.find((r) => r.id === release.id);
    if (!completed) throw new Error("release disappeared");
    expect(completed.state).toBe("discharged");
    expect(completed.confirmedAt).toBe(NOW);
    expect(completed.blocker).toBeNull();
    expect(completed.blockedBy).toBeNull();

    expect(unit(afterLeaving, person.unitId).empty.value).toBe(beforeEmpty + 1);
    expect(unit(afterLeaving, person.unitId).allocatable.value).toBe(beforeAllocatable + 1);
  });

  it("T3: leaving with a blocked live release clears the flag", () => {
    const state = seeded();
    const person = anUnreleasedOccupant(state);

    const afterFlag = flag(state, person, { blocker: "Awaiting clean" });
    expect(afterFlag.rejections).toHaveLength(0);
    const release = liveReleaseFor(afterFlag, person.id);
    if (!release) throw new Error("expected a live release");
    expect(release.blocker).toBe("Awaiting clean");

    const afterLeaving = leave(afterFlag, person);
    expect(afterLeaving.rejections).toHaveLength(0);
    const completed = afterLeaving.bedReleases.find((r) => r.id === release.id);
    if (!completed) throw new Error("release disappeared");
    expect(completed.blocker).toBeNull();
    expect(completed.blockedBy).toBeNull();
  });

  it("T4: an unrelated departure no longer consumes another person's release", () => {
    const state = seeded();
    const person = anUnreleasedOccupant(state);
    const other = state.admissions.find(
      (a) => a.state === "occupied" && a.unitId === person.unitId && a.id !== person.id,
    );
    if (!other) throw new Error("need a second occupant on the same unit");

    const afterFlag = flag(state, person);
    expect(afterFlag.rejections).toHaveLength(0);
    const beforeEmpty = unit(afterFlag, person.unitId).empty.value;

    // Q (no release of their own) leaves.
    const afterOtherLeaves = leave(afterFlag, other);
    expect(afterOtherLeaves.rejections).toHaveLength(0);
    expect(unit(afterOtherLeaves, person.unitId).empty.value).toBe(beforeEmpty + 1);

    const stillLive = liveReleaseFor(afterOtherLeaves, person.id);
    expect(stillLive?.state).toBe("expected");
    expect(admission(afterOtherLeaves, person.id).state).toBe("occupied");

    // P leaves next: figure rises again, and P's own release completes.
    const afterPersonLeaves = leave(afterOtherLeaves, person);
    expect(afterPersonLeaves.rejections).toHaveLength(0);
    expect(unit(afterPersonLeaves, person.unitId).empty.value).toBe(beforeEmpty + 2);
    const completed = afterPersonLeaves.bedReleases.find((r) => r.admissionId === person.id);
    expect(completed?.state).toBe("discharged");
  });

  it("T5: a release stays live while the named person is still in the bed; only leaving completes it", () => {
    // Audit 24-1 decision 4 (24 Oct 2026) removed RELEASE_BED, the other way a release could
    // complete. It was unreachable, because leaving already completes the release (T2).
    expect(Object.keys(EVENT_ROLE)).not.toContain("RELEASE_BED");
    const state = seeded();
    const person = anUnreleasedOccupant(state);

    const afterFlag = flag(state, person);
    expect(afterFlag.rejections).toHaveLength(0);
    const release = liveReleaseFor(afterFlag, person.id);
    if (!release) throw new Error("expected a live release");
    const afterConfirm = wardFlowReducer(afterFlag, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: release.id,
      actingUnitId: person.unitId,
    });
    expect(afterConfirm.rejections).toHaveLength(0);
    expect(afterConfirm.bedReleases.find((r) => r.id === release.id)?.state).toBe("confirmed");
    expect(admission(afterConfirm, person.id).state).toBe("occupied");
    expect(unit(afterConfirm, person.unitId).empty.value).toBe(unit(state, person.unitId).empty.value);
  });

  it("T7: FLAG refusals, one case each", () => {
    const state = seeded();
    const person = anUnreleasedOccupant(state);
    const otherUnitAdmission = state.admissions.find((a) => a.state === "occupied" && a.unitId !== person.unitId);
    if (!otherUnitAdmission) throw new Error("need an occupant on a different unit");
    const departedAdmission = state.admissions.find((a) => a.state === "departed");
    if (!departedAdmission) throw new Error("need a departed admission in the seed");
    const pulledAdmission = state.admissions.find((a) => a.state === "pulled");
    if (!pulledAdmission) throw new Error("need a pulled admission in the seed");
    const waitlistedAdmission = state.admissions.find((a) => a.state === "waitlisted");
    if (!waitlistedAdmission) throw new Error("need a waitlisted admission in the seed");

    const cases: Array<{ name: string; run: () => WardFlowState }> = [
      { name: "unknown id", run: () => flag(state, { id: "AD-DOES-NOT-EXIST", unitId: person.unitId }) },
      {
        name: "admission on another unit",
        run: () =>
          wardFlowReducer(state, {
            type: "FLAG_BED_RELEASE",
            role: "ward",
            now: NOW,
            unitId: person.unitId,
            actingUnitId: person.unitId,
            admissionId: otherUnitAdmission.id,
            waitingOn: "Nothing outstanding",
            expectedAt: NOW + 60,
          }),
      },
      {
        name: "departed admission",
        run: () =>
          wardFlowReducer(state, {
            type: "FLAG_BED_RELEASE",
            role: "ward",
            now: NOW,
            unitId: departedAdmission.unitId,
            actingUnitId: departedAdmission.unitId,
            admissionId: departedAdmission.id,
            waitingOn: "Nothing outstanding",
            expectedAt: NOW + 60,
          }),
      },
      {
        name: "pulled admission",
        run: () =>
          wardFlowReducer(state, {
            type: "FLAG_BED_RELEASE",
            role: "ward",
            now: NOW,
            unitId: pulledAdmission.unitId,
            actingUnitId: pulledAdmission.unitId,
            admissionId: pulledAdmission.id,
            waitingOn: "Nothing outstanding",
            expectedAt: NOW + 60,
          }),
      },
      {
        name: "waitlisted admission",
        run: () =>
          wardFlowReducer(state, {
            type: "FLAG_BED_RELEASE",
            role: "ward",
            now: NOW,
            unitId: waitlistedAdmission.unitId,
            actingUnitId: waitlistedAdmission.unitId,
            admissionId: waitlistedAdmission.id,
            waitingOn: "Nothing outstanding",
            expectedAt: NOW + 60,
          }),
      },
      {
        name: "second live release",
        run: () => {
          const afterFirst = flag(state, person);
          const before = afterFirst.bedReleases.length;
          const afterSecond = flag(afterFirst, person);
          expect(afterSecond.bedReleases.length).toBe(before);
          return afterSecond;
        },
      },
    ];

    for (const testCase of cases) {
      const beforeCount = state.bedReleases.length;
      const result = testCase.run();
      expect(result.rejections.length, `${testCase.name} should be refused`).toBeGreaterThan(0);
      if (testCase.name !== "second live release") {
        expect(result.bedReleases.length, `${testCase.name} should append no release`).toBe(beforeCount);
      }
    }
  });

  it("T8: the source contains no pairing exceptions", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "ward-management", "ward-flow-reducer.ts"),
      "utf8",
    );
    expect(source).not.toContain("WR-008");
    expect(source).not.toContain("AD-LEFT-");
  });

  it("T9: the moved seed coverage — confirmed+blocked, expected+blocked, discharged+preparing, all through events", () => {
    const state = seeded();

    // Confirmed and blocked.
    const p1 = anUnreleasedOccupant(state);
    const afterFlag1 = flag(state, p1, { blocker: "Awaiting clean" });
    const release1 = liveReleaseFor(afterFlag1, p1.id);
    if (!release1) throw new Error("expected a live release for p1");
    const afterConfirm1 = wardFlowReducer(afterFlag1, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: release1.id,
      actingUnitId: p1.unitId,
    });
    const breakdown1 = capacityBreakdown(
      unit(afterConfirm1, p1.unitId),
      afterConfirm1.bedReleases,
      afterConfirm1.leaveBeds,
      NOW,
    );
    expect(breakdown1.confirmedToday).toBeGreaterThanOrEqual(1);
    expect(breakdown1.blockedToday).toBeGreaterThanOrEqual(1);

    // Expected and blocked, on a different occupant so it does not collide with p1's release.
    const p2 = anUnreleasedOccupant(afterConfirm1);
    const afterFlag2 = flag(afterConfirm1, p2, { blocker: "Awaiting clean" });
    const breakdown2 = capacityBreakdown(
      unit(afterFlag2, p2.unitId),
      afterFlag2.bedReleases,
      afterFlag2.leaveBeds,
      NOW,
    );
    expect(breakdown2.expectedToday).toBeGreaterThanOrEqual(1);
    expect(breakdown2.blockedToday).toBeGreaterThanOrEqual(1);

    // Discharged and preparing.
    const p3 = anUnreleasedOccupant(afterFlag2);
    const afterFlag3 = flag(afterFlag2, p3);
    const release3 = liveReleaseFor(afterFlag3, p3.id);
    if (!release3) throw new Error("expected a live release for p3");
    const afterLeave3 = leave(afterFlag3, p3);
    const completed3 = afterLeave3.bedReleases.find((r) => r.id === release3.id);
    expect(completed3?.state).toBe("discharged");
    const afterPrep = wardFlowReducer(afterLeave3, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: release3.id,
      actingUnitId: p3.unitId,
      preparing: true,
    });
    const u3 = unit(afterPrep, p3.unitId);
    const availableNow = Math.min(u3.allocatable.value, u3.empty.value);
    expect(openBedsNow(u3, afterPrep.bedReleases)).toBe(availableNow - 1);
  });

  it("T10: storage validation rejects a release with no admissionId, a mismatched unit, or a discharged release against an occupied admission", () => {
    const state = seeded();
    const person = anUnreleasedOccupant(state);
    const otherUnitAdmission = state.admissions.find((a) => a.state === "occupied" && a.unitId !== person.unitId);
    if (!otherUnitAdmission) throw new Error("need an occupant on a different unit");

    const basePayload = buildStoragePayload(state);

    const missingAdmissionId = mutateFirstRelease(basePayload, person, (release) => {
      const clone = { ...release };
      delete (clone as Record<string, unknown>).admissionId;
      return clone;
    });
    expect(isValidStoredWardFlowState(missingAdmissionId)).toBe(false);

    const mismatchedUnit = mutateFirstRelease(basePayload, person, (release) => ({
      ...release,
      admissionId: otherUnitAdmission.id,
    }));
    expect(isValidStoredWardFlowState(mismatchedUnit)).toBe(false);

    const dischargedAgainstOccupied = mutateFirstRelease(basePayload, person, (release) => ({
      ...release,
      state: "discharged",
    }));
    expect(isValidStoredWardFlowState(dischargedAgainstOccupied)).toBe(false);
  });
});

function buildStoragePayload(state: WardFlowState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
}

function mutateFirstRelease(
  payload: Record<string, unknown>,
  person: { id: string; unitId: string },
  mutate: (release: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const releases = clone.bedReleases as Record<string, unknown>[];
  const target: Record<string, unknown> = {
    id: "WR-TEST-01",
    unitId: person.unitId,
    admissionId: person.id,
    state: "expected",
    expectedAt: NOW + 60,
    waitingOn: "Nothing outstanding",
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW,
    confirmedBy: "NUM Test",
  };
  clone.bedReleases = [mutate(target), ...releases];
  return clone;
}
