import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function parseJsonc(content: string) {
  // Remove single line comments that start with // (ignoring leading whitespace)
  const lines = content.split("\n").filter((line) => !line.trim().startsWith("//"));
  return JSON.parse(lines.join("\n"));
}

describe("Tier 1 - Feature 02: tsconfig.typecheck.json Greedy Glob Exclusions", () => {
  const tsconfigPath = path.resolve(process.cwd(), "tsconfig.typecheck.json");

  it("ensures tsconfig.typecheck.json exists and is readable", () => {
    expect(fs.existsSync(tsconfigPath)).toBe(true);
  });

  it("verifies tsconfig.typecheck.json contains mockup-backup-* in exclude", () => {
    const raw = fs.readFileSync(tsconfigPath, "utf8");
    const parsed = parseJsonc(raw);

    expect(Array.isArray(parsed.exclude)).toBe(true);
    expect(parsed.exclude).toContain("mockup-backup-*");
  });

  it("verifies tsconfig.typecheck.json contains mockups/** in exclude", () => {
    const raw = fs.readFileSync(tsconfigPath, "utf8");
    const parsed = parseJsonc(raw);

    expect(parsed.exclude).toContain("mockups/**");
  });

  it("verifies tsconfig.typecheck.json maintains source files in include list", () => {
    const raw = fs.readFileSync(tsconfigPath, "utf8");
    const parsed = parseJsonc(raw);

    expect(Array.isArray(parsed.include)).toBe(true);
    expect(parsed.include).toContain("**/*.ts");
    expect(parsed.include).toContain("**/*.tsx");
  });

  it("verifies standard build artifact directories remain excluded", () => {
    const raw = fs.readFileSync(tsconfigPath, "utf8");
    const parsed = parseJsonc(raw);

    expect(parsed.exclude).toContain("node_modules");
    expect(parsed.exclude).toContain(".next/**");
    expect(parsed.exclude).toContain("tmp/**");
  });
});

