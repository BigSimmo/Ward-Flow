import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/ward-flow/search",
}));
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// The Patients census search is the kit's one page search field (D-91, Patients redesign).
const SEARCH_LABEL = "Find a person by name, UMRN or place";

// Drawer review (6 Nov 2026): the side card and its sticky rail are gone, so a chosen row opens the
// kit right drawer at every width above the phone. matchMedia stands in for the phone layout.
let phone = false;
const phoneListeners = new Set<() => void>();

function setPhone(next: boolean) {
  phone = next;
  act(() => phoneListeners.forEach((listener) => listener()));
}

beforeEach(() => {
  phone = false;
  phoneListeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return phone;
    },
    addEventListener: (_type: string, listener: () => void) => phoneListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => phoneListeners.delete(listener),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function openRecordInDrawer() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
    </WardFlowProvider>,
  );
  fireEvent.change(screen.getByLabelText(SEARCH_LABEL), { target: { value: "WF-318" } });
  fireEvent.click(screen.getByTestId("ward-patient-search-case-WF-318"));
}

describe("Patient search record drawer", () => {
  it("opens the chosen record in the kit drawer, with no side card beside the census", () => {
    openRecordInDrawer();
    const drawer = screen.getByTestId("ward-patient-search-details");
    expect(drawer).toHaveAttribute("role", "dialog");
    expect(drawer).toHaveTextContent("Bed pulled");
    expect(document.querySelector("[data-preview-card]")).toBeNull();
    expect(screen.queryByRole("region", { name: "Patient details" })).not.toBeInTheDocument();
  });

  it("closes from its Close button and leaves the row chosen", () => {
    openRecordInDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Close patient details" }));
    expect(screen.queryByTestId("ward-patient-search-details")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-case-WF-318")).toHaveAttribute("aria-selected", "true");
  });

  // CodeRabbit (#1495): the phone keeps its own sheet, so the drawer closes at phone width. Widening
  // again leaves it shut with the row still chosen, one tap from reopening.
  it("closes at phone width and keeps the row chosen when the page widens again", () => {
    openRecordInDrawer();
    setPhone(true);
    expect(screen.queryByTestId("ward-patient-search-details")).not.toBeInTheDocument();

    setPhone(false);
    expect(screen.queryByTestId("ward-patient-search-details")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-search-case-WF-318")).toHaveAttribute("aria-selected", "true");
  });
});
