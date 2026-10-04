import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referralSenderRole } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Owner, 4 October 2026: the community team and the ED may record that they cancelled their own
 * referral, as well as the coordinator. The match view offers the whole-referral withdrawal with a
 * "recorded by" choice of the coordinator or the side that sent this referral.
 */

function Harness({ referralId }: { referralId: string }) {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const referral = referrals.find((candidate) => candidate.id === referralId);
  if (!referral) throw new Error(`fixture referral ${referralId} was not found in the seeded state`);
  return (
    <>
      <ReferralMatchView referral={referral} units={units} now={now} dispatch={dispatch} rejections={rejections} />
      <output data-testid="sender">{referralSenderRole(referral)}</output>
      <output data-testid="recorded-by">
        {referral.destinations.map((addressing) => addressing.withdrawalRecordedBy ?? "").join("|")}
      </output>
    </>
  );
}

function renderReferral(referralId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness referralId={referralId} />
    </WardFlowProvider>,
  );
}

describe("withdrawing a whole referral from the match view", () => {
  it("records the referring side as the recorder when chosen, after a confirm step", () => {
    renderReferral("RF-009");
    const sender = screen.getByTestId("sender").textContent as "ed" | "community";

    fireEvent.change(screen.getByTestId("ward-referral-match-withdraw-recorder"), { target: { value: "sender" } });
    fireEvent.click(screen.getByTestId("ward-referral-match-withdraw"));
    // Nothing is recorded until the confirm step.
    expect(screen.getByTestId("recorded-by").textContent).not.toContain(WARD_FLOW_ROLE_LABELS[sender]);
    fireEvent.click(screen.getByTestId("ward-referral-match-confirm-withdraw"));

    expect(screen.queryByTestId("ward-referral-match-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("recorded-by").textContent).toContain(WARD_FLOW_ROLE_LABELS[sender]);
    // Nothing left waiting, so the control is gone.
    expect(screen.queryByTestId("ward-referral-match-withdraw-controls")).not.toBeInTheDocument();
  });

  it("keeps the referral when the confirm step is cancelled", () => {
    renderReferral("RF-009");
    fireEvent.click(screen.getByTestId("ward-referral-match-withdraw"));
    fireEvent.click(screen.getByTestId("ward-referral-match-cancel-withdraw"));
    expect(screen.getByTestId("recorded-by").textContent?.replace(/\|/g, "")).toBe("");
    expect(screen.getByTestId("ward-referral-match-withdraw")).toBeInTheDocument();
  });
});
