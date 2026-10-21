import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * v10 ED page, phone: the board is a priority list of compact rows (tier, name, one meta line, the
 * wait and the next step). A row opens the person sheet, which pins "Open patient" and the next
 * step, and lists every other action the row offered, so nothing is lost by dropping the row's
 * action strip. The inline forms open inside the sheet.
 */

const original = typeof window !== "undefined" ? window.matchMedia : undefined;

beforeEach(() => {
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
});

afterEach(() => {
  if (original) window.matchMedia = original;
});

function renderPhoneBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="rph-ed" />
    </WardFlowProvider>,
  );
  return screen.getAllByRole("listitem").filter((row) => row.dataset.testid?.startsWith("ward-ed-patient-"));
}

describe("ED board on phone", () => {
  it("renders compact rows with no action strip", () => {
    const rows = renderPhoneBoard();
    expect(rows.length).toBeGreaterThan(0);
    expect(document.querySelector('[data-testid^="ward-ed-patient-"]')?.tagName).toBe("LI");
    expect(screen.queryByRole("table", { name: /Emergency department board/ })).toBeNull();
    expect(document.querySelector('[data-testid^="ward-ed-unfold-"]')).toBeNull();
    expect(document.querySelector('[data-testid^="ward-ed-expand-"]')).toBeNull();
    for (const row of rows) {
      expect(within(row).getAllByRole("button")).toHaveLength(1);
      expect(row.textContent).toMatch(/Bay \d+/);
    }
  });

  it("opens the person sheet with Open patient, the next step and every other action", () => {
    const rows = renderPhoneBoard();
    const row = rows.find((candidate) => /Record exam$/.test(candidate.textContent ?? ""));
    expect(row).toBeDefined();
    const id = row!.dataset.testid!.replace("ward-ed-patient-", "");
    fireEvent.click(within(row!).getByRole("button"));

    const sheet = screen.getByTestId(`ward-ed-phone-sheet-${id}`);
    expect(within(sheet).getByRole("button", { name: "Open patient" })).toBeTruthy();
    const actions = screen.getByTestId(`ward-ed-phone-actions-${id}`);
    for (const name of ["Edit presentation", "Edit plan", "Record outcome", "Withdraw referral"]) {
      expect(within(actions).getByRole("button", { name })).toBeTruthy();
    }
    // Change 2 (D-77): the pinned next step is Record exam, so the list does not offer it again.
    expect(within(actions).queryByRole("button", { name: "Record examination" })).toBeNull();

    // The pinned next step opens the inline examination form inside the sheet.
    fireEvent.click(within(sheet).getByRole("button", { name: "Record exam" }));
    expect(within(sheet).getByText(/Examination outcome for/)).toBeTruthy();
  });

  it("opens the outcome form from the sheet's action list", () => {
    const rows = renderPhoneBoard();
    const row = rows.find((candidate) => /Record exam$/.test(candidate.textContent ?? ""))!;
    const id = row.dataset.testid!.replace("ward-ed-patient-", "");
    fireEvent.click(within(row).getByRole("button"));
    const actions = screen.getByTestId(`ward-ed-phone-actions-${id}`);
    const outcome = within(actions).getByRole("button", { name: "Record outcome" });
    fireEvent.click(outcome);
    expect(outcome.getAttribute("aria-expanded")).toBe("true");
  });

  it("Open patient closes the sheet", () => {
    const rows = renderPhoneBoard();
    const id = rows[0].dataset.testid!.replace("ward-ed-patient-", "");
    fireEvent.click(within(rows[0]).getByRole("button"));
    fireEvent.click(
      within(screen.getByTestId(`ward-ed-phone-sheet-${id}`)).getByRole("button", { name: "Open patient" }),
    );
    expect(screen.queryByTestId(`ward-ed-phone-sheet-${id}`)).toBeNull();
  });
});
