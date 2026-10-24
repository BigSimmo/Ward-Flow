import { afterEach, expect, it } from "vitest";
import {
  activateScenarioNetwork,
  scenarioNetwork,
  WARD_SCENARIOS,
  type WardScenario,
} from "@/components/ward-management/ward-scenarios";
import { allEmergencyDepartments, edById, siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";

afterEach(() => activateScenarioNetwork("standard"));

it("loads the fictional scenario through the same directory and ED lookups as the chosen network", () => {
  expect(WARD_SCENARIOS).toContain("wa-synthetic");
  activateScenarioNetwork("wa-synthetic" as WardScenario);
  const network = scenarioNetwork("wa-synthetic" as WardScenario)!;
  expect(network.sites.length).toBeGreaterThan(0);
  expect(siteByCode("SYN-QUARTZ")?.name).toBe("Fictional Quartz Hospital");
  expect(edById("syn-quartz-ed")?.siteCode).toBe("SYN-QUARTZ");
  expect(siteDirectory.every((site) => site.code.startsWith("SYN-"))).toBe(true);
  expect(allEmergencyDepartments().every((ed) => ed.id.startsWith("syn-"))).toBe(true);
  expect(siteByCode("RPH")).toBeUndefined();
  expect(edById("rph-ed")).toBeUndefined();
  activateScenarioNetwork("standard");
  expect(siteByCode("RPH")).toBeDefined();
  expect(edById("rph-ed")).toBeDefined();
  expect(siteByCode("SYN-QUARTZ")).toBeUndefined();
});
