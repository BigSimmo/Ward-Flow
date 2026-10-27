import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { formTitleForCode } from "@/lib/form-register";

/**
 * P197 (Josh, 27 Oct 2026, option A): the Waiting list's Legal chip keeps "Form <code>" and explains
 * it in a tip that opens on keyboard focus and on a tap: "Form <code> (<register title>)", titles
 * from the form register only, with the time left or overdue kept on the end.
 */
afterEach(cleanup);

function renderWaiting() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
}

function formChips(): HTMLElement[] {
  return screen.queryAllByTestId("delays-legal-chip").filter((chip) => /^Form \S+$/.test(chip.textContent ?? ""));
}

describe("P197 Waiting Legal column tip", () => {
  it("opens the register title on keyboard focus", () => {
    renderWaiting();
    const chip = formChips()[0];
    expect(chip).toBeDefined();
    expect(chip).toHaveAttribute("tabindex", "0");
    const code = chip!.textContent!.replace(/^Form /, "");
    const title = formTitleForCode(code);
    act(() => chip!.focus());
    const tip = screen.getByTestId("tooltip");
    expect(tip.textContent).toMatch(
      new RegExp(`^Form ${code}${title ? ` \\(${title.replace(/[()]/g, "\\$&")}\\)` : ""}(, .+ (left|overdue))?$`),
    );
  });

  it("a tap on the chip shows the tip and does not open the row", () => {
    renderWaiting();
    const chip = formChips()[0]!;
    const row = chip.closest("tr")!;
    act(() => chip.focus());
    fireEvent.click(chip);
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(row).not.toHaveAttribute("aria-selected", "true");
  });
});
