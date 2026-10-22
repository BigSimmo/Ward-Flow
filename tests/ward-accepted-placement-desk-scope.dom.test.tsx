import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardAcceptedReferralPlacement } from "@/components/ward-management/ward/ward-accepted-referral-placement";

const scope = vi.hoisted(() => ({ deskInScope: undefined as ((deskId: string) => boolean) | undefined }));
vi.mock("@/components/ward-management/shell/ward-access", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access")>()),
  useDeskInScope: () => scope.deskInScope,
}));

function AcceptedReferral() {
  const value = useWardFlow();
  const referral: Referral = {
    ...value.referrals[0],
    id: "WF-SYNTHETIC-DESK-SCOPE",
    source: "ed_medical",
    originSiteCode: "SCGH",
    intake: undefined,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        decidedAt: NOW_ANCHOR,
      },
    ],
  };
  return (
    <WardFlowOverride
      value={{
        ...value,
        referrals: [referral],
        wardReferralInbox: (unitId) => wardReferralInboxEntries([referral], unitId),
      }}
    >
      <WardAcceptedReferralPlacement unitId="scgh-adult-open" onMessage={() => {}} onStarted={() => {}} />
    </WardFlowOverride>
  );
}

function renderPlacement(deskInScope: ((deskId: string) => boolean) | undefined) {
  scope.deskInScope = deskInScope;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AcceptedReferral />
    </WardFlowProvider>,
  );
}

describe("accepted referral placement respects the desk's ED scope", () => {
  it("sends a ward-only desk outside the source ED to the coordinator instead of offering Start placement", () => {
    renderPlacement((deskId) => deskId === "scgh-adult-open");
    expect(screen.queryByRole("button", { name: "Start placement" })).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-accepted-placement-coordinator")).toHaveTextContent(
      /Ask the flow coordinator to start it/,
    );
  });

  it.each([
    [
      "a desk whose scope includes the source ED",
      (deskId: string) => deskId === "scgh-adult-open" || deskId === "scgh-ed",
    ],
    ["a whole-network desk", undefined],
  ])("still offers Start placement to %s", (_label, deskInScope) => {
    renderPlacement(deskInScope);
    fireEvent.click(screen.getByRole("button", { name: "Start placement" }));
    expect(screen.getByRole("button", { name: "Confirm and start placement" })).toBeInTheDocument();
    expect(screen.queryByTestId("ward-accepted-placement-coordinator")).not.toBeInTheDocument();
  });
});

describe("accepted referral placement asks the Intermittent interval", () => {
  it("shows Check every only for Intermittent, offering 15 and 30 minutes", () => {
    renderPlacement(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Start placement" }));
    expect(screen.queryByRole("combobox", { name: "Check every" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Observation level" }), {
      target: { value: "intermittent" },
    });
    const interval = screen.getByRole("combobox", { name: "Check every" });
    expect([...(interval as HTMLSelectElement).options].map((option) => option.value)).toEqual(["15", "30"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Observation level" }), {
      target: { value: "within_sight" },
    });
    expect(screen.queryByRole("combobox", { name: "Check every" })).not.toBeInTheDocument();
  });
});
