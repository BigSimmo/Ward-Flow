import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

function Receive({ involuntaryBedNeeded }: { involuntaryBedNeeded: boolean }) {
  const { dispatch, now, referrals, rejections } = useWardFlow();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            destinations: [
              {
                kind: "psychiatric_ward",
                sex: "Female",
                secureBedNeeded: false,
                involuntaryBedNeeded,
                highAcuityNursingNeeded: false,
              },
            ],
            homeRegion: "Perth Metropolitan",
            suburb: { kind: "named", name: "Armadale" },
            source: "community",
            urgency: 2,
            originSiteCode: "SCGH",
            transportNeeded: false,
            ...FIXTURE_HISTORY,
          })
        }
      >
        Receive synthetic referral
      </button>
      <output data-testid="new-referral">{referrals.at(-1)?.id}</output>
      <output data-testid="refusal-count">{rejections.length}</output>
    </>
  );
}

describe("Referral legal information does not infer authority from a bed request", () => {
  it.each([false, true])("keeps authority and register checks unknown when involuntaryBedNeeded is %s", (needed) => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Receive involuntaryBedNeeded={needed} />
        <ReferralBoard />
      </WardFlowProvider>,
    );
    const priorId = screen.getByTestId("new-referral").textContent;
    const priorRefusals = screen.getByTestId("refusal-count").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Receive synthetic referral" }));
    expect(screen.getByTestId("refusal-count")).toHaveTextContent(priorRefusals!);
    const id = screen.getByTestId("new-referral").textContent!;
    expect(id).not.toBe(priorId);
    const row = screen.getByTestId(`ward-referral-board-row-${id}`);
    fireEvent.click(screen.getByTestId(`ward-referral-board-select-${id}`));
    expect(row).toHaveAttribute("data-referral-id", id);
    // Option A (9 Oct 2026): legal status is a labelled cell in the decision strip ("Legal status" over "Not recorded").
    const legalStatus = screen.getByTestId("ward-referral-detail-legal-status");
    expect(legalStatus).toBeVisible();
    expect(legalStatus.textContent).toMatch(/Legal status\s*Not recorded/);
    expect(screen.queryByText(/Voluntary Status|Involuntary \(MHA 2014\)/)).not.toBeInTheDocument();
    // Option A moved the recorded legal information into the Patient tab.
    fireEvent.click(screen.getByRole("tab", { name: "Patient" }));
    expect(screen.getByText("Consent or detention authority")).toBeVisible();
    expect(screen.getByText("Not recorded in this referral")).toBeVisible();
    expect(screen.getByText("Register check not recorded on this referral.")).toBeVisible();
    expect(screen.getByText(/Referral raised/)).toBeVisible();
    expect(
      screen.queryByText(/✓ Affirmed|✓ Clear|Statutory Form 1A recorded|No active community treatment order/),
    ).not.toBeInTheDocument();
  });
});
