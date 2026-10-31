import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdActionsMenu } from "@/components/ward-management/ed/ed-board-controls";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * ED row actions and the examination popup, redesigned (pop-ed-actions and pop-record-exam, Josh
 * 31 Oct 2026, "Yes to all"). Synthetic records only.
 */

afterEach(cleanup);

describe("the ED row's actions menu", () => {
  it("names the person surname first with the UMRN, heads the record items, and opens on the next step", () => {
    render(
      <EdActionsMenu
        patientName="Synthetic Person"
        formalName="PERSON, Synthetic"
        umrn="UM100081"
        testId="actions-menu"
        triggerTestId="actions-trigger"
        onViewRecord={() => undefined}
        onEditPresentation={() => undefined}
        onEditPlan={() => undefined}
      >
        <button type="button" data-testid="ward-ed-outcome-toggle-m1">
          Record outcome
        </button>
        <button type="button" data-testid="ward-ed-book-transport-toggle-m1" data-next-step="">
          Log transport booking
        </button>
      </EdActionsMenu>,
    );
    fireEvent.click(screen.getByTestId("actions-trigger"));
    const menu = screen.getByTestId("actions-menu");
    expect(within(menu).getByText("Patient actions")).toBeInTheDocument();
    expect(menu.textContent).toContain("PERSON, Synthetic · UM100081");
    const record = within(menu).getByRole("group", { name: "Patient record", hidden: true });
    expect(
      within(record)
        .getAllByRole("menuitem", { hidden: true })
        .map((item) => item.textContent),
    ).toEqual(["View patient record", "Edit presentation", "Edit plan"]);
    // Group names say "and", not "&".
    expect(within(menu).getByRole("group", { name: "Review and disposition", hidden: true })).toBeInTheDocument();
    expect(within(menu).getByRole("group", { name: "Transfer and handover", hidden: true })).toBeInTheDocument();
    // Nothing greyed, so there is no "Not available yet" fold.
    expect(screen.queryByTestId("actions-menu-not-available")).toBeNull();
    // Focus starts on the row's next step, the one filled item.
    expect(document.activeElement).toBe(screen.getByTestId("ward-ed-book-transport-toggle-m1"));
  });

  it("uses the new item words on the board", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-ed-unfold-WF-011"));
    const menu = screen.getByTestId("ward-ed-actions-menu-WF-011");
    expect(within(menu).getByTestId("ward-ed-book-transport-toggle-WF-011")).toHaveTextContent("Log transport booking");
    expect(menu.textContent).not.toContain("&");
    expect(menu.textContent).not.toContain("Transport booked");
  });
});

describe("the examination outcome popup", () => {
  const original = typeof window !== "undefined" ? window.matchMedia : undefined;
  afterEach(() => {
    if (original) window.matchMedia = original;
  });

  function openExam() {
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 48rem)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
      </WardFlowProvider>,
    );
    const row = screen
      .getAllByRole("listitem")
      .find(
        (candidate) =>
          candidate.dataset.testid?.startsWith("ward-ed-patient-") && /Record exam$/.test(candidate.textContent ?? ""),
      )!;
    const id = row.dataset.testid!.replace("ward-ed-patient-", "");
    fireEvent.click(within(row).getByRole("button"));
    fireEvent.click(
      within(screen.getByTestId(`ward-ed-phone-sheet-${id}`)).getByRole("button", { name: "Record exam" }),
    );
    return id;
  }

  it("opens as its own popup naming the person surname first, with nothing chosen and Save outcome greyed", () => {
    const id = openExam();
    const dialog = screen.getByRole("dialog", { name: "Examination outcome" });
    expect(dialog).toHaveAttribute("data-testid", `ward-ed-examine-dialog-${id}`);
    const description = document.getElementById(dialog.getAttribute("aria-describedby")!)!.textContent!;
    // Surname first (D-83), then the UMRN and the ED.
    expect(description).toMatch(/^[^,·]+, [^·]+ · \S+( · Form \w+)? · .+ ED$/);
    const radios = within(dialog).getAllByRole("radio");
    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Inpatient treatment order",
      "Community treatment order",
      "Revoked — does not proceed",
      "Further examination ordered",
    ]);
    for (const radio of radios) expect(radio).not.toBeChecked();
    const save = within(dialog).getByRole("button", { name: "Save outcome" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(dialog).toHaveTextContent("Choose an outcome first");
  });

  it("saves the chosen outcome and closes; Cancel closes without saving", () => {
    const id = openExam();
    let dialog = screen.getByRole("dialog", { name: "Examination outcome" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Examination outcome" })).toBeNull();

    fireEvent.click(
      within(screen.getByTestId(`ward-ed-phone-sheet-${id}`)).getByRole("button", { name: "Record exam" }),
    );
    dialog = screen.getByRole("dialog", { name: "Examination outcome" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Community treatment order" }));
    const save = within(dialog).getByRole("button", { name: "Save outcome" });
    expect(save).not.toHaveAttribute("aria-disabled");
    fireEvent.click(save);
    expect(screen.queryByRole("dialog", { name: "Examination outcome" })).toBeNull();
  });
});
