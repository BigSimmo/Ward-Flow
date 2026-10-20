// Codex review on #484 (20 Oct 2026): on a phone drill-down the header Back takes the Menu button's
// place, so a phone sheet that closes must return focus to Back, not to the hidden Menu button.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  usePathname: () => "/ward-flow/movements/MV-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  installMatchMediaStub(false);
  resetWardLiveRegionForTests();
});

describe("phone sheets on a drill-down screen", () => {
  it("return focus to the header Back that replaced Menu", async () => {
    installMatchMediaStub(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <WardBar />
      </WardFlowProvider>,
    );
    const back = screen.getByTestId("ward-bar-phone-back");
    expect(back.tagName).toBe("BUTTON");
    expect(screen.getByTestId("ward-bar-phone-menu")).toHaveAttribute("data-back-replaced");

    act(() => openWardDrawer("activity"));
    const sheet = await screen.findByTestId("ward-bar-activity-sheet");
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(back).toHaveFocus());
  });
});
