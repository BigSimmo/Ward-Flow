import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The ward screen renders next/link anchors and jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Phone Notices (20 Oct 2026): the pop-up sheet closes from its own Close, the scrim or Escape. A
 * press on the sheet's title or grab handle is inside the sheet and must not close it (the ward
 * screen's click-outside listener is for the desktop popover).
 */
describe("phone Notices sheet", () => {
  it("stays open when its own title is pressed, and closes from Close", () => {
    asPhone();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <WardScreen unitId="rph-adult-secure" />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-notifications-toggle-btn"));
    const sheet = screen.getByTestId("ward-notifications-sheet");
    const title = document.getElementById(sheet.getAttribute("aria-labelledby") ?? "")!;
    expect(title).toHaveTextContent("Notices");

    fireEvent.mouseDown(title);
    fireEvent.mouseDown(sheet);
    expect(screen.getByTestId("ward-notification-center")).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: /^Close/ }));
    expect(screen.queryByTestId("ward-notification-center")).not.toBeInTheDocument();
  });
});
