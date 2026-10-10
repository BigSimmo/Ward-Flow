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
  usePathname: () => "/mockups/ward-flow/search",
}));
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// jsdom applies no CSS module rules, so the side card's visibility (the stylesheet's call at 56rem
// of page width) is set inline. The ResizeObserver stand-in notifies only observers of the card that
// is mounted now, and matchMedia stands in for the phone layout (below 40rem).
const observed = new Map<() => void, Element>();
let phone = false;
const phoneListeners = new Set<() => void>();

function setCardHidden(hidden: boolean) {
  document.querySelector<HTMLElement>("[data-preview-card]")!.style.display = hidden ? "none" : "";
}

function resizeCard() {
  const card = document.querySelector("[data-preview-card]");
  act(() => {
    for (const [notify, element] of observed) if (element === card) notify();
  });
}

function setPhone(next: boolean) {
  phone = next;
  act(() => phoneListeners.forEach((listener) => listener()));
}

beforeEach(() => {
  observed.clear();
  phone = false;
  phoneListeners.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {}
      observe(element: Element) {
        observed.set(this.callback, element);
      }
      unobserve() {}
      disconnect() {
        observed.delete(this.callback);
      }
    },
  );
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
  setCardHidden(true);
  fireEvent.change(screen.getByLabelText("Search"), { target: { value: "WF-318" } });
  fireEvent.click(screen.getByTestId("ward-patient-search-case-WF-318"));
}

describe("Patient search record drawer when the page widens", () => {
  it("closes once the side card shows the record, so it is not shown twice", () => {
    openRecordInDrawer();
    expect(screen.getByTestId("ward-patient-search-details")).toBeInTheDocument();

    setCardHidden(false);
    resizeCard();

    expect(screen.queryByTestId("ward-patient-search-details")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Patient details" })).toHaveTextContent("Bed hold active");
  });

  it("stays open while the page is still one column", () => {
    openRecordInDrawer();
    resizeCard();
    expect(screen.getByTestId("ward-patient-search-details")).toBeInTheDocument();
  });

  it("still closes after the page passes through the phone layout and widens again", () => {
    openRecordInDrawer();
    setPhone(true);
    expect(screen.getByTestId("ward-patient-search-details")).toBeInTheDocument();

    setPhone(false);
    setCardHidden(false);
    resizeCard();

    expect(screen.queryByTestId("ward-patient-search-details")).not.toBeInTheDocument();
  });
});
