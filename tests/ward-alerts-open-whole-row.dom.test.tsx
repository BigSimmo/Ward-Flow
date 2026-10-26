import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Josh (26 Oct 2026): the Open button covers the whole alert row, so pointer and keyboard take the
 * same route. The row itself is no longer a click target; its other controls stay above the cover.
 */
const css = readFileSync(path.join(process.cwd(), "src/components/ward-management/alerts/alerts.module.css"), "utf8");

function rule(selector: string) {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("alert rows: the Open button covers the row", () => {
  it("stretches the Open button over every row shape and keeps row actions above it", () => {
    expect(rule(".rowOpen::after")).toMatch(/position: absolute;[\s\S]*inset: 0;/);
    for (const row of [".row", ".card", ".phoneRow"]) expect(rule(row)).toContain("position: relative;");
    expect(rule(".rowAction")).toContain("z-index: 1;");
    expect(rule(".cardFoot > :last-child")).toContain("z-index: 1;");
    expect(rule(".rowOpen:focus-visible")).toContain("outline: 2px solid");
  });

  it("selects through the row's Open button", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    const row = container.querySelector<HTMLElement>("li[data-alert-id]:not([data-selected])");
    expect(row).not.toBeNull();
    const open = within(row!).getByTestId("ward-alerts-open");
    expect(open.tagName).toBe("BUTTON");
    expect(open.getAttribute("aria-label")).toMatch(/^Open /);
    fireEvent.click(open);
    expect(row).toHaveAttribute("data-selected", "true");
    expect(open).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("complementary", { name: "Selected alert" })).toBeInTheDocument();
  });
});
