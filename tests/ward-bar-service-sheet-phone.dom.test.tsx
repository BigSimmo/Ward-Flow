// shell-23 (13 Oct 2026): on a phone the service sheet is a real popup, like Menu and Create: a
// modal dialog, the page behind inert, focus on the chosen service. One word: Statewide. Desktop
// keeps its menu.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

function renderBar() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar />
      <main data-testid="page-behind">Page</main>
    </WardFlowProvider>,
  );
}

afterEach(() => {
  installMatchMediaStub(false);
  resetWardLiveRegionForTests();
  resetServiceScopeForTests();
});

describe("phone service sheet is a real popup", () => {
  it("opens as a modal dialog, inerts the page behind, focuses the chosen service, and says Statewide", async () => {
    installMatchMediaStub(true);
    renderBar();
    const trigger = screen.getByTestId("ward-bar-service-trigger");
    expect(trigger).toHaveAccessibleName("Service: Statewide");
    fireEvent.click(trigger);

    const panel = screen.getByTestId("ward-bar-service-panel");
    expect(panel).toHaveAttribute("role", "dialog");
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("page-behind").closest("[inert]")).not.toBeNull();
    expect(panel.closest("[inert]")).toBeNull();
    const chosen = panel.querySelector('[aria-pressed="true"]');
    expect(chosen).toHaveTextContent(/^Statewide/u);
    expect(document.activeElement).toBe(chosen);

    const scrim = document.querySelector("[data-ward-service-scrim]")!;
    fireEvent.click(scrim);
    // The phone sheet owns a history entry, so it closes on the Back that follows.
    await waitFor(() => expect(screen.queryByTestId("ward-bar-service-panel")).toBeNull());
    expect(screen.getByTestId("page-behind").closest("[inert]")).toBeNull();
  });

  it("stays a menu on desktop, with the page behind left alone", () => {
    installMatchMediaStub(false);
    renderBar();
    fireEvent.click(screen.getByTestId("ward-bar-service-trigger"));
    const panel = screen.getByTestId("ward-bar-service-panel");
    expect(panel).toHaveAttribute("role", "group");
    expect(panel).not.toHaveAttribute("aria-modal");
    expect(screen.getByTestId("page-behind").closest("[inert]")).toBeNull();
  });
});
