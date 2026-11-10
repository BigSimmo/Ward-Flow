import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-126 (Josh, 10 Nov 2026; D-71 no suggested or ranked wards): All wards offers only neutral
 * orders, Service (default) and A to Z, and the hero names no single "Most ready" ward. Its chip
 * counts the wards with a ready bed and toggles the Has ready filter instead.
 */
afterEach(cleanup);

function renderIndex() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardIndex />
    </WardFlowProvider>,
  );
}

describe("All wards: neutral orders only (D-126)", () => {
  it("offers Service and A to Z, with no Most ready or Fullest", () => {
    renderIndex();
    const order = screen.getByRole("radiogroup", { name: "Order" });
    expect(
      within(order)
        .getAllByRole("radio")
        .map((radio) => radio.textContent),
    ).toEqual(["Service", "A to Z"]);
    expect(within(order).getByRole("radio", { checked: true })).toHaveTextContent("Service");
    expect(screen.queryByText(/Most ready|Fullest/u)).toBeNull();
  });

  it("A to Z lists the ward cards by ward name, not by ready beds", () => {
    renderIndex();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Order" })).getByRole("radio", { name: "A to Z" }));
    const names = screen
      .getAllByTestId(/^ward-index-link-/u)
      .map((link) => link.closest("article")?.querySelector("h2, h3")?.textContent ?? "");
    expect(names.length).toBeGreaterThan(1);
    expect(names.every((name) => name !== "")).toBe(true);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("the hero chip counts wards with a ready bed and toggles the Has ready filter", () => {
    renderIndex();
    expect(screen.queryByTestId("ward-index-most-ready")).toBeNull();
    const chip = screen.getByTestId("ward-index-has-ready");
    expect(chip).toHaveTextContent(/^Has ready\s*\d+/u);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);
    expect(screen.getByTestId("ward-index-has-ready")).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByRole("radiogroup", { name: "Status" })).getByRole("radio", { checked: true }),
    ).toHaveTextContent("Has ready");
  });
});
