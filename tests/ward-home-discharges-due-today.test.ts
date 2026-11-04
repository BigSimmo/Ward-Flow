import { describe, expect, it } from "vitest";

import { wardDischargesDueToday } from "@/components/ward-management/ward/ward-home-tab-model";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
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

  it("counts past date and today only, never tomorrow, later or held up", () => {
    expect(wardDischargesDueToday(releases, NOW_ANCHOR).map((r) => r.id)).toEqual(["today-expected", "past-date"]);
  });

  it("takes the confirmed count from the same list, so a later confirmed discharge cannot hide one to confirm", () => {
    const due = wardDischargesDueToday(releases, NOW_ANCHOR);
    expect(due.filter((r) => r.state === "confirmed")).toHaveLength(0);
  });
});
