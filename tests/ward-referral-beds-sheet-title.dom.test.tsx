import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { BEDS_READY_SCOPED_TITLE } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** P028 (Josh, 27 Oct 2026): the Referrals beds sheet names whose admissions its figure counts. */
describe("Beds ready names whose admissions it counts (P028)", () => {
  it("the Referrals beds sheet reads the scoped label", () => {
    // The beds sheet opens from the phone hero, so the board renders its phone layout here.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 46.4375rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-referral-phone-beds"));
    expect(screen.getByRole("dialog", { name: BEDS_READY_SCOPED_TITLE })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Waiting time against due times" })).not.toBeInTheDocument();
  });
});
