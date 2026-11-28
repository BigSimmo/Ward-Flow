import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { subscribeReferralRecord } from "@/components/ward-management/referrals/referral-sheet-bus";
import { ReferralRecordButton } from "@/components/ward-management/referrals/referral-sheet-button";
import { referralSentToVisible } from "@/components/ward-management/referrals/referral-sheet-access";
import { latestReferralForPerson } from "@/components/ward-management/referrals/referral-sheet-latest";
import { ReferralSummarySheet } from "@/components/ward-management/referrals/referral-summary-sheet";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
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
    // Audit four #98: the kit drawer head names the person under the "Referral" eyebrow.
    expect(screen.getByRole("dialog", { name: "SMITH, Alex" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Referral" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Full referral" }));
    expect(screen.getByTestId("ward-referral-full-referral")).toBeInTheDocument();
    // The flag is off in tests, so the desk is the statewide coordinator, who sees Sent to.
    fireEvent.click(screen.getByRole("tab", { name: /^Sent to/ }));
    expect(screen.getByTestId("ward-referral-sent-to")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(referral.destinations.length);
    expect(screen.getByRole("button", { name: "Copy for handover" })).toBeInTheDocument();
  });

  // Audit four #98: the one drawer pattern. Head: the eyebrow, the name and close, then the tier tag,
  // the UMRN and who. The body opens on the wait strip, which repeats neither the name nor the UMRN.
  // Foot: Copy for handover filled, then the quiet Patient page and Open in Referrals.
  it("draws the kit drawer head and foot, with the wait strip first in the body", () => {
    const linked = state.referrals.find((candidate) => candidate.patientId !== undefined)!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralSummarySheet
          open
          onClose={() => undefined}
          referral={linked}
          name="SMITH, Alex"
          umrn="UM100001"
          demographics="34 F"
          now={NOW_ANCHOR}
          patientId={linked.patientId}
        />
      </WardFlowProvider>,
    );
    const sheet = screen.getByTestId("ward-referral-summary-sheet");
    const head = sheet.querySelector("[data-drawer-head]") as HTMLElement;
    const foot = sheet.querySelector("[data-drawer-foot]") as HTMLElement;
    expect(head).toHaveTextContent(`Tier ${linked.urgency}`);
    expect(head).toHaveTextContent("UM100001");
    expect(head).toHaveTextContent("34 F");
    expect(within(head).queryByTestId("wf-drawer-pager")).toBeNull();
    const wait = screen.getByTestId("ward-referral-sheet-wait");
    expect(wait).toHaveTextContent(/^Tier \d.*Waiting/u);
    expect(wait).not.toHaveTextContent("SMITH, Alex");
    expect(wait).not.toHaveTextContent("UM100001");
    const copy = within(foot).getByRole("button", { name: "Copy for handover" });
    expect(copy.className).toMatch(/pri/u);
    expect(within(foot).getByRole("link", { name: "Patient page" })).toHaveAttribute(
      "href",
      patientHref(linked.patientId!),
    );
    expect(within(foot).getByRole("link", { name: "Open in Referrals" })).toHaveAttribute(
      "href",
      expect.stringContaining("/bedchart/referrals?referral="),
    );
    expect(
      within(sheet.querySelector("[data-drawer-scroll]") as HTMLElement).queryByRole("button", { name: /Copy/u }),
    ).toBeNull();
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
    // The sender rule's team normalisation applies, so a short desk spelling still counts as the sender.
    const fromLongName = {
      source: "community" as const,
      originSiteCode: "X",
      sendingTeamName: "Midland Community Team",
    };
    expect(
      referralSentToVisible({ role: "community", scope: { kind: "team", teamName: "Midland" } }, fromLongName),
    ).toBe(true);
    const fromWard = { source: "psychiatric_ward" as const, originSiteCode: "X", originUnitId: "u1" };
    expect(referralSentToVisible({ role: "ward", scope: { kind: "ward", unitIds: ["u1"] } }, fromWard)).toBe(true);
  });

  it("finds a person's latest referral and nothing for an unlinked person", () => {
    expect(latestReferralForPerson(undefined, state.referrals)).toBeUndefined();
    expect(latestReferralForPerson("PT-none", state.referrals)).toBeUndefined();
    const linked = state.referrals.find((candidate) => candidate.patientId !== undefined)!;
    const newer = { ...linked, id: "RF-newer", raisedAt: linked.raisedAt + 10 };
    expect(latestReferralForPerson(linked.patientId, [linked, newer])?.id).toBe("RF-newer");
  });

  it("opens the named referral from the shared Referral button, on the tab asked for, and draws nothing for an unknown one", () => {
    const opened: { referralId: string; tab?: string }[] = [];
    const stop = subscribeReferralRecord((request) => opened.push(request));
    const { unmount } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralRecordButton referralId={referral.id} tab="sent" />
        <ReferralRecordButton referralId="RF-none" />
      </WardFlowProvider>,
    );
    const buttons = screen.getAllByTestId("ward-referral-record-button");
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(opened).toEqual([{ referralId: referral.id, tab: "sent" }]);
    stop();
    unmount();
  });
});
