import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Until the PsychSift removal pass (25 September 2026), the mockups layout wrapped every mockup in
 * PsychSift's search shell and had to skip Ward Flow's routes by name; this test rendered that
 * client wrapper and proved the skip. With PsychSift gone the layout renders its children directly
 * and no host search shell exists, so the guard is now that the layout never brings one back.
 */
const REPO_ROOT = path.resolve(__dirname, "..");
const layout = readFileSync(path.join(REPO_ROOT, "src", "app", "mockups", "layout.tsx"), "utf8");

describe("Ward Flow standalone layout boundary", () => {
  it("renders every mockup route, Ward Flow's included, without a host search shell", () => {
    expect(layout).toMatch(/return children;/u);
    for (const forbidden of ["SearchShell", "clinical-dashboard", "mockups-layout-client", "MockupsLayoutClient"]) {
      expect(layout, forbidden).not.toContain(forbidden);
    }
  });
});
