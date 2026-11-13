import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * A12-08 (Audit 12, Josh approved 13 Nov 2026): the kit's Sheet and Dialog leave Escape to a focused
 * native select, and "Record a form" and the ED "Log transport booking" box both opened with focus on
 * a select, so Escape did nothing. Each box now opens with focus on its own heading, and Escape
 * closes it. The kit and its select guard are unchanged.
 */
const original = window.matchMedia;

afterEach(() => {
  window.matchMedia = original;
});

describe("Escape closes the box straight after it opens", () => {
  it("Record a form: focus starts on the heading, not a select, and Escape closes the sheet", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record a form" }));
    const box = screen.getByRole("dialog", { name: "Record a form" });
    const heading = within(box).getByRole("heading", { name: "Record a form" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(heading.tabIndex).toBe(-1);
    expect(document.activeElement?.tagName).not.toBe("SELECT");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Record a form" })).toBeNull());
  });

  it("Log transport booking: focus starts on the heading, not a select, and Escape closes the popup", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 46.4375rem)",
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
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-ed-patient-WF-011")).getByRole("button"));
    const actions = screen.getByTestId("ward-ed-phone-actions-WF-011");
    const fold = within(actions).queryByRole("button", { name: /^Not available yet \(\d+\)$/ });
    if (fold && fold.getAttribute("aria-expanded") !== "true") fireEvent.click(fold);
    fireEvent.click(
      within(screen.getByTestId("ward-ed-unavailable-handover-WF-011")).getByRole("button", {
        name: "Log transport booking",
      }),
    );
    const box = await screen.findByTestId("ward-ed-book-transport-WF-011");
    const heading = within(box).getByRole("heading", { name: "Log transport booking" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.activeElement?.tagName).not.toBe("SELECT");

    // Nothing typed yet, so Escape closes without asking to discard.
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("ward-ed-book-transport-WF-011")).toBeNull());
    // The person's sheet underneath stays open.
    expect(screen.getByTestId("ward-ed-phone-sheet-WF-011")).toBeInTheDocument();
  });
});
