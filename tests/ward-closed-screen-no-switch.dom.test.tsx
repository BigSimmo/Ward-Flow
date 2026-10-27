// P160 (Josh, 27 Oct 2026): the "Not part of your role" page offers Go to your home only. Switch
// desk is not shown there. Who may change desk, and where, is unchanged.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/ward-flow/statistics" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
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
import { WardAccessGate, WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("the closed screen", () => {
  it("offers Go to your home and no Switch desk", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAccessScope>
          <ToastProvider>
            <WardAccessGate>
              <p>Statistics</p>
            </WardAccessGate>
          </ToastProvider>
        </WardAccessScope>
      </WardFlowProvider>,
    );
    expect(screen.getByText("Not part of your role")).toBeInTheDocument();
    expect(screen.queryByText("Statistics")).toBeNull();
    expect(screen.getByTestId("ward-access-home")).toHaveTextContent("Go to your home");
    expect(screen.queryByTestId("ward-access-switch")).toBeNull();
    expect(screen.queryByRole("button", { name: "Switch desk" })).toBeNull();
  });
});
