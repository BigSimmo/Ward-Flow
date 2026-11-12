// The bed board's "Record hold-up" dialog, redesigned on the kit Dialog (Josh approved, 31 Oct 2026).
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
  const triggers = screen.queryAllByRole("button", { name: /^Record hold-up, / });
  // Non-vacuity: the seeded ward really offers the action, or nothing below is proved.
  expect(triggers.length).toBeGreaterThan(0);
  fireEvent.click(triggers[0]);
  return screen.getByRole("dialog", { name: "Record hold-up" });
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
    expect(screen.getByRole("dialog", { name: "Record hold-up" })).toBeInTheDocument();

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
    expect(screen.queryByRole("dialog", { name: "Record hold-up" })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /^Record hold-up, / })[0]);
    const again = screen.getByRole("dialog", { name: "Record hold-up" });
    for (const radio of within(again).getAllByRole("radio")) expect(radio).not.toBeChecked();
  });
});

describe("Before handover discharge tiles name their bed and person", () => {
  it("leads each heading with the card line and gives each action a distinct name", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="rph-adult-secure" requireConfirmation={false} />
      </WardFlowProvider>,
    );
    const band = screen.getByTestId("ward-board-work-band");
    const left = within(band).getAllByRole("button", { name: /^They have left, / });
    expect(left.length).toBeGreaterThan(0);
    // The visible word stays exactly "They have left"; the name adds who it is about.
    for (const button of left) expect(button).toHaveTextContent(/^They have left$/u);
    const names = left.map((button) => button.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(names.length);
    for (const button of left) {
      const tile = button.closest<HTMLElement>('[data-testid^="ward-board-shift-discharge-"]');
      expect(tile).not.toBeNull();
      const heading = within(tile!).getAllByRole("button")[0];
      expect(heading.textContent).toMatch(/discharge$/u);
      expect(button.getAttribute("aria-label")).toContain(heading.textContent!.split(" · ")[0]);
    }
    // 17: the band's heading is outside the fold's summary, and still names the section.
    expect(band.querySelector("summary h2")).toBeNull();
    expect(screen.getByRole("region", { name: "Before handover" })).toBeInTheDocument();
  });
});
