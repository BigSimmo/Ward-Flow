// The bed board's "Record a blocker" dialog, redesigned on the kit Dialog (Josh approved, 31 Oct 2026).
// Pins what the build notes promise: nothing starts chosen, Confirm blocker says "Choose a reason
// first" until a reason is tapped, and every reason is offered word for word.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

afterEach(cleanup);

function openBlockerDialog(): HTMLElement {
  render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId="rph-adult-secure" requireConfirmation={false} />
    </WardFlowProvider>,
  );
  const triggers = screen.queryAllByRole("button", { name: "Record a blocker" });
  // Non-vacuity: the seeded ward really offers the action, or nothing below is proved.
  expect(triggers.length).toBeGreaterThan(0);
  fireEvent.click(triggers[0]);
  return screen.getByRole("dialog", { name: "Record a blocker" });
}

describe("Record a blocker dialog", () => {
  it("offers every reason word for word, with none chosen", () => {
    const dialog = openBlockerDialog();
    const radios = within(dialog).getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual([...BED_RELEASE_BLOCKERS]);
    for (const reason of BED_RELEASE_BLOCKERS) {
      expect(within(dialog).getByRole("radio", { name: reason })).not.toBeChecked();
    }
  });

  it("keeps Confirm blocker unavailable until a reason is tapped", () => {
    const dialog = openBlockerDialog();
    const confirm = within(dialog).getByRole("button", { name: /Confirm blocker/u });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(dialog).toHaveTextContent("Choose a reason first");

    fireEvent.click(confirm);
    // Pressing it unchosen records nothing and leaves the dialog open.
    expect(screen.getByRole("dialog", { name: "Record a blocker" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: BED_RELEASE_BLOCKERS[1] }));
    expect(within(dialog).getByRole("radio", { name: BED_RELEASE_BLOCKERS[1] })).toBeChecked();
    expect(dialog).not.toHaveTextContent("Choose a reason first");
    expect(within(dialog).getByRole("button", { name: "Confirm blocker" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("does not carry a reason over to the next opening", () => {
    const dialog = openBlockerDialog();
    fireEvent.click(within(dialog).getByRole("radio", { name: BED_RELEASE_BLOCKERS[2] }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Record a blocker" })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Record a blocker" })[0]);
    const again = screen.getByRole("dialog", { name: "Record a blocker" });
    for (const radio of within(again).getAllByRole("radio")) expect(radio).not.toBeChecked();
  });
});
