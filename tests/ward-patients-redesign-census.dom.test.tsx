// Patients redesign (Josh, "Yes to all", 31 Oct 2026): the table's "Where" header keeps its full spoken
// name, the phone highlight chips put the count first, and every "Show all" is the kit's Show more row.
// (The date of birth is typed into the one search box since audit four, so the old separate DD/MM/YYYY
// box and its switch are no longer tested here.)
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

afterEach(() => installMatchMediaStub(false));

describe("Patients redesign: the census page", () => {
  it("the table's Where column header still reads Where now to a screen reader", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    const table = screen.getByRole("table", { name: "Patients by where they are now" });
    const header = within(table).getByRole("columnheader", { name: "Where now" });
    expect(header).toHaveTextContent(/^Where$/u);
  });

  it("on a phone the highlights are one menu, each choice carrying its count", () => {
    // Audit four #107: the five highlight chips fold into one Highlight menu on a phone, counts in the menu.
    installMatchMediaStub(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("group", { name: "Highlight" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Highlight/u }));
    const choices = within(screen.getByRole("menu", { name: "Highlight" })).getAllByRole("menuitemcheckbox");
    expect(choices.length).toBeGreaterThan(0);
    for (const choice of choices) {
      expect(choice.textContent ?? "").toMatch(/\d/u);
    }
  });
});
