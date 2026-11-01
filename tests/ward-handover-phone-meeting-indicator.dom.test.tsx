import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * CodeRabbit (#1246): the meeting timer moved under the phone hero's "…" menu, so the trigger shows
 * in words, and says in its name, that the timer is running. Synthetic data only.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Handover phone More menu", () => {
  it("says Timer on while the meeting timer runs", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );
    const more = screen.getByTestId("ward-handover-phone-more");
    expect(more).toHaveAccessibleName("More handover actions");
    expect(more).not.toHaveTextContent("Timer on");
    await user.click(more);
    await user.click(screen.getByRole("menuitem", { name: "Start the meeting timer" }));
    const running = screen.getByTestId("ward-handover-phone-more");
    expect(running).toHaveTextContent("Timer on");
    expect(running).toHaveAccessibleName("More handover actions, timer on");
  });
});
