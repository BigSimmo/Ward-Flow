import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the 9 Oct 2026 fix for the pale band below short desktop pages.
 *
 * `.shell` (WardGround) stretches to the bottom of the window and paints the legacy ground, but
 * most screens paint their own canvas. Unless the route's screen fills the rest of `.shell`, a
 * page shorter than the window shows `.shell` below its footer as a near-white band (All EDs,
 * Wards, Patient, Community and others). A per-page fix only covers the pages someone checked,
 * so the fill lives on `.shell` itself and this test keeps it there.
 */
const css = readFileSync("src/components/ward-management/ward-shell.module.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//gu,
  "",
);

describe("WardGround fills the column below short pages", () => {
  it("lays .shell out as a growing flex column", () => {
    const shell = /(?:^|\})\s*\.shell\s*\{([^}]*)\}/u.exec(css)?.[1] ?? "";
    expect(shell).toMatch(/display:\s*flex/u);
    expect(shell).toMatch(/flex-direction:\s*column/u);
    expect(shell).toMatch(/flex:\s*1\s+0\b/u);
  });

  it("lets the route's screen grow into the rest of .shell", () => {
    const child = /\.shell\s*>\s*(?::last-child|\*)\s*\{([^}]*)\}/u.exec(css)?.[1] ?? "";
    expect(child, "no `.shell > :last-child` rule").not.toBe("");
    expect(child).toMatch(/flex(?:-grow)?:\s*[1-9]/u);
  });

  it("keeps hidden text in inner scroll boxes from scrolling the desktop page past its footer", () => {
    const desktop = /@media\s*\(min-width:\s*1001px\)\s*\{\s*\.shell\s*\{([^}]*)\}/u.exec(css)?.[1] ?? "";
    expect(desktop, "no desktop `.shell` containment rule").not.toBe("");
    expect(desktop).toMatch(/position:\s*relative/u);
    expect(desktop).toMatch(/overflow-y:\s*clip/u);
  });
});
