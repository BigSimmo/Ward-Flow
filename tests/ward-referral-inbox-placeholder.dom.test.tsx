import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardReferralInbox } from "@/components/ward-management/ward/ward-screen-lazy";
import { setForceDynamicLoading } from "./setup/jsdom.setup";

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow/ward/scgh-adult-open",
}));

afterEach(() => {
  setForceDynamicLoading(false);
  cleanup();
});

/**
 * Overall review (20 Oct 2026): while the ward's referral inbox loaded, its placeholder was an empty
 * section named "Ward referral inbox", so a screen reader listed an inbox with nothing in it. It
 * keeps the space (DA-02) but is now a hidden box with no name.
 */
function WithTwoEntries() {
  const value = useWardFlow();
  return (
    <WardFlowOverride value={{ ...value, wardReferralInbox: () => [{}, {}] as never }}>
      <WardReferralInbox unitId="scgh-adult-open" />
    </WardFlowOverride>
  );
}

describe("ward referral inbox placeholder", () => {
  it("holds the inbox's space without a named, empty landmark", () => {
    setForceDynamicLoading(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WithTwoEntries />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("region", { name: "Ward referral inbox" })).toBeNull();
    expect(document.querySelector('[aria-label="Ward referral inbox"]')).toBeNull();
    const holder = screen.getByTestId("ward-referral-inbox-placeholder");
    expect(holder).toHaveAttribute("aria-hidden", "true");
    expect(holder.style.minBlockSize).toBe("24rem");
  });
});
