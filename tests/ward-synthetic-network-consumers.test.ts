import { afterEach, describe, expect, it } from "vitest";
import { demoNetwork } from "@/components/ward-management/ward-demo-network";
import { movementHealthService } from "@/components/ward-management/ward-derivations";
import { activateScenarioNetwork, scenarioNetwork } from "@/components/ward-management/ward-scenarios";

afterEach(() => activateScenarioNetwork("standard"));

describe("movement origin service follows the active network", () => {
  it("resolves fictional EDs, then restores standard EDs without keeping the old directory", () => {
    const fictional = scenarioNetwork("wa-synthetic")!;
    const standardMovement = demoNetwork("demo").movements[0];
    activateScenarioNetwork("wa-synthetic");
    for (const movement of fictional.movements) {
      const site = fictional.sites.find((candidate) => candidate.emergencyDepartment?.id === movement.originEdId);
      expect(movementHealthService(movement), movement.id).toBe(site?.service);
      expect(movementHealthService(movement), movement.id).toBeDefined();
    }
    expect(movementHealthService(standardMovement)).toBeUndefined();
    activateScenarioNetwork("standard");
    expect(movementHealthService(standardMovement)).toBe("East Metro");
    expect(movementHealthService(fictional.movements[0])).toBeUndefined();
    activateScenarioNetwork("wa-synthetic");
    expect(movementHealthService(fictional.movements[0])).toBe("East Metro");
  });
});
