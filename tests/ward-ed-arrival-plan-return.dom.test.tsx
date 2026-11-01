import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Review on PR #365: the patient record closes before the arrival plan opens (a native modal makes
 * the rest of the page inert), and closing the plan goes back to that record. A plan opened from a
 * board row has no record behind it, so closing it opens none.
 */
function renderEd() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="sjgm-ed" />
    </WardFlowProvider>,
  );
}

const recordToggle = () => screen.queryByTestId(/^ward-ed-drawer-arrival-plan-toggle-/u);
const recordOpen = () => document.querySelector("dialog[open]") !== null;

describe("ED arrival plan returns only to the record that opened it", () => {
  it("closes the record while the plan is open and reopens it when the plan closes", () => {
    renderEd();
    const names = screen
      .getAllByRole("button")
      // Handover build (Josh, 1 Nov 2026): the desktop Lists card names each person in a table row.
      .filter(
        (button) =>
          (button.closest("li") && button.className.includes("nameBtn")) || button.className.includes("listName"),
      );
    for (const name of names) {
      fireEvent.click(name);
      if (recordToggle()) break;
      const close = document.querySelector<HTMLDialogElement>("dialog[open]");
      if (close) fireEvent(close, new Event("cancel"));
    }
    const toggle = recordToggle();
    expect(toggle, "a seeded ED patient offers an arrival plan from the record").not.toBeNull();
    fireEvent.click(toggle as HTMLElement);
    expect(recordOpen()).toBe(false);
    expect(screen.getByTestId("save-arrival-plan-button")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByTestId("save-arrival-plan-button")).toBeNull();
    expect(recordToggle()).not.toBeNull();
  });

  it("opens no record when a plan opened from a board row closes", () => {
    renderEd();
    const [rowToggle] = screen.getAllByTestId(/^ward-ed-arrival-plan-toggle-/u);
    fireEvent.click(rowToggle);
    expect(screen.getByTestId("save-arrival-plan-button")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByTestId("save-arrival-plan-button")).toBeNull();
    expect(recordToggle()).toBeNull();
    expect(recordOpen()).toBe(false);
  });
});
