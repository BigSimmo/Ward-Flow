import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P147: the build targets are written down in the repo, not left to Next's default.
 * The wards use Safari, Edge and Chrome only (Josh, 27 Oct 2026), so the list
 * names exactly those three, at current versions.
 */
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { browserslist?: unknown };

describe("browser targets (P147)", () => {
  it("package.json declares an explicit browserslist", () => {
    expect(Array.isArray(pkg.browserslist)).toBe(true);
    expect((pkg.browserslist as unknown[]).length).toBeGreaterThan(0);
  });

  it("targets exactly the ward browsers: Safari, Edge and Chrome", () => {
    const list = (pkg.browserslist as string[] | undefined) ?? [];
    const families = new Set(
      list.map((query) => /^last \d+ (\w+) versions$/i.exec(query)?.[1]?.toLowerCase() ?? query),
    );
    expect([...families].sort()).toEqual(["chrome", "edge", "safari"]);
  });

  it("tracks current versions rather than a frozen floor", () => {
    const list = (pkg.browserslist as string[] | undefined) ?? [];
    for (const family of ["chrome", "edge", "safari"])
      expect(list).toContainEqual(expect.stringMatching(new RegExp(`^last \\d+ ${family} versions$`, "i")));
  });
});
