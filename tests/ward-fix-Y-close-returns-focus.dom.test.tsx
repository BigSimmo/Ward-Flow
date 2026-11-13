import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/reports/chronology",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { StatisticsMapView } from "@/components/ward-management/statistics/statistics-map-view";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * F-57 (C17, design critique v2, Josh 13 Nov 2026): two more closes dropped focus on the page.
 * Statistics map: the site card's Close now returns focus to the map site that opened it.
 * Chronology: the side panel's "Close event" now returns focus to that event's row.
 * Synthetic seed data only.
 */
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => cleanup());

describe("F-57: closing a detail gives focus back to what opened it", () => {
  it("Statistics map: Close on a site card returns to that site on the map", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsMapView />
      </WardFlowProvider>,
    );
    const site = document.querySelector<SVGGElement>("[data-site]")!;
    expect(site).not.toBeNull();
    site.focus();
    fireEvent.click(site);
    const card = screen.getByTestId("ward-statistics-map-site");
    const close = card.querySelector<HTMLButtonElement>('button[aria-label^="Close "]')!;
    close.focus();
    fireEvent.click(close);
    expect(screen.queryByTestId("ward-statistics-map-site")).toBeNull();
    expect(document.activeElement).toBe(site);
  });

  it("Statistics map: a pointer press that left focus on the page still returns to the site", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsMapView />
      </WardFlowProvider>,
    );
    const site = document.querySelector<SVGGElement>("[data-site]")!;
    (document.activeElement as HTMLElement | null)?.blur?.();
    fireEvent.click(site);
    fireEvent.click(screen.getByTestId("ward-statistics-map-site").querySelector('button[aria-label^="Close "]')!);
    expect(document.activeElement).toBe(site);
  });

  it("Chronology: Close event returns to the event's row", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientChronologyScreen initialPatientId="PT-013" />
      </WardFlowProvider>,
    );
    const row = document.querySelector<HTMLButtonElement>("[data-chronology-event-action]")!;
    expect(row).not.toBeNull();
    row.focus();
    fireEvent.click(row);
    const close = screen.getByRole("button", { name: "Close event" });
    close.focus();
    fireEvent.click(close);
    expect(screen.queryByRole("button", { name: "Close event" })).toBeNull();
    expect(document.activeElement).toBe(row);
  });
});
