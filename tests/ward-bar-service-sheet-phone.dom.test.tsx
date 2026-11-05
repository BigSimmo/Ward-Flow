// shell-23 (13 Oct 2026): on a phone the service sheet is a real popup, like Menu and Create: a
// modal dialog, the page behind inert, focus on the chosen service. One word: Statewide. Desktop
// and tablet use the same dialog pattern without the inert page (A3, A5, 2 Nov 2026).
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
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { NextBarMount as WardBar } from "@/components/ward-management/shell-next/next-bar";
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
    // Focus goes back to the Service button once the sheet has gone and the page is live again.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("ward-bar-service-trigger")));
  });

  it("keeps Tab and Shift+Tab inside the phone sheet", () => {
    installMatchMediaStub(true);
    renderBar();
    fireEvent.click(screen.getByTestId("ward-bar-service-trigger"));
    const panel = screen.getByTestId("ward-bar-service-panel");
    const buttons = Array.from(panel.querySelectorAll<HTMLElement>("button"));
    // jsdom lays nothing out, so give the buttons a box for the trap's visibility filter.
    for (const button of buttons) button.getClientRects = () => [{}] as unknown as DOMRectList;
    buttons.at(-1)!.focus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons.at(-1));
  });

  it("is a named, non-modal dialog on desktop that takes focus to the chosen service", () => {
    installMatchMediaStub(false);
    renderBar();
    const trigger = screen.getByTestId("ward-bar-service-trigger");
    // A5 (accessibility check, 2 Nov 2026): the button says dialog, as the panel is.
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(trigger);
    const panel = screen.getByTestId("ward-bar-service-panel");
    expect(panel).toHaveAttribute("role", "dialog");
    expect(panel).toHaveAccessibleName("Choose a health service");
    expect(panel).not.toHaveAttribute("aria-modal");
    expect(screen.getByTestId("page-behind").closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(panel.querySelector('[aria-pressed="true"]'));
  });

  it("returns focus to the Service button on Escape from inside the desktop panel", async () => {
    installMatchMediaStub(false);
    renderBar();
    const trigger = screen.getByTestId("ward-bar-service-trigger");
    fireEvent.click(trigger);
    const panel = screen.getByTestId("ward-bar-service-panel");
    const option = Array.from(panel.querySelectorAll<HTMLElement>("button")).at(-1)!;
    option.focus();
    fireEvent.keyDown(option, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("ward-bar-service-panel")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("closes the desktop panel when Tab leaves it, leaving focus where it went", async () => {
    installMatchMediaStub(false);
    renderBar();
    fireEvent.click(screen.getByTestId("ward-bar-service-trigger"));
    const panel = screen.getByTestId("ward-bar-service-panel");
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.append(outside);
    const option = panel.querySelector<HTMLElement>('[aria-pressed="true"]')!;
    fireEvent.focusOut(option, { relatedTarget: outside });
    outside.focus();
    await waitFor(() => expect(screen.queryByTestId("ward-bar-service-panel")).toBeNull());
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
