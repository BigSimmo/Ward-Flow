import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Help's Show me names a Settings tab through the address (#display). Settings reads the address
 * when it opens, and also when only the hash changes while it is already open (review on #826).
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";

afterEach(() => window.history.replaceState(null, "", window.location.pathname));

describe("Settings and the address hash", () => {
  it("opens the named tab when the hash changes while Settings is open", () => {
    render(
      <ToastProvider>
        <WardFlowProvider>
          <SettingsScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const display = () =>
      screen.getByTestId("ward-settings-screen").querySelector<HTMLElement>('[data-pane="display"]');
    expect(display()?.hidden).toBe(true);
    act(() => {
      window.location.hash = "display";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(display()?.hidden).toBe(false);
  });
});
