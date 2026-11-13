import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import {
  discardReferralDraft,
  forgetReferrerContact,
} from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/*
 * F-44 (C22, design critique v2, Josh 13 Nov 2026): a completed Community referral could not be
 * sent, because the intake check had no community branch for its charts (A9-06 fixed that). This
 * walks the real slide-out end to end, from Community to the sent receipt, and checks the engine
 * kept it with no rejection. The confirm step reads "Charts: Not needed", never "0 attached".
 * Synthetic seed person only.
 */
afterEach(() => {
  cleanup();
  discardReferralDraft();
  forgetReferrerContact();
});

function Probe() {
  const { referrals, rejections } = useWardFlow();
  return (
    <>
      <output data-testid="community-sent">
        {referrals.filter((referral) => referral.intake?.chartsNotNeeded === true).length}
      </output>
      <output data-testid="referral-errors">{rejections.map((rejection) => rejection.reason).join(";")}</output>
    </>
  );
}

const steps = () => within(screen.getByRole("group", { name: "Referral sections" }));

describe("F-44: a completed Community referral reaches its receipt", () => {
  it("sends from the slide-out, says charts are not needed, and lands as a sent referral", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} initialPatientId="PT-023" initialDestination="community" />
        <Probe />
      </WardFlowProvider>,
    );
    const before = Number(screen.getByTestId("community-sent").textContent);
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    const purpose = screen.getByTestId("ward-referral-community-purpose");
    fireEvent.click(within(purpose).getAllByRole("radio")[0]!);
    const needs = screen.getByTestId("ward-referral-needs");
    fireEvent.click(
      within(within(needs).getByRole("group", { name: "First contact within" })).getByLabelText("24 hours"),
    );
    // The short form still asks whether medical clearance is complete (D-77); the answer is synthetic.
    fireEvent.click(
      within(screen.getByRole("group", { name: "Has the patient been medically cleared?" })).getByLabelText("Yes"),
    );
    fireEvent.click(steps().getByRole("button", { name: "Team" }));
    const teams = within(screen.getByRole("radiogroup", { name: "Community team to refer to" })).getAllByRole("radio");
    fireEvent.click(teams[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(screen.getByRole("heading", { name: "Confirm and send" })).toBeVisible();
    expect(screen.getByTestId("ward-referral-confirm-charts")).toHaveTextContent("Not needed");
    expect(screen.getByTestId("ward-referral-confirm-charts")).not.toHaveTextContent("attached");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Demo Sender" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sender@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0412345678" } });
    fireEvent.change(screen.getByLabelText("Your role"), { target: { value: "Nurse" } });
    fireEvent.change(screen.getByLabelText("Location or service"), { target: { value: "Synthetic clinic" } });
    fireEvent.submit(document.getElementById("referralConfirmForm")!);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Referral sent" })).toBeVisible());
    expect(screen.getByTestId("referral-errors")).toBeEmptyDOMElement();
    expect(screen.getByTestId("community-sent")).toHaveTextContent(String(before + 1));
  }, 60_000);
});
