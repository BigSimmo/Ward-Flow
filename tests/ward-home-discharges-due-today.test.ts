import { describe, expect, it } from "vitest";

import { wardDischargesDueToday } from "@/components/ward-management/ward/ward-home-tab-model";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY, dayOf } from "@/components/ward-management/ward-clock";
import { openBedReleases } from "@/components/ward-management/ward-bed-availability";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const unit = allUnits()[0];

function release(id: string, overrides: Partial<BedRelease>): BedRelease {
  return {
    id,
    unitId: unit.id,
    admissionId: `AD-${id}`,
    state: "expected",
    expectedAt: NOW_ANCHOR + 60,
    waitingOn: "Awaiting ward round",
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

describe("wardDischargesDueToday (Codex review on #1383)", () => {
  const releases = [
    release("today-expected", {}),
    release("past-date", { expectedAt: NOW_ANCHOR - 2 * MINUTES_PER_DAY }),
    release("tomorrow-confirmed", { state: "confirmed", expectedAt: NOW_ANCHOR + MINUTES_PER_DAY }),
    release("later-confirmed", { state: "confirmed", expectedAt: NOW_ANCHOR + 4 * MINUTES_PER_DAY }),
    release("held-up", { blocker: BED_RELEASE_BLOCKERS[0], blockedBy: "NUM Test Unit" }),
  ];

  it("counts today only, never a past date, tomorrow, later or held up (F-151)", () => {
    expect(wardDischargesDueToday(releases, NOW_ANCHOR).map((r) => r.id)).toEqual(["today-expected"]);
  });

  it("counts a release dated earlier today that is still open, and never one already discharged", () => {
    const morning = release("this-morning", { expectedAt: NOW_ANCHOR - 120 });
    const gone = release("discharged", { state: "discharged", expectedAt: NOW_ANCHOR - 60 });
    expect(wardDischargesDueToday([morning, gone], NOW_ANCHOR).map((r) => r.id)).toEqual(["this-morning"]);
  });

  it("takes the confirmed count from the same list, so a later confirmed discharge cannot hide one to confirm", () => {
    const due = wardDischargesDueToday(releases, NOW_ANCHOR);
    expect(due.filter((r) => r.state === "confirmed")).toHaveLength(0);
  });
});

describe("Ward page discharges today on the seeded Standard day (F-151, Audit G FS-1)", () => {
  it("is 0 for Dabakarn, which has past-date discharges but none due today", () => {
    const state = seedWardFlowState("standard");
    const open = openBedReleases(state.bedReleases, "rph-adult-secure");
    // The seed's premise: past-date releases sit on this ward, and none is dated today.
    expect(open.some((r) => dayOf(r.expectedAt) < dayOf(NOW_ANCHOR) && r.blocker === null)).toBe(true);
    expect(open.filter((r) => dayOf(r.expectedAt) === dayOf(NOW_ANCHOR))).toHaveLength(0);
    expect(wardDischargesDueToday(open, NOW_ANCHOR)).toHaveLength(0);
  });
});
