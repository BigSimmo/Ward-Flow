import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ed/rph-ed",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
  window.sessionStorage.clear();
});

/** P153: "Not yet identified" is one tap; there must be a way back to the patient search. */
describe("P153: way back from Not yet identified", () => {
  it("offers Find a patient instead and returns to the patient search", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} initialCategory="ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-referral-unidentified"));
    expect(screen.getByTestId("ward-referral-unidentified-description")).toBeTruthy();

    const back = screen.getByRole("button", { name: "Find a patient instead" });
    fireEvent.click(back);

    expect(screen.queryByTestId("ward-referral-unidentified-description")).toBeNull();
    expect(screen.queryByRole("button", { name: "Find a patient instead" })).toBeNull();
    expect(screen.getByTestId("ward-referral-unidentified")).toBeTruthy();
    const search = screen.getByRole("searchbox", { name: "Find a patient" });
    await vi.waitFor(() => expect(document.activeElement).toBe(search));
  });
});
