import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ReferralDuplicateCheck } from "@/components/ward-management/referrals/ward-referral-drawer-duplicate-check";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Item 38 (Josh, 9 Nov 2026): a person added from the referral's Patient step gets Add a patient's
 * duplicate check, and "Use this record" picks the existing person instead.
 */
const existing = seedWardFlowState().patients[0]!;
const blank = { umrn: "", givenName: "", familyName: "", dateOfBirth: "" };

describe("referral drawer duplicate check", () => {
  it("names an existing record with the same UMRN and offers it for this referral", () => {
    const onUse = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralDuplicateCheck draft={{ ...blank, umrn: existing.umrn.toLowerCase() }} onUse={onUse} />
      </WardFlowProvider>,
    );
    const row = screen.getByTestId(`ward-referral-duplicate-${existing.id}`);
    expect(row).toHaveTextContent("Same UMRN");
    fireEvent.click(screen.getByRole("button", { name: "Use this record" }));
    expect(onUse).toHaveBeenCalledTimes(1);
    expect(String(onUse.mock.calls[0]![0])).toMatch(/.+/u);
  });

  it("says no record matches for a new UMRN and name, and stays silent before anything is typed", () => {
    const { rerender } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralDuplicateCheck draft={blank} onUse={() => undefined} />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-referral-duplicate-check")).toBeNull();
    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralDuplicateCheck
          draft={{ ...blank, umrn: "ZZSYNTH999", givenName: "Synthetic", familyName: "Nobodyhere" }}
          onUse={() => undefined}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-referral-duplicate-none")).toBeInTheDocument();
  });
});
