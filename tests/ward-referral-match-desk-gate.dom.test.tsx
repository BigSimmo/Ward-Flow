import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// #794: a desk that does not answer a ward destination sees the ward decision greyed.
const desk = vi.hoisted(() => ({ role: "ed" }));
vi.mock("@/components/ward-management/ward-role-gate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/ward-role-gate")>()),
  useRouteRole: () => desk.role,
}));

function wardReferral() {
  const state = seedWardFlowState();
  const base = state.referrals.find((r) => r.destinations.some((d) => d.destination.kind === "psychiatric_ward"))!;
  return { ...base, destinations: base.destinations.filter((d) => d.destination.kind === "psychiatric_ward") };
}

function renderAs(role: string) {
  desk.role = role;
  render(
    <ReferralMatchView
      referral={wardReferral()}
      units={allUnits()}
      now={NOW_ANCHOR}
      dispatch={vi.fn()}
      rejections={[]}
    />,
  );
}

describe("referral decision by desk (#794)", () => {
  it("greys the ward decision for an ED desk and says who decides", () => {
    renderAs("ed");
    expect(screen.getByText("Only the receiving ward or the coordinator decides this.")).toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-match-decline-open")).toBeDisabled();
  });

  it("leaves the ward decision live for the coordinator", () => {
    renderAs("coordinator");
    expect(screen.queryByTestId("ward-referral-match-not-your-decision")).toBeNull();
    expect(screen.getByTestId("ward-referral-match-decline-open")).toBeEnabled();
  });
});
