import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/operator-switcher-modal";
import { popSheet, pushSheet } from "@/components/ui/sheet-focus";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

function trigger() {
  return screen.getByTestId("ward-rail-persona-trigger");
}

describe("rail persona follows the desk", () => {
  it("shows a transport officer for the Transport desk and a community clinician for the Community desk", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );

    act(() => dispatchPersonaSyncForRole("officer"));
    expect(trigger().getAttribute("aria-label")).toContain("Transport officer");
    expect(trigger().getAttribute("aria-label")).not.toContain("psychiatrist");

    act(() => dispatchPersonaSyncForRole("community"));
    expect(trigger().getAttribute("aria-label")).toContain("Community team clinician");
  });
});

describe("rail popover and sheets share one Escape", () => {
  it("leaves the persona popover open while a sheet is open, and closes it on the next press", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    const sheetNode = document.createElement("div");
    document.body.appendChild(sheetNode);
    pushSheet("test-rail-sheet", sheetNode);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    popSheet("test-rail-sheet");
    sheetNode.remove();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});
