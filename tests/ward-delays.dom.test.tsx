import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DELAYS_CSS = "src/components/ward-management/delays/delays.module.css";

describe("Delays screen typography floor and DOM assertions (O-16.2)", () => {
  it("renders the Delays screen and paints data-ward-type-floor='delays-since' elements", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    // Stagnation elements (duration since blocker) carry data-ward-type-floor="delays-since"
    const sinceElements = document.querySelectorAll('[data-ward-type-floor="delays-since"]');
    expect(sinceElements.length).toBeGreaterThan(0);
    for (const el of sinceElements) {
      expect(el).toBeInTheDocument();
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("renders all four required Delays typography floor markers in the DOM", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    const requiredFloors = ["delays-cause", "delays-profile", "delays-wait", "delays-since"] as const;
    for (const floor of requiredFloors) {
      const elements = document.querySelectorAll(`[data-ward-type-floor="${floor}"]`);
      expect(elements.length, `Expected at least one [data-ward-type-floor="${floor}"] in Delays DOM`).toBeGreaterThan(
        0,
      );
    }
  });

  it("enforces that delays.module.css contains no font-size declarations computing to 11px or less", () => {
    const raw = readFileSync(DELAYS_CSS, "utf8");
    // Strip comments
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

    const lines = css.split("\n");
    const violations: { line: number; text: string }[] = [];

    lines.forEach((line, idx) => {
      const match = line.match(/font-size\s*:\s*([^;]+);/);
      if (match) {
        const val = match[1].trim();

        // Check for literal px values below 12px
        const pxMatch = val.match(/([0-9.]+)\s*px/);
        if (pxMatch && parseFloat(pxMatch[1]) < 12) {
          violations.push({ line: idx + 1, text: line.trim() });
        }

        // Check for literal rem values below 0.75rem (12px)
        const remMatch = val.match(/([0-9.]+)\s*rem/);
        if (remMatch && parseFloat(remMatch[1]) < 0.75) {
          violations.push({ line: idx + 1, text: line.trim() });
        }

        // Check for retired scale tokens like --text-3xs / --text-2xs
        if (/var\(--text-[23]xs\)/.test(val)) {
          violations.push({ line: idx + 1, text: line.trim() });
        }
      }
    });

    expect(
      violations,
      `delays.module.css contains font-size declarations computing to 11px or less:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });
});

describe("waits past 24 hours are neutral in colour (D-24, restored by D-194)", () => {
  it("draws the Past 24 hours band and the shape of the day's top band without danger red", () => {
    const board = readFileSync("src/components/ward-management/delays/delays-board.module.css", "utf8");
    expect(board).toMatch(/\.band3 \{\s*background: var\(--wf-neutral\);/u);
    const shape = readFileSync("src/components/ward-management/movements/movements-shape-of-day.module.css", "utf8");
    expect(shape).not.toMatch(/data-band="3"[^{]*\{[^}]*--wf-danger/u);
    expect(shape).not.toMatch(/data-tone="danger"/u);
    // D-24 item 6: no 24-hour line or zone on the spread chart; the unused red .r24 rule is gone.
    expect(board).not.toMatch(/\.gBeyond\b/u);
    expect(board).not.toMatch(/\.r24\b/u);
  });
});
