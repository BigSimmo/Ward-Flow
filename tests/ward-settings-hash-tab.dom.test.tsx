import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Help's Show me names a Settings section through the address (#display). Settings reads the address
 * when it opens, and also when only the hash changes while it is already open (review on #826).
 * Settings by role (Josh, 3 Nov 2026, ST1): one page of sections, so the named section scrolls into
 * view and its jump button is marked current; an old name (#device, #profile) lands on its new section
 * (Display, You).
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
  it("scrolls to the named section when the hash changes while Settings is open", () => {
    const scrolled: string[] = [];
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this.id);
    };
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    render(
      <ToastProvider>
        <WardFlowProvider>
          <SettingsScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const display = screen.getByTestId("ward-settings-screen").querySelector<HTMLElement>('[data-pane="display"]');
    expect(display).not.toBeNull();
    expect(scrolled).not.toContain("settings-section-display");
    act(() => {
      window.location.hash = "device";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(scrolled).toContain("settings-section-display");
    expect(screen.getByTestId("ward-settings-jump-display")).toHaveAttribute("aria-current", "true");
    act(() => {
      window.location.hash = "profile";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(scrolled).toContain("settings-section-you");
    expect(screen.getByTestId("ward-settings-jump-you")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("ward-settings-jump-display")).not.toHaveAttribute("aria-current");
    HTMLElement.prototype.scrollIntoView = original;
    vi.restoreAllMocks();
  });
});
