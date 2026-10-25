import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Until the PsychSift removal pass (25 September 2026), the mockups layout wrapped every mockup in
 * PsychSift's search shell and had to skip Ward Flow's routes by name. The layout then rendered its
 * children directly and has since been removed, so the guard is now that nothing under the mockups
 * routes brings a host search shell back.
 */
const MOCKUPS_ROOT = path.resolve(__dirname, "..", "src", "app", "mockups");
const sources = readdirSync(MOCKUPS_ROOT, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(tsx?|css)$/u.test(entry.name))
  .map((entry) => path.join(entry.parentPath, entry.name));

describe("Ward Flow standalone layout boundary", () => {
  it("renders every mockup route, Ward Flow's included, without a host search shell", () => {
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      for (const forbidden of ["SearchShell", "clinical-dashboard", "mockups-layout-client", "MockupsLayoutClient"]) {
        expect(text, `${path.relative(MOCKUPS_ROOT, file)}: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
