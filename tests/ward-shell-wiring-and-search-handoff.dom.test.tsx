import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardGlobalSearch } from "@/components/ward-management/ward-global-search";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { takeHandedOffPatientSearchText } from "@/components/ward-management/search/patient-query-handoff";
import { popSheet, pushSheet } from "@/components/wf/sheet-focus";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/persona-sync";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  setServiceScope(null);
  takeHandedOffPatientSearchText();
  popSheet("test-page-modal");
});

function GlobalSearchHost({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const { movements, patients, referrals, units } = useWardFlow();
  return (
    <WardGlobalSearch
      movements={movements}
      patients={patients}
      referrals={referrals}
      units={units}
      now={NOW_ANCHOR}
      onNavigate={onNavigate}
    />
  );
}

describe("Task 3 — Shell wiring, Escape coordination, and Global Search query handoff", () => {
  it("guards WardBar Escape announcement when a page-level modal sheet is open", () => {
    setServiceScope("South Metro");
    const modalNode = document.createElement("div");
    document.body.appendChild(modalNode);
    pushSheet("test-page-modal", modalNode);

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardBar />
      </WardFlowProvider>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("ward-live-region").textContent ?? "").not.toContain("Nothing more to clear");

    popSheet("test-page-modal");
    modalNode.remove();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("ward-live-region").textContent ?? "").toContain(
      "Nothing more to clear. The service stays South Metro.",
    );
  });

  it("updates shiftCockpit persona and enforces single-overlay mutual exclusion + Escape focus return in WardRail", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardRail />
      </WardFlowProvider>,
    );

    const appearanceBtn = screen.getByTestId("ward-rail-appearance-toggle");
    const personaBtn = screen.getByTestId("ward-rail-persona-trigger");

    // Open Appearance first
    fireEvent.click(appearanceBtn);
    expect(appearanceBtn).toHaveAttribute("aria-expanded", "true");

    // B6 (Josh, 19 Oct 2026): the person opens Go to a desk, the one switcher, and that closes Appearance.
    fireEvent.click(personaBtn);
    expect(personaBtn).toHaveAttribute("aria-expanded", "true");
    expect(appearanceBtn).toHaveAttribute("aria-expanded", "false");
    const drawer = await screen.findByRole("dialog", { name: "Go to a desk" }, { timeout: 15_000 });

    // Opening a desk announces it (persona sync); the shift cockpit shows that desk's person.
    act(() => dispatchPersonaSyncForRole("ed"));
    // Q58 (Josh, 31 Oct 2026): the rail names the person surname first.
    expect(screen.getAllByText(/Gallagher, Sr M\. · Triage liaison nurse/).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(within(drawer).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Go to a desk" })).not.toBeInTheDocument());
    expect(personaBtn).toHaveAttribute("aria-expanded", "false");

    // Reopen Appearance and press Escape -> closes and restores focus to appearanceBtn
    fireEvent.click(appearanceBtn);
    expect(appearanceBtn).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(appearanceBtn).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(appearanceBtn);
  });

  it("hands off typed query in memory from WardGlobalSearch Full patient search to PatientSearchPage without URL query params", () => {
    const onNavigate = vi.fn();
    const { unmount } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <GlobalSearchHost onNavigate={onNavigate} />
      </WardFlowProvider>,
    );

    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "UM100023" } });

    const fullSearchLink = screen.getByTestId("ward-global-search-full");
    expect(fullSearchLink).toHaveAttribute("href", "/ward-flow/search");
    fireEvent.click(fullSearchLink, { button: 0 });

    expect(onNavigate).toHaveBeenCalledWith("/ward-flow/search");
    unmount();

    // Mounting PatientSearchPage consumes the in-memory handoff into its search input
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );

    const searchInputs = screen.getAllByDisplayValue("UM100023");
    expect(searchInputs.length).toBeGreaterThan(0);
  });

  it("coordinates / vs Ctrl+K on /search", () => {
    // The Ward Flow Digest link moved from Tools to Settings, About (Tools review, 15 Oct 2026);
    // its new-tab wiring is pinned in tests/ward-settings-screen.dom.test.tsx.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar />
        <PatientSearchPage />
      </WardFlowProvider>,
    );

    // Pressing / when PatientSearchPage is mounted focuses the on-page census input, not global search
    (document.activeElement as HTMLElement | null)?.blur?.();
    fireEvent.keyDown(window, { key: "/" });
    expect(document.activeElement).toBe(screen.getByTestId("ward-patient-typeahead-input"));

    // Pressing Ctrl+K focuses WardGlobalSearch without PatientSearchPage stealing focus back
    (document.activeElement as HTMLElement | null)?.blur?.();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("ward-global-search-input"));
  });
});
