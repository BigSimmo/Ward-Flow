import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import loadNextConfig, { LIVE_BUILD_DEMO_DATA } from "../next.config";
import * as standIn from "@/components/ward-management/live-build/ward-no-demo-data";
import * as AdmissionsSeed from "@/components/ward-management/ward-admissions-seed";
import * as DemoPlannedMoves from "@/components/ward-management/ward-demo-planned-moves";
import * as Movements from "@/components/ward-management/ward-movements";
import * as PatientsSeed from "@/components/ward-management/ward-patients-seed";
import * as RulingsDemo from "@/components/ward-management/ward-rulings-demo";

const DEMO_MODULES = [
  "ward-movements",
  "ward-patients-seed",
  "ward-admissions-seed",
  "ward-rulings-demo",
  "ward-demo-planned-moves",
];
const root = path.resolve(__dirname, "../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** Every `{ name }` the app (outside the demo modules themselves) imports from a demo module. */
function importedNames() {
  const found: { file: string; specifier: string; names: string[] }[] = [];
  const own = new Set(DEMO_MODULES.map((name) => path.join(root, "components/ward-management", `${name}.ts`)));
  for (const file of sourceFiles(root)) {
    if (own.has(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/import\s+(type\s+)?(\*\s+as\s+\w+|\{([^}]*)\})\s+from\s+"([^"]+)"/g)) {
      const specifier = match[4];
      if (!DEMO_MODULES.some((name) => specifier.endsWith(`/${name}`))) continue;
      if (match[1] || match[2].startsWith("*")) continue;
      const names = match[3]
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && !part.startsWith("type "))
        .map((part) => part.split(/\s+as\s+/)[0]);
      found.push({ file: path.relative(root, file), specifier, names });
    }
  }
  return found;
}

describe("a live shared build carries no demo records", () => {
  it("replaces every demo module the app imports, and the stand-in has every name it imports", () => {
    const imports = importedNames();
    expect(imports.length).toBeGreaterThan(0);
    for (const { file, specifier, names } of imports) {
      expect(LIVE_BUILD_DEMO_DATA.test(specifier), `${file} imports ${specifier}`).toBe(true);
      for (const name of names) expect(standIn, `${file} imports ${name}`).toHaveProperty(name);
    }
    expect(standIn.WARD_ADMISSIONS_ANCHOR).toBe(AdmissionsSeed.WARD_ADMISSIONS_ANCHOR);
  });

  it("gives every stand-in the same type as the demo export it replaces", () => {
    expectTypeOf(standIn.wardMovements).toEqualTypeOf(Movements.wardMovements);
    expectTypeOf(standIn.generatedMovementPatients).toEqualTypeOf(Movements.generatedMovementPatients);
    expectTypeOf(standIn.bedReleases).toEqualTypeOf(Movements.bedReleases);
    expectTypeOf(standIn.leaveBeds).toEqualTypeOf(Movements.leaveBeds);
    expectTypeOf(standIn.referrals).toEqualTypeOf(Movements.referrals);
    expectTypeOf(standIn.WARD_ADMISSIONS_ANCHOR).toEqualTypeOf(AdmissionsSeed.WARD_ADMISSIONS_ANCHOR);
    expectTypeOf(standIn.wardAdmissions).toEqualTypeOf(AdmissionsSeed.wardAdmissions);
    expectTypeOf(standIn.wardPlannedAdmissions).toEqualTypeOf(AdmissionsSeed.wardPlannedAdmissions);
    expectTypeOf(standIn.generatedOccupantPatients).toEqualTypeOf(AdmissionsSeed.generatedOccupantPatients);
    expectTypeOf(standIn.combineWardPatients).toEqualTypeOf(PatientsSeed.combineWardPatients);
    expectTypeOf(standIn.applyRulingsDemoOverlay).toEqualTypeOf(RulingsDemo.applyRulingsDemoOverlay);
    expectTypeOf(standIn.withDemoPlannedMoveTimes).toEqualTypeOf(DemoPlannedMoves.withDemoPlannedMoveTimes);
  });

  it("swaps the modules in only when the build is a live shared one", async () => {
    const config = await loadNextConfig();
    class NormalModuleReplacementPlugin {
      constructor(
        public pattern: RegExp,
        public replacement: string,
      ) {}
    }
    const plugins = (live: boolean) => {
      vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", live ? "true" : "false");
      try {
        const result = config.webpack!({ output: {}, plugins: [] }, {
          webpack: { NormalModuleReplacementPlugin },
        } as never) as { plugins: NormalModuleReplacementPlugin[] };
        return result.plugins;
      } finally {
        vi.unstubAllEnvs();
      }
    };
    expect(plugins(false)).toEqual([]);
    const [replacement] = plugins(true);
    expect(replacement.pattern).toBe(LIVE_BUILD_DEMO_DATA);
    expect(replacement.replacement).toBe(path.join(root, "components/ward-management/live-build/ward-no-demo-data.ts"));
  });
});
