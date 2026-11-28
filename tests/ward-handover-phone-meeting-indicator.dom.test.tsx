import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart/handover",
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

describe("Handover phone meeting chip", () => {
  it("says Timer on while the meeting timer runs", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 46.4375rem)",
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
    const chip = screen.getByTestId("ward-handover-phone-meeting");
    expect(chip).toHaveTextContent("Meeting timer");
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    const running = screen.getByTestId("ward-handover-phone-meeting");
    expect(running).toHaveTextContent("Timer on");
    expect(running).toHaveAttribute("aria-pressed", "true");
  });
});
