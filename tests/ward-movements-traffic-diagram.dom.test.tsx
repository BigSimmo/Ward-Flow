import { fireEvent, render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { TrafficDiagram } from "@/components/ward-management/movements/traffic-diagram";
import type { CorridorCount, RefusedCorridorCount } from "@/components/ward-management/movements/movements-derivations";
import { allUnits } from "@/components/ward-management/ward-sites";

const mockUnits = allUnits();
const unitA = mockUnits[0]; // Ward 2K
const unitB = mockUnits[1]; // RPH Older Adult

const mockCorridors: CorridorCount[] = [
  { originEdId: "ED-FSH", acceptedUnitId: unitA.id, stage: "moving", count: 2 },
  { originEdId: "ED-RPH", acceptedUnitId: unitB.id, stage: "pulled", count: 1 },
];

const mockRefusedCorridors: RefusedCorridorCount[] = [
  { originEdId: "ED-FSH", unitId: unitB.id, count: 1, reasons: ["no_bed"] },
];

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const parseHex = (hex: string) => {
    const clean = hex.replace("#", "");
    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("TrafficDiagram hover isolation and visual elevations", () => {
  it("renders all corridors and endpoints with default state initially", () => {
    const { container } = render(
      <TrafficDiagram corridors={mockCorridors} refusedCorridors={mockRefusedCorridors} units={mockUnits} />,
    );

    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(3); // 2 accepted + 1 refused
    for (const path of paths) {
      expect(path).not.toHaveAttribute("data-active");
      expect(path).not.toHaveAttribute("data-dimmed");
    }
  });

  it("isolates connected corridor paths when hovering an origin endpoint node", () => {
    const { container } = render(
      <TrafficDiagram corridors={mockCorridors} refusedCorridors={mockRefusedCorridors} units={mockUnits} />,
    );

    const originNodes = container.querySelectorAll("[data-side='origin']");
    expect(originNodes.length).toBeGreaterThan(0);

    // Hover ED-FSH node
    const edFshNode = Array.from(originNodes).find((el) => el.textContent?.includes("FSH"));
    expect(edFshNode).toBeDefined();

    fireEvent.mouseEnter(edFshNode!);

    // Node itself is active
    expect(edFshNode).toHaveAttribute("data-active", "true");

    // Check paths: ED-FSH -> unitA (accepted) and ED-FSH -> unitB (refused) should be active;
    // ED-RPH -> unitB should be dimmed to 0.2 opacity.
    const acceptedPaths = container.querySelectorAll("path[data-kind='accepted']");
    const refusedPaths = container.querySelectorAll("path[data-kind='refused']");

    // Path 0: ED-FSH to unitA
    expect(acceptedPaths[0]).toHaveAttribute("data-active", "true");
    expect(acceptedPaths[0]).not.toHaveAttribute("data-dimmed");

    // Path 1: ED-RPH to unitB (inactive)
    expect(acceptedPaths[1]).not.toHaveAttribute("data-active");
    expect(acceptedPaths[1]).toHaveAttribute("data-dimmed", "true");

    // Refused Path 0: ED-FSH to unitB (active)
    expect(refusedPaths[0]).toHaveAttribute("data-active", "true");
    expect(refusedPaths[0]).not.toHaveAttribute("data-dimmed");

    // Mouse leave restores state
    fireEvent.mouseLeave(edFshNode!);
    for (const path of container.querySelectorAll("path")) {
      expect(path).not.toHaveAttribute("data-active");
      expect(path).not.toHaveAttribute("data-dimmed");
    }
  });

  it("isolates connected corridor paths when hovering a destination endpoint node", () => {
    const { container } = render(
      <TrafficDiagram corridors={mockCorridors} refusedCorridors={mockRefusedCorridors} units={mockUnits} />,
    );

    const destNodes = container.querySelectorAll("[data-side='destination']");
    // Hover unitA (Ward 2K)
    const unitANode = Array.from(destNodes).find((el) => el.textContent?.includes(unitA.name));
    expect(unitANode).toBeDefined();

    fireEvent.mouseEnter(unitANode!);

    expect(unitANode).toHaveAttribute("data-active", "true");

    const acceptedPaths = container.querySelectorAll("path[data-kind='accepted']");
    const refusedPaths = container.querySelectorAll("path[data-kind='refused']");

    // Path 0: ED-FSH to unitA (active)
    expect(acceptedPaths[0]).toHaveAttribute("data-active", "true");
    // Path 1: ED-RPH to unitB (dimmed)
    expect(acceptedPaths[1]).toHaveAttribute("data-dimmed", "true");
    // Refused: ED-FSH to unitB (dimmed)
    expect(refusedPaths[0]).toHaveAttribute("data-dimmed", "true");

    fireEvent.mouseLeave(unitANode!);
  });

  it("highlights the hovered corridor path and dims all other paths to 0.2 opacity", () => {
    const { container } = render(
      <TrafficDiagram corridors={mockCorridors} refusedCorridors={mockRefusedCorridors} units={mockUnits} />,
    );

    const acceptedPaths = container.querySelectorAll("path[data-kind='accepted']");
    const refusedPaths = container.querySelectorAll("path[data-kind='refused']");

    // Hover first accepted path (ED-FSH to unitA)
    fireEvent.mouseEnter(acceptedPaths[0]);

    expect(acceptedPaths[0]).toHaveAttribute("data-active", "true");
    expect(acceptedPaths[1]).toHaveAttribute("data-dimmed", "true");
    expect(refusedPaths[0]).toHaveAttribute("data-dimmed", "true");

    // Connected endpoints should also be active
    const edFshNode = Array.from(container.querySelectorAll("[data-side='origin']")).find((el) =>
      el.textContent?.includes("FSH"),
    );
    const unitANode = Array.from(container.querySelectorAll("[data-side='destination']")).find((el) =>
      el.textContent?.includes(unitA.name),
    );
    expect(edFshNode).toHaveAttribute("data-active", "true");
    expect(unitANode).toHaveAttribute("data-active", "true");

    // Unhover
    fireEvent.mouseLeave(acceptedPaths[0]);
    expect(acceptedPaths[0]).not.toHaveAttribute("data-active");
    expect(acceptedPaths[1]).not.toHaveAttribute("data-dimmed");
    expect(refusedPaths[0]).not.toHaveAttribute("data-dimmed");
  });

  it("verifies dark mode color contrast >= 4.5:1 against dark ground (#0d1117)", () => {
    const darkGround = "#0d1117";
    const darkAccent = "#a7bcd2"; // --accent in dark theme
    const darkWarn = "#e3bc5e"; // --warn in dark theme

    const accentRatio = contrastRatio(darkAccent, darkGround);
    const warnRatio = contrastRatio(darkWarn, darkGround);

    expect(accentRatio).toBeGreaterThanOrEqual(4.5);
    expect(warnRatio).toBeGreaterThanOrEqual(4.5);

    // Blended with 0.85 opacity (our dark mode elevation floor)
    const blend = (fg: string, bg: string, alpha: number) => {
      const parseHex = (hex: string) => [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
      const [r1, g1, b1] = parseHex(fg);
      const [r2, g2, b2] = parseHex(bg);
      const r = Math.round(r1 * alpha + r2 * (1 - alpha));
      const g = Math.round(g1 * alpha + g2 * (1 - alpha));
      const b = Math.round(b1 * alpha + b2 * (1 - alpha));
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };

    const blendedAccent = blend(darkAccent, darkGround, 0.85);
    const blendedWarn = blend(darkWarn, darkGround, 0.85);

    expect(contrastRatio(blendedAccent, darkGround)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(blendedWarn, darkGround)).toBeGreaterThanOrEqual(4.5);
  });

  it("verifies CSS rules in traffic-diagram.module.css for dark mode elevation and 0.2 dimmed opacity", () => {
    const cssPath = path.resolve(__dirname, "../src/components/ward-management/movements/traffic-diagram.module.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    // Verify dark mode elevation rules
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toMatch(/opacity:\s*0\.85/u);

    // Verify hover isolation dimming to 0.2 opacity
    expect(css).toMatch(/corridorDimmed[\s\S]*?opacity:\s*0\.2/u);
    expect(css).toMatch(/\[data-dimmed="true"\][\s\S]*?opacity:\s*0\.2/u);
  });

  it("verifies movement-horizon.module.css for mobile < 480px clamp and .ganttBar sheen", () => {
    const cssPath = path.resolve(__dirname, "../src/components/ward-management/movements/movement-horizon.module.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    // Check @media (max-width: 480px) clamping .ganttColWard to 130px
    expect(css).toMatch(
      /@media\s*\(max-width:\s*480px\)[\s\S]*?\.ganttColWard\s*\{[\s\S]*?width:\s*130px;[\s\S]*?min-width:\s*130px;/u,
    );

    // Check .ganttBar sheen box-shadow
    expect(css).toMatch(
      /\.ganttBar\s*\{[\s\S]*?box-shadow:\s*inset 0 1px 0 (?:rgba\(255,\s*255,\s*255,\s*0\.15\)|color-mix\(in srgb,\s*var\(--surface\)\s*20%,\s*transparent\)),\s*var\(--lift\);/u,
    );
  });
});
