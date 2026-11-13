import { describe, expect, it } from "vitest";
import { unitCapacity } from "@/components/ward-management/ward-derivations-transport";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import type { Unit, BedRelease } from "@/components/ward-management/ward-model";
import { createIsolatedState } from "../helpers/test-harness";

describe("Tier 1 - Feature 10: Bed Occupancy Math Decoupling & Cleaning Capacity Transparency", () => {
  const createMockUnit = (overrides?: Partial<Unit>): Unit => {
    return {
      id: "TEST-ACUTE-1",
      name: "Test Acute Ward",
      siteCode: "SCGH",
      beds: 20,
      allocatable: { value: 5, revision: 1, source: "test" },
      empty: { value: 6, revision: 1 },
      allocatableLocked: 2,
      speciallingCapacity: 2,
      isClosed: false,
      closedBeds: [],
      ...overrides,
    } as unknown as Unit;
  };

  it("calculates ready bed availability as min(allocatable, empty) minus closed beds", () => {
    const unit = createMockUnit({
      allocatable: { value: 4, revision: 1, source: "test" },
      empty: { value: 7, revision: 1 },
      closedBeds: [],
    });

    const { available, held, effectiveEmpty } = boundedBedAvailability(unit);
    expect(effectiveEmpty).toBe(7);
    expect(available).toBe(4); // min(4, 7) = 4
    expect(held).toBe(3); // 7 - 4 = 3
  });

  it("reports zero available beds when the ward is marked closed (isClosed: true)", () => {
    const closedUnit = createMockUnit({
      isClosed: true,
      allocatable: { value: 5, revision: 1, source: "test" },
      empty: { value: 5, revision: 1 },
    });

    const { available, held } = boundedBedAvailability(closedUnit);
    expect(available).toBe(0);
    expect(held).toBe(5);
  });

  it("correctly counts beds pending cleaning via bedsPendingPreparation", () => {
    const unitId = "TEST-ACUTE-1";
    const releases: BedRelease[] = [
      { id: "BR-1", unitId, state: "discharged", preparing: true } as BedRelease,
      { id: "BR-2", unitId, state: "discharged", preparing: true } as BedRelease,
      { id: "BR-3", unitId, state: "discharged", preparing: false } as BedRelease, // ready
      { id: "BR-4", unitId: "OTHER-WARD", state: "discharged", preparing: true } as BedRelease,
    ];

    const pending = bedsPendingPreparation(unitId, releases);
    expect(pending).toBe(2);
  });

  it("derives occupied bed count in unitCapacity as notEmpty minus blocked without phantom beds", () => {
    const unit = createMockUnit({
      beds: 20,
      empty: { value: 5, revision: 1 },
      allocatable: { value: 5, revision: 1, source: "test" },
    });

    const cap = unitCapacity(unit, []);
    // notEmpty = 20 - 5 = 15
    expect(cap.occupied).toBe(15);
    expect(cap.available).toBe(5);
    expect(cap.surge).toBe(0);
  });

  it("handles surge condition where occupied count exceeds nominal bed quota safely", () => {
    const unit = createMockUnit({
      beds: 10,
      empty: { value: 0, revision: 1 },
      allocatable: { value: 0, revision: 1, source: "test" },
    });

    const cap = unitCapacity(unit, []);
    expect(cap.occupied).toBe(10);
    expect(cap.available).toBe(0);
    expect(cap.held).toBe(0);
  });

  it("decouples occupancy from arithmetic by deriving directly from active admissions list", () => {
    const unit = createMockUnit({
      id: "TEST-ACUTE-1",
      beds: 20,
      empty: { value: 10, revision: 1 },
      allocatable: { value: 8, revision: 1, source: "test" },
    });

    // Authoring desync: empty is 10 (which implies 10 occupied), but active admissions are only 4
    const admissions = [
      { unitId: "TEST-ACUTE-1", state: "occupied" } as any,
      { unitId: "TEST-ACUTE-1", state: "occupied" } as any,
      { unitId: "TEST-ACUTE-1", state: "occupied" } as any,
      { unitId: "TEST-ACUTE-1", state: "occupied" } as any,
      { unitId: "TEST-ACUTE-1", state: "discharged" } as any,
      { unitId: "OTHER-WARD", state: "occupied" } as any,
    ];

    const cap = unitCapacity(unit, [], { admissions });
    expect(cap.occupied).toBe(4); // derived directly from active occupied admissions
  });

  it("transparently exposes cleaning beds and adjusts availableNow in unitCapacity", () => {
    const unitId = "TEST-ACUTE-1";
    const unit = createMockUnit({
      id: unitId,
      beds: 20,
      empty: { value: 6, revision: 1 },
      allocatable: { value: 6, revision: 1, source: "test" },
    });

    const releases: BedRelease[] = [
      { id: "BR-1", unitId, state: "discharged", preparing: true } as BedRelease,
      { id: "BR-2", unitId, state: "discharged", preparing: true } as BedRelease,
    ];

    const cap = unitCapacity(unit, releases);
    expect(cap.available).toBe(6);
    expect(cap.bedsPendingPreparation).toBe(2);
    expect(cap.availableNow).toBe(4); // 6 - 2 = 4
    expect(cap.availableAfterCleaning).toBe(6);
  });
});
