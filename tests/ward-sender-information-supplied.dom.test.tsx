import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferralInformationNeedsPanel } from "@/components/ward-management/referrals/referral-information-needs-panel";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardPartialViewProvider } from "@/components/ward-management/ward-partial-view";
import { STATEWIDE_COORDINATOR } from "@/components/ward-management/ward-role-access";
import { setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { ReferralInformationNeed } from "@/components/ward-management/referrals/referral-information-needs";

vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/referrals" }));
const seed = seedWardFlowState();
const origin = seed.units[0];
const foreign = seed.units.filter((unit) => unit.id !== origin.id).slice(0, 2);
const referral: Referral = {
  ...seed.referrals[0],
  source: "psychiatric_ward",
  originUnitId: origin.id,
  originSiteCode: origin.siteCode,
  destinations: foreign.map((unit) => ({
    destination: {
      kind: "psychiatric_ward",
      unitId: unit.id,
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    },
    state: "queued",
    informationNeeds: [{ need: "legal_form_copy", at: NOW_ANCHOR - 10, by: "Ward manager" }],
  })),
};
const context = "a".repeat(64);

afterEach(() =>
  act(() => {
    setWardAccess(STATEWIDE_COORDINATOR);
    setWardFeatureFlagOnDevice("role-access", null);
  }),
);

function setup({
  role = "ward",
  missing = false,
  needs = ["legal_form_copy", "drug_screen"],
}: {
  role?: "ward" | "bed_manager";
  missing?: boolean;
  needs?: readonly ReferralInformationNeed[];
} = {}) {
  const dispatch = vi.fn();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(
      role === "ward"
        ? { role, scope: { kind: "ward", unitIds: [origin.id] } }
        : { role, scope: { kind: "site", siteCode: origin.siteCode } },
    );
  });
  function Capture() {
    const value = useWardFlow();
    return (
      <WardFlowOverride value={{ ...value, dispatch }}>
        <ReferralInformationNeedsPanel referral={referral} now={NOW_ANCHOR} />
      </WardFlowOverride>
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardPartialViewProvider
        currentRevision={9}
        currentAccessContext={context}
        currentNow={NOW_ANCHOR}
        senderRequired
        response={
          missing
            ? null
            : {
                revision: 9,
                accessContext: context,
                view: {
                  version: 1,
                  referrals: [
                    {
                      id: referral.id,
                      kind: "sender",
                      state: "queued",
                      withdrawn: false,
                      decidedAt: null,
                      visibleUntil: null,
                      canWithdraw: role === "ward",
                      informationNeeds: needs,
                    },
                  ],
                  movements: [],
                },
              }
        }
      >
        <Capture />
      </WardPartialViewProvider>
    </WardFlowProvider>,
  );
  return dispatch;
}

describe("sender information supplied panel", () => {
  it("shows distinct categories without recipients or request times and sends no destination handle", () => {
    const dispatch = setup();
    expect(screen.getAllByText("Legal form copy")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /as provided/ })).toHaveLength(2);
    for (const unit of foreign) expect(screen.queryByText(unit.name, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(/asked /)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Legal form copy as provided" }));
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: "MARK_REFERRAL_INFORMATION_MET",
      role: "ward",
      now: NOW_ANCHOR,
      referralId: referral.id,
      allRequestingWards: true,
      need: "legal_form_copy",
    });
  });

  it("keeps bed managers read only even when a supplied display advertises sender information", () => {
    const dispatch = setup({ role: "bed_manager" });
    const button = screen.getByRole("button", { name: "Mark Legal form copy as provided" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("reports unavailable instead of reading destination details from an old record", () => {
    setup({ missing: true });
    expect(screen.getByRole("status")).toHaveTextContent("Information requests unavailable.");
    expect(screen.queryByRole("button", { name: /as provided/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Legal form copy")).not.toBeInTheDocument();
  });

  it("does not resurrect old recipient requests when the current summary has none", () => {
    setup({ needs: [] });
    expect(screen.queryByTestId("ward-referral-needs-panel")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /as provided/ })).not.toBeInTheDocument();
  });
});
