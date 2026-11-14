import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardCarriesRealName } from "@/components/ward-management/ward-demo-adverse-wards";
import { applyIntakeWindowDemoOverlay } from "@/components/ward-management/capacity/ward-intake-window-demo";

// Live re-check (14 Nov 2026): invented "Admits …" hours showed under real ward names on Capacity's
// ward cards. The demo windows now sit only on generic-labelled wards (A15-27's rule).
describe("seeded intake windows stay off real ward names", () => {
  it("seeds three windows, none on a ward that carries a real ward's own name", () => {
    const withWindows = seedWardFlowState().units.filter((unit) => unit.intakeWindow);
    expect(withWindows).toHaveLength(3);
    for (const unit of withWindows) expect(wardCarriesRealName(unit), unit.name).toBe(false);
  });

  it("drops a window when its ward is renamed to a real ward's name", () => {
    const state = seedWardFlowState();
    const bare = {
      units: state.units.map((unit) =>
        unit.id === "rgh-adult-secure"
          ? { ...unit, name: "Dabakarn", intakeWindow: undefined }
          : { ...unit, intakeWindow: undefined },
      ),
    };
    const overlaid = applyIntakeWindowDemoOverlay(bare, 600);
    expect(overlaid.units.find((unit) => unit.id === "rgh-adult-secure")?.intakeWindow).toBeUndefined();
    expect(overlaid.units.filter((unit) => unit.intakeWindow)).toHaveLength(2);
  });
});
