import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit A-4 (26 Oct 2026): the new referral's patient search had a listbox with no wiring. Each
 * result was its own Tab stop, no key moved through them, and a search that matched nobody said
 * nothing. It now works like the patient typeahead. Synthetic records only.
 */
afterEach(cleanup);

function open(onClose = vi.fn()) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={onClose} initialCategory="ward" />
    </WardFlowProvider>,
  );
  return screen.getByRole("combobox", { name: "Find a patient" });
}

describe("referral patient search keys (A-4)", () => {
  it("exposes the editable listbox control as a combobox with its current expanded state", () => {
    const search = open();
    expect(search).toHaveAttribute("role", "combobox");
    expect(search).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(search, { target: { value: "UM1000" } });
    const results = screen.getByRole("listbox", { name: "Matching patients" });
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(search).toHaveAttribute("aria-controls", results.id);
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(search).not.toHaveAttribute("aria-controls");
  });

  it("moves through the results with the arrow keys and picks with Enter", () => {
    const search = open();
    expect(search).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(search, { target: { value: "UM1000" } });
    const results = screen.getByRole("listbox", { name: "Matching patients" });
    expect(search).toHaveAttribute("aria-expanded", "true");
    const options = within(results).getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    expect(search).toHaveAttribute("aria-controls", results.id);
    // Nothing is highlighted until a key moves there, and the results are not Tab stops.
    expect(search).not.toHaveAttribute("aria-activedescendant");
    for (const option of options) expect(option).toHaveAttribute("tabindex", "-1");
    expect(document.body).toHaveTextContent(`${options.length} synthetic patients match.`);

    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(search).toHaveAttribute("aria-activedescendant", options[0]!.id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(search, { key: "ArrowUp" });
    expect(search).toHaveAttribute("aria-activedescendant", options[options.length - 1]!.id);
    fireEvent.keyDown(search, { key: "Home" });
    expect(search).toHaveAttribute("aria-activedescendant", options[0]!.id);

    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.queryByRole("listbox", { name: "Matching patients" })).toBeNull();
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("ward-referral-no-patient")).toBeNull();
  });

  it("says when nobody matches", () => {
    const search = open();
    fireEvent.change(search, { target: { value: "qqqqzz" } });
    expect(screen.queryByRole("listbox", { name: "Matching patients" })).toBeNull();
    expect(screen.getByTestId("referral-patient-no-match")).toHaveTextContent("No patient matches.");
    expect(document.querySelector('p[role="status"].sr-only')).toHaveTextContent("No patient matches.");
  });

  it("closes the results with Escape and leaves the referral open", () => {
    const onClose = vi.fn();
    const search = open(onClose);
    fireEvent.change(search, { target: { value: "UM1000" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Matching patients" })).toBeNull();
    expect(search).not.toHaveAttribute("aria-activedescendant");
    expect(onClose).not.toHaveBeenCalled();
  });
});
