import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const layout = vi.hoisted(() => ({ phone: false }));
vi.mock("@/components/wf", async (original) => ({
  ...(await original<typeof import("@/components/wf")>()),
  useIsPhone: () => layout.phone,
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
  layout.phone = false;
});

// Audit row P074: the visible "N needed" / "Complete" step badge is aria-hidden, so it must
// reach screen readers through the step button's aria-describedby instead.
describe("referral step badge accessible description (P074)", () => {
  it.each([
    ["desktop", false],
    ["phone", true],
  ] as const)("exposes the Patient step's needed count as its description on %s", async (_label, phone) => {
    layout.phone = phone;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} />
      </WardFlowProvider>,
    );
    const steps = await waitFor(() => screen.getByRole("group", { name: "Referral sections" }));
    const patient = within(steps).getByRole("button", { name: /Patient/ });
    expect(patient).toHaveAccessibleDescription(/\d+ needed|Complete/);
  });
});
