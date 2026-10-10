import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * ED page, v10 (10 Oct 2026): four hero chips and the board filters highlight and dim. Every
 * person stays on the board; a row a filter or chip does not match carries data-dim.
 */
function renderEd() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="sjgm-ed" />
    </WardFlowProvider>,
  );
}

const rows = () => screen.getAllByTestId(/^ward-ed-patient-/u).filter((row) => row.tagName === "TR");

describe("ED page — hero chips and board filters highlight, never hide", () => {
  it("has four hero chips, each a pressed toggle", () => {
    renderEd();
    const chips = within(screen.getByRole("group", { name: "Highlight people on the board" })).getAllByRole("button");
    expect(chips).toHaveLength(4);
    for (const chip of chips) expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps every row when a board filter is pressed and dims the rows it does not match", () => {
    renderEd();
    const total = rows().length;
    expect(total).toBeGreaterThan(0);
    fireEvent.click(
      within(screen.getByRole("group", { name: "Filter the board" })).getByRole("button", { name: /Withdrawn/u }),
    );
    expect(rows()).toHaveLength(total);
    const solid = rows().filter((row) => row.getAttribute("data-dim") !== "true").length;
    expect(screen.getByText(/of \d+ match/u)).toHaveTextContent(`${solid} of ${total} match`);
  });

  it("keeps every row when a search matches nothing", () => {
    renderEd();
    const total = rows().length;
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a patient or UMRN" }), {
      target: { value: "zzzz-no-such-person" },
    });
    expect(rows()).toHaveLength(total);
    for (const row of rows()) expect(row).toHaveAttribute("data-dim", "true");
  });

  it("dims rows a hero chip does not match and clears from the note", () => {
    renderEd();
    const total = rows().length;
    const chip = within(screen.getByRole("group", { name: "Highlight people on the board" })).getByRole("button", {
      name: /Under a form/u,
    });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(rows()).toHaveLength(total);
    expect(screen.getByTestId("ward-ed-highlight-note")).toHaveTextContent("everyone stays on the board");
    fireEvent.click(within(screen.getByTestId("ward-ed-highlight-note")).getByRole("button", { name: "Clear" }));
    expect(rows().filter((row) => row.getAttribute("data-dim") === "true")).toHaveLength(0);
  });
});
