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
// of page width) is set inline, and the ResizeObserver that reports a layout change is stood in for.
const observers: Array<() => void> = [];

function setCardHidden(hidden: boolean) {
  document.querySelector<HTMLElement>("[data-preview-card]")!.style.display = hidden ? "none" : "";
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {}
      observe() {
        observers.push(this.callback);
      }
      unobserve() {}
      disconnect() {
        const index = observers.indexOf(this.callback);
        if (index >= 0) observers.splice(index, 1);
      }
    },
  );
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
    act(() => observers.forEach((notify) => notify()));

    expect(screen.queryByTestId("ward-patient-search-details")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Patient details" })).toHaveTextContent("Bed hold active");
  });

  it("stays open while the page is still one column", () => {
    openRecordInDrawer();
    act(() => observers.forEach((notify) => notify()));
    expect(screen.getByTestId("ward-patient-search-details")).toBeInTheDocument();
  });
});
