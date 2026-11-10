// shell-15 (Josh, 13 Oct 2026): on a phone All wards follows the header's service, and shows no
// "22 of 22" while nothing is filtered. Page tops (Josh, 9 Nov 2026): both sizes draw the services
// as the page's tabs.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/wards",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

function renderIndex(phone: boolean) {
  installMatchMediaStub(phone);
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardIndex />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  installMatchMediaStub(false);
  act(() => resetServiceScopeForTests());
});

describe("All wards service control on a phone (shell-15)", () => {
  // Page tops (Josh, 9 Nov 2026, approved mock-up): the phone's tab row is the health services
  // (All, then the first few, the rest under More), replacing shell-15's "no region chips on a phone".
  // What stays from shell-15: All is chosen while nothing is filtered, and no "N of N wards" shows.
  it("opens on All in the service tabs and shows no 'N of N wards' while nothing is filtered", () => {
    renderIndex(true);
    const services = screen.getByRole("radiogroup", { name: "Health service" });
    expect(within(services).getByRole("radio", { checked: true })).toHaveTextContent(/^All\s*\d+$/u);
    expect(screen.getByTestId("ward-index-count-note")).not.toHaveTextContent(/of \d+ wards/u);
  });

  it("follows the header's service", () => {
    act(() => setServiceScope("East Metro"));
    renderIndex(true);
    const eastMetro = allUnits().filter((unit) => unitHealthService(unit) === "East Metro").length;
    expect(eastMetro).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-index-count-note")).toHaveTextContent(
      new RegExp(`^Every ward${eastMetro} of \\d+ wards highlighted`, "u"),
    );
  });

  it("keeps the desktop chips", () => {
    renderIndex(false);
    expect(screen.getByLabelText("Health service")).toBeInTheDocument();
  });

  it("names desktop card percentages as beds in use", () => {
    const { container } = renderIndex(false);
    const figures = Array.from(container.querySelectorAll("article")).map(
      (card) => within(card).getByText(/^\d+%$/u).parentElement!,
    );
    expect(figures.some((figure) => /% in use$/u.test(figure.textContent ?? ""))).toBe(true);
    for (const figure of figures) expect(figure).toHaveTextContent(/^\d+% (in use|near full)$/u);
  });

  it("keeps each phone filter in its own scroll row and preserves the choices", () => {
    renderIndex(true);
    const toggle = screen.getByRole("button", { name: "Filters" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const label of ["Status", "Cohort", "Order"]) {
      const row = screen.getByRole("group", { name: `${label} choices` });
      expect(within(row).getByRole("radiogroup", { name: label })).toBeVisible();
    }
    const cohort = screen.getByRole("radiogroup", { name: "Cohort" });
    const last = within(cohort).getByRole("radio", { name: "Perinatal" });
    fireEvent.click(last);
    expect(last).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("ward-index-count-note")).toHaveTextContent(/wards highlighted/u);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
