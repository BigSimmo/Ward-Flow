import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the 9 Oct 2026 fix for the pale band below short desktop pages.
 *
 * `.shell` (WardGround) stretches to the bottom of the window and paints the legacy ground, but
 * most screens paint their own canvas. Unless the route's screen fills the rest of `.shell`, a
 * page shorter than the window shows `.shell` below its footer as a near-white band (All EDs,
 * Wards, Patient, Statistics and others). A per-page fix only covers the pages someone checked,
 * so the fill lives on `.shell` itself and this test keeps it there.
 */
const css = readFileSync("src/components/ward-management/ward-shell.module.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//gu,
  "",
);

function rule(selector: RegExp): string {
  return new RegExp(String.raw`(?:^|\})\s*${selector.source}\s*\{([^}]*)\}`, "u").exec(css)?.[1] ?? "";
}

describe("WardGround fills the column below short pages", () => {
  it("lays .shell out as a growing flex column", () => {
    const shell = rule(/\.shell/u);
    expect(shell).toMatch(/display:\s*flex/u);
    expect(shell).toMatch(/flex-direction:\s*column/u);
    expect(shell).toMatch(/flex:\s*1\b/u);
  });

  it("lets the route's screen grow into the rest of .shell", () => {
    const child = rule(/\.shell\s*>\s*(?::last-child|\*)/u);
    expect(child, "no `.shell > :last-child` rule").not.toBe("");
    expect(child).toMatch(/flex(?:-grow)?:\s*[1-9]/u);
  });
});
