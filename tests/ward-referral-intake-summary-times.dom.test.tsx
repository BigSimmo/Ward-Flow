import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralIntakeSummary } from "@/components/ward-management/referrals/referral-intake-summary";
import type { ReferralIntakeDetails } from "@/components/ward-management/referrals/referral-submission";
import type { WardReferralDrawerState } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import { ReferralConfirmation } from "@/components/ward-management/referrals/ward-referral-drawer-letter";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// The submitted times (here and on the drawer's Submitted details card) read as every other referral time does, through the shared
// referral time formatter on the board clock with its day when it is not today, never as the raw "2026-10-24 10:00" text.
// Synthetic data only.
afterEach(() => {
  cleanup();
});

const intake: ReferralIntakeDetails = {
  catchment: { teamName: "Synthetic North Team", confirmed: true },
  reasonForReferral: "Synthetic reason",
  legalStatus: "Voluntary",
  riskFlags: [],
  medicalClearance: {
    cleared: false,
    expectedAt: "2026-10-24T14:30+08:00",
    contactName: "Synthetic Contact",
    contactPhone: "0400 000 000",
  },
  triageAndRampCompleted: true,
  charts: [],
  additionalDocuments: false,
  referrer: {
    name: "Synthetic Referrer",
    email: "referrer@example.test",
    phone: "0400 000 001",
    role: "Registrar",
    location: "Synthetic ED",
  },
  arrival: { transport: "Ambulance", reference: "", estimatedAt: "2026-10-25T09:00+08:00" },
};

describe("referral intake summary times", () => {
  it("shows the clearance and arrival times on the board clock, with the day when it is not today", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={perthMidnight(2026, 9, 24).getTime()}>
        <ReferralIntakeSummary intake={intake} />
      </WardFlowProvider>,
    );
    expect(screen.getByText("Medical clearance").parentElement).toHaveTextContent(
      /^Medical clearancePending · expected 14:30 AWST$/,
    );
    expect(screen.getByText("Proposed arrival").parentElement).toHaveTextContent(
      /^Proposed arrivalAmbulance · 09:00 tomorrow AWST$/,
    );
    expect(document.body).not.toHaveTextContent("2026-10");
  });

  it("says when no arrival time was recorded", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={perthMidnight(2026, 9, 24).getTime()}>
        <ReferralIntakeSummary intake={{ ...intake, arrival: { transport: "Ambulance", reference: "" } }} />
      </WardFlowProvider>,
    );
    expect(screen.getByText("Proposed arrival").parentElement).toHaveTextContent(
      /^Proposed arrivalAmbulance · Time not recorded$/,
    );
  });
});

describe("referral drawer submitted details", () => {
  it("shows the proposed arrival on the board clock, with the day when it is not today", () => {
    // Only what the sent confirmation reads. The rest of the drawer state is not reached.
    const s = {
      now: NOW_ANCHOR,
      dayZero: perthMidnight(2026, 9, 24),
      sentReferralId: "RF-synthetic-1",
      sentAt: NOW_ANCHOR,
      confirmationHeadingRef: { current: null },
      recipientLabels: ["Synthetic Ward"],
      destType: "ward",
      decisionDueAt: () => undefined,
      onClose: () => {},
      copyText: () => {},
      confirmAndSend: () => {},
      letterInput: {
        destinationPhrase: "a ward",
        patientName: "Synthetic Person",
        umrn: "UM000001",
        ageSex: "41, female",
        suburb: "Midland",
        from: "Synthetic ED",
        recipients: ["Synthetic Ward"],
        urgency: "Tier 2, urgent",
        legalStatus: "Voluntary",
        reason: "Synthetic reason",
        history: "Synthetic history",
        risks: [],
        clearance: "Pending",
        referrer: { name: "Synthetic Referrer", role: "Registrar", phone: "0400 000 001" },
      },
      sentDetails: intake,
    } as unknown as WardReferralDrawerState;
    render(<ReferralConfirmation s={s} />);
    const arrival = screen.getByText("Proposed arrival").parentElement!;
    expect(arrival).toHaveTextContent(/09:00 tomorrow AWST$/);
    expect(arrival).not.toHaveTextContent("2026-10-25");
  });
});
