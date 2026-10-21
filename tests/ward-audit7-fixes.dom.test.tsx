import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { navigateContextuallyBack } from "@/components/contextual-back-link";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/* Audit 7 design reassessment fixes (20-21 Oct 2026). */

afterEach(() => {
  cleanup();
  discardReferralDraft();
  vi.restoreAllMocks();
});

describe("Back with no history asks before leaving a form (NB-06)", () => {
  function router() {
    return { back: vi.fn(), replace: vi.fn() };
  }

  it("stays put when the fallback is refused", () => {
    const r = router();
    const onFallback = vi.fn();
    navigateContextuallyBack(
      r,
      "/ward-flow/search",
      () => false,
      onFallback,
      () => false,
    );
    expect(r.replace).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("replaces the page when the fallback is accepted", () => {
    const r = router();
    navigateContextuallyBack(
      r,
      "/ward-flow/search",
      () => false,
      undefined,
      () => true,
    );
    expect(r.replace).toHaveBeenCalledWith("/ward-flow/search");
  });

  it("leaves a history step to the popstate guard", () => {
    const r = router();
    vi.spyOn(window.history, "length", "get").mockReturnValue(3);
    const confirmFallback = vi.fn(() => false);
    navigateContextuallyBack(r, "/ward-flow/search", () => true, undefined, confirmFallback);
    expect(r.back).toHaveBeenCalled();
    expect(confirmFallback).not.toHaveBeenCalled();
  });
});

describe("referral refusal points at the field it names (RC-N2)", () => {
  it("marks the patient search, focuses it and scrolls it into view", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} />
      </WardFlowProvider>,
    );
    const search = await screen.findByRole("searchbox", { name: "Find a patient" });
    expect(search).not.toHaveAttribute("aria-invalid");
    fireEvent.click(screen.getByRole("button", { name: /^Next, referral/ }));
    await waitFor(() => expect(search).toHaveFocus());
    expect(search).toHaveAttribute("aria-invalid", "true");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });
});
