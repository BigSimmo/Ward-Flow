// Production audit USC-03 (25 Oct 2026). The community screen put record-writing functions on
// `window` (accept, decline, complete contact) plus generic names, and `handleConfirmDecline`
// applied the drafted reason to whatever referral id it was given. The bridge is deleted (Josh's
// approval, 24 Oct 23:55Z and 25 Oct 10:00Z); only two drawer openers remain, in test builds.
// Synthetic data only.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { declineTargetIsOpen } from "@/components/ward-management/community/community-screen-helpers";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const REMOVED_GLOBALS = [
  "acceptReferral",
  "declineReferral",
  "completeContact",
  "switchTab",
  "openModal",
  "openDrawer",
  "selectTeam",
  "openCrisisModal",
] as const;

describe("the community screen installs no record-writing globals (USC-03)", () => {
  it("leaves accept, decline, complete-contact and the generic names off window", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={communityTeamSlug("Mead Centre (Armadale)")} />
      </WardFlowProvider>,
    );
    const win = window as unknown as Record<string, unknown>;
    for (const name of REMOVED_GLOBALS) expect(win[name], name).toBeUndefined();
    // Positive control: the screen did mount its effects, because the test-only openers are there.
    expect(typeof win.openReferralDrawer).toBe("function");
    expect(typeof win.openPatientDrawer).toBe("function");
  });
});

describe("a community decline goes only to the referral whose decline control is open (USC-03)", () => {
  const closedPhone = { declining: false, referralId: null };

  it("accepts the referral whose row has its decline control open", () => {
    expect(declineTargetIsOpen("RF-A", "RF-A", closedPhone)).toBe(true);
  });

  it("refuses any other referral id, so a drafted reason cannot reach it", () => {
    expect(declineTargetIsOpen("RF-B", "RF-A", closedPhone)).toBe(false);
    expect(declineTargetIsOpen("RF-B", undefined, closedPhone)).toBe(false);
  });

  it("accepts the referral open in the phone sheet only while that sheet is declining", () => {
    expect(declineTargetIsOpen("RF-P", undefined, { declining: true, referralId: "RF-P" })).toBe(true);
    expect(declineTargetIsOpen("RF-P", undefined, { declining: false, referralId: "RF-P" })).toBe(false);
    expect(declineTargetIsOpen("RF-B", undefined, { declining: true, referralId: "RF-P" })).toBe(false);
  });
});
