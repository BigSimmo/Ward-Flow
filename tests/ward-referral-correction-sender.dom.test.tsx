import "@testing-library/jest-dom/vitest";
import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReferralHistoryAndCorrections } from "@/components/ward-management/referrals/referral-history-corrections";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** D-80: only the desk that sent a referral adds a correction, and it adds it in its own name. */
let pathname = "/ward-flow/referrals";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const WARD = seedWardFlowState().units.find((unit) => unit.cohort === "Adult")!;

function Refer() {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      source: "community",
      originSiteCode: "BTY",
      urgency: 2,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: WARD.id,
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Bentley" },
      transportNeeded: true,
      history: "Synthetic referral.",
    });
  }, [dispatch]);
  return null;
}

function Corrections() {
  const { referrals } = useWardFlow();
  const referral = referrals.at(-1);
  if (!referral) return null;
  return (
    <>
      <ReferralHistoryAndCorrections referral={referral} now={NOW_ANCHOR} />
      <output data-testid="by">{(referral.corrections ?? []).map((entry) => entry.by).join(",")}</output>
    </>
  );
}

function setup() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Refer />
      <Corrections />
    </WardFlowProvider>,
  );
}

describe("referral corrections", () => {
  beforeEach(() => {
    pathname = "/ward-flow/referrals";
  });

  it("offers a ward answering a community referral no correction control", () => {
    pathname = `/ward-flow/ward/${WARD.id}`;
    setup();
    expect(screen.getByTestId("ward-referral-history-and-corrections")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-correction-controls")).not.toBeInTheDocument();
  });

  it("lets the coordinator add one, recorded in its own name", () => {
    setup();
    fireEvent.change(screen.getByTestId("ward-referral-correction-note"), { target: { value: "Synthetic note." } });
    fireEvent.click(screen.getByTestId("ward-referral-add-correction"));
    expect(screen.getByTestId("by")).toHaveTextContent("coordinator");
  });
});
