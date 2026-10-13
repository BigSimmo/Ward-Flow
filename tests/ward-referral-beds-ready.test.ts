import { describe, expect, it } from "vitest";
import { bedsReadySummary } from "@/components/ward-management/referrals/referral-board-parts";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";

const base = allUnits().find((unit) => unit.cohort === "Adult" && bedStates(unit, [], [], []).ready > 1)!;
const cell = (units: Parameters<typeof bedsReadySummary>[0], label: string) =>
  bedsReadySummary(units, [], [], NOW_ANCHOR).cells.find((c) => c.label === label)!.value;

describe("Referrals hero: beds ready statewide", () => {
  it("counts a unit without authorisation, since it still takes voluntary admissions", () => {
    expect(base, "the fixture has no adult unit with two ready beds").toBeDefined();
    const ready = bedStates(base, [], [], []).ready;
    expect(cell([{ ...base, authorised: false }], "Adult")).toBe(ready);
  });

  it("counts the ready locked beds of a mixed ward, not only of wholly locked wards", () => {
    const mixed = { ...base, lockedBeds: 1, allocatableLocked: 1, beds: Math.max(base.beds, 2) };
    expect(mixed.lockedBeds).toBeLessThan(mixed.beds);
    expect(cell([mixed], "Locked")).toBe(1);
  });

  it("gives one statewide total, the figure Home and Capacity show, with Locked never added on top", () => {
    const units = allUnits();
    const summary = bedsReadySummary(units, [], [], NOW_ANCHOR);
    const shared = serviceRollup(wardSites, units, [], [], NOW_ANCHOR).service.availableNow;
    expect(summary.total).toBe(shared);
    const cohorts = summary.cells.filter((c) => c.label !== "Locked").reduce((sum, c) => sum + c.value, 0);
    expect(cohorts).toBe(summary.total);
  });
});
