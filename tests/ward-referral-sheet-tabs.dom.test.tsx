import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { referralSentToVisible } from "@/components/ward-management/referrals/referral-sheet-access";
import { latestReferralForPerson } from "@/components/ward-management/referrals/referral-sheet-latest";
import { ReferralSummarySheet } from "@/components/ward-management/referrals/referral-summary-sheet";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/** RQ9 (Josh, 3 Nov 2026): one Referral sheet with tabs; Sent to only for the coordinator and the sender. Synthetic seed only. */
const state = seedWardFlowState();
const referral = referralQueueOrder(state.referrals)[0]!;

describe("Referral sheet tabs (RQ9)", () => {
  it("opens on Summary and moves to Full referral and Sent to", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralSummarySheet
          open
          onClose={() => undefined}
          referral={referral}
          name="SMITH, Alex"
          umrn="UM100001"
          demographics="34 F"
          now={NOW_ANCHOR}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("dialog", { name: "Referral" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Full referral" }));
    expect(screen.getByTestId("ward-referral-full-referral")).toBeInTheDocument();
    // The flag is off in tests, so the desk is the statewide coordinator, who sees Sent to.
    fireEvent.click(screen.getByRole("tab", { name: /^Sent to/ }));
    expect(screen.getByTestId("ward-referral-sent-to")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(referral.destinations.length);
    expect(screen.getByRole("button", { name: "Copy summary" })).toBeInTheDocument();
  });

  it("shows Sent to only to the coordinator and the desk that sent it", () => {
    const ed = allEmergencyDepartments()[0]!;
    const fromEd = { source: "ed_medical" as const, originSiteCode: ed.siteCode };
    expect(referralSentToVisible({ role: "coordinator", scope: { kind: "statewide" } }, fromEd)).toBe(true);
    expect(referralSentToVisible({ role: "ed", scope: { kind: "ed", edId: ed.id } }, fromEd)).toBe(true);
    expect(referralSentToVisible({ role: "ward", scope: { kind: "ward", unitIds: ["u1"] } }, fromEd)).toBe(false);
    expect(referralSentToVisible({ role: "bed_manager", scope: { kind: "site", siteCode: ed.siteCode } }, fromEd)).toBe(
      false,
    );
    const fromTeam = { source: "community" as const, originSiteCode: "X", sendingTeamName: "Team A" };
    expect(referralSentToVisible({ role: "community", scope: { kind: "team", teamName: "Team A" } }, fromTeam)).toBe(
      true,
    );
    expect(referralSentToVisible({ role: "community", scope: { kind: "team", teamName: "Team B" } }, fromTeam)).toBe(
      false,
    );
    const fromWard = { source: "psychiatric_ward" as const, originSiteCode: "X", originUnitId: "u1" };
    expect(referralSentToVisible({ role: "ward", scope: { kind: "ward", unitIds: ["u1"] } }, fromWard)).toBe(true);
  });

  it("finds a person's latest referral and nothing for an unlinked person", () => {
    expect(latestReferralForPerson(undefined, state.referrals)).toBeUndefined();
    expect(latestReferralForPerson("PT-none", state.referrals)).toBeUndefined();
  });
});
