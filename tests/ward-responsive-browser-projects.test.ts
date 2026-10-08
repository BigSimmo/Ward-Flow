import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Ward responsive browser coverage", () => {
  const config = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");

  it("discovers the Ward responsive journey without routing prototype checks into inherited production projects", () => {
    const pattern = config.match(/const wardResponsiveSpecPattern = (\/.*\/);/);
    expect(pattern).not.toBeNull();
    const matcher = new RegExp(pattern![1].slice(1, -1));
    expect(matcher.test("tests/ui-ward-responsive-audit.spec.ts")).toBe(true);
    expect(matcher.test("tests/ui-ward-full-journey.spec.ts")).toBe(false);
    for (const browser of ["firefox", "webkit"]) {
      expect(config).toMatch(
        new RegExp(`name: "${browser}-ward-responsive",\\s+testMatch: wardResponsiveSpecPattern,\\s+grep: mockupTag,`),
      );
    }
  });
});
