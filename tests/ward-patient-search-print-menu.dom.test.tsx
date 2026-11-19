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
import { patientPrintChoices } from "@/components/ward-management/ward-list-print-menu";
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
    // 24-hour on every print (D-254): the sheet is stamped "10:42", so no row says "5:22 pm".
    expect(sheet.textContent).toMatch(/Due (\w{3} \d{1,2} \w{3} )?\d{2}:\d{2}/u);
    expect(sheet.textContent).not.toMatch(/\d{1,2}:\d{2} ?(am|pm)/iu);

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
    // The printed list has its own title and print time (19 Nov 2026 audit: it had none), and every
    // clock time on it takes the 24-hour face.
    expect(within(console).getByRole("heading", { name: "Patients" })).not.toHaveClass("sr-only");
    expect(console.querySelector("[data-census-print-title]")).toHaveTextContent(
      /Printed \w{3} \d{1,2} \w{3} \d{4}, \d{2}:\d{2}/u,
    );
    expect(console.textContent).toMatch(/Due (\w{3} \d{1,2} \w{3} )?\d{2}:\d{2}/u);
    expect(console.textContent).not.toMatch(/\d{1,2}:\d{2} ?(am|pm)/iu);

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(console.querySelector("[data-census-print-group]")).toBeNull();
    expect(console.querySelector("[data-census-print-title]")).toBeNull();
  });

  it("puts the menu on the phone header after Copy list, offering the short sheet only", () => {
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
    ).toEqual(["ED and placement only"]);
  });

  it("does not offer a print with nobody in it", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPage();
    // A search that matches nobody empties both choices.
    fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: "UM999999" } });
    const menu = openPrintMenu(screen.getByTestId("ward-census-print"));
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Whole listNo one to print",
      "ED and placement onlyNo one to print",
    ]);
    for (const item of items) expect(item).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(items[0]!);
    fireEvent.click(items[1]!);
    expect(print).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.printScope).toBeUndefined();
  });
});

describe("patientPrintChoices", () => {
  it("offers both choices on a desktop, with their people counts", () => {
    expect(patientPrintChoices({ wholePeople: 411, shortPeople: 1, phone: false })).toEqual([
      { id: "whole", label: "Whole list", meta: "411 people", scope: undefined, disabled: false },
      { id: "ed-placement", label: "ED and placement only", meta: "1 person", scope: "ed-placement", disabled: false },
    ]);
  });

  it("offers only the short sheet at phone width", () => {
    expect(patientPrintChoices({ wholePeople: 411, shortPeople: 29, phone: true }).map((choice) => choice.id)).toEqual([
      "ed-placement",
    ]);
  });

  it('disables a choice with nobody in it and says why, never "0 people"', () => {
    const [whole, short] = patientPrintChoices({ wholePeople: 0, shortPeople: 0, phone: false });
    expect(whole).toMatchObject({ disabled: true, meta: "No one to print" });
    expect(short).toMatchObject({ disabled: true, meta: "No one to print" });
    const [onlyShortEmpty] = patientPrintChoices({ wholePeople: 12, shortPeople: 0, phone: true });
    expect(onlyShortEmpty).toMatchObject({ id: "ed-placement", disabled: true, meta: "No one to print" });
  });
});
