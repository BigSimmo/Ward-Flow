import { describe, expect, it, vi } from "vitest";

// What a live shared build bundles in place of the demo data (next.config.ts).
for (const name of [
  "ward-movements",
  "ward-patients-seed",
  "ward-admissions-seed",
  "ward-rulings-demo",
  "ward-demo-planned-moves",
])
  vi.doMock(
    `@/components/ward-management/${name}`,
    () => import("@/components/ward-management/live-build/ward-no-demo-data"),
  );

describe("the local world of a live shared build", () => {
  it("starts empty of records, with the scenario's wards and settings", async () => {
    const { seedWardFlowStateAt } = await import("@/components/ward-management/ward-flow-reducer");
    const world = seedWardFlowStateAt(0);
    for (const field of ["movements", "patients", "admissions", "referrals", "bedReleases", "leaveBeds"] as const)
      expect(world[field], field).toEqual([]);
    expect(world.plannedAdmissions).toEqual([]);
    expect(world.units.length).toBeGreaterThan(0);
    expect(world.scenario).toBe("standard");
  });
});
