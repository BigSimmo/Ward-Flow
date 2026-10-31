import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * UX audit 21 Oct 2026: the phone sheet showed "18 Items left" over steps whose "N needed" added
 * to 13 (the other five are the contact fields asked at Send). The hero now shows no count, so
 * the stepper and the footer line are the only places progress is stated.
 */

vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => true,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
});

describe("phone referral hero", () => {
  it("states no item count beside the stepper's per-step counts", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} initialCategory="ward" />
      </WardFlowProvider>,
    );
    const hero = screen.getByTestId("ward-referral-phone-hero");
    expect(hero).not.toHaveTextContent(/items left/iu);
    // New referral redesign (approved 31 Oct 2026): no "–" Urgency figure before one is chosen.
    expect(within(hero).queryByText("Urgency")).not.toBeInTheDocument();
    const steps = screen.getByRole("group", { name: "Referral sections" });
    expect(steps).toHaveTextContent(/\d+ needed/u);
  });
});
