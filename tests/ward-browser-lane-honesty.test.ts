import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { classifyChanges } from "../scripts/ward-ci-public/plan.mjs";

/**
 * M160 (audit, 10 Nov 2026): `npm run verify:ui` and the local PR browser lane once ran a single
 * security spec and no Ward journey, while their names promised a browser check of Ward Flow. These
 * contracts fail if either stops reaching a real Ward journey or the real phone-worker lane.
 */
const scripts = (
  JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

function wardSpecsNamed(command: string) {
  return command
    .split(/\s+/u)
    .filter((word) => /^ui-ward-[a-z0-9-]+$/u.test(word))
    .map((word) => `tests/${word}.spec.ts`);
}

describe("verify:ui runs Ward journeys (M160)", () => {
  it("runs the PR browser lane", () => {
    expect(scripts["verify:ui"]).toMatch(/npm run test:e2e:pr(?:\s|$)/u);
  });

  it("names the Ward journey project and existing Ward journey specs", () => {
    const lane = scripts["test:e2e:pr"];
    expect(lane).toContain("--project=chromium-mockups");
    // Ward journeys are tagged @mockup; excluding that tag would skip every one of them.
    expect(lane).not.toMatch(/--grep-invert[= ]"?[^"\s]*@mockup/u);
    const specs = wardSpecsNamed(lane);
    expect(specs).toContain("tests/ui-ward-full-journey.spec.ts");
    for (const spec of specs) {
      expect(existsSync(join(process.cwd(), spec)), `${spec} is missing`).toBe(true);
      const source = readFileSync(join(process.cwd(), spec), "utf8");
      expect(source, `${spec} has no Ward journey case`).toContain("@mockup");
    }
  });

  it("runs the real phone-worker lane", () => {
    expect(wardSpecsNamed(scripts["test:e2e:pr"])).toContain("tests/ui-ward-pwa-lifecycle.spec.ts");
  });
});

describe("hosted PR browser journeys cover the phone worker (M160)", () => {
  const scope = (...files: string[]) => classifyChanges(files.map((file) => ({ status: "M", file })));

  it.each([
    "public/ward-flow-push-sw.js",
    "public/ward-flow-offline.html",
    "src/app/manifest.ts",
    "src/components/ward-management/shell/ward-pwa-registration.tsx",
  ])("runs the browser journeys when %s changes", (file) => {
    expect(scope(file)).toMatchObject({ browser: true });
  });

  it("selects every Ward journey, the lifecycle spec included", () => {
    // The hosted lane runs this command in groups; each group is a slice of the same Ward specs.
    expect(scripts["test:e2e:ward-journeys"]).toMatch(/--project=chromium-mockups ui-ward-(?:\s|$)/u);
    expect(existsSync(join(process.cwd(), "tests/ui-ward-pwa-lifecycle.spec.ts"))).toBe(true);
  });
});
