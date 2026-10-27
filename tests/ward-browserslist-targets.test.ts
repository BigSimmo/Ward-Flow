import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P147: the build targets must be written down in the repo, not left to Next's default,
 * so the ward PC browsers (Edge/Chrome) are a deliberate, reviewable choice.
 */
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { browserslist?: unknown };

describe("browser targets (P147)", () => {
  it("package.json declares an explicit browserslist", () => {
    expect(Array.isArray(pkg.browserslist)).toBe(true);
    expect((pkg.browserslist as unknown[]).length).toBeGreaterThan(0);
  });

  it("covers the Chromium browsers the ward PCs run", () => {
    const list = (pkg.browserslist as string[] | undefined) ?? [];
    expect(list.some((query) => /^edge\b/i.test(query))).toBe(true);
    expect(list.some((query) => /^chrome\b/i.test(query))).toBe(true);
  });
});
