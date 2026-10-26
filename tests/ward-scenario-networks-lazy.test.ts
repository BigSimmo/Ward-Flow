import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const SRC = path.join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("lazily loaded demonstration networks (H-0952)", () => {
  it("refuses a demonstration scenario before its networks load, and seeds it after", async () => {
    vi.resetModules();
    const registry = await import("@/components/ward-management/ward-scenario-network-registry");
    const { scenarioNetwork, scenarioUnits } = await import("@/components/ward-management/ward-scenarios");
    expect(registry.loadedScenarioNetworks()).toBeNull();
    // The standard and scarce days never need them.
    expect(scenarioNetwork("standard")).toBeUndefined();
    expect(scenarioUnits("scarce").length).toBeGreaterThan(0);
    expect(() => scenarioNetwork("quiet-day")).toThrow("not loaded");
    expect(() => scenarioNetwork("wa-synthetic")).toThrow("not loaded");
    await registry.loadScenarioNetworks();
    expect(scenarioNetwork("quiet-day")?.sites.length).toBeGreaterThan(0);
    expect(scenarioNetwork("wa-synthetic")?.sites.length).toBeGreaterThan(0);
  });

  it("keeps both networks out of page code's static imports", () => {
    const allowed = new Set(
      [
        "components/ward-management/ward-scenario-networks.ts",
        "components/ward-management/ward-wa-synthetic-network.ts",
      ].map((file) => path.join(SRC, file)),
    );
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (allowed.has(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const base of ["ward-demo-network", "ward-wa-synthetic-network", "ward-scenario-networks"]) {
        const pattern = new RegExp(`^import (?!type )[^;]*?(?:from )?"[^"]*/${base}";`, "ms");
        if (pattern.test(text)) offenders.push(`${path.relative(process.cwd(), file)} -> ${base}`);
      }
    }
    // Server-only route lookups and the reducer's lazily loaded slices may register them eagerly.
    expect(offenders.sort()).toEqual([
      "src/components/ward-management/ward-flow-reducer-slices.ts -> ward-scenario-networks",
      "src/components/ward-management/ward-known-places.ts -> ward-scenario-networks",
    ]);
  });
});
