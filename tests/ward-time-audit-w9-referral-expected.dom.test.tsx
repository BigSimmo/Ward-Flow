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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ward-flow/coordinator",
  useSearchParams: () => new URLSearchParams(),
}));

import { referralExpectedTime } from "@/components/ward-management/referrals/referral-expected-time";
import { ReferralIntakeSummary } from "@/components/ward-management/referrals/referral-intake-summary";
import { PatientTab } from "@/components/ward-management/referrals/referral-panel-tabs";
import type { ReferralIntakeDetails } from "@/components/ward-management/referrals/referral-submission";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";

// Time audit G6 (13 Nov 2026): a pending medical clearance whose expected time has gone by says
// "(passed)" beside the time, so it does not read as still ahead. Synthetic data only.
afterEach(() => {
  cleanup();
});

const DAY_ZERO = perthMidnight(2026, 9, 24);
const NOW = 15 * 60; // 15:00 on the board clock

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
};

describe("referral expected time", () => {
  it("adds (passed) only when the expected time is earlier than now", () => {
    const clearance = intake.medicalClearance;
    expect(referralExpectedTime(clearance.expectedAt, clearance, DAY_ZERO, NOW, "AWST")).toBe("14:30 AWST (passed)");
    expect(referralExpectedTime(clearance.expectedAt, clearance, DAY_ZERO, 14 * 60, "AWST")).toBe("14:30 AWST");
    expect(referralExpectedTime(clearance.expectedAt, clearance, DAY_ZERO, 14 * 60 + 30, "AWST")).toBe("14:30 AWST");
    expect(referralExpectedTime(undefined, clearance, DAY_ZERO, NOW)).toBe("Time not recorded");
    // Without a board clock there is no now to compare with.
    expect(referralExpectedTime(clearance.expectedAt, clearance, DAY_ZERO, undefined)).not.toContain("passed");
  });

  it("follows the demonstration day for a seeded target", () => {
    const seeded = { syntheticTimelineBase: "2026-10-24T00:00:00+08:00" };
    const nextDay = perthMidnight(2026, 9, 25);
    expect(referralExpectedTime("2026-10-24T14:30+08:00", seeded, nextDay, NOW, "AWST")).toBe("14:30 AWST (passed)");
    expect(referralExpectedTime("2026-10-24T14:30+08:00", seeded, nextDay, 60, "AWST")).toBe("14:30 AWST");
  });

  it("names the demo's own clock when no zone is passed (F-113)", () => {
    const clearance = intake.medicalClearance;
    expect(referralExpectedTime(clearance.expectedAt, clearance, DAY_ZERO, NOW)).toBe("14:30 demo time (passed)");
  });

  it("says passed on the referral intake summary", () => {
    render(
      <WardFlowProvider initialNow={NOW} initialDayZero={DAY_ZERO.getTime()}>
        <ReferralIntakeSummary intake={intake} />
      </WardFlowProvider>,
    );
    expect(screen.getByText("Medical clearance").parentElement).toHaveTextContent(
      /^Medical clearancePending · expected 14:30 demo time \(passed\)$/,
    );
  });

  it("says passed on the referral panel's Ready to transfer line", () => {
    const seed = seedWardFlowState().referrals[0]!;
    const referral = { ...seed, intake } as Referral;
    const { container } = render(
      <WardFlowProvider initialNow={NOW} initialDayZero={DAY_ZERO.getTime()}>
        <PatientTab referral={referral} now={NOW} personName="Synthetic Person" readOnly />
      </WardFlowProvider>,
    );
    expect(container).toHaveTextContent("Clearance expected 14:30 demo time (passed)");
  });
});
