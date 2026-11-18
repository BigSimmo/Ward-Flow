// Patients Print menu (option A, approved 18 Nov 2026): Print is a kit Menu headed "Print" with two
// choices, the whole list as the tab shows it, or a short sheet of only the people in ED and in
// placement, from any tab. The short sheet prints the ED and placement groups alone, and its scope
// clears on afterprint. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/bedchart/search",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

configure({ getElementError: () => new Error("Synthetic Patients print query failed; record text suppressed.") });

const SHORT_GROUPS = new Set(["ask", "ask-list", "wait", "wait-list", "found", "move"]);

afterEach(() => {
  act(() => window.dispatchEvent(new Event("afterprint")));
  cleanup();
  installMatchMediaStub(false);
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
    </WardFlowProvider>,
  );
}

function stateCount(label: string): number {
  const radio = within(screen.getByRole("radiogroup", { name: "Where people are now" }))
    .getAllByRole("radio")
    .find((candidate) => (candidate.textContent ?? "").startsWith(label));
  return Number((radio?.textContent ?? "").replace(/\D/gu, ""));
}

function openPrintMenu(trigger: HTMLElement) {
  fireEvent.click(trigger);
  return screen.getByRole("menu", { name: "Print" });
}

describe("Patients Print menu", () => {
  it("offers the whole list and the ED and placement sheet, with their counts", () => {
    renderPage();
    const trigger = screen.getByTestId("ward-census-print");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    const menu = openPrintMenu(trigger);
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/^Whole list\d+ people$/u);
    expect(items[1]).toHaveTextContent(
      `ED and placement only${stateCount("In ED") + stateCount("In placement")} people`,
    );
    expect(within(menu).getByRole("group", { name: "Print" })).toBeInTheDocument();

    // Escape closes the menu and returns focus to the trigger (the kit Menu).
    fireEvent.keyDown(items[0]!, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Print" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("prints only the ED and placement groups, from any tab, and clears the scope on afterprint", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPage();
    const expected = stateCount("In ED") + stateCount("In placement");
    // From another tab: the short sheet still holds everyone in ED and in placement.
    const inpatient = within(screen.getByRole("radiogroup", { name: "Where people are now" }))
      .getAllByRole("radio")
      .find((candidate) => (candidate.textContent ?? "").startsWith("Inpatient"))!;
    fireEvent.click(inpatient);

    const menu = openPrintMenu(screen.getByTestId("ward-census-print"));
    fireEvent.click(within(menu).getByRole("menuitem", { name: /ED and placement only/u }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.printScope).toBe("ed-placement");
    const sheet = screen.getByTestId("ward-patient-search-ed-placement-print");
    expect(sheet).toHaveAttribute("data-wf-print-doc", "ed-placement");
    expect(within(sheet).getByRole("heading", { name: "ED and placement" })).toBeInTheDocument();
    expect(sheet).toHaveTextContent(/Printed \w{3} \d{1,2} \w{3} \d{4}, \d{2}:\d{2}/u);
    expect(sheet).toHaveTextContent("BedChart prototype · Synthetic data only");

    const groups = [...sheet.querySelectorAll<HTMLElement>("[data-census-print-group]")];
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) expect(SHORT_GROUPS).toContain(group.dataset.censusPrintGroup);
    const rows = sheet.querySelectorAll("[data-census-short-row]");
    expect(rows).toHaveLength(expected);
    // One compact line: no age and sex, the UMRN kept, the time without its "waiting" word.
    expect(sheet.textContent).not.toMatch(/\d+y · [FM]\b/u);
    expect(rows[0]!.textContent).toMatch(/UM\d+/u);
    expect(sheet.querySelector("[data-census-short-time]")?.textContent).not.toMatch(/waiting/u);

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(document.documentElement.dataset.printScope).toBeUndefined();
    expect(screen.queryByTestId("ward-patient-search-ed-placement-print")).toBeNull();
  });

  it("prints the whole list as the page shows it, with no scope", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPage();
    const menu = openPrintMenu(screen.getByTestId("ward-census-print"));
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Whole list/u }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.printScope).toBeUndefined();
    expect(screen.queryByTestId("ward-patient-search-ed-placement-print")).toBeNull();
    // The census already draws its printed groups (every group open) before the browser takes the sheet.
    const console = screen.getByTestId("ward-patient-search-results-console");
    const groups = [...console.querySelectorAll<HTMLElement>("[data-census-print-group]")].map(
      (group) => group.dataset.censusPrintGroup,
    );
    expect(groups).toEqual(expect.arrayContaining(["ask", "found", "ward", "off"]));

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(console.querySelector("[data-census-print-group]")).toBeNull();
  });

  it("puts the same menu on the phone header after Copy list", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query !== "print",
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    renderPage();
    const chips = screen.getByRole("list", { name: "Patient actions" });
    const labels = within(chips)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim());
    expect(labels.slice(-2)).toEqual(["Copy list", "Print"]);
    const menu = openPrintMenu(screen.getByTestId("ward-patient-search-print"));
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.firstChild?.textContent),
    ).toEqual(["Whole list", "ED and placement only"]);
  });
});
