import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Unit } from "@/components/ward-management/ward-model";

describe("Phase 5: Architectural Modernization & Resilience Fallbacks", () => {
  it("safely handles wards with unknown siteCode in bed-map without throwing", () => {
    const baseUnit = seedWardFlowState().units[0];
    const syntheticUnit: Unit = {
      ...baseUnit,
      id: "unknown-ward-1",
      siteCode: "NONEXISTENT",
    };

    const wards = bedMapWards([syntheticUnit], [], [], []);
    expect(wards).toHaveLength(1);
    expect(() => groupBedMapWardsByService(wards)).not.toThrow();
  });

  it("safely clamps pendingPreparation in bedMapWards without throwing", () => {
    const preparingRelease = bedReleases.find((r) => r.state === "discharged" && r.preparing);
    expect(preparingRelease).toBeDefined();

    const baseUnit = seedWardFlowState().units.find((u) => u.id === preparingRelease?.unitId)!;
    expect(baseUnit).toBeDefined();

    // Force zero capacity so pending preparation exceeds available
    const zeroCapacityUnit: Unit = {
      ...baseUnit,
      empty: { ...baseUnit.empty, value: 0 },
      allocatable: { ...baseUnit.allocatable, value: 0 },
    };

    expect(() => bedMapWards([zeroCapacityUnit], [preparingRelease!], [], [])).not.toThrow();
    const wards = bedMapWards([zeroCapacityUnit], [preparingRelease!], [], []);
    expect(wards[0].pendingPreparation).toBe(0);
  });

  it("safely renders DelaysScreen for movements without escalation object", () => {
    const seed = seedWardFlowState();
    const movementWithoutEscalation = {
      ...seed.movements[0],
      escalation: undefined,
    };

    expect(() => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <DelaysScreen movements={[movementWithoutEscalation]} />
        </WardFlowProvider>,
      );
    }).not.toThrow();

    expect(screen.getByTestId("ward-delays-page")).toBeInTheDocument();
  });
});
