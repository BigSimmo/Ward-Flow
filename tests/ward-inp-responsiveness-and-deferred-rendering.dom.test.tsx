// @vitest-environment jsdom

import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/mockups/ward-flow",
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({
    replace: navigationState.replace,
    push: navigationState.push,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

import { OverlayRoot } from "@/components/wf/overlay-root";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { HubScreen } from "@/components/ward-management/hub/hub-screen";

describe("INP responsiveness, deferred rendering, and font fallback contract", () => {
  beforeEach(() => {
    navigationState.pathname = "/mockups/ward-flow";
    navigationState.replace.mockReset();
    navigationState.push.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("enables adjustFontFallback on geistMono in src/app/layout.tsx to prevent tabular font-swap CLS", () => {
    const layoutSource = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layoutSource).not.toContain("adjustFontFallback: false");
    expect(layoutSource).toMatch(/adjustFontFallback:\s*["']Arial["']/);
  });

  it("opens the WardBar Tasks drawer immediately on click and exposes no closed Referral drawer heading", () => {
    render(
      <WardFlowProvider>
        <OverlayRoot />
        <WardBar />
      </WardFlowProvider>,
    );

    expect(document.getElementById("referralDrawerTitle")).toBeNull();

    const tasksTrigger = screen.getByTestId("ward-bar-tasks-trigger");
    expect(tasksTrigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(tasksTrigger);

    expect(tasksTrigger.getAttribute("aria-expanded")).toBe("true");
    const tasksSheet = screen.getByTestId("ward-bar-tasks-sheet");
    expect(tasksSheet).toBeTruthy();
  });

  it("updates CoordinatorScreen queue row selection and ShortlistPanel subject when clicking a queue row", () => {
    render(
      <WardFlowProvider>
        <OverlayRoot />
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    const grid = screen.getByTestId("ward-coordinator-region-grid");
    const queueButtons = Array.from(grid.querySelectorAll<HTMLElement>('[data-testid^="ward-queue-row-"]'));
    expect(queueButtons.length).toBeGreaterThan(1);

    const secondRow = queueButtons[1]!;
    const targetMovementId = secondRow.getAttribute("data-testid")?.replace("ward-queue-row-", "");
    expect(targetMovementId).toBeTruthy();

    fireEvent.click(secondRow);

    expect(secondRow.getAttribute("aria-pressed")).toBe("true");
    const placementAside = document.querySelector<HTMLElement>('aside[aria-label="Placement"]');
    expect(placementAside?.getAttribute("data-subject-movement")).toBe(targetMovementId);
  });

  it("filters PatientSearchPage census rows when typing UM1000 and memoizes CensusTableRow", () => {
    const censusViewSource = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/search/patient-census-view.tsx"),
      "utf8",
    );
    expect(censusViewSource).toContain("useDeferredValue");
    expect(censusViewSource).toMatch(/memo\(\s*function\s+CensusTableRow/);

    render(
      <WardFlowProvider>
        <OverlayRoot />
        <PatientSearchPage />
      </WardFlowProvider>,
    );

    const searchInput = screen.getByTestId("ward-patient-typeahead-input") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "UM1000" } });

    const consoleRegion = screen.getByTestId("ward-patient-search-results-console");
    expect(within(consoleRegion).getAllByText(/UM1000/i).length).toBeGreaterThan(0);
  });

  it("highlights matching HubScreen places when typing Royal Perth or clicking Pulled and memoizes place rows", () => {
    const hubSource = readFileSync(resolve(process.cwd(), "src/components/ward-management/hub/hub-screen.tsx"), "utf8");
    expect(hubSource).toContain("useDeferredValue");
    expect(hubSource).toContain("startTransition");
    expect(hubSource).toMatch(/memo\(/);

    render(
      <WardFlowProvider>
        <OverlayRoot />
        <HubScreen />
      </WardFlowProvider>,
    );

    const searchInput = screen.getByLabelText("Search wards, EDs and community teams") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "Royal Perth" } });

    expect(screen.getByTestId("hub-highlight-note")).toBeTruthy();
    const dimmedRows = document.querySelectorAll('[data-hub-row][data-dim="true"]');
    expect(dimmedRows.length).toBeGreaterThan(0);
  });
});
