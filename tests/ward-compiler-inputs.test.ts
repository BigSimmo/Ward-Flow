import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { scenarioNetwork, scenarioWardNetwork, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import {
  allEmergencyDepartments,
  siteByCode,
  siteDirectory,
  STANDARD_WARD_SITES,
  wardNetworkOf,
} from "@/components/ward-management/ward-sites";

/**
 * Josh's card, 15 Oct 2026, "Pass values in": the React Compiler caches a calculation on the
 * inputs it can see, so a screen must receive the due-time warnings and the scenario's wards as
 * inputs (`useDueSoonThresholds()`, `useWardNetwork()`), never read them from a module-wide value
 * the provider sets during render.
 */

const SRC = "src";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const screens = sourceFiles(SRC).filter((path) => path.endsWith(".tsx"));

/** Server route files whose `generateMetadata` names the ward in the browser tab. Not React
 *  components, so the compiler never caches them; they read the standard network. */
const SERVER_METADATA = new Set([
  join(SRC, "app/ward-flow/ward/[unitId]/page.tsx"),
  join(SRC, "app/ward-flow/ward/[unitId]/answer/page.tsx"),
]);

/** The one place that points the module-wide lookups at the scenario's network, and reads them
 *  back outside a provider. */
const PROVIDER = join(SRC, "components/ward-management/ward-flow-provider.tsx");

function importedNames(source: string, module: RegExp): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
    if (!module.test(match[2])) continue;
    for (const raw of match[1].split(",")) {
      const name = raw
        .replace(/^\s*type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (name) names.push(name);
    }
  }
  return names;
}

describe("screens take the scenario's wards and the warnings as inputs", () => {
  it("no screen imports a ward lookup that follows the scenario", () => {
    const offenders = screens.flatMap((path) => {
      if (SERVER_METADATA.has(path)) return [];
      const source = readFileSync(path, "utf8");
      const banned = new Set(["wardSites", "allUnits", "unitById", "activateWardNetwork"]);
      // The provider points the lookups at the scenario, and its hook falls back to them outside one.
      if (path !== PROVIDER) ["activateScenarioNetwork", "activeWardNetwork"].forEach((name) => banned.add(name));
      const names = [...importedNames(source, /ward-sites$/), ...importedNames(source, /ward-scenarios$/)].filter(
        (name) => banned.has(name),
      );
      return names.map((name) => `${path}: ${name}`);
    });
    expect(offenders, "read the wards through useWardNetwork() instead").toEqual([]);
  });

  it("nothing reads the warnings from a module-wide value", () => {
    const offenders = sourceFiles(SRC).filter((path) =>
      /\b(?:applyDueSoonThresholds|currentDueSoonThresholds)\b/.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the server metadata files are still the only exceptions", () => {
    for (const path of SERVER_METADATA) {
      expect(readFileSync(path, "utf8"), path).toMatch(/export async function generateMetadata/);
    }
  });
});

describe("site identity is the same in every scenario, so its lookups need no scenario input", () => {
  // The opt-in fictional WA-like network is the one deliberate exception: it carries its own invented
  // sites, checked on its own below, so a lookup reads the active network instead of the standard list.
  const FICTIONAL_NETWORK = "wa-synthetic";
  const STANDARD_SITE_SCENARIOS = WARD_SCENARIOS.filter((scenario) => scenario !== FICTIONAL_NETWORK);

  it("every network keeps the standard sites in order, differing only in wards", () => {
    for (const scenario of STANDARD_SITE_SCENARIOS) {
      const sites = scenarioNetwork(scenario)?.sites ?? STANDARD_WARD_SITES;
      const identities = sites.map((site) => {
        const { units, ...identity } = site;
        void units;
        return identity;
      });
      expect(identities, scenario).toEqual(siteDirectory);
    }
  });

  it("every network shares the standard emergency departments, object for object", () => {
    const standard = allEmergencyDepartments();
    for (const scenario of STANDARD_SITE_SCENARIOS) {
      const sites = scenarioNetwork(scenario)?.sites ?? STANDARD_WARD_SITES;
      const departments = sites.flatMap((site) => (site.emergencyDepartment ? [site.emergencyDepartment] : []));
      expect(departments.length, scenario).toBe(standard.length);
      departments.forEach((department, index) => expect(department, scenario).toBe(standard[index]));
    }
  });

  it("the fictional network uses only invented site codes, none shared with the standard sites", () => {
    expect(WARD_SCENARIOS).toContain(FICTIONAL_NETWORK);
    const sites = scenarioNetwork(FICTIONAL_NETWORK)?.sites ?? [];
    expect(sites.length).toBeGreaterThan(0);
    const standardCodes = new Set(siteDirectory.map((site) => site.code));
    for (const site of sites) {
      expect(site.code.startsWith("SYN-"), site.code).toBe(true);
      expect(standardCodes.has(site.code), site.code).toBe(false);
    }
  });

  it("a site looked up by code carries no wards to go stale", () => {
    expect(siteByCode("RPH")?.code).toBe("RPH");
    expect(siteByCode("RPH")).not.toHaveProperty("units");
  });

  it("each scenario has one network object, so a screen sees it change only when the scenario does", () => {
    for (const scenario of WARD_SCENARIOS) {
      expect(scenarioWardNetwork(scenario)).toBe(scenarioWardNetwork(scenario));
    }
    expect(wardNetworkOf(STANDARD_WARD_SITES)).toBe(scenarioWardNetwork("standard"));
    const demo = WARD_SCENARIOS.find((scenario) => scenarioNetwork(scenario));
    expect(demo).toBeDefined();
    expect(scenarioWardNetwork(demo!)).not.toBe(scenarioWardNetwork("standard"));
  });
});
