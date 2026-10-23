// Visual desk on #576: under load, choosing Executive or Access admin in Go to a desk left the old
// page reading "Not part of your role" until the new desk's home arrived. The access changes at once
// and the page follows, so the old page now says the desk is opening, and only that page, only for
// the wait (shell/ward-desk-switch.ts).
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/ward-flow", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { WardAccessGate, WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { DESK_SWITCH_WAIT_MS, clearDeskSwitch } from "@/components/ward-management/shell/ward-desk-switch";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function app(withSwitcher: boolean) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <ToastProvider>
          <WardAccessGate>
            <p>Coordinator home</p>
          </WardAccessGate>
          {withSwitcher ? <OperatorSwitcherModal isOpen onClose={() => undefined} /> : null}
        </ToastProvider>
      </WardAccessScope>
    </WardFlowProvider>
  );
}

function switchToExecutive() {
  act(() => setWardFeatureFlagOnDevice("role-access", true));
  const view = render(app(true));
  fireEvent.click(screen.getByTestId("workstation-open-executive"));
  return view;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  nav.pathname = "/ward-flow";
  nav.push.mockReset();
  act(() => {
    clearDeskSwitch();
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("a desk switch on its way", () => {
  it("says the desk is opening on the page it left, not that the page is closed", () => {
    switchToExecutive();
    expect(nav.push).toHaveBeenCalledWith("/ward-flow/statistics");
    expect(screen.getByTestId("ward-access-opening")).toHaveTextContent("Opening the Executive desk");
    expect(screen.queryByText("Not part of your role")).toBeNull();
    expect(screen.queryByText("Coordinator home")).toBeNull();
  });

  it("opens the new home once it arrives, and forgets the switch", () => {
    const view = switchToExecutive();
    nav.pathname = "/ward-flow/statistics";
    view.rerender(app(false));
    expect(screen.getByText("Coordinator home")).toBeInTheDocument();
    // Back on the page it left, the desk's closed screen applies as usual.
    nav.pathname = "/ward-flow";
    view.rerender(app(false));
    expect(screen.getByText("Not part of your role")).toBeInTheDocument();
  });

  it("shows the closed screen if the new home has not arrived after the wait", () => {
    vi.useFakeTimers();
    switchToExecutive();
    expect(screen.getByTestId("ward-access-opening")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(DESK_SWITCH_WAIT_MS));
    expect(screen.getByText("Not part of your role")).toBeInTheDocument();
  });
});
