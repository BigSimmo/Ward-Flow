import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Help's Show me names a Settings section through the address (#display). Settings reads the address
 * when it opens, and also when only the hash changes while it is already open (review on #826).
 * Settings by login (31 Oct 2026): one page of sections, so the named section scrolls into view; an
 * old tab name (#display) lands on its new section (This device).
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
    const device = screen.getByTestId("ward-settings-screen").querySelector<HTMLElement>('[data-pane="device"]');
    expect(device).not.toBeNull();
    expect(scrolled).not.toContain("settings-section-device");
    act(() => {
      window.location.hash = "display";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(scrolled).toContain("settings-section-device");
    HTMLElement.prototype.scrollIntoView = original;
    vi.restoreAllMocks();
  });
});
